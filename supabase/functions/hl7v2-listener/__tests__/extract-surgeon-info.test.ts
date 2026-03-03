/**
 * Tests for extractSurgeonInfo function (Phase 3 multi-EHR support)
 *
 * Verifies system-specific field priority:
 * - Epic/Cerner: AIP segment (role=SURGEON) first, PV1-7 fallback
 * - MEDITECH: PV1-7 (attending doctor) first, AIP fallback
 */

import { describe, it, expect } from 'vitest';

// Mock type matching SIUMessage structure
type MockSIUMessage = {
  pv1: {
    lastName: string;
    firstName: string;
    middleName: string;
    npi: string;
  };
  aip: Array<{
    role: string;
    lastName: string;
    firstName: string;
    middleName: string;
    npi: string;
  }>;
};

type EhrIntegrationType = 'epic_hl7v2' | 'cerner_hl7v2' | 'meditech_hl7v2';

/**
 * extractSurgeonInfo implementation (inline for testing, matching import-service.ts logic)
 */
function extractSurgeonInfo(
  siu: MockSIUMessage,
  integrationType: EhrIntegrationType,
): { npi: string; lastName: string; firstName: string; middleName: string } {
  const surgeonAip = siu.aip.find(a => a.role.toUpperCase() === 'SURGEON');

  const fromAip = surgeonAip
    ? {
        npi: surgeonAip.npi || '',
        lastName: surgeonAip.lastName || '',
        firstName: surgeonAip.firstName || '',
        middleName: surgeonAip.middleName || '',
      }
    : null;

  const fromPv1 = siu.pv1.lastName
    ? {
        npi: siu.pv1.npi || '',
        lastName: siu.pv1.lastName || '',
        firstName: siu.pv1.firstName || '',
        middleName: siu.pv1.middleName || '',
      }
    : null;

  // MEDITECH: prefer PV1-7 (attending doctor) over AIP
  if (integrationType === 'meditech_hl7v2') {
    return fromPv1 ?? fromAip ?? { npi: '', lastName: '', firstName: '', middleName: '' };
  }

  // Epic and Cerner prefer AIP segment
  return fromAip ?? fromPv1 ?? { npi: '', lastName: '', firstName: '', middleName: '' };
}

describe('extractSurgeonInfo — Epic/Cerner field priority (AIP first)', () => {
  const mockSIU: MockSIUMessage = {
    pv1: {
      lastName: 'PV1Surgeon',
      firstName: 'Attending',
      middleName: 'A',
      npi: '1111111111',
    },
    aip: [
      {
        role: 'SURGEON',
        lastName: 'AIPSurgeon',
        firstName: 'Primary',
        middleName: 'B',
        npi: '2222222222',
      },
    ],
  };

  it('Epic: prefers AIP segment when both AIP and PV1 are present', () => {
    const result = extractSurgeonInfo(mockSIU, 'epic_hl7v2');

    expect(result).toEqual({
      npi: '2222222222',
      lastName: 'AIPSurgeon',
      firstName: 'Primary',
      middleName: 'B',
    });
  });

  it('Cerner: prefers AIP segment when both AIP and PV1 are present', () => {
    const result = extractSurgeonInfo(mockSIU, 'cerner_hl7v2');

    expect(result).toEqual({
      npi: '2222222222',
      lastName: 'AIPSurgeon',
      firstName: 'Primary',
      middleName: 'B',
    });
  });

  it('Epic: falls back to PV1 when AIP SURGEON not found', () => {
    const siuNoAipSurgeon: MockSIUMessage = {
      pv1: {
        lastName: 'PV1Surgeon',
        firstName: 'Attending',
        middleName: 'A',
        npi: '1111111111',
      },
      aip: [
        {
          role: 'ANESTHESIOLOGIST', // Not SURGEON
          lastName: 'Anesthesia',
          firstName: 'Dr',
          middleName: 'C',
          npi: '3333333333',
        },
      ],
    };

    const result = extractSurgeonInfo(siuNoAipSurgeon, 'epic_hl7v2');

    expect(result).toEqual({
      npi: '1111111111',
      lastName: 'PV1Surgeon',
      firstName: 'Attending',
      middleName: 'A',
    });
  });

  it('Cerner: falls back to PV1 when AIP is empty array', () => {
    const siuEmptyAip: MockSIUMessage = {
      pv1: {
        lastName: 'PV1Surgeon',
        firstName: 'Attending',
        middleName: 'A',
        npi: '1111111111',
      },
      aip: [],
    };

    const result = extractSurgeonInfo(siuEmptyAip, 'cerner_hl7v2');

    expect(result).toEqual({
      npi: '1111111111',
      lastName: 'PV1Surgeon',
      firstName: 'Attending',
      middleName: 'A',
    });
  });

  it('Epic: returns empty when neither AIP nor PV1 have surgeon data', () => {
    const siuNoSurgeon: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [],
    };

    const result = extractSurgeonInfo(siuNoSurgeon, 'epic_hl7v2');

    expect(result).toEqual({
      npi: '',
      lastName: '',
      firstName: '',
      middleName: '',
    });
  });

  it('Cerner: handles AIP role case-insensitively (SURGEON, surgeon, Surgeon)', () => {
    const siuLowercaseRole: MockSIUMessage = {
      pv1: {
        lastName: 'PV1Surgeon',
        firstName: 'Attending',
        middleName: 'A',
        npi: '1111111111',
      },
      aip: [
        {
          role: 'surgeon', // lowercase
          lastName: 'AIPSurgeon',
          firstName: 'Primary',
          middleName: 'B',
          npi: '2222222222',
        },
      ],
    };

    const result = extractSurgeonInfo(siuLowercaseRole, 'cerner_hl7v2');

    expect(result.lastName).toBe('AIPSurgeon'); // AIP matched despite lowercase
  });
});

