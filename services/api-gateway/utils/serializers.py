"""
SOAR Pro — Shared Serialization & Query Utilities
Eliminates duplicated UUID/datetime conversion and filter-building code
across all gateway routers.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID


def serialize_row(row) -> Dict[str, Any]:
    """
    Convert an asyncpg Record (or dict) into a JSON-safe dict.
    Handles UUID → str and datetime → ISO 8601 conversion.
    """
    if row is None:
        return {}
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, UUID):
            data[key] = str(value)
        elif isinstance(value, datetime):
            data[key] = value.isoformat()
    return data


def serialize_rows(rows) -> List[Dict[str, Any]]:
    """Convert a list of asyncpg Records to JSON-safe dicts."""
    return [serialize_row(r) for r in rows]


def build_where_clause(
    filters: Dict[str, Any],
    start_idx: int = 1,
) -> Tuple[str, List[Any], int]:
    """
    Build a parameterized WHERE clause from a dict of filters.
    Skips None/empty values.

    Returns:
        (where_sql, params, next_idx)
        where_sql includes 'WHERE' prefix if any filters are applied.
    """
    clauses = []
    params = []
    idx = start_idx

    for column, value in filters.items():
        if value is None or value == "":
            continue
        clauses.append(f"{column} = ${idx}")
        params.append(value)
        idx += 1

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, params, idx


def build_date_range_clause(
    date_from: Optional[str],
    date_to: Optional[str],
    column: str = "timestamp",
    start_idx: int = 1,
) -> Tuple[str, List[Any], int]:
    """
    Build date range filter clauses.
    Returns (clauses_list_str, params, next_idx).
    """
    clauses = []
    params = []
    idx = start_idx

    if date_from:
        clauses.append(f"{column} >= ${idx}::timestamptz")
        params.append(date_from)
        idx += 1
    if date_to:
        clauses.append(f"{column} <= ${idx}::timestamptz")
        params.append(date_to)
        idx += 1

    return " AND ".join(clauses), params, idx


async def get_user_profile_row(conn, user_id: str):
    """
    Shared user profile query with roles and permissions.
    Used by /auth/me, /auth/login, and /users endpoints.
    """
    return await conn.fetchrow("""
        WITH user_roles_agg AS (
            SELECT ur.user_id,
                   COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
                   COALESCE(array_agg(DISTINCT r.id)   FILTER (WHERE r.id IS NOT NULL), '{}')   AS role_ids
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1::uuid
            GROUP BY ur.user_id
        ),
        user_perms_agg AS (
            SELECT ur.user_id,
                   COALESCE(array_agg(DISTINCT p.permission_key) FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
            FROM user_roles ur
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = $1::uuid
            GROUP BY ur.user_id
        )
        SELECT
            u.id, u.username, u.email, u.full_name,
            u.is_active, u.phone, u.department, u.avatar_url,
            u.login_count, u.last_login, u.mfa_enabled, u.mfa_secret,
            COALESCE(ura.roles, '{}') AS roles,
            COALESCE(upa.permissions, '{}') AS permissions,
            (SELECT COUNT(*) FROM playbooks WHERE created_by = u.id) AS playbooks_authored,
            (SELECT COUNT(*) FROM incidents WHERE assigned_to = u.id AND status IN ('closed', 'resolved')) AS incidents_resolved
        FROM users u
        LEFT JOIN user_roles_agg ura ON ura.user_id = u.id
        LEFT JOIN user_perms_agg upa ON upa.user_id = u.id
        WHERE u.id = $1::uuid
    """, user_id)
