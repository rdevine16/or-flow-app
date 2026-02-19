-- Drop cases.scheduled_duration_minutes
-- All application code now reads surgeon_procedure_duration and
-- procedure_types.expected_duration_minutes directly.
ALTER TABLE cases DROP COLUMN IF EXISTS scheduled_duration_minutes;
