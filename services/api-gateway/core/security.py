import logging
from typing import List
from utils.db import get_db, get_redis
import json

logger = logging.getLogger(__name__)

async def get_user_permissions(user_id: str) -> List[str]:
    """
    Fetch all valid permission keys for a given user from the database.
    Results are cached in Redis to minimize DB query load.
    """
    redis = get_redis()
    cache_key = f"user_perms:{user_id}"
    
    try:
        cached_perms = await redis.get(cache_key)
        if cached_perms:
            return json.loads(cached_perms)
    except Exception as e:
        logger.warning(f"Redis cache GET error: {e}")

    # Not in cache, query DB
    try:
        pool = get_db()
        async with pool.acquire() as conn:
            query = """
                SELECT DISTINCT p.permission_key
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.user_id = $1
            """
            rows = await conn.fetch(query, user_id)
            perms = [row['permission_key'] for row in rows]
            
            # Cache results for 5 minutes
            try:
                await redis.setex(cache_key, 300, json.dumps(perms))
            except Exception as e:
                logger.warning(f"Redis cache SET error: {e}")
                
            return perms
    except Exception as e:
        logger.error(f"Error fetching user permissions: {e}")
        return []

async def has_permission_db(user_id: str, permission_key: str) -> bool:
    """
    Check if a user has a specific permission by querying the database or cache.
    """
    perms = await get_user_permissions(user_id)
    return permission_key in perms

async def clear_user_permission_cache(user_id: str):
    """
    Clear the cached permissions for a user. Should be called when a user's roles change.
    """
    try:
        redis = get_redis()
        await redis.delete(f"user_perms:{user_id}")
    except Exception as e:
        logger.error(f"Error clearing permission cache: {e}")
