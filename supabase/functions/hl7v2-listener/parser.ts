/**
 * Generic HL7v2 Message Parser
 *
 * Duplicated from lib/hl7v2/parser.ts for Deno Edge Function runtime.
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
  fields: string[][];
  raw: string;
}

export interface RawParsedMessage {
  segments: ParsedSegment[];
  delimiters: HL7Delimiters;
  rawSegments: Record<string, string[]>;
}

// ── Core Parse Functions ────────────────────────────────────────────────────

export function parseMessage(raw: string): RawParsedMessage {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty HL7v2 message');
  }

  const lines = trimmed.split(/\r\n|\r|\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('Empty HL7v2 message');
  }

  const firstLine = lines[0];
  if (!firstLine.startsWith('MSH')) {
    throw new Error(`Expected MSH segment as first segment, got: ${firstLine.substring(0, 3)}`);
  }

  const delimiters = extractDelimiters(firstLine);

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

function extractDelimiters(mshLine: string): HL7Delimiters {
  if (mshLine.length < 8) {
    throw new Error('MSH segment too short to contain encoding characters');
  }

  const field = mshLine[3];
  const encoding = mshLine.substring(4, 8);

  return {
    field: field || DEFAULT_FIELD_SEP,
    component: encoding[0] || DEFAULT_COMPONENT_SEP,
    repetition: encoding[1] || DEFAULT_REPETITION_SEP,
    escape: encoding[2] || DEFAULT_ESCAPE_CHAR,
    subcomponent: encoding[3] || DEFAULT_SUBCOMPONENT_SEP,
  };
}

export function parseSegment(line: string, delimiters: HL7Delimiters): ParsedSegment {
  const sep = delimiters.field;
  const isMSH = line.startsWith('MSH');

  let fields: string[][];

  if (isMSH) {
    const rawFields = line.substring(3).split(sep);
    fields = [
      [sep],
      [rawFields[1] || ''],
      ...rawFields.slice(2).map(f => parseField(f, delimiters)),
    ];
  } else {
    const parts = line.split(sep);
    fields = [
      [parts[0]],
      ...parts.slice(1).map(f => parseField(f, delimiters)),
    ];
  }

  return {
    name: isMSH ? 'MSH' : line.split(sep)[0],
    fields,
    raw: line,
  };
}

export function parseField(value: string, delimiters: HL7Delimiters): string[] {
  if (value === '') {
    return [''];
  }
  return value.split(delimiters.component);
}

export function parseSubcomponents(value: string, delimiters: HL7Delimiters): string[] {
  if (value === '') {
    return [''];
  }
  return value.split(delimiters.subcomponent);
}

export function parseRepetitions(value: string, delimiters: HL7Delimiters): string[][] {
  if (value === '') {
    return [['']];
  }
  return value.split(delimiters.repetition).map(rep => parseField(rep, delimiters));
}

// ── Field Extraction Helpers ────────────────────────────────────────────────

export function getField(segment: ParsedSegment, fieldIndex: number): string[] {
  if (segment.name === 'MSH') {
    const idx = fieldIndex - 1;
    return segment.fields[idx] || [''];
  }
  return segment.fields[fieldIndex] || [''];
}

export function getComponent(segment: ParsedSegment, fieldIndex: number, componentIndex: number): string {
  const field = getField(segment, fieldIndex);
  return field[componentIndex - 1] || '';
}

export function getFieldValue(segment: ParsedSegment, fieldIndex: number): string {
  const field = getField(segment, fieldIndex);
  if (field.length === 1) {
    return field[0];
  }
  return field.join('^');
}

// ── Date/Time Parsing ───────────────────────────────────────────────────────

export function parseDateTime(hl7Date: string): string | null {
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
  const hour = d.length >= 10 ? d.substring(8, 10) : '00';
  const minute = d.length >= 12 ? d.substring(10, 12) : '00';
  const second = d.length >= 14 ? d.substring(12, 14) : '00';

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

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

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

export function parseNumeric(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  const num = parseInt(value.trim(), 10);
  return isNaN(num) ? null : num;
}

// ── Provider Parsing Helper ─────────────────────────────────────────────────

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
  const npi = components[9] || components[8] || '';

  if (!id && !lastName && !firstName) {
    return null;
  }

  return { id, lastName, firstName, middleName, suffix, npi };
}
