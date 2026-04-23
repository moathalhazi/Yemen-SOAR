-- ========================================
-- Reports Table
-- ========================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'compliance',
    format VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    file_path TEXT,
    file_size BIGINT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    date_range_start TIMESTAMP WITH TIME ZONE,
    date_range_end TIMESTAMP WITH TIME ZONE,
    filters JSONB
);

CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at DESC);

-- Drop unused logic if exists
-- DROP TABLE IF EXISTS old_reports;
