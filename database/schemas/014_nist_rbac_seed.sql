-- ========================================
-- Phase 1.1: NIST-Aligned RBAC Implementation
-- ========================================

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_action_type_check;

-- 1. Ensure NIST-exact roles exist
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Full Control'),
    ('SOC_L1_ANALYST', 'L1 Analyst'),
    ('SOC_L2_ANALYST', 'L2 Analyst'),
    ('INCIDENT_MANAGER', 'Incident Manager'),
    ('AUDITOR', 'Auditor')
ON CONFLICT (name) DO NOTHING;

-- Map existing super admin users to SUPER_ADMIN to avoid lockout
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM roles WHERE name = 'SUPER_ADMIN')
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name IN ('super_admin', 'Administrator')
ON CONFLICT DO NOTHING;

-- Map l1 analyst to SOC_L1_ANALYST
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM roles WHERE name = 'SOC_L1_ANALYST')
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name IN ('soc_analyst_l1')
ON CONFLICT DO NOTHING;

-- Map l2 analyst to SOC_L2_ANALYST
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM roles WHERE name = 'SOC_L2_ANALYST')
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name IN ('soc_analyst_l2')
ON CONFLICT DO NOTHING;

-- Map admin to INCIDENT_MANAGER
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, (SELECT id FROM roles WHERE name = 'INCIDENT_MANAGER')
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE r.name IN ('incident_manager')
ON CONFLICT DO NOTHING;

-- 2. Clear out all previous permissions to start fresh and perfectly compliant
DELETE FROM role_permissions;
DELETE FROM permissions;

-- 3. Seed exact granular permissions
INSERT INTO permissions (permission_key, module_name, action_type, description) VALUES
    ('dashboard.view', 'dashboard', 'view', 'View dashboard metrics'),
    ('alerts.read', 'alerts', 'read', 'Read alerts'),
    ('alerts.update', 'alerts', 'update', 'Update alerts'),
    ('alerts.escalate', 'alerts', 'escalate', 'Escalate alerts'),
    ('alerts.close', 'alerts', 'close', 'Close alerts'),
    ('incidents.read', 'incidents', 'read', 'Read incidents'),
    ('incidents.create', 'incidents', 'create', 'Create incidents'),
    ('incidents.update', 'incidents', 'update', 'Update incidents'),
    ('incidents.assign', 'incidents', 'assign', 'Assign incidents'),
    ('incidents.close', 'incidents', 'close', 'Close incidents'),
    ('playbooks.read', 'playbooks', 'read', 'Read playbooks'),
    ('playbooks.execute', 'playbooks', 'execute', 'Execute playbooks'),
    ('playbooks.manage', 'playbooks', 'manage', 'Modify playbook workflows'),
    ('evidence.read', 'evidence', 'read', 'Read evidence'),
    ('evidence.upload', 'evidence', 'upload', 'Upload evidence'),
    ('evidence.delete', 'evidence', 'delete', 'Delete evidence'),
    ('reports.read', 'reports', 'read', 'Read reports'),
    ('reports.generate', 'reports', 'generate', 'Generate reports'),
    ('reports.export', 'reports', 'export', 'Export reports'),
    ('users.manage', 'users', 'manage', 'Manage users'),
    ('roles.manage', 'roles', 'manage', 'Manage roles'),
    ('system.settings.manage', 'system', 'manage', 'Manage system settings'),
    ('audit_logs.read', 'audit_logs', 'read', 'Read audit logs');

-- 4. Map Permissions precisely according to the Matrix

-- ===================================
-- SUPER_ADMIN
-- ===================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN';

-- ===================================
-- SOC_L1_ANALYST
-- ===================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SOC_L1_ANALYST'
  AND p.permission_key IN (
      'dashboard.view',
      'alerts.read',
      'alerts.update',
      'alerts.escalate',
      'incidents.create',
      'incidents.read',
      'playbooks.read',
      'playbooks.execute'
  );

-- ===================================
-- SOC_L2_ANALYST
-- ===================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SOC_L2_ANALYST'
  AND p.permission_key IN (
      'dashboard.view',
      'alerts.read',
      'alerts.update',
      'alerts.close',
      'alerts.escalate',
      'incidents.read',
      'incidents.update',
      'incidents.assign',
      'incidents.create',
      'playbooks.read',
      'playbooks.execute',
      'evidence.read',
      'evidence.upload'
  );

-- ===================================
-- INCIDENT_MANAGER
-- ===================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'INCIDENT_MANAGER'
  AND p.permission_key IN (
      'dashboard.view',
      'incidents.read',
      'incidents.assign',
      'incidents.update',
      'incidents.close',
      'reports.generate',
      'reports.read',
      'reports.export',
      'playbooks.read',
      'playbooks.execute',
      'alerts.read',
      'evidence.read'
  );

-- ===================================
-- AUDITOR
-- ===================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'AUDITOR'
  AND p.permission_key IN (
      'dashboard.view',
      'audit_logs.read',
      'reports.read',
      'reports.export',
      'incidents.read',
      'alerts.read',
      'evidence.read',
      'playbooks.read'
  );
