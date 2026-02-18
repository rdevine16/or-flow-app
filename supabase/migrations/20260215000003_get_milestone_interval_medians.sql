-- ============================================
-- get_milestone_interval_medians(surgeon_id, procedure_type_id, facility_id)
--
-- Returns median intervals between consecutive milestones for:
--   1. A specific surgeon (surgeon-level benchmarks)
--   2. The entire facility (facility-level benchmarks)
--
-- Used by useMilestoneComparison hook for the Milestones tab.
--
-- SECURITY INVOKER: inherits caller's RLS, facility isolation automatic.
-- Only includes completed + validated cases (data_validated = true).
-- Uses PERCENTILE_CONT(0.5) for medians (platform-wide: median over average).
-- ============================================

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
  -- Step 1: Get the ordered milestone sequence for this procedure+facility
  milestone_order AS (
    SELECT
      fm.id AS fm_id,
      fm.name AS ms_name,
      fm.display_order AS ms_order,
      fm.phase_group AS ms_phase_group
    FROM procedure_milestone_config pmc
    JOIN facility_milestones fm ON fm.id = pmc.facility_milestone_id
    WHERE pmc.procedure_type_id = p_procedure_type_id
      AND pmc.facility_id = p_facility_id
      AND pmc.is_enabled = true
      AND fm.is_active = true
    ORDER BY fm.display_order
  ),

  -- Step 2: Get all recorded milestones for completed+validated cases of this procedure
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
      AND c.is_active = true
      AND cm.recorded_at IS NOT NULL
  ),

  -- Step 3: Compute interval from previous milestone per case
  -- LAG gives the previous milestone's recorded_at within the same case
  intervals AS (
    SELECT
      cmt.case_id,
      cmt.case_surgeon_id,
      cmt.cm_fm_id,
      cmt.ms_name,
      cmt.ms_order,
      cmt.ms_phase_group,
      EXTRACT(EPOCH FROM (
        cmt.cm_recorded_at - LAG(cmt.cm_recorded_at) OVER (
          PARTITION BY cmt.case_id
          ORDER BY cmt.ms_order
        )
      )) / 60.0 AS interval_min
    FROM case_milestone_timestamps cmt
  )

  -- Step 4: Aggregate medians per milestone
  SELECT
    i.ms_name::TEXT                                                    AS milestone_name,
    i.cm_fm_id                                                         AS facility_milestone_id,
    i.ms_order                                                         AS display_order,
    i.ms_phase_group::TEXT                                             AS phase_group,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY i.interval_min)
      FILTER (WHERE i.case_surgeon_id = p_surgeon_id
              AND i.interval_min IS NOT NULL
              AND i.interval_min > 0)                                  AS surgeon_median_minutes,
    COUNT(*)
      FILTER (WHERE i.case_surgeon_id = p_surgeon_id
              AND i.interval_min IS NOT NULL
              AND i.interval_min > 0)::INT                             AS surgeon_case_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY i.interval_min)
      FILTER (WHERE i.interval_min IS NOT NULL
              AND i.interval_min > 0)                                  AS facility_median_minutes,
    COUNT(*)
      FILTER (WHERE i.interval_min IS NOT NULL
              AND i.interval_min > 0)::INT                             AS facility_case_count
  FROM intervals i
  GROUP BY i.cm_fm_id, i.ms_name, i.ms_order, i.ms_phase_group
  ORDER BY i.ms_order;
END;
$$;
-- Grant execute to authenticated users (RLS enforces facility isolation)
GRANT EXECUTE ON FUNCTION public.get_milestone_interval_medians(UUID, UUID, UUID)
  TO authenticated;
COMMENT ON FUNCTION public.get_milestone_interval_medians IS
  'Returns median milestone intervals for surgeon + facility benchmarking. '
  'First milestone has NULL interval (no predecessor). '
  'Only includes completed, validated cases. SECURITY INVOKER — RLS applies.';
