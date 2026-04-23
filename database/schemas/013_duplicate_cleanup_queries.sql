-- ========================================
-- SOAR Pro - Phase 6: Duplicate Detection
-- ========================================
-- Generates reports for any existing duplicates in the system

-- 1. Find Duplicate Users (by username)
SELECT username, COUNT(*) as copies 
FROM users 
GROUP BY username 
HAVING COUNT(*) > 1;

-- 2. Find Duplicate Roles (by name)
SELECT name, COUNT(*) as copies 
FROM roles 
GROUP BY name 
HAVING COUNT(*) > 1;

-- 3. Find Duplicate Permissions (by permission_key)
SELECT permission_key, COUNT(*) as copies 
FROM permissions 
GROUP BY permission_key 
HAVING COUNT(*) > 1;

-- 4. Find Duplicate User-Role Assignments
SELECT user_id, role_id, COUNT(*) as copies 
FROM user_roles 
GROUP BY user_id, role_id 
HAVING COUNT(*) > 1;

-- 5. Find Duplicate Role-Permission Assignments
SELECT role_id, permission_id, COUNT(*) as copies 
FROM role_permissions 
GROUP BY role_id, permission_id 
HAVING COUNT(*) > 1;
