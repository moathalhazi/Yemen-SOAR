-- ========================================
-- SOAR Pro - Phase 1: RBAC Rebuild
-- ========================================

-- 1. Drop old role_permissions and permissions tables 
-- (Ensures clean slate for the new schema)
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- 2. Create new permissions table based on the new requirements
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('create', 'read', 'update', 'delete', 'execute', 'manage')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recreate role_permissions with proper CASCADE rules
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- Note: `user_roles` already has ON DELETE CASCADE from 001_users.sql
-- Note: `roles` already has UNIQUE constraint on `name` from 001_users.sql

-- 4. Seed new standard base permissions
INSERT INTO permissions (permission_key, module_name, action_type, description) VALUES
    ('alerts.read', 'alerts', 'read', 'View security alerts'),
    ('alerts.update', 'alerts', 'update', 'Modify alert status and severity'),
    ('incidents.read', 'incidents', 'read', 'View incidents'),
    ('incidents.create', 'incidents', 'create', 'Create new incidents'),
    ('incidents.update', 'incidents', 'update', 'Modify incident details/status'),
    ('incidents.delete', 'incidents', 'delete', 'Delete incidents'),
    ('playbooks.read', 'playbooks', 'read', 'View playbooks'),
    ('playbooks.create', 'playbooks', 'create', 'Create new playbooks'),
    ('playbooks.update', 'playbooks', 'update', 'Modify playbooks'),
    ('playbooks.delete', 'playbooks', 'delete', 'Delete playbooks'),
    ('playbooks.execute', 'playbooks', 'execute', 'Execute playbooks'),
    ('users.read', 'users', 'read', 'View user list and details'),
    ('users.manage', 'users', 'manage', 'Create, update, delete users and roles'),
    ('system.audit_logs.read', 'system', 'read', 'View system audit logs'),
    ('system.settings.manage', 'system', 'manage', 'Modify system settings'),
    ('evidence.read', 'evidence', 'read', 'View evidence files'),
    ('evidence.create', 'evidence', 'create', 'Upload evidence'),
    ('evidence.delete', 'evidence', 'delete', 'Delete evidence files');

-- 5. Map permissions to existing 'super_admin' role (Full access)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Map basic read permissions to analyst roles (L1, L2, L3)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name IN ('soc_analyst_l1', 'soc_analyst_l2', 'soc_analyst_l3')
  AND p.action_type IN ('read')
ON CONFLICT DO NOTHING;

-- Map additional execution permissions to L2/L3
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.name IN ('soc_analyst_l2', 'soc_analyst_l3')
  AND p.module_name IN ('incidents', 'alerts', 'playbooks')
  AND p.action_type IN ('update', 'execute')
ON CONFLICT DO NOTHING;
