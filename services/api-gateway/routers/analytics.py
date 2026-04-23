from fastapi import APIRouter, Depends
from typing import Optional, List, Dict, Any
import logging
from uuid import UUID
from datetime import datetime, timedelta
from utils.db import get_db
from dependencies import get_current_user, TokenData

router = APIRouter()
logger = logging.getLogger(__name__)

def record_to_dict(row):
    item = dict(row)
    for key, value in item.items():
        if isinstance(value, UUID):
            item[key] = str(value)
        elif isinstance(value, datetime):
            item[key] = value.isoformat()
    return item

@router.get("/api/v1/analytics/incidents-trend")
async def get_incidents_trend(range: str = '7d', current_user: TokenData = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        days = 7 if range == '7d' else 30
        rows = await conn.fetch(f"""
            SELECT DATE(detected_at) as date, count(*) as count 
            FROM incidents 
            WHERE detected_at > NOW() - INTERVAL '{days} days'
            GROUP BY DATE(detected_at)
            ORDER BY date ASC
        """)
        return [record_to_dict(r) for r in rows]

@router.get("/api/v1/analytics/severity-distribution")
async def get_severity_distribution(current_user: TokenData = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT severity as name, count(*) as value FROM incidents GROUP BY severity")
        return [record_to_dict(r) for r in rows]

@router.get("/api/v1/analytics/attack-categories")
async def get_attack_categories(current_user: TokenData = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT category as name, count(*) as value FROM incidents WHERE category IS NOT NULL GROUP BY category LIMIT 10")
        return [record_to_dict(r) for r in rows]
