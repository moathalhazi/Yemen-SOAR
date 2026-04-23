-- ========================================
-- SOAR Pro - Alerts Schema
-- ========================================

-- ========================================
-- Alert Sources Table
-- ========================================
CREATE TABLE alert_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'siem', 'edr', 'firewall', 'email', 'custom'
    vendor VARCHAR(100), -- 'sophos', 'splunk', 'qradar', etc.
    connection_config JSONB,
    is_active BOOLEAN DEFAULT true,
    last_pull TIMESTAMP WITH TIME ZONE,
    total_alerts_received BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Alerts Table
-- ========================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source information
    source_id UUID REFERENCES alert_sources(id),
    source_name VARCHAR(100) NOT NULL,
    external_id VARCHAR(255), -- Original ID from source system
    
    -- Timing
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Classification
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    category VARCHAR(100), -- MITRE ATT&CK technique or custom category
    alert_type VARCHAR(100),
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'false_positive', 'duplicate'
    assigned_to UUID REFERENCES users(id),
    incident_id UUID, -- Will link to incidents table
    
    -- Affected assets
    affected_assets JSONB, -- Array of {type, identifier, criticality}
    
    -- Indicators of Compromise (IOCs)
    indicators JSONB, -- {ips: [], domains: [], hashes: [], urls: [], emails: []}
    
    -- Enrichment data
    enrichment JSONB, -- Threat intel, asset context, user context
    
    -- AI/ML classification
    ai_classification VARCHAR(50), -- 'benign', 'suspicious', 'malicious', 'critical'
    ai_confidence DECIMAL(5, 2), -- 0.00 to 100.00
    ai_priority_score INTEGER, -- 0-100
    risk_score FLOAT,
    risk_level VARCHAR(50),
    threat_confidence FLOAT,
    mitre_tactics JSONB,
    mitre_techniques JSONB,
    similar_incidents UUID[], -- Array of similar incident IDs
    
    -- Raw data
    raw_data JSONB,
    
    -- Metadata
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES alerts(id),
    correlation_key VARCHAR(255), -- For grouping similar alerts
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('new', 'in_progress', 'resolved', 'false_positive', 'duplicate'))
);

-- ========================================
-- Alert History (State changes)
-- ========================================
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    comment TEXT
);

-- ========================================
-- Alert Comments
-- ========================================
CREATE TABLE alert_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Alert Attachments
-- ========================================
CREATE TABLE alert_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX idx_alerts_source ON alerts(source_id);
CREATE INDEX idx_alerts_received_at ON alerts(received_at DESC);
CREATE INDEX idx_alerts_occurred_at ON alerts(occurred_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_assigned_to ON alerts(assigned_to);
CREATE INDEX idx_alerts_incident_id ON alerts(incident_id);
CREATE INDEX idx_alerts_correlation_key ON alerts(correlation_key);
CREATE INDEX idx_alerts_ai_priority ON alerts(ai_priority_score DESC);

-- GIN index for JSONB columns
CREATE INDEX idx_alerts_indicators ON alerts USING GIN (indicators);
CREATE INDEX idx_alerts_affected_assets ON alerts USING GIN (affected_assets);
CREATE INDEX idx_alerts_enrichment ON alerts USING GIN (enrichment);

-- Full-text search index
CREATE INDEX idx_alerts_fulltext ON alerts USING GIN (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

CREATE INDEX idx_alert_history_alert ON alert_history(alert_id);
CREATE INDEX idx_alert_comments_alert ON alert_comments(alert_id);
CREATE INDEX idx_alert_attachments_alert ON alert_attachments(alert_id);

-- ========================================
-- Triggers
-- ========================================
CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_sources_updated_at
    BEFORE UPDATE ON alert_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create alert history on update
CREATE OR REPLACE FUNCTION create_alert_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO alert_history (alert_id, field_name, old_value, new_value)
        VALUES (NEW.id, 'status', OLD.status, NEW.status);
    END IF;
    
    -- Log severity changes
    IF OLD.severity IS DISTINCT FROM NEW.severity THEN
        INSERT INTO alert_history (alert_id, field_name, old_value, new_value)
        VALUES (NEW.id, 'severity', OLD.severity, NEW.severity);
    END IF;
    
    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO alert_history (alert_id, field_name, old_value, new_value)
        VALUES (NEW.id, 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_history_trigger
    AFTER UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION create_alert_history();

-- Default Data removed to database/seeds/

-- ========================================
-- Materialized View for Alert Statistics
-- ========================================
CREATE MATERIALIZED VIEW alert_statistics AS
SELECT
    DATE(received_at) as date,
    source_name,
    severity,
    status,
    COUNT(*) as count,
    AVG(ai_priority_score) as avg_priority
FROM alerts
GROUP BY DATE(received_at), source_name, severity, status;

CREATE INDEX idx_alert_stats_date ON alert_statistics(date DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_alert_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY alert_statistics;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Comments
-- ========================================
COMMENT ON TABLE alerts IS 'Security alerts from all integrated sources';
COMMENT ON TABLE alert_sources IS 'Configuration for alert sources (SIEM, EDR, etc.)';
COMMENT ON TABLE alert_history IS 'Audit trail of alert state changes';
COMMENT ON COLUMN alerts.ai_priority_score IS 'AI-calculated priority (0-100, higher = more critical)';
COMMENT ON COLUMN alerts.similar_incidents IS 'Array of UUIDs for similar historical incidents';
