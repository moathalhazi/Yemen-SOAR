-- Insert Sophos as primary alert source
INSERT INTO alert_sources (name, type, vendor, connection_config, is_active) VALUES
    ('Sophos Central', 'edr', 'sophos', 
     '{"api_host": "https://api.central.sophos.com", "pull_interval": 60}', 
     true),
    ('Sophos Firewall', 'firewall', 'sophos',
     '{"firewall_host": "", "port": 4444}',
     true),
    ('Generic Syslog', 'siem', 'generic',
     '{"protocol": "UDP", "port": 514}',
     true)
ON CONFLICT (name) DO NOTHING;

-- Default Escalation Rules
INSERT INTO escalation_rules (name, description, severity_trigger, timeout_minutes, escalation_levels) VALUES
    ('Critical Alert Escalation', 'Automatic escalation for critical alerts', 'critical', 15, 
     '[{"level": 1, "timeout": 15, "contacts": "soc-lead"}, {"level": 2, "timeout": 30, "contacts": "security-manager"}, {"level": 3, "timeout": 45, "contacts": "ciso"}]'::jsonb),
    ('High Alert Escalation', 'Automatic escalation for high severity alerts', 'high', 30,
     '[{"level": 1, "timeout": 30, "contacts": "soc-team"}, {"level": 2, "timeout": 60, "contacts": "security-manager"}]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Default TI Sources
INSERT INTO ti_feed_sources (name, source_type, url, priority, rate_limit) VALUES
    ('VirusTotal', 'api', 'https://www.virustotal.com/api/v3', 100, 4),
    ('AlienVault OTX', 'api', 'https://otx.alienvault.com/api/v1', 90, 100),
    ('AbuseIPDB', 'api', 'https://api.abuseipdb.com/api/v2', 85, 100),
    ('MISP', 'misp', NULL, 95, 60)
ON CONFLICT (name) DO NOTHING;
