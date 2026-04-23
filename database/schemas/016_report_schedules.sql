-- Advanced Reporting System: Report Schedules

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schedule_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    format VARCHAR(20) NOT NULL DEFAULT 'pdf', -- 'pdf', 'csv', 'json', 'html'
    filters JSONB DEFAULT '{}'::jsonb, -- dynamic filters
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = TRUE;
