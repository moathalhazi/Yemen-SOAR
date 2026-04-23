-- Phase 10: Real System Logging & Audit Trail Upgrades

-- Temporarily drop the immutability rule so we can migrate existing data
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;

-- Rename columns
ALTER TABLE audit_logs RENAME COLUMN action TO action_type;
ALTER TABLE audit_logs RENAME COLUMN resource TO entity_type;
ALTER TABLE audit_logs RENAME COLUMN resource_id TO entity_id;

-- Change entity_id type to accommodate non-UUID entities (like system configs or API endpoints)
ALTER TABLE audit_logs ALTER COLUMN entity_id TYPE VARCHAR(255) USING entity_id::VARCHAR;

-- Add new columns
ALTER TABLE audit_logs ADD COLUMN status VARCHAR(20) DEFAULT 'SUCCESS';
ALTER TABLE audit_logs ADD COLUMN severity VARCHAR(20) DEFAULT 'INFO';

-- Migrate existing 'success' boolean to 'status' string
UPDATE audit_logs SET status = CASE WHEN success IS NOT NULL AND NOT success THEN 'FAILED' ELSE 'SUCCESS' END;

-- Drop the old 'success' column
ALTER TABLE audit_logs DROP COLUMN success;

-- Restore the immutability rule
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;

-- Drop old indices if they existed with old names
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_resource;

-- Create new indices
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
