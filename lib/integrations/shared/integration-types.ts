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
  // Case-level overrides (when user re-maps an auto-matched entity for one case only)
  matched_surgeon?: { orbit_entity_id: string; orbit_display_name: string }
  matched_procedure?: { orbit_entity_id: string; orbit_display_name: string }
  matched_room?: { orbit_entity_id: string; orbit_display_name: string }
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

// =====================================================
// Test Data Manager — Entity Pool Types
// =====================================================

export type EhrTestRoomType = 'operating_room' | 'endo_suite' | 'cath_lab' | 'minor_procedure_room'

export type EhrTestGender = 'M' | 'F' | 'O' | 'U'

export type EhrTestTriggerEvent = 'S12' | 'S13' | 'S14' | 'S15' | 'S16'

/** Row from ehr_test_surgeons table */
export interface EhrTestSurgeon {
  id: string
  facility_id: string
  name: string
  npi: string | null
  specialty: string | null
  external_provider_id: string | null
  created_at: string
  updated_at: string
}

/** Row from ehr_test_procedures table */
export interface EhrTestProcedure {
  id: string
  facility_id: string
  name: string
  cpt_code: string | null
  typical_duration_min: number | null
  specialty: string | null
  created_at: string
  updated_at: string
}

/** Row from ehr_test_rooms table */
export interface EhrTestRoom {
  id: string
  facility_id: string
  name: string
  location_code: string | null
  room_type: EhrTestRoomType | null
  created_at: string
  updated_at: string
}

/** Row from ehr_test_patients table */
export interface EhrTestPatient {
  id: string
  facility_id: string
  first_name: string
  last_name: string
  mrn: string | null
  date_of_birth: string | null
  gender: EhrTestGender | null
  address_line: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

/** Row from ehr_test_diagnoses table */
export interface EhrTestDiagnosis {
  id: string
  facility_id: string
  icd10_code: string
  description: string
  specialty: string | null
  created_at: string
  updated_at: string
}

/** Row from ehr_test_schedules table */
export interface EhrTestSchedule {
  id: string
  facility_id: string
  patient_id: string
  surgeon_id: string
  procedure_id: string
  room_id: string
  diagnosis_id: string | null
  scheduled_date: string
  start_time: string
  duration_min: number
  trigger_event: EhrTestTriggerEvent
  external_case_id: string | null
  references_schedule_id: string | null
  notes: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

/** Schedule row with joined entity data (for display) */
export interface EhrTestScheduleWithEntities extends EhrTestSchedule {
  patient: EhrTestPatient | null
  surgeon: EhrTestSurgeon | null
  procedure: EhrTestProcedure | null
  room: EhrTestRoom | null
  diagnosis: EhrTestDiagnosis | null
  referenced_schedule: Pick<EhrTestSchedule, 'id' | 'external_case_id' | 'trigger_event'> | null
}

// =====================================================
// Test Data Manager — Insert/Update Types
// =====================================================

export interface EhrTestSurgeonInsert {
  facility_id: string
  name: string
  npi?: string
  specialty?: string
  external_provider_id?: string
}

export interface EhrTestSurgeonUpdate {
  name?: string
  npi?: string | null
  specialty?: string | null
  external_provider_id?: string | null
}

export interface EhrTestProcedureInsert {
  facility_id: string
  name: string
  cpt_code?: string
  typical_duration_min?: number
  specialty?: string
}

export interface EhrTestProcedureUpdate {
  name?: string
  cpt_code?: string | null
  typical_duration_min?: number | null
  specialty?: string | null
}

export interface EhrTestRoomInsert {
  facility_id: string
  name: string
  location_code?: string
  room_type?: EhrTestRoomType
}

export interface EhrTestRoomUpdate {
  name?: string
  location_code?: string | null
  room_type?: EhrTestRoomType | null
}

export interface EhrTestPatientInsert {
  facility_id: string
  first_name: string
  last_name: string
  mrn?: string
  date_of_birth?: string
  gender?: EhrTestGender
  address_line?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
}

export interface EhrTestPatientUpdate {
  first_name?: string
  last_name?: string
  mrn?: string | null
  date_of_birth?: string | null
  gender?: EhrTestGender | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
}

export interface EhrTestDiagnosisInsert {
  facility_id: string
  icd10_code: string
  description: string
  specialty?: string
}

export interface EhrTestDiagnosisUpdate {
  icd10_code?: string
  description?: string
  specialty?: string | null
}

export interface EhrTestScheduleInsert {
  facility_id: string
  patient_id: string
  surgeon_id: string
  procedure_id: string
  room_id: string
  diagnosis_id?: string
  scheduled_date: string
  start_time: string
  duration_min: number
  trigger_event?: EhrTestTriggerEvent
  external_case_id?: string
  references_schedule_id?: string
  notes?: string
  sequence_order?: number
}

export interface EhrTestScheduleUpdate {
  patient_id?: string
  surgeon_id?: string
  procedure_id?: string
  room_id?: string
  diagnosis_id?: string | null
  scheduled_date?: string
  start_time?: string
  duration_min?: number
  trigger_event?: EhrTestTriggerEvent
  external_case_id?: string | null
  references_schedule_id?: string | null
  notes?: string | null
  sequence_order?: number
}
