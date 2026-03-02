/**
 * HL7v2 Message Types & SIU (Schedule Information Unsolicited) Interfaces
 * + EHR Integration Types
 *
 * Duplicated from lib/hl7v2/types.ts + lib/integrations/shared/integration-types.ts
 * for Deno Edge Function runtime (cannot import from lib/).
 */

// ── SIU Trigger Events ──────────────────────────────────────────────────────

export type SIUTriggerEvent = 'S12' | 'S13' | 'S14' | 'S15' | 'S16';

export const SIU_TRIGGER_EVENTS: Record<SIUTriggerEvent, string> = {
  S12: 'New appointment booked',
  S13: 'Appointment rescheduled',
  S14: 'Appointment modified',
  S15: 'Appointment canceled',
  S16: 'Appointment discontinued',
};

// ── HL7v2 ACK Codes ─────────────────────────────────────────────────────────

export type ACKCode = 'AA' | 'AE' | 'AR';

// ── Segment Interfaces ──────────────────────────────────────────────────────

export interface MSHSegment {
  fieldSeparator: string;
  encodingCharacters: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
  messageType: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
}

export interface SCHSegment {
  placerAppointmentId: string;
  fillerAppointmentId: string;
  appointmentReason: string;
  appointmentType: string;
  appointmentDuration: number | null;
  durationUnits: string;
  startDateTime: string | null;
  endDateTime: string | null;
  requestingProvider: ProviderRef | null;
  enteredByProvider: ProviderRef | null;
  fillerStatusCode: string;
}

export interface PIDSegment {
  setId: string;
  patientId: string;
  patientIdType: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string | null;
  gender: string;
  address: AddressInfo | null;
  homePhone: string;
  workPhone: string;
  accountNumber: string;
  ssn: string;
}

export interface PV1Segment {
  setId: string;
  patientClass: string;
  assignedLocation: string;
  assignedLocationFacility: string;
  attendingDoctor: ProviderRef | null;
  admissionType: string;
  hospitalService: string;
  visitNumber: string;
  visitIndicator: string;
}

export interface DG1Segment {
  setId: string;
  codingMethod: string;
  diagnosisCode: string;
  diagnosisCodeSystem: string;
  diagnosisDescription: string;
}

export interface RGSSegment {
  setId: string;
  segmentActionCode: string;
  resourceGroupId: string;
}

export interface AISSegment {
  setId: string;
  segmentActionCode: string;
  procedureCode: string;
  procedureDescription: string;
  procedureCodeSystem: string;
  startDateTime: string | null;
  startDateTimeOffset: number | null;
  startDateTimeOffsetUnits: string;
  duration: number | null;
  durationUnits: string;
  fillerStatusCode: string;
}

export interface AIGSegment {
  setId: string;
  segmentActionCode: string;
  resourceId: string;
  resourceType: string;
  fillerStatusCode: string;
}

export interface AILSegment {
  setId: string;
  segmentActionCode: string;
  locationCode: string;
  locationFacility: string;
  locationDescription: string;
  startDateTime: string | null;
  duration: number | null;
  durationUnits: string;
  fillerStatusCode: string;
}

export interface AIPSegment {
  setId: string;
  segmentActionCode: string;
  personnelId: string;
  personnelLastName: string;
  personnelFirstName: string;
  personnelMiddleName: string;
  personnelSuffix: string;
  personnelNPI: string;
  role: string;
  startDateTime: string | null;
  duration: number | null;
  durationUnits: string;
  fillerStatusCode: string;
}

// ── Composite Types ─────────────────────────────────────────────────────────

export interface ProviderRef {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  npi: string;
}

export interface AddressInfo {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// ── Complete SIU Message ────────────────────────────────────────────────────

export interface SIUMessage {
  msh: MSHSegment;
  sch: SCHSegment;
  pid: PIDSegment;
  pv1: PV1Segment;
  dg1: DG1Segment[];
  rgs: RGSSegment | null;
  ais: AISSegment | null;
  aig: AIGSegment[];
  ail: AILSegment | null;
  aip: AIPSegment[];
  triggerEvent: SIUTriggerEvent;
}

// ── Parse Result ────────────────────────────────────────────────────────────

export interface HL7v2ParseError {
  segment: string;
  field: string;
  message: string;
}

export interface HL7v2ParseResult<T = SIUMessage> {
  success: boolean;
  message: T | null;
  errors: HL7v2ParseError[];
  rawSegments: Record<string, string[]>;
}

// ── ACK Message ─────────────────────────────────────────────────────────────

export interface ACKMessage {
  raw: string;
  code: ACKCode;
  messageControlId: string;
  textMessage: string;
}

// ── EHR Integration Types ───────────────────────────────────────────────────

export type EhrIntegrationType = 'epic_hl7v2' | 'modmed_fhir' | 'csv_import';

export type EhrProcessingStatus =
  | 'received'
  | 'pending_review'
  | 'processed'
  | 'error'
  | 'ignored';

export type EhrEntityType = 'surgeon' | 'procedure' | 'room';

export type EhrMatchMethod = 'auto' | 'manual';

export type EhrAuthType = 'api_key' | 'basic_auth';

export interface EhrIntegrationConfig {
  api_key?: string;
  endpoint_url?: string;
  auth_type?: EhrAuthType;
  basic_auth_user?: string;
  basic_auth_pass?: string;
  rate_limit_per_minute?: number;
  field_overrides?: Record<string, string>;
  retention_days?: number;
}

export interface ReviewNotes {
  unmatched_surgeon?: {
    name: string;
    npi?: string;
    suggestions: EntitySuggestion[];
  };
  unmatched_procedure?: {
    cpt: string;
    name: string;
    suggestions: EntitySuggestion[];
  };
  unmatched_room?: {
    name: string;
    suggestions: EntitySuggestion[];
  };
  demographics_mismatch?: {
    field: string;
    expected: string;
    received: string;
  };
}

export interface EntitySuggestion {
  orbit_entity_id: string;
  orbit_display_name: string;
  confidence: number;
  match_reason: string;
}

export interface EhrIntegration {
  id: string;
  facility_id: string;
  integration_type: EhrIntegrationType;
  display_name: string | null;
  config: EhrIntegrationConfig;
  is_active: boolean;
  last_message_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EhrIntegrationLog {
  id: string;
  facility_id: string;
  integration_id: string;
  message_type: string;
  message_control_id: string | null;
  raw_message: string | null;
  parsed_data: Record<string, unknown> | null;
  processing_status: EhrProcessingStatus;
  error_message: string | null;
  external_case_id: string | null;
  case_id: string | null;
  review_notes: ReviewNotes | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface EhrEntityMapping {
  id: string;
  facility_id: string;
  integration_id: string;
  entity_type: EhrEntityType;
  external_identifier: string;
  external_display_name: string | null;
  orbit_entity_id: string | null;
  orbit_display_name: string | null;
  match_method: EhrMatchMethod;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}
