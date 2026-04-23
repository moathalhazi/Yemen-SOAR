from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
import logging
import json
from uuid import UUID
from datetime import datetime
from utils.db import get_db, log_audit_event
from dependencies import get_current_user, require_permission, TokenData

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


# ════════════════════════════════════════════════
# CRUD — Playbooks
# ════════════════════════════════════════════════

@router.get("/api/v1/playbooks")
async def get_playbooks(
    page: int = 1,
    page_size: int = 20,
    current_user: TokenData = Depends(require_permission("playbooks.read")),
):
    offset = (page - 1) * page_size
    async with get_db().acquire() as conn:
        total = await conn.fetchval("SELECT count(*) FROM playbooks")
        rows = await conn.fetch(
            "SELECT * FROM playbooks ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            page_size, offset,
        )
        items = []
        for r in rows:
            d = record_to_dict(r)
            if isinstance(d.get("workflow"), str):
                d["workflow"] = json.loads(d["workflow"])
            if isinstance(d.get("trigger_conditions"), str):
                d["trigger_conditions"] = json.loads(d["trigger_conditions"])
            if isinstance(d.get("rollback_steps"), str):
                d["rollback_steps"] = json.loads(d["rollback_steps"])
            items.append(d)
        return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/api/v1/playbooks/{playbook_id}")
async def get_playbook(playbook_id: str, current_user: TokenData = Depends(require_permission("playbooks.read"))):
    async with get_db().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM playbooks WHERE id = $1::uuid", playbook_id)
        if not row:
            raise HTTPException(status_code=404, detail="Playbook not found")
        item = record_to_dict(row)
        for field in ("workflow", "trigger_conditions", "rollback_steps"):
            if isinstance(item.get(field), str):
                item[field] = json.loads(item[field])
        return item


@router.post("/api/v1/playbooks")
async def create_playbook(data: dict, current_user: TokenData = Depends(require_permission("playbooks.manage"))):
    async with get_db().acquire() as conn:
        try:
            workflow = json.dumps(data.get("workflow", {}))
            trigger_conditions = json.dumps(data.get("trigger_conditions")) if data.get("trigger_conditions") else None
            rollback_steps = json.dumps(data.get("rollback_steps")) if data.get("rollback_steps") else None

            row = await conn.fetchrow("""
                INSERT INTO playbooks
                    (name, description, workflow, category, incident_type,
                     execution_mode, trigger_conditions, rollback_steps,
                     requires_approval, timeout_seconds, max_retries, created_by)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12::uuid) RETURNING *
            """,
                data.get("name"), data.get("description", ""), workflow,
                data.get("category"), data.get("incident_type"),
                data.get("execution_mode", "MANUAL"),
                trigger_conditions, rollback_steps,
                data.get("requires_approval", False),
                data.get("timeout_seconds", 3600),
                data.get("max_retries", 3),
                current_user.user_id,
            )

            await log_audit_event(
                user_id=current_user.user_id, username=current_user.username,
                action_type="CREATE", entity_type="PLAYBOOK", entity_id=str(row["id"]),
                details={"name": data.get("name")},
            )
            return record_to_dict(row)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.patch("/api/v1/playbooks/{playbook_id}")
async def update_playbook(playbook_id: str, data: dict, current_user: TokenData = Depends(require_permission("playbooks.manage"))):
    async with get_db().acquire() as conn:
        set_clauses = []
        params = [playbook_id]
        updated = {}

        simple_fields = ["name", "description", "is_active", "category", "incident_type", "execution_mode",
                         "requires_approval", "timeout_seconds", "max_retries"]
        for k, v in data.items():
            if k in simple_fields:
                params.append(v)
                set_clauses.append(f"{k} = ${len(params)}")
                updated[k] = v
            elif k in ("workflow", "trigger_conditions", "rollback_steps"):
                params.append(json.dumps(v))
                set_clauses.append(f"{k} = ${len(params)}::jsonb")
                updated[k] = "updated"

        if not set_clauses:
            return await get_playbook(playbook_id, current_user)

        query = f"UPDATE playbooks SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = $1::uuid RETURNING *"
        row = await conn.fetchrow(query, *params)

        await log_audit_event(
            user_id=current_user.user_id, username=current_user.username,
            action_type="UPDATE", entity_type="PLAYBOOK", entity_id=playbook_id,
            details={"updated_fields": updated},
        )
        return record_to_dict(row)


