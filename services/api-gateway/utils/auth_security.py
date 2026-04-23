import json
import os
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

from jose import JWTError, jwt


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY in ("your-secret-key-here", "change-me"):
    SECRET_KEY = "dev-only-insecure-key-change-in-production"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30"))


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    now = _utcnow()
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {
        **data,
        "iat": int(now.timestamp()),
        "exp": expire,
        "jti": data.get("jti") or str(uuid4()),
        "token_type": data.get("token_type", "access"),
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(user_id: str, expires_delta: Optional[timedelta] = None) -> Tuple[str, int]:
    now = _utcnow()
    expire = now + (expires_delta or timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES))
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": expire,
        "jti": str(uuid4()),
        "token_type": "password_reset",
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, max(int((expire - now).total_seconds()), 1)


def decode_signed_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_token_ttl_seconds(token: str) -> int:
    try:
        claims = jwt.get_unverified_claims(token)
    except JWTError:
        return ACCESS_TOKEN_EXPIRE_MINUTES * 60

    exp = claims.get("exp")
    if isinstance(exp, (int, float)):
        return max(int(exp - _utcnow().timestamp()), 1)
    return ACCESS_TOKEN_EXPIRE_MINUTES * 60


async def is_token_blacklisted(redis_client, token: str) -> bool:
    if not redis_client:
        return False
    return bool(await redis_client.get(f"blacklist:{hash_token(token)}"))


async def blacklist_token(redis_client, token: str) -> None:
    if not redis_client:
        return
    ttl_seconds = get_token_ttl_seconds(token)
    await redis_client.setex(f"blacklist:{hash_token(token)}", ttl_seconds, "1")


async def store_password_reset_token(redis_client, token: str, user_id: str, ttl_seconds: int) -> None:
    claims = jwt.get_unverified_claims(token)
    jti = claims["jti"]
    payload = {
        "user_id": user_id,
        "token_hash": hash_token(token),
    }
    await redis_client.setex(f"password_reset:{jti}", ttl_seconds, json.dumps(payload))


async def consume_password_reset_token(redis_client, token: str) -> Optional[str]:
    claims = decode_signed_token(token)
    if claims.get("token_type") != "password_reset":
        raise JWTError("Invalid token type")

    jti = claims.get("jti")
    user_id = claims.get("sub")
    if not jti or not user_id or not redis_client:
        return None

    stored = await redis_client.get(f"password_reset:{jti}")
    if not stored:
        return None

    try:
        stored_payload = json.loads(stored)
    except json.JSONDecodeError:
        return None

    if stored_payload.get("user_id") != user_id:
        return None
    if stored_payload.get("token_hash") != hash_token(token):
        return None

    await redis_client.delete(f"password_reset:{jti}")
    return user_id
