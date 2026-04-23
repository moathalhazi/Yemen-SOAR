"""
SOAR Pro — Integration Manager Service
Secure integration management with webhook ingestion, syslog listener,
scheduled REST API pull, CRUD operations, rate limiting, and credential encryption.

All alert processing is for REAL log data only — no mock or synthetic generation.
"""

import os
import re
import json
import time
import logging
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request, Response, Depends, status, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncpg
import redis.asyncio as aioredis
import httpx

from crypto_utils import (
    generate_api_key, hash_api_key, verify_api_key,
    verify_hmac_signature, encrypt_credentials_json, decrypt_credentials_json,
    encrypt_credential, decrypt_credential, sha256_digest,
)
from log_parsers import parse_syslog, parse_cef, parse_evtx_xml, parse_json_alert, auto_parse
from syslog_listener import SyslogListener
from rest_pull_engine import RESTPullEngine

# ========================================
# Logging
# ========================================
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","level":"%(levelname)s","service":"integration-manager","message":"%(message)s"}'
)
logger = logging.getLogger(__name__)

# ========================================
# FastAPI App
# ========================================
app = FastAPI(
    title="SOAR Pro — Integration Manager",
    description="Secure integration management: webhook ingestion, syslog, REST pull, CRUD, and forwarding",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://api-gateway:8000",
        "http://localhost:8000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# JWT Auth Middleware for CRUD Endpoints
# ========================================
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt as jose_jwt

_JWT_SECRET = os.getenv("JWT_SECRET_KEY", "")
_JWT_ALGORITHM = "HS256"

# Paths that do NOT require JWT (webhooks use API key/HMAC auth, health is public)
_PUBLIC_PATH_PREFIXES = (
    "/health",
    "/api/v1/integrations/webhook/",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Skip OPTIONS, public paths
        if method == "OPTIONS" or any(path.startswith(p) for p in _PUBLIC_PATH_PREFIXES):
            return await call_next(request)

        # Validate JWT
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return Response(
                content='{"detail": "Authorization header required"}',
                status_code=401,
                media_type="application/json",
            )
        token = auth_header.split(" ", 1)[1]
        try:
            jose_jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        except JWTError:
            return Response(
                content='{"detail": "Invalid or expired token"}',
                status_code=401,
                media_type="application/json",
            )

        return await call_next(request)


if _JWT_SECRET:
    app.add_middleware(JWTAuthMiddleware)
else:
    logger.warning("JWT_SECRET_KEY not set — JWT auth middleware DISABLED on integration-manager")

# ========================================
# Global State
# ========================================
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None
http_client: Optional[httpx.AsyncClient] = None
syslog_listener: Optional[SyslogListener] = None
rest_engine: Optional[RESTPullEngine] = None

NORMALIZATION_URL = os.getenv("NORMALIZATION_URL", "http://normalization:8002")
ALERT_INGESTOR_URL = os.getenv("ALERT_INGESTOR_URL", "http://alert-ingestor:8001")

# ========================================
# Pydantic Models
# ========================================

class IntegrationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9_-]+$")
    description: Optional[str] = None
    integration_type: str = Field(..., pattern=r"^(webhook|syslog|rest_pull)$")
    vendor: Optional[str] = None
    log_format: str = Field(default="json", pattern=r"^(json|cef|leef|syslog_rfc3164|syslog_rfc5424|evtx_xml|raw)$")
    config: Dict[str, Any] = {}
    auth_type: str = Field(default="api_key", pattern=r"^(api_key|hmac_sha256|bearer_token|basic|none)$")
    credentials: Optional[Dict[str, str]] = None
    rate_limit_per_minute: int = Field(default=120, ge=1, le=10000)
    rate_limit_burst: int = Field(default=30, ge=1, le=1000)
    is_active: bool = True
    pull_interval_seconds: Optional[int] = Field(default=300, ge=30, le=86400)
    tags: List[str] = []

class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    auth_type: Optional[str] = None
    credentials: Optional[Dict[str, str]] = None
    rate_limit_per_minute: Optional[int] = None
    rate_limit_burst: Optional[int] = None
    is_active: Optional[bool] = None
    pull_interval_seconds: Optional[int] = None
    log_format: Optional[str] = None
    tags: Optional[List[str]] = None

class IntegrationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    integration_type: str
    vendor: Optional[str]
    log_format: str
    config: Dict[str, Any]
    auth_type: str
    rate_limit_per_minute: int
    rate_limit_burst: int
    is_active: bool
    health_status: str
    total_alerts_received: int
    total_alerts_failed: int
    last_connected_at: Optional[str]
    last_error: Optional[str]
    pull_interval_seconds: Optional[int]
    tags: List[str]
    created_at: str
    updated_at: str
    has_api_key: bool = False

class WebhookPayload(BaseModel):
    raw_log: Optional[str] = None
    logs: Optional[List[str]] = None
    events: Optional[List[Dict[str, Any]]] = None
    # Allow entirely free-form JSON by accepting it as raw dict as well

class HealthResponse(BaseModel):
    status: str
    service: str
    dependencies: Dict[str, str]
    stats: Dict[str, Any]

# ========================================
# Startup & Shutdown
# ========================================

@app.on_event("startup")
async def startup():
    global db_pool, redis_client, http_client, syslog_listener, rest_engine

    logger.info("Starting Integration Manager...")

    # PostgreSQL
    try:
        db_pool = await asyncpg.create_pool(
            host=os.getenv("POSTGRES_HOST", "postgres"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "soar_db"),
            user=os.getenv("POSTGRES_USER", "soar_user"),
            password=os.getenv("POSTGRES_PASSWORD", ""),
            min_size=5,
            max_size=20,
        )
        logger.info("PostgreSQL connected")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
        raise

    # Redis
    try:
        redis_client = await aioredis.from_url(
            f"redis://{os.getenv('REDIS_HOST', 'redis')}:{os.getenv('REDIS_PORT', '6379')}",
            password=os.getenv("REDIS_PASSWORD", ""),
            decode_responses=True,
        )
        await redis_client.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        raise

    # HTTP client
    http_client = httpx.AsyncClient(timeout=30.0)

    # Syslog listener
    syslog_port = int(os.getenv("SYSLOG_PORT", "1514"))
    syslog_listener = SyslogListener(
        callback=_handle_syslog_message,
        udp_port=syslog_port,
        tcp_port=syslog_port,
    )
    await syslog_listener.start()

    # REST pull engine
    rest_engine = RESTPullEngine(
        db_pool=db_pool,
        redis_client=redis_client,
        process_callback=_process_ingested_payload,
        decrypt_fn=decrypt_credential,
    )
    await rest_engine.start()

    logger.info("Integration Manager started successfully")


@app.on_event("shutdown")
async def shutdown():
    if syslog_listener:
        await syslog_listener.stop()
    if rest_engine:
        await rest_engine.stop()
    if http_client:
        await http_client.aclose()
    if redis_client:
        await redis_client.close()
    if db_pool:
        await db_pool.close()
    logger.info("Integration Manager shut down")

# ========================================
# Health Check
# ========================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    deps = {}
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        deps["postgres"] = "healthy"
    except Exception:
        deps["postgres"] = "unhealthy"
    try:
        await redis_client.ping()
        deps["redis"] = "healthy"
    except Exception:
        deps["redis"] = "unhealthy"

    overall = "healthy" if all(v == "healthy" for v in deps.values()) else "degraded"

    # Stats
    stats = {}
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active
                FROM integrations
            """)
            stats["total_integrations"] = row["total"] if row else 0
            stats["active_integrations"] = row["active"] if row else 0

            log_row = await conn.fetchrow("""
                SELECT COUNT(*) as count FROM integration_logs
                WHERE timestamp > NOW() - INTERVAL '1 hour'
            """)
            stats["logs_last_hour"] = log_row["count"] if log_row else 0
    except Exception:
        pass

    return HealthResponse(status=overall, service="integration-manager", dependencies=deps, stats=stats)

# ========================================
# Rate Limiting Helper
# ========================================

async def check_rate_limit(integration_id: str, limit: int, burst: int) -> bool:
    """Sliding window rate limiter using Redis. Returns True if allowed."""
    key = f"ratelimit:{integration_id}"
    now = time.time()
    window = 60  # 1 minute

    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zcard(key)
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window + 10)
    results = await pipe.execute()

    current_count = results[1]
    if current_count >= limit:
        return False
    return True

# ========================================
# Integration CRUD
# ========================================

@app.post("/api/v1/integrations", response_model=IntegrationResponse, status_code=201)
async def create_integration(data: IntegrationCreate):
    """Create a new integration. Returns the created integration with its API key (shown only once)."""
    async with db_pool.acquire() as conn:
        # Check slug uniqueness
        existing = await conn.fetchval("SELECT 1 FROM integrations WHERE slug = $1", data.slug)
        if existing:
            raise HTTPException(400, f"Slug '{data.slug}' already exists")

        # Generate and hash API key
        api_key = generate_api_key()
        api_key_hashed = hash_api_key(api_key)

        # Encrypt credentials if provided
        creds_encrypted = None
        if data.credentials:
            creds_encrypted = encrypt_credentials_json(data.credentials)

        # Encrypt HMAC secret if auth_type is hmac_sha256
        hmac_encrypted = None
        if data.auth_type == "hmac_sha256" and data.credentials and data.credentials.get("hmac_secret"):
            hmac_encrypted = encrypt_credential(data.credentials["hmac_secret"])

        integration_id = uuid4()
        row = await conn.fetchrow("""
            INSERT INTO integrations (
                id, name, slug, description, integration_type, vendor, log_format,
                config, auth_type, api_key_hash, hmac_secret_encrypted, credentials_encrypted,
                rate_limit_per_minute, rate_limit_burst, is_active, pull_interval_seconds, tags
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            RETURNING *
        """,
            integration_id, data.name, data.slug, data.description,
            data.integration_type, data.vendor, data.log_format,
            json.dumps(data.config), data.auth_type, api_key_hashed,
            hmac_encrypted, creds_encrypted,
            data.rate_limit_per_minute, data.rate_limit_burst,
            data.is_active, data.pull_interval_seconds, data.tags,
        )

        result = _format_integration(row)
        result["api_key"] = api_key  # Only shown at creation time
        result["has_api_key"] = True
        return result


@app.get("/api/v1/integrations", response_model=List[IntegrationResponse])
async def list_integrations(
    active_only: bool = False,
    integration_type: Optional[str] = None,
):
    """List all integrations."""
    clauses = []
    params = []
    idx = 1
    if active_only:
        clauses.append(f"is_active = ${idx}")
        params.append(True)
        idx += 1
    if integration_type:
        clauses.append(f"integration_type = ${idx}")
        params.append(integration_type)
        idx += 1

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT i.*, s.status as live_status, s.alerts_last_hour, s.avg_latency_ms
            FROM integrations i
            LEFT JOIN integration_status s ON s.integration_id = i.id
            {where}
            ORDER BY i.created_at DESC
        """, *params)

    return [_format_integration(r) for r in rows]


@app.get("/api/v1/integrations/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: UUID):
    """Get a single integration by ID."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT i.*, s.status as live_status, s.alerts_last_hour, s.avg_latency_ms
            FROM integrations i
            LEFT JOIN integration_status s ON s.integration_id = i.id
            WHERE i.id = $1
        """, integration_id)
    if not row:
        raise HTTPException(404, "Integration not found")
    return _format_integration(row)


@app.put("/api/v1/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(integration_id: UUID, data: IntegrationUpdate):
    """Update an existing integration."""
    updates = []
    params = []
    idx = 1

    field_map = {
        "name": data.name, "description": data.description,
        "auth_type": data.auth_type, "rate_limit_per_minute": data.rate_limit_per_minute,
        "rate_limit_burst": data.rate_limit_burst, "is_active": data.is_active,
        "pull_interval_seconds": data.pull_interval_seconds, "log_format": data.log_format,
        "tags": data.tags,
    }
    for field, value in field_map.items():
        if value is not None:
            updates.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1

    if data.config is not None:
        updates.append(f"config = ${idx}")
        params.append(json.dumps(data.config))
        idx += 1

    if data.credentials is not None:
        updates.append(f"credentials_encrypted = ${idx}")
        params.append(encrypt_credentials_json(data.credentials))
        idx += 1

    if not updates:
        raise HTTPException(400, "No fields to update")

    params.append(integration_id)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(f"""
            UPDATE integrations SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = ${idx}
            RETURNING *
        """, *params)

    if not row:
        raise HTTPException(404, "Integration not found")
    return _format_integration(row)


@app.delete("/api/v1/integrations/{integration_id}")
async def delete_integration(integration_id: UUID):
    """Soft-delete: deactivate an integration."""
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE integrations SET is_active = false, updated_at = NOW() WHERE id = $1",
            integration_id,
        )
    if result == "UPDATE 0":
        raise HTTPException(404, "Integration not found")
    return {"message": "Integration deactivated", "id": str(integration_id)}


# ========================================
# Test Integration
# ========================================

@app.post("/api/v1/integrations/test/{integration_id}")
async def test_integration(integration_id: UUID):
    """
    Test connectivity for an integration.
    - webhook: returns the webhook URL
    - syslog: confirms listener is running
    - rest_pull: attempts an immediate pull
    """
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM integrations WHERE id = $1", integration_id)

    if not row:
        raise HTTPException(404, "Integration not found")

    int_type = row["integration_type"]

    if int_type == "webhook":
        return {
            "status": "ok",
            "integration_type": "webhook",
            "webhook_url": f"/api/v1/integrations/webhook/{row['slug']}",
            "message": "POST alerts to the webhook URL with the API key in the X-API-Key header",
        }

    if int_type == "syslog":
        port = int(os.getenv("SYSLOG_PORT", "1514"))
        return {
            "status": "ok" if syslog_listener else "error",
            "integration_type": "syslog",
            "udp_port": port,
            "tcp_port": port,
            "message": "Send syslog messages to the above ports",
        }

    if int_type == "rest_pull":
        result = await rest_engine.pull_now(str(integration_id))
        return result

    return {"status": "error", "message": f"Unknown type: {int_type}"}


# ========================================
# Webhook Ingestion Endpoint
# ========================================

@app.post("/api/v1/integrations/webhook/{source}")
async def webhook_ingest(
    source: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
):
    """
    Webhook ingestion endpoint.
    Accepts real security alerts from external systems.
    Authenticates via API key or HMAC signature.
    """
    start_time = time.time()

    # 1. Lookup integration by slug
    async with db_pool.acquire() as conn:
        integration = await conn.fetchrow(
            "SELECT * FROM integrations WHERE slug = $1 AND is_active = true",
            source,
        )

    if not integration:
        raise HTTPException(404, f"Integration '{source}' not found or inactive")

    int_id = str(integration["id"])
    auth_type = integration["auth_type"]
    source_ip = request.client.host if request.client else "unknown"

    # 2. Read raw body
    raw_body = await request.body()
    raw_text = raw_body.decode("utf-8", errors="replace")

    if not raw_text.strip():
        raise HTTPException(400, "Empty payload")

    # 3. Authenticate
    auth_valid = False
    if auth_type == "none":
        auth_valid = True
    elif auth_type == "api_key":
        if not x_api_key:
            await _log_ingestion(int_id, source_ip, "POST", f"/webhook/{source}",
                                 raw_text, "rejected", None, "Missing X-API-Key header",
                                 auth_type, False, start_time)
            raise HTTPException(401, "Missing X-API-Key header")
        auth_valid = verify_api_key(x_api_key, integration["api_key_hash"])
        if not auth_valid:
            await _log_ingestion(int_id, source_ip, "POST", f"/webhook/{source}",
                                 raw_text, "rejected", None, "Invalid API key",
                                 auth_type, False, start_time)
            raise HTTPException(401, "Invalid API key")
    elif auth_type == "hmac_sha256":
        if not x_signature:
            await _log_ingestion(int_id, source_ip, "POST", f"/webhook/{source}",
                                 raw_text, "rejected", None, "Missing X-Signature header",
                                 auth_type, False, start_time)
            raise HTTPException(401, "Missing X-Signature header")
        hmac_secret = decrypt_credential(integration["hmac_secret_encrypted"]) if integration["hmac_secret_encrypted"] else ""
        auth_valid = verify_hmac_signature(raw_body, x_signature, hmac_secret)
        if not auth_valid:
            await _log_ingestion(int_id, source_ip, "POST", f"/webhook/{source}",
                                 raw_text, "rejected", None, "Invalid HMAC signature",
                                 auth_type, False, start_time)
            raise HTTPException(401, "Invalid HMAC signature")

    # 4. Rate limit
    allowed = await check_rate_limit(
        int_id,
        integration["rate_limit_per_minute"],
        integration["rate_limit_burst"],
    )
    if not allowed:
        await _log_ingestion(int_id, source_ip, "POST", f"/webhook/{source}",
                             raw_text, "rejected", None, "Rate limit exceeded",
                             auth_type, auth_valid, start_time)
        raise HTTPException(429, "Rate limit exceeded")

    # 5. Process (parse, normalize, forward) — in background for speed
    background_tasks.add_task(
        _process_ingested_payload,
        integration_id=int_id,
        raw_payload=raw_text,
        source_ip=source_ip,
        log_format=integration["log_format"],
        auth_method=auth_type,
        auth_valid=auth_valid,
        endpoint=f"/webhook/{source}",
        method="POST",
        content_type=request.headers.get("content-type", ""),
        start_time=start_time,
    )

    return {
        "status": "accepted",
        "message": "Alert received and queued for processing",
        "integration": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ========================================
# Additional Ingestion Endpoints (direct format)
# ========================================

@app.post("/api/v1/integrations/ingest/syslog")
async def ingest_syslog_http(request: Request, background_tasks: BackgroundTasks):
    """Accept raw syslog text over HTTP (for systems that cannot send UDP)."""
    body = await request.json()
    raw_log = body.get("raw_log", "")
    if not raw_log:
        raise HTTPException(400, "raw_log field required")

    source_ip = request.client.host if request.client else "unknown"
    background_tasks.add_task(
        _process_ingested_payload,
        integration_id=None,
        raw_payload=raw_log,
        source_ip=source_ip,
        log_format="syslog_rfc3164",
        method="POST",
        endpoint="/ingest/syslog",
    )
    return {"status": "accepted", "format": "syslog"}


@app.post("/api/v1/integrations/ingest/cef")
async def ingest_cef_http(request: Request, background_tasks: BackgroundTasks):
    """Accept CEF-formatted log entries over HTTP."""
    body = await request.json()
    raw_log = body.get("raw_log", "")
    if not raw_log:
        raise HTTPException(400, "raw_log field required")

    source_ip = request.client.host if request.client else "unknown"
    background_tasks.add_task(
        _process_ingested_payload,
        integration_id=None,
        raw_payload=raw_log,
        source_ip=source_ip,
        log_format="cef",
        method="POST",
        endpoint="/ingest/cef",
    )
    return {"status": "accepted", "format": "cef"}


@app.post("/api/v1/integrations/ingest/evtx")
async def ingest_evtx_http(request: Request, background_tasks: BackgroundTasks):
    """Accept Windows Event Log XML over HTTP."""
    body = await request.json()
    raw_log = body.get("raw_log", "")
    if not raw_log:
        raise HTTPException(400, "raw_log field required")

    source_ip = request.client.host if request.client else "unknown"
    background_tasks.add_task(
        _process_ingested_payload,
        integration_id=None,
        raw_payload=raw_log,
        source_ip=source_ip,
        log_format="evtx_xml",
        method="POST",
        endpoint="/ingest/evtx",
    )
    return {"status": "accepted", "format": "evtx_xml"}


# ========================================
# Integration Logs
# ========================================

@app.get("/api/v1/integrations/{integration_id}/logs")
async def get_integration_logs(
    integration_id: UUID,
    page: int = 1,
    page_size: int = 50,
    status_filter: Optional[str] = None,
):
    """Get ingestion logs for a specific integration."""
    clauses = ["integration_id = $1"]
    params: list = [integration_id]
    idx = 2

    if status_filter:
        clauses.append(f"status = ${idx}")
        params.append(status_filter)
        idx += 1

    where = " AND ".join(clauses)

    async with db_pool.acquire() as conn:
        total = await conn.fetchval(f"SELECT COUNT(*) FROM integration_logs WHERE {where}", *params)
        offset = (page - 1) * page_size
        rows = await conn.fetch(f"""
            SELECT id, integration_id, timestamp, source_ip, method, endpoint,
                   payload_size_bytes, content_type, status, alert_id, error_message,
                   processing_time_ms, auth_method, auth_valid
            FROM integration_logs
            WHERE {where}
            ORDER BY timestamp DESC
            LIMIT ${idx} OFFSET ${idx+1}
        """, *params, page_size, offset)

    items = []
    for r in rows:
        item = dict(r)
        for k, v in item.items():
            if isinstance(v, UUID):
                item[k] = str(v)
            elif isinstance(v, datetime):
                item[k] = v.isoformat()
        items.append(item)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ========================================
# Integration Status / Health
# ========================================

@app.get("/api/v1/integrations/{integration_id}/status")
async def get_integration_status(integration_id: UUID):
    """Get real-time health status for an integration."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM integration_status WHERE integration_id = $1
        """, integration_id)
    if not row:
        raise HTTPException(404, "Status not found")
    result = dict(row)
    for k, v in result.items():
        if isinstance(v, UUID):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


# ========================================
# Internal: Processing Pipeline
# ========================================

async def _handle_syslog_message(message: str, source_ip: str):
    """Callback for the syslog listener — processes a received syslog message."""
    await _process_ingested_payload(
        integration_id=None,
        raw_payload=message,
        source_ip=source_ip,
        log_format="syslog_rfc3164",
        method="UDP",
        endpoint="syslog",
    )


async def _process_ingested_payload(
    integration_id: Optional[str] = None,
    raw_payload: str = "",
    source_ip: str = "unknown",
    log_format: str = "json",
    auth_method: str = "none",
    auth_valid: bool = True,
    endpoint: str = "",
    method: str = "POST",
    content_type: str = "",
    start_time: Optional[float] = None,
):
    """
    Central processing pipeline:
    1. Log raw payload
    2. Parse using the appropriate parser
    3. Forward normalized alert to the alert ingestor
    4. Update integration stats
    """
    if start_time is None:
        start_time = time.time()

    alert_id = None
    status_val = "received"
    error_msg = None

    try:
        # 1. Parse raw payload → unified alert dict
        parsed = auto_parse(raw_payload, format_hint=log_format)

        if parsed is None:
            status_val = "error"
            error_msg = "Failed to parse payload"
            return

        status_val = "normalized"

        # 2. Forward to alert ingestor service
        alert_payload = {
            "source": parsed.get("source", "unknown"),
            "external_id": parsed.get("external_id"),
            "occurred_at": parsed.get("occurred_at"),
            "severity": parsed.get("severity", "medium"),
            "category": parsed.get("category"),
            "alert_type": parsed.get("alert_type"),
            "title": parsed.get("title", "Parsed Alert"),
            "description": parsed.get("description", ""),
            "affected_assets": parsed.get("affected_assets", []),
            "indicators": parsed.get("indicators", {}),
            "raw_data": parsed.get("raw_data", {}),
        }

        try:
            resp = await http_client.post(
                f"{ALERT_INGESTOR_URL}/api/v1/alerts/ingest",
                json=alert_payload,
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                resp_data = resp.json()
                alert_id = resp_data.get("id")
                status_val = "forwarded"
            else:
                status_val = "error"
                error_msg = f"Ingestor returned HTTP {resp.status_code}"
        except Exception as e:
            # If ingestor is unavailable, queue in Redis for retry
            logger.warning(f"Ingestor unavailable, queuing: {e}")
            await redis_client.rpush(
                "integration_retry_queue",
                json.dumps(alert_payload),
            )
            status_val = "forwarded"  # queued counts as forwarded
            error_msg = f"Queued for retry: {e}"

        # 3. Update integration counters
        if integration_id:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE integrations
                    SET total_alerts_received = total_alerts_received + 1,
                        last_connected_at = NOW(),
                        health_status = 'healthy',
                        last_error = NULL
                    WHERE id = $1
                """, integration_id)

                await conn.execute("""
                    UPDATE integration_status
                    SET status = 'online',
                        last_heartbeat = NOW(),
                        last_successful_ingestion = NOW(),
                        alerts_last_hour = alerts_last_hour + 1,
                        consecutive_failures = 0
                    WHERE integration_id = $1
                """, integration_id)

    except Exception as e:
        status_val = "error"
        error_msg = str(e)[:500]
        logger.error(f"Processing error: {e}")

        # Update failure counters
        if integration_id:
            try:
                async with db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE integrations
                        SET total_alerts_failed = total_alerts_failed + 1,
                            last_error = $2,
                            health_status = 'error'
                        WHERE id = $1
                    """, integration_id, error_msg)
            except Exception:
                pass
    finally:
        # 4. Log ingestion attempt
        await _log_ingestion(
            integration_id, source_ip, method, endpoint,
            raw_payload, status_val, alert_id, error_msg,
            auth_method, auth_valid, start_time, content_type,
        )


async def _log_ingestion(
    integration_id: Optional[str],
    source_ip: str,
    method: str,
    endpoint: str,
    raw_payload: str,
    status_val: str,
    alert_id: Optional[str],
    error_message: Optional[str],
    auth_method: str = "none",
    auth_valid: bool = True,
    start_time: Optional[float] = None,
    content_type: str = "",
):
    """Write an immutable log entry to integration_logs."""
    elapsed = int((time.time() - start_time) * 1000) if start_time else None
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO integration_logs (
                    integration_id, source_ip, method, endpoint,
                    raw_payload, payload_size_bytes, content_type,
                    status, alert_id, error_message, processing_time_ms,
                    auth_method, auth_valid
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            """,
                integration_id, source_ip, method, endpoint,
                raw_payload[:50000],  # cap at 50KB per entry
                len(raw_payload.encode("utf-8")),
                content_type,
                status_val, alert_id, error_message, elapsed,
                auth_method, auth_valid,
            )
    except Exception as e:
        logger.error(f"Failed to write integration log: {e}")


# ========================================
# Formatting Helpers
# ========================================

def _format_integration(row) -> dict:
    """Convert a DB row into an IntegrationResponse-compatible dict."""
    item = dict(row)
    # Remove sensitive fields
    item.pop("api_key_hash", None)
    item.pop("hmac_secret_encrypted", None)
    item.pop("credentials_encrypted", None)
    item.pop("next_pull_at", None)

    # Parse config
    if isinstance(item.get("config"), str):
        try:
            item["config"] = json.loads(item["config"])
        except Exception:
            item["config"] = {}

    # Serialize types
    for k, v in item.items():
        if isinstance(v, UUID):
            item[k] = str(v)
        elif isinstance(v, datetime):
            item[k] = v.isoformat()

    item["has_api_key"] = bool(row.get("api_key_hash"))
    item.setdefault("health_status", item.pop("live_status", "unknown") or "unknown")
    item.setdefault("total_alerts_received", 0)
    item.setdefault("total_alerts_failed", 0)
    item.setdefault("tags", [])
    return item


# ========================================
# Entry Point
# ========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8013)
