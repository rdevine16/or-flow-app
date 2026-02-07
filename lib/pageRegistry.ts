// =============================================================================
// ORbit Page Registry — Supabase-backed documentation system
// =============================================================================
// All page documentation lives in the `page_registry` table.
// This file provides types and CRUD helpers.
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PageCategory =
  | 'Surgeon-Facing'
  | 'Admin'
  | 'Global Admin'
  | 'Shared'
  | 'Auth'
  | 'API Routes'

export const PAGE_CATEGORIES: PageCategory[] = [
  'Surgeon-Facing',
  'Admin',
  'Global Admin',
  'Shared',
  'Auth',
  'API Routes',
]

export const ROLE_OPTIONS = [
  'global_admin',
  'facility_admin',
  'surgeon',
  'anesthesiologist',
  'nurse',
  'tech',
  'staff',
  'user',
] as const

export interface PageEntry {
  id: string
  name: string
  route: string
  category: PageCategory
  description: string
  roles: string[]

  reads: string[]
  writes: string[]
  rpcs: string[]
  realtime: string[]
  materialized_views: string[]

  calculation_engine: string | null
  key_validations: string[]
  timezone_aware: boolean

  ios_exists: boolean
  ios_view_name: string | null
  ios_notes: string | null
  parity_notes: string | null

  components: string[]
  interactions: string[]
  state_management: string | null

  api_routes: string[]

  owner: string | null
  notes: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type PageEntryInsert = Omit<PageEntry, 'created_at' | 'updated_at'>

// Default values for a new page entry
export function createEmptyPage(): PageEntryInsert {
  return {
    id: '',
    name: '',
    route: '',
    category: 'Shared',
    description: '',
    roles: [],
    reads: [],
    writes: [],
    rpcs: [],
    realtime: [],
    materialized_views: [],
    calculation_engine: null,
    key_validations: [],
    timezone_aware: false,
    ios_exists: false,
    ios_view_name: null,
    ios_notes: null,
    parity_notes: null,
    components: [],
    interactions: [],
    state_management: null,
    api_routes: [],
    owner: null,
    notes: null,
    display_order: 0,
  }
}

// -----------------------------------------------------------------------------
// CRUD Operations
// -----------------------------------------------------------------------------

/** Fetch all pages ordered by category + display_order */
export async function fetchPages(supabase: SupabaseClient): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('page_registry')
    .select('*')
    .order('category')
    .order('display_order')
    .order('name')

  if (error) {
    console.error('[PageRegistry] fetch error:', error)
    return []
  }
  return data || []
}

/** Insert a new page */
export async function insertPage(
  supabase: SupabaseClient,
  page: PageEntryInsert
): Promise<{ data: PageEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry')
    .insert(page)
    .select()
    .single()

  if (error) {
    console.error('[PageRegistry] insert error:', error)
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

/** Update an existing page */
export async function updatePage(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<PageEntryInsert>
): Promise<{ data: PageEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[PageRegistry] update error:', error)
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

/** Delete a page */
export async function deletePage(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('page_registry')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[PageRegistry] delete error:', error)
    return { error: error.message }
  }
  return { error: null }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Group pages by category */
export function groupByCategory(pages: PageEntry[]): Record<string, PageEntry[]> {
  const grouped: Record<string, PageEntry[]> = {}
  for (const page of pages) {
    if (!grouped[page.category]) grouped[page.category] = []
    grouped[page.category].push(page)
  }
  return grouped
}

/** Get all unique table names across all pages */
export function getAllTables(pages: PageEntry[]): string[] {
  const tables = new Set<string>()
  for (const page of pages) {
    page.reads.forEach(t => tables.add(t))
    page.writes.forEach(t => tables.add(t))
  }
  return Array.from(tables).sort()
}

/** Find which pages depend on a given table */
export function getPagesByTable(pages: PageEntry[], tableName: string): PageEntry[] {
  return pages.filter(
    p => p.reads.includes(tableName) || p.writes.includes(tableName)
  )
}

/** Generate an ID slug from a name */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}