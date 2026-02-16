-- ============================================
-- Add phase_group column to facility_milestones
--
-- Enables time allocation bucketing (Pre-Op, Surgical, Closing, Post-Op)
-- for the milestone analytics feature. Nullable — code falls back
-- gracefully if NULL.
--
-- Phase groups inferred from milestone names in data migration below.
-- ============================================

-- 1) Add column (nullable TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facility_milestones'
      AND column_name = 'phase_group'
  ) THEN
    ALTER TABLE public.facility_milestones
      ADD COLUMN phase_group TEXT;
  END IF;
END$$;

-- 2) Add CHECK constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'facility_milestones_phase_group_check'
  ) THEN
    ALTER TABLE public.facility_milestones
      ADD CONSTRAINT facility_milestones_phase_group_check
      CHECK (phase_group IN ('pre_op', 'surgical', 'closing', 'post_op'));
  END IF;
END$$;

-- 3) Data migration: infer phase_group from milestone name
UPDATE public.facility_milestones
SET phase_group = CASE
  WHEN name IN ('patient_in', 'anes_start', 'anes_end', 'prep_drape_start', 'prep_drape_complete')
    THEN 'pre_op'
  WHEN name IN ('incision')
    THEN 'surgical'
  WHEN name IN ('closing', 'closing_complete', 'surgeon_left')
    THEN 'closing'
  WHEN name IN ('patient_out', 'room_cleaned')
    THEN 'post_op'
  ELSE NULL
END
WHERE phase_group IS NULL;

-- 4) Comment for documentation
COMMENT ON COLUMN public.facility_milestones.phase_group IS
  'Time allocation bucket: pre_op, surgical, closing, post_op. Used for milestone analytics time allocation bar.';
