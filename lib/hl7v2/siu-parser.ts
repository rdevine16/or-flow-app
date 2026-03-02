/**
 * SIU (Schedule Information Unsolicited) Message Parser
 *
 * Extracts surgical case scheduling data from HL7v2 SIU messages.
 * Handles trigger events S12-S16 (book, reschedule, modify, cancel, discontinue).
 */

import type {
  SIUMessage,
  SIUTriggerEvent,
  MSHSegment,
  SCHSegment,
  PIDSegment,
  PV1Segment,
  DG1Segment,
  RGSSegment,
  AISSegment,
  AIGSegment,
  AILSegment,
  AIPSegment,
  HL7v2ParseResult,
  HL7v2ParseError,
  ProviderRef,
  AddressInfo,
} from './types';
import {
  parseMessage,
  getField,
  getComponent,
  getFieldValue,
  parseDateTime,
  parseDate,
  parseNumeric,
  parseProviderRef,
  type ParsedSegment,
  type RawParsedMessage,
} from './parser';

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Parse a raw HL7v2 SIU message string into a typed SIUMessage.
 * Returns a result object with success/failure, parsed message, and any errors.
 */
export function parseSIUMessage(raw: string): HL7v2ParseResult {
  const errors: HL7v2ParseError[] = [];

  let parsed: RawParsedMessage;
  try {
    parsed = parseMessage(raw);
  } catch (err) {
    return {
      success: false,
      message: null,
      errors: [{ segment: 'MSH', field: '0', message: err instanceof Error ? err.message : 'Failed to parse message' }],
      rawSegments: {},
    };
  }

  // Find MSH first — always present if parseMessage succeeded
  const mshSeg = findSegment(parsed, 'MSH');
  if (!mshSeg) {
    errors.push({ segment: 'MSH', field: '0', message: 'Missing required MSH segment' });
    return { success: false, message: null, errors, rawSegments: parsed.rawSegments };
  }

  // Validate message type is SIU before checking other segments
  const msh = parseMSH(mshSeg);
  const triggerEvent = extractTriggerEvent(msh.messageType);

  if (!triggerEvent) {
    errors.push({
      segment: 'MSH',
      field: '9',
      message: `Invalid or unsupported message type: ${msh.messageType}. Expected SIU^S12-S16.`,
    });
    return { success: false, message: null, errors, rawSegments: parsed.rawSegments };
  }

  // Validate required MSH fields
  if (!msh.messageControlId) {
    errors.push({ segment: 'MSH', field: '10', message: 'Missing required MSH-10 (Message Control ID)' });
  }

  // Find remaining required segments
  const schSeg = findSegment(parsed, 'SCH');
  const pidSeg = findSegment(parsed, 'PID');

  if (!schSeg) {
    errors.push({ segment: 'SCH', field: '0', message: 'Missing required SCH segment' });
  }
  if (!pidSeg) {
    errors.push({ segment: 'PID', field: '0', message: 'Missing required PID segment' });
  }

  if (!schSeg || !pidSeg) {
    return { success: false, message: null, errors, rawSegments: parsed.rawSegments };
  }

  // Parse all segments
  const sch = parseSCH(schSeg, parsed.delimiters);
  const pid = parsePID(pidSeg);
  const pv1Seg = findSegment(parsed, 'PV1');
  const pv1 = pv1Seg ? parsePV1(pv1Seg) : createEmptyPV1();

  // Repeatable segments
  const dg1Segs = findAllSegments(parsed, 'DG1');
  const dg1 = dg1Segs.map(s => parseDG1(s));

  // Optional single segments
  const rgsSeg = findSegment(parsed, 'RGS');
  const rgs = rgsSeg ? parseRGS(rgsSeg) : null;

  const aisSeg = findSegment(parsed, 'AIS');
  const ais = aisSeg ? parseAIS(aisSeg) : null;

  const aigSegs = findAllSegments(parsed, 'AIG');
  const aig = aigSegs.map(s => parseAIG(s));

  const ailSeg = findSegment(parsed, 'AIL');
  const ail = ailSeg ? parseAIL(ailSeg) : null;

  // Repeatable AIP segments
  const aipSegs = findAllSegments(parsed, 'AIP');
  const aip = aipSegs.map(s => parseAIP(s));

  // Validate key business fields
  if (!sch.placerAppointmentId) {
    errors.push({ segment: 'SCH', field: '1', message: 'Missing required SCH-1 (Placer Appointment ID / Case ID)' });
  }

  const siuMessage: SIUMessage = {
    msh,
    sch,
    pid,
    pv1,
    dg1,
    rgs,
    ais,
    aig,
    ail,
    aip,
    triggerEvent,
  };

  return {
    success: errors.length === 0,
    message: siuMessage,
    errors,
    rawSegments: parsed.rawSegments,
  };
}

