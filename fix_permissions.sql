-- ========================================
-- Insert the newly created endpoint permissions
-- ========================================

INSERT INTO permissions (permission_key, module_name, action_type, description) VALUES
    ('compliance.view', 'compliance', 'view', 'View compliance frameworks and scores'),
    ('system.manage', 'system', 'manage', 'Manage system configurations and backups'),
    ('notifications.view', 'notifications', 'view', 'View notification delivery logs'),
    ('notifications.send', 'notifications', 'send', 'Send manual notifications'),
    ('threat_intel.view', 'threat_intel', 'view', 'View threat indicators and feeds'),
    ('threat_intel.manage', 'threat_intel', 'manage', 'Add or update threat indicators')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all new permissions to the 'soar_admin' role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'soar_admin'
  AND p.permission_key IN (
      'compliance.view', 'system.manage', 'notifications.view',
      'notifications.send', 'threat_intel.view', 'threat_intel.manage'
  )
ON CONFLICT DO NOTHING;
