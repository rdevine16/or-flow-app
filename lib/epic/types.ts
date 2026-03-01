/**
 * Epic FHIR Type Definitions
 *
 * TypeScript interfaces for FHIR R4 resources consumed by ORbit.
 * Only models the fields ORbit uses — not the full FHIR spec.
 *
 * References:
 * - https://hl7.org/fhir/R4/appointment.html
 * - https://hl7.org/fhir/R4/patient.html
 * - https://hl7.org/fhir/R4/practitioner.html
 * - https://hl7.org/fhir/R4/location.html
 */

// =====================================================
// FHIR Primitives
// =====================================================

/** FHIR Reference — a pointer to another resource */
export interface FhirReference {
  reference: string    // e.g., "Practitioner/abc123"
  display?: string     // Human-readable name
  type?: string        // Resource type hint
}

/** FHIR CodeableConcept — coded value with text fallback */
export interface FhirCodeableConcept {
  coding?: Array<{
    system?: string
    code?: string
    display?: string
  }>
  text?: string
}

/** FHIR HumanName */
export interface FhirHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden'
  family?: string
  given?: string[]
  prefix?: string[]
  suffix?: string[]
  text?: string
}

/** FHIR Identifier (e.g., MRN) */
export interface FhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old'
  type?: FhirCodeableConcept
  system?: string
  value?: string
}

/** FHIR Period */
export interface FhirPeriod {
  start?: string   // ISO datetime
  end?: string     // ISO datetime
}

// =====================================================
// FHIR Resources
// =====================================================

/** FHIR Appointment (R4) — surgical case scheduling */
export interface FhirAppointment {
  resourceType: 'Appointment'
  id: string
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error' | 'checked-in' | 'waitlist'
  serviceCategory?: FhirCodeableConcept[]
  serviceType?: FhirCodeableConcept[]
  specialty?: FhirCodeableConcept[]
  appointmentType?: FhirCodeableConcept
  reasonCode?: FhirCodeableConcept[]
  reasonReference?: FhirReference[]
  description?: string
  start?: string                    // ISO datetime
  end?: string                      // ISO datetime
  minutesDuration?: number
  basedOn?: FhirReference[]         // References to ServiceRequest
  participant: FhirAppointmentParticipant[]
  comment?: string
}

/** Appointment participant — links to Patient, Practitioner, Location */
export interface FhirAppointmentParticipant {
  type?: FhirCodeableConcept[]
  actor?: FhirReference
  required?: 'required' | 'optional' | 'information-only'
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action'
  period?: FhirPeriod
}

/** FHIR Patient (R4) — patient demographics */
export interface FhirPatient {
  resourceType: 'Patient'
  id: string
  identifier?: FhirIdentifier[]
  name?: FhirHumanName[]
  birthDate?: string               // YYYY-MM-DD
  gender?: 'male' | 'female' | 'other' | 'unknown'
  telecom?: Array<{
    system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other'
    value?: string
    use?: 'home' | 'work' | 'temp' | 'old' | 'mobile'
  }>
}

/** FHIR Practitioner (R4) — surgeon/provider */
export interface FhirPractitioner {
  resourceType: 'Practitioner'
  id: string
  identifier?: FhirIdentifier[]
  name?: FhirHumanName[]
  qualification?: Array<{
    code: FhirCodeableConcept
    period?: FhirPeriod
  }>
}

/** FHIR Location (R4) — operating room */
export interface FhirLocation {
  resourceType: 'Location'
  id: string
  name?: string
  description?: string
  type?: FhirCodeableConcept[]
  physicalType?: FhirCodeableConcept
  status?: 'active' | 'suspended' | 'inactive'
}

/** FHIR ServiceRequest (R4) — surgical order */
export interface FhirServiceRequest {
  resourceType: 'ServiceRequest'
  id: string
  status: string
  intent: string
  code?: FhirCodeableConcept
  subject: FhirReference
  performer?: FhirReference[]
  reasonCode?: FhirCodeableConcept[]
  bodySite?: FhirCodeableConcept[]
  note?: Array<{ text: string }>
}

/** FHIR Bundle — search result container */
export interface FhirBundle<T = FhirAppointment | FhirPatient | FhirPractitioner | FhirLocation | FhirServiceRequest> {
  resourceType: 'Bundle'
  type: 'searchset' | 'batch' | 'transaction' | 'batch-response' | 'transaction-response'
  total?: number
  link?: Array<{
    relation: 'self' | 'next' | 'previous' | 'first' | 'last'
    url: string
  }>
  entry?: Array<{
    fullUrl?: string
    resource: T
    search?: {
      mode: 'match' | 'include' | 'outcome'
      score?: number
    }
  }>
}

// =====================================================
// ORbit-specific types for Epic integration
// =====================================================

/** Epic connection status as stored in DB */
export type EpicConnectionStatus = 'disconnected' | 'connected' | 'error' | 'token_expired'

/** Epic entity mapping type */
export type EpicMappingType = 'surgeon' | 'room' | 'procedure'

/** Epic entity match method */
export type EpicMatchMethod = 'auto' | 'manual'

/** Row from epic_connections table */
export interface EpicConnection {
  id: string
  facility_id: string
  fhir_base_url: string
  client_id: string
  client_secret: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  token_scopes: string[] | null
  status: EpicConnectionStatus
  last_connected_at: string | null
  last_error: string | null
  sync_mode: 'manual' | 'scheduled'
  connected_by: string | null
  created_at: string
  updated_at: string
}

/** Row from epic_entity_mappings table */
export interface EpicEntityMapping {
  id: string
  facility_id: string
  connection_id: string
  mapping_type: EpicMappingType
  epic_resource_type: string
  epic_resource_id: string
  epic_display_name: string | null
  orbit_entity_id: string | null
  match_method: EpicMatchMethod
  match_confidence: number | null
  created_at: string
  updated_at: string
}

/** Row from epic_field_mappings table */
export interface EpicFieldMapping {
  id: string
  fhir_resource_type: string
  fhir_field_path: string
  orbit_table: string
  orbit_column: string
  label: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Row from epic_import_log table */
export interface EpicImportLogEntry {
  id: string
  facility_id: string
  connection_id: string
  fhir_appointment_id: string | null
  fhir_service_request_id: string | null
  orbit_case_id: string | null
  status: 'pending' | 'success' | 'failed' | 'skipped' | 'duplicate'
  error_message: string | null
  fhir_resource_snapshot: Record<string, unknown> | null
  field_mapping_applied: Record<string, unknown> | null
  imported_by: string
  imported_at: string
}

/** OAuth token response from Epic */
export interface EpicTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  patient?: string
  refresh_token?: string
}

/** SMART on FHIR configuration (from .well-known/smart-configuration) */
export interface SmartConfiguration {
  authorization_endpoint: string
  token_endpoint: string
  token_endpoint_auth_methods_supported?: string[]
  scopes_supported?: string[]
  capabilities?: string[]
}

/** Token expiry info for UX */
export interface TokenExpiryInfo {
  expiresAt: Date | null
  isExpired: boolean
  minutesRemaining: number | null
}
