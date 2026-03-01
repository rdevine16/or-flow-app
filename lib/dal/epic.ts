/**
 * Data Access Layer — Epic Integration
 *
 * DAL functions for all Epic tables following existing patterns in lib/dal/cases.ts.
 * Every function takes `supabase` as first arg and returns `{ data, error }`.
 */

import type { PostgrestError } from '@supabase/supabase-js'
import type { AnySupabaseClient, DALResult, DALListResult } from './index'
import type {
  EpicConnection,
  EpicEntityMapping,
  EpicFieldMapping,
  EpicImportLogEntry,
  EpicMappingType,
} from '@/lib/epic/types'

// =====================================================
// EPIC CONNECTIONS
// =====================================================

/** Get the Epic connection for a facility */
async function getConnection(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALResult<EpicConnection>> {
  const { data, error } = await supabase
    .from('epic_connections')
    .select('*')
    .eq('facility_id', facilityId)
    .single()

  return { data: data as unknown as EpicConnection | null, error }
}

/** Connection status subset — safe for non-admin users */
interface ConnectionStatusResult {
  id: string
  status: string
  last_connected_at: string | null
  connected_by: string | null
  token_expires_at: string | null
  fhir_base_url: string
}

/** Get connection status (limited fields — safe for non-admin users).
 * Uses a security-definer RPC to prevent non-admin access to token columns. */
async function getConnectionStatus(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALResult<ConnectionStatusResult>> {
  const { data, error } = await supabase
    .rpc('get_epic_connection_status', { p_facility_id: facilityId })
    .single()

  return { data: data as unknown as ConnectionStatusResult | null, error }
}

/** Create or update an Epic connection (upsert on facility_id) */
async function upsertConnection(
  supabase: AnySupabaseClient,
  facilityId: string,
  connectionData: {
    fhir_base_url: string
    client_id: string
    status?: string
    connected_by?: string
  }
): Promise<DALResult<EpicConnection>> {
  const { data, error } = await supabase
    .from('epic_connections')
    .upsert(
      {
        facility_id: facilityId,
        fhir_base_url: connectionData.fhir_base_url,
        client_id: connectionData.client_id,
        status: connectionData.status || 'disconnected',
        connected_by: connectionData.connected_by,
      },
      { onConflict: 'facility_id' }
    )
    .select('*')
    .single()

  return { data: data as unknown as EpicConnection | null, error }
}

/** Update connection fields */
async function updateConnection(
  supabase: AnySupabaseClient,
  facilityId: string,
  updates: Partial<Pick<EpicConnection, 'status' | 'last_connected_at' | 'last_error' | 'access_token' | 'refresh_token' | 'token_expires_at' | 'token_scopes' | 'connected_by'>>
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('epic_connections')
    .update(updates)
    .eq('facility_id', facilityId)

  return { error }
}

// =====================================================
// EPIC ENTITY MAPPINGS
// =====================================================

/** List all entity mappings for a connection */
async function listEntityMappings(
  supabase: AnySupabaseClient,
  connectionId: string,
  mappingType?: EpicMappingType
): Promise<DALListResult<EpicEntityMapping>> {
  let q = supabase
    .from('epic_entity_mappings')
    .select('*')
    .eq('connection_id', connectionId)
    .order('epic_display_name', { ascending: true })

  if (mappingType) {
    q = q.eq('mapping_type', mappingType)
  }

  const { data, error } = await q
  return { data: (data as unknown as EpicEntityMapping[]) || [], error }
}

/** Upsert an entity mapping */
async function upsertEntityMapping(
  supabase: AnySupabaseClient,
  mappingData: {
    facility_id: string
    connection_id: string
    mapping_type: EpicMappingType
    epic_resource_type: string
    epic_resource_id: string
    epic_display_name?: string
    orbit_entity_id?: string
    match_method?: 'auto' | 'manual'
    match_confidence?: number
  }
): Promise<DALResult<EpicEntityMapping>> {
  const { data, error } = await supabase
    .from('epic_entity_mappings')
    .upsert(mappingData, {
      onConflict: 'connection_id,mapping_type,epic_resource_id',
    })
    .select('*')
    .single()

  return { data: data as unknown as EpicEntityMapping | null, error }
}

/** Delete an entity mapping */
async function deleteEntityMapping(
  supabase: AnySupabaseClient,
  mappingId: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('epic_entity_mappings')
    .delete()
    .eq('id', mappingId)

  return { error }
}

/** Mapping stats row shape */
interface MappingStatRow {
  mapping_type: string
  orbit_entity_id: string | null
}

/** Get mapping stats for a connection (count by type and mapped/unmapped) */
async function getMappingStats(
  supabase: AnySupabaseClient,
  connectionId: string
): Promise<DALListResult<MappingStatRow>> {
  const { data, error } = await supabase
    .from('epic_entity_mappings')
    .select('mapping_type, orbit_entity_id')
    .eq('connection_id', connectionId)

  return { data: (data as unknown as MappingStatRow[]) || [], error }
}

// =====================================================
// EPIC FIELD MAPPINGS (global)
// =====================================================

/** List all field mappings */
async function listFieldMappings(
  supabase: AnySupabaseClient,
  activeOnly = false
): Promise<DALListResult<EpicFieldMapping>> {
  let q = supabase
    .from('epic_field_mappings')
    .select('*')
    .order('fhir_resource_type', { ascending: true })
    .order('fhir_field_path', { ascending: true })

  if (activeOnly) {
    q = q.eq('is_active', true)
  }

  const { data, error } = await q
  return { data: (data as unknown as EpicFieldMapping[]) || [], error }
}

/** Batch update field mappings */
async function batchUpdateFieldMappings(
  supabase: AnySupabaseClient,
  mappings: Array<{
    id: string
    orbit_table?: string
    orbit_column?: string
    label?: string
    description?: string
    is_active?: boolean
  }>
): Promise<{ success: boolean; error: string | null }> {
  const results = await Promise.all(
    mappings.map(({ id, ...updates }) =>
      supabase
        .from('epic_field_mappings')
        .update(updates)
        .eq('id', id)
    )
  )

  const firstError = results.find(r => r.error)
  if (firstError?.error) {
    return { success: false, error: firstError.error.message }
  }

  return { success: true, error: null }
}

/** Reset field mappings to defaults (delete all + re-seed) */
async function resetFieldMappingsToDefaults(
  supabase: AnySupabaseClient
): Promise<{ success: boolean; error: string | null }> {
  // Delete all existing
  const { error: deleteError } = await supabase
    .from('epic_field_mappings')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // Re-seed defaults
  const defaults = [
    { fhir_resource_type: 'Appointment', fhir_field_path: 'start', orbit_table: 'cases', orbit_column: 'scheduled_date', label: 'Surgery Date', description: 'Maps appointment start date to case scheduled date' },
    { fhir_resource_type: 'Appointment', fhir_field_path: 'start', orbit_table: 'cases', orbit_column: 'start_time', label: 'Surgery Time', description: 'Maps appointment start time to case start time' },
    { fhir_resource_type: 'Appointment', fhir_field_path: 'serviceType', orbit_table: 'cases', orbit_column: 'procedure_type_id', label: 'Procedure Type', description: 'Maps service type to ORbit procedure (via entity mapping)' },
    { fhir_resource_type: 'Patient', fhir_field_path: 'name.family', orbit_table: 'patients', orbit_column: 'last_name', label: 'Patient Last Name', description: 'Maps patient family name' },
    { fhir_resource_type: 'Patient', fhir_field_path: 'name.given', orbit_table: 'patients', orbit_column: 'first_name', label: 'Patient First Name', description: 'Maps patient given name' },
    { fhir_resource_type: 'Patient', fhir_field_path: 'birthDate', orbit_table: 'patients', orbit_column: 'date_of_birth', label: 'Date of Birth', description: 'Maps patient birth date' },
    { fhir_resource_type: 'Patient', fhir_field_path: 'identifier[MRN]', orbit_table: 'patients', orbit_column: 'mrn', label: 'Medical Record Number', description: 'Maps patient MRN identifier' },
    { fhir_resource_type: 'Practitioner', fhir_field_path: 'name', orbit_table: 'surgeons', orbit_column: 'id', label: 'Surgeon', description: 'Maps practitioner to ORbit surgeon (via entity mapping)' },
    { fhir_resource_type: 'Location', fhir_field_path: 'name', orbit_table: 'rooms', orbit_column: 'id', label: 'Operating Room', description: 'Maps location to ORbit room (via entity mapping)' },
  ]

  const { error: seedError } = await supabase
    .from('epic_field_mappings')
    .insert(defaults)

  if (seedError) {
    return { success: false, error: seedError.message }
  }

  return { success: true, error: null }
}

// =====================================================
// EPIC IMPORT LOG
// =====================================================

/** Create an import log entry */
async function createImportLogEntry(
  supabase: AnySupabaseClient,
  entry: {
    facility_id: string
    connection_id: string
    fhir_appointment_id?: string
    fhir_service_request_id?: string
    orbit_case_id?: string
    status: 'pending' | 'success' | 'failed' | 'skipped' | 'duplicate'
    error_message?: string
    fhir_resource_snapshot?: Record<string, unknown>
    field_mapping_applied?: Record<string, unknown>
    imported_by: string
  }
): Promise<DALResult<EpicImportLogEntry>> {
  const { data, error } = await supabase
    .from('epic_import_log')
    .insert(entry)
    .select('*')
    .single()

  return { data: data as unknown as EpicImportLogEntry | null, error }
}

/** List import log entries for a facility */
async function listImportLog(
  supabase: AnySupabaseClient,
  facilityId: string,
  options?: { limit?: number; offset?: number }
): Promise<DALListResult<EpicImportLogEntry>> {
  let q = supabase
    .from('epic_import_log')
    .select('*')
    .eq('facility_id', facilityId)
    .order('imported_at', { ascending: false })

  if (options?.limit) {
    q = q.limit(options.limit)
  }
  if (options?.offset) {
    q = q.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await q
  return { data: (data as unknown as EpicImportLogEntry[]) || [], error }
}

/** Check if a FHIR appointment has already been imported */
async function checkDuplicateImport(
  supabase: AnySupabaseClient,
  facilityId: string,
  fhirAppointmentId: string
): Promise<DALResult<EpicImportLogEntry>> {
  const { data, error } = await supabase
    .from('epic_import_log')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('fhir_appointment_id', fhirAppointmentId)
    .eq('status', 'success')
    .maybeSingle()

  return { data: data as unknown as EpicImportLogEntry | null, error }
}

// =====================================================
// EXPORT
// =====================================================

export const epicDAL = {
  // Connections
  getConnection,
  getConnectionStatus,
  upsertConnection,
  updateConnection,
  // Entity Mappings
  listEntityMappings,
  upsertEntityMapping,
  deleteEntityMapping,
  getMappingStats,
  // Field Mappings
  listFieldMappings,
  batchUpdateFieldMappings,
  resetFieldMappingsToDefaults,
  // Import Log
  createImportLogEntry,
  listImportLog,
  checkDuplicateImport,
}
