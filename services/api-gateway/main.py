from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt
import os
import logging
import asyncio
import asyncpg
import redis.asyncio as aioredis
import httpx

from fastapi.staticfiles import StaticFiles
import utils.db as db
from utils.db import log_audit_event
from routers import (
    auth, users, dashboard, reports, system, incidents,
    playbooks, analytics, evidence, chat,
    compliance, notifications, threat_intel, mfa,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

app = FastAPI(title="SOAR Pro API Gateway", version="1.0.0")

CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        method = request.method

        # Skip noise: OPTIONS, health checks, dashboard polling
        if method == "OPTIONS" or path.startswith("/health") or path.startswith("/api/v1/dashboard/stats"):
            return response

        status_code = response.status_code
        user_id = None
        username = "System"
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                username = payload.get("username", "Unknown")
                user_id = payload.get("sub")
            except Exception:
                pass

        client_ip = request.client.host if request.client else None
        agent = request.headers.get("User-Agent")

        # --- Decide whether to log this request ---
        is_error = status_code >= 400
        is_mutation = method in ("POST", "PUT", "DELETE", "PATCH")
        # Skip login — already logged in auth.py to avoid double-logging
        is_login_path = path == "/api/v1/auth/login"

        if (is_error or is_mutation) and not is_login_path:
            action_type = method
            if status_code in (401, 403):
                action_type = "UNAUTHORIZED_ACCESS"
            elif status_code >= 500:
                action_type = "SYSTEM_ERROR"

            severity = "CRITICAL" if status_code >= 500 else "WARNING" if status_code >= 400 else "INFO"
            status_text = "FAILED" if status_code >= 400 else "SUCCESS"

            parts = path.strip('/').split('/')
            entity_type = parts[2].upper() if len(parts) > 2 else "SYSTEM"

            asyncio.create_task(
                log_audit_event(
                    user_id, username, action_type, entity_type, path,
                    client_ip, status_text, severity,
                    {"method": method, "status_code": status_code, "url": str(request.url)},
                    user_agent=agent,
                )
            )

        # --- Threat detection (brute-force / RBAC escalation) ---
        if db.redis_client:
            if path == "/api/v1/auth/login" and status_code == 401:
                key = f"brute_force:{client_ip}"
                attempts = await db.redis_client.incr(key)
                if attempts == 1:
                    await db.redis_client.expire(key, 300)
                if attempts == 5:
                    asyncio.create_task(log_audit_event(
                        None, "System", "THREAT_DETECTED", "SYSTEM",
                        ip_address=client_ip, status="SUCCESS", severity="CRITICAL",
                        details={"threat": "Brute-force login attack"},
                        user_agent=agent,
                    ))

            if path.startswith(("/api/v1/roles", "/api/v1/permissions", "/api/v1/users")) and status_code == 403:
                asyncio.create_task(log_audit_event(
                    user_id, username, "THREAT_DETECTED", "SYSTEM",
                    ip_address=client_ip, status="SUCCESS", severity="CRITICAL",
                    details={"threat": "Unauthorized RBAC escalation attempt"},
                    user_agent=agent,
                ))

        return response

app.add_middleware(AuditLoggingMiddleware)

# Serve static uploads
os.makedirs("/app/uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

@app.on_event("startup")
async def startup_event():
    logger.info("Starting API Gateway...")
    pg_host = os.getenv("POSTGRES_HOST", "localhost")
    pg_db = os.getenv("POSTGRES_DB", "soar_db")
    pg_user = os.getenv("POSTGRES_USER", "soar_user")
    
    db.db_pool = await asyncpg.create_pool(
        host=pg_host,
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=pg_db,
        user=pg_user,
        password=os.getenv("POSTGRES_PASSWORD", ""),
        connection_class=db.LoggingConnection,
        min_size=5,
        max_size=20
    )
    
    db.redis_client = await aioredis.from_url(
        f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}",
        password=os.getenv("REDIS_PASSWORD", ""),
        decode_responses=True
    )
    await db.redis_client.ping()
    db.http_client = httpx.AsyncClient(timeout=30.0)
    logger.info("API Gateway started successfully")
    
    from utils.scheduler import run_scheduler
    import asyncio
    app.state.scheduler_task = asyncio.create_task(run_scheduler())

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'scheduler_task'):
        app.state.scheduler_task.cancel()
    if db.db_pool: await db.db_pool.close()
    if db.redis_client: await db.redis_client.close()
    if db.http_client: await db.http_client.aclose()

app.include_router(auth.router, tags=["Auth"])
app.include_router(users.router, tags=["Users"])
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(reports.router, tags=["Reports"])
app.include_router(system.router, tags=["System"])
app.include_router(incidents.router, tags=["Incidents"])
app.include_router(playbooks.router, tags=["Playbooks"])
app.include_router(analytics.router, tags=["Analytics"])
app.include_router(evidence.router, tags=["Evidence"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(compliance.router, tags=["Compliance"])
app.include_router(notifications.router, tags=["Notifications"])
app.include_router(threat_intel.router, tags=["Threat Intelligence"])
app.include_router(mfa.router, tags=["MFA"])
