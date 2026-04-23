-- ========================================
-- SOAR Pro - Incidents and Playbooks Schemas
-- ========================================

-- ========================================
-- Incidents Table
-- ========================================
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    incident_number SERIAL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Classification
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    category VARCHAR(100), -- MITRE ATT&CK tactic
    incident_type VARCHAR(100),
    
    -- Status and assignment
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'
    assigned_to UUID REFERENCES users(id),
    team VARCHAR(100),
    
    -- Timing
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    contained_at TIMESTAMP WITH TIME ZONE,
    eradicated_at TIMESTAMP WITH TIME ZONE,
    recovered_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metrics
    mttd_seconds INTEGER, -- Mean Time to Detect
    mttr_seconds INTEGER, -- Mean Time to Respond
    mtte_seconds INTEGER, -- Mean Time to Eradicate
    
    -- Impact
    affected_systems JSONB, -- Array of affected systems/assets
    affected_users JSONB, -- Array of affected users
    impact_assessment TEXT,
    business_impact VARCHAR(50), -- 'none', 'low', 'medium', 'high', 'critical'
    
    -- Evidence and artifacts
    evidence_collected BOOLEAN DEFAULT false,
    evidence_ids UUID[], -- Array of evidence IDs
    
    -- Response
    containment_actions JSONB,
    eradication_actions JSONB,
    recovery_actions JSONB,
    lessons_learned TEXT,
    
    -- Playbook execution
    playbook_id UUID,
    playbook_execution_id UUID,
    
    -- Root cause
    root_cause TEXT,
    attack_vector VARCHAR(200),
    mitre_techniques TEXT[], -- Array of MITRE ATT&CK technique IDs
    
    -- Metadata
    tags TEXT[],
    priority INTEGER, -- 1-5, 1=highest
    escalated BOOLEAN DEFAULT false,
    false_positive BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_incident_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_incident_status CHECK (status IN ('open', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'))
);

-- ========================================
-- Incident Timeline (Events)
-- ========================================
CREATE TABLE incident_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(100) NOT NULL, -- 'detection', 'action', 'note', 'status_change', 'escalation'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES users(id),
    automated BOOLEAN DEFAULT false,
    metadata JSONB
);

-- ========================================
-- Playbooks Table
-- ========================================
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    
    -- Trigger conditions
    trigger_conditions JSONB, -- JSON logic for when to execute
    
    -- Workflow definition (YAML or JSON)
    workflow JSONB NOT NULL,
    
    -- Configuration
    requires_approval BOOLEAN DEFAULT false,
    approval_roles UUID[], -- Array of role IDs that can approve
    timeout_seconds INTEGER DEFAULT 3600,
    max_retries INTEGER DEFAULT 3,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_executed TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Tags and categories
    category VARCHAR(100), -- 'malware', 'phishing', 'data_breach', etc.
    tags TEXT[],
    mitre_techniques TEXT[]
);

-- ========================================
-- Playbook Executions Table
-- ========================================
CREATE TABLE playbook_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playbook_id UUID REFERENCES playbooks(id),
    incident_id UUID REFERENCES incidents(id),
    alert_id UUID,
    
    -- Execution details
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'cancelled', 'awaiting_approval'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Approval
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_comment TEXT,
    
    -- Execution context
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    
    -- Steps
    total_steps INTEGER,
    completed_steps INTEGER,
    failed_steps INTEGER,
    
    -- Initiated by
    initiated_by UUID REFERENCES users(id),
    initiated_by_system VARCHAR(100), -- 'manual', 'auto', 'api', 'ai'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_execution_status CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'awaiting_approval'))
);

-- ========================================
-- Playbook Execution Steps
-- ========================================
CREATE TABLE playbook_execution_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES playbook_executions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    
    -- Execution
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Data
    input_params JSONB,
    output_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    CONSTRAINT valid_step_status CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped'))
);

-- ========================================
-- Evidence Table
-- ========================================
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    evidence_number SERIAL UNIQUE,
    incident_id UUID REFERENCES incidents(id),
    alert_id UUID,
    
    -- Classification
    type VARCHAR(100) NOT NULL, -- 'memory_dump', 'disk_image', 'network_capture', 'logs', 'file'
    category VARCHAR(100),
    
    -- Collection details
    collected_from VARCHAR(255), -- hostname, IP, etc.
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    collected_by UUID REFERENCES users(id),
    collection_method VARCHAR(100), -- 'automated', 'manual', 'remote'
    
    -- Storage
    storage_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_size BIGINT,
    compressed BOOLEAN DEFAULT false,
    encrypted BOOLEAN DEFAULT true,
    
    -- Integrity
    md5_hash VARCHAR(32),
    sha256_hash VARCHAR(64),
    
    -- Metadata
    description TEXT,
    tags TEXT[],
    retention_until DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'collected', -- 'collected', 'analyzing', 'analyzed', 'archived', 'deleted'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_evidence_status CHECK (status IN ('collected', 'analyzing', 'analyzed', 'archived', 'deleted'))
);

