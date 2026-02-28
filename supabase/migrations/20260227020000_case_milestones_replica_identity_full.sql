-- Fix Realtime CHANNEL_ERROR for case_milestones
-- Supabase Realtime requires REPLICA IDENTITY FULL on RLS-enabled tables
-- so it can evaluate row-level security policies on change events.
-- Without this, postgres_changes subscriptions fail with CHANNEL_ERROR.
ALTER TABLE public.case_milestones REPLICA IDENTITY FULL;
