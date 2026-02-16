-- Add facility_milestone_id to case_flags so delays can be associated with
-- specific milestones in the inline timeline UI.
-- Nullable: threshold flags don't need a milestone (they derive it from flag_rules),
-- and legacy delay flags may not have one.

ALTER TABLE case_flags
  ADD COLUMN IF NOT EXISTS facility_milestone_id UUID
    REFERENCES facility_milestones(id);

CREATE INDEX IF NOT EXISTS idx_case_flags_facility_milestone_id
  ON case_flags(facility_milestone_id)
  WHERE facility_milestone_id IS NOT NULL;
