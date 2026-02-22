-- ============================================================================
-- Migration: Drop ALL unused non-constraint indexes
--
-- Strategy: Dynamically find and drop all public schema indexes that:
--   1. Have 0 index scans (never used for reads)
--   2. Are NOT primary keys
--   3. Are NOT unique constraints
--   4. Are NOT partial indexes (these serve specialized purposes)
--   5. Do NOT enforce any constraint (FK, exclusion, etc.)
--
-- These indexes only slow down writes without helping reads.
-- If any become needed later, they can be quickly re-created.
-- ============================================================================
DO $$
DECLARE
  idx RECORD;
  drop_count INT := 0;
  total_size BIGINT := 0;
BEGIN
  FOR idx IN
    SELECT
      ic.relname AS index_name,
      tc.relname AS table_name,
      pg_relation_size(i.indexrelid) AS index_size
    FROM pg_index i
    JOIN pg_class ic ON i.indexrelid = ic.oid
    JOIN pg_class tc ON i.indrelid = tc.oid
    JOIN pg_namespace ns ON ic.relnamespace = ns.oid
    LEFT JOIN pg_stat_user_indexes sui ON sui.indexrelid = i.indexrelid
    WHERE ns.nspname = 'public'
      AND i.indisvalid = true
      AND i.indislive = true
      -- Never drop primary keys
      AND NOT i.indisprimary
      -- Never drop unique indexes (they enforce constraints)
      AND NOT i.indisunique
      -- Never drop partial indexes (specialized purpose)
      AND i.indpred IS NULL
      -- Never drop indexes that back a constraint (FK, exclusion, etc.)
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conindid = i.indexrelid
      )
      -- Only drop indexes with 0 scans
      AND COALESCE(sui.idx_scan, 0) = 0
    ORDER BY pg_relation_size(i.indexrelid) DESC, ic.relname
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.index_name);
    drop_count := drop_count + 1;
    total_size := total_size + idx.index_size;
    RAISE NOTICE 'dropped [%]: %.% (%s bytes, table: %)',
      drop_count, 'public', idx.index_name, idx.index_size, idx.table_name;
  END LOOP;

  RAISE NOTICE '=== Dropped % unused indexes, freed ~% bytes ===',
    drop_count, total_size;
END $$;
