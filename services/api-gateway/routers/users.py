from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import logging
import uuid
from uuid import UUID

from utils.db import get_db, get_redis, get_http_client, log_audit_event
from dependencies import get_current_user, require_permission, TokenData, get_password_hash
from core.security import has_permission_db, clear_user_permission_cache
from models import *

router = APIRouter()
logger = logging.getLogger(__name__)
SUPER_ADMIN_ROLE_ALIASES = ("SUPER_ADMIN", "super_admin", "Administrator", "soar_admin")


async def _get_super_admin_role_ids(conn) -> set[UUID]:
    rows = await conn.fetch(
        "SELECT id FROM roles WHERE name = ANY($1::text[])",
        list(SUPER_ADMIN_ROLE_ALIASES),
    )
    return {row["id"] for row in rows}

@router.get("/api/v1/users", response_model=Dict[str, Any])
async def list_users(
    page: int = 1, 
    page_size: int = 20, 
    current_user: TokenData = Depends(require_permission("users.manage"))
):
    """List all users"""

    async with get_db().acquire() as conn:
        offset = (page - 1) * page_size
        total = await conn.fetchval("SELECT COUNT(*) FROM users")
        
        rows = await conn.fetch("""
            SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.created_at, u.phone, u.department, u.avatar_url, u.login_count, u.last_login,
                   array_agg(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
        """, page_size, offset)
        
        items = []
        for row in rows:
            item = dict(row)
            item['id'] = str(item['id'])
            item['created_at'] = item['created_at'].isoformat() if item['created_at'] else None
            item['last_login'] = item['last_login'].isoformat() if item.get('last_login') else None
            item['roles'] = [r for r in item['roles'] if r] if item['roles'] else []
            items.append(item)
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size, 
            "total_pages": (total + page_size - 1) // page_size
        }

@router.post("/api/v1/users", response_model=UserResponse)
async def create_user(
    data: UserCreate, 
    current_user: TokenData = Depends(require_permission("users.manage"))
):
    """Create new user"""
        
    async with get_db().acquire() as conn:
        # Check specific permissions
        existing = await conn.fetchval(
            "SELECT 1 FROM users WHERE username = $1 OR email = $2", 
            data.username, data.email
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")
            
        password_hash = get_password_hash(data.password)
        
        async with conn.transaction():
            # Create user
            user_id = await conn.fetchval("""
                INSERT INTO users (username, email, password_hash, full_name)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            """, data.username, data.email, password_hash, data.full_name)
            
            # Assign roles
            if data.role_ids:
                for role_id in data.role_ids:
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)",
                        user_id, role_id, current_user.user_id
                    )
            
            # Log audit event
            await log_audit_event(
                user_id=str(current_user.user_id) if current_user.user_id else None,
                username=current_user.username,
                action_type="CREATE",
                entity_type="USER",
                entity_id=str(user_id),
                status="SUCCESS",
                severity="WARNING"
            )

            return UserResponse(
                id=user_id,
                username=data.username,
                email=data.email,
                full_name=data.full_name,
                is_active=True,
                roles=[] # Fetching roles requires another query, simplifying for now
            )

