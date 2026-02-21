-- Fix: surgeon_overall_stats materialized view was missing the is_excluded filter.
-- facility_procedure_stats and surgeon_procedure_stats already had it,
-- but surgeon_overall_stats did not, allowing excluded cases to pollute aggregates.

DROP MATERIALIZED VIEW IF EXISTS public.surgeon_overall_stats;

CREATE MATERIALIZED VIEW public.surgeon_overall_stats AS
 SELECT facility_id,
    surgeon_id,
    count(*) AS total_cases,
    count(DISTINCT procedure_type_id) AS procedure_type_count,
    count(DISTINCT case_date) AS days_worked,
    avg(total_duration_minutes) AS avg_duration,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((total_duration_minutes)::double precision)) AS median_duration,
    stddev(total_duration_minutes) AS stddev_duration,
    avg(surgical_duration_minutes) AS avg_surgical_duration,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((surgical_duration_minutes)::double precision)) AS median_surgical_duration,
    avg(surgical_turnover_minutes) FILTER (WHERE (NOT is_first_case_of_day_surgeon)) AS avg_surgical_turnover,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((surgical_turnover_minutes)::double precision)) FILTER (WHERE (NOT is_first_case_of_day_surgeon)) AS median_surgical_turnover,
    avg(surgeon_room_count) AS avg_rooms_per_day,
    max(surgeon_room_count) AS max_rooms_per_day,
    count(*) FILTER (WHERE (surgeon_room_count > 1)) AS multi_room_case_count,
    sum(profit) AS total_profit,
    avg(profit) AS avg_profit,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((profit)::double precision)) AS median_profit,
    stddev(profit) AS stddev_profit,
    max(case_date) AS last_case_date,
    min(case_date) AS first_case_date,
    count(*) FILTER (WHERE (case_date >= (CURRENT_DATE - '30 days'::interval))) AS cases_last_30_days,
    count(*) FILTER (WHERE (case_date >= (CURRENT_DATE - '90 days'::interval))) AS cases_last_90_days
   FROM public.case_completion_stats
  WHERE (surgeon_id IS NOT NULL)
    AND ((is_excluded = false) OR (is_excluded IS NULL))
  GROUP BY facility_id, surgeon_id
  WITH NO DATA;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_surgeon_overall_stats_unique
  ON public.surgeon_overall_stats (facility_id, surgeon_id);

-- Populate with clean data
REFRESH MATERIALIZED VIEW public.surgeon_overall_stats;
