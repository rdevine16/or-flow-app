-- Phase-level median calculations using phase_definitions boundary milestones.
-- Computes median phase durations for both surgeon and facility levels.
-- facility_median_minutes is NULL when facility_n < 5 (low-confidence threshold).

CREATE OR REPLACE FUNCTION public.get_phase_medians(
  p_facility_id UUID,
  p_procedure_type_id UUID,
  p_surgeon_id UUID
) RETURNS TABLE (
  phase_name          TEXT,
  phase_display_name  TEXT,
  color_key           TEXT,
  display_order       INTEGER,
  surgeon_median_minutes  NUMERIC,
  surgeon_n               INTEGER,
  facility_median_minutes NUMERIC,
  facility_n              INTEGER
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get active phase definitions for this facility
  active_phases AS (
    SELECT
      pd.id              AS phase_id,
      pd.name            AS p_name,
      pd.display_name    AS p_display_name,
      pd.display_order   AS p_display_order,
      pd.color_key       AS p_color_key,
      pd.start_milestone_id,
      pd.end_milestone_id
    FROM public.phase_definitions pd
    WHERE pd.facility_id = p_facility_id
      AND pd.is_active = true
  ),

  -- For each phase × completed case, compute the phase duration
  phase_durations AS (
    SELECT
      ap.phase_id,
      ap.p_name,
      ap.p_display_name,
      ap.p_display_order,
      ap.p_color_key,
      c.id            AS case_id,
      c.surgeon_id    AS case_surgeon_id,
      EXTRACT(EPOCH FROM (
        cm_end.recorded_at - cm_start.recorded_at
      )) / 60.0       AS duration_minutes
    FROM active_phases ap
    CROSS JOIN public.cases c
    JOIN public.case_statuses cs ON cs.id = c.status_id
    JOIN public.case_milestones cm_start
      ON  cm_start.case_id = c.id
      AND cm_start.facility_milestone_id = ap.start_milestone_id
      AND cm_start.recorded_at IS NOT NULL
    JOIN public.case_milestones cm_end
      ON  cm_end.case_id = c.id
      AND cm_end.facility_milestone_id = ap.end_milestone_id
      AND cm_end.recorded_at IS NOT NULL
    WHERE c.facility_id = p_facility_id
      AND c.procedure_type_id = p_procedure_type_id
      AND cs.name = 'completed'
      AND c.data_validated = true
      AND cm_end.recorded_at > cm_start.recorded_at
  ),

  -- Aggregate medians per phase
  phase_stats AS (
    SELECT
      pd.phase_id,
      pd.p_name,
      pd.p_display_name,
      pd.p_display_order,
      pd.p_color_key,
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pd.duration_minutes)
        FILTER (WHERE pd.case_surgeon_id = p_surgeon_id))::NUMERIC  AS s_median,
      COUNT(*)
        FILTER (WHERE pd.case_surgeon_id = p_surgeon_id)::INT       AS s_n,
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pd.duration_minutes))::NUMERIC AS f_median,
      COUNT(*)::INT                                                   AS f_n
    FROM phase_durations pd
    GROUP BY pd.phase_id, pd.p_name, pd.p_display_name, pd.p_display_order, pd.p_color_key
  )

  SELECT
    ps.p_name::TEXT          AS phase_name,
    ps.p_display_name::TEXT  AS phase_display_name,
    ps.p_color_key::TEXT     AS color_key,
    ps.p_display_order       AS display_order,
    ps.s_median              AS surgeon_median_minutes,
    ps.s_n                   AS surgeon_n,
    -- Null out facility median when below confidence threshold
    CASE WHEN ps.f_n >= 5 THEN ps.f_median ELSE NULL END AS facility_median_minutes,
    ps.f_n                   AS facility_n
  FROM phase_stats ps
  ORDER BY ps.p_display_order;
END;
$$;
