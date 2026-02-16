-- Simplify get_full_day_financials: remove projection logic that references
-- tables/views with uncertain column types. Return raw case info + actuals
-- from case_completion_stats. Non-completed cases get NULLs for financials.
-- Client-side already handles NULL display (shows "TBD").

CREATE OR REPLACE FUNCTION public.get_full_day_financials(
  p_surgeon_id      UUID,
  p_scheduled_date  DATE,
  p_facility_id     UUID
)
RETURNS TABLE (
  case_id        UUID,
  case_number    TEXT,
  procedure_name TEXT,
  status         TEXT,
  revenue        NUMERIC,
  total_costs    NUMERIC,
  profit         NUMERIC,
  margin_pct     NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                                                       AS case_id,
    c.case_number::TEXT                                        AS case_number,
    pt.name::TEXT                                              AS procedure_name,
    cs.name::TEXT                                              AS status,
    ccs.reimbursement                                          AS revenue,
    CASE
      WHEN ccs.case_id IS NOT NULL THEN
        COALESCE(ccs.or_time_cost, ccs.or_cost, 0::NUMERIC)
        + COALESCE(ccs.total_debits, ccs.soft_goods_cost, 0::NUMERIC)
        - COALESCE(ccs.total_credits, ccs.hard_goods_cost, 0::NUMERIC)
      ELSE NULL
    END                                                        AS total_costs,
    ccs.profit                                                 AS profit,
    CASE
      WHEN ccs.reimbursement IS NOT NULL
        AND ccs.reimbursement > 0
        AND ccs.profit IS NOT NULL
      THEN (ccs.profit / ccs.reimbursement) * 100
      ELSE NULL
    END                                                        AS margin_pct
  FROM cases c
  JOIN procedure_types pt ON pt.id = c.procedure_type_id
  JOIN case_statuses cs   ON cs.id = c.status_id
  LEFT JOIN case_completion_stats ccs ON ccs.case_id = c.id
  WHERE c.surgeon_id      = p_surgeon_id
    AND c.scheduled_date  = p_scheduled_date
    AND c.facility_id     = p_facility_id
  ORDER BY c.case_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_full_day_financials(UUID, DATE, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.get_full_day_financials IS
  'Returns all cases for a surgeon on a given date with actual financials '
  'from case_completion_stats. Non-completed cases return NULLs for financials. '
  'SECURITY INVOKER — RLS applies.';
