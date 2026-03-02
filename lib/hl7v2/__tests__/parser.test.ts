import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  parseSegment,
  parseField,
  parseSubcomponents,
  parseRepetitions,
  getField,
  getComponent,
  getFieldValue,
  parseDateTime,
  parseDate,
  parseNumeric,
  parseProviderRef,
} from '../parser';

// ── Test Data ───────────────────────────────────────────────────────────────

const MINIMAL_MSH = 'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260301143022||SIU^S12|MSG00001|P|2.3';

const FULL_SIU_MESSAGE = [
  'MSH|^~\\&|EPIC|SURGERY_CENTER|||20260301143022||SIU^S12|MSG00001|P|2.3||||||',
  'SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Right knee total arthroplasty|SURGERY|120|min|^^120^20260315080000^20260315100000|||||1001^SMITH^JOHN^A^MD^^^^NPI^1234567890||||1001^SMITH^JOHN^A^MD^^^^|||||Booked',
  'PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F|||123 Main St^^Springfield^IL^62704^US||(217)555-0123^HOME|(217)555-0456^WORK||S||ACCT98765|987-65-4321||||||||||||||||||',
  'PV1|1|O|OR3^^^SURGERY_CENTER^^^^^||||1001^SMITH^JOHN^A^MD^^^^||ORTHO||||||||||||12345||||||||||||||||||||||||||||V',
  'DG1|1|I10|M17.11^Primary osteoarthritis, right knee^I10|Primary osteoarthritis, right knee||',
  'RGS|1|A|RG001',
  'AIS|1|A|27447^Total knee arthroplasty^CPT|20260315080000|15|min|120|min|Booked||',
  'AIL|1|A|OR3^^^SURGERY_CENTER|^Operating Room 3||20260315080000|||120|min||Booked',
  'AIP|1|A|1001^SMITH^JOHN^A^MD^^^^|SURGEON||20260315080000|||120|min||Booked',
  'AIP|2|A|2001^JONES^MARIA^L^MD^^^^|ANESTHESIOLOGIST||20260315075500|||135|min||Booked',
].join('\r');

// ── parseMessage Tests ──────────────────────────────────────────────────────

describe('parseMessage', () => {
  it('parses a minimal MSH-only message', () => {
    const result = parseMessage(MINIMAL_MSH);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].name).toBe('MSH');
    expect(result.delimiters.field).toBe('|');
    expect(result.delimiters.component).toBe('^');
    expect(result.delimiters.repetition).toBe('~');
    expect(result.delimiters.escape).toBe('\\');
    expect(result.delimiters.subcomponent).toBe('&');
  });

  it('parses a full multi-segment SIU message', () => {
    const result = parseMessage(FULL_SIU_MESSAGE);
    expect(result.segments.length).toBeGreaterThanOrEqual(10);

    const segNames = result.segments.map(s => s.name);
    expect(segNames).toContain('MSH');
    expect(segNames).toContain('SCH');
    expect(segNames).toContain('PID');
    expect(segNames).toContain('PV1');
    expect(segNames).toContain('DG1');
    expect(segNames).toContain('RGS');
    expect(segNames).toContain('AIS');
    expect(segNames).toContain('AIL');
    expect(segNames).toContain('AIP');
  });

  it('handles \\n line endings', () => {
    const msg = MINIMAL_MSH.replace(/\r/g, '\n');
    const result = parseMessage(msg);
    expect(result.segments).toHaveLength(1);
  });

  it('handles \\r\\n line endings', () => {
    const msg = [
      'MSH|^~\\&|EPIC|FAC|||20260301143022||SIU^S12|MSG01|P|2.3',
      'PID|1||MRN1^^^^MR||DOE^JANE^^||19650415|F',
    ].join('\r\n');
    const result = parseMessage(msg);
    expect(result.segments).toHaveLength(2);
  });

  it('throws on empty message', () => {
    expect(() => parseMessage('')).toThrow('Empty HL7v2 message');
    expect(() => parseMessage('   ')).toThrow('Empty HL7v2 message');
  });

  it('throws when first segment is not MSH', () => {
    expect(() => parseMessage('PID|1||MRN^^^^MR')).toThrow('Expected MSH segment');
  });

  it('records raw segments by name', () => {
    const result = parseMessage(FULL_SIU_MESSAGE);
    expect(result.rawSegments['MSH']).toHaveLength(1);
    expect(result.rawSegments['AIP']).toHaveLength(2); // Two AIP segments
  });

  it('filters out blank lines', () => {
    const msg = `MSH|^~\\&|EPIC|FAC|||20260301143022||SIU^S12|MSG01|P|2.3\r\n\r\nPID|1||MRN1^^^^MR||DOE^JANE^^||19650415|F`;
    const result = parseMessage(msg);
    expect(result.segments).toHaveLength(2);
  });
});

