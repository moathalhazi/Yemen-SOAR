from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, List, Any
import bcrypt

from utils.db import get_redis
from utils.auth_security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    create_access_token,
    decode_signed_token,
    is_token_blacklisted,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

class TokenData:
    def __init__(self, user_id=None, username=None, roles=None, permissions=None):
        self.user_id = user_id
        self.username = username
        self.roles = roles or []
        self.permissions = permissions or []

async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    redis = get_redis()
    if await is_token_blacklisted(redis, token):
        raise HTTPException(status_code=401, detail="Token has been revoked/logged out")
    try:
        payload = decode_signed_token(token)
        token_type = payload.get("token_type")
        if token_type not in (None, "access"):
            raise HTTPException(status_code=401, detail="Invalid token type")
        return TokenData(
            user_id=payload.get("sub"),
            username=payload.get("username"),
            roles=payload.get("roles", []),
            permissions=payload.get("permissions", [])
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


async def get_current_token(token: str = Depends(oauth2_scheme)) -> str:
    return token

from core.security import has_permission_db

def require_permission(permission_key: str):
    """
    Dependency to check if the current user holds explicitly defined permission structure
    through the database. Replaces the legacy require_roles.
    """
    async def permission_checker(current_user: TokenData = Depends(get_current_user)):
        has_perm = await has_permission_db(current_user.user_id, permission_key)
        if not has_perm:
            raise HTTPException(status_code=403, detail=f"Missing required permission: {permission_key}")
        return current_user
    return permission_checker


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
