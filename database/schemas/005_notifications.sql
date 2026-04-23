-- ========================================
-- SOAR Pro - Notification System Schema
-- ========================================

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(500) NOT NULL,
    subject VARCHAR(500),
    body TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    alert_id UUID,
    incident_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_channel CHECK (channel IN ('email', 'slack', 'teams', 'sms', 'webhook')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Escalation Rules Table
CREATE TABLE IF NOT EXISTS escalation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    severity_trigger VARCHAR(50) NOT NULL,
    timeout_minutes INTEGER DEFAULT 15,
    escalation_levels JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_severity_trigger CHECK (severity_trigger IN ('critical', 'high', 'medium', 'low'))
);

-- Escalation Contacts Table
CREATE TABLE IF NOT EXISTS escalation_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    slack_id VARCHAR(100),
    escalation_level INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_escalation_level CHECK (escalation_level BETWEEN 1 AND 5)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_alert ON notification_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_escalation_contacts_level ON escalation_contacts(escalation_level);

-- Default Escalation Rules moved to database/seeds/

-- Comments
COMMENT ON TABLE notification_logs IS 'Log of all notifications sent through the system';
COMMENT ON TABLE escalation_rules IS 'Configurable rules for automatic alert escalation';
COMMENT ON TABLE escalation_contacts IS 'Contact list for escalation notifications';
