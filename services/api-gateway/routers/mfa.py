"""
SOAR Pro — Multi-Factor Authentication (TOTP)
Provides MFA enrollment, verification, and disable endpoints
using pyotp for TOTP and qrcode for QR generation.
"""

import io
import base64
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.db import get_db, log_audit_event
from dependencies import get_current_user, TokenData

router = APIRouter()
logger = logging.getLogger(__name__)


class MFAVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class MFADisable(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


def _generate_totp_secret() -> str:
    """Generate a new TOTP secret."""
    try:
        import pyotp
        return pyotp.random_base32()
    except ImportError:
        # Fallback: generate a base32 string manually
        import secrets
        import string
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        return "".join(secrets.choice(chars) for _ in range(32))


def _verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code against a secret."""
    try:
        import pyotp
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except ImportError:
        logger.error("pyotp not installed — MFA verification unavailable")
        return False


def _generate_qr_base64(secret: str, username: str) -> Optional[str]:
    """Generate a QR code image for authenticator app enrollment."""
    try:
        import pyotp
        import qrcode
        # Build the OTP URI
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=username, issuer_name="SOAR Pro")

        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")
    except ImportError:
        logger.warning("qrcode/pyotp not installed — QR generation unavailable")
        return None


# ════════════════════════════════════════════════
# POST /enroll — Start MFA enrollment
# ════════════════════════════════════════════════

@router.post("/api/v1/auth/mfa/enroll")
async def mfa_enroll(current_user: TokenData = Depends(get_current_user)):
    """
    Generate a TOTP secret and QR code for MFA enrollment.
    The secret is stored in the user's mfa_secret column but MFA
    is not activated until verify is called.
    """
    pool = get_db()
    async with pool.acquire() as conn:
        # Check if already enrolled
        user = await conn.fetchrow(
            "SELECT mfa_enabled, mfa_secret, username FROM users WHERE id = $1::uuid",
            current_user.user_id,
        )
        if not user:
            raise HTTPException(404, "User not found")

        if user["mfa_enabled"]:
            raise HTTPException(400, "MFA is already enabled. Disable it first to re-enroll.")

        # Generate new secret
        secret = _generate_totp_secret()

        # Store secret (not yet activated)
        await conn.execute(
            "UPDATE users SET mfa_secret = $1 WHERE id = $2::uuid",
            secret, current_user.user_id,
        )

    # Generate QR code
    qr_base64 = _generate_qr_base64(secret, user["username"])

    return {
        "status": "enrollment_started",
        "secret": secret,
        "qr_code": qr_base64,
        "message": "Scan the QR code with your authenticator app, then verify with a code.",
    }


# ════════════════════════════════════════════════
# POST /verify — Verify code and activate MFA
# ════════════════════════════════════════════════

@router.post("/api/v1/auth/mfa/verify")
async def mfa_verify(
    data: MFAVerify,
    current_user: TokenData = Depends(get_current_user),
):
    """Verify a TOTP code and enable MFA for the user."""
    pool = get_db()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT mfa_enabled, mfa_secret FROM users WHERE id = $1::uuid",
            current_user.user_id,
        )
        if not user:
            raise HTTPException(404, "User not found")
        if not user["mfa_secret"]:
            raise HTTPException(400, "No MFA secret found. Call /enroll first.")

        # Verify the code
        if not _verify_totp(user["mfa_secret"], data.code):
            raise HTTPException(401, "Invalid TOTP code. Please try again.")

        # Enable MFA
        await conn.execute(
            "UPDATE users SET mfa_enabled = true WHERE id = $1::uuid",
            current_user.user_id,
        )

    import asyncio
    asyncio.create_task(log_audit_event(
        user_id=current_user.user_id,
        username=current_user.username,
        action_type="MFA_ENABLED",
        entity_type="USER",
        entity_id=current_user.user_id,
        status="SUCCESS",
        severity="WARNING",
    ))

    logger.info(f"MFA enabled for user {current_user.username}")
    return {"status": "mfa_enabled", "message": "MFA has been successfully enabled."}


# ════════════════════════════════════════════════
# POST /disable — Disable MFA
# ════════════════════════════════════════════════

@router.post("/api/v1/auth/mfa/disable")
async def mfa_disable(
    data: MFADisable,
    current_user: TokenData = Depends(get_current_user),
):
    """Disable MFA — requires a valid TOTP code to confirm."""
    pool = get_db()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT mfa_enabled, mfa_secret FROM users WHERE id = $1::uuid",
            current_user.user_id,
        )
        if not user:
            raise HTTPException(404, "User not found")
        if not user["mfa_enabled"]:
            raise HTTPException(400, "MFA is not currently enabled.")

        # Verify the code
        if not _verify_totp(user["mfa_secret"], data.code):
            raise HTTPException(401, "Invalid TOTP code.")

        # Disable MFA and clear secret
        await conn.execute(
            "UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1::uuid",
            current_user.user_id,
        )

    import asyncio
    asyncio.create_task(log_audit_event(
        user_id=current_user.user_id,
        username=current_user.username,
        action_type="MFA_DISABLED",
        entity_type="USER",
        entity_id=current_user.user_id,
        status="SUCCESS",
        severity="CRITICAL",
    ))

    logger.info(f"MFA disabled for user {current_user.username}")
    return {"status": "mfa_disabled", "message": "MFA has been disabled."}
