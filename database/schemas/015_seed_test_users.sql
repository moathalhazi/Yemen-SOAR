DO $$
DECLARE
    v_l1_role_id UUID;
    v_mgr_role_id UUID;
    v_aud_role_id UUID;
BEGIN
    SELECT id INTO v_l1_role_id FROM roles WHERE name = 'SOC_L1_ANALYST';
    SELECT id INTO v_mgr_role_id FROM roles WHERE name = 'INCIDENT_MANAGER';
    SELECT id INTO v_aud_role_id FROM roles WHERE name = 'AUDITOR';

    -- Upsert Users
    INSERT INTO users (id, username, email, full_name, password_hash, is_active)
    VALUES 
    (gen_random_uuid(), 'l1_analyst', 'l1@soarpro.local', 'L1 Analyst', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true),
    (gen_random_uuid(), 'manager', 'manager@soarpro.local', 'Incident Manager', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true),
    (gen_random_uuid(), 'auditor', 'auditor@soarpro.local', 'Auditor', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true)
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    -- Delete old roles for these test users and Remap Roles
    DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username IN ('l1_analyst', 'manager', 'auditor'));

    INSERT INTO user_roles (user_id, role_id)
    SELECT id, v_l1_role_id FROM users WHERE username = 'l1_analyst';
    
    INSERT INTO user_roles (user_id, role_id)
    SELECT id, v_mgr_role_id FROM users WHERE username = 'manager';
    
    INSERT INTO user_roles (user_id, role_id)
    SELECT id, v_aud_role_id FROM users WHERE username = 'auditor';

END $$;
