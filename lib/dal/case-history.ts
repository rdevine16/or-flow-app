/**
 * Data Access Layer — Case History
 *
 * DAL functions for querying case_history entries with FK resolution.
 * The case_history table is write-only via trigger — no insert/update functions here.
 */

import type { PostgrestError } from '@supabase/supabase-js'
import type { AnySupabaseClient, DALListResult } from './index'
import type {
  CaseHistoryEntry,
  CaseHistoryRow,
  CaseHistoryChangedField,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// FIELD DISPLAY LABELS
// =====================================================

/** Human-readable labels for tracked columns */
const FIELD_LABELS: Record<string, string> = {
  case_number: 'Case Number',
  scheduled_date: 'Scheduled Date',
  start_time: 'Start Time',
  status_id: 'Status',
  or_room_id: 'OR Room',
  procedure_type_id: 'Procedure',
  surgeon_id: 'Surgeon',
  patient_id: 'Patient',
  payer_id: 'Payer',
  operative_side: 'Side',
  notes: 'Notes',
  primary_diagnosis_code: 'Diagnosis',
  primary_diagnosis_desc: 'Diagnosis Desc',
  source: 'Source',
  external_case_id: 'External Case ID',
  external_system: 'External System',
  import_source: 'Import Source',
  data_validated: 'Validated',
  is_excluded_from_metrics: 'Excluded',
  cancelled_at: 'Cancelled At',
  cancellation_reason_id: 'Cancellation Reason',
  cancellation_notes: 'Cancel Notes',
  milestone_template_id: 'Milestone Template',
  is_draft: 'Draft',
}

export function getFieldLabel(column: string): string {
  return FIELD_LABELS[column] || column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// =====================================================
// QUERY FUNCTIONS
// =====================================================

/**
 * Get case history entries for a case, with user name resolution.
 * Returns entries in reverse chronological order (newest first).
 *
 * @param limit - Max entries to return (default 50)
 * @param offset - Offset for pagination (default 0)
 */
async function getCaseHistory(
  supabase: AnySupabaseClient,
  caseId: string,
  limit = 50,
  offset = 0,
): Promise<DALListResult<CaseHistoryEntry>> {
  const { data, error } = await supabase
    .from('case_history')
    .select(`
      id,
      case_id,
      facility_id,
      change_type,
      changed_fields,
      change_source,
      changed_by,
      ehr_integration_log_id,
      created_at,
      changed_by_user:users!changed_by(first_name, last_name)
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return { data: [], error }
  }

  const rows = (data || []) as unknown as CaseHistoryRow[]
  const entries = rows.map(rowToEntry)

  return { data: entries, error: null }
}

/**
 * Get the count of history entries for a case.
 * Useful for "Load more" UI when count > limit.
 */
async function getCaseHistoryCount(
  supabase: AnySupabaseClient,
  caseId: string,
): Promise<{ count: number; error: PostgrestError | null }> {
  const { count, error } = await supabase
    .from('case_history')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)

  return { count: count ?? 0, error }
}

// =====================================================
// FK RESOLUTION (BATCH)
// =====================================================

/**
 * Resolve FK UUIDs in changed_fields to display names.
 * Call this after getCaseHistory to enrich the entries.
 *
 * Resolves: surgeon_id, procedure_type_id, or_room_id, patient_id, status_id, payer_id
 */
export async function resolveChangedFieldNames(
  supabase: AnySupabaseClient,
  entries: CaseHistoryEntry[],
): Promise<CaseHistoryEntry[]> {
  // Collect all unique UUIDs per FK type
  const uuids: Record<string, Set<string>> = {
    surgeon_id: new Set(),
    procedure_type_id: new Set(),
    or_room_id: new Set(),
    patient_id: new Set(),
    status_id: new Set(),
    payer_id: new Set(),
  }

  for (const entry of entries) {
    for (const [field, change] of Object.entries(entry.changedFields)) {
      if (field in uuids) {
        if (change.old) uuids[field].add(change.old)
        if (change.new) uuids[field].add(change.new)
      }
    }
  }

  // Batch-fetch display names for each FK type
  const lookups = await Promise.all([
    fetchLookup(supabase, 'users', [...uuids.surgeon_id], r => `${r.first_name || ''} ${r.last_name || ''}`.trim()),
    fetchLookup(supabase, 'procedure_types', [...uuids.procedure_type_id], r => r.name || ''),
    fetchLookup(supabase, 'or_rooms', [...uuids.or_room_id], r => r.name || ''),
    fetchLookup(supabase, 'patients', [...uuids.patient_id], r => `${r.first_name || ''} ${r.last_name || ''}`.trim()),
    fetchLookup(supabase, 'case_statuses', [...uuids.status_id], r => r.name || ''),
    fetchLookup(supabase, 'payers', [...uuids.payer_id], r => r.name || ''),
  ])

  const nameMap: Record<string, Record<string, string>> = {
    surgeon_id: lookups[0],
    procedure_type_id: lookups[1],
    or_room_id: lookups[2],
    patient_id: lookups[3],
    status_id: lookups[4],
    payer_id: lookups[5],
  }

  // Enrich entries with resolved names
  return entries.map(entry => ({
    ...entry,
    changedFields: Object.fromEntries(
      Object.entries(entry.changedFields).map(([field, change]) => {
        if (field in nameMap) {
          const map = nameMap[field]
          return [field, {
            old: change.old ? (map[change.old] || change.old) : null,
            new: change.new ? (map[change.new] || change.new) : null,
          }]
        }
        // Boolean fields: display as Yes/No
        if (field === 'data_validated' || field === 'is_excluded_from_metrics' || field === 'is_draft') {
          return [field, {
            old: change.old === 'true' ? 'Yes' : change.old === 'false' ? 'No' : change.old,
            new: change.new === 'true' ? 'Yes' : change.new === 'false' ? 'No' : change.new,
          }]
        }
        return [field, change]
      }),
    ) as Record<string, CaseHistoryChangedField>,
  }))
}

/** Fetch a lookup table and return a map of id → display name */
async function fetchLookup(
  supabase: AnySupabaseClient,
  table: string,
  ids: string[],
  formatName: (row: Record<string, string | null>) => string,
): Promise<Record<string, string>> {
  if (ids.length === 0) return {}

  const { data } = await supabase
    .from(table)
    .select('id, first_name, last_name, name')
    .in('id', ids)

  const map: Record<string, string> = {}
  if (data) {
    for (const row of data as Record<string, string | null>[]) {
      if (row.id) {
        map[row.id] = formatName(row)
      }
    }
  }
  return map
}

// =====================================================
// ROW TRANSFORMATION
// =====================================================

function rowToEntry(row: CaseHistoryRow): CaseHistoryEntry {
  const user = row.changed_by_user
  let changedByName: string | null = null
  if (user) {
    changedByName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || null
  }

  return {
    id: row.id,
    caseId: row.case_id,
    facilityId: row.facility_id,
    changeType: row.change_type,
    changedFields: row.changed_fields || {},
    changeSource: row.change_source,
    changedBy: row.changed_by,
    changedByName,
    ehrIntegrationLogId: row.ehr_integration_log_id,
    createdAt: row.created_at,
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const caseHistoryDAL = {
  getCaseHistory,
  getCaseHistoryCount,
  getFieldLabel,
  resolveChangedFieldNames,
}
