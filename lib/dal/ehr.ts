/**
 * Data Access Layer — EHR Integrations
 *
 * DAL functions for ehr_integrations, ehr_integration_log, ehr_entity_mappings
 * following existing patterns in lib/dal/epic.ts.
 * Every function takes `supabase` as first arg and returns `{ data, error }`.
 */

import type { PostgrestError } from '@supabase/supabase-js'
import type { AnySupabaseClient, DALResult, DALListResult } from './index'
import type {
  EhrIntegration,
  EhrIntegrationLog,
  EhrEntityMapping,
  EhrIntegrationInsert,
  EhrIntegrationLogInsert,
  EhrEntityMappingInsert,
  EhrEntityType,
  EhrProcessingStatus,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// EHR INTEGRATIONS
// =====================================================

/** Get an integration by ID */
async function getIntegration(
  supabase: AnySupabaseClient,
  integrationId: string
): Promise<DALResult<EhrIntegration>> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  return { data: data as unknown as EhrIntegration | null, error }
}

/** Get an integration by facility and type */
async function getIntegrationByFacility(
  supabase: AnySupabaseClient,
  facilityId: string,
  integrationType: string
): Promise<DALResult<EhrIntegration>> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('integration_type', integrationType)
    .maybeSingle()

  return { data: data as unknown as EhrIntegration | null, error }
}

/** List all integrations for a facility */
async function listIntegrations(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrIntegration>> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })

  return { data: (data as unknown as EhrIntegration[]) || [], error }
}

/** Create or update an integration (upsert on facility_id + integration_type) */
async function upsertIntegration(
  supabase: AnySupabaseClient,
  integration: EhrIntegrationInsert
): Promise<DALResult<EhrIntegration>> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .upsert(integration, { onConflict: 'facility_id,integration_type' })
    .select('*')
    .single()

  return { data: data as unknown as EhrIntegration | null, error }
}

/** Look up integration by API key — critical for Edge Function auth.
 *  Queries config->>'api_key' using the GIN index. */
async function getIntegrationByApiKey(
  supabase: AnySupabaseClient,
  apiKey: string
): Promise<DALResult<EhrIntegration>> {
  const { data, error } = await supabase
    .from('ehr_integrations')
    .select('*')
    .eq('config->>api_key', apiKey)
    .eq('is_active', true)
    .maybeSingle()

  return { data: data as unknown as EhrIntegration | null, error }
}

// =====================================================
// EHR INTEGRATION LOG
// =====================================================

/** Create a log entry for an inbound message */
async function createLogEntry(
  supabase: AnySupabaseClient,
  entry: EhrIntegrationLogInsert
): Promise<DALResult<EhrIntegrationLog>> {
  const { data, error } = await supabase
    .from('ehr_integration_log')
    .insert(entry)
    .select('*')
    .single()

  return { data: data as unknown as EhrIntegrationLog | null, error }
}

/** Update a log entry (e.g., after processing or review) */
async function updateLogEntry(
  supabase: AnySupabaseClient,
  logId: string,
  updates: Partial<Pick<EhrIntegrationLog,
    'processing_status' | 'error_message' | 'case_id' |
    'review_notes' | 'reviewed_by' | 'reviewed_at' | 'processed_at'
  >>
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_integration_log')
    .update(updates)
    .eq('id', logId)

  return { error }
}

/** Get a single log entry by ID */
async function getLogEntry(
  supabase: AnySupabaseClient,
  logId: string
): Promise<DALResult<EhrIntegrationLog>> {
  const { data, error } = await supabase
    .from('ehr_integration_log')
    .select('*')
    .eq('id', logId)
    .single()

  return { data: data as unknown as EhrIntegrationLog | null, error }
}

