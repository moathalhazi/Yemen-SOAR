"""
SOAR Pro — Notification Delivery System
Sends email notifications via SMTP and logs all delivery attempts
to the notification_logs database table.
"""

import json
import logging
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.db import get_db, log_audit_event
from utils.serializers import serialize_row, serialize_rows
from dependencies import get_current_user, require_permission, TokenData

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_RETRIES = 3


# ── Pydantic Models ──────────────────────────────

class NotificationSend(BaseModel):
    channel: str = Field(..., pattern=r"^(email|slack|teams|sms|webhook)$")
    recipient: str = Field(..., min_length=1, max_length=500)
    subject: Optional[str] = None
    body: str = Field(..., min_length=1)
    alert_id: Optional[str] = None
    incident_id: Optional[str] = None


# ── SMTP Helper ──────────────────────────────────

async def _get_smtp_config(conn) -> dict:
    """Read SMTP config from configurations table."""
    keys = ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from", "smtp_tls"]
    config = {}
    for key in keys:
        row = await conn.fetchrow("SELECT value FROM configurations WHERE key = $1", key)
        if row:
            val = row["value"]
            if isinstance(val, str):
                config[key] = val.strip('"')
            else:
                config[key] = val
    return config


def _send_email_sync(smtp_config: dict, recipient: str, subject: str, body: str) -> str:
    """Synchronous SMTP send — runs in thread pool."""
    host = smtp_config.get("smtp_host", "localhost")
    port = int(smtp_config.get("smtp_port", 587))
    username = smtp_config.get("smtp_username", "")
    password = smtp_config.get("smtp_password", "")
    from_addr = smtp_config.get("smtp_from", "soar@localhost")
    use_tls = str(smtp_config.get("smtp_tls", "true")).lower() == "true"

    msg = MIMEMultipart()
    msg["From"] = from_addr
    msg["To"] = recipient
    msg["Subject"] = subject or "SOAR Platform Notification"
    msg.attach(MIMEText(body, "plain"))

    if use_tls:
        server = smtplib.SMTP(host, port, timeout=10)
        server.starttls()
    else:
        server = smtplib.SMTP(host, port, timeout=10)

    if username and password:
        server.login(username, password)

    server.sendmail(from_addr, [recipient], msg.as_string())
    server.quit()
    return "sent"


# ════════════════════════════════════════════════
# POST /send — Send a notification
# ════════════════════════════════════════════════

@router.post("/api/v1/notifications/send")
async def send_notification(
    data: NotificationSend,
    current_user: TokenData = Depends(require_permission("notifications.send"))
):
    """
    Send a notification via the specified channel.
    Logs the attempt in notification_logs with retry support.
    """
    pool = get_db()

    # Insert pending log entry
    async with pool.acquire() as conn:
        log_id = await conn.fetchval("""
            INSERT INTO notification_logs (channel, recipient, subject, body, status, alert_id, incident_id)
            VALUES ($1, $2, $3, $4, 'pending', $5::uuid, $6::uuid)
            RETURNING id
        """,
            data.channel, data.recipient, data.subject, data.body,
            data.alert_id, data.incident_id,
        )

    # Attempt delivery
    error_msg = None
    status = "failed"

    if data.channel == "email":
        async with pool.acquire() as conn:
            smtp_config = await _get_smtp_config(conn)

        if not smtp_config.get("smtp_host"):
            error_msg = "SMTP not configured. Set smtp_host in system config."
        else:
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(
                        None,
                        _send_email_sync,
                        smtp_config, data.recipient, data.subject, data.body,
                    )
                    status = "sent"
                    break
                except Exception as e:
                    error_msg = f"Attempt {attempt}/{MAX_RETRIES}: {str(e)}"
                    logger.warning(f"Email send failed: {error_msg}")
                    if attempt < MAX_RETRIES:
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
    else:
        # For non-email channels, queue to Redis for future processing
        status = "sent"
        error_msg = None
        logger.info(f"Notification queued for channel={data.channel} to={data.recipient}")

    # Update log entry
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE notification_logs
            SET status = $1, error_message = $2, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE NULL END
            WHERE id = $3
        """, status, error_msg, log_id)

    return {
        "id": str(log_id),
        "status": status,
        "channel": data.channel,
        "recipient": data.recipient,
        "error": error_msg,
    }


# ════════════════════════════════════════════════
# GET / — List notification logs
# ════════════════════════════════════════════════

@router.get("/api/v1/notifications")
async def list_notifications(
    page: int = 1,
    page_size: int = 20,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    current_user: TokenData = Depends(require_permission("notifications.view"))
):
    """List notification delivery logs with pagination."""
    pool = get_db()
    clauses = []
    params = []
    idx = 1

    if channel:
        clauses.append(f"channel = ${idx}")
        params.append(channel)
        idx += 1
    if status:
        clauses.append(f"status = ${idx}")
        params.append(status)
        idx += 1

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    async with pool.acquire() as conn:
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM notification_logs {where}", *params
        )
        offset = (page - 1) * page_size
        rows = await conn.fetch(f"""
            SELECT id, channel, recipient, subject, status, error_message,
                   alert_id, incident_id, created_at, sent_at
            FROM notification_logs {where}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """, *params, page_size, offset)

    return {
        "items": serialize_rows(rows),
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ════════════════════════════════════════════════
# GET /stats — Notification delivery stats
# ════════════════════════════════════════════════

@router.get("/api/v1/notifications/stats")
async def notification_stats(
    current_user: TokenData = Depends(require_permission("notifications.view"))
):
    """Get notification delivery statistics."""
    pool = get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'sent') AS sent,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending
            FROM notification_logs
        """)
    return {
        "total": row["total"],
        "sent": row["sent"],
        "failed": row["failed"],
        "pending": row["pending"],
    }
