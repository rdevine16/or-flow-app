-- ============================================================================
-- Migration: Fix Supabase Dashboard Advisor Issues
-- Addresses: ~128 security + ~944 performance advisors
--
-- Part 1: Security — Set search_path on all public functions/triggers
-- Part 2: Performance — Rewrite RLS policies to use (select auth.uid()) initplan
-- Part 3: Performance — Add missing indexes on foreign key columns
-- ============================================================================

-- ============================================================================
-- PART 1: Fix function_search_path_mutable (Security Advisor)
-- Sets search_path = '' on all public schema functions that lack it.
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
      p.prokind
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')  -- functions and procedures
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(p.proconfig) AS conf
          WHERE conf LIKE 'search_path=%'
        )
      )
    ORDER BY p.proname
  LOOP
    alter_cmd := format(
      'ALTER %s %I.%I(%s) SET search_path = ''''',
      CASE func.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      func.schema_name,
      func.func_name,
      func.args
    );
    EXECUTE alter_cmd;
    fn_count := fn_count + 1;
    RAISE NOTICE 'search_path fix [%/%]: %.%(%)',
      fn_count, fn_count, func.schema_name, func.func_name, func.args;
  END LOOP;

  RAISE NOTICE '=== Part 1 complete: fixed % functions ===', fn_count;
END $$;

-- ============================================================================
-- PART 2: Fix auth_rls_initplan (Performance Advisor)
-- Rewrites RLS policies so auth.uid() is wrapped in (select auth.uid()),
-- allowing PostgreSQL to evaluate it once as an InitPlan instead of per-row.
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  policy_sql TEXT;
  roles_csv TEXT;
  pol_count INT := 0;
BEGIN
  FOR pol IN
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        -- Has auth.uid() that is NOT already wrapped in (select ...)
        (qual IS NOT NULL AND qual::text ~ 'auth\.uid\(\)' AND qual::text !~ '\(select auth\.uid\(\)\)')
        OR
        (with_check IS NOT NULL AND with_check::text ~ 'auth\.uid\(\)' AND with_check::text !~ '\(select auth\.uid\(\)\)')
      )
    ORDER BY tablename, policyname
  LOOP
    -- Fix USING expression: replace auth.uid() with (select auth.uid())
    -- Use placeholder to avoid double-wrapping any already-fixed instances
    IF pol.qual IS NOT NULL THEN
      new_qual := replace(pol.qual::text, '(select auth.uid())', '___INITPLAN_OK___');
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, '___INITPLAN_OK___', '(select auth.uid())');
    ELSE
      new_qual := NULL;
    END IF;

    -- Fix WITH CHECK expression
    IF pol.with_check IS NOT NULL THEN
      new_with_check := replace(pol.with_check::text, '(select auth.uid())', '___INITPLAN_OK___');
      new_with_check := replace(new_with_check, 'auth.uid()', '(select auth.uid())');
      new_with_check := replace(new_with_check, '___INITPLAN_OK___', '(select auth.uid())');
    ELSE
      new_with_check := NULL;
    END IF;

    -- Build CSV role list from array
    roles_csv := array_to_string(pol.roles, ', ');

    -- Drop existing policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);

    -- Build CREATE POLICY statement
    policy_sql := format('CREATE POLICY %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);

    -- Permissive is the default; only specify if RESTRICTIVE
    IF pol.permissive = 'RESTRICTIVE' THEN
      policy_sql := policy_sql || ' AS RESTRICTIVE';
    END IF;

    -- Command type
    policy_sql := policy_sql || ' FOR ' || pol.cmd;

    -- Roles
    policy_sql := policy_sql || ' TO ' || roles_csv;

    -- USING clause
    IF new_qual IS NOT NULL THEN
      policy_sql := policy_sql || ' USING (' || new_qual || ')';
    END IF;

    -- WITH CHECK clause
    IF new_with_check IS NOT NULL THEN
      policy_sql := policy_sql || ' WITH CHECK (' || new_with_check || ')';
    END IF;

    EXECUTE policy_sql;

    pol_count := pol_count + 1;
    RAISE NOTICE 'initplan fix [%]: %.% -> %',
      pol_count, pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  RAISE NOTICE '=== Part 2 complete: fixed % RLS policies ===', pol_count;
END $$;

-- ============================================================================
-- PART 3: Add missing indexes on foreign key columns (Performance Advisor)
-- Creates indexes for FK columns that aren't the leading column of any index.
-- ============================================================================
DO $$
DECLARE
  fk RECORD;
  idx_name TEXT;
  idx_count INT := 0;
BEGIN
  FOR fk IN
    SELECT
      ns.nspname AS schema_name,
      tc.relname AS table_name,
      a.attname AS column_name,
      c.conname AS constraint_name,
      rc.relname AS referenced_table
    FROM pg_constraint c
    JOIN pg_class tc ON c.conrelid = tc.oid
    JOIN pg_namespace ns ON tc.relnamespace = ns.oid
    JOIN pg_class rc ON c.confrelid = rc.oid
    JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'                     -- foreign key constraints
      AND ns.nspname = 'public'               -- public schema only
      AND array_length(c.conkey, 1) = 1       -- single-column FKs only
      AND NOT EXISTS (
        -- Check if FK column is the leading column of ANY valid index
        SELECT 1
        FROM pg_index pi
        WHERE pi.indrelid = tc.oid
          AND pi.indisvalid = true
          AND pi.indkey[0] = a.attnum
      )
    ORDER BY tc.relname, a.attname
  LOOP
    idx_name := 'idx_' || fk.table_name || '_' || fk.column_name;

    -- Truncate index name if exceeds PostgreSQL's 63-char limit
    IF length(idx_name) > 63 THEN
      idx_name := left(idx_name, 63);
    END IF;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)',
      idx_name, fk.schema_name, fk.table_name, fk.column_name);

    idx_count := idx_count + 1;
    RAISE NOTICE 'index [%]: % on %.%(%)',
      idx_count, idx_name, fk.schema_name, fk.table_name, fk.column_name;
  END LOOP;

  RAISE NOTICE '=== Part 3 complete: created % indexes ===', idx_count;
END $$;
