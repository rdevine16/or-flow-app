-- ============================================
-- Fix: Replace trigger_record_case_stats to remove reference to
-- the dropped milestone_type_id column on case_milestones.
--
-- Root cause: trigger_record_case_stats fires AFTER INSERT on
-- case_milestones and contains a fallback:
--
--   IF v_milestone_name IS NULL AND NEW.milestone_type_id IS NOT NULL THEN
--
-- milestone_type_id was DROPPED from case_milestones in v2.0.
-- All milestones now use facility_milestone_id exclusively.
-- The fallback is no longer needed — remove it.
--
-- Error: record "new" has no field "milestone_type_id"
-- Repro: create case → save as draft → edit → save (finalize)
-- ============================================

CREATE OR REPLACE FUNCTION public.trigger_record_case_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_milestone_name TEXT;
BEGIN
  -- Get the milestone name via facility_milestone_id (the only path now)
  SELECT fm.name INTO v_milestone_name
  FROM facility_milestones fm
  WHERE fm.id = NEW.facility_milestone_id;

  -- Only trigger stats recording on patient_out milestone
  IF v_milestone_name = 'patient_out' THEN
    PERFORM record_case_stats(NEW.case_id);
    PERFORM refresh_case_stats();
  END IF;

  RETURN NEW;
END;
$$;
