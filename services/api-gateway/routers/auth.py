from datetime import datetime, timedelta, timezone
import logging
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError

from dependencies import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_token,
    get_current_user,
    get_password_hash,
    require_permission,
    verify_password,
)

from utils.db import get_db, get_redis, get_http_client, log_audit_event
from utils.auth_security import (
    blacklist_token,
    consume_password_reset_token,
    create_password_reset_token,
    hash_token,
    store_password_reset_token,
)
from utils.serializers import get_user_profile_row
from models import *

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_user_response(user) -> UserResponse:
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user["full_name"],
        phone=user["phone"],
        department=user["department"],
        avatar_url=user["avatar_url"],
        login_count=user["login_count"],
        last_login=user["last_login"],
        playbooks_authored=user["playbooks_authored"],
        incidents_resolved=user["incidents_resolved"],
        is_active=user["is_active"],
        roles=[role for role in user["roles"] if role] if user["roles"] else [],
        permissions=[perm for perm in user["permissions"] if perm] if user["permissions"] else [],
    )

@router.get("/api/v1/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """Get current authenticated user info"""
    async with get_db().acquire() as conn:
        user = await get_user_profile_row(conn, str(current_user.user_id))
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return _build_user_response(user)

@router.post("/api/v1/auth/logout")
async def logout(
    request: Request,
    current_user: TokenData = Depends(get_current_user),
    token: str = Depends(get_current_token),
):
    """Logout user (invalidate token in Redis)"""
    redis = get_redis()
    await blacklist_token(redis, token)

    try:
        async with get_db().acquire() as conn:
            await conn.execute(
                """
                UPDATE sessions
                SET is_active = false, last_activity = NOW()
                WHERE token_hash = $1
                """,
                hash_token(token),
            )
    except Exception as exc:
        logger.warning(f"Failed to deactivate session during logout: {exc}")

    await log_audit_event(
        user_id=str(current_user.user_id),
        username=current_user.username,
        action_type="LOGOUT",
        entity_type="SYSTEM",
        ip_address=request.client.host if request.client else None,
        status="SUCCESS",
        severity="INFO",
        user_agent=request.headers.get("User-Agent"),
    )
    return {"message": "Logged out successfully"}

@router.post("/api/v1/auth/forgot-password")
async def forgot_password(request: PasswordResetRequest):
    """Request password reset link"""
    async with get_db().acquire() as conn:
        user = await conn.fetchrow("SELECT id, email FROM users WHERE email = $1", request.email)
        if not user:
            return {"message": "If account exists, reset link sent"}

    redis = get_redis()
    if not redis:
        raise HTTPException(status_code=503, detail="Password reset is temporarily unavailable")

    reset_token, ttl_seconds = create_password_reset_token(str(user["id"]))
    await store_password_reset_token(redis, reset_token, str(user["id"]), ttl_seconds)

    logger.info(f"Password reset requested for user {user['id']} ({request.email})")
    return {"message": "If account exists, reset link sent"}

@router.post("/api/v1/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password with token"""
    redis = get_redis()
    if not redis:
        raise HTTPException(status_code=503, detail="Password reset is temporarily unavailable")

    try:
        user_id = await consume_password_reset_token(redis, data.token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    password_hash = get_password_hash(data.new_password)
    
    async with get_db().acquire() as conn:
        await conn.execute(
            """
            UPDATE users
            SET password_hash = $1, updated_at = NOW()
            WHERE id = $2::uuid
            """,
            password_hash, user_id
        )

        await conn.execute(
            """
            UPDATE sessions
            SET is_active = false, last_activity = NOW()
            WHERE user_id = $1::uuid
            """,
            user_id,
        )

    await log_audit_event(
        user_id=user_id,
        username="password-reset",
        action_type="PASSWORD_RESET",
        entity_type="USER",
        entity_id=user_id,
        status="SUCCESS",
        severity="WARNING",
    )

    return {"message": "Password updated successfully"}

@router.post("/api/v1/auth/login", response_model=Token)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Authenticate user and return JWT token.
    """
    try:
        async with get_db().acquire() as conn:
            query = """
                SELECT u.id, u.username, u.password_hash, u.is_active, 
                       array_remove(array_agg(r.name), NULL) as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)
                GROUP BY u.id
            """
            record = await conn.fetchrow(query, form_data.username)
    except Exception as e:
        logger.error(f"Login error: {e}")
        await log_audit_event(
            user_id=None,
            username=form_data.username,
            action_type="LOGIN_FAILED",
            entity_type="SYSTEM",
            ip_address=request.client.host if request.client else None,
            status="FAILED",
            severity="CRITICAL",
            details={"error": "Database query failed during login"},
            user_agent=request.headers.get("User-Agent"),
        )
        raise HTTPException(status_code=500, detail="Internal server error")

    if not record or not verify_password(form_data.password, record['password_hash']):
        await log_audit_event(
            user_id=None,
            username=form_data.username,
            action_type="LOGIN_FAILED",
            entity_type="SYSTEM",
            ip_address=request.client.host if request.client else None,
            status="FAILED",
            severity="WARNING",
            details={"reason": "Incorrect credentials"},
            user_agent=request.headers.get("User-Agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not record.get("is_active", True):
        await log_audit_event(
            user_id=str(record['id']),
            username=form_data.username,
            action_type="LOGIN_FAILED",
            entity_type="SYSTEM",
            ip_address=request.client.host if request.client else None,
            status="FAILED",
            severity="WARNING",
            details={"reason": "Inactive user account"},
            user_agent=request.headers.get("User-Agent"),
        )
        raise HTTPException(status_code=400, detail="Inactive user")

    user_id = str(record['id'])
    
    # Convert roles to strings if they are objects
    roles = record.get('roles', [])
    if isinstance(roles, str):
        roles = [roles]

    permissions = []
    user_dict = {
        "id": user_id,
        "username": record["username"],
        "roles": roles,
        "permissions": permissions,
    }

    try:
        async with get_db().acquire() as conn:
            full_user = await get_user_profile_row(conn, user_id)
            if full_user:
                user_dict = _build_user_response(full_user).model_dump(mode="json")
                permissions = user_dict.get("permissions", [])
                roles = user_dict.get("roles", roles)
    except Exception as e:
        logger.error(f"Failed to fetch full user profile on login: {e}")
        
    access_token = create_access_token(data={
        "sub": user_id, 
        "username": record['username'],
        "roles": roles,
        "permissions": permissions,
    })
    
    # Create session record
    session_id = str(uuid.uuid4())
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        async with get_db().acquire() as conn:
            await conn.execute(
                """
                INSERT INTO sessions (id, user_id, token_hash, ip_address, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                """,
                session_id,
                user_id,
                hash_token(access_token),
                getattr(request.client, 'host', '0.0.0.0'),
                expires_at,
            )
            
            # Bump login count and last_login
            await conn.execute(
                """
                UPDATE users 
                SET login_count = COALESCE(login_count, 0) + 1, last_login = NOW()
                WHERE id = $1
                """,
                user_id
            )
    except Exception as e:
        logger.error(f"Failed to create session or bump login count: {e}")

    # Log successful login
    await log_audit_event(
        user_id=user_id,
        username=record['username'],
        action_type="LOGIN_SUCCESS",
        entity_type="SYSTEM",
        ip_address=request.client.host if request.client else None,
        status="SUCCESS",
        severity="INFO",
        user_agent=request.headers.get("User-Agent"),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user_dict
    }
