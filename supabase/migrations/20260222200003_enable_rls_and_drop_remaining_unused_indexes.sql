-- ============================================================================
-- Migration: Enable RLS on 6 unprotected tables + drop remaining unused indexes
--
-- PART 1: Enable RLS on tables that have policies but RLS disabled
--   These tables already have proper policies defined — just need RLS turned on.
--
-- PART 2: Drop remaining unused indexes (including partial indexes)
--   The previous migration excluded partial indexes; the Dashboard advisor
--   still flags them. Drop all non-PK, non-unique indexes with 0 scans.
-- ============================================================================

-- PART 1: Enable RLS
ALTER TABLE public.case_implant_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_rep_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_device_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeon_preference_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeon_preferences ENABLE ROW LEVEL SECURITY;

-- PART 2: Drop remaining unused indexes (including partial indexes this time)
DO $$
DECLARE
  idx RECORD;
  drop_count INT := 0;
BEGIN
  FOR idx IN
    SELECT
      s.schemaname,
      s.indexrelname AS index_name,
      s.relname AS table_name
    FROM pg_catalog.pg_stat_user_indexes s
    JOIN pg_catalog.pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisprimary
      AND NOT i.indisunique
      -- Still skip constraint-backing indexes
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid
      )
    ORDER BY s.indexrelname
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.index_name);
    drop_count := drop_count + 1;
    RAISE NOTICE 'dropped [%]: %.% (table: %)',
      drop_count, idx.schemaname, idx.index_name, idx.table_name;
  END LOOP;

  RAISE NOTICE '=== Dropped % unused indexes ===', drop_count;
END $$;
