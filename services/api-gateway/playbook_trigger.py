"""
SOAR Pro — Playbook Trigger Engine
Deterministic rule-based system to match incidents to playbooks.
"""

import logging
import json
from typing import Dict, Any, Optional

from utils.db import get_db

logger = logging.getLogger(__name__)


async def evaluate_triggers(incident: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Find a matching playbook for the given incident.

    Match priority:
      1. incident_type exact match
      2. category match via trigger_conditions
      3. Severity-gate: only trigger if severity meets threshold

    Returns the matching playbook row or None.
    """
    incident_type = (incident.get("incident_type") or "").lower().strip()
    category = (incident.get("category") or "").lower().strip()
    severity = (incident.get("severity") or "medium").lower()

    pool = get_db()
    async with pool.acquire() as conn:
        # 1. Exact match on incident_type
        if incident_type:
            row = await conn.fetchrow("""
                SELECT * FROM playbooks
                WHERE incident_type = $1 AND is_active = true AND execution_mode = 'AUTO'
                LIMIT 1
            """, incident_type)
            if row:
                # Check severity gate from trigger_conditions
                if _passes_severity_gate(row, severity):
                    logger.info(f"Trigger match: incident_type='{incident_type}' → playbook '{row['name']}'")
                    return dict(row)

        # 2. Category match via trigger_conditions.categories
        if category:
            rows = await conn.fetch("""
                SELECT * FROM playbooks
                WHERE is_active = true AND execution_mode = 'AUTO'
                  AND trigger_conditions IS NOT NULL
                ORDER BY created_at ASC
            """)
            for row in rows:
                tc = row["trigger_conditions"]
                if isinstance(tc, str):
                    tc = json.loads(tc)
                categories = [c.lower() for c in tc.get("categories", [])]
                if category in categories and _passes_severity_gate(row, severity):
                    logger.info(f"Trigger match: category='{category}' → playbook '{row['name']}'")
                    return dict(row)

    logger.debug(f"No playbook trigger matched for incident_type='{incident_type}', category='{category}'")
    return None


def _passes_severity_gate(playbook_row, severity: str) -> bool:
    """Check if the incident severity meets the playbook's minimum threshold."""
    tc = playbook_row.get("trigger_conditions")
    if not tc:
        return True

    if isinstance(tc, str):
        tc = json.loads(tc)

    min_severity = tc.get("min_severity")
    if not min_severity:
        return True

    sev_order = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    return sev_order.get(severity, 2) >= sev_order.get(min_severity.lower(), 1)


async def auto_trigger_on_incident(incident_id: str, incident_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Called when an incident is created or updated.
    If a matching AUTO playbook is found, it is executed.

    Returns the execution summary or None.
    """
    from playbook_engine import execute_playbook

    playbook = await evaluate_triggers(incident_data)
    if not playbook:
        return None

    logger.info(f"Auto-triggering playbook '{playbook['name']}' for incident {incident_id}")

    result = await execute_playbook(
        playbook_id=str(playbook["id"]),
        incident_id=incident_id,
        initiated_by=None,
        initiated_by_system="auto",
    )

    return result
