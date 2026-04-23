"""
SOAR Pro — Threat Intelligence Module
Provides indicator management, lookup, and alert enrichment
using the existing threat_indicators, ti_feed_sources, and ti_lookup_history tables.
"""

import time
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from utils.db import get_db, log_audit_event
from utils.serializers import serialize_row, serialize_rows
from dependencies import get_current_user, require_permission, TokenData

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic Models ──────────────────────────────

class IndicatorCreate(BaseModel):
    indicator: str = Field(..., min_length=1, max_length=1000)
    indicator_type: str = Field(..., pattern=r"^(ip|domain|url|md5|sha1|sha256|email|cve)$")
    threat_level: str = Field(default="unknown", pattern=r"^(unknown|clean|suspicious|malicious)$")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: List[str] = []
    related_malware: List[str] = []
    related_campaigns: List[str] = []
    sources: Optional[dict] = None


class IndicatorLookup(BaseModel):
    indicator: str = Field(..., min_length=1, max_length=1000)
    indicator_type: Optional[str] = None


# ════════════════════════════════════════════════
# POST /indicators — Add a threat indicator
# ════════════════════════════════════════════════

@router.post("/api/v1/threat-intel/indicators", status_code=201)
async def add_indicator(
    data: IndicatorCreate,
    current_user: TokenData = Depends(require_permission("threat_intel.manage"))
):
    """Add or update a threat intelligence indicator."""
    pool = get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO threat_indicators (
                indicator, indicator_type, threat_level, confidence,
                tags, related_malware, related_campaigns, sources
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            ON CONFLICT (indicator, indicator_type) DO UPDATE SET
                threat_level = EXCLUDED.threat_level,
                confidence = EXCLUDED.confidence,
                tags = EXCLUDED.tags,
                related_malware = EXCLUDED.related_malware,
                related_campaigns = EXCLUDED.related_campaigns,
                sources = EXCLUDED.sources,
                updated_at = NOW(),
                last_seen = NOW()
            RETURNING id, indicator, indicator_type, threat_level, confidence, created_at
        """,
            data.indicator, data.indicator_type, data.threat_level, data.confidence,
            data.tags, data.related_malware, data.related_campaigns,
            json.dumps(data.sources) if data.sources else None,
        )

    logger.info(f"TI indicator added/updated: {data.indicator} ({data.indicator_type})")
    return serialize_row(row)


# ════════════════════════════════════════════════
# GET /indicators — List/search indicators
# ════════════════════════════════════════════════

@router.get("/api/v1/threat-intel/indicators")
async def list_indicators(
    page: int = 1,
    page_size: int = 50,
    indicator_type: Optional[str] = None,
    threat_level: Optional[str] = None,
    search: Optional[str] = None,
    current_user: TokenData = Depends(require_permission("threat_intel.view"))
):
    """List threat indicators with filtering and pagination."""
    pool = get_db()
    clauses = []
    params = []
    idx = 1

    if indicator_type:
        clauses.append(f"indicator_type = ${idx}")
        params.append(indicator_type)
        idx += 1
    if threat_level:
        clauses.append(f"threat_level = ${idx}")
        params.append(threat_level)
        idx += 1
    if search:
        clauses.append(f"indicator ILIKE ${idx}")
        params.append(f"%{search}%")
        idx += 1

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM threat_indicators {where}", *params
        )
        offset = (page - 1) * page_size
        rows = await conn.fetch(f"""
            SELECT id, indicator, indicator_type, threat_level, confidence,
                   tags, related_malware, related_campaigns, first_seen, last_seen
            FROM threat_indicators {where}
            ORDER BY last_seen DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """, *params, page_size, offset)

    return {
        "items": serialize_rows(rows),
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ════════════════════════════════════════════════
# POST /lookup — Lookup an indicator
# ════════════════════════════════════════════════

@router.post("/api/v1/threat-intel/lookup")
async def lookup_indicator(
    data: IndicatorLookup,
    current_user: TokenData = Depends(require_permission("threat_intel.view"))
):
    """
    Lookup a threat intelligence indicator in the local database.
    Logs the lookup to ti_lookup_history.
    """
    pool = get_db()
    start = time.time()

    async with pool.acquire() as conn:
        # Search by indicator value
        clauses = ["indicator = $1"]
        params = [data.indicator]
        if data.indicator_type:
            clauses.append("indicator_type = $2")
            params.append(data.indicator_type)

        where = " AND ".join(clauses)
        rows = await conn.fetch(f"""
            SELECT id, indicator, indicator_type, threat_level, confidence,
                   tags, related_malware, related_campaigns, sources,
                   first_seen, last_seen
            FROM threat_indicators
            WHERE {where}
        """, *params)

        duration_ms = int((time.time() - start) * 1000)
        cache_hit = False

        # Determine overall threat level
        threat_level = "unknown"
        if rows:
            levels = [r["threat_level"] for r in rows]
            if "malicious" in levels:
                threat_level = "malicious"
            elif "suspicious" in levels:
                threat_level = "suspicious"
            elif "clean" in levels:
                threat_level = "clean"

        # Log lookup
        await conn.execute("""
            INSERT INTO ti_lookup_history (
                indicator, indicator_type, threat_level,
                cache_hit, lookup_duration_ms, requested_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """,
            data.indicator,
            data.indicator_type or "unknown",
            threat_level,
            cache_hit,
            duration_ms,
            current_user.username,
        )

    return {
        "indicator": data.indicator,
        "threat_level": threat_level,
        "matches": serialize_rows(rows),
        "total_matches": len(rows),
        "lookup_duration_ms": duration_ms,
    }


# ════════════════════════════════════════════════
# GET /feeds — List TI feed sources
# ════════════════════════════════════════════════

@router.get("/api/v1/threat-intel/feeds")
async def list_feeds(
    current_user: TokenData = Depends(require_permission("threat_intel.view"))
):
    """List all configured threat intelligence feed sources."""
    pool = get_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, source_type, url, is_active, priority,
                   rate_limit, last_sync, sync_interval_minutes, created_at
            FROM ti_feed_sources ORDER BY priority DESC, name
        """)
    return {"feeds": serialize_rows(rows)}


# ════════════════════════════════════════════════
# POST /enrich/{alert_id} — Enrich alert with TI
# ════════════════════════════════════════════════

@router.post("/api/v1/threat-intel/enrich/{alert_id}")
async def enrich_alert(
    alert_id: str,
    current_user: TokenData = Depends(require_permission("threat_intel.view"))
):
    """
    Enrich an alert by looking up its indicators (IPs, domains, hashes)
    against the local threat intelligence database.
    """
    pool = get_db()
    async with pool.acquire() as conn:
        # Fetch alert indicators
        alert = await conn.fetchrow(
            "SELECT id, indicators, title FROM alerts WHERE id = $1::uuid", alert_id
        )
        if not alert:
            raise HTTPException(404, "Alert not found")

        indicators_data = alert["indicators"]
        if isinstance(indicators_data, str):
            indicators_data = json.loads(indicators_data)
        if not indicators_data:
            return {"alert_id": alert_id, "enrichments": [], "message": "No indicators to enrich"}

        enrichments = []
        all_indicators = []

        # Extract all indicator values
        for ioc_type, values in indicators_data.items():
            if isinstance(values, list):
                for v in values:
                    ti_type = _map_ioc_type(ioc_type)
                    all_indicators.append((v, ti_type))

        # Lookup each indicator
        for indicator_val, ti_type in all_indicators:
            matches = await conn.fetch("""
                SELECT indicator, indicator_type, threat_level, confidence, tags
                FROM threat_indicators
                WHERE indicator = $1
            """, indicator_val)

            if matches:
                for m in matches:
                    enrichments.append({
                        "indicator": m["indicator"],
                        "type": m["indicator_type"],
                        "threat_level": m["threat_level"],
                        "confidence": float(m["confidence"]) if m["confidence"] else 0,
                        "tags": list(m["tags"]) if m["tags"] else [],
                    })

    return {
        "alert_id": alert_id,
        "alert_title": alert["title"],
        "total_indicators_checked": len(all_indicators),
        "enrichments": enrichments,
        "threats_found": sum(1 for e in enrichments if e["threat_level"] in ("malicious", "suspicious")),
    }


def _map_ioc_type(key: str) -> str:
    """Map frontend IoC key names to TI indicator types."""
    mapping = {
        "ips": "ip",
        "domains": "domain",
        "urls": "url",
        "hashes": "sha256",
        "emails": "email",
    }
    return mapping.get(key, "unknown")
