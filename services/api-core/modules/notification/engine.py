"""
SOAR Pro — Notification Engine
Publishes events to Redis for real-time subscribers and triggers external
service calls (forensic collection, email, Slack).
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)


class NotificationEngine:
    """
    Handles outbound notifications:
    - Redis Pub/Sub for real-time dashboard events
    - HTTP calls to forensic-service for evidence collection
    - Email / Slack notifications (extensible)
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._http: Optional[httpx.AsyncClient] = None

    async def _ensure_connections(self):
        if self._redis is None:
            self._redis = await aioredis.from_url(
                settings.redis.url, decode_responses=True
            )
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=30.0)

    # ── Redis Pub/Sub ────────────────────────────

    async def publish_event(self, channel: str, data: Dict[str, Any]):
        """Publish an event to a Redis channel for real-time subscribers."""
        await self._ensure_connections()
        message = json.dumps({
            **data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await self._redis.publish(channel, message)
        logger.debug(f"Published to {channel}: {message[:200]}")

    async def publish_alert_event(self, alert_data: dict):
        await self.publish_event("soar:alerts", alert_data)

    async def publish_incident_event(self, incident_data: dict):
        await self.publish_event("soar:incidents", incident_data)

    # ── Queue for downstream services ────────────

    async def queue_event(self, queue_name: str, data: Dict[str, Any]):
        """Push an event to a Redis queue (RPUSH) for consumer services."""
        await self._ensure_connections()
        await self._redis.rpush(queue_name, json.dumps(data))
        logger.debug(f"Queued to {queue_name}")

    # ── Forensic Collection Trigger ──────────────

    async def request_forensic_collection(
        self,
        alert_id: str,
        severity: str,
        risk_score: float,
        incident_id: Optional[str] = None,
    ):
        """
        Trigger the forensic-service to collect evidence for a high-risk alert.
        Posts to the forensic service API and queues in Redis as fallback.
        """
        await self._ensure_connections()

        payload = {
            "alert_id": alert_id,
            "incident_id": incident_id,
            "severity": severity,
            "risk_score": risk_score,
            "trigger": "auto_risk_threshold",
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }

        # Queue in Redis for the forensic consumer
        await self.queue_event("forensic_collection_queue", payload)

        # Also try direct HTTP call to forensic-service
        try:
            url = f"{settings.services.forensic_service_url}/api/v1/forensic/collect"
            resp = await self._http.post(
                url,
                json={
                    "incident_id": incident_id,
                    "alert_id": alert_id,
                    "collected_by": "api-core",
                    "metadata": payload,
                },
                timeout=10.0,
            )
            if resp.status_code in (200, 201, 202):
                logger.info(f"Forensic collection triggered for alert {alert_id} (risk={risk_score})")
            else:
                logger.warning(f"Forensic service returned {resp.status_code}")
        except Exception as e:
            logger.warning(f"Forensic service unavailable, queued for later: {e}")

    # ── Email Notification ───────────────────────

    async def send_email(
        self, recipient: str, subject: str, body: str, alert_id: Optional[str] = None
    ):
        """Queue an email notification."""
        await self._ensure_connections()
        await self.queue_event("notification_email_queue", {
            "channel": "email",
            "recipient": recipient,
            "subject": subject,
            "body": body,
            "alert_id": alert_id,
        })
        logger.info(f"Email queued to {recipient}: {subject}")

    # ── Slack Notification ───────────────────────

    async def send_slack(
        self, channel: str, message: str, alert_id: Optional[str] = None
    ):
        """Queue a Slack notification."""
        await self._ensure_connections()
        await self.queue_event("notification_slack_queue", {
            "channel": "slack",
            "slack_channel": channel,
            "message": message,
            "alert_id": alert_id,
        })
        logger.info(f"Slack notification queued to {channel}")

    # ── Critical Alert Notification ──────────────

    async def notify_critical_alert(self, alert_data: dict):
        """Send notifications across all channels for a critical alert."""
        title = alert_data.get("title", "Critical Alert")
        risk = alert_data.get("risk_score", 0)
        msg = f"🚨 CRITICAL ALERT: {title} (Risk Score: {risk})"

        # Publish to Redis for real-time dashboard
        await self.publish_alert_event(alert_data)

        # Queue email
        recipient = os.getenv("DEFAULT_EMAIL_RECIPIENT", "security-team@company.com")
        await self.send_email(recipient, f"[SOAR] {msg}", json.dumps(alert_data, indent=2))

        # Queue Slack
        slack_channel = os.getenv("DEFAULT_SLACK_RECIPIENT", "#security-alerts")
        await self.send_slack(slack_channel, msg)
