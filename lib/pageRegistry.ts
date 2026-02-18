// =============================================================================
// ORbit Page Registry — Supabase-backed documentation system
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'

// -----------------------------------------------------------------------------
// Category types
// -----------------------------------------------------------------------------

export interface Category {
  id: string
  name: string
  description: string
  color: string
  display_order: number
  created_at: string
  updated_at: string
}

export type CategoryInsert = Omit<Category, 'created_at' | 'updated_at'>

/** Fallback category names if the table hasn't been seeded */
export const DEFAULT_CATEGORIES: string[] = [
  'Surgeon-Facing', 'Admin', 'Global Admin', 'Shared', 'Auth', 'API Routes',
]

export const CATEGORY_COLOR_OPTIONS = [
  { id: 'blue',    label: 'Blue' },
  { id: 'amber',   label: 'Amber' },
  { id: 'red',     label: 'Red' },
  { id: 'green', label: 'Green' },
  { id: 'violet',  label: 'Violet' },
  { id: 'cyan',    label: 'Cyan' },
  { id: 'slate',   label: 'Slate' },
  { id: 'rose',    label: 'Rose' },
  { id: 'orange',  label: 'Orange' },
  { id: 'teal',    label: 'Teal' },
] as const

// -----------------------------------------------------------------------------
// Page types
// -----------------------------------------------------------------------------

/** Category stored on pages is the category display name string */
export type PageCategory = string

export const ROLE_OPTIONS = [
  'global_admin', 'facility_admin', 'surgeon', 'anesthesiologist',
  'nurse', 'tech', 'staff', 'user',
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
  http_methods: string[]
  owner: string | null
  notes: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type PageEntryInsert = Omit<PageEntry, 'created_at' | 'updated_at'>

// -----------------------------------------------------------------------------
// Field classification — which fields the scanner can overwrite
// -----------------------------------------------------------------------------

export const AUTO_FIELDS: (keyof PageEntryInsert)[] = [
  'reads', 'writes', 'rpcs', 'realtime', 'components',
  'api_routes', 'http_methods', 'interactions',
  'calculation_engine', 'timezone_aware', 'state_management', 'key_validations',
]

export const MANUAL_FIELDS: (keyof PageEntryInsert)[] = [
  'id', 'name', 'route', 'category', 'description', 'roles',
  'materialized_views', 'ios_exists', 'ios_view_name', 'ios_notes',
  'parity_notes', 'owner', 'notes', 'display_order',
]

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

export function createEmptyPage(): PageEntryInsert {
  return {
    id: '', name: '', route: '', category: 'Shared', description: '', roles: [],
    reads: [], writes: [], rpcs: [], realtime: [], materialized_views: [],
    calculation_engine: null, key_validations: [], timezone_aware: false,
    ios_exists: false, ios_view_name: null, ios_notes: null, parity_notes: null,
    components: [], interactions: [], state_management: null,
    api_routes: [], http_methods: [],
    owner: null, notes: null, display_order: 0,
  }
}

// -----------------------------------------------------------------------------
// Category CRUD
// -----------------------------------------------------------------------------

export async function fetchCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('page_registry_categories')
    .select('*')
    .order('display_order')
    .order('name')
  if (error) { console.error('[Registry] fetchCategories:', error); return [] }
  return data || []
}

export async function insertCategory(
  supabase: SupabaseClient,
  cat: CategoryInsert
): Promise<{ data: Category | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry_categories').insert(cat).select().single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CategoryInsert>
): Promise<{ data: Category | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry_categories').update(updates).eq('id', id).select().single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function deleteCategory(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('page_registry_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export function generateCategorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// -----------------------------------------------------------------------------
// Page CRUD
// -----------------------------------------------------------------------------

export async function fetchPages(supabase: SupabaseClient): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('page_registry')
    .select('*')
    .order('category').order('display_order').order('name')
  if (error) { console.error('[Registry] fetchPages:', error); return [] }
  return (data || []).map(p => ({ ...p, http_methods: p.http_methods || [] }))
}

