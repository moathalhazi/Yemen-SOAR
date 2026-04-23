import os
import logging
import hashlib
import json
from typing import Optional, Dict, Any
import asyncpg
import redis.asyncio as aioredis
import httpx

logger = logging.getLogger(__name__)

db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None
http_client: Optional[httpx.AsyncClient] = None

class LoggingConnection(asyncpg.Connection):
    def _log_query(self, query: str, args):
        if os.getenv("ENVIRONMENT", "development") == "development":
            logger.debug(f"SQL Exec: {query.strip().replace('    ', ' ')} | Args: {args}")

    async def execute(self, query: str, *args, **kwargs):
        self._log_query(query, args)
        return await super().execute(query, *args, **kwargs)

    async def fetch(self, query: str, *args, **kwargs):
        self._log_query(query, args)
        return await super().fetch(query, *args, **kwargs)

    async def fetchrow(self, query: str, *args, **kwargs):
        self._log_query(query, args)
        return await super().fetchrow(query, *args, **kwargs)

    async def fetchval(self, query: str, *args, **kwargs):
        self._log_query(query, args)
        return await super().fetchval(query, *args, **kwargs)

def get_db():
    return db_pool

def get_redis():
    return redis_client

def get_http_client():
    return http_client


def _compute_integrity_hash(
    user_id: Optional[str],
    username: str,
    action_type: str,
    entity_type: str,
    entity_id: Optional[str],
    ip_address: Optional[str],
    status: str,
    severity: str,
) -> str:
    """Generate a SHA-256 integrity hash for tamper detection."""
    payload = f"{user_id}|{username}|{action_type}|{entity_type}|{entity_id}|{ip_address}|{status}|{severity}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def log_audit_event(
    user_id: Optional[str], 
    username: str, 
    action_type: str, 
    entity_type: str, 
    entity_id: Optional[str] = None,
    ip_address: Optional[str] = None, 
    status: str = "SUCCESS",
    severity: str = "INFO",
    details: Optional[Dict[str, Any]] = None,
    user_agent: Optional[str] = None,
):
    """
    Insert an immutable audit log entry into the database.
    Each entry includes a SHA-256 integrity hash for tamper detection.
    """
    global db_pool
    if not db_pool:
        return
        
    try:
        integrity_hash = _compute_integrity_hash(
            user_id, username, action_type, entity_type,
            entity_id, ip_address, status, severity
        )
        merged_details = {**(details or {}), "integrity_hash": integrity_hash}
        details_json = json.dumps(merged_details)

        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO audit_logs 
                (user_id, username, action_type, entity_type, entity_id, ip_address, user_agent, status, severity, details)
                VALUES ($1::uuid, $2, $3, $4, $5, $6::inet, $7, $8, $9, $10::jsonb)
                """,
                user_id, username, action_type, entity_type, entity_id,
                ip_address, user_agent, status, severity, details_json
            )
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
