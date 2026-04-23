-- ========================================
-- SOAR Pro - Integration Management Schema
-- ========================================

-- ========================================
-- Integrations Table
-- Stores configuration for each external security system
-- ========================================
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,                -- url-safe identifier for webhook routes
    description TEXT,

    -- Integration type
    integration_type VARCHAR(50) NOT NULL,             -- 'webhook', 'syslog', 'rest_pull'
    vendor VARCHAR(100),                               -- 'splunk', 'qradar', 'palo_alto', 'fortinet', 'sophos', etc.
    log_format VARCHAR(50) DEFAULT 'json',             -- 'json', 'cef', 'leef', 'syslog_rfc3164', 'syslog_rfc5424', 'evtx_xml', 'raw'

    -- Connection configuration (encrypted at rest)
    config JSONB NOT NULL DEFAULT '{}',                -- type-specific config (url, port, interval, headers, etc.)

    -- Authentication
    auth_type VARCHAR(50) DEFAULT 'api_key',           -- 'api_key', 'hmac_sha256', 'bearer_token', 'basic', 'none'
    api_key_hash VARCHAR(128),                         -- bcrypt hash of api key (never store plaintext)
    hmac_secret_encrypted TEXT,                        -- AES-256 encrypted HMAC secret
    credentials_encrypted TEXT,                        -- AES-256 encrypted JSON blob for user/pass/token

    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 120,
    rate_limit_burst INTEGER DEFAULT 30,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    health_status VARCHAR(20) DEFAULT 'unknown',       -- 'healthy', 'degraded', 'error', 'unknown'

    -- Scheduling (for rest_pull)
    pull_interval_seconds INTEGER DEFAULT 300,          -- 5 min default
    next_pull_at TIMESTAMP WITH TIME ZONE,

    -- Statistics
    total_alerts_received BIGINT DEFAULT 0,
    total_alerts_failed BIGINT DEFAULT 0,

    -- Metadata
    tags TEXT[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Integration Logs Table
-- Immutable audit log of every ingestion attempt
-- ========================================
CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,

    -- Request metadata
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_ip INET,
    method VARCHAR(10),                               -- 'POST', 'UDP', 'TCP', 'PULL'
    endpoint VARCHAR(255),

    -- Payload
    raw_payload TEXT,                                  -- full raw payload stored before normalization
    payload_size_bytes INTEGER,
    content_type VARCHAR(100),

    -- Processing result
    status VARCHAR(20) NOT NULL DEFAULT 'received',   -- 'received', 'validated', 'normalized', 'forwarded', 'rejected', 'error'
    alert_id UUID,                                    -- resulting alert id after normalization
    error_message TEXT,
    processing_time_ms INTEGER,

    -- Authentication
    auth_method VARCHAR(50),
    auth_valid BOOLEAN,

    -- Metadata
    metadata JSONB
);

-- ========================================
-- Integration Status Table
-- Tracks real-time health for each integration
-- ========================================
CREATE TABLE IF NOT EXISTS integration_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE UNIQUE,

    -- Health
    status VARCHAR(20) DEFAULT 'unknown',             -- 'online', 'offline', 'degraded', 'error'
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    last_successful_ingestion TIMESTAMP WITH TIME ZONE,
    last_failed_ingestion TIMESTAMP WITH TIME ZONE,
    last_error TEXT,

    -- Metrics (rolling 1-hour window)
    alerts_last_hour INTEGER DEFAULT 0,
    errors_last_hour INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    p95_latency_ms DECIMAL(10,2) DEFAULT 0,

    -- Uptime
    uptime_percentage DECIMAL(5,2) DEFAULT 100.0,
    consecutive_failures INTEGER DEFAULT 0,
    max_consecutive_failures INTEGER DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX idx_integrations_slug ON integrations(slug);
CREATE INDEX idx_integrations_type ON integrations(integration_type);
CREATE INDEX idx_integrations_active ON integrations(is_active) WHERE is_active = true;
CREATE INDEX idx_integrations_next_pull ON integrations(next_pull_at) WHERE integration_type = 'rest_pull' AND is_active = true;

CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX idx_integration_logs_timestamp ON integration_logs(timestamp DESC);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_alert ON integration_logs(alert_id);

CREATE INDEX idx_integration_status_integration ON integration_status(integration_id);
CREATE INDEX idx_integration_status_status ON integration_status(status);

-- ========================================
-- Triggers
-- ========================================
CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_status_updated_at
    BEFORE UPDATE ON integration_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Auto-create status row for new integrations
-- ========================================
CREATE OR REPLACE FUNCTION create_integration_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO integration_status (integration_id, status)
    VALUES (NEW.id, 'unknown');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_status_trigger
    AFTER INSERT ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION create_integration_status();

-- ========================================
-- Partitioned log table cleanup policy
-- Automatically drop logs older than 90 days
-- ========================================
CREATE OR REPLACE FUNCTION cleanup_old_integration_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM integration_logs WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Comments
-- ========================================
COMMENT ON TABLE integrations IS 'External security system integration configurations (SIEM, Firewall, EDR, etc.)';
COMMENT ON TABLE integration_logs IS 'Immutable audit log of every alert ingestion attempt with raw payload';
COMMENT ON TABLE integration_status IS 'Real-time health and metrics for each integration';
COMMENT ON COLUMN integrations.slug IS 'URL-safe identifier used in webhook routes: /integrations/webhook/{slug}';
COMMENT ON COLUMN integrations.api_key_hash IS 'Bcrypt hash of the API key — plaintext is never stored';
COMMENT ON COLUMN integrations.hmac_secret_encrypted IS 'AES-256-GCM encrypted HMAC secret for payload verification';
