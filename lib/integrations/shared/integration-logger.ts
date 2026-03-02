/**
 * Integration Logger
 *
 * Writes to ehr_integration_log and builds review_notes JSONB
 * for the review queue when entities can't be matched.
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { ehrDAL } from '@/lib/dal/ehr'
import { logger } from '@/lib/logger'
import type {
  EhrIntegrationLog,
  EhrProcessingStatus,
  ReviewNotes,
  EntitySuggestion,
} from './integration-types'

const log = logger('integration-logger')

export interface LogMessageParams {
  facilityId: string
  integrationId: string
  messageType: string
  messageControlId: string | null
  rawMessage: string
  parsedData: Record<string, unknown> | null
  externalCaseId: string | null
}

export interface UnmatchedEntities {
  surgeon?: { name: string; npi?: string; suggestions: EntitySuggestion[] }
  procedure?: { cpt: string; name: string; suggestions: EntitySuggestion[] }
  room?: { name: string; suggestions: EntitySuggestion[] }
  demographicsMismatch?: { field: string; expected: string; received: string }
}

/**
 * Create an initial log entry when a message is received.
 */
export async function logMessageReceived(
  supabase: AnySupabaseClient,
  params: LogMessageParams,
): Promise<EhrIntegrationLog | null> {
  const { data, error } = await ehrDAL.createLogEntry(supabase, {
    facility_id: params.facilityId,
    integration_id: params.integrationId,
    message_type: params.messageType,
    message_control_id: params.messageControlId || undefined,
    raw_message: params.rawMessage,
    parsed_data: params.parsedData ?? undefined,
    processing_status: 'received',
    external_case_id: params.externalCaseId || undefined,
  })

  if (error) {
    log.error('Failed to create log entry', { error: error.message, messageType: params.messageType })
    return null
  }

  return data
}

/**
 * Update a log entry to 'processed' status after successful case creation.
 */
export async function logMessageProcessed(
  supabase: AnySupabaseClient,
  logId: string,
  caseId: string,
): Promise<void> {
  const { error } = await ehrDAL.updateLogEntry(supabase, logId, {
    processing_status: 'processed',
    case_id: caseId,
    processed_at: new Date().toISOString(),
  })

  if (error) {
    log.error('Failed to update log entry to processed', { logId, error: error.message })
  }
}

/**
 * Update a log entry to 'pending_review' with review notes for unmatched entities.
 */
export async function logMessagePendingReview(
  supabase: AnySupabaseClient,
  logId: string,
  unmatched: UnmatchedEntities,
): Promise<void> {
  const reviewNotes = buildReviewNotes(unmatched)

  const { error } = await ehrDAL.updateLogEntry(supabase, logId, {
    processing_status: 'pending_review',
    review_notes: reviewNotes,
  })

  if (error) {
    log.error('Failed to update log entry to pending_review', { logId, error: error.message })
  }
}

/**
 * Update a log entry to 'error' status.
 */
export async function logMessageError(
  supabase: AnySupabaseClient,
  logId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await ehrDAL.updateLogEntry(supabase, logId, {
    processing_status: 'error',
    error_message: errorMessage,
  })

  if (error) {
    log.error('Failed to update log entry to error', { logId, error: error.message })
  }
}

/**
 * Update a log entry to 'ignored' status (e.g., cancel for unknown case).
 */
export async function logMessageIgnored(
  supabase: AnySupabaseClient,
  logId: string,
  reason: string,
): Promise<void> {
  const { error } = await ehrDAL.updateLogEntry(supabase, logId, {
    processing_status: 'ignored',
    error_message: reason,
  })

  if (error) {
    log.error('Failed to update log entry to ignored', { logId, error: error.message })
  }
}

/**
 * Update the integration's last_message_at timestamp.
 */
export async function updateIntegrationTimestamp(
  supabase: AnySupabaseClient,
  integrationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ehr_integrations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', integrationId)

  if (error) {
    log.error('Failed to update integration timestamp', { integrationId, error: error.message })
  }
}

/**
 * Build ReviewNotes JSONB from unmatched entity results.
 */
function buildReviewNotes(unmatched: UnmatchedEntities): ReviewNotes {
  const notes: ReviewNotes = {}

  if (unmatched.surgeon) {
    notes.unmatched_surgeon = {
      name: unmatched.surgeon.name,
      npi: unmatched.surgeon.npi,
      suggestions: unmatched.surgeon.suggestions,
    }
  }

  if (unmatched.procedure) {
    notes.unmatched_procedure = {
      cpt: unmatched.procedure.cpt,
      name: unmatched.procedure.name,
      suggestions: unmatched.procedure.suggestions,
    }
  }

  if (unmatched.room) {
    notes.unmatched_room = {
      name: unmatched.room.name,
      suggestions: unmatched.room.suggestions,
    }
  }

  if (unmatched.demographicsMismatch) {
    notes.demographics_mismatch = unmatched.demographicsMismatch
  }

  return notes
}
