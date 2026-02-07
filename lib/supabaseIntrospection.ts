// =============================================================================
// Supabase Database Introspection
// =============================================================================
// Queries PostgreSQL system catalogs via Supabase to auto-discover:
//   - Column schemas and types
//   - Triggers on tables
//   - Foreign key relationships
//   - Indexes
//   - Materialized view definitions
//   - Row counts (approximate)
//
// Used by the admin docs page to enrich pageRegistry entries with live metadata.
// None of this needs to be manually maintained — it's always current.
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface TriggerInfo {
  trigger_name: string;
  event_manipulation: string;   // INSERT, UPDATE, DELETE
  action_timing: string;        // BEFORE, AFTER, INSTEAD OF
  action_statement: string;     // The function it calls
  action_condition: string | null; // WHEN clause if any
}

export interface ForeignKeyInfo {
  constraint_name: string;
  column_name: string;
  foreign_table: string;
  foreign_column: string;
}

export interface IndexInfo {
  index_name: string;
  index_definition: string;
  is_unique: boolean;
}

export interface MaterializedViewInfo {
  view_name: string;
  definition: string;
}

export interface TableMetadata {
  tableName: string;
  columns: ColumnInfo[];
  triggers: TriggerInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  approximateRowCount: number;
}

// -----------------------------------------------------------------------------
// Introspection Queries
// -----------------------------------------------------------------------------

/** Fetch column info for a table */
export async function getColumns(supabase: SupabaseClient, tableName: string): Promise<ColumnInfo[]> {
  const { data, error } = await supabase.rpc('introspect_columns', { target_table: tableName });
  if (error) {
    console.error(`[Introspection] columns error for ${tableName}:`, error);
    return [];
  }
  return data || [];
}

/** Fetch triggers on a table */
export async function getTriggers(supabase: SupabaseClient, tableName: string): Promise<TriggerInfo[]> {
  const { data, error } = await supabase.rpc('introspect_triggers', { target_table: tableName });
  if (error) {
    console.error(`[Introspection] triggers error for ${tableName}:`, error);
    return [];
  }
  return data || [];
}

/** Fetch foreign key relationships for a table */
export async function getForeignKeys(supabase: SupabaseClient, tableName: string): Promise<ForeignKeyInfo[]> {
  const { data, error } = await supabase.rpc('introspect_foreign_keys', { target_table: tableName });
  if (error) {
    console.error(`[Introspection] foreign keys error for ${tableName}:`, error);
    return [];
  }
  return data || [];
}

/** Fetch indexes on a table */
export async function getIndexes(supabase: SupabaseClient, tableName: string): Promise<IndexInfo[]> {
  const { data, error } = await supabase.rpc('introspect_indexes', { target_table: tableName });
  if (error) {
    console.error(`[Introspection] indexes error for ${tableName}:`, error);
    return [];
  }
  return data || [];
}

/** Get approximate row count (fast — uses pg_stat) */
export async function getApproxRowCount(supabase: SupabaseClient, tableName: string): Promise<number> {
  const { data, error } = await supabase.rpc('introspect_row_count', { target_table: tableName });
  if (error) {
    console.error(`[Introspection] row count error for ${tableName}:`, error);
    return 0;
  }
  return data?.[0]?.count ?? 0;
}

/** Fetch full metadata for a single table */
export async function getTableMetadata(supabase: SupabaseClient, tableName: string): Promise<TableMetadata> {
  const [columns, triggers, foreignKeys, indexes, approximateRowCount] = await Promise.all([
    getColumns(supabase, tableName),
    getTriggers(supabase, tableName),
    getForeignKeys(supabase, tableName),
    getIndexes(supabase, tableName),
    getApproxRowCount(supabase, tableName),
  ]);

  return { tableName, columns, triggers, foreignKeys, indexes, approximateRowCount };
}

/** Fetch metadata for multiple tables in parallel */
export async function getTablesMetadata(
  supabase: SupabaseClient,
  tableNames: string[]
): Promise<Record<string, TableMetadata>> {
  const results = await Promise.all(
    tableNames.map(name => getTableMetadata(supabase, name))
  );

  const map: Record<string, TableMetadata> = {};
  for (const meta of results) {
    map[meta.tableName] = meta;
  }
  return map;
}


// =============================================================================
// SQL Functions to Create in Supabase
// =============================================================================
// These RPC functions must exist in your Supabase database for introspection
// to work. Run this SQL once in the Supabase SQL Editor.
// =============================================================================

export const INTROSPECTION_SQL = `
-- =============================================================================
-- ORbit Introspection Functions
-- Run this once in Supabase SQL Editor to enable admin docs introspection.
-- =============================================================================

-- Columns for a table
CREATE OR REPLACE FUNCTION introspect_columns(target_table TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = target_table
  ORDER BY c.ordinal_position;
$$;

-- Triggers on a table
CREATE OR REPLACE FUNCTION introspect_triggers(target_table TEXT)
RETURNS TABLE (
  trigger_name TEXT,
  event_manipulation TEXT,
  action_timing TEXT,
  action_statement TEXT,
  action_condition TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    t.trigger_name::TEXT,
    t.event_manipulation::TEXT,
    t.action_timing::TEXT,
    t.action_statement::TEXT,
    t.action_condition::TEXT
  FROM information_schema.triggers t
  WHERE t.event_object_schema = 'public'
    AND t.event_object_table = target_table
  ORDER BY t.trigger_name;
$$;

-- Foreign keys for a table
CREATE OR REPLACE FUNCTION introspect_foreign_keys(target_table TEXT)
RETURNS TABLE (
  constraint_name TEXT,
  column_name TEXT,
  foreign_table TEXT,
  foreign_column TEXT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    tc.constraint_name::TEXT,
    kcu.column_name::TEXT,
    ccu.table_name::TEXT AS foreign_table,
    ccu.column_name::TEXT AS foreign_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = target_table
  ORDER BY kcu.column_name;
$$;

-- Indexes on a table
CREATE OR REPLACE FUNCTION introspect_indexes(target_table TEXT)
RETURNS TABLE (
  index_name TEXT,
  index_definition TEXT,
  is_unique BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    i.relname::TEXT AS index_name,
    pg_get_indexdef(i.oid)::TEXT AS index_definition,
    ix.indisunique AS is_unique
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = target_table
  ORDER BY i.relname;
$$;

-- Approximate row count (fast, from pg_stat)
CREATE OR REPLACE FUNCTION introspect_row_count(target_table TEXT)
RETURNS TABLE (count BIGINT) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT reltuples::BIGINT AS count
  FROM pg_class
  WHERE relname = target_table
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
$$;

-- Grant execute to authenticated users (global_admin check happens in RLS/app layer)
GRANT EXECUTE ON FUNCTION introspect_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION introspect_triggers(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION introspect_foreign_keys(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION introspect_indexes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION introspect_row_count(TEXT) TO authenticated;
`;