-- Seed default incident response playbooks

INSERT INTO playbooks (name, description, category, trigger_conditions, workflow) VALUES
    ('Phishing Response', 'Automated response to phishing alerts — extract IOCs, block sender, notify SOC', 'phishing',
     '{"categories": ["phishing", "spear_phishing", "credential_phishing"], "min_risk_score": 50}',
     '{"steps": [{"name": "Extract IOCs from email", "action": "extract_iocs", "params": {}}, {"name": "Block sender domain", "action": "block_domain", "params": {}}, {"name": "Search mailboxes for similar emails", "action": "search_mailboxes", "params": {}}, {"name": "Notify SOC team", "action": "notify", "params": {"channel": "slack"}}, {"name": "Create incident", "action": "create_incident", "params": {}}]}'
    ),
    ('Malware Containment', 'Isolate infected hosts, collect forensic evidence, block hashes', 'malware',
     '{"categories": ["malware", "ransomware", "trojan", "worm", "virus"], "min_risk_score": 60}',
     '{"steps": [{"name": "Isolate affected host", "action": "isolate_host", "params": {}}, {"name": "Block malicious hashes", "action": "block_hash", "params": {}}, {"name": "Trigger forensic collection", "action": "collect_forensic", "params": {}}, {"name": "Scan endpoints for indicators", "action": "endpoint_scan", "params": {}}, {"name": "Notify security team", "action": "notify", "params": {"channel": "email"}}]}'
    ),
    ('Brute Force Response', 'Block attacking IP, lock targeted account, alert security team', 'brute_force',
     '{"categories": ["brute_force", "credential_stuffing", "password_spray"], "min_risk_score": 55}',
     '{"steps": [{"name": "Block source IP", "action": "block_ip", "params": {}}, {"name": "Lock targeted account", "action": "disable_user", "params": {}}, {"name": "Enable enhanced logging", "action": "enable_logging", "params": {}}, {"name": "Alert security team", "action": "notify", "params": {"channel": "slack"}}]}'
    ),
    ('Data Exfiltration Response', 'Block external transfers, preserve network logs, notify DPO', 'data_exfiltration',
     '{"categories": ["data_exfiltration", "data_leak", "insider_threat"], "min_risk_score": 70}',
     '{"steps": [{"name": "Block external data transfers", "action": "block_transfer", "params": {}}, {"name": "Preserve network logs", "action": "preserve_logs", "params": {}}, {"name": "Trigger forensic collection", "action": "collect_forensic", "params": {}}, {"name": "Notify Data Protection Officer", "action": "notify", "params": {"channel": "email", "recipient": "dpo"}}, {"name": "Create critical incident", "action": "create_incident", "params": {"severity": "critical"}}]}'
    )
ON CONFLICT (name) DO NOTHING;
