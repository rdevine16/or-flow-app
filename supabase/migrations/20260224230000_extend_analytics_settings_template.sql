-- Extend analytics_settings_template with 11 columns that exist on
-- facility_analytics_settings but were never added to the admin template.
-- This closes the gap so that new facilities inherit ALL analytics settings
-- from the admin-configured template, not just the original 14.

-- 1. Surgical Turnovers (2 columns)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS turnover_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS turnover_compliance_target_percent NUMERIC(5,2) NOT NULL DEFAULT 80;

-- 2. Surgeon Idle Time (3 columns)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS idle_combined_target_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS idle_flip_target_minutes INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS idle_same_room_target_minutes INTEGER NOT NULL DEFAULT 10;

-- 3. Tardiness & Non-Operative Time (3 columns)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS tardiness_target_minutes INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS non_op_warn_minutes INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS non_op_bad_minutes INTEGER NOT NULL DEFAULT 30;

-- 4. Dashboard Alerts (1 column)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS behind_schedule_grace_minutes INTEGER NOT NULL DEFAULT 15;

-- 5. Operational (1 column)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS operating_days_per_year INTEGER NOT NULL DEFAULT 250;

-- 6. Case Financials (1 column)
ALTER TABLE analytics_settings_template
  ADD COLUMN IF NOT EXISTS financial_benchmark_case_count INTEGER NOT NULL DEFAULT 10;

-- Rewrite copy function to include all 25 columns
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
        -- FCOTS
        fcots_milestone, fcots_grace_minutes, fcots_target_percent,
        -- Surgical Turnovers
        turnover_target_same_surgeon, turnover_target_flip_room,
        turnover_threshold_minutes, turnover_compliance_target_percent,
        -- OR Utilization & Cancellations
        utilization_target_percent, cancellation_target_percent,
        -- Surgeon Idle Time
        idle_combined_target_minutes, idle_flip_target_minutes, idle_same_room_target_minutes,
        -- Tardiness & Non-Operative Time
        tardiness_target_minutes, non_op_warn_minutes, non_op_bad_minutes,
        -- Dashboard Alerts
        behind_schedule_grace_minutes,
        -- Operational
        operating_days_per_year,
        -- Case Financials
        financial_benchmark_case_count,
        -- ORbit Score v2
        start_time_milestone, start_time_grace_minutes, start_time_floor_minutes,
        waiting_on_surgeon_minutes, waiting_on_surgeon_floor_minutes,
        min_procedure_cases, min_case_threshold
    )
    SELECT
        p_facility_id,
        -- FCOTS
        t.fcots_milestone, t.fcots_grace_minutes, t.fcots_target_percent,
        -- Surgical Turnovers
        t.turnover_target_same_surgeon, t.turnover_target_flip_room,
        t.turnover_threshold_minutes, t.turnover_compliance_target_percent,
        -- OR Utilization & Cancellations
        t.utilization_target_percent, t.cancellation_target_percent,
        -- Surgeon Idle Time
        t.idle_combined_target_minutes, t.idle_flip_target_minutes, t.idle_same_room_target_minutes,
        -- Tardiness & Non-Operative Time
        t.tardiness_target_minutes, t.non_op_warn_minutes, t.non_op_bad_minutes,
        -- Dashboard Alerts
        t.behind_schedule_grace_minutes,
        -- Operational
        t.operating_days_per_year,
        -- Case Financials
        t.financial_benchmark_case_count,
        -- ORbit Score v2
        t.start_time_milestone, t.start_time_grace_minutes, t.start_time_floor_minutes,
        t.waiting_on_surgeon_minutes, t.waiting_on_surgeon_floor_minutes,
        t.min_procedure_cases, t.min_case_threshold
    FROM public.analytics_settings_template t
    LIMIT 1;
END;
$$;
