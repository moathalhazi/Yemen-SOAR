"""
SOAR Pro Integration Manager - Scheduled REST API Pull Engine
Polls external security systems on a configurable schedule and ingests their alerts.
No mock data — only processes real API responses from configured endpoints.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)


class RESTPullEngine:
    """
    Background engine that periodically polls REST APIs of registered integrations
    and ingests real alerts from SIEM / EDR / Firewall systems.
    """

    def __init__(
        self,
        db_pool,
        redis_client,
        process_callback,
        decrypt_fn,
    ):
        self._db = db_pool
        self._redis = redis_client
        self._process = process_callback
        self._decrypt = decrypt_fn
        self._running = False
        self._http: Optional[httpx.AsyncClient] = None

    async def start(self):
        """Start the pull loop."""
        self._running = True
        self._http = httpx.AsyncClient(timeout=30.0, verify=False)
        logger.info("REST Pull Engine started")
        asyncio.create_task(self._loop())

    async def stop(self):
        self._running = False
        if self._http:
            await self._http.aclose()

    async def _loop(self):
        """Main polling loop — checks every 30 seconds for integrations due for a pull."""
        while self._running:
            try:
                await self._poll_due_integrations()
            except Exception as e:
                logger.error(f"REST Pull loop error: {e}")
            await asyncio.sleep(30)

    async def _poll_due_integrations(self):
        """Find integrations whose next_pull_at <= NOW and execute them."""
        async with self._db.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, name, slug, config, auth_type, credentials_encrypted,
                       pull_interval_seconds, log_format
                FROM integrations
                WHERE integration_type = 'rest_pull'
                  AND is_active = true
                  AND (next_pull_at IS NULL OR next_pull_at <= NOW())
                ORDER BY next_pull_at ASC NULLS FIRST
                LIMIT 10
            """)

        for row in rows:
            integration = dict(row)
            asyncio.create_task(self._pull_one(integration))

    async def _pull_one(self, integration: Dict[str, Any]):
        """Pull alerts from a single REST integration."""
        int_id = integration["id"]
        name = integration["name"]
        config = integration["config"] if isinstance(integration["config"], dict) else json.loads(integration["config"])

        url = config.get("url", "")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        params = config.get("params", {})
        body = config.get("body")
        response_path = config.get("response_path", "")  # JSONPath-like key to extract alerts array

        if not url:
            logger.warning(f"[{name}] REST pull skipped — no URL configured")
            return

        # Decrypt credentials and inject into headers / params
        if integration.get("credentials_encrypted"):
            try:
                creds = self._decrypt(integration["credentials_encrypted"])
                if isinstance(creds, str):
                    creds = json.loads(creds)
                # Inject auth
                auth_type = integration.get("auth_type", "none")
                if auth_type == "bearer_token" and creds.get("token"):
                    headers["Authorization"] = f"Bearer {creds['token']}"
                elif auth_type == "api_key" and creds.get("api_key"):
                    header_name = creds.get("header_name", "X-API-Key")
                    headers[header_name] = creds["api_key"]
                elif auth_type == "basic" and creds.get("username"):
                    import base64
                    b64 = base64.b64encode(f"{creds['username']}:{creds.get('password', '')}".encode()).decode()
                    headers["Authorization"] = f"Basic {b64}"
            except Exception as e:
                logger.error(f"[{name}] Credential decryption failed: {e}")

        # Add time-based filtering if supported
        since = config.get("since_param")
        if since:
            interval = integration.get("pull_interval_seconds", 300)
            since_time = (datetime.now(timezone.utc) - timedelta(seconds=interval * 2)).isoformat()
            params[since] = since_time

        start_time = datetime.now(timezone.utc)
        try:
            if method == "GET":
                resp = await self._http.get(url, headers=headers, params=params)
            else:
                resp = await self._http.post(url, headers=headers, params=params, json=body)

            elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

            if resp.status_code >= 400:
                await self._record_failure(int_id, f"HTTP {resp.status_code}: {resp.text[:200]}")
                return

            data = resp.json()

            # Navigate to alerts array using response_path
            alerts_data = data
            if response_path:
                for key in response_path.split("."):
                    if isinstance(alerts_data, dict):
                        alerts_data = alerts_data.get(key, [])
                    else:
                        break

            if not isinstance(alerts_data, list):
                alerts_data = [alerts_data]

            count = 0
            for alert_raw in alerts_data:
                if isinstance(alert_raw, dict):
                    await self._process(
                        integration_id=str(int_id),
                        raw_payload=json.dumps(alert_raw),
                        source_ip="rest_pull",
                        log_format=integration.get("log_format", "json"),
                    )
                    count += 1

            logger.info(f"[{name}] REST pull complete: {count} alerts ingested in {elapsed_ms}ms")

            # Update next pull time
            interval = integration.get("pull_interval_seconds", 300)
            async with self._db.acquire() as conn:
                await conn.execute("""
                    UPDATE integrations
                    SET next_pull_at = NOW() + ($2 || ' seconds')::INTERVAL,
                        last_connected_at = NOW(),
                        health_status = 'healthy',
                        last_error = NULL
                    WHERE id = $1
                """, int_id, str(interval))

                await conn.execute("""
                    UPDATE integration_status
                    SET status = 'online',
                        last_heartbeat = NOW(),
                        last_successful_ingestion = NOW(),
                        consecutive_failures = 0
                    WHERE integration_id = $1
                """, int_id)

        except httpx.ConnectError as e:
            await self._record_failure(int_id, f"Connection failed: {e}")
        except httpx.TimeoutException:
            await self._record_failure(int_id, "Request timed out")
        except Exception as e:
            await self._record_failure(int_id, f"Pull error: {e}")

    async def _record_failure(self, integration_id, error_msg: str):
        """Record a pull failure in the database."""
        logger.error(f"REST pull failed for {integration_id}: {error_msg}")
        try:
            async with self._db.acquire() as conn:
                await conn.execute("""
                    UPDATE integrations
                    SET last_error = $2,
                        health_status = 'error',
                        total_alerts_failed = total_alerts_failed + 1,
                        next_pull_at = NOW() + INTERVAL '60 seconds'
                    WHERE id = $1
                """, integration_id, error_msg[:500])

                await conn.execute("""
                    UPDATE integration_status
                    SET status = 'error',
                        last_error = $2,
                        last_failed_ingestion = NOW(),
                        consecutive_failures = consecutive_failures + 1,
                        errors_last_hour = errors_last_hour + 1
                    WHERE integration_id = $1
                """, integration_id, error_msg[:500])
        except Exception as e:
            logger.error(f"Failed to record pull failure: {e}")

    async def pull_now(self, integration_id: str) -> Dict[str, Any]:
        """Manually trigger a pull for testing. Returns result summary."""
        async with self._db.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, name, slug, config, auth_type, credentials_encrypted,
                       pull_interval_seconds, log_format
                FROM integrations
                WHERE id = $1 AND integration_type = 'rest_pull' AND is_active = true
            """, integration_id)

        if not row:
            return {"status": "error", "message": "Integration not found or not a REST pull type"}

        await self._pull_one(dict(row))
        return {"status": "ok", "message": f"Pull triggered for {row['name']}"}