@router.patch("/api/v1/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Update user"""
    # Check if modifying own profile or has global manage permission
    has_manage = await has_permission_db(str(current_user.user_id), "users.manage")
    if str(user_id) != str(current_user.user_id) and not has_manage:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    async with get_db().acquire() as conn:
        updates = []
        params = []
        param_idx = 1
        
        if data.full_name is not None:
            updates.append(f"full_name = ${param_idx}")
            params.append(data.full_name)
            param_idx += 1
        if data.email is not None:
            updates.append(f"email = ${param_idx}")
            params.append(data.email)
            param_idx += 1
        if data.is_active is not None:
            if not has_manage:
                raise HTTPException(status_code=403, detail="Only admins can change user status")
            updates.append(f"is_active = ${param_idx}")
            params.append(data.is_active)
            param_idx += 1
        if data.phone is not None:
            updates.append(f"phone = ${param_idx}")
            params.append(data.phone)
            param_idx += 1
        if data.department is not None:
            updates.append(f"department = ${param_idx}")
            params.append(data.department)
            param_idx += 1
        if data.password is not None:
             updates.append(f"password_hash = ${param_idx}")
             params.append(get_password_hash(data.password))
             param_idx += 1
             
        if updates:
            params.append(user_id)
            await conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = ${param_idx}",
                *params
            )
            
        # Update roles (users.manage only)
        if data.role_ids is not None and has_manage:
            async with conn.transaction():
                # ── LAST SUPER_ADMIN PROTECTION ──
                # If we are removing SUPER_ADMIN from this user, check that at least
                # one other user still holds it.
                old_roles = await conn.fetch(
                    "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=$1",
                    user_id
                )
                old_role_names = {row['name'] for row in old_roles}
                new_role_ids_set = set(data.role_ids)
                super_admin_role_ids = await _get_super_admin_role_ids(conn)
                if super_admin_role_ids:
                    was_super = bool(old_role_names.intersection(SUPER_ADMIN_ROLE_ALIASES))
                    will_be_super = bool(new_role_ids_set.intersection(super_admin_role_ids))
                    if was_super and not will_be_super:
                        other_admins = await conn.fetchval(
                            "SELECT COUNT(*) FROM user_roles WHERE role_id = ANY($1::uuid[]) AND user_id != $2",
                            list(super_admin_role_ids), user_id
                        )
                        if other_admins == 0:
                            raise HTTPException(
                                status_code=400,
                                detail="Cannot remove the last SUPER_ADMIN role. Assign another user first."
                            )

                await conn.execute("DELETE FROM user_roles WHERE user_id = $1", user_id)
                for role_id in data.role_ids:
                    await conn.execute(
                        "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)",
                        user_id, role_id, current_user.user_id
                    )

            # ── Audit log: role change ──
            await log_audit_event(
                user_id=str(current_user.user_id) if current_user.user_id else None,
                username=current_user.username,
                action_type="ROLE_CHANGE",
                entity_type="USER",
                entity_id=str(user_id),
                status="SUCCESS",
                severity="WARNING",
                details={"old_roles": list(old_role_names), "new_role_ids": [str(r) for r in data.role_ids]}
            )

            # ── Invalidate permission cache ──
            await clear_user_permission_cache(str(user_id))

        return {"message": "User updated successfully"}

@router.delete("/api/v1/users/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: TokenData = Depends(require_permission("users.manage"))
):
    """Delete (soft-delete) a user"""
    async with get_db().acquire() as conn:
        # Prevent deleting yourself
        if str(user_id) == str(current_user.user_id):
            raise HTTPException(status_code=400, detail="Cannot delete your own account")

        # Prevent deleting the last SUPER_ADMIN
        super_admin_role_ids = await _get_super_admin_role_ids(conn)
        if super_admin_role_ids:
            is_super = await conn.fetchval(
                "SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = ANY($2::uuid[])",
                user_id, list(super_admin_role_ids)
            )
            if is_super:
                other_admins = await conn.fetchval(
                    "SELECT COUNT(*) FROM user_roles WHERE role_id = ANY($1::uuid[]) AND user_id != $2",
                    list(super_admin_role_ids), user_id
                )
                if other_admins == 0:
                    raise HTTPException(status_code=400, detail="Cannot delete the last SUPER_ADMIN user")

        # Soft delete: deactivate and mark
        await conn.execute(
            "UPDATE users SET is_active = false WHERE id = $1", user_id
        )

        await log_audit_event(
            user_id=str(current_user.user_id) if current_user.user_id else None,
            username=current_user.username,
            action_type="DELETE",
            entity_type="USER",
            entity_id=str(user_id),
            status="SUCCESS",
            severity="CRITICAL"
        )

    return {"message": "User deleted successfully"}

