-- ========================================
-- SOAR Pro - Threat Intelligence Schema
-- ========================================

-- Threat Indicators Table (for historical storage)
CREATE TABLE IF NOT EXISTS threat_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator VARCHAR(1000) NOT NULL,
    indicator_type VARCHAR(50) NOT NULL,
    threat_level VARCHAR(50) DEFAULT 'unknown',
    confidence FLOAT DEFAULT 0.0,
    sources JSONB,
    tags TEXT[] DEFAULT '{}',
    related_malware TEXT[] DEFAULT '{}',
    related_campaigns TEXT[] DEFAULT '{}',
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_indicator UNIQUE (indicator, indicator_type),
    CONSTRAINT valid_indicator_type CHECK (indicator_type IN ('ip', 'domain', 'url', 'md5', 'sha1', 'sha256', 'email', 'cve')),
    CONSTRAINT valid_threat_level CHECK (threat_level IN ('unknown', 'clean', 'suspicious', 'malicious'))
);

-- TI Feed Sources Configuration
CREATE TABLE IF NOT EXISTS ti_feed_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- 'api', 'feed', 'misp'
    url VARCHAR(500),
    api_key_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 50,
    rate_limit INTEGER DEFAULT 60,
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_interval_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TI Lookup History (for audit and analytics)
CREATE TABLE IF NOT EXISTS ti_lookup_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator VARCHAR(1000) NOT NULL,
    indicator_type VARCHAR(50) NOT NULL,
    sources_queried TEXT[],
    threat_level VARCHAR(50),
    cache_hit BOOLEAN DEFAULT false,
    lookup_duration_ms INTEGER,
    requested_by VARCHAR(100),
    alert_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ti_indicator ON threat_indicators(indicator);
CREATE INDEX IF NOT EXISTS idx_ti_type ON threat_indicators(indicator_type);
CREATE INDEX IF NOT EXISTS idx_ti_threat_level ON threat_indicators(threat_level);
CREATE INDEX IF NOT EXISTS idx_ti_updated ON threat_indicators(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_tags ON threat_indicators USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ti_lookup_history_created ON ti_lookup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_lookup_history_indicator ON ti_lookup_history(indicator);

-- Default TI Sources moved to database/seeds/

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ti_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_seen = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ti_update_timestamp ON threat_indicators;
CREATE TRIGGER ti_update_timestamp
    BEFORE UPDATE ON threat_indicators
    FOR EACH ROW EXECUTE FUNCTION update_ti_timestamp();

-- Comments
COMMENT ON TABLE threat_indicators IS 'Stored threat intelligence indicators with aggregated data';
COMMENT ON TABLE ti_feed_sources IS 'Configuration for threat intelligence feed sources';
COMMENT ON TABLE ti_lookup_history IS 'Audit log of all TI lookups performed';
