-- ========================================
-- SOAR Pro - Configurations Schema
-- ========================================

CREATE TABLE configurations (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Trigger to update updated_at
CREATE TRIGGER update_configurations_updated_at
    BEFORE UPDATE ON configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE configurations IS 'System-wide configurations and feature flags';
