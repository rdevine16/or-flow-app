-- ============================================================================
-- Migration: Fix search_path from '' to 'public'
-- The previous migration set search_path = '' which is too restrictive.
-- Functions that reference other functions or tables without explicit
-- schema qualification break with empty search_path.
-- Setting search_path = 'public' satisfies the Supabase advisor while
-- keeping cross-function calls and table references working.
-- ============================================================================
DO $$
DECLARE
  func RECORD;
  fn_count INT := 0;
  alter_cmd TEXT;
BEGIN
  FOR func IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
      p.prokind,
      p.proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.proconfig IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(p.proconfig) AS conf
        WHERE conf LIKE 'search_path=%'
          AND conf != 'search_path=public'
          AND conf != 'search_path="public"'
      )
    ORDER BY p.proname
  LOOP
    alter_cmd := format(
      'ALTER %s %I.%I(%s) SET search_path TO ''public''',
      CASE func.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      func.schema_name,
      func.func_name,
      func.args
    );
    EXECUTE alter_cmd;
    fn_count := fn_count + 1;
    RAISE NOTICE 'search_path fix [%]: %.%(%) was: %',
      fn_count, func.schema_name, func.func_name, func.args,
      (SELECT conf FROM unnest(func.proconfig) AS conf WHERE conf LIKE 'search_path=%' LIMIT 1);
  END LOOP;

  RAISE NOTICE '=== Fixed % functions to search_path = public ===', fn_count;
END $$;