// ── Segment Parsers ─────────────────────────────────────────────────────────

function parseMSH(seg: ParsedSegment): MSHSegment {
  return {
    fieldSeparator: getFieldValue(seg, 1),
    encodingCharacters: getFieldValue(seg, 2),
    sendingApplication: getComponent(seg, 3, 1),
    sendingFacility: getComponent(seg, 4, 1),
    receivingApplication: getComponent(seg, 5, 1),
    receivingFacility: getComponent(seg, 6, 1),
    dateTime: parseDateTime(getComponent(seg, 7, 1)) || getComponent(seg, 7, 1),
    messageType: getFieldValue(seg, 9),
    messageControlId: getComponent(seg, 10, 1),
    processingId: getComponent(seg, 11, 1),
    versionId: getComponent(seg, 12, 1),
  };
}

function parseSCH(
  seg: ParsedSegment,
  delimiters: { component: string },
): SCHSegment {
  // SCH-11 is timing: ^^duration^startDT^endDT
  const sch11 = getField(seg, 11);
  const duration = parseNumeric(sch11[2] || '');
  const startDT = parseDateTime(sch11[3] || '');
  const endDT = parseDateTime(sch11[4] || '');

  // SCH-16: requesting provider (XCN)
  const sch16 = getField(seg, 16);
  const requestingProvider = parseProviderRef(sch16);

  // SCH-20: entered by provider (XCN)
  const sch20 = getField(seg, 20);
  const enteredByProvider = parseProviderRef(sch20);

  return {
    placerAppointmentId: getComponent(seg, 1, 1),
    fillerAppointmentId: getComponent(seg, 2, 1),
    appointmentReason: getFieldValue(seg, 7),
    appointmentType: getComponent(seg, 8, 1),
    appointmentDuration: duration || parseNumeric(getComponent(seg, 9, 1)),
    durationUnits: getComponent(seg, 10, 1),
    startDateTime: startDT,
    endDateTime: endDT,
    requestingProvider: requestingProvider as ProviderRef | null,
    enteredByProvider: enteredByProvider as ProviderRef | null,
    fillerStatusCode: getComponent(seg, 25, 1),
  };
}

function parsePID(seg: ParsedSegment): PIDSegment {
  // PID-3: Patient ID list — first component is MRN
  const pid3 = getField(seg, 3);

  // PID-5: Patient name — LAST^FIRST^MIDDLE^^
  const pid5 = getField(seg, 5);

  // PID-11: Address
  const pid11 = getField(seg, 11);
  const address = parseAddress(pid11);

  return {
    setId: getComponent(seg, 1, 1),
    patientId: pid3[0] || '',
    patientIdType: pid3[4] || '',
    lastName: pid5[0] || '',
    firstName: pid5[1] || '',
    middleName: pid5[2] || '',
    dateOfBirth: parseDate(getComponent(seg, 7, 1)),
    gender: getComponent(seg, 8, 1),
    address,
    homePhone: getComponent(seg, 13, 1),
    workPhone: getComponent(seg, 14, 1),
    accountNumber: getComponent(seg, 18, 1),
    ssn: getComponent(seg, 19, 1),
  };
}

function parsePV1(seg: ParsedSegment): PV1Segment {
  // PV1-3: Assigned location — room^floor^bed^facility
  const pv1_3 = getField(seg, 3);

  // PV1-7: Attending doctor (XCN)
  const pv1_7 = getField(seg, 7);
  const attendingDoctor = parseProviderRef(pv1_7);

  return {
    setId: getComponent(seg, 1, 1),
    patientClass: getComponent(seg, 2, 1),
    assignedLocation: pv1_3[0] || '',
    assignedLocationFacility: pv1_3[3] || '',
    attendingDoctor: attendingDoctor as ProviderRef | null,
    admissionType: getComponent(seg, 4, 1),
    hospitalService: getComponent(seg, 10, 1),
    visitNumber: getComponent(seg, 19, 1),
    visitIndicator: getComponent(seg, 51, 1),
  };
}

function createEmptyPV1(): PV1Segment {
  return {
    setId: '',
    patientClass: '',
    assignedLocation: '',
    assignedLocationFacility: '',
    attendingDoctor: null,
    admissionType: '',
    hospitalService: '',
    visitNumber: '',
    visitIndicator: '',
  };
}