@router.post("/api/v1/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    data: dict,
    current_user: TokenData = Depends(require_permission("users.manage"))
):
    """Reset a user's password (admin action)"""
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    async with get_db().acquire() as conn:
        password_hash = get_password_hash(new_password)
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            password_hash, user_id
        )

        await log_audit_event(
            user_id=str(current_user.user_id) if current_user.user_id else None,
            username=current_user.username,
            action_type="PASSWORD_RESET",
            entity_type="USER",
            entity_id=str(user_id),
            status="SUCCESS",
            severity="CRITICAL"
        )

    return {"message": "Password reset successfully"}

import shutil
import os
from fastapi import UploadFile, File

@router.post("/api/v1/users/{user_id}/avatar")
async def upload_user_avatar(
    user_id: UUID,
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Upload a profile picture avatar"""
    has_manage = await has_permission_db(str(current_user.user_id), "users.manage")
    if str(user_id) != str(current_user.user_id) and not has_manage:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, GIF, WEBP allowed.")

    # Create avatars directory if it doesn't exist
    upload_dir = "/app/uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save file securely
    file_extension = file.filename.split(".")[-1]
    safe_filename = f"{user_id}_{int(datetime.now().timestamp())}.{file_extension}"
    file_location = os.path.join(upload_dir, safe_filename)
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    avatar_url = f"/uploads/avatars/{safe_filename}"
    
    async with get_db().acquire() as conn:
        await conn.execute("UPDATE users SET avatar_url = $1 WHERE id = $2", avatar_url, user_id)
        
    return {"message": "Avatar uploaded successfully", "avatar_url": avatar_url}

@router.delete("/api/v1/users/{user_id}/avatar")
async def delete_user_avatar(
    user_id: UUID,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a profile picture avatar"""
    has_manage = await has_permission_db(str(current_user.user_id), "users.manage")
    if str(user_id) != str(current_user.user_id) and not has_manage:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    async with get_db().acquire() as conn:
        # Get current avatar url to delete file
        user = await conn.fetchrow("SELECT avatar_url FROM users WHERE id = $1", user_id)
        if user and user['avatar_url']:
            # Example path: /uploads/avatars/filename.jpg
            filename = user['avatar_url'].split('/')[-1]
            file_path = os.path.join("/app/uploads/avatars", filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                
        # Remove from db
        await conn.execute("UPDATE users SET avatar_url = NULL WHERE id = $1", user_id)
        
    return {"message": "Avatar deleted successfully"}

@router.get("/api/v1/roles")
async def list_roles(current_user: TokenData = Depends(require_permission("roles.manage"))):
    """List all roles"""
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM roles ORDER BY name")
        items = []
        for row in rows:
            item = dict(row)
            item['id'] = str(item['id'])
            item['created_at'] = item['created_at'].isoformat()
            items.append(item)
        return items

@router.post("/api/v1/roles")
async def create_role(
    data: RoleCreate,
    current_user: TokenData = Depends(require_permission("roles.manage"))
):
    """Create new role"""
        
    async with get_db().acquire() as conn:
        try:
            async with conn.transaction():
                role_id = await conn.fetchval(
                    "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id",
                    data.name, data.description
                )
                
                for perm_id in data.permission_ids:
                    await conn.execute(
                        "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                        role_id, perm_id
                    )
                    
                # Log audit event
                await log_audit_event(
                    user_id=str(current_user.user_id) if current_user.user_id else None,
                    username=current_user.username,
                    action_type="CREATE",
                    entity_type="ROLE",
                    entity_id=str(role_id),
                    status="SUCCESS",
                    severity="WARNING"
                )
                
                return {"id": str(role_id), "name": data.name}
        except asyncpg.exceptions.UniqueViolationError:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Role with name '{data.name}' already exists")

@router.get("/api/v1/permissions")
async def list_permissions(current_user: TokenData = Depends(require_permission("roles.manage"))):
    """List all available permissions"""
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM permissions ORDER BY module_name, action_type")
        items = []
        for row in rows:
            item = dict(row)
            item['id'] = str(item['id'])
            items.append(item)
        return items
