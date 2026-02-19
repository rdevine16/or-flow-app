-- Migration: Create surgeon_scorecards table
-- Caches ORbit Score results for quick reads by the dashboard and iOS.
-- Populated by the ORbit Score page after client-side computation,
-- and eventually by the compute-surgeon-scorecard Edge Function on a nightly cron.

CREATE TABLE IF NOT EXISTS public.surgeon_scorecards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  surgeon_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  composite_score numeric NOT NULL,
  profitability_score numeric,
  consistency_score numeric,
  sched_adherence_score numeric,
  availability_score numeric,
  case_count integer NOT NULL DEFAULT 0,
  trend text CHECK (trend IN ('up', 'down', 'stable', 'new')),
  previous_composite numeric,
  period_start date,
  period_end date,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for dashboard query: latest score per surgeon per facility
CREATE INDEX idx_surgeon_scorecards_lookup
  ON public.surgeon_scorecards (facility_id, surgeon_id, created_at DESC);

-- RLS
ALTER TABLE public.surgeon_scorecards ENABLE ROW LEVEL SECURITY;

-- Read: any user in the facility
CREATE POLICY "Users can read scorecards for their facility"
  ON public.surgeon_scorecards FOR SELECT
  USING (facility_id = public.get_my_facility_id());

-- Insert: any user in the facility (ORbit Score page caches results)
CREATE POLICY "Users can insert scorecards for their facility"
  ON public.surgeon_scorecards FOR INSERT
  WITH CHECK (facility_id = public.get_my_facility_id());

-- Global admins can read all
CREATE POLICY "Global admins can read all surgeon_scorecards"
  ON public.surgeon_scorecards FOR SELECT
  USING (public.get_my_access_level() = 'global_admin'::text);

-- Global admins can insert all
CREATE POLICY "Global admins can insert all surgeon_scorecards"
  ON public.surgeon_scorecards FOR INSERT
  WITH CHECK (public.get_my_access_level() = 'global_admin'::text);