// ── parseSegment Tests ──────────────────────────────────────────────────────

describe('parseSegment', () => {
  const delimiters = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

  it('parses MSH segment with correct field indexing', () => {
    const seg = parseSegment(MINIMAL_MSH, delimiters);
    expect(seg.name).toBe('MSH');
    // MSH-1 = field separator
    expect(seg.fields[0]).toEqual(['|']);
    // MSH-2 = encoding characters
    expect(seg.fields[1]).toEqual(['^~\\&']);
    // MSH-3 = sending application
    expect(seg.fields[2]).toEqual(['EPIC']);
  });

  it('parses non-MSH segment correctly', () => {
    const seg = parseSegment('PID|1||MRN12345^^^^MR||DOE^JANE^M^^', delimiters);
    expect(seg.name).toBe('PID');
    // PID-1 = set ID
    expect(seg.fields[1]).toEqual(['1']);
    // PID-2 = empty
    expect(seg.fields[2]).toEqual(['']);
    // PID-3 = MRN with components
    expect(seg.fields[3]).toEqual(['MRN12345', '', '', '', 'MR']);
    // PID-5 = patient name
    expect(seg.fields[5]).toEqual(['DOE', 'JANE', 'M', '', '']);
  });

  it('handles empty fields between pipes as empty arrays', () => {
    const seg = parseSegment('PID|1||||||', delimiters);
    expect(seg.fields[2]).toEqual(['']);
    expect(seg.fields[3]).toEqual(['']);
  });
});

// ── parseField Tests ────────────────────────────────────────────────────────

describe('parseField', () => {
  const delimiters = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

  it('splits by component separator', () => {
    expect(parseField('DOE^JANE^M', delimiters)).toEqual(['DOE', 'JANE', 'M']);
  });

  it('returns single-element array for simple value', () => {
    expect(parseField('ORTHO', delimiters)).toEqual(['ORTHO']);
  });

  it('returns empty string array for empty field', () => {
    expect(parseField('', delimiters)).toEqual(['']);
  });
});

// ── parseSubcomponents Tests ────────────────────────────────────────────────

describe('parseSubcomponents', () => {
  const delimiters = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

  it('splits by subcomponent separator', () => {
    expect(parseSubcomponents('A&B&C', delimiters)).toEqual(['A', 'B', 'C']);
  });

  it('returns empty string array for empty value', () => {
    expect(parseSubcomponents('', delimiters)).toEqual(['']);
  });
});

// ── parseRepetitions Tests ──────────────────────────────────────────────────

describe('parseRepetitions', () => {
  const delimiters = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

  it('splits repetitions and then components', () => {
    const result = parseRepetitions('A^B~C^D', delimiters);
    expect(result).toEqual([['A', 'B'], ['C', 'D']]);
  });

  it('returns single repetition for no separator', () => {
    const result = parseRepetitions('A^B', delimiters);
    expect(result).toEqual([['A', 'B']]);
  });
});

// ── getField / getComponent / getFieldValue Tests ───────────────────────────

