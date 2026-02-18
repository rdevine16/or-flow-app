-- Add configurable benchmark case count for financial margin comparisons.
-- Controls how many recent validated cases are used to compute surgeon/facility median margins.

ALTER TABLE facility_analytics_settings
  ADD COLUMN financial_benchmark_case_count integer NOT NULL DEFAULT 10
  CONSTRAINT financial_benchmark_case_count_range CHECK (financial_benchmark_case_count >= 5 AND financial_benchmark_case_count <= 100);
