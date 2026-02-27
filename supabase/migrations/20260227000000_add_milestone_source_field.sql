-- Add source field to case_milestones to track how a milestone was recorded
-- Values: 'manual' (default, tap-based), 'voice' (voice command in Room Mode)
ALTER TABLE case_milestones ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add index for analytics queries filtering by source
CREATE INDEX IF NOT EXISTS idx_case_milestones_source ON case_milestones(source);
