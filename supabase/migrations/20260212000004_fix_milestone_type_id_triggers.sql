-- ============================================
-- Fix: Drop triggers on case_milestones that reference the dropped milestone_type_id column
--
-- Background: milestone_type_id was DROPPED from case_milestones during the v2.0
-- milestone cleanup. All operations now use facility_milestone_id exclusively.
-- However, some triggers still reference NEW.milestone_type_id, causing:
--   ERROR: record "new" has no field "milestone_type_id"
-- This breaks finalize_draft_case and any other path that inserts into case_milestones.
-- ============================================

-- 1) Find and drop triggers on case_milestones whose handler functions
--    reference the old milestone_type_id column.
DO $$
DECLARE
  trig RECORD;
  dropped_triggers TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR trig IN
    SELECT t.tgname AS trigger_name, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'case_milestones'
      AND n.nspname = 'public'
      AND NOT t.tgisinternal
      AND p.prosrc LIKE '%milestone_type_id%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.case_milestones', trig.trigger_name);
    dropped_triggers := array_append(dropped_triggers, trig.trigger_name || ' (function: ' || trig.function_name || ')');
    RAISE NOTICE 'Dropped trigger: % (function: %)', trig.trigger_name, trig.function_name;
  END LOOP;

  IF array_length(dropped_triggers, 1) IS NULL THEN
    RAISE NOTICE 'No triggers referencing milestone_type_id found on case_milestones.';
  ELSE
    RAISE NOTICE 'Dropped % trigger(s) referencing milestone_type_id: %',
      array_length(dropped_triggers, 1), array_to_string(dropped_triggers, ', ');
  END IF;
END$$;

-- 2) Also fix any triggers on the cases table that reference milestone_type_id
--    (e.g., triggers that try to auto-create milestones with the old column).
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT t.tgname AS trigger_name, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'cases'
      AND n.nspname = 'public'
      AND NOT t.tgisinternal
      AND p.prosrc LIKE '%milestone_type_id%'
  LOOP
    RAISE NOTICE 'WARNING: Trigger "%" on cases table references milestone_type_id (function: %). Review manually.', trig.trigger_name, trig.function_name;
  END LOOP;
END$$;
