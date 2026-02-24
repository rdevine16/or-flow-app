-- Fix get_milestone_interval_medians() to include surgeon template overrides
-- in the template cascade resolution.
--
-- Previously: procedure_types.milestone_template_id → facility default
-- Now:        surgeon_template_overrides → procedure_types → facility default
--
-- The p_surgeon_id parameter was already accepted but NOT used for template
-- resolution. This migration fixes that gap.

CREATE OR REPLACE FUNCTION public.get_milestone_interval_medians(
  p_surgeon_id        UUID,
  p_procedure_type_id UUID,
  p_facility_id       UUID
)
RETURNS TABLE (
  milestone_name        TEXT,
  facility_milestone_id UUID,
  display_order         INT,
  phase_group           TEXT,
  surgeon_median_minutes NUMERIC,
  surgeon_case_count    INT,
  facility_median_minutes NUMERIC,
  facility_case_count   INT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Resolve the template via 3-tier cascade:
  -- 1. surgeon_template_overrides (most specific)
  -- 2. procedure_types.milestone_template_id
  -- 3. facility default template (is_default = true)
  resolved_template AS (
    SELECT COALESCE(
      -- 1. Surgeon override for this surgeon + procedure type + facility
      (SELECT sto.milestone_template_id
       FROM surgeon_template_overrides sto
       WHERE sto.surgeon_id = p_surgeon_id
         AND sto.procedure_type_id = p_procedure_type_id
         AND sto.facility_id = p_facility_id),
      -- 2. Procedure type default template
      (SELECT pt.milestone_template_id
       FROM procedure_types pt
       WHERE pt.id = p_procedure_type_id),
      -- 3. Facility default template
      (SELECT mt.id
       FROM milestone_templates mt
       WHERE mt.facility_id = p_facility_id
         AND mt.is_default = true
         AND mt.is_active = true)
    ) AS template_id
  ),

  milestone_order AS (
    SELECT
      fm.id AS fm_id,
      fm.name AS ms_name,
      mti.display_order AS ms_order,
      fm.phase_group AS ms_phase_group
    FROM milestone_template_items mti
    JOIN facility_milestones fm ON fm.id = mti.facility_milestone_id
    CROSS JOIN resolved_template rt
    WHERE mti.template_id = rt.template_id
      AND fm.is_active = true
    ORDER BY mti.display_order
  ),

  case_milestone_timestamps AS (
    SELECT
      c.id AS case_id,
      c.surgeon_id AS case_surgeon_id,
      cm.facility_milestone_id AS cm_fm_id,
      cm.recorded_at AS cm_recorded_at,
      mo.ms_order,
      mo.ms_name,
      mo.ms_phase_group
    FROM cases c
    JOIN case_milestones cm ON cm.case_id = c.id
    JOIN milestone_order mo ON mo.fm_id = cm.facility_milestone_id
    JOIN case_statuses cs ON cs.id = c.status_id
    WHERE c.facility_id = p_facility_id
      AND c.procedure_type_id = p_procedure_type_id
      AND cs.name = 'completed'
      AND c.data_validated = true
      AND cm.recorded_at IS NOT NULL
  ),

  intervals AS (
    SELECT
      cmt.case_id,
      cmt.case_surgeon_id,
      cmt.cm_fm_id,
      cmt.ms_name,
      cmt.ms_order,
      cmt.ms_phase_group,
      EXTRACT(EPOCH FROM (
        LEAD(cmt.cm_recorded_at) OVER (
          PARTITION BY cmt.case_id
          ORDER BY cmt.ms_order
        ) - cmt.cm_recorded_at
      )) / 60.0 AS interval_min
    FROM case_milestone_timestamps cmt
  )

  SELECT
    i.ms_name::TEXT                                                    AS milestone_name,
    i.cm_fm_id                                                         AS facility_milestone_id,
    i.ms_order                                                         AS display_order,
    i.ms_phase_group::TEXT                                             AS phase_group,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY i.interval_min)
      FILTER (WHERE i.case_surgeon_id = p_surgeon_id
              AND i.interval_min IS NOT NULL
              AND i.interval_min > 0))::NUMERIC                        AS surgeon_median_minutes,
    COUNT(*)
      FILTER (WHERE i.case_surgeon_id = p_surgeon_id
              AND i.interval_min IS NOT NULL
              AND i.interval_min > 0)::INT                             AS surgeon_case_count,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY i.interval_min)
      FILTER (WHERE i.interval_min IS NOT NULL
              AND i.interval_min > 0))::NUMERIC                        AS facility_median_minutes,
    COUNT(*)
      FILTER (WHERE i.interval_min IS NOT NULL
              AND i.interval_min > 0)::INT                             AS facility_case_count
  FROM intervals i
  GROUP BY i.cm_fm_id, i.ms_name, i.ms_order, i.ms_phase_group
  ORDER BY i.ms_order;
END;
$$;