export async function insertPage(
  supabase: SupabaseClient,
  page: PageEntryInsert
): Promise<{ data: PageEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry').insert(page).select().single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function updatePage(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<PageEntryInsert>
): Promise<{ data: PageEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('page_registry').update(updates).eq('id', id).select().single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function deletePage(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('page_registry').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

// -----------------------------------------------------------------------------
// Smart merge — update only auto-detected fields, preserve manual fields
// -----------------------------------------------------------------------------

export interface DriftResult {
  field: string
  registryValue: unknown
  scannedValue: unknown
}

export function detectDrift(existing: PageEntry, scanned: Record<string, unknown>): DriftResult[] {
  const drifts: DriftResult[] = []
  for (const field of AUTO_FIELDS) {
    const regVal = existing[field]
    const scanVal = scanned[field]
    if (scanVal === undefined) continue
    if (Array.isArray(regVal) && Array.isArray(scanVal)) {
      if (JSON.stringify([...regVal].sort()) !== JSON.stringify([...scanVal].sort())) {
        drifts.push({ field, registryValue: regVal, scannedValue: scanVal })
      }
    } else if (regVal !== scanVal) {
      drifts.push({ field, registryValue: regVal, scannedValue: scanVal })
    }
  }
  return drifts
}

export async function syncAutoFields(
  supabase: SupabaseClient,
  id: string,
  scannedData: Record<string, unknown>
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}
  for (const field of AUTO_FIELDS) {
    if (scannedData[field] !== undefined) updates[field] = scannedData[field]
  }
  if (Object.keys(updates).length === 0) return { error: null }
  const { error } = await supabase.from('page_registry').update(updates).eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Group pages by category name, sorted by category display_order */
export function groupByCategory(
  pages: PageEntry[],
  categories: Category[]
): [string, PageEntry[]][] {
  const grouped: Record<string, PageEntry[]> = {}
  for (const page of pages) {
    if (!grouped[page.category]) grouped[page.category] = []
    grouped[page.category].push(page)
  }
  const catOrder = new Map(categories.map(c => [c.name, c.display_order]))
  return Object.entries(grouped).sort(([a], [b]) =>
    (catOrder.get(a) ?? 999) - (catOrder.get(b) ?? 999)
  )
}

export function getAllTables(pages: PageEntry[]): string[] {
  const tables = new Set<string>()
  for (const page of pages) {
    page.reads.forEach(t => tables.add(t))
    page.writes.forEach(t => tables.add(t))
  }
  return Array.from(tables).sort()
}

export function getPagesByTable(pages: PageEntry[], tableName: string): PageEntry[] {
  return pages.filter(p => p.reads.includes(tableName) || p.writes.includes(tableName))
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export function exportRegistryJSON(pages: PageEntry[], categories: Category[]): string {
  return JSON.stringify({ categories, pages }, null, 2)
}

export function exportRegistryMarkdown(pages: PageEntry[], categories: Category[]): string {
  const grouped = groupByCategory(pages, categories)
  let md = '# ORbit Page Registry\n\n'
  md += `Generated: ${new Date().toISOString()}\n\n`
  md += `Total entries: ${pages.length}\n\n`

  for (const [categoryName, catPages] of grouped) {
    const cat = categories.find(c => c.name === categoryName)
    md += `## ${categoryName}\n\n`
    if (cat?.description) md += `_${cat.description}_\n\n`
    for (const page of catPages) {
      md += `### ${page.name}\n\n`
      md += `- **Route:** \`${page.route}\`\n`
      if (page.description) md += `- **Description:** ${page.description}\n`
      md += `- **Roles:** ${page.roles.join(', ') || 'none'}\n`
      if (page.reads.length) md += `- **Reads:** ${page.reads.map(t => `\`${t}\``).join(', ')}\n`
      if (page.writes.length) md += `- **Writes:** ${page.writes.map(t => `\`${t}\``).join(', ')}\n`
      if (page.rpcs.length) md += `- **RPCs:** ${page.rpcs.map(r => `\`${r}\``).join(', ')}\n`
      if (page.http_methods.length) md += `- **HTTP Methods:** ${page.http_methods.join(', ')}\n`
      if (page.components.length) md += `- **Components:** ${page.components.join(', ')}\n`
      if (page.ios_exists) md += `- **iOS:** ${page.ios_view_name || 'Yes'}\n`
      if (page.notes) md += `- **Notes:** ${page.notes}\n`
      md += '\n'
    }
  }
  return md
}