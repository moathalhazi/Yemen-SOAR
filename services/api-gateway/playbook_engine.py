"""
SOAR Pro — Playbook Execution Engine
Deterministic, rule-based step-by-step execution with safety controls.
"""

import logging
import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from utils.db import get_db, log_audit_event

logger = logging.getLogger(__name__)

# ── Action handlers (simulated) ─────────────────
# In production these would call real APIs (firewall, EDR, IAM, etc.)

ACTION_HANDLERS = {
    "BLOCK_IP": "Blocked IP {target} at perimeter firewall",
    "UNBLOCK_IP": "Unblocked IP {target} at perimeter firewall",
    "ISOLATE_HOST": "Isolated host {target} from network via EDR",
    "RESTORE_HOST": "Restored host {target} network connectivity",
    "DISABLE_USER": "Disabled user account {target} in IAM",
    "ENABLE_USER": "Re-enabled user account {target} in IAM",
    "FORCE_PASSWORD_RESET": "Forced password reset for {target}",
    "BLOCK_HASH": "Blocked file hash {target} across EDR fleet",
    "UNBLOCK_HASH": "Removed hash {target} from EDR block list",
    "KILL_PROCESS": "Terminated process {target} on affected host",
    "AV_SCAN": "Initiated {scope} antivirus scan",
    "COLLECT_FORENSIC": "Collected forensic evidence ({type})",
    "ENABLE_LOGGING": "Enabled enhanced logging for {scope}",
    "NOTIFY": "Sent notification via {channel}: {message}",
    "BLOCK_DOMAIN": "Blocked domain {target} at email gateway",
    "SEARCH_MAILBOXES": "Searched mailboxes for related indicators",
    "CREATE_INCIDENT": "Created incident (severity: {severity})",
    "BLOCK_TRANSFER": "Blocked external data transfers from {target}",
    "PRESERVE_LOGS": "Preserved network traffic logs for forensics",
    "EXTRACT_IOCS": "Extracted IOCs from alert data",
    "ENDPOINT_SCAN": "Scanned endpoints for compromise indicators",
}


