"""
SOAR Pro — Pydantic Schemas (Request/Response DTOs)
Shared data-transfer objects used across all modules.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


# ── Alert Schemas ────────────────────────────────

class AlertCreate(BaseModel):
    source: str = Field(..., min_length=1, description="Alert source identifier")
    external_id: Optional[str] = None
    occurred_at: Optional[str] = None
    severity: str = Field(default="medium", pattern=r"^(low|medium|high|critical)$")
    category: Optional[str] = None
    alert_type: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    affected_assets: List[Dict[str, Any]] = []
    indicators: Dict[str, list] = Field(default_factory=lambda: {
        "ips": [], "domains": [], "hashes": [], "urls": [], "emails": []
    })
    raw_data: Optional[Dict[str, Any]] = None
    tags: List[str] = []


class AlertResponse(BaseModel):
    id: UUID
    source_name: str
    severity: str
    status: str
    title: str
    description: Optional[str]
    risk_score: Optional[float]
    risk_level: Optional[str]
    threat_confidence: Optional[float]
    ai_classification: Optional[str]
    mitre_tactics: Optional[List[str]]
    mitre_techniques: Optional[List[str]]
    indicators: Optional[Dict[str, Any]]
    affected_assets: Optional[List[Dict[str, Any]]]
    received_at: datetime
    occurred_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ── Incident Schemas ─────────────────────────────

class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    category: Optional[str] = None
    priority: int = 3
    alert_ids: List[UUID] = []


class IncidentResponse(BaseModel):
    id: UUID
    incident_number: Optional[int]
    title: str
    severity: str
    status: str
    priority: int
    risk_score: Optional[float]
    evidence_collected: bool
    detected_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ── Risk Score ───────────────────────────────────

class RiskScoreResult(BaseModel):
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: str
    severity_weight: float
    asset_criticality: float
    threat_confidence: float
    should_trigger_playbook: bool
    should_trigger_forensic: bool
    formula: str = "Risk = Severity × Asset Criticality × Threat Confidence"


# ── Playbook Schemas ─────────────────────────────

class PlaybookCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_conditions: Optional[Dict[str, Any]] = None
    workflow: Dict[str, Any]
    category: Optional[str] = None
    is_active: bool = True


class PlaybookResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    category: Optional[str]
    is_active: bool
    execution_count: int
    success_count: int
    failure_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PlaybookExecutionResponse(BaseModel):
    id: UUID
    playbook_id: UUID
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    total_steps: Optional[int]
    completed_steps: int
    failed_steps: int

    class Config:
        from_attributes = True


# ── Evidence Schemas ─────────────────────────────

class EvidenceResponse(BaseModel):
    id: UUID
    type: str
    sha256_hash: Optional[str]
    status: str
    file_name: Optional[str]
    file_size: Optional[int]
    collected_at: datetime
    integrity_verified: bool = False

    class Config:
        from_attributes = True


# ── WebSocket ────────────────────────────────────

class WSMessage(BaseModel):
    event: str
    data: Dict[str, Any]
    timestamp: str
