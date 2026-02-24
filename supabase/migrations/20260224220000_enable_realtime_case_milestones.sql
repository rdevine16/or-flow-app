-- Enable Supabase Realtime on case_milestones table
-- Required for postgres_changes subscriptions in useMilestoneRealtime hook
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_milestones;
