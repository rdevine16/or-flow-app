-- ============================================================================
-- Migration: Fix remaining Supabase Dashboard Advisor issues
-- Part 1: Combine multiple permissive RLS policies per table/command/roles
-- Part 2: Remove duplicate/redundant indexes
-- ============================================================================

-- ============================================================================
-- PART 1: Combine multiple permissive policies
-- When a table has multiple PERMISSIVE policies for the same command and role
-- set, PostgreSQL evaluates each separately then OR's the results. Combining
-- them into a single policy with explicit OR is semantically identical but
-- avoids the advisor warning and reduces per-query overhead.
-- ============================================================================
DO $$
DECLARE
  grp RECORD;
  pol RECORD;
  combined_qual TEXT;
  combined_check TEXT;
  roles_csv TEXT;
  policy_sql TEXT;
  combined_name TEXT;
  pol_count INT;
  group_count INT := 0;
  total_removed INT := 0;
BEGIN
  -- Find groups with multiple permissive policies for same table/command/roles
  FOR grp IN
    SELECT schemaname, tablename, cmd, roles,
           count(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY schemaname, tablename, cmd, roles
    HAVING count(*) > 1
    ORDER BY tablename, cmd
  LOOP
    combined_qual := NULL;
    combined_check := NULL;
    pol_count := 0;

    -- Build combined expressions from all policies in this group
    FOR pol IN
      SELECT policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = grp.schemaname
        AND tablename = grp.tablename
        AND cmd = grp.cmd
        AND roles = grp.roles
        AND permissive = 'PERMISSIVE'
      ORDER BY policyname
    LOOP
      pol_count := pol_count + 1;

      -- Combine USING (qual) clauses with OR
      IF pol.qual IS NOT NULL THEN
        IF combined_qual IS NULL THEN
          combined_qual := '(' || pol.qual || ')';
        ELSE
          combined_qual := combined_qual || E'\n    OR (' || pol.qual || ')';
        END IF;
      END IF;

      -- Combine WITH CHECK clauses with OR
      IF pol.with_check IS NOT NULL THEN
        IF combined_check IS NULL THEN
          combined_check := '(' || pol.with_check || ')';
        ELSE
          combined_check := combined_check || E'\n    OR (' || pol.with_check || ')';
        END IF;
      END IF;

      -- Drop individual policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname, grp.schemaname, grp.tablename);
    END LOOP;

    -- Build combined policy name: {table}_{command}_{roles}_policy
    -- Include roles to avoid conflicts when table has policies for different role sets
    combined_name := grp.tablename || '_' || lower(grp.cmd) || '_' ||
      replace(array_to_string(grp.roles, '_'), '"', '') || '_policy';
    -- Truncate to PostgreSQL's 63-char limit for identifiers
    IF length(combined_name) > 63 THEN
      combined_name := left(combined_name, 63);
    END IF;

    -- Build role list
    roles_csv := array_to_string(grp.roles, ', ');

    -- Build CREATE POLICY statement
    policy_sql := format('CREATE POLICY %I ON %I.%I FOR %s TO %s',
      combined_name, grp.schemaname, grp.tablename, grp.cmd, roles_csv);

    IF combined_qual IS NOT NULL THEN
      policy_sql := policy_sql || ' USING (' || combined_qual || ')';
    END IF;

    IF combined_check IS NOT NULL THEN
      policy_sql := policy_sql || ' WITH CHECK (' || combined_check || ')';
    END IF;

    EXECUTE policy_sql;

    group_count := group_count + 1;
    total_removed := total_removed + (pol_count - 1);
    RAISE NOTICE 'combined [%]: %.% FOR % — merged % policies into 1',
      group_count, grp.schemaname, grp.tablename, grp.cmd, pol_count;
  END LOOP;

  RAISE NOTICE '=== Part 1 complete: % groups consolidated, % redundant policies removed ===',
    group_count, total_removed;
END $$;

-- ============================================================================
-- PART 2: Remove duplicate/redundant indexes
-- An index is redundant if another index on the same table has the same
-- leading columns (prefix match). The shorter index is dropped since the
-- longer one already covers its use cases.
-- ============================================================================
DO $$
DECLARE
  dup RECORD;
  drop_count INT := 0;
BEGIN
  FOR dup IN
    WITH idx_info AS (
      SELECT
        i.indexrelid,
        i.indrelid,
        ic.relname AS index_name,
        tc.relname AS table_name,
        ns.nspname AS schema_name,
        string_to_array(i.indkey::text, ' ')::int[] AS key_arr,
        array_length(string_to_array(i.indkey::text, ' ')::int[], 1) AS num_cols,
        i.indisunique,
        i.indisprimary,
        i.indpred IS NOT NULL AS is_partial,
        pg_relation_size(i.indexrelid) AS index_size,
        EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.conindid = i.indexrelid
        ) AS enforces_constraint
      FROM pg_index i
      JOIN pg_class ic ON i.indexrelid = ic.oid
      JOIN pg_class tc ON i.indrelid = tc.oid
      JOIN pg_namespace ns ON ic.relnamespace = ns.oid
      WHERE ns.nspname = 'public'
        AND i.indisvalid = true
        AND i.indislive = true
    )
    SELECT
      a.index_name AS redundant_index,
      b.index_name AS covering_index,
      a.table_name,
      a.schema_name,
      a.num_cols AS redundant_cols,
      b.num_cols AS covering_cols
    FROM idx_info a
    JOIN idx_info b
      ON a.indrelid = b.indrelid           -- same table
      AND a.indexrelid != b.indexrelid      -- different index
    WHERE
      -- a is the candidate for removal
      NOT a.enforces_constraint             -- never drop constraint indexes
      AND NOT a.indisprimary                -- never drop PKs
      AND NOT a.indisunique                 -- never drop unique indexes
      AND NOT a.is_partial                  -- skip partial indexes
      AND NOT b.is_partial                  -- skip partial indexes
      -- a must have fewer or equal columns than b
      AND a.num_cols <= b.num_cols
      -- a's columns must be a prefix of b's columns
      AND a.key_arr = b.key_arr[1:a.num_cols]
      -- If same length, prefer keeping the one with a constraint or unique
      AND (a.num_cols < b.num_cols OR b.indisunique OR b.enforces_constraint)
    ORDER BY a.table_name, a.index_name
  LOOP
    -- Avoid dropping the same index twice (it might be redundant to multiple indexes)
    IF EXISTS (
      SELECT 1 FROM pg_class WHERE relname = dup.redundant_index
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = dup.schema_name)
    ) THEN
      EXECUTE format('DROP INDEX IF EXISTS %I.%I',
        dup.schema_name, dup.redundant_index);
      drop_count := drop_count + 1;
      RAISE NOTICE 'dropped redundant index [%]: %.% (% cols, covered by % with % cols)',
        drop_count, dup.schema_name, dup.redundant_index, dup.redundant_cols,
        dup.covering_index, dup.covering_cols;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Part 2 complete: dropped % redundant indexes ===', drop_count;
END $$;
