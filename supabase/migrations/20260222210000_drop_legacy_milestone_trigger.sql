-- ============================================================================
-- Drop legacy on_facility_created_copy_milestones trigger
-- ============================================================================
-- The facility creation wizard now calls seed_facility_with_templates() explicitly
-- with a configurable JSONB template_config parameter. The legacy trigger from
-- baseline.sql auto-seeds milestones on every facility INSERT, which:
-- 1. Duplicates work (the RPC already handles milestones in Part 1)
-- 2. Ignores the user's template selection (always seeds milestones)
-- 3. Creates a race condition between trigger and explicit RPC call
-- ============================================================================

DROP TRIGGER IF EXISTS on_facility_created_copy_milestones ON public.facilities;
DROP FUNCTION IF EXISTS public.copy_milestone_settings_to_new_facility();
