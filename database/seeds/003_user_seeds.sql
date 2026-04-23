-- ========================================
-- SOAR Pro - User Seeds
-- ========================================
-- Creates a user for each role for testing purposes.
-- Default Password for all: Admin123!
-- Hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e

-- 1. Insert Users
INSERT INTO users (username, email, password_hash, full_name, is_active) VALUES
    ('admin_user', 'admin@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'System Administrator', true),
    ('l1_analyst', 'l1@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Ahmed Analyst (L1)', true),
    ('l2_analyst', 'l2@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Layla Senior (L2)', true),
    ('l3_analyst', 'l3@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Omar Responder (L3)', true),
    ('auto_eng', 'auto@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Sarah Automation', true),
    ('inc_manager', 'manager@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Khaled Manager', true),
    ('auditor', 'audit@soar.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/uLPL6Y3t9pz.xqJ2e', 'Fatima Auditor', true)
ON CONFLICT (username) DO NOTHING;

-- 2. Assign Roles

-- Admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'admin_user' AND r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- L1 Analyst
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'l1_analyst' AND r.name = 'SOC_L1_ANALYST'
ON CONFLICT DO NOTHING;

-- L2 Analyst
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'l2_analyst' AND r.name = 'SOC_L2_ANALYST'
ON CONFLICT DO NOTHING;

-- L3 Analyst
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'l3_analyst' AND r.name = 'SOC_L3_ANALYST'
ON CONFLICT DO NOTHING;

-- Automation Engineer
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'auto_eng' AND r.name = 'AUTOMATION_ENGINEER'
ON CONFLICT DO NOTHING;

-- Incident Manager
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'inc_manager' AND r.name = 'INCIDENT_MANAGER'
ON CONFLICT DO NOTHING;

-- Auditor
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'auditor' AND r.name = 'AUDITOR'
ON CONFLICT DO NOTHING;
