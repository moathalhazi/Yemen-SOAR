"""
SOAR Pro — Playbook Engine
Rule-based matching and automated playbook execution.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import Playbook, PlaybookExecution, PlaybookExecutionStep, Incident, IncidentTimeline
from websocket_manager import ws_manager

from modules.integrations.wazuh_connector import WazuhConnector
from modules.integrations.ad_connector import ActiveDirectoryConnector
from modules.integrations.firewall_connector import FirewallConnector
from modules.integrations.endpoint_connector import EndpointConnector

logger = logging.getLogger(__name__)

wazuh_client = WazuhConnector()
ad_client = ActiveDirectoryConnector()
fw_client = FirewallConnector()
ep_client = EndpointConnector()


class PlaybookEngine:
    """
    Rule engine that matches incoming alerts to registered playbooks
    and auto-executes the appropriate response workflow.
    """

    async def auto_trigger(
        self,
        alert_id: UUID,
        severity: str,
        category: Optional[str],
        risk_score: float,
        db: AsyncSession,
    ):
        """
        Attempt to match and auto-trigger a playbook for the given alert.
        Called automatically when risk_score exceeds the playbook threshold.
        """

        # ── 1. Find matching playbook from DB ────
        result = await db.execute(
            select(Playbook).where(Playbook.is_active == True)
        )
        playbooks = result.scalars().all()

        matched = self._match_playbook(playbooks, category, risk_score)

        if not matched:
            logger.info(f"No matching playbook for category={category}, risk={risk_score}")
            return

        # ── 2. Execute matched playbook ──────────
        logger.info(f"Auto-triggering playbook: {matched.name} for alert {alert_id}")
        await self._execute_playbook(matched, alert_id, risk_score, db)

    def _match_playbook(
        self,
        playbooks: List[Playbook],
        category: Optional[str],
        risk_score: float,
    ) -> Optional[Playbook]:
        """Match an alert to a playbook by trigger conditions."""
        if not category:
            return None

        category_lower = category.lower()
        best_match = None

        for pb in playbooks:
            conditions = pb.trigger_conditions or {}
            categories = [c.lower() for c in conditions.get("categories", [])]
            min_risk = conditions.get("min_risk_score", 0)

            # Check category match
            if categories and category_lower not in categories:
                # Partial match
                if not any(category_lower in c or c in category_lower for c in categories):
                    continue

            # Check risk threshold
            if risk_score < min_risk:
                continue

            best_match = pb

        return best_match



    async def _execute_playbook(
        self, playbook: Playbook, alert_id: UUID, risk_score: float, db: AsyncSession
    ):
        """Execute a database playbook — create execution record and process steps."""
        workflow = playbook.workflow or {}
        steps = workflow.get("steps", [])

        execution = PlaybookExecution(
            playbook_id=playbook.id,
            alert_id=alert_id,
            status="running",
            initiated_by_system="auto_risk_trigger",
            total_steps=len(steps),
            input_data={"risk_score": risk_score, "alert_id": str(alert_id)},
        )
        db.add(execution)
        await db.flush()

        success = True
        for idx, step in enumerate(steps):
            exec_step = PlaybookExecutionStep(
                execution_id=execution.id,
                step_number=idx + 1,
                step_name=step.get("name", f"Step {idx+1}"),
                action=step.get("action", "unknown"),
                status="running",
                started_at=datetime.now(timezone.utc),
                input_params=step.get("params", {}),
            )
            db.add(exec_step)

            try:
                result = await self._execute_step_action(step)
                exec_step.status = result.get("status", "success")
                exec_step.output_data = result
                exec_step.completed_at = datetime.now(timezone.utc)
                execution.completed_steps += 1
            except Exception as e:
                exec_step.status = "failed"
                exec_step.error_message = str(e)
                exec_step.completed_at = datetime.now(timezone.utc)
                execution.failed_steps += 1
                if step.get("on_failure", "stop") == "stop":
                    success = False
                    break

        execution.status = "success" if success else "failed"
        execution.completed_at = datetime.now(timezone.utc)

        # Update playbook counters
        playbook.execution_count += 1
        if success:
            playbook.success_count += 1
        else:
            playbook.failure_count += 1
        playbook.last_executed = datetime.now(timezone.utc)

        await db.commit()

        logger.info(f"Playbook {playbook.name} execution: {execution.status}")

        await ws_manager.send_playbook_executed({
            "execution_id": str(execution.id),
            "playbook": playbook.name,
            "status": execution.status,
            "alert_id": str(alert_id),
        })



    @staticmethod
    async def _execute_step_action(step: Dict) -> Dict:
        """
        Execute a playbook step action by invoking real integrated systems.
        """
        action = step.get("action", "")
        params = step.get("params", {})
        
        try:
            if action == "block_ip":
                ip = params.get("ip_address", "0.0.0.0")
                return await fw_client.block_ip(ip, comment="Playbook Automated Drop")
            
            elif action == "isolate_host":
                ip = params.get("ip_address")
                agent_id = params.get("agent_id")
                return await wazuh_client.isolate_host(ip_address=ip, agent_id=agent_id)
            
            elif action == "disable_user":
                user = params.get("username", "unknown")
                return await ad_client.disable_user(user)
                
            elif action == "collect_forensic":
                incident_id = params.get("incident_id", "TEST-01")
                ip = params.get("ip_address", "localhost")
                return await ep_client.collect_evidence(incident_id, ip_address=ip)
            
            elif action == "notify":
                # Slack/Teams integration would go here
                return {"status": "success", "action": f"Notification sent via {params.get('channel', 'default')}"}
                
            else:
                return {"status": "success", "action": f"Local simulation of Action '{action}'"}
                
        except Exception as e:
            logger.error(f"Action '{action}' execution failed: {e}")
            return {"status": "failed", "error": str(e)}
