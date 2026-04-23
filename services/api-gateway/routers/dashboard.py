from fastapi import APIRouter, Depends, HTTPException
import logging

from utils.db import get_db
from dependencies import require_permission, TokenData
from routers.heatmap_logic import (
    get_classification_heatmap_logic,
    get_daily_heatmap_logic,
    get_geo_heatmap_logic,
    get_source_heatmap_logic,
    get_time_heatmap_logic,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/v1/stats/overview")
async def get_overview_stats(current_user: TokenData = Depends(require_permission("dashboard.view"))):
    """Get dashboard overview statistics."""
    async with get_db().acquire() as conn:
        alerts = await conn.fetch("""
            SELECT severity, COUNT(*) as count
            FROM alerts
            WHERE received_at > NOW() - INTERVAL '24 hours'
            GROUP BY severity
        """)

        incidents = await conn.fetch("""
            SELECT status, COUNT(*) as count
            FROM incidents
            GROUP BY status
        """)

        totals = await conn.fetchrow("""
            SELECT
                (SELECT COUNT(*) FROM alerts) as total_alerts,
                (SELECT COUNT(*) FROM incidents) as total_incidents,
                (SELECT COUNT(*) FROM playbooks WHERE is_active = true) as active_playbooks,
                (SELECT COUNT(*) FROM evidence) as total_evidence
        """)

        return {
            "alerts_by_severity": {row["severity"]: row["count"] for row in alerts},
            "incidents_by_status": {row["status"]: row["count"] for row in incidents},
            "totals": dict(totals) if totals else {},
        }


@router.get("/api/v1/heatmap/time")
async def get_time_heatmap(days: int = 7, current_user: TokenData = Depends(require_permission("dashboard.view"))):
    try:
        return await get_time_heatmap_logic(days)
    except Exception as exc:
        logger.error(f"Heatmap time error: {exc}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/api/v1/heatmap/daily")
async def get_daily_heatmap(days: int = 7, current_user: TokenData = Depends(require_permission("dashboard.view"))):
    try:
        return await get_daily_heatmap_logic(days)
    except Exception as exc:
        logger.error(f"Heatmap daily error: {exc}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/api/v1/heatmap/source")
async def get_source_heatmap(days: int = 7, current_user: TokenData = Depends(require_permission("dashboard.view"))):
    try:
        return await get_source_heatmap_logic(days)
    except Exception as exc:
        logger.error(f"Heatmap source error: {exc}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/api/v1/heatmap/geo")
async def get_geo_heatmap(days: int = 7, current_user: TokenData = Depends(require_permission("dashboard.view"))):
    try:
        return await get_geo_heatmap_logic(days)
    except Exception as exc:
        logger.error(f"Heatmap geo error: {exc}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/api/v1/heatmap/classification")
async def get_classification_heatmap(days: int = 7, current_user: TokenData = Depends(require_permission("dashboard.view"))):
    try:
        return await get_classification_heatmap_logic(days)
    except Exception as exc:
        logger.error(f"Heatmap classification error: {exc}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/api/v1/dashboard/stats")
async def get_dashboard_stats(current_user: TokenData = Depends(require_permission("dashboard.view"))):
    """Get dashboard statistics."""
    async with get_db().acquire() as conn:
        alerts_severity = await conn.fetch("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity")
        alerts_status = await conn.fetch("SELECT status, COUNT(*) as count FROM alerts GROUP BY status")

        totals = await conn.fetchrow("""
            SELECT
                (SELECT COUNT(*) FROM alerts) as total_alerts,
                (SELECT COUNT(*) FROM incidents WHERE status IN ('open', 'investigating')) as open_incidents,
                (SELECT COUNT(*) FROM playbooks WHERE is_active = true) as active_playbooks,
                (SELECT COUNT(*) FROM evidence WHERE status != 'archived') as pending_evidence
        """)

        metrics = await conn.fetchrow("""
            SELECT
                AVG(mttd_seconds) as mttd_avg,
                AVG(mttr_seconds) as mttr_avg
            FROM incidents
            WHERE mttd_seconds IS NOT NULL
        """)

        return {
            "total_alerts": totals["total_alerts"] if totals else 0,
            "alerts_by_severity": {
                "critical": next((row["count"] for row in alerts_severity if row["severity"] == "critical"), 0),
                "high": next((row["count"] for row in alerts_severity if row["severity"] == "high"), 0),
                "medium": next((row["count"] for row in alerts_severity if row["severity"] == "medium"), 0),
                "low": next((row["count"] for row in alerts_severity if row["severity"] == "low"), 0),
            },
            "alerts_by_status": {
                "new": next((row["count"] for row in alerts_status if row["status"] == "new"), 0),
                "in_progress": next((row["count"] for row in alerts_status if row["status"] == "in_progress"), 0),
                "resolved": next((row["count"] for row in alerts_status if row["status"] == "resolved"), 0),
            },
            "open_incidents": totals["open_incidents"] if totals else 0,
            "active_playbooks": totals["active_playbooks"] if totals else 0,
            "pending_evidence": totals["pending_evidence"] if totals else 0,
            "mttd_avg": float(metrics["mttd_avg"]) if metrics and metrics["mttd_avg"] else 0,
            "mttr_avg": float(metrics["mttr_avg"]) if metrics and metrics["mttr_avg"] else 0,
        }
