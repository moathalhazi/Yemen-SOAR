"""
SOAR Pro — Ingestion Module
POST /alerts — accepts real security alerts from external systems.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Alert
from schemas import AlertCreate, AlertResponse
from modules.normalization.engine import NormalizationEngine
from modules.risk_engine.engine import RiskScoringEngine
from modules.mitre_mapper.mapper import MITREMapper
from modules.playbook_engine.engine import PlaybookEngine
from modules.notification.engine import NotificationEngine
from websocket_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["Alert Ingestion"])

# Module singletons (initialized on first use)
_normalizer = NormalizationEngine()
_risk_engine = RiskScoringEngine()
_mitre = MITREMapper()
_playbook_engine = PlaybookEngine()
_notifier = NotificationEngine()


# ════════════════════════════════════════════════
# POST /alerts — Primary ingestion endpoint
# ════════════════════════════════════════════════

@router.post("", response_model=AlertResponse, status_code=201)
async def ingest_alert(payload: AlertCreate, db: AsyncSession = Depends(get_db)):
    """
    Ingest a real security alert and run the full processing pipeline:
    1. Normalize → 2. Risk Score → 3. MITRE Map → 4. Store →
    5. Playbook Trigger → 6. Forensic Trigger → 7. Notify Dashboard
    """

    # ── 1. Normalize ─────────────────────────────
    normalized = _normalizer.normalize(payload.model_dump())

    # ── 2. MITRE ATT&CK mapping ─────────────────
    mitre_result = _mitre.map_alert(
        title=normalized["title"],
        description=normalized.get("description", ""),
        category=normalized.get("category"),
        alert_type=normalized.get("alert_type"),
    )

    # ── 3. Risk scoring ──────────────────────────
    risk = _risk_engine.calculate(
        severity=normalized["severity"],
        affected_assets=normalized.get("affected_assets", []),
        threat_confidence=normalized.get("threat_confidence"),
    )

    # ── 4. Build and persist Alert ───────────────
    occurred_at = normalized.get("occurred_at")
    if isinstance(occurred_at, str):
        try:
            occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            occurred_at = datetime.now(timezone.utc)
    elif occurred_at is None:
        occurred_at = datetime.now(timezone.utc)

    alert = Alert(
        source_name=normalized["source"],
        external_id=normalized.get("external_id"),
        occurred_at=occurred_at,
        severity=normalized["severity"],
        category=normalized.get("category"),
        alert_type=normalized.get("alert_type"),
        title=normalized["title"],
        description=normalized.get("description"),
        status="new",
        affected_assets=normalized.get("affected_assets"),
        indicators=normalized.get("indicators"),
        raw_data=normalized.get("raw_data"),
        tags=normalized.get("tags", []),
        # Risk
        risk_score=risk.risk_score,
        risk_level=risk.risk_level,
        threat_confidence=risk.threat_confidence,
        # MITRE
        mitre_tactics=mitre_result.get("tactics", []),
        mitre_techniques=mitre_result.get("techniques", []),
    )

    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    logger.info(
        f"Alert ingested: {alert.id} | risk={risk.risk_score:.1f} "
        f"| level={risk.risk_level} | mitre={mitre_result.get('techniques', [])}"
    )

    # ── 5. Auto-trigger playbook (risk > 75) ─────
    if risk.should_trigger_playbook:
        await _playbook_engine.auto_trigger(
            alert_id=alert.id,
            severity=alert.severity,
            category=alert.category,
            risk_score=risk.risk_score,
            db=db,
        )

    # ── 6. Auto-trigger forensic (risk > 80) ─────
    if risk.should_trigger_forensic:
        await _notifier.request_forensic_collection(
            alert_id=str(alert.id),
            severity=alert.severity,
            risk_score=risk.risk_score,
        )

    # ── 7. WebSocket broadcast ───────────────────
    await ws_manager.send_alert_created({
        "id": str(alert.id),
        "title": alert.title,
        "severity": alert.severity,
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level,
    })

    if risk.risk_score >= 80:
        await ws_manager.send_risk_alert({
            "id": str(alert.id),
            "title": alert.title,
            "risk_score": risk.risk_score,
            "message": f"Critical risk alert: {alert.title}",
        })

    return alert


# ════════════════════════════════════════════════
# GET /alerts — List with filters and pagination
# ════════════════════════════════════════════════

@router.get("", response_model=dict)
async def list_alerts(
    page: int = 1,
    page_size: int = 20,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List alerts with pagination and filters."""
    query = select(Alert)

    if severity:
        query = query.where(Alert.severity == severity)
    if status:
        query = query.where(Alert.status == status)
    if risk_level:
        query = query.where(Alert.risk_level == risk_level)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginate
    query = query.order_by(desc(Alert.received_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return {
        "items": [_alert_to_dict(a) for a in alerts],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ════════════════════════════════════════════════
# GET /alerts/{id}
# ════════════════════════════════════════════════

@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get alert by ID."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alert not found")
    return alert


# ════════════════════════════════════════════════
# GET /alerts/stats
# ════════════════════════════════════════════════

@router.get("/stats/overview")
async def alert_stats(db: AsyncSession = Depends(get_db)):
    """Get alert statistics for the dashboard."""
    result = await db.execute(select(
        Alert.severity,
        func.count().label("count"),
    ).group_by(Alert.severity))
    by_severity = {row.severity: row.count for row in result}

    result2 = await db.execute(select(
        Alert.risk_level,
        func.count().label("count"),
    ).where(Alert.risk_level.isnot(None)).group_by(Alert.risk_level))
    by_risk = {row.risk_level: row.count for row in result2}

    total = await db.execute(select(func.count()).select_from(Alert))

    return {
        "total_alerts": total.scalar_one(),
        "by_severity": by_severity,
        "by_risk_level": by_risk,
    }


def _alert_to_dict(a: Alert) -> dict:
    return {
        "id": str(a.id),
        "source_name": a.source_name,
        "severity": a.severity,
        "status": a.status,
        "title": a.title,
        "risk_score": a.risk_score,
        "risk_level": a.risk_level,
        "mitre_tactics": a.mitre_tactics,
        "received_at": a.received_at.isoformat() if a.received_at else None,
    }
