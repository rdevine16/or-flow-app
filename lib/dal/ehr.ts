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
    integrationId?: string
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

  if (options?.integrationId) {
    q = q.eq('integration_id', options.integrationId)
  }
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
  options?: { integrationId?: string; limit?: number; offset?: number }
): Promise<DALListResult<EhrIntegrationLog>> {
  return listLogEntries(supabase, facilityId, {
    integrationId: options?.integrationId,
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
// REVIEW QUEUE OPERATIONS
// =====================================================

/** Approve a pending import — update log status to 'processed' and link to case */
async function approveImport(
  supabase: AnySupabaseClient,
  logId: string,
  caseId: string,
  reviewedBy: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_integration_log')
    .update({
      processing_status: 'processed',
      case_id: caseId,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    })
    .eq('id', logId)

  return { error }
}

/** Reject a pending import — update log status to 'ignored' with reason */
async function rejectImport(
  supabase: AnySupabaseClient,
  logId: string,
  reason: string,
  reviewedBy: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_integration_log')
    .update({
      processing_status: 'ignored',
      error_message: reason,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', logId)

  return { error }
}

/** Resolve an entity in a pending review — save entity mapping and update review_notes */
async function resolveEntity(
  supabase: AnySupabaseClient,
  logId: string,
  integrationId: string,
  facilityId: string,
  entityType: EhrEntityType,
  externalIdentifier: string,
  externalDisplayName: string,
  orbitEntityId: string,
  orbitDisplayName: string
): Promise<{ error: PostgrestError | null }> {
  // Save the entity mapping for future auto-resolution
  const { error: mappingError } = await saveEntityMapping(supabase, {
    facility_id: facilityId,
    integration_id: integrationId,
    entity_type: entityType,
    external_identifier: externalIdentifier,
    external_display_name: externalDisplayName,
    orbit_entity_id: orbitEntityId,
    orbit_display_name: orbitDisplayName,
    match_method: 'manual',
    match_confidence: 1.0,
  })

  if (mappingError) return { error: mappingError }

  // Clear the unmatched entry from review_notes
  const { data: logEntry, error: fetchError } = await getLogEntry(supabase, logId)
  if (fetchError || !logEntry) return { error: fetchError }

  const reviewNotes = { ...(logEntry.review_notes || {}) }
  const noteKey = `unmatched_${entityType}` as keyof typeof reviewNotes
  delete reviewNotes[noteKey]

  const { error: updateError } = await supabase
    .from('ehr_integration_log')
    .update({ review_notes: reviewNotes })
    .eq('id', logId)

  return { error: updateError }
}

/**
 * Resolve an entity for a SINGLE log entry only (case-level override).
 * Does NOT update ehr_entity_mappings — preserves the existing global mapping.
 * Stores the override in review_notes.matched_<entityType>.
 */
async function resolveEntityCaseOnly(
  supabase: AnySupabaseClient,
  logId: string,
  entityType: EhrEntityType,
  orbitEntityId: string,
  orbitDisplayName: string
): Promise<{ error: PostgrestError | null }> {
  const { data: logEntry, error: fetchError } = await getLogEntry(supabase, logId)
  if (fetchError || !logEntry) return { error: fetchError }

  const reviewNotes = { ...(logEntry.review_notes || {}) } as Record<string, unknown>
  // Store the case-level override
  reviewNotes[`matched_${entityType}`] = { orbit_entity_id: orbitEntityId, orbit_display_name: orbitDisplayName }
  // Clear unmatched entry if present (in case this was an unmatched entity)
  delete reviewNotes[`unmatched_${entityType}`]

  const { error: updateError } = await supabase
    .from('ehr_integration_log')
    .update({ review_notes: reviewNotes })
    .eq('id', logId)

  return { error: updateError }
}

/** Get integration stats (total imported, pending review, errors) */
async function getIntegrationStats(
  supabase: AnySupabaseClient,
  facilityId: string,
  integrationId?: string
): Promise<DALResult<{
  totalProcessed: number
  pendingReview: number
  errors: number
  messagesToday: number
}>> {
  const today = new Date().toISOString().substring(0, 10)

  // Helper to build a scoped count query
  const countQuery = (status?: EhrProcessingStatus) => {
    let q = supabase
      .from('ehr_integration_log')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
    if (integrationId) q = q.eq('integration_id', integrationId)
    if (status) q = q.eq('processing_status', status)
    return q
  }

  const [processedRes, pendingRes, errorRes, todayRes] = await Promise.all([
    countQuery('processed'),
    countQuery('pending_review'),
    countQuery('error'),
    (() => {
      let q = supabase
        .from('ehr_integration_log')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', facilityId)
        .gte('created_at', `${today}T00:00:00`)
      if (integrationId) q = q.eq('integration_id', integrationId)
      return q
    })(),
  ])

  return {
    data: {
      totalProcessed: processedRes.count ?? 0,
      pendingReview: pendingRes.count ?? 0,
      errors: errorRes.count ?? 0,
      messagesToday: todayRes.count ?? 0,
    },
    error: processedRes.error || pendingRes.error || errorRes.error || todayRes.error,
  }
}

// =====================================================
// PHI ACCESS & AUDIT
// =====================================================

/** PHI access types for tracking */
type PhiAccessType = 'view_raw_message' | 'export_message' | 'view_parsed_data'

/** Log a PHI access event (user viewed raw HL7v2 message) */
async function logPhiAccess(
  supabase: AnySupabaseClient,
  params: {
    userId: string
    userEmail?: string
    facilityId: string
    logEntryId: string
    accessType?: PhiAccessType
  }
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_phi_access_log')
    .insert({
      user_id: params.userId,
      user_email: params.userEmail || null,
      facility_id: params.facilityId,
      log_entry_id: params.logEntryId,
      access_type: params.accessType || 'view_raw_message',
    })

  return { error }
}

/** List PHI access events for a facility (for audit reporting) */
async function listPhiAccessLogs(
  supabase: AnySupabaseClient,
  facilityId: string,
  options?: { limit?: number; offset?: number }
): Promise<DALListResult<{
  id: string
  user_id: string
  user_email: string | null
  facility_id: string
  log_entry_id: string
  access_type: string
  created_at: string
}>> {
  let q = supabase
    .from('ehr_phi_access_log')
    .select('*', { count: 'exact' })
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    q = q.limit(options.limit)
  }
  if (options?.offset) {
    q = q.range(options.offset, options.offset + (options.limit || 25) - 1)
  }

  const { data, error, count } = await q
  return { data: (data as unknown as Array<{
    id: string
    user_id: string
    user_email: string | null
    facility_id: string
    log_entry_id: string
    access_type: string
    created_at: string
  }>) || [], error, count: count ?? undefined }
}

/** Manually trigger raw message purge (calls DB function) */
async function purgeExpiredRawMessages(
  supabase: AnySupabaseClient
): Promise<DALResult<number>> {
  const { data, error } = await supabase
    .rpc('purge_expired_raw_messages')

  return { data: (data as number) ?? 0, error }
}

/** Update retention days in integration config */
async function updateRetentionDays(
  supabase: AnySupabaseClient,
  integrationId: string,
  retentionDays: number
): Promise<{ error: PostgrestError | null }> {
  // Read current config, merge retention_days, update
  const { data: integration, error: fetchError } = await getIntegration(supabase, integrationId)
  if (fetchError || !integration) return { error: fetchError }

  const updatedConfig = {
    ...integration.config,
    retention_days: retentionDays,
  }

  const { error } = await supabase
    .from('ehr_integrations')
    .update({ config: updatedConfig })
    .eq('id', integrationId)

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
  // Review Queue
  approveImport,
  rejectImport,
  resolveEntity,
  resolveEntityCaseOnly,
  // Stats
  getIntegrationStats,
  // PHI Access & Audit
  logPhiAccess,
  listPhiAccessLogs,
  purgeExpiredRawMessages,
  updateRetentionDays,
}
