-- Add configurable overall minimum case threshold for ORbit Scorecard
-- Previously hardcoded to 15 in orbitScoreEngine.ts

ALTER TABLE facility_analytics_settings
  ADD COLUMN IF NOT EXISTS min_case_threshold INTEGER NOT NULL DEFAULT 15;

ALTER TABLE facility_analytics_settings
  ADD CONSTRAINT chk_min_case_threshold CHECK (min_case_threshold BETWEEN 1 AND 100);

-- Also add to the admin template table
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS min_case_threshold INTEGER NOT NULL DEFAULT 15;

ALTER TABLE analytics_settings_template
  ADD CONSTRAINT chk_template_min_case_threshold CHECK (min_case_threshold BETWEEN 1 AND 100);

-- Update copy function to include the new column
CREATE OR REPLACE FUNCTION public.copy_analytics_settings_to_facility(p_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Skip if facility already has analytics settings
    IF EXISTS (SELECT 1 FROM public.facility_analytics_settings WHERE facility_id = p_facility_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.facility_analytics_settings (
        facility_id,
        fcots_milestone, fcots_grace_minutes, fcots_target_percent,
        turnover_target_same_surgeon, turnover_target_flip_room,
        utilization_target_percent, cancellation_target_percent,
        start_time_milestone, start_time_grace_minutes, start_time_floor_minutes,
        waiting_on_surgeon_minutes, waiting_on_surgeon_floor_minutes,
        min_procedure_cases, min_case_threshold
    )
    SELECT
        p_facility_id,
        t.fcots_milestone, t.fcots_grace_minutes, t.fcots_target_percent,
        t.turnover_target_same_surgeon, t.turnover_target_flip_room,
        t.utilization_target_percent, t.cancellation_target_percent,
        t.start_time_milestone, t.start_time_grace_minutes, t.start_time_floor_minutes,
        t.waiting_on_surgeon_minutes, t.waiting_on_surgeon_floor_minutes,
        t.min_procedure_cases, t.min_case_threshold
    FROM public.analytics_settings_template t
    LIMIT 1;
END;
$$;