async def execute_step(action: str, params: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
    """Execute a single playbook step (deterministic simulation)."""
    start = datetime.now(timezone.utc)

    try:
        # Simulate execution time (0.5-2s depending on action)
        delay = 0.5 if action in ("NOTIFY", "ENABLE_LOGGING") else 1.0
        if action in ("AV_SCAN", "COLLECT_FORENSIC", "ISOLATE_HOST"):
            delay = 1.5
        await asyncio.sleep(delay)

        # Get handler template
        template = ACTION_HANDLERS.get(action)
        if not template:
            return {
                "status": "failed",
                "output": None,
                "error_message": f"Unknown action type: {action}",
                "duration": (datetime.now(timezone.utc) - start).total_seconds(),
            }

        # Build output message from params
        fmt_kwargs = dict(params)
        fmt_kwargs.setdefault("target", "N/A")
        fmt_kwargs.setdefault("scope", "default")
        fmt_kwargs.setdefault("channel", "default")
        fmt_kwargs.setdefault("message", "")
        fmt_kwargs.setdefault("type", "unknown")
        fmt_kwargs.setdefault("severity", "medium")
        fmt_kwargs.setdefault("recipient", "")
        output = template.format(**fmt_kwargs)

        return {
            "status": "success",
            "output": output,
            "error_message": None,
            "duration": round((datetime.now(timezone.utc) - start).total_seconds(), 2),
        }

    except asyncio.TimeoutError:
        return {
            "status": "failed",
            "output": None,
            "error_message": f"Step timed out after {timeout}s",
            "duration": timeout,
        }
    except Exception as e:
        return {
            "status": "failed",
            "output": None,
            "error_message": str(e),
            "duration": round((datetime.now(timezone.utc) - start).total_seconds(), 2),
        }


# ── Safety Controls ──────────────────────────────

async def check_duplicate_execution(conn, playbook_id: str, incident_id: str) -> bool:
    """Returns True if there is already an active execution for this playbook+incident."""
    row = await conn.fetchval("""
        SELECT COUNT(*) FROM playbook_executions
        WHERE playbook_id = $1::uuid AND incident_id = $2::uuid
          AND status IN ('pending', 'running')
    """, playbook_id, incident_id)
    return row > 0


async def acquire_incident_lock(conn, incident_id: str, execution_id: str) -> bool:
    """Try to lock the incident for exclusive playbook execution."""
    result = await conn.execute("""
        UPDATE incidents SET execution_lock = true, locked_by_execution = $2::uuid
        WHERE id = $1::uuid AND (execution_lock = false OR execution_lock IS NULL)
    """, incident_id, execution_id)
    return result.endswith("1")  # "UPDATE 1" means success


async def release_incident_lock(conn, incident_id: str):
    """Release the execution lock on an incident."""
    await conn.execute("""
        UPDATE incidents SET execution_lock = false, locked_by_execution = NULL
        WHERE id = $1::uuid
    """, incident_id)


# ── Main Execution Engine ────────────────────────

async def execute_playbook(
    playbook_id: str,
    incident_id: Optional[str] = None,
    alert_id: Optional[str] = None,
    initiated_by: Optional[str] = None,
    initiated_by_system: str = "manual",
) -> Dict[str, Any]:
    """
    Execute a playbook step-by-step with full lifecycle management.

    Flow:
      1. Validate & create execution record
      2. Lock incident
      3. Execute steps sequentially
      4. On failure → rollback
      5. Generate summary
      6. Update incident status
      7. Release lock
    """
    pool = get_db()
    async with pool.acquire() as conn:
        # ── 1. Fetch playbook ────────────────────
        playbook = await conn.fetchrow(
            "SELECT * FROM playbooks WHERE id = $1::uuid AND is_active = true", playbook_id
        )
        if not playbook:
            return {"status": "error", "message": "Playbook not found or inactive"}

        workflow = playbook["workflow"] if isinstance(playbook["workflow"], dict) else json.loads(playbook["workflow"])
        steps = workflow.get("steps", [])
        if not steps:
            return {"status": "error", "message": "Playbook has no steps defined"}

        # ── 2. Safety: duplicate check ───────────
        if incident_id:
            if await check_duplicate_execution(conn, playbook_id, incident_id):
                return {"status": "error", "message": "A playbook is already running for this incident"}

        # ── 3. Create execution record ───────────
        exec_row = await conn.fetchrow("""
            INSERT INTO playbook_executions
                (playbook_id, incident_id, alert_id, status, total_steps,
                 completed_steps, failed_steps, initiated_by, initiated_by_system, input_data)
            VALUES ($1::uuid, $2, $3, 'running', $4, 0, 0, $5, $6, $7::jsonb)
            RETURNING id
        """,
            playbook_id,
            incident_id if incident_id else None,
            alert_id if alert_id else None,
            len(steps),
            initiated_by if initiated_by else None,
            initiated_by_system,
            json.dumps({"playbook_name": playbook["name"], "trigger": initiated_by_system}),
        )
        execution_id = str(exec_row["id"])

        # ── 4. Lock incident ─────────────────────
        if incident_id:
            locked = await acquire_incident_lock(conn, incident_id, execution_id)
            if not locked:
                await conn.execute(
                    "UPDATE playbook_executions SET status = 'failed', error_message = 'Could not acquire incident lock' WHERE id = $1::uuid",
                    execution_id,
                )
                return {"status": "error", "message": "Incident is locked by another execution"}

            # Set incident status → investigating
            await conn.execute(
                "UPDATE incidents SET status = 'investigating' WHERE id = $1::uuid", incident_id
            )

    # ── 5. Execute steps ─────────────────────
    exec_start = datetime.now(timezone.utc)
    completed = 0
    failed = 0
    step_results = []
    all_success = True

    for idx, step in enumerate(steps):
        step_name = step.get("name", f"Step {idx + 1}")
        action = step.get("action", "UNKNOWN")
        params = step.get("params", {})
        timeout = step.get("timeout", 30)
        retry_count = step.get("retry_count", 0)
        stop_on_failure = step.get("stop_on_failure", False)

        # Create step record
        async with pool.acquire() as conn:
            step_row = await conn.fetchrow("""
                INSERT INTO playbook_execution_steps
                    (execution_id, step_number, step_name, action, status, input_params, started_at)
                VALUES ($1::uuid, $2, $3, $4, 'running', $5::jsonb, NOW())
                RETURNING id
            """, execution_id, idx + 1, step_name, action, json.dumps(params))
            step_id = str(step_row["id"])

        # Execute with retries
        result = None
        attempts = 0
        while attempts <= retry_count:
            result = await execute_step(action, params, timeout)
            if result["status"] == "success":
                break
            attempts += 1
            if attempts <= retry_count:
                logger.info(f"Step '{step_name}' failed, retry {attempts}/{retry_count}")
                await asyncio.sleep(0.3)

        # Update step record
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE playbook_execution_steps
                SET status = $2, completed_at = NOW(),
                    duration_seconds = $3, output_data = $4::jsonb,
                    error_message = $5, retry_count = $6
                WHERE id = $1::uuid
            """,
                step_id,
                result["status"],
                int(result["duration"]),
                json.dumps({"output": result["output"]}),
                result.get("error_message"),
                attempts,
            )

        if result["status"] == "success":
            completed += 1
        else:
            failed += 1
            all_success = False

        step_results.append({
            "step": idx + 1,
            "name": step_name,
            "action": action,
            "status": result["status"],
            "output": result.get("output"),
            "error": result.get("error_message"),
            "duration": result["duration"],
        })

        # Update execution progress
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE playbook_executions
                SET completed_steps = $2, failed_steps = $3
                WHERE id = $1::uuid
            """, execution_id, completed, failed)

        # Stop on failure if configured
        if result["status"] != "success" and stop_on_failure:
            logger.warning(f"Playbook stopped at step {idx + 1} '{step_name}' (stop_on_failure=true)")
            break

    # ── 6. Rollback on failure ───────────────
    rollback_results = []
    if not all_success and playbook.get("rollback_steps"):
        rb_data = playbook["rollback_steps"] if isinstance(playbook["rollback_steps"], dict) else json.loads(playbook["rollback_steps"])
        rb_steps = rb_data.get("steps", [])
        for rb_step in rb_steps:
            rb_result = await execute_step(rb_step.get("action", "UNKNOWN"), rb_step.get("params", {}))
            rollback_results.append({
                "name": rb_step.get("name"),
                "status": rb_result["status"],
                "output": rb_result.get("output"),
            })

    # ── 7. Generate summary & finalize ───────
    exec_end = datetime.now(timezone.utc)
    total_duration = round((exec_end - exec_start).total_seconds(), 2)
    final_status = "success" if all_success else "failed"

    summary = {
        "playbook_name": playbook["name"],
        "incident_id": incident_id,
        "execution_id": execution_id,
        "start_time": exec_start.isoformat(),
        "end_time": exec_end.isoformat(),
        "duration_seconds": total_duration,
        "total_steps": len(steps),
        "steps_executed": completed + failed,
        "steps_succeeded": completed,
        "steps_failed": failed,
        "actions_taken": [s["output"] for s in step_results if s["status"] == "success"],
        "errors": [{"step": s["name"], "error": s["error"]} for s in step_results if s["status"] != "success"],
        "rollback_executed": len(rollback_results) > 0,
        "rollback_results": rollback_results,
        "final_status": final_status,
        "risk_reduced_level": "HIGH" if all_success else "PARTIAL",
        "recommendations": _generate_recommendations(playbook["category"], all_success),
    }

    async with pool.acquire() as conn:
        # Update execution record
        await conn.execute("""
            UPDATE playbook_executions
            SET status = $2, completed_at = NOW(), duration_seconds = $3,
                output_data = $4::jsonb, completed_steps = $5, failed_steps = $6
            WHERE id = $1::uuid
        """, execution_id, final_status, int(total_duration),
            json.dumps(summary), completed, failed)

        # Update playbook stats
        if all_success:
            await conn.execute("""
                UPDATE playbooks SET execution_count = execution_count + 1,
                    success_count = success_count + 1, last_executed = NOW()
                WHERE id = $1::uuid
            """, playbook_id)
        else:
            await conn.execute("""
                UPDATE playbooks SET execution_count = execution_count + 1,
                    failure_count = failure_count + 1, last_executed = NOW()
                WHERE id = $1::uuid
            """, playbook_id)

        # Update incident status
        if incident_id:
            new_status = "eradicated" if all_success else "contained"
            await conn.execute(
                "UPDATE incidents SET status = $2 WHERE id = $1::uuid", incident_id, new_status
            )
            # Release lock
            await release_incident_lock(conn, incident_id)

        # Audit log
        await log_audit_event(
            user_id=initiated_by, username="System",
            action_type="PLAYBOOK_EXECUTION", entity_type="PLAYBOOK",
            entity_id=playbook_id,
            status="SUCCESS" if all_success else "FAILED",
            severity="INFO" if all_success else "WARNING",
            details={"execution_id": execution_id, "result": final_status, "steps": completed + failed},
        )

    logger.info(f"Playbook '{playbook['name']}' execution {final_status} | "
                f"Steps: {completed}/{len(steps)} | Duration: {total_duration}s")

    return summary


