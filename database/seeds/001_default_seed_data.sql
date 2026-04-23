-- ========================================
-- SOAR Pro - Default Seed Data (Canonical RBAC)
-- ========================================

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_action_type_check;

-- Canonical demo roles
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Full system administration access'),
    ('SOC_L1_ANALYST', 'Level 1 analyst for alert triage'),
    ('SOC_L2_ANALYST', 'Level 2 analyst for investigation and response'),
    ('SOC_L3_ANALYST', 'Level 3 analyst for incident response and containment'),
    ('AUTOMATION_ENGINEER', 'Playbook and integration engineer'),
    ('INCIDENT_MANAGER', 'Incident oversight and reporting'),
    ('AUDITOR', 'Read-only audit and compliance reviewer')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Canonical permissions aligned with gateway routes
INSERT INTO permissions (permission_key, module_name, action_type, description) VALUES
    ('dashboard.view', 'dashboard', 'view', 'View dashboard and platform status'),
    ('alerts.read', 'alerts', 'read', 'Read alerts'),
    ('alerts.update', 'alerts', 'update', 'Update alerts'),
    ('alerts.close', 'alerts', 'close', 'Close alerts'),
    ('alerts.escalate', 'alerts', 'escalate', 'Escalate alerts'),
    ('incidents.read', 'incidents', 'read', 'Read incidents'),
    ('incidents.create', 'incidents', 'create', 'Create incidents'),
    ('incidents.update', 'incidents', 'update', 'Update incidents'),
    ('incidents.assign', 'incidents', 'assign', 'Assign incidents'),
    ('incidents.close', 'incidents', 'close', 'Close incidents'),
    ('playbooks.read', 'playbooks', 'read', 'Read playbooks'),
    ('playbooks.execute', 'playbooks', 'execute', 'Execute playbooks'),
    ('playbooks.manage', 'playbooks', 'manage', 'Manage playbooks'),
    ('evidence.read', 'evidence', 'read', 'Read evidence'),
    ('evidence.upload', 'evidence', 'upload', 'Upload or collect evidence'),
    ('evidence.delete', 'evidence', 'delete', 'Delete evidence'),
    ('reports.read', 'reports', 'read', 'Read reports'),
    ('reports.generate', 'reports', 'generate', 'Generate reports'),
    ('reports.export', 'reports', 'export', 'Export reports'),
    ('users.manage', 'users', 'manage', 'Manage users'),
    ('roles.manage', 'roles', 'manage', 'Manage roles and permissions'),
    ('audit_logs.read', 'audit_logs', 'read', 'Read audit logs'),
    ('compliance.view', 'compliance', 'view', 'View compliance posture'),
    ('notifications.view', 'notifications', 'view', 'View notifications'),
    ('notifications.send', 'notifications', 'send', 'Send notifications'),
    ('system.manage', 'system', 'manage', 'Manage system settings'),
    ('system.admin', 'system', 'admin', 'Administrative system operations'),
    ('threat_intel.view', 'threat_intel', 'view', 'View threat intelligence'),
    ('threat_intel.manage', 'threat_intel', 'manage', 'Manage threat intelligence sources')
ON CONFLICT (permission_key) DO UPDATE SET
    module_name = EXCLUDED.module_name,
    action_type = EXCLUDED.action_type,
    description = EXCLUDED.description;

-- Default administrator user (password: Admin123!)
INSERT INTO users (username, email, password_hash, full_name, is_superuser)
VALUES (
    'admin',
    'admin@soarpro.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e',
    'System Administrator',
    true
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'SUPER_ADMIN'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;