-- ========================================
-- Chain of Custody Table
-- ========================================
CREATE TABLE chain_of_custody (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    
    -- Action details
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    action VARCHAR(100) NOT NULL, -- 'created', 'accessed', 'transferred', 'analyzed', 'stored', 'modified'
    
    -- Actor
    actor_id UUID REFERENCES users(id),
    actor_name VARCHAR(255),
    actor_ip INET,
    
    -- Location
    location VARCHAR(255),
    system VARCHAR(255),
    
    -- Integrity verification
    hash_before VARCHAR(64),
    hash_after VARCHAR(64),
    integrity_verified BOOLEAN,
    
    -- Digital signature
    digital_signature TEXT,
    signature_algorithm VARCHAR(50),
    
    -- Purpose and notes
    purpose TEXT,
    notes TEXT,
    
    -- Metadata
    metadata JSONB
);

-- Make chain of custody immutable
CREATE RULE chain_of_custody_no_update AS ON UPDATE TO chain_of_custody DO INSTEAD NOTHING;
CREATE RULE chain_of_custody_no_delete AS ON DELETE TO chain_of_custody DO INSTEAD NOTHING;

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX idx_incidents_number ON incidents(incident_number);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX idx_incidents_priority ON incidents(priority);

CREATE INDEX idx_incident_timeline_incident ON incident_timeline(incident_id);
CREATE INDEX idx_incident_timeline_timestamp ON incident_timeline(timestamp DESC);

CREATE INDEX idx_playbooks_name ON playbooks(name);
CREATE INDEX idx_playbooks_category ON playbooks(category);
CREATE INDEX idx_playbooks_active ON playbooks(is_active) WHERE is_active = true;

CREATE INDEX idx_playbook_executions_playbook ON playbook_executions(playbook_id);
CREATE INDEX idx_playbook_executions_incident ON playbook_executions(incident_id);
CREATE INDEX idx_playbook_executions_status ON playbook_executions(status);
CREATE INDEX idx_playbook_executions_started ON playbook_executions(started_at DESC);

CREATE INDEX idx_execution_steps_execution ON playbook_execution_steps(execution_id);
CREATE INDEX idx_execution_steps_status ON playbook_execution_steps(status);

CREATE INDEX idx_evidence_incident ON evidence(incident_id);
CREATE INDEX idx_evidence_type ON evidence(type);
CREATE INDEX idx_evidence_collected_at ON evidence(collected_at DESC);

CREATE INDEX idx_custody_evidence ON chain_of_custody(evidence_id);
CREATE INDEX idx_custody_timestamp ON chain_of_custody(timestamp DESC);

-- ========================================
-- Triggers
-- ========================================
CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evidence_updated_at
    BEFORE UPDATE ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to calculate incident metrics
CREATE OR REPLACE FUNCTION calculate_incident_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate MTTD (Mean Time to Detect)
    IF NEW.detected_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.mttd_seconds := EXTRACT(EPOCH FROM (NEW.detected_at - NEW.started_at))::INTEGER;
    END IF;
    
    -- Calculate MTTR (Mean Time to Respond/Contain)
    IF NEW.contained_at IS NOT NULL AND NEW.detected_at IS NOT NULL THEN
        NEW.mttr_seconds := EXTRACT(EPOCH FROM (NEW.contained_at - NEW.detected_at))::INTEGER;
    END IF;
    
    -- Calculate MTTE (Mean Time to Eradicate)
    IF NEW.eradicated_at IS NOT NULL AND NEW.contained_at IS NOT NULL THEN
        NEW.mtte_seconds := EXTRACT(EPOCH FROM (NEW.eradicated_at - NEW.contained_at))::INTEGER;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_metrics_trigger
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION calculate_incident_metrics();

-- Auto-create chain of custody entry when evidence is created
CREATE OR REPLACE FUNCTION create_evidence_custody()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO chain_of_custody (
        evidence_id,
        action,
        actor_id,
        hash_after,
        integrity_verified,
        purpose
    ) VALUES (
        NEW.id,
        'created',
        NEW.collected_by,
        NEW.sha256_hash,
        true,
        'Evidence collected and stored'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_custody_trigger
    AFTER INSERT ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION create_evidence_custody();

-- ========================================
-- Comments
-- ========================================
COMMENT ON TABLE incidents IS 'Security incidents with full lifecycle tracking';
COMMENT ON TABLE playbooks IS 'Automated response playbooks (workflows)';
COMMENT ON TABLE playbook_executions IS 'History of playbook executions';
COMMENT ON TABLE evidence IS 'Digital forensic evidence with integrity tracking';
COMMENT ON TABLE chain_of_custody IS 'Immutable audit trail for evidence handling';