async def cancel_execution(execution_id: str, cancelled_by: str) -> Dict[str, Any]:
    """Cancel a running playbook execution."""
    pool = get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM playbook_executions WHERE id = $1::uuid", execution_id
        )
        if not row:
            return {"status": "error", "message": "Execution not found"}
        if row["status"] != "running":
            return {"status": "error", "message": f"Execution is not running (status: {row['status']})"}

        await conn.execute("""
            UPDATE playbook_executions SET status = 'cancelled', completed_at = NOW(),
                error_message = $2
            WHERE id = $1::uuid
        """, execution_id, f"Cancelled by user {cancelled_by}")

        # Mark pending steps as skipped
        await conn.execute("""
            UPDATE playbook_execution_steps SET status = 'skipped'
            WHERE execution_id = $1::uuid AND status IN ('pending', 'running')
        """, execution_id)

        # Release incident lock
        if row["incident_id"]:
            await release_incident_lock(conn, str(row["incident_id"]))

        await log_audit_event(
            user_id=cancelled_by, username="Admin",
            action_type="PLAYBOOK_CANCELLED", entity_type="PLAYBOOK",
            entity_id=str(row["playbook_id"]),
            details={"execution_id": execution_id},
        )

    return {"status": "success", "message": "Execution cancelled"}


def _generate_recommendations(category: str, success: bool) -> List[str]:
    """Generate post-execution recommendations."""
    base = []
    if not success:
        base.append("Review failed steps and retry manually if needed")
        base.append("Investigate root cause of step failures")

    recs = {
        "brute_force": [
            "Monitor for additional login attempts from related IPs",
            "Review password policy strength",
            "Consider implementing MFA for affected accounts",
        ],
        "malware": [
            "Scan all connected endpoints for lateral movement",
            "Update threat intelligence feeds with new IOCs",
            "Review endpoint protection policy configuration",
        ],
        "phishing": [
            "Conduct phishing awareness training for affected users",
            "Update email gateway rules with new indicators",
            "Review URL filtering policies",
        ],
        "data_exfiltration": [
            "Conduct full data loss assessment",
            "Review DLP policy configuration",
            "Notify compliance team of potential data breach",
        ],
    }
    base.extend(recs.get(category, ["Continue monitoring for related activity"]))
    return base
