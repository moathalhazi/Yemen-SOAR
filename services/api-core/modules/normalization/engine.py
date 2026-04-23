"""
SOAR Pro — Normalization Engine
Transforms heterogeneous alert formats into a unified internal schema.
"""

import re
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class NormalizationEngine:
    """
    Normalizes raw alert payloads from any source into the SOAR unified schema.
    Handles field mapping, severity standardization, timestamp parsing,
    and IOC extraction.
    """

    # ── Severity normalization map ───────────────
    SEVERITY_MAP = {
        # Standard
        "low": "low", "medium": "medium", "high": "high", "critical": "critical",
        # Numeric
        "1": "low", "2": "medium", "3": "high", "4": "critical", "5": "critical",
        # Syslog / common alternatives
        "info": "low", "informational": "low", "debug": "low",
        "notice": "low", "warning": "medium", "warn": "medium",
        "error": "high", "major": "high", "alert": "critical",
        "emergency": "critical", "fatal": "critical", "urgent": "critical",
    }

    # ── Field name heuristic mapping ─────────────
    FIELD_MAP = {
        "title":       ["title", "name", "alert_name", "summary", "subject", "rule_name", "event_name"],
        "description": ["description", "message", "details", "body", "msg", "event_description"],
        "severity":    ["severity", "risk_level", "priority", "level", "criticality", "alert_severity"],
        "category":    ["category", "type", "event_type", "classification", "tactic", "attack_type"],
        "occurred_at": ["timestamp", "occurred_at", "event_time", "created_at", "time", "date", "@timestamp"],
        "external_id": ["id", "alert_id", "event_id", "external_id", "signature_id", "rule_id"],
        "source":      ["source", "source_name", "origin", "sensor", "detector", "product"],
    }

    # ── IOC regex patterns ───────────────────────
    _IP_RE      = re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b")
    _DOMAIN_RE  = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|gov|edu|mil|co|info|biz|xyz|ru|cn|de|uk|fr)\b", re.I)
    _SHA256_RE  = re.compile(r"\b[a-fA-F0-9]{64}\b")
    _MD5_RE     = re.compile(r"\b[a-fA-F0-9]{32}\b")
    _URL_RE     = re.compile(r"https?://[^\s<>\"']+")
    _EMAIL_RE   = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

    def normalize(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize a raw alert dict into the unified schema.
        Returns a clean dict ready for Alert model creation.
        """
        result = {
            "source": self._extract_field(raw, "source") or "unknown",
            "external_id": self._extract_field(raw, "external_id"),
            "title": self._extract_field(raw, "title") or "Untitled Alert",
            "description": self._extract_field(raw, "description") or "",
            "category": self._extract_field(raw, "category"),
            "alert_type": raw.get("alert_type"),
            "occurred_at": self._normalize_timestamp(self._extract_field(raw, "occurred_at")),
            "severity": self._normalize_severity(self._extract_field(raw, "severity")),
            "affected_assets": self._normalize_assets(raw.get("affected_assets", [])),
            "indicators": self._merge_indicators(
                raw.get("indicators", {}),
                self._extract_iocs(str(raw)),
            ),
            "threat_confidence": raw.get("threat_confidence"),
            "raw_data": raw.get("raw_data", raw),
            "tags": raw.get("tags", []),
        }

        logger.debug(f"Normalized alert: {result['title']} | severity={result['severity']}")
        return result

    # ── Private helpers ──────────────────────────

    def _extract_field(self, raw: dict, unified_name: str) -> Optional[str]:
        """Try multiple field-name candidates to find a value."""
        candidates = self.FIELD_MAP.get(unified_name, [unified_name])
        for key in candidates:
            val = raw.get(key)
            if val is not None and val != "":
                return str(val) if not isinstance(val, str) else val
        return None

    def _normalize_severity(self, raw_sev: Optional[str]) -> str:
        if not raw_sev:
            return "medium"
        return self.SEVERITY_MAP.get(raw_sev.lower().strip(), "medium")

    def _normalize_timestamp(self, ts: Optional[str]) -> str:
        if not ts:
            return datetime.now(timezone.utc).isoformat()

        # Try ISO 8601 first
        for fmt in (
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y/%m/%d %H:%M:%S",
            "%d/%b/%Y:%H:%M:%S %z",
        ):
            try:
                dt = datetime.strptime(ts.strip(), fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.isoformat()
            except ValueError:
                continue

        # Epoch
        try:
            val = float(ts)
            if val > 1e12:
                val /= 1000
            return datetime.fromtimestamp(val, tz=timezone.utc).isoformat()
        except (ValueError, OSError):
            pass

        return ts  # return as-is

    def _normalize_assets(self, assets) -> List[Dict]:
        if not isinstance(assets, list):
            return []
        normalized = []
        for a in assets:
            if isinstance(a, dict):
                normalized.append({
                    "type": a.get("type", "unknown"),
                    "identifier": a.get("identifier", a.get("hostname", a.get("ip", "unknown"))),
                    "criticality": float(a.get("criticality", 5)),
                })
        return normalized

    def _extract_iocs(self, text: str) -> Dict[str, List[str]]:
        """Extract IOCs from the raw text of the alert."""
        return {
            "ips": list(set(self._IP_RE.findall(text))),
            "domains": list(set(self._DOMAIN_RE.findall(text))),
            "hashes": list(set(self._SHA256_RE.findall(text) + self._MD5_RE.findall(text))),
            "urls": list(set(self._URL_RE.findall(text))),
            "emails": list(set(self._EMAIL_RE.findall(text))),
        }

    def _merge_indicators(self, explicit: dict, extracted: dict) -> dict:
        """Merge explicitly provided indicators with auto-extracted ones."""
        merged = {}
        for key in ("ips", "domains", "hashes", "urls", "emails"):
            a = set(explicit.get(key, []))
            b = set(extracted.get(key, []))
            merged[key] = list(a | b)
        return merged