describe('field extraction helpers', () => {
  const delimiters = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

  it('getField returns correct MSH fields (1-based)', () => {
    const seg = parseSegment(MINIMAL_MSH, delimiters);
    // MSH-1 = field separator
    expect(getField(seg, 1)).toEqual(['|']);
    // MSH-3 = sending application
    expect(getField(seg, 3)).toEqual(['EPIC']);
    // MSH-9 = message type
    expect(getField(seg, 9)).toEqual(['SIU', 'S12']);
    // MSH-10 = message control ID
    expect(getField(seg, 10)).toEqual(['MSG00001']);
  });

  it('getField returns correct non-MSH fields (1-based)', () => {
    const seg = parseSegment('PID|1||MRN12345^^^^MR||DOE^JANE^M^^', delimiters);
    expect(getField(seg, 1)).toEqual(['1']);
    expect(getField(seg, 3)).toEqual(['MRN12345', '', '', '', 'MR']);
    expect(getField(seg, 5)).toEqual(['DOE', 'JANE', 'M', '', '']);
  });

  it('getField returns empty array for out-of-bounds field', () => {
    const seg = parseSegment('PID|1', delimiters);
    expect(getField(seg, 99)).toEqual(['']);
  });

  it('getComponent returns specific component', () => {
    const seg = parseSegment('PID|1||MRN12345^^^^MR||DOE^JANE^M^^', delimiters);
    expect(getComponent(seg, 5, 1)).toBe('DOE');
    expect(getComponent(seg, 5, 2)).toBe('JANE');
    expect(getComponent(seg, 5, 3)).toBe('M');
  });

  it('getComponent returns empty string for missing component', () => {
    const seg = parseSegment('PID|1', delimiters);
    expect(getComponent(seg, 5, 1)).toBe('');
  });

  it('getFieldValue joins components', () => {
    const seg = parseSegment(MINIMAL_MSH, delimiters);
    expect(getFieldValue(seg, 9)).toBe('SIU^S12');
    expect(getFieldValue(seg, 10)).toBe('MSG00001');
  });
});

// ── Date/Time Parsing Tests ─────────────────────────────────────────────────

describe('parseDateTime', () => {
  it('parses full YYYYMMDDHHMMSS', () => {
    expect(parseDateTime('20260315080000')).toBe('2026-03-15T08:00:00');
  });

  it('parses YYYYMMDDHHMM (no seconds)', () => {
    expect(parseDateTime('202603150800')).toBe('2026-03-15T08:00:00');
  });

  it('parses YYYYMMDD (date only)', () => {
    expect(parseDateTime('20260315')).toBe('2026-03-15T00:00:00');
  });

  it('returns null for empty/short strings', () => {
    expect(parseDateTime('')).toBeNull();
    expect(parseDateTime('  ')).toBeNull();
    expect(parseDateTime('2026')).toBeNull();
    expect(parseDateTime('202603')).toBeNull();
  });

  it('returns null for invalid date values', () => {
    expect(parseDateTime('20261301')).toBeNull(); // month 13
    expect(parseDateTime('20260132')).toBeNull(); // day 32
    expect(parseDateTime('20260301250000')).toBeNull(); // hour 25
  });
});

describe('parseDate', () => {
  it('parses YYYYMMDD to ISO date', () => {
    expect(parseDate('19650415')).toBe('1965-04-15');
  });

  it('returns null for empty/short', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('1965')).toBeNull();
  });

  it('returns null for invalid values', () => {
    expect(parseDate('19651301')).toBeNull(); // month 13
  });
});

describe('parseNumeric', () => {
  it('parses valid integers', () => {
    expect(parseNumeric('120')).toBe(120);
    expect(parseNumeric('15')).toBe(15);
    expect(parseNumeric('0')).toBe(0);
  });

  it('returns null for empty/non-numeric', () => {
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric('abc')).toBeNull();
    expect(parseNumeric('  ')).toBeNull();
  });
});

// ── Provider Parsing Tests ──────────────────────────────────────────────────

describe('parseProviderRef', () => {
  it('parses full provider reference', () => {
    const components = ['1001', 'SMITH', 'JOHN', 'A', 'MD', '', '', '', 'NPI', '1234567890'];
    const result = parseProviderRef(components);
    expect(result).toEqual({
      id: '1001',
      lastName: 'SMITH',
      firstName: 'JOHN',
      middleName: 'A',
      suffix: 'MD',
      npi: '1234567890',
    });
  });

  it('parses minimal provider (ID and name only)', () => {
    const components = ['2001', 'JONES', 'MARIA'];
    const result = parseProviderRef(components);
    expect(result).toEqual({
      id: '2001',
      lastName: 'JONES',
      firstName: 'MARIA',
      middleName: '',
      suffix: '',
      npi: '',
    });
  });

  it('returns null for empty components', () => {
    expect(parseProviderRef([])).toBeNull();
    expect(parseProviderRef([''])).toBeNull();
  });

  it('returns null for all-empty components', () => {
    expect(parseProviderRef(['', '', ''])).toBeNull();
  });
});