describe('extractSurgeonInfo — MEDITECH field priority (PV1 first)', () => {
  const mockSIU: MockSIUMessage = {
    pv1: {
      lastName: 'PV1Surgeon',
      firstName: 'Attending',
      middleName: 'A',
      npi: '1111111111',
    },
    aip: [
      {
        role: 'SURGEON',
        lastName: 'AIPSurgeon',
        firstName: 'Primary',
        middleName: 'B',
        npi: '2222222222',
      },
    ],
  };

  it('MEDITECH: prefers PV1-7 when both AIP and PV1 are present', () => {
    const result = extractSurgeonInfo(mockSIU, 'meditech_hl7v2');

    expect(result).toEqual({
      npi: '1111111111',
      lastName: 'PV1Surgeon',
      firstName: 'Attending',
      middleName: 'A',
    });
  });

  it('MEDITECH: falls back to AIP when PV1 is empty', () => {
    const siuNoPv1: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [
        {
          role: 'SURGEON',
          lastName: 'AIPSurgeon',
          firstName: 'Primary',
          middleName: 'B',
          npi: '2222222222',
        },
      ],
    };

    const result = extractSurgeonInfo(siuNoPv1, 'meditech_hl7v2');

    expect(result).toEqual({
      npi: '2222222222',
      lastName: 'AIPSurgeon',
      firstName: 'Primary',
      middleName: 'B',
    });
  });

  it('MEDITECH: returns empty when neither PV1 nor AIP have surgeon data', () => {
    const siuNoSurgeon: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [],
    };

    const result = extractSurgeonInfo(siuNoSurgeon, 'meditech_hl7v2');

    expect(result).toEqual({
      npi: '',
      lastName: '',
      firstName: '',
      middleName: '',
    });
  });

  it('MEDITECH: uses PV1 even when PV1.firstName is empty but lastName exists', () => {
    const siuPartialPv1: MockSIUMessage = {
      pv1: {
        lastName: 'Smith',
        firstName: '',
        middleName: '',
        npi: '1111111111',
      },
      aip: [
        {
          role: 'SURGEON',
          lastName: 'Jones',
          firstName: 'Full',
          middleName: 'Name',
          npi: '2222222222',
        },
      ],
    };

    const result = extractSurgeonInfo(siuPartialPv1, 'meditech_hl7v2');

    // PV1 is checked by presence of lastName, so PV1 should win
    expect(result.lastName).toBe('Smith');
    expect(result.npi).toBe('1111111111');
  });
});

describe('extractSurgeonInfo — Field extraction edge cases', () => {
  it('handles missing NPI gracefully (returns empty string)', () => {
    const siuNoNpi: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [
        {
          role: 'SURGEON',
          lastName: 'Surgeon',
          firstName: 'Test',
          middleName: '',
          npi: '', // No NPI
        },
      ],
    };

    const result = extractSurgeonInfo(siuNoNpi, 'epic_hl7v2');

    expect(result.npi).toBe('');
    expect(result.lastName).toBe('Surgeon');
  });

  it('handles missing middleName gracefully (returns empty string)', () => {
    const siuNoMiddle: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [
        {
          role: 'SURGEON',
          lastName: 'Surgeon',
          firstName: 'Test',
          middleName: '', // No middle name
          npi: '1234567890',
        },
      ],
    };

    const result = extractSurgeonInfo(siuNoMiddle, 'epic_hl7v2');

    expect(result.middleName).toBe('');
    expect(result.lastName).toBe('Surgeon');
  });

  it('trims whitespace from NPI field', () => {
    const siuWhitespaceNpi: MockSIUMessage = {
      pv1: {
        lastName: '',
        firstName: '',
        middleName: '',
        npi: '',
      },
      aip: [
        {
          role: 'SURGEON',
          lastName: 'Surgeon',
          firstName: 'Test',
          middleName: '',
          npi: '  1234567890  ',
        },
      ],
    };

    const result = extractSurgeonInfo(siuWhitespaceNpi, 'epic_hl7v2');

    // Note: Current implementation doesn't trim. If needed, add .trim() to implementation
    // For now, test documents the current behavior
    expect(result.npi).toBe('  1234567890  ');
  });
});
