-- Voice command logs table for persisting voice command history per case
-- Enables post-case review and analytics on voice command accuracy
CREATE TABLE IF NOT EXISTS voice_command_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    command_text TEXT NOT NULL,
    matched_milestone_id UUID REFERENCES facility_milestones(id),
    confidence_level TEXT NOT NULL,  -- 'high', 'medium', 'low', 'none'
    outcome TEXT NOT NULL,           -- 'recorded', 'pending', 'rejected', 'cancelled', 'timeout', 'unrecognized'
    source_text TEXT,                -- Raw speech-to-text transcription
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policy
ALTER TABLE voice_command_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage voice logs for their facility"
    ON voice_command_logs FOR ALL
    USING (facility_id IN (SELECT facility_id FROM users WHERE id = auth.uid()));

-- Index for querying logs per case
CREATE INDEX IF NOT EXISTS idx_voice_command_logs_case_id ON voice_command_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_voice_command_logs_facility_id ON voice_command_logs(facility_id);
