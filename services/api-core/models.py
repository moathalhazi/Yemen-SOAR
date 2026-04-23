"""
SOAR Pro — API Core SQLAlchemy Models
Complete ORM models for Alerts, Incidents, Evidence, Playbooks, and Chain of Custody.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import (
    String, Text, Integer, BigInteger, Boolean, Float,
    DateTime, ForeignKey, Index, JSON, Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, INET

from database import Base


# ── Helper ──────────────────────────────────────────
def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


# ════════════════════════════════════════════════════
# ALERTS
# ════════════════════════════════════════════════════

class AlertSource(Base):
    __tablename__ = "alert_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor: Mapped[Optional[str]] = mapped_column(String(100))
    connection_config: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_pull: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_alerts_received: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)

    # Source
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("alert_sources.id"))
    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Timing
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Classification
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # low, medium, high, critical
    category: Mapped[Optional[str]] = mapped_column(String(100))
    alert_type: Mapped[Optional[str]] = mapped_column(String(100))

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Status
    status: Mapped[str] = mapped_column(String(50), default="new")
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("incidents.id"))

    # Assets & IOCs
    affected_assets: Mapped[Optional[dict]] = mapped_column(JSONB)
    indicators: Mapped[Optional[dict]] = mapped_column(JSONB)
    enrichment: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Risk scoring
    risk_score: Mapped[Optional[float]] = mapped_column(Float)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    threat_confidence: Mapped[Optional[float]] = mapped_column(Float)

    # AI/ML
    ai_classification: Mapped[Optional[str]] = mapped_column(String(50))
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float)
    ai_priority_score: Mapped[Optional[int]] = mapped_column(Integer)

    # MITRE ATT&CK
    mitre_tactics: Mapped[Optional[list]] = mapped_column(JSONB)
    mitre_techniques: Mapped[Optional[list]] = mapped_column(JSONB)

    # Deduplication
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_of: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    correlation_key: Mapped[Optional[str]] = mapped_column(String(255))

    # Raw
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    incident: Mapped[Optional["Incident"]] = relationship(back_populates="alerts")

    __table_args__ = (
        Index("idx_alerts_severity", "severity"),
        Index("idx_alerts_status", "status"),
        Index("idx_alerts_received", "received_at"),
        Index("idx_alerts_risk", "risk_score"),
    )


# ════════════════════════════════════════════════════
# INCIDENTS
# ════════════════════════════════════════════════════

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    incident_number: Mapped[int] = mapped_column(Integer, unique=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    incident_type: Mapped[Optional[str]] = mapped_column(String(100))

    status: Mapped[str] = mapped_column(String(50), default="open")
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    team: Mapped[Optional[str]] = mapped_column(String(100))
    priority: Mapped[int] = mapped_column(Integer, default=3)

    # Timeline
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    contained_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Metrics
    mttd_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    mttr_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    # Impact
    affected_systems: Mapped[Optional[dict]] = mapped_column(JSONB)
    business_impact: Mapped[Optional[str]] = mapped_column(String(50))

    # Response
    containment_actions: Mapped[Optional[dict]] = mapped_column(JSONB)
    root_cause: Mapped[Optional[str]] = mapped_column(Text)
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text)

    # MITRE
    mitre_techniques: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    attack_vector: Mapped[Optional[str]] = mapped_column(String(200))

    # Playbook
    playbook_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    playbook_execution_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    # Evidence
    evidence_collected: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_score: Mapped[Optional[float]] = mapped_column(Float)

    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    false_positive: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    alerts: Mapped[List["Alert"]] = relationship(back_populates="incident")
    evidence_items: Mapped[List["Evidence"]] = relationship(back_populates="incident")
    timeline: Mapped[List["IncidentTimeline"]] = relationship(back_populates="incident")

    __table_args__ = (
        Index("idx_incidents_status", "status"),
        Index("idx_incidents_severity", "severity"),
        Index("idx_incidents_detected", "detected_at"),
    )


class IncidentTimeline(Base):
    __tablename__ = "incident_timeline"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    incident_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    automated: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB)

    incident: Mapped["Incident"] = relationship(back_populates="timeline")


# ════════════════════════════════════════════════════
# PLAYBOOKS
# ════════════════════════════════════════════════════

class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[str] = mapped_column(String(20), default="1.0")

    trigger_conditions: Mapped[Optional[dict]] = mapped_column(JSONB)
    workflow: Mapped[dict] = mapped_column(JSONB, nullable=False)

    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=3600)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped[Optional[str]] = mapped_column(String(100))
    mitre_techniques: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String))

    execution_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    last_executed: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class PlaybookExecution(Base):
    __tablename__ = "playbook_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    playbook_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("playbooks.id"))
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("incidents.id"))
    alert_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)

    input_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    output_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    total_steps: Mapped[Optional[int]] = mapped_column(Integer)
    completed_steps: Mapped[int] = mapped_column(Integer, default=0)
    failed_steps: Mapped[int] = mapped_column(Integer, default=0)

    initiated_by_system: Mapped[Optional[str]] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PlaybookExecutionStep(Base):
    __tablename__ = "playbook_execution_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    execution_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("playbook_executions.id", ondelete="CASCADE"))
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    input_params: Mapped[Optional[dict]] = mapped_column(JSONB)
    output_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)


# ════════════════════════════════════════════════════
# EVIDENCE & CHAIN OF CUSTODY
# ════════════════════════════════════════════════════

class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    evidence_number: Mapped[int] = mapped_column(Integer, unique=True, autoincrement=True)
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("incidents.id"))
    alert_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))

    collected_from: Mapped[Optional[str]] = mapped_column(String(255))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    collection_method: Mapped[Optional[str]] = mapped_column(String(100))

    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger)
    compressed: Mapped[bool] = mapped_column(Boolean, default=False)
    encrypted: Mapped[bool] = mapped_column(Boolean, default=True)

    md5_hash: Mapped[Optional[str]] = mapped_column(String(32))
    sha256_hash: Mapped[Optional[str]] = mapped_column(String(64))

    description: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    status: Mapped[str] = mapped_column(String(50), default="collected")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    incident: Mapped[Optional["Incident"]] = relationship(back_populates="evidence_items")
    custody_chain: Mapped[List["ChainOfCustody"]] = relationship(back_populates="evidence")


class ChainOfCustody(Base):
    __tablename__ = "chain_of_custody"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    evidence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("evidence.id", ondelete="CASCADE"))

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    actor_name: Mapped[Optional[str]] = mapped_column(String(255))
    actor_ip: Mapped[Optional[str]] = mapped_column(String(45))

    location: Mapped[Optional[str]] = mapped_column(String(255))
    system: Mapped[Optional[str]] = mapped_column(String(255))

    hash_before: Mapped[Optional[str]] = mapped_column(String(64))
    hash_after: Mapped[Optional[str]] = mapped_column(String(64))
    integrity_verified: Mapped[Optional[bool]] = mapped_column(Boolean)

    digital_signature: Mapped[Optional[str]] = mapped_column(Text)
    purpose: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB)

    evidence: Mapped["Evidence"] = relationship(back_populates="custody_chain")


# ════════════════════════════════════════════════════
# NOTIFICATIONS
# ════════════════════════════════════════════════════

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(500))
    body: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="sent")
    alert_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
