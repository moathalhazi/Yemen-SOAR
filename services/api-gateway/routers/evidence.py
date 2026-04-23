from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import logging
from uuid import UUID
from datetime import datetime
from utils.db import get_db, log_audit_event
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

@router.get("/api/v1/evidence")
async def get_evidence(
    page: int = 1, page_size: int = 20, 
    incident_id: Optional[str] = None, 
    type: Optional[str] = None, 
    current_user: TokenData = Depends(get_current_user)
):
    offset = (page - 1) * page_size
    async with get_db().acquire() as conn:
        query = "SELECT * FROM evidence WHERE 1=1"
        params = []
        if incident_id:
            params.append(incident_id)
            query += f" AND incident_id = ${len(params)}::uuid"
        if type:
            params.append(type)
            query += f" AND type = ${len(params)}"
            
        count_query = query.replace("SELECT *", "SELECT count(*)")
        total = await conn.fetchval(count_query, *params)
        
        query += f" ORDER BY collected_at DESC LIMIT ${len(params)+1} OFFSET ${len(params)+2}"
        params.extend([page_size, offset])
        rows = await conn.fetch(query, *params)
        
        return {
            "items": [record_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total else 0
        }

@router.get("/api/v1/evidence/{evidence_id}")
async def get_single_evidence(evidence_id: str, current_user: TokenData = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM evidence WHERE id = $1::uuid", evidence_id)
        if not row: raise HTTPException(status_code=404, detail="Evidence not found")
        return record_to_dict(row)

@router.get("/api/v1/evidence/{evidence_id}/chain-of-custody")
async def get_chain_of_custody(evidence_id: str, current_user: TokenData = Depends(get_current_user)):
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM chain_of_custody WHERE evidence_id = $1::uuid ORDER BY timestamp DESC", evidence_id)
        return [record_to_dict(r) for r in rows]
