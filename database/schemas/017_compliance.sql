-- ========================================
-- SOAR Pro — Compliance Framework Schema
-- ========================================

-- Compliance Frameworks
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Controls
CREATE TABLE IF NOT EXISTS compliance_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    check_type VARCHAR(50) DEFAULT 'auto',   -- 'auto', 'manual'
    check_query TEXT,                         -- SQL query or key for auto-check
    evidence_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(framework_id, control_id)
);

-- Compliance Assessments (point-in-time results)
CREATE TABLE IF NOT EXISTS compliance_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id UUID REFERENCES compliance_controls(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'not_applicable',
    evidence_provided BOOLEAN DEFAULT false,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assessed_by UUID REFERENCES users(id),
    notes TEXT,
    CONSTRAINT valid_compliance_status CHECK (status IN ('compliant', 'non_compliant', 'not_applicable'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_framework ON compliance_assessments(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_control ON compliance_assessments(control_id);

-- Trigger
CREATE TRIGGER update_compliance_frameworks_updated_at
    BEFORE UPDATE ON compliance_frameworks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Seed: NIST CSF 2.0 Framework
-- ========================================
INSERT INTO compliance_frameworks (name, version, description) VALUES
('NIST CSF 2.0', '2.0', 'NIST Cybersecurity Framework — Identify, Protect, Detect, Respond, Recover, Govern')
ON CONFLICT (name) DO NOTHING;

INSERT INTO compliance_controls (framework_id, control_id, title, description, category, check_type, check_query, evidence_required) VALUES
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'GV.OC-01', 'Organizational Context', 'The organizational mission is understood and informs cybersecurity risk management', 'Govern', 'auto', 'config_exists', false),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'ID.AM-01', 'Asset Management', 'Inventories of hardware, software, services, and data are managed', 'Identify', 'auto', 'has_integrations', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'ID.RA-01', 'Risk Assessment', 'Vulnerabilities in assets are identified, validated, and recorded', 'Identify', 'auto', 'has_threat_intel', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'PR.AA-01', 'Access Control', 'Identities and credentials for authorized users are managed', 'Protect', 'auto', 'has_rbac', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'PR.AA-03', 'Authentication', 'Users, services, and hardware proven authentic', 'Protect', 'auto', 'has_mfa_capable', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'PR.DS-01', 'Data Security', 'Data-at-rest is protected', 'Protect', 'auto', 'has_encryption', false),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'PR.PS-01', 'Platform Security', 'Configuration management practices are established', 'Protect', 'auto', 'has_configurations', false),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'DE.CM-01', 'Continuous Monitoring', 'Networks and network services are monitored for anomalies', 'Detect', 'auto', 'has_active_alerts', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'DE.AE-02', 'Adverse Event Analysis', 'Potentially adverse events are analyzed to characterize them', 'Detect', 'auto', 'has_ai_analysis', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'DE.AE-06', 'Alert Correlation', 'Information is correlated from multiple sources', 'Detect', 'auto', 'has_multiple_sources', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'RS.MA-01', 'Incident Management', 'Incident response plan is executed once an incident is declared', 'Respond', 'auto', 'has_incidents', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'RS.MA-02', 'Incident Analysis', 'Incident reports are triaged and validated', 'Respond', 'auto', 'has_playbooks', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'RS.AN-03', 'Forensic Analysis', 'Forensic investigation activities are performed', 'Respond', 'auto', 'has_forensics', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'RS.CO-02', 'Reporting', 'Internal and external stakeholders are notified of incidents', 'Respond', 'auto', 'has_reports', true),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'RC.RP-01', 'Recovery Planning', 'Recovery plan is executed during or after an incident', 'Recover', 'auto', 'has_playbooks', false),
((SELECT id FROM compliance_frameworks WHERE name = 'NIST CSF 2.0'), 'GV.AU-01', 'Audit Logging', 'System activity is logged and monitored', 'Govern', 'auto', 'has_audit_logs', true)
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- ========================================
-- Seed: ISO 27001:2022 Framework
-- ========================================
INSERT INTO compliance_frameworks (name, version, description) VALUES
('ISO 27001:2022', '2022', 'Information Security Management System — Annex A Controls')
ON CONFLICT (name) DO NOTHING;

INSERT INTO compliance_controls (framework_id, control_id, title, description, category, check_type, check_query, evidence_required) VALUES
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.1', 'Information Security Policies', 'Policies for information security are defined and approved', 'Organizational', 'auto', 'config_exists', false),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.15', 'Access Control', 'Access to information and assets is restricted', 'Organizational', 'auto', 'has_rbac', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.23', 'Cloud Security', 'Cloud services usage processes are established', 'Organizational', 'auto', 'has_integrations', false),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.28', 'Evidence Collection', 'Procedures for identification and preservation of evidence', 'Organizational', 'auto', 'has_forensics', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.8.5', 'Secure Authentication', 'Secure authentication technologies are implemented', 'Technological', 'auto', 'has_mfa_capable', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.8.15', 'Logging', 'Logs that record activities and events are produced and stored', 'Technological', 'auto', 'has_audit_logs', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.8.16', 'Monitoring', 'Networks, systems, and applications are monitored for anomalous behavior', 'Technological', 'auto', 'has_active_alerts', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.24', 'Incident Management Planning', 'Approach to managing information security incidents is planned', 'Organizational', 'auto', 'has_playbooks', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.25', 'Incident Assessment', 'Information security events are assessed and classified', 'Organizational', 'auto', 'has_incidents', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.26', 'Incident Response', 'Information security incidents are responded to', 'Organizational', 'auto', 'has_incidents', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.5.7', 'Threat Intelligence', 'Information about threats is collected and analysed', 'Organizational', 'auto', 'has_threat_intel', true),
((SELECT id FROM compliance_frameworks WHERE name = 'ISO 27001:2022'), 'A.8.24', 'Cryptography', 'Rules for effective use of cryptography are defined', 'Technological', 'auto', 'has_encryption', false)
ON CONFLICT (framework_id, control_id) DO NOTHING;

COMMENT ON TABLE compliance_frameworks IS 'Compliance framework definitions (NIST CSF, ISO 27001, etc.)';
COMMENT ON TABLE compliance_controls IS 'Individual controls within a compliance framework';
COMMENT ON TABLE compliance_assessments IS 'Point-in-time assessment results for compliance controls';
