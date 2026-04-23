// User types
export interface User {
    id: string;
    username: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    is_superuser: boolean;
    mfa_enabled: boolean;
    created_at: string;
    last_login: string | null;
    roles: Role[];
    permissions: string[];
    phone?: string;
    department?: string;
    avatar_url?: string;
    login_count?: number;
    playbooks_authored?: number;
    incidents_resolved?: number;
}

export interface Role {
    id: string;
    name: string;
    description: string | null;
}

// Alert types
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'new' | 'in_progress' | 'resolved' | 'false_positive' | 'duplicate';

export interface AlertIndicators {
    ips: string[];
    domains: string[];
    hashes: string[];
    urls: string[];
    emails: string[];
}

export interface AffectedAsset {
    type: string;
    identifier: string;
    criticality: number;
}

export interface Alert {
    id: string;
    source_id: string;
    source_name: string;
    external_id: string | null;
    received_at: string;
    occurred_at: string;
    severity: AlertSeverity;
    category: string | null;
    alert_type: string | null;
    title: string;
    description: string | null;
    status: AlertStatus;
    assigned_to: string | null;
    incident_id: string | null;
    affected_assets: AffectedAsset[];
    indicators: AlertIndicators;
    ai_classification: string | null;
    ai_confidence: number | null;
    ai_priority_score: number | null;
    tags: string[];
    created_at: string;
    updated_at: string;
}

// Incident types
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'eradicated' | 'recovered' | 'closed';

export interface Incident {
    id: string;
    incident_number: number;
    title: string;
    description: string | null;
    severity: IncidentSeverity;
    category: string | null;
    incident_type: string | null;
    status: IncidentStatus;
    assigned_to: string | null;
    team: string | null;
    detected_at: string;
    started_at: string | null;
    contained_at: string | null;
    eradicated_at: string | null;
    recovered_at: string | null;
    closed_at: string | null;
    mttd_seconds: number | null;
    mttr_seconds: number | null;
    mtte_seconds: number | null;
    affected_systems: object[];
    affected_users: object[];
    impact_assessment: string | null;
    business_impact: string | null;
    evidence_collected: boolean;
    evidence_ids: string[];
    playbook_id: string | null;
    root_cause: string | null;
    attack_vector: string | null;
    mitre_techniques: string[];
    tags: string[];
    priority: number;
    escalated: boolean;
    false_positive: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface IncidentTimeline {
    id: string;
    incident_id: string;
    timestamp: string;
    event_type: string;
    title: string;
    description: string | null;
    user_id: string | null;
    automated: boolean;
    metadata: object | null;
}

// Playbook types
export interface Playbook {
    id: string;
    name: string;
    description: string | null;
    version: string;
    trigger_conditions: object | null;
    workflow: object;
    requires_approval: boolean;
    approval_roles: string[];
    timeout_seconds: number;
    max_retries: number;
    is_active: boolean;
    is_template: boolean;
    category: string | null;
    tags: string[];
    mitre_techniques: string[];
    execution_count: number;
    success_count: number;
    failure_count: number;
    last_executed: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface PlaybookExecution {
    id: string;
    playbook_id: string;
    incident_id: string | null;
    alert_id: string | null;
    status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'awaiting_approval';
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    requires_approval: boolean;
    approved_by: string | null;
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    error_message: string | null;
}

// Evidence types
export type EvidenceType = 'memory_dump' | 'disk_image' | 'network_capture' | 'logs' | 'file';
export type EvidenceStatus = 'collected' | 'analyzing' | 'analyzed' | 'archived' | 'deleted';

export interface Evidence {
    id: string;
    evidence_number: number;
    incident_id: string | null;
    alert_id: string | null;
    type: EvidenceType;
    category: string | null;
    collected_from: string;
    collected_at: string;
    collected_by: string | null;
    collection_method: string | null;
    storage_path: string;
    file_name: string | null;
    file_size: number | null;
    compressed: boolean;
    encrypted: boolean;
    md5_hash: string | null;
    sha256_hash: string | null;
    description: string | null;
    tags: string[];
    retention_until: string | null;
    status: EvidenceStatus;
    created_at: string;
    updated_at: string;
}

export interface ChainOfCustody {
    id: string;
    evidence_id: string;
    timestamp: string;
    action: string;
    actor_id: string | null;
    actor_name: string | null;
    actor_ip: string | null;
    location: string | null;
    system: string | null;
    hash_before: string | null;
    hash_after: string | null;
    integrity_verified: boolean | null;
    digital_signature: string | null;
    purpose: string | null;
    notes: string | null;
}

// Dashboard types
export interface DashboardStats {
    total_alerts: number;
    alerts_by_severity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    alerts_by_status: {
        new: number;
        in_progress: number;
        resolved: number;
    };
    open_incidents: number;
    active_playbooks: number;
    pending_evidence: number;
    mttd_avg: number;
    mttr_avg: number;
}

export interface AlertSource {
    id: string;
    name: string;
    type: string;
    vendor: string | null;
    is_active: boolean;
    total_alerts_received: number;
    last_pull: string | null;
    created_at: string;
}

// API Response types
export interface ApiResponse<T> {
    data: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// Auth types
export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: User;
}

// Report types
export type ReportFormat = 'pdf' | 'html' | 'docx' | 'csv';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface Report {
    id: string;
    name: string;
    format: ReportFormat;
    status: ReportStatus;
    file_path: string | null;
    file_size: number | null;
    generated_by: string;
    generated_at: string;
    date_range_start: string;
    date_range_end: string;
    include_alerts: boolean;
    include_incidents: boolean;
    include_audit_logs: boolean;
    download_url: string | null;
    created_at: string;
    data?: any;
    metadata?: any;
}

// Audit Log types
export type AuditAction =
    | 'login'
    | 'logout'
    | 'alert_view'
    | 'alert_update'
    | 'incident_create'
    | 'incident_update'
    | 'playbook_execute'
    | 'report_generate'
    | 'user_create'
    | 'user_update'
    | 'settings_change';

export type AuditStatus = 'SUCCESS' | 'FAILED';
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditLog {
    id: string;
    timestamp: string;
    user_id: string | null;
    username: string;
    action_type: string;
    entity_type: string;
    entity_id: string | null;
    ip_address: string | null;
    status: AuditStatus;
    severity: AuditSeverity;
    user_agent: string | null;
    details: Record<string, unknown> | null;
}

// System Health types
export interface SystemHealthMetric {
    name: string;
    value: number;
    max: number;
    unit: string;
    status: 'healthy' | 'warning' | 'critical';
    icon: string;
}

// Compliance types
export interface ComplianceControl {
    id: string;
    framework_id: string;
    control_id: string;
    title: string;
    description: string;
    status: 'compliant' | 'non_compliant' | 'not_applicable';
    evidence_required: boolean;
    evidence_provided: boolean;
    last_assessed: string | null;
}

export interface ComplianceFramework {
    id: string;
    name: string;
    version: string;
    description: string;
    total_controls: number;
    passed_controls: number;
    score_percentage: number;
    controls: ComplianceControl[];
}
