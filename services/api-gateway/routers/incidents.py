from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
import logging
from uuid import UUID
from datetime import datetime
from utils.db import get_db, log_audit_event
from dependencies import get_current_user, TokenData, require_permission

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

@router.get("/api/v1/incidents")
async def get_incidents(
    page: int = 1, page_size: int = 20, status: Optional[str] = None, 
    severity: Optional[str] = None, current_user: TokenData = Depends(require_permission("incidents.read"))
):
    offset = (page - 1) * page_size
    async with get_db().acquire() as conn:
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []
        if status:
            params.append(status)
            query += f" AND status = ${len(params)}"
        if severity:
            params.append(severity)
            query += f" AND severity = ${len(params)}"
            
        count_query = query.replace("SELECT *", "SELECT count(*)")
        total = await conn.fetchval(count_query, *params)
        
        query += f" ORDER BY detected_at DESC LIMIT ${len(params)+1} OFFSET ${len(params)+2}"
        params.extend([page_size, offset])
        rows = await conn.fetch(query, *params)
        
        return {
            "items": [record_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total else 0
        }

@router.get("/api/v1/incidents/{incident_id}")
async def get_incident(incident_id: str, current_user: TokenData = Depends(require_permission("incidents.read"))):
    async with get_db().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM incidents WHERE id = $1::uuid", incident_id)
        if not row: raise HTTPException(status_code=404, detail="Incident not found")
        return record_to_dict(row)

@router.patch("/api/v1/incidents/{incident_id}")
async def update_incident(incident_id: str, data: dict, current_user: TokenData = Depends(require_permission("incidents.update"))):
    async with get_db().acquire() as conn:
        set_clauses = []
        params = [incident_id]
        updated_fields = {}
        for k, v in data.items():
            if k in ['title', 'description', 'status', 'severity', 'assigned_to']:
                params.append(v)
                set_clauses.append(f"{k} = ${len(params)}")
                updated_fields[k] = v
        
        if not set_clauses: return await get_incident(incident_id, getattr(current_user, 'token_data', current_user))
        
        query = f"UPDATE incidents SET {', '.join(set_clauses)} WHERE id = $1::uuid RETURNING *"
        row = await conn.fetchrow(query, *params)
        
        await log_audit_event(
            user_id=current_user.user_id, username=current_user.username,
            action_type="UPDATE", entity_type="INCIDENT", entity_id=incident_id,
            details={"updated_fields": updated_fields}
        )
        return record_to_dict(row)

@router.post("/api/v1/incidents")
async def create_incident(data: dict, current_user: TokenData = Depends(require_permission("incidents.create"))):
    async with get_db().acquire() as conn:
        title = data.get("title", "New Incident")
        severity = data.get("severity", "medium")
        description = data.get("description", "")
        incident_type = data.get("incident_type")
        category = data.get("category")
        
        row = await conn.fetchrow("""
            INSERT INTO incidents (title, severity, description, incident_type, category, detected_at, created_by)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6::uuid) RETURNING *
        """, title, severity, description, incident_type, category, current_user.user_id)
        
        incident_id = str(row['id'])
        await log_audit_event(
            user_id=current_user.user_id, username=current_user.username,
            action_type="CREATE", entity_type="INCIDENT", entity_id=incident_id,
            details={"title": title, "severity": severity, "incident_type": incident_type}
        )

        # Auto-trigger matching playbook (fire-and-forget)
        if incident_type or category:
            import asyncio
            from playbook_trigger import auto_trigger_on_incident
            asyncio.create_task(auto_trigger_on_incident(incident_id, {
                "incident_type": incident_type,
                "category": category,
                "severity": severity,
            }))

        return record_to_dict(row)

@router.get("/api/v1/incidents/{incident_id}/timeline")
async def get_incident_timeline(incident_id: str, current_user: TokenData = Depends(require_permission("incidents.read"))):
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM incident_timeline WHERE incident_id = $1::uuid ORDER BY timestamp DESC", incident_id)
        return [record_to_dict(r) for r in rows]
