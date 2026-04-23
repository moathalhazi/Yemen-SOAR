from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional, List, Dict, Any
import json
import logging
import uuid
import os
from uuid import UUID

from utils.db import get_db, get_redis, get_http_client
from dependencies import get_current_user, require_permission, TokenData
from models import *

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/v1/system/health", response_model=List[Dict[str, Any]])
async def get_system_health(current_user: TokenData = Depends(require_permission("dashboard.view"))):
    """
    Get comprehensive system health for dashboard
    Checks: Database, Redis, Queue Depth, and critical Services
    """
    health_data = []

    # 1. API Gateway (Self)
    health_data.append({
        "name": "API Gateway",
        "value": 100, # Uptime or similar (mocked for now as 100%)
        "max": 100,
        "unit": "%",
        "status": "healthy",
        "icon": "Activity"
    })

    # 2. Database (PostgreSQL)
    db_status = "healthy"
    db_value = 100
    try:
        start_time = datetime.utcnow()
        async with get_db().acquire() as conn:
            await conn.fetchval("SELECT 1")
        latency = (datetime.utcnow() - start_time).total_seconds() * 1000
        # Determine health based on latency
        if latency > 100: db_status = "warning"
        if latency > 500: db_status = "critical"
    except Exception as e:
        logger.error(f"DB Health check failed: {e}")
        db_status = "critical"
        db_value = 0
    
    health_data.append({
        "name": "Database",
        "value": db_value, 
        "max": 100,
        "unit": "%",
        "status": db_status,
        "icon": "Database"
    })

    # 3. Alert Queue (Redis)
    queue_status = "healthy"
    queue_val = 0
    try:
        # Check connection
        await get_redis().ping()
        # Get queue length
        queue_val = await get_redis().llen("alert_processing_queue")
        
        # Simple threshold logic for status
        if queue_val > 100: queue_status = "warning"
        if queue_val > 1000: queue_status = "critical"
    except Exception as e:
        logger.error(f"Redis/Queue Health check failed: {e}")
        queue_status = "critical"
        
    health_data.append({
        "name": "Alert Queue",
        "value": queue_val,
        "max": 100, # This can be dynamic, but for progress bar 100 is base
        "unit": "pending",
        "status": queue_status,
        "icon": "Server"
    })

    # 4. AI Engine
    ai_status = "healthy"
    ai_val = 100
    try:
        target_url = os.getenv("AI_ML_URL", "http://ai-ml:8003")
        resp = await get_http_client().get(f"{target_url}/health", timeout=2.0)
        if resp.status_code != 200:
            ai_status = "critical"
            ai_val = 0
    except Exception:
        ai_status = "critical"
        ai_val = 0
        
    health_data.append({
        "name": "AI Engine",
        "value": ai_val,
        "max": 100,
        "unit": "%",
        "status": ai_status,
        "icon": "Activity"
    })
    
    # 5. Integration Manager
    im_status = "healthy"
    im_val = 100
    try:
        target_url = os.getenv("INTEGRATION_MANAGER_URL", "http://integration-manager:8013")
        resp = await get_http_client().get(f"{target_url}/health", timeout=2.0)
        if resp.status_code != 200:
            im_status = "critical"
            im_val = 0
    except Exception:
        im_status = "critical"
        im_val = 0
        
    health_data.append({
        "name": "Integration Manager",
        "value": im_val,
        "max": 100,
        "unit": "%",
        "status": im_status,
        "icon": "Server" 
    })

    return health_data

@router.get("/health", response_model=HealthResponse)
async def health_check():
    dependencies = {}
    services_status = {}
    
    # Check PostgreSQL
    try:
        async with get_db().acquire() as conn:
            await conn.fetchval("SELECT 1")
        dependencies["postgres"] = "healthy"
    except:
        dependencies["postgres"] = "unhealthy"
    
    # Check Redis
    try:
        await get_redis().ping()
        dependencies["redis"] = "healthy"
    except:
        dependencies["redis"] = "unhealthy"
    
    overall = "healthy"
    if any(v != "healthy" for v in dependencies.values()):
        overall = "degraded"
    
    return HealthResponse(
        status=overall,
        service="api-gateway",
        timestamp=datetime.utcnow(),
        dependencies=dependencies,
        services=services_status
    )

