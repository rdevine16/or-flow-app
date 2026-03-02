/**
 * Generic HL7v2 Message Parser
 *
 * Decodes pipe-delimited HL7v2 messages into structured segments.
 * Handles all 5 delimiters: field |, component ^, subcomponent &, repetition ~, escape \
 */

// ── Delimiter Defaults ──────────────────────────────────────────────────────

const DEFAULT_FIELD_SEP = '|';
const DEFAULT_COMPONENT_SEP = '^';
const DEFAULT_REPETITION_SEP = '~';
const DEFAULT_ESCAPE_CHAR = '\\';
const DEFAULT_SUBCOMPONENT_SEP = '&';

export interface HL7Delimiters {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subcomponent: string;
}

export interface ParsedSegment {
  name: string;
  fields: string[][];  // fields[fieldIndex][componentIndex]
  raw: string;
}

export interface RawParsedMessage {
  segments: ParsedSegment[];
  delimiters: HL7Delimiters;
  rawSegments: Record<string, string[]>;
}

// ── Core Parse Functions ────────────────────────────────────────────────────

/**
 * Parse an HL7v2 message string into structured segments.
 * Handles \r, \n, and \r\n line endings.
 */
export function parseMessage(raw: string): RawParsedMessage {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty HL7v2 message');
  }

  // Split by any line ending (\r\n, \r, \n)
  const lines = trimmed.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('Empty HL7v2 message');
  }

  // First line must be MSH
  const firstLine = lines[0];
  if (!firstLine.startsWith('MSH')) {
    throw new Error(`Expected MSH segment as first segment, got: ${firstLine.substring(0, 3)}`);
  }

  // Extract delimiters from MSH segment
  const delimiters = extractDelimiters(firstLine);

  // Parse each segment
  const segments: ParsedSegment[] = [];
  const rawSegments: Record<string, string[]> = {};

  for (const line of lines) {
    const segment = parseSegment(line, delimiters);
    segments.push(segment);

    if (!rawSegments[segment.name]) {
      rawSegments[segment.name] = [];
    }
    rawSegments[segment.name].push(line);
  }

  return { segments, delimiters, rawSegments };
}

/**
 * Extract the 5 encoding characters from MSH-1 and MSH-2.
 * MSH-1 is the field separator (character at position 3).
 * MSH-2 is the next 4 characters: component ^ repetition ~ escape \ subcomponent &
 */
function extractDelimiters(mshLine: string): HL7Delimiters {
  if (mshLine.length < 8) {
    throw new Error('MSH segment too short to contain encoding characters');
  }

  const field = mshLine[3]; // MSH-1: field separator
  const encoding = mshLine.substring(4, 8); // MSH-2: 4 encoding characters

  return {
    field: field || DEFAULT_FIELD_SEP,
    component: encoding[0] || DEFAULT_COMPONENT_SEP,
    repetition: encoding[1] || DEFAULT_REPETITION_SEP,
    escape: encoding[2] || DEFAULT_ESCAPE_CHAR,
    subcomponent: encoding[3] || DEFAULT_SUBCOMPONENT_SEP,
  };
}

/**
 * Parse a single segment line into name + fields.
 * MSH is special: field separator IS position 3, so MSH fields start at offset 1.
 */
export function parseSegment(line: string, delimiters: HL7Delimiters): ParsedSegment {
  const sep = delimiters.field;
  const isMSH = line.startsWith('MSH');

  let fields: string[][];

  if (isMSH) {
    // MSH-1 is the field separator itself (not between two pipes)
    // MSH-2 is the encoding characters
    // Split from position 3 onward
    const rawFields = line.substring(3).split(sep);
    // rawFields[0] = "" (empty, because line[3] is the separator)
    // Actually: "MSH|^~\\&|EPIC|..." → after "MSH", split by |:
    // ["", "^~\\&", "EPIC", ...]
    // MSH-1 = "|" (field separator), MSH-2 = rawFields[1] = "^~\\&"
    fields = [
      [sep],                              // MSH-1: field separator
      [rawFields[1] || ''],               // MSH-2: encoding characters
      ...rawFields.slice(2).map(f => parseField(f, delimiters)),
    ];
  } else {
    const parts = line.split(sep);
    const segName = parts[0]; // segment name
    fields = [
      [segName],
      ...parts.slice(1).map(f => parseField(f, delimiters)),
    ];
  }

  return {
    name: isMSH ? 'MSH' : line.split(sep)[0],
    fields,
    raw: line,
  };
}

/**
 * Parse a single field value, splitting by component separator.
 * Empty fields between pipes (||) become [''] which we treat as null downstream.
 */
export function parseField(value: string, delimiters: HL7Delimiters): string[] {
  if (value === '') {
    return [''];
  }
  return value.split(delimiters.component);
}

/**
 * Parse subcomponents from a component value.
 */
export function parseSubcomponents(value: string, delimiters: HL7Delimiters): string[] {
  if (value === '') {
    return [''];
  }
  return value.split(delimiters.subcomponent);
}

