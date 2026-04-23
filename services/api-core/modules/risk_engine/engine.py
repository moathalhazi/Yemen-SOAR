"""
SOAR Pro — Risk Scoring Engine
Implements: Risk Score = Severity × Asset Criticality × Threat Confidence
Normalized to a 0–100 scale.
"""

import logging
from typing import List, Dict, Any, Optional

from config import settings
from schemas import RiskScoreResult

logger = logging.getLogger(__name__)


class RiskScoringEngine:
    """
    Calculates a dynamic risk score per alert using:

        Risk Score = Severity × Asset Criticality × Threat Confidence
                     ────────────────────────────────────────────────
                                   max_possible × 100

    Where:
        Severity :       {low: 1, medium: 3, high: 7, critical: 10}
        Asset Criticality: highest criticality across affected_assets (1–10, default 5)
        Threat Confidence: AI / TI confidence score (0.0–1.0, default 0.5)

    Output: 0–100 normalized score.
    """

    def __init__(self):
        self._weights = settings.risk.severity_weights
        self._max_severity = max(self._weights.values())         # 10
        self._max_criticality = 10.0
        self._max_confidence = 1.0
        self._max_possible = self._max_severity * self._max_criticality * self._max_confidence  # 100

    def calculate(
        self,
        severity: str,
        affected_assets: List[Dict[str, Any]],
        threat_confidence: Optional[float] = None,
    ) -> RiskScoreResult:
        """
        Calculate risk score and return structured result.
        """

        # ── Severity weight ──────────────────────
        s = self._weights.get(severity.lower(), 3)

        # ── Asset criticality (highest) ──────────
        c = settings.risk.default_asset_criticality
        if affected_assets:
            crits = [
                float(a.get("criticality", settings.risk.default_asset_criticality))
                for a in affected_assets
                if isinstance(a, dict)
            ]
            if crits:
                c = max(crits)
        c = min(max(c, 1.0), 10.0)  # clamp to [1, 10]

        # ── Threat confidence ────────────────────
        t = threat_confidence if threat_confidence is not None else settings.risk.default_threat_confidence
        t = min(max(t, 0.0), 1.0)  # clamp to [0, 1]

        # ── Raw score and normalization ───────────
        raw = s * c * t
        normalized = round((raw / self._max_possible) * 100, 2)
        normalized = min(normalized, 100.0)

        # ── Risk level classification ────────────
        risk_level = self._classify(normalized)

        # ── Threshold checks ─────────────────────
        should_playbook = normalized >= settings.risk.playbook_trigger_threshold
        should_forensic = normalized >= settings.risk.forensic_trigger_threshold

        result = RiskScoreResult(
            risk_score=normalized,
            risk_level=risk_level,
            severity_weight=s,
            asset_criticality=c,
            threat_confidence=t,
            should_trigger_playbook=should_playbook,
            should_trigger_forensic=should_forensic,
        )

        if should_playbook:
            logger.warning(
                f"HIGH RISK: score={normalized:.1f} level={risk_level} "
                f"(S={s} × C={c} × T={t:.2f}) → playbook={should_playbook}, forensic={should_forensic}"
            )

        return result

    @staticmethod
    def _classify(score: float) -> str:
        if score >= 90:
            return "critical"
        elif score >= 75:
            return "high"
        elif score >= 50:
            return "medium"
        elif score >= 25:
            return "low"
        else:
            return "informational"
