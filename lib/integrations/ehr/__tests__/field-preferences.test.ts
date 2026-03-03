import { describe, it, expect } from 'vitest'
import { getFieldPreferences, extractSurgeonInfo } from '../field-preferences'
import type { SIUMessage } from '@/lib/hl7v2/types'

// Minimal SIU message builder for field preference tests
function buildMinimalSIU(options: {
  aipSurgeon?: { npi: string; lastName: string; firstName: string; middleName: string }
  pv1Surgeon?: { npi: string; lastName: string; firstName: string; middleName: string }
}): SIUMessage {
  return {
    triggerEvent: 'S12',
    msh: {
      fieldSeparator: '|', encodingCharacters: '^~\\&', sendingApplication: 'TEST',
      sendingFacility: 'TEST', receivingApplication: '', receivingFacility: '',
      dateTime: '', messageType: 'SIU^S12', messageControlId: 'MSG1',
      processingId: 'P', versionId: '2.3',
    },
    sch: {
      placerAppointmentId: 'SC1', fillerAppointmentId: 'FL1',
      appointmentReason: '', appointmentType: '', appointmentDuration: 0,
      durationUnits: '', startDateTime: '', endDateTime: '',
      requestingProvider: null, enteredByProvider: null, fillerStatusCode: '',
    },
    pid: {
      setId: '1', patientId: 'MRN1', patientIdType: 'MR', lastName: 'DOE',
      firstName: 'JANE', middleName: '', dateOfBirth: '1990-01-01', gender: 'F',
      address: null, homePhone: '', workPhone: '', accountNumber: '', ssn: '',
    },
    pv1: {
      setId: '1', patientClass: 'O', assignedLocation: 'OR1',
      assignedLocationFacility: 'TEST',
      attendingDoctor: options.pv1Surgeon
        ? { id: '1', ...options.pv1Surgeon, suffix: 'MD' }
        : null,
      admissionType: '', hospitalService: '', visitNumber: '', visitIndicator: '',
    },
    dg1: [],
    rgs: { setId: '1', segmentActionCode: 'A', resourceGroupId: 'RG1' },
    ais: null,
    aig: [],
    ail: null,
    aip: options.aipSurgeon
      ? [{
          setId: '1', segmentActionCode: 'A', personnelId: '1',
          personnelLastName: options.aipSurgeon.lastName,
          personnelFirstName: options.aipSurgeon.firstName,
          personnelMiddleName: options.aipSurgeon.middleName,
          personnelSuffix: 'MD',
          personnelNPI: options.aipSurgeon.npi,
          role: 'SURGEON', startDateTime: '', duration: 0, durationUnits: '',
          fillerStatusCode: '',
        }]
      : [],
  }
}

describe('getFieldPreferences', () => {
  it('returns aip_first for epic_hl7v2', () => {
    const prefs = getFieldPreferences('epic_hl7v2')
    expect(prefs.surgeonFieldPriority).toBe('aip_first')
    expect(prefs.hasCustomZSegments).toBe(false)
  })

  it('returns aip_first for cerner_hl7v2 with Z-segment support', () => {
    const prefs = getFieldPreferences('cerner_hl7v2')
    expect(prefs.surgeonFieldPriority).toBe('aip_first')
    expect(prefs.hasCustomZSegments).toBe(true)
  })

  it('returns pv1_first for meditech_hl7v2', () => {
    const prefs = getFieldPreferences('meditech_hl7v2')
    expect(prefs.surgeonFieldPriority).toBe('pv1_first')
    expect(prefs.hasCustomZSegments).toBe(false)
  })

  it('falls back to epic defaults for unknown type', () => {
    const prefs = getFieldPreferences('modmed_fhir')
    expect(prefs.surgeonFieldPriority).toBe('aip_first')
  })
})

describe('extractSurgeonInfo', () => {
  const aipSurgeon = { npi: '111', lastName: 'AIP_LAST', firstName: 'AIP_FIRST', middleName: 'A' }
  const pv1Surgeon = { npi: '222', lastName: 'PV1_LAST', firstName: 'PV1_FIRST', middleName: 'B' }

  it('Epic: prefers AIP over PV1 when both present', () => {
    const siu = buildMinimalSIU({ aipSurgeon, pv1Surgeon })
    const result = extractSurgeonInfo(siu, 'epic_hl7v2')
    expect(result.lastName).toBe('AIP_LAST')
    expect(result.npi).toBe('111')
  })

  it('Epic: falls back to PV1 when AIP absent', () => {
    const siu = buildMinimalSIU({ pv1Surgeon })
    const result = extractSurgeonInfo(siu, 'epic_hl7v2')
    expect(result.lastName).toBe('PV1_LAST')
    expect(result.npi).toBe('222')
  })

  it('Cerner: prefers AIP over PV1 (same as Epic)', () => {
    const siu = buildMinimalSIU({ aipSurgeon, pv1Surgeon })
    const result = extractSurgeonInfo(siu, 'cerner_hl7v2')
    expect(result.lastName).toBe('AIP_LAST')
  })

  it('MEDITECH: prefers PV1 over AIP when both present', () => {
    const siu = buildMinimalSIU({ aipSurgeon, pv1Surgeon })
    const result = extractSurgeonInfo(siu, 'meditech_hl7v2')
    expect(result.lastName).toBe('PV1_LAST')
    expect(result.npi).toBe('222')
  })

  it('MEDITECH: falls back to AIP when PV1 absent', () => {
    const siu = buildMinimalSIU({ aipSurgeon })
    const result = extractSurgeonInfo(siu, 'meditech_hl7v2')
    expect(result.lastName).toBe('AIP_LAST')
  })

  it('returns empty fields when neither AIP nor PV1 present', () => {
    const siu = buildMinimalSIU({})
    const result = extractSurgeonInfo(siu, 'epic_hl7v2')
    expect(result.npi).toBe('')
    expect(result.lastName).toBe('')
    expect(result.firstName).toBe('')
  })
})