function parseDG1(seg: ParsedSegment): DG1Segment {
  const dg1_3 = getField(seg, 3);
  return {
    setId: getComponent(seg, 1, 1),
    codingMethod: getComponent(seg, 2, 1),
    diagnosisCode: dg1_3[0] || '',
    diagnosisCodeSystem: dg1_3[2] || '',
    diagnosisDescription: getComponent(seg, 4, 1),
  };
}

function parseRGS(seg: ParsedSegment): RGSSegment {
  return {
    setId: getComponent(seg, 1, 1),
    segmentActionCode: getComponent(seg, 2, 1),
    resourceGroupId: getComponent(seg, 3, 1),
  };
}

function parseAIS(seg: ParsedSegment): AISSegment {
  const ais3 = getField(seg, 3);
  return {
    setId: getComponent(seg, 1, 1),
    segmentActionCode: getComponent(seg, 2, 1),
    procedureCode: ais3[0] || '',
    procedureDescription: ais3[1] || '',
    procedureCodeSystem: ais3[2] || '',
    startDateTime: parseDateTime(getComponent(seg, 4, 1)),
    startDateTimeOffset: parseNumeric(getComponent(seg, 5, 1)),
    startDateTimeOffsetUnits: getComponent(seg, 6, 1),
    duration: parseNumeric(getComponent(seg, 7, 1)),
    durationUnits: getComponent(seg, 8, 1),
    fillerStatusCode: getComponent(seg, 11, 1),
  };
}

function parseAIG(seg: ParsedSegment): AIGSegment {
  return {
    setId: getComponent(seg, 1, 1),
    segmentActionCode: getComponent(seg, 2, 1),
    resourceId: getComponent(seg, 3, 1),
    resourceType: getComponent(seg, 4, 1),
    fillerStatusCode: getComponent(seg, 14, 1),
  };
}

function parseAIL(seg: ParsedSegment): AILSegment {
  const ail3 = getField(seg, 3);
  return {
    setId: getComponent(seg, 1, 1),
    segmentActionCode: getComponent(seg, 2, 1),
    locationCode: ail3[0] || '',
    locationDescription: ail3[1] || '',
    locationFacility: ail3[3] || '',
    startDateTime: parseDateTime(getComponent(seg, 6, 1)),
    duration: parseNumeric(getComponent(seg, 10, 1)),
    durationUnits: getComponent(seg, 11, 1),
    fillerStatusCode: getComponent(seg, 12, 1),
  };
}

function parseAIP(seg: ParsedSegment): AIPSegment {
  const aip3 = getField(seg, 3);
  const providerRef = parseProviderRef(aip3);

  return {
    setId: getComponent(seg, 1, 1),
    segmentActionCode: getComponent(seg, 2, 1),
    personnelId: providerRef?.id || '',
    personnelLastName: providerRef?.lastName || '',
    personnelFirstName: providerRef?.firstName || '',
    personnelMiddleName: providerRef?.middleName || '',
    personnelSuffix: providerRef?.suffix || '',
    personnelNPI: providerRef?.npi || '',
    role: getComponent(seg, 4, 1),
    startDateTime: parseDateTime(getComponent(seg, 6, 1)),
    duration: parseNumeric(getComponent(seg, 9, 1)),
    durationUnits: getComponent(seg, 10, 1),
    fillerStatusCode: getComponent(seg, 12, 1),
  };
}

// ── Helper Functions ────────────────────────────────────────────────────────

function findSegment(parsed: RawParsedMessage, name: string): ParsedSegment | undefined {
  return parsed.segments.find(s => s.name === name);
}

function findAllSegments(parsed: RawParsedMessage, name: string): ParsedSegment[] {
  return parsed.segments.filter(s => s.name === name);
}

function parseAddress(components: string[]): AddressInfo | null {
  if (!components || components.length === 0 || (components.length === 1 && components[0] === '')) {
    return null;
  }

  const street = components[0] || '';
  const city = components[2] || '';
  const state = components[3] || '';
  const zip = components[4] || '';
  const country = components[5] || '';

  if (!street && !city && !state && !zip) {
    return null;
  }

  return { street, city, state, zip, country };
}

/**
 * Extract trigger event from MSH-9 message type.
 * Expected format: "SIU^S12", "SIU^S13", etc.
 */
function extractTriggerEvent(messageType: string): SIUTriggerEvent | null {
  const parts = messageType.split('^');
  if (parts[0] !== 'SIU') {
    return null;
  }

  const event = parts[1] as SIUTriggerEvent;
  const validEvents: SIUTriggerEvent[] = ['S12', 'S13', 'S14', 'S15', 'S16'];
  if (!validEvents.includes(event)) {
    return null;
  }

  return event;
}
