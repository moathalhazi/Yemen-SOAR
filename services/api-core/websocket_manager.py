"""
SOAR Pro - WebSocket Manager
Real-time dashboard updates via WebSocket connections.
Subscribes to Redis Pub/Sub channels and broadcasts to all connected clients.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import WebSocket
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

CHANNEL_EVENT_MAP = {
    "soar:alerts": {"type": "alert", "action": "created"},
    "soar:incidents": {"type": "incident", "action": "updated"},
    "soar:playbooks": {"type": "playbook", "action": "executed"},
    "soar:evidence": {"type": "evidence", "action": "collected"},
    "soar:risk": {"type": "risk", "action": "triggered"},
}


class WebSocketManager:
    """Manages WebSocket connections and Redis Pub/Sub for real-time dashboard updates."""

    def __init__(self):
        self._connections: List[WebSocket] = []
        self._subscriber_task: Optional[asyncio.Task] = None

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)
        logger.info(f"WebSocket connected - total: {len(self._connections)}")

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)
        logger.info(f"WebSocket disconnected - total: {len(self._connections)}")

    async def broadcast(self, message_type: str, action: str, data: Dict[str, Any]):
        """Broadcast a normalized event to all connected dashboards."""
        message = json.dumps({
            "type": message_type,
            "action": action,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        dead_connections = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.append(ws)

        for ws in dead_connections:
            self.disconnect(ws)

    async def send_alert_created(self, alert_data: dict):
        await self.broadcast("alert", "created", alert_data)

    async def send_incident_created(self, incident_data: dict):
        await self.broadcast("incident", "created", incident_data)

    async def send_incident_updated(self, incident_data: dict):
        await self.broadcast("incident", "updated", incident_data)

    async def send_playbook_executed(self, execution_data: dict):
        await self.broadcast("playbook", "executed", execution_data)

    async def send_evidence_collected(self, evidence_data: dict):
        await self.broadcast("evidence", "collected", evidence_data)

    async def send_risk_alert(self, risk_data: dict):
        await self.broadcast("risk", "triggered", risk_data)

    async def start_redis_subscriber(self):
        """Subscribe to Redis Pub/Sub channels and relay normalized events."""
        try:
            redis_conn = await aioredis.from_url(settings.redis.url, decode_responses=True)
            pubsub = redis_conn.pubsub()
            channels = list(CHANNEL_EVENT_MAP.keys())
            await pubsub.subscribe(*channels)
            logger.info(f"WebSocket Redis subscriber started on channels: {channels}")

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                envelope = CHANNEL_EVENT_MAP.get(
                    message["channel"],
                    {"type": "system", "action": "received"},
                )

                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    data = {"raw": message["data"]}

                if self._connections:
                    await self.broadcast(envelope["type"], envelope["action"], data)

        except asyncio.CancelledError:
            logger.info("WebSocket Redis subscriber cancelled")
        except Exception as exc:
            logger.error(f"Redis subscriber error: {exc}")
            await asyncio.sleep(5)
            self._subscriber_task = asyncio.create_task(self.start_redis_subscriber())

    def start(self):
        if self._subscriber_task is None or self._subscriber_task.done():
            self._subscriber_task = asyncio.create_task(self.start_redis_subscriber())
            logger.info("WebSocket Redis subscriber task started")

    async def stop(self):
        if self._subscriber_task and not self._subscriber_task.done():
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass


ws_manager = WebSocketManager()
