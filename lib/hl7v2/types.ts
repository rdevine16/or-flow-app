/**
 * HL7v2 Message Types & SIU (Schedule Information Unsolicited) Interfaces
 *
 * Supports Epic OpTime surgical case scheduling messages.
 * HL7v2 uses 5 delimiters: field |, component ^, subcomponent &, repetition ~, escape \
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

/** MSH — Message Header */
export interface MSHSegment {
  fieldSeparator: string;           // MSH-1: always |
  encodingCharacters: string;       // MSH-2: ^~\&
  sendingApplication: string;       // MSH-3
  sendingFacility: string;          // MSH-4
  receivingApplication: string;     // MSH-5
  receivingFacility: string;        // MSH-6
  dateTime: string;                 // MSH-7: YYYYMMDDHHMMSS → ISO
  messageType: string;              // MSH-9: SIU^S12
  messageControlId: string;         // MSH-10: unique message ID
  processingId: string;             // MSH-11: P=production, T=test, D=debug
  versionId: string;                // MSH-12: HL7 version (2.3, 2.4, etc.)
}

/** SCH — Schedule Activity */
export interface SCHSegment {
  placerAppointmentId: string;      // SCH-1: Epic's case ID (first component)
  fillerAppointmentId: string;      // SCH-2: Secondary ID (first component)
  appointmentReason: string;        // SCH-7: free text
  appointmentType: string;          // SCH-8
  appointmentDuration: number | null; // SCH-9: duration in minutes
  durationUnits: string;            // SCH-10
  startDateTime: string | null;     // SCH-11.4: YYYYMMDDHHMMSS → ISO
  endDateTime: string | null;       // SCH-11.5: YYYYMMDDHHMMSS → ISO
  requestingProvider: ProviderRef | null; // SCH-16
  enteredByProvider: ProviderRef | null;  // SCH-20
  fillerStatusCode: string;         // SCH-25: Booked, Cancelled, etc.
}

/** PID — Patient Identification */
export interface PIDSegment {
  setId: string;                    // PID-1
  patientId: string;                // PID-3: MRN (first component)
  patientIdType: string;            // PID-3.5: ID type (MR, etc.)
  lastName: string;                 // PID-5.1
  firstName: string;                // PID-5.2
  middleName: string;               // PID-5.3
  dateOfBirth: string | null;       // PID-7: YYYYMMDD → ISO date
  gender: string;                   // PID-8: M/F/O/U
  address: AddressInfo | null;      // PID-11
  homePhone: string;                // PID-13
  workPhone: string;                // PID-14
  accountNumber: string;            // PID-18
  ssn: string;                      // PID-19
}

/** PV1 — Patient Visit */
export interface PV1Segment {
  setId: string;                    // PV1-1
  patientClass: string;             // PV1-2: O=outpatient, I=inpatient
  assignedLocation: string;         // PV1-3: OR room (first component)
  assignedLocationFacility: string; // PV1-3.4: facility
  attendingDoctor: ProviderRef | null; // PV1-7
  admissionType: string;            // PV1-4
  hospitalService: string;          // PV1-10: department/specialty
  visitNumber: string;              // PV1-19
  visitIndicator: string;           // PV1-51: V=visit
}

/** DG1 — Diagnosis (repeatable) */
export interface DG1Segment {
  setId: string;                    // DG1-1: sequence number
  codingMethod: string;             // DG1-2: I10=ICD-10
  diagnosisCode: string;            // DG1-3.1: code
  diagnosisCodeSystem: string;      // DG1-3.3: code system
  diagnosisDescription: string;     // DG1-4: free text description
}

/** RGS — Resource Group */
export interface RGSSegment {
  setId: string;                    // RGS-1
  segmentActionCode: string;        // RGS-2: A=add
  resourceGroupId: string;          // RGS-3
}

/** AIS — Appointment Information - Service (procedure) */
export interface AISSegment {
  setId: string;                    // AIS-1
  segmentActionCode: string;        // AIS-2
  procedureCode: string;            // AIS-3.1: CPT code
  procedureDescription: string;     // AIS-3.2: procedure name
  procedureCodeSystem: string;      // AIS-3.3: CPT
  startDateTime: string | null;     // AIS-4: YYYYMMDDHHMMSS → ISO
  startDateTimeOffset: number | null; // AIS-5
  startDateTimeOffsetUnits: string; // AIS-6
  duration: number | null;          // AIS-7: in minutes
  durationUnits: string;            // AIS-8
  fillerStatusCode: string;         // AIS-11
}

/** AIG — Appointment Information - General Resource */
export interface AIGSegment {
  setId: string;                    // AIG-1
  segmentActionCode: string;        // AIG-2
  resourceId: string;               // AIG-3
  resourceType: string;             // AIG-4
  fillerStatusCode: string;         // AIG-14
}

/** AIL — Appointment Information - Location (OR room) */
export interface AILSegment {
  setId: string;                    // AIL-1
  segmentActionCode: string;        // AIL-2
  locationCode: string;             // AIL-3.1: room code
  locationFacility: string;         // AIL-3.4: facility
  locationDescription: string;      // AIL-3.2: human-readable room name
  startDateTime: string | null;     // AIL-6
  duration: number | null;          // AIL-10
  durationUnits: string;            // AIL-11
  fillerStatusCode: string;         // AIL-12
}

/** AIP — Appointment Information - Personnel (repeatable) */
export interface AIPSegment {
  setId: string;                    // AIP-1
  segmentActionCode: string;        // AIP-2
  personnelId: string;              // AIP-3.1: provider ID
  personnelLastName: string;        // AIP-3.2
  personnelFirstName: string;       // AIP-3.3
  personnelMiddleName: string;      // AIP-3.4
  personnelSuffix: string;          // AIP-3.5
  personnelNPI: string;             // AIP-3.9 or .10 depending on config
  role: string;                     // AIP-4: SURGEON, ANESTHESIOLOGIST, etc.
  startDateTime: string | null;     // AIP-6
  duration: number | null;          // AIP-8
  durationUnits: string;            // AIP-9
  fillerStatusCode: string;         // AIP-12
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