@router.delete("/api/v1/playbooks/{playbook_id}")
async def delete_playbook(playbook_id: str, current_user: TokenData = Depends(require_permission("playbooks.manage"))):
    async with get_db().acquire() as conn:
        await conn.execute("DELETE FROM playbooks WHERE id = $1::uuid", playbook_id)
        await log_audit_event(
            user_id=current_user.user_id, username=current_user.username,
            action_type="DELETE", entity_type="PLAYBOOK", entity_id=playbook_id,
        )
        return {"message": "Playbook deleted"}


# ════════════════════════════════════════════════
# Execution — Run / Cancel / Status
# ════════════════════════════════════════════════

@router.post("/api/v1/playbooks/{playbook_id}/run")
async def run_playbook(
    playbook_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: TokenData = Depends(require_permission("playbooks.execute")),
):
    """Trigger playbook execution (runs in background)."""
    from playbook_engine import execute_playbook

    incident_id = data.get("incident_id")
    alert_id = data.get("alert_id")

    # Start execution in background so response is immediate
    background_tasks.add_task(
        execute_playbook,
        playbook_id=playbook_id,
        incident_id=incident_id,
        alert_id=alert_id,
        initiated_by=current_user.user_id,
        initiated_by_system="manual",
    )

    await log_audit_event(
        user_id=current_user.user_id, username=current_user.username,
        action_type="EXECUTE", entity_type="PLAYBOOK", entity_id=playbook_id,
        details={"incident_id": incident_id, "trigger": "manual"},
    )

    return {"message": "Playbook execution started", "playbook_id": playbook_id}


@router.post("/api/v1/playbook-executions/{execution_id}/cancel")
async def cancel_execution_endpoint(
    execution_id: str,
    current_user: TokenData = Depends(require_permission("playbooks.execute")),
):
    """Cancel a running playbook execution (admin only)."""
    from playbook_engine import cancel_execution
    result = await cancel_execution(execution_id, current_user.user_id)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


# ════════════════════════════════════════════════
# Execution Logs
# ════════════════════════════════════════════════

@router.get("/api/v1/playbooks/{playbook_id}/executions")
async def get_playbook_executions(
    playbook_id: str,
    current_user: TokenData = Depends(require_permission("playbooks.read")),
):
    """List all executions for a playbook."""
    async with get_db().acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM playbook_executions
            WHERE playbook_id = $1::uuid
            ORDER BY started_at DESC LIMIT 50
        """, playbook_id)
        return {"items": [record_to_dict(r) for r in rows]}


@router.get("/api/v1/playbook-executions/{execution_id}")
async def get_execution_detail(
    execution_id: str,
    current_user: TokenData = Depends(require_permission("playbooks.read")),
):
    """Get execution detail with steps."""
    async with get_db().acquire() as conn:
        exec_row = await conn.fetchrow(
            "SELECT * FROM playbook_executions WHERE id = $1::uuid", execution_id
        )
        if not exec_row:
            raise HTTPException(status_code=404, detail="Execution not found")

        steps = await conn.fetch("""
            SELECT * FROM playbook_execution_steps
            WHERE execution_id = $1::uuid
            ORDER BY step_number ASC
        """, execution_id)

        result = record_to_dict(exec_row)
        if isinstance(result.get("output_data"), str):
            result["output_data"] = json.loads(result["output_data"])
        if isinstance(result.get("input_data"), str):
            result["input_data"] = json.loads(result["input_data"])
        result["steps"] = [record_to_dict(s) for s in steps]

        # Parse step JSON fields
        for s in result["steps"]:
            if isinstance(s.get("output_data"), str):
                s["output_data"] = json.loads(s["output_data"])
            if isinstance(s.get("input_params"), str):
                s["input_params"] = json.loads(s["input_params"])

        return result


@router.get("/api/v1/playbook-executions/{execution_id}/steps")
async def get_execution_steps(
    execution_id: str,
    current_user: TokenData = Depends(require_permission("playbooks.read")),
):
    """Get step-by-step log for an execution."""
    async with get_db().acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM playbook_execution_steps
            WHERE execution_id = $1::uuid
            ORDER BY step_number ASC
        """, execution_id)
        items = []
        for r in rows:
            d = record_to_dict(r)
            if isinstance(d.get("output_data"), str):
                d["output_data"] = json.loads(d["output_data"])
            if isinstance(d.get("input_params"), str):
                d["input_params"] = json.loads(d["input_params"])
            items.append(d)
        return {"items": items}