/**
 * Parse repetitions from a field value.
 */
export function parseRepetitions(value: string, delimiters: HL7Delimiters): string[][] {
  if (value === '') {
    return [['']];
  }
  return value.split(delimiters.repetition).map(rep => parseField(rep, delimiters));
}

// ── Field Extraction Helpers ────────────────────────────────────────────────

/**
 * Get a specific field from a parsed segment.
 * fieldIndex is 1-based for MSH (MSH-1, MSH-2, ...) and for other segments
 * (PID-1, PID-2, ...). The segment name occupies index 0 in the fields array.
 *
 * For MSH: fields[0]=MSH-1 (field sep), fields[1]=MSH-2 (encoding), fields[2]=MSH-3, etc.
 * For others: fields[0]=segment name, fields[1]=field-1, fields[2]=field-2, etc.
 */
export function getField(segment: ParsedSegment, fieldIndex: number): string[] {
  if (segment.name === 'MSH') {
    // MSH-1 is at index 0, MSH-2 at index 1, MSH-3 at index 2, etc.
    const idx = fieldIndex - 1;
    return segment.fields[idx] || [''];
  }
  // For non-MSH segments, field-1 is at index 1
  return segment.fields[fieldIndex] || [''];
}

/**
 * Get a specific component of a field.
 * componentIndex is 1-based.
 */
export function getComponent(segment: ParsedSegment, fieldIndex: number, componentIndex: number): string {
  const field = getField(segment, fieldIndex);
  return field[componentIndex - 1] || '';
}

/**
 * Get a raw field value (all components joined).
 */
export function getFieldValue(segment: ParsedSegment, fieldIndex: number): string {
  const field = getField(segment, fieldIndex);
  if (field.length === 1) {
    return field[0];
  }
  return field.join('^');
}

// ── Date/Time Parsing ───────────────────────────────────────────────────────

/**
 * Parse HL7v2 date/time format (YYYYMMDDHHMMSS) to ISO 8601 string.
 * Handles varying precision: YYYY, YYYYMM, YYYYMMDD, YYYYMMDDHHMM, YYYYMMDDHHMMSS
 * Returns null for empty/invalid values.
 */
export function parseDateTime(hl7Date: string): string | null {
  if (!hl7Date || hl7Date.trim() === '') {
    return null;
  }

  const d = hl7Date.trim();

  // Must be at least 8 chars (YYYYMMDD) for a meaningful date
  if (d.length < 8) {
    return null;
  }

  const year = d.substring(0, 4);
  const month = d.substring(4, 6);
  const day = d.substring(6, 8);
  const hour = d.length >= 10 ? d.substring(8, 10) : '00';
  const minute = d.length >= 12 ? d.substring(10, 12) : '00';
  const second = d.length >= 14 ? d.substring(12, 14) : '00';

  // Validate ranges
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const dy = parseInt(day, 10);
  const h = parseInt(hour, 10);
  const min = parseInt(minute, 10);
  const s = parseInt(second, 10);

  if (isNaN(y) || isNaN(m) || isNaN(dy) || isNaN(h) || isNaN(min) || isNaN(s)) {
    return null;
  }
  if (m < 1 || m > 12 || dy < 1 || dy > 31 || h > 23 || min > 59 || s > 59) {
    return null;
  }

  // Return ISO 8601
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * Parse HL7v2 date-only format (YYYYMMDD) to ISO date string (YYYY-MM-DD).
 */
export function parseDate(hl7Date: string): string | null {
  if (!hl7Date || hl7Date.trim() === '') {
    return null;
  }

  const d = hl7Date.trim();
  if (d.length < 8) {
    return null;
  }

  const year = d.substring(0, 4);
  const month = d.substring(4, 6);
  const day = d.substring(6, 8);

  const m = parseInt(month, 10);
  const dy = parseInt(day, 10);

  if (isNaN(m) || isNaN(dy) || m < 1 || m > 12 || dy < 1 || dy > 31) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Parse a numeric string, returning null if empty or non-numeric.
 */
export function parseNumeric(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  const num = parseInt(value.trim(), 10);
  return isNaN(num) ? null : num;
}

// ── Provider Parsing Helper ─────────────────────────────────────────────────

/**
 * Parse a provider reference from an XCN (extended composite ID) field.
 * Format: ID^LAST^FIRST^MIDDLE^SUFFIX^^^^NPI^qualifier
 */
export function parseProviderRef(components: string[]): {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  npi: string;
} | null {
  if (!components || components.length === 0 || (components.length === 1 && components[0] === '')) {
    return null;
  }

  const id = components[0] || '';
  const lastName = components[1] || '';
  const firstName = components[2] || '';
  const middleName = components[3] || '';
  const suffix = components[4] || '';
  // NPI can be at position 8 (index 8) or 9 (index 9) depending on configuration
  const npi = components[9] || components[8] || '';

  // If all fields are empty, return null
  if (!id && !lastName && !firstName) {
    return null;
  }

  return { id, lastName, firstName, middleName, suffix, npi };
}
