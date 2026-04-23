UPDATE users 
SET password_hash = '$2b$12$hYyDp8r9IOYun4m8oGELB.2k9XRKiz4XMhS72YwpNQtEr/h0jsMcO' 
WHERE username IN ('admin', 'inc_manager', 'l1_analyst', 'l2_analyst', 'l3_analyst', 'auto_eng', 'auditor');
