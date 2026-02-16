-- Fix: remove c.is_active reference from get_full_day_financials
-- The cases table does not have an is_active column.
-- Cases are filtered by status via the case_statuses join instead.

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
DECLARE
  v_or_hourly_rate NUMERIC;
BEGIN
  -- Get facility OR hourly rate (used for projections)
  SELECT f.or_hourly_rate INTO v_or_hourly_rate
  FROM facilities f
  WHERE f.id = p_facility_id;

  RETURN QUERY
  WITH
  -- All cases for this surgeon on this date at this facility
  day_cases AS (
    SELECT
      c.id AS case_id,
      c.case_number,
      pt.name AS procedure_name,
      cs.name AS status_name,
      c.procedure_type_id,
      c.surgeon_id
    FROM cases c
    JOIN procedure_types pt ON pt.id = c.procedure_type_id
    JOIN case_statuses cs ON cs.id = c.status_id
    WHERE c.surgeon_id = p_surgeon_id
      AND c.scheduled_date = p_scheduled_date
      AND c.facility_id = p_facility_id
  ),

  -- Actual financials for completed cases (from case_completion_stats)
  actuals AS (
    SELECT
      ccs.case_id,
      ccs.reimbursement AS revenue,
      COALESCE(ccs.or_time_cost, ccs.or_cost, 0)
        + COALESCE(ccs.total_debits, ccs.soft_goods_cost, 0)
        - COALESCE(ccs.total_credits, ccs.hard_goods_cost, 0) AS total_costs,
      ccs.profit
    FROM case_completion_stats ccs
    WHERE ccs.case_id IN (SELECT dc.case_id FROM day_cases dc)
  ),

  -- Projected financials for non-completed cases
  projections AS (
    SELECT
      dc.case_id,
      COALESCE(
        pr.reimbursement,
        sps.median_reimbursement,
        fps.median_reimbursement
      ) AS proj_revenue,
      CASE
        WHEN v_or_hourly_rate IS NOT NULL
          AND COALESCE(sps.median_duration, fps.median_duration) IS NOT NULL
        THEN (COALESCE(sps.median_duration, fps.median_duration) / 60.0) * v_or_hourly_rate
        ELSE NULL
      END AS proj_or_cost,
      COALESCE(cost_agg.total_debits, 0) AS proj_debits,
      COALESCE(cost_agg.total_credits, 0) AS proj_credits
    FROM day_cases dc
    LEFT JOIN actuals a ON a.case_id = dc.case_id
    LEFT JOIN surgeon_procedure_stats sps
      ON sps.surgeon_id = dc.surgeon_id
      AND sps.procedure_type_id = dc.procedure_type_id
      AND sps.facility_id = p_facility_id
    LEFT JOIN facility_procedure_stats fps
      ON fps.procedure_type_id = dc.procedure_type_id
      AND fps.facility_id = p_facility_id
    LEFT JOIN LATERAL (
      SELECT prm.reimbursement
      FROM procedure_reimbursements prm
      WHERE prm.facility_id = p_facility_id
        AND prm.procedure_type_id = dc.procedure_type_id
        AND prm.payer_id IS NULL
      ORDER BY prm.effective_date DESC
      LIMIT 1
    ) pr ON true
    LEFT JOIN LATERAL (
      SELECT
        SUM(pci.amount) FILTER (WHERE cc.type = 'debit') AS total_debits,
        SUM(pci.amount) FILTER (WHERE cc.type = 'credit') AS total_credits
      FROM procedure_cost_items pci
      JOIN cost_categories cc ON cc.id = pci.cost_category_id
      WHERE pci.facility_id = p_facility_id
        AND pci.procedure_type_id = dc.procedure_type_id
        AND pci.effective_to IS NULL
    ) cost_agg ON true
    WHERE a.case_id IS NULL
  )

  SELECT
    dc.case_id,
    dc.case_number,
    dc.procedure_name,
    dc.status_name AS status,
    COALESCE(a.revenue, p.proj_revenue) AS revenue,
    COALESCE(
      a.total_costs,
      COALESCE(p.proj_or_cost, 0) + p.proj_debits - p.proj_credits
    ) AS total_costs,
    COALESCE(
      a.profit,
      CASE
        WHEN COALESCE(a.revenue, p.proj_revenue) IS NOT NULL
        THEN COALESCE(a.revenue, p.proj_revenue)
          - (COALESCE(p.proj_or_cost, 0) + p.proj_debits - p.proj_credits)
        ELSE NULL
      END
    ) AS profit,
    CASE
      WHEN COALESCE(a.revenue, p.proj_revenue) IS NOT NULL
        AND COALESCE(a.revenue, p.proj_revenue) > 0
      THEN (
        COALESCE(
          a.profit,
          COALESCE(a.revenue, p.proj_revenue)
            - (COALESCE(p.proj_or_cost, 0) + p.proj_debits - p.proj_credits)
        )
        / COALESCE(a.revenue, p.proj_revenue)
      ) * 100
      ELSE NULL
    END AS margin_pct
  FROM day_cases dc
  LEFT JOIN actuals a ON a.case_id = dc.case_id
  LEFT JOIN projections p ON p.case_id = dc.case_id
  ORDER BY dc.case_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_full_day_financials(UUID, DATE, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.get_full_day_financials IS
  'Returns all cases + financials for a surgeon on a given date. '
  'Completed cases use actuals from case_completion_stats. '
  'Non-completed cases use projected values. SECURITY INVOKER — RLS applies.';