@router.get("/api/v1/audit-logs")
async def get_audit_logs(
    page: int = 1,
    page_size: int = 20,
    user_id: Optional[str] = None,
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    severity: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: TokenData = Depends(require_permission("audit_logs.read"))
):
    """Get audit logs with filtering"""

    async with get_db().acquire() as conn:
        where_clauses = []
        params = []
        param_idx = 1
        
        if user_id:
            where_clauses.append(f"user_id = ${param_idx}")
            params.append(UUID(user_id))
            param_idx += 1
            
        if action_type:
            where_clauses.append(f"action_type = ${param_idx}")
            params.append(action_type)
            param_idx += 1
            
        if entity_type:
            where_clauses.append(f"entity_type = ${param_idx}")
            params.append(entity_type)
            param_idx += 1
            
        if severity:
            where_clauses.append(f"severity = ${param_idx}")
            params.append(severity)
            param_idx += 1
            
        if date_from:
            where_clauses.append(f"timestamp >= ${param_idx}")
            params.append(datetime.fromisoformat(date_from.replace('Z', '+00:00')))
            param_idx += 1
            
        if date_to:
            where_clauses.append(f"timestamp <= ${param_idx}")
            params.append(datetime.fromisoformat(date_to.replace('Z', '+00:00')))
            param_idx += 1
            
        if search:
            where_clauses.append(f"(action_type ILIKE ${param_idx} OR entity_type ILIKE ${param_idx} OR username ILIKE ${param_idx})")
            params.append(f"%{search}%")
            param_idx += 1
            
        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        # Count
        total = await conn.fetchval(f"SELECT COUNT(*) FROM audit_logs {where_sql}", *params)
        
        # Fetch
        offset = (page - 1) * page_size
        query = f"""
            SELECT * FROM audit_logs
            {where_sql}
            ORDER BY timestamp DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([page_size, offset])
        
        rows = await conn.fetch(query, *params)
        
        items = []
        for row in rows:
            item = dict(row)
            for key, value in item.items():
                if isinstance(value, UUID):
                    item[key] = str(value)
                elif isinstance(value, datetime):
                    item[key] = value.isoformat()
            items.append(item)
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }

@router.get("/api/v1/audit-logs/export")
async def export_audit_logs_csv(
    user_id: Optional[str] = None,
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    severity: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: TokenData = Depends(require_permission("audit_logs.read")),
):
    """Export audit logs as CSV"""

    from fastapi.responses import StreamingResponse
    import csv
    import io

    async with get_db().acquire() as conn:
        where_clauses = []
        params = []
        param_idx = 1

        if user_id:
            where_clauses.append(f"user_id = ${param_idx}")
            params.append(UUID(user_id))
            param_idx += 1
        if action_type:
            where_clauses.append(f"action_type = ${param_idx}")
            params.append(action_type)
            param_idx += 1
        if entity_type:
            where_clauses.append(f"entity_type = ${param_idx}")
            params.append(entity_type)
            param_idx += 1
        if severity:
            where_clauses.append(f"severity = ${param_idx}")
            params.append(severity)
            param_idx += 1
        if date_from:
            where_clauses.append(f"timestamp >= ${param_idx}")
            params.append(datetime.fromisoformat(date_from.replace('Z', '+00:00')))
            param_idx += 1
        if date_to:
            where_clauses.append(f"timestamp <= ${param_idx}")
            params.append(datetime.fromisoformat(date_to.replace('Z', '+00:00')))
            param_idx += 1
        if search:
            where_clauses.append(f"(action_type ILIKE ${param_idx} OR entity_type ILIKE ${param_idx} OR username ILIKE ${param_idx})")
            params.append(f"%{search}%")
            param_idx += 1

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        rows = await conn.fetch(f"SELECT * FROM audit_logs {where_sql} ORDER BY timestamp DESC", *params)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Status", "Severity", "IP Address", "User Agent", "Details"])
    for row in rows:
        writer.writerow([
            row['timestamp'].isoformat() if row['timestamp'] else '',
            row.get('username', ''),
            row.get('action_type', ''),
            row.get('entity_type', ''),
            row.get('entity_id', ''),
            row.get('status', ''),
            row.get('severity', ''),
            str(row['ip_address']) if row.get('ip_address') else '',
            row.get('user_agent', ''),
            json.dumps(dict(row['details'])) if row.get('details') else '',
        ])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"}
    )

@router.get("/api/v1/audit-logs/{id}")
async def get_audit_log(
    id: str,
    current_user: TokenData = Depends(require_permission("audit_logs.read"))
):
    """Get single audit log"""

    async with get_db().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM audit_logs WHERE id = $1", UUID(id))
        if not row:
            raise HTTPException(status_code=404, detail="Audit log not found")
            
        item = dict(row)
        for key, value in item.items():
            if isinstance(value, UUID):
                item[key] = str(value)
            elif isinstance(value, datetime):
                item[key] = value.isoformat()
        return item

SERVICES = {
    "api-core": os.getenv("API_CORE_URL", "http://api-core:8080"),
    "ai-ml": os.getenv("AI_ML_URL", "http://ai-ml:8003"),
    "forensic-service": os.getenv("FORENSIC_SERVICE_URL", "http://forensic-service:8005"),
    "integration-manager": os.getenv("INTEGRATION_MANAGER_URL", "http://integration-manager:8013"),
}

async def proxy_request(service: str, path: str, request: Request):
    """Forward request to downstream service"""
    import httpx
    target_url = SERVICES.get(service)
    if not target_url:
        raise HTTPException(status_code=500, detail="Downstream service not configured")
        
    client = get_http_client()
    url = f"{target_url}{path}"
    # Strip trailing slash to prevent infinite redirect loops with strict-slash backends
    if url.endswith('/') and len(url) > len(target_url) + 1:
        url = url.rstrip('/')
    
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    
    try:
        req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=request.query_params
        )
        response = await client.send(req)
        
        # Exclude tricky headers
        res_headers = dict(response.headers)
        res_headers.pop("content-length", None)
        res_headers.pop("content-encoding", None)
            
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=res_headers,
            media_type=response.headers.get("content-type")
        )
    except Exception as e:
        logger.error(f"Proxy error to {service}: {e}")
        raise HTTPException(status_code=502, detail="Bad Gateway")

@router.get("/api/v1/alerts")
async def proxy_alerts_list(request: Request, current_user: TokenData = Depends(require_permission("alerts.read"))):
    return await proxy_request("api-core", request.url.path, request)

@router.get("/api/v1/alerts/{path:path}")
async def proxy_alerts_get(path: str, request: Request, current_user: TokenData = Depends(require_permission("alerts.read"))):
    return await proxy_request("api-core", request.url.path, request)

@router.patch("/api/v1/alerts/{id}")
async def proxy_alerts_update(id: str, request: Request, current_user: TokenData = Depends(require_permission("alerts.update"))):
    return await proxy_request("api-core", request.url.path, request)

@router.post("/api/v1/alerts/{id}/close")
async def proxy_alerts_close(id: str, request: Request, current_user: TokenData = Depends(require_permission("alerts.close"))):
    return await proxy_request("api-core", request.url.path, request)

@router.post("/api/v1/alerts/{id}/escalate")
async def proxy_alerts_escalate(id: str, request: Request, current_user: TokenData = Depends(require_permission("alerts.escalate"))):
    return await proxy_request("api-core", request.url.path, request)

@router.post("/api/v1/alerts")
async def proxy_alerts_ingest(request: Request):
    # System ingestion wrapper
    return await proxy_request("api-core", request.url.path, request)

@router.api_route("/api/v1/mitre/{path:path}", methods=["GET"])
async def proxy_mitre(path: str, request: Request):
    """Proxy to api-core MITRE mapper module"""
    return await proxy_request("api-core", request.url.path, request)

@router.api_route("/api/v1/risk/{path:path}", methods=["GET"])
async def proxy_risk(path: str, request: Request):
    """Proxy to api-core risk engine module"""
    return await proxy_request("api-core", request.url.path, request)

@router.api_route("/api/v1/integrations/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_integrations(path: str, request: Request):
    """Proxy to integration-manager service"""
    return await proxy_request("integration-manager", request.url.path, request)

@router.api_route("/api/v1/forensic/{path:path}", methods=["GET", "POST"])
async def proxy_forensic(path: str, request: Request):
    """Proxy to forensic-service"""
    return await proxy_request("forensic-service", request.url.path, request)

@router.api_route("/api/v1/ai/{path:path}", methods=["GET", "POST"])
async def proxy_ai(path: str, request: Request):
    """Proxy to AI service (analysis, report generation, MITRE)"""
    return await proxy_request("ai-ml", request.url.path, request)

@router.delete("/api/v1/audit-logs")
async def clear_audit_logs(
    request: Request,
    current_user: TokenData = Depends(require_permission("system.admin"))
):
    """Clear all audit logs except the immutable CLEAR_AUDIT_LOGS events"""
    async with get_db().acquire() as conn:
        # Delete all existing logs EXCEPT those tracking the deletion itself
        await conn.execute("DELETE FROM audit_logs WHERE action_type != 'CLEAR_AUDIT_LOGS'")
        
    client_ip = request.client.host if request.client else None
    agent = request.headers.get("User-Agent")
    
    from utils.db import log_audit_event
    import asyncio
    asyncio.create_task(
        log_audit_event(
            user_id=current_user.user_id,
            username=current_user.username,
            action_type="CLEAR_AUDIT_LOGS",
            entity_type="SYSTEM",
            ip_address=client_ip,
            status="SUCCESS",
            severity="CRITICAL",
            details={"message": "Administrator permanently cleared all test/historical audit logs."},
            user_agent=agent
        )
    )
    
    return {"message": "Audit logs cleared successfully."}


# ════════════════════════════════════════════════
# System Configuration
# ════════════════════════════════════════════════

@router.get("/api/v1/system/config")
async def get_system_config(
    current_user: TokenData = Depends(require_permission("system.manage"))
):
    """Read all system configuration key-value pairs."""
    async with get_db().acquire() as conn:
        rows = await conn.fetch("""
            SELECT key, value, description, is_encrypted, updated_at
            FROM configurations ORDER BY key
        """)
    configs = {}
    for r in rows:
        val = r["value"]
        if r["is_encrypted"]:
            val = "********"  # Never expose encrypted values
        configs[r["key"]] = {
            "value": val,
            "description": r["description"],
            "is_encrypted": r["is_encrypted"],
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
    return {"configs": configs}


@router.put("/api/v1/system/config")
async def update_system_config(
    request: Request,
    current_user: TokenData = Depends(require_permission("system.manage"))
):
    """Update system configuration. Body is a flat JSON object of key: value pairs."""
    body = await request.json()
    if not body or not isinstance(body, dict):
        raise HTTPException(400, "Expected a JSON object of key-value pairs")

    updated = []
    async with get_db().acquire() as conn:
        for key, value in body.items():
            await conn.execute("""
                INSERT INTO configurations (key, value, updated_by)
                VALUES ($1, $2::jsonb, $3::uuid)
                ON CONFLICT (key) DO UPDATE
                SET value = $2::jsonb, updated_by = $3::uuid, updated_at = NOW()
            """, key, json.dumps(value), current_user.user_id)
            updated.append(key)

    # Audit log
    from utils.db import log_audit_event
    import asyncio
    asyncio.create_task(log_audit_event(
        user_id=current_user.user_id,
        username=current_user.username,
        action_type="SYSTEM_CONFIG_UPDATE",
        entity_type="CONFIGURATION",
        status="SUCCESS",
        severity="WARNING",
        details={"updated_keys": updated},
    ))

    return {"message": f"Updated {len(updated)} configuration(s)", "keys": updated}


@router.post("/api/v1/system/test-smtp")
async def test_smtp_connection(
    current_user: TokenData = Depends(require_permission("system.manage"))
):
    """Test SMTP connection using stored configuration."""
    async with get_db().acquire() as conn:
        smtp_host_row = await conn.fetchrow(
            "SELECT value FROM configurations WHERE key = 'smtp_host'"
        )
        smtp_port_row = await conn.fetchrow(
            "SELECT value FROM configurations WHERE key = 'smtp_port'"
        )

    if not smtp_host_row:
        return {"status": "error", "message": "SMTP host not configured. Set 'smtp_host' in system config."}

    import socket
    host = smtp_host_row["value"] if isinstance(smtp_host_row["value"], str) else str(smtp_host_row["value"]).strip('"')
    port = 587
    if smtp_port_row:
        try:
            port = int(str(smtp_port_row["value"]).strip('"'))
        except (ValueError, TypeError):
            port = 587

    try:
        sock = socket.create_connection((host, port), timeout=5)
        sock.close()
        return {"status": "ok", "message": f"Successfully connected to {host}:{port}"}
    except socket.timeout:
        return {"status": "error", "message": f"Connection to {host}:{port} timed out"}
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}


@router.post("/api/v1/system/backup")
async def trigger_backup(
    current_user: TokenData = Depends(require_permission("system.admin"))
):
    """Trigger a PostgreSQL database backup."""
    import subprocess
    from datetime import datetime as dt_mod, timezone as tz_mod

    db_host = os.getenv("POSTGRES_HOST", "postgres")
    db_name = os.getenv("POSTGRES_DB", "soar_db")
    db_user = os.getenv("POSTGRES_USER", "soar_user")
    timestamp = dt_mod.now(tz_mod.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = f"/tmp/soar_backup_{timestamp}.sql"

    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = os.getenv("POSTGRES_PASSWORD", "")
        result = subprocess.run(
            ["pg_dump", "-h", db_host, "-U", db_user, "-d", db_name, "-f", backup_file],
            env=env, capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return {"status": "error", "message": f"Backup failed: {result.stderr[:500]}"}

        file_size = os.path.getsize(backup_file) if os.path.exists(backup_file) else 0

        from utils.db import log_audit_event
        import asyncio
        asyncio.create_task(log_audit_event(
            user_id=current_user.user_id,
            username=current_user.username,
            action_type="DATABASE_BACKUP",
            entity_type="SYSTEM",
            status="SUCCESS",
            severity="INFO",
            details={"backup_file": backup_file, "size_bytes": file_size},
        ))

        return {
            "status": "ok",
            "message": "Database backup completed successfully",
            "backup_file": backup_file,
            "size_bytes": file_size,
        }
    except FileNotFoundError:
        return {"status": "error", "message": "pg_dump not found. Ensure PostgreSQL client tools are installed."}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Backup timed out after 120 seconds"}