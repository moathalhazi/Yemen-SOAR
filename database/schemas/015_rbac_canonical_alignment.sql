-- ========================================
-- Phase 1.2: Canonical RBAC Alignment
-- Stabilizes legacy/demo environments after the RBAC rebuild.
-- ========================================

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_action_type_check;

-- Canonical roles expected by the gateway and admin UI
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Full system administration access'),
    ('SOC_L1_ANALYST', 'Level 1 analyst for alert triage'),
    ('SOC_L2_ANALYST', 'Level 2 analyst for investigation and response'),
    ('SOC_L3_ANALYST', 'Level 3 analyst for advanced response and containment'),
    ('AUTOMATION_ENGINEER', 'Playbook and integration engineer'),
    ('INCIDENT_MANAGER', 'Incident oversight and reporting'),
    ('AUDITOR', 'Read-only audit and compliance reviewer')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Map legacy roles to canonical equivalents so existing users keep access
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, target_role.id
FROM user_roles ur
JOIN roles legacy_role ON legacy_role.id = ur.role_id
JOIN roles target_role ON target_role.name = CASE legacy_role.name
    WHEN 'super_admin' THEN 'SUPER_ADMIN'
    WHEN 'Administrator' THEN 'SUPER_ADMIN'
    WHEN 'soar_admin' THEN 'SUPER_ADMIN'
    WHEN 'soc_analyst_l1' THEN 'SOC_L1_ANALYST'
    WHEN 'soc_analyst_l2' THEN 'SOC_L2_ANALYST'
    WHEN 'soc_analyst_l3' THEN 'SOC_L3_ANALYST'
    WHEN 'automation_engineer' THEN 'AUTOMATION_ENGINEER'
    WHEN 'incident_manager' THEN 'INCIDENT_MANAGER'
    WHEN 'security_auditor' THEN 'AUDITOR'
    ELSE NULL
END
WHERE legacy_role.name IN (
    'super_admin',
    'Administrator',
    'soar_admin',
    'soc_analyst_l1',
    'soc_analyst_l2',
    'soc_analyst_l3',
    'automation_engineer',
    'incident_manager',
    'security_auditor'
)
ON CONFLICT DO NOTHING;

-- Ensure all currently referenced permission keys exist
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

-- Clear stale mappings for canonical roles before reseeding them
DELETE FROM role_permissions
WHERE role_id IN (
    SELECT id FROM roles
    WHERE name IN (
        'SUPER_ADMIN',
        'SOC_L1_ANALYST',
        'SOC_L2_ANALYST',
        'SOC_L3_ANALYST',
        'AUTOMATION_ENGINEER',
        'INCIDENT_MANAGER',
        'AUDITOR'
    )
);

-- SUPER_ADMIN gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- SOC_L1_ANALYST
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'alerts.read',
    'alerts.update',
    'alerts.escalate',
    'incidents.read',
    'incidents.create',
    'playbooks.read',
    'playbooks.execute',
    'notifications.view'
)
WHERE r.name = 'SOC_L1_ANALYST'
ON CONFLICT DO NOTHING;

-- SOC_L2_ANALYST
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'alerts.read',
    'alerts.update',
    'alerts.close',
    'alerts.escalate',
    'incidents.read',
    'incidents.create',
    'incidents.update',
    'incidents.assign',
    'playbooks.read',
    'playbooks.execute',
    'evidence.read',
    'evidence.upload',
    'notifications.view',
    'threat_intel.view'
)
WHERE r.name = 'SOC_L2_ANALYST'
ON CONFLICT DO NOTHING;

-- SOC_L3_ANALYST
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'alerts.read',
    'alerts.update',
    'alerts.close',
    'alerts.escalate',
    'incidents.read',
    'incidents.create',
    'incidents.update',
    'incidents.assign',
    'incidents.close',
    'playbooks.read',
    'playbooks.execute',
    'evidence.read',
    'evidence.upload',
    'notifications.view',
    'notifications.send',
    'threat_intel.view',
    'threat_intel.manage'
)
WHERE r.name = 'SOC_L3_ANALYST'
ON CONFLICT DO NOTHING;

-- AUTOMATION_ENGINEER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'playbooks.read',
    'playbooks.execute',
    'playbooks.manage',
    'notifications.view',
    'notifications.send',
    'system.manage',
    'threat_intel.view'
)
WHERE r.name = 'AUTOMATION_ENGINEER'
ON CONFLICT DO NOTHING;

-- INCIDENT_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'alerts.read',
    'incidents.read',
    'incidents.update',
    'incidents.assign',
    'incidents.close',
    'playbooks.read',
    'playbooks.execute',
    'evidence.read',
    'reports.read',
    'reports.generate',
    'reports.export',
    'compliance.view',
    'notifications.view',
    'notifications.send',
    'threat_intel.view'
)
WHERE r.name = 'INCIDENT_MANAGER'
ON CONFLICT DO NOTHING;

-- AUDITOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
    'dashboard.view',
    'alerts.read',
    'incidents.read',
    'playbooks.read',
    'evidence.read',
    'reports.read',
    'reports.export',
    'audit_logs.read',
    'compliance.view',
    'notifications.view',
    'threat_intel.view'
)
WHERE r.name = 'AUDITOR'
ON CONFLICT DO NOTHING;
