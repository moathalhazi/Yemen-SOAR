-- ========================================
-- SOAR Pro — Playbook Engine Upgrade
-- Adds execution_mode, rollback_steps, incident_type
-- and incident-level execution locking
-- ========================================

-- 1. Add execution_mode to playbooks
ALTER TABLE playbooks
    ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(10) DEFAULT 'MANUAL'
        CHECK (execution_mode IN ('AUTO', 'MANUAL'));

-- 2. Add incident_type for trigger matching
ALTER TABLE playbooks
    ADD COLUMN IF NOT EXISTS incident_type VARCHAR(100);

-- 3. Add rollback_steps to playbooks
ALTER TABLE playbooks
    ADD COLUMN IF NOT EXISTS rollback_steps JSONB;

-- 4. Add execution lock columns to incidents
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS execution_lock BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS locked_by_execution UUID;

-- 5. Index for fast trigger lookups
CREATE INDEX IF NOT EXISTS idx_playbooks_incident_type
    ON playbooks(incident_type) WHERE incident_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playbooks_execution_mode
    ON playbooks(execution_mode);

-- 6. Update existing seed playbooks with new fields
UPDATE playbooks SET execution_mode = 'AUTO', incident_type = 'brute_force'
    WHERE category = 'brute_force' AND execution_mode = 'MANUAL';

UPDATE playbooks SET execution_mode = 'AUTO', incident_type = 'malware'
    WHERE category = 'malware' AND execution_mode = 'MANUAL';

UPDATE playbooks SET execution_mode = 'MANUAL', incident_type = 'phishing'
    WHERE category = 'phishing' AND execution_mode = 'MANUAL' AND incident_type IS NULL;

UPDATE playbooks SET execution_mode = 'MANUAL', incident_type = 'data_exfiltration'
    WHERE category = 'data_exfiltration' AND execution_mode = 'MANUAL' AND incident_type IS NULL;

-- 7. Enhanced workflow for Brute Force playbook
UPDATE playbooks SET
    workflow = '{
        "steps": [
            {"name": "Block Source IP", "action": "BLOCK_IP", "params": {"target": "source_ip"}, "timeout": 30, "retry_count": 2, "stop_on_failure": true},
            {"name": "Disable Targeted Account", "action": "DISABLE_USER", "params": {"target": "affected_user"}, "timeout": 30, "retry_count": 1, "stop_on_failure": false},
            {"name": "Force Password Reset", "action": "FORCE_PASSWORD_RESET", "params": {"target": "affected_user"}, "timeout": 30, "retry_count": 1, "stop_on_failure": false},
            {"name": "Enable Enhanced Logging", "action": "ENABLE_LOGGING", "params": {"scope": "authentication"}, "timeout": 15, "retry_count": 1, "stop_on_failure": false},
            {"name": "Notify Security Team", "action": "NOTIFY", "params": {"channel": "slack", "message": "Brute force attack contained"}, "timeout": 10, "retry_count": 2, "stop_on_failure": false}
        ]
    }'::jsonb,
    rollback_steps = '{
        "steps": [
            {"name": "Re-enable User Account", "action": "ENABLE_USER", "params": {"target": "affected_user"}},
            {"name": "Unblock Source IP", "action": "UNBLOCK_IP", "params": {"target": "source_ip"}}
        ]
    }'::jsonb
WHERE category = 'brute_force';

-- 8. Enhanced workflow for Malware playbook
UPDATE playbooks SET
    workflow = '{
        "steps": [
            {"name": "Isolate Affected Host", "action": "ISOLATE_HOST", "params": {"target": "affected_host"}, "timeout": 60, "retry_count": 2, "stop_on_failure": true},
            {"name": "Kill Malicious Process", "action": "KILL_PROCESS", "params": {"target": "malicious_pid"}, "timeout": 30, "retry_count": 1, "stop_on_failure": false},
            {"name": "Block Malicious Hashes", "action": "BLOCK_HASH", "params": {"target": "file_hash"}, "timeout": 30, "retry_count": 2, "stop_on_failure": false},
            {"name": "Trigger Antivirus Scan", "action": "AV_SCAN", "params": {"scope": "full_system"}, "timeout": 120, "retry_count": 1, "stop_on_failure": false},
            {"name": "Collect Forensic Evidence", "action": "COLLECT_FORENSIC", "params": {"type": "memory_dump"}, "timeout": 90, "retry_count": 1, "stop_on_failure": false},
            {"name": "Notify Security Team", "action": "NOTIFY", "params": {"channel": "email", "message": "Malware incident contained"}, "timeout": 10, "retry_count": 2, "stop_on_failure": false}
        ]
    }'::jsonb,
    rollback_steps = '{
        "steps": [
            {"name": "Restore Host Network", "action": "RESTORE_HOST", "params": {"target": "affected_host"}},
            {"name": "Unblock Hashes", "action": "UNBLOCK_HASH", "params": {"target": "file_hash"}}
        ]
    }'::jsonb
WHERE category = 'malware';

COMMENT ON COLUMN playbooks.execution_mode IS 'AUTO = triggered automatically on matching incident, MANUAL = user must click Run';
COMMENT ON COLUMN playbooks.incident_type IS 'Matches against incidents.incident_type for auto-trigger';
COMMENT ON COLUMN playbooks.rollback_steps IS 'Steps to execute if playbook fails mid-execution';
COMMENT ON COLUMN incidents.execution_lock IS 'Prevents parallel playbook execution on the same incident';
