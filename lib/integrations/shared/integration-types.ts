/**
 * TypeScript types for EHR Integration tables
 *
 * Maps to: ehr_integrations, ehr_integration_log, ehr_entity_mappings
 */

// =====================================================
// Enums / Union types
// =====================================================

export type EhrIntegrationType = 'epic_hl7v2' | 'modmed_fhir' | 'csv_import'

export type EhrProcessingStatus =
  | 'received'
  | 'pending_review'
  | 'processed'
  | 'error'
  | 'ignored'

export type EhrEntityType = 'surgeon' | 'procedure' | 'room'

export type EhrMatchMethod = 'auto' | 'manual'

export type EhrAuthType = 'api_key' | 'basic_auth'

// =====================================================
// Config JSONB shapes
// =====================================================

/** Shape of ehr_integrations.config JSONB */
export interface EhrIntegrationConfig {
  api_key?: string
  endpoint_url?: string
  auth_type?: EhrAuthType
  basic_auth_user?: string
  basic_auth_pass?: string
  rate_limit_per_minute?: number
  field_overrides?: Record<string, string>
  retention_days?: number
}

/** Shape of ehr_integration_log.review_notes JSONB */
export interface ReviewNotes {
  unmatched_surgeon?: {
    name: string
    npi?: string
    suggestions: EntitySuggestion[]
  }
  unmatched_procedure?: {
    cpt: string
    name: string
    suggestions: EntitySuggestion[]
  }
  unmatched_room?: {
    name: string
    suggestions: EntitySuggestion[]
  }
  demographics_mismatch?: {
    field: string
    expected: string
    received: string
  }
}

/** A suggested match from fuzzy matching */
export interface EntitySuggestion {
  orbit_entity_id: string
  orbit_display_name: string
  confidence: number
  match_reason: string
}

// =====================================================
// Table row types
// =====================================================

/** Row from ehr_integrations table */
export interface EhrIntegration {
  id: string
  facility_id: string
  integration_type: EhrIntegrationType
  display_name: string | null
  config: EhrIntegrationConfig
  is_active: boolean
  last_message_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

/** Row from ehr_integration_log table */
export interface EhrIntegrationLog {
  id: string
  facility_id: string
  integration_id: string
  message_type: string
  message_control_id: string | null
  raw_message: string | null
  parsed_data: Record<string, unknown> | null
  processing_status: EhrProcessingStatus
  error_message: string | null
  external_case_id: string | null
  case_id: string | null
  review_notes: ReviewNotes | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  processed_at: string | null
}

/** Row from ehr_entity_mappings table */
export interface EhrEntityMapping {
  id: string
  facility_id: string
  integration_id: string
  entity_type: EhrEntityType
  external_identifier: string
  external_display_name: string | null
  orbit_entity_id: string | null
  orbit_display_name: string | null
  match_method: EhrMatchMethod
  match_confidence: number | null
  created_at: string
  updated_at: string
}

// =====================================================
// Insert/update param types (for DAL functions)
// =====================================================

export interface EhrIntegrationInsert {
  facility_id: string
  integration_type: EhrIntegrationType
  display_name?: string
  config?: EhrIntegrationConfig
  is_active?: boolean
}

export interface EhrIntegrationLogInsert {
  facility_id: string
  integration_id: string
  message_type: string
  message_control_id?: string
  raw_message?: string
  parsed_data?: Record<string, unknown>
  processing_status?: EhrProcessingStatus
  error_message?: string
  external_case_id?: string
  case_id?: string
  review_notes?: ReviewNotes
}

export interface EhrEntityMappingInsert {
  facility_id: string
  integration_id: string
  entity_type: EhrEntityType
  external_identifier: string
  external_display_name?: string
  orbit_entity_id?: string
  orbit_display_name?: string
  match_method?: EhrMatchMethod
  match_confidence?: number
}