/** List log entries for a facility with optional filters */
async function listLogEntries(
  supabase: AnySupabaseClient,
  facilityId: string,
  options?: {
    status?: EhrProcessingStatus
    messageType?: string
    limit?: number
    offset?: number
  }
): Promise<DALListResult<EhrIntegrationLog>> {
  let q = supabase
    .from('ehr_integration_log')
    .select('*', { count: 'exact' })
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })

  if (options?.status) {
    q = q.eq('processing_status', options.status)
  }
  if (options?.messageType) {
    q = q.eq('message_type', options.messageType)
  }
  if (options?.limit) {
    q = q.limit(options.limit)
  }
  if (options?.offset) {
    q = q.range(options.offset, options.offset + (options.limit || 25) - 1)
  }

  const { data, error, count } = await q
  return {
    data: (data as unknown as EhrIntegrationLog[]) || [],
    error,
    count: count ?? undefined,
  }
}

/** List pending review entries for a facility (review queue) */
async function listPendingReviews(
  supabase: AnySupabaseClient,
  facilityId: string,
  options?: { limit?: number; offset?: number }
): Promise<DALListResult<EhrIntegrationLog>> {
  return listLogEntries(supabase, facilityId, {
    status: 'pending_review',
    limit: options?.limit,
    offset: options?.offset,
  })
}

/** Check for duplicate message by message_control_id (MSH-10) */
async function checkDuplicateMessage(
  supabase: AnySupabaseClient,
  integrationId: string,
  messageControlId: string
): Promise<DALResult<EhrIntegrationLog>> {
  const { data, error } = await supabase
    .from('ehr_integration_log')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('message_control_id', messageControlId)
    .in('processing_status', ['processed', 'pending_review'])
    .maybeSingle()

  return { data: data as unknown as EhrIntegrationLog | null, error }
}

// =====================================================
// EHR ENTITY MAPPINGS
// =====================================================

/** Get a specific entity mapping by external identifier */
async function getEntityMapping(
  supabase: AnySupabaseClient,
  integrationId: string,
  entityType: EhrEntityType,
  externalIdentifier: string
): Promise<DALResult<EhrEntityMapping>> {
  const { data, error } = await supabase
    .from('ehr_entity_mappings')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('entity_type', entityType)
    .eq('external_identifier', externalIdentifier)
    .maybeSingle()

  return { data: data as unknown as EhrEntityMapping | null, error }
}

/** Save (upsert) an entity mapping */
async function saveEntityMapping(
  supabase: AnySupabaseClient,
  mapping: EhrEntityMappingInsert
): Promise<DALResult<EhrEntityMapping>> {
  const { data, error } = await supabase
    .from('ehr_entity_mappings')
    .upsert(mapping, {
      onConflict: 'integration_id,entity_type,external_identifier',
    })
    .select('*')
    .single()

  return { data: data as unknown as EhrEntityMapping | null, error }
}

/** List entity mappings for an integration, optionally filtered by type */
async function listEntityMappings(
  supabase: AnySupabaseClient,
  integrationId: string,
  entityType?: EhrEntityType
): Promise<DALListResult<EhrEntityMapping>> {
  let q = supabase
    .from('ehr_entity_mappings')
    .select('*')
    .eq('integration_id', integrationId)
    .order('external_display_name', { ascending: true })

  if (entityType) {
    q = q.eq('entity_type', entityType)
  }

  const { data, error } = await q
  return { data: (data as unknown as EhrEntityMapping[]) || [], error }
}

/** Delete an entity mapping */
async function deleteEntityMapping(
  supabase: AnySupabaseClient,
  mappingId: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_entity_mappings')
    .delete()
    .eq('id', mappingId)

  return { error }
}

// =====================================================
// EXPORT
// =====================================================

export const ehrDAL = {
  // Integrations
  getIntegration,
  getIntegrationByFacility,
  listIntegrations,
  upsertIntegration,
  getIntegrationByApiKey,
  // Log
  createLogEntry,
  updateLogEntry,
  getLogEntry,
  listLogEntries,
  listPendingReviews,
  checkDuplicateMessage,
  // Entity Mappings
  getEntityMapping,
  saveEntityMapping,
  listEntityMappings,
  deleteEntityMapping,
}
