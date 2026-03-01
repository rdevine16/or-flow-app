import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DAL and logger
vi.mock('@/lib/dal', () => ({
  epicDAL: {
    listFieldMappings: vi.fn(),
    listEntityMappings: vi.fn(),
    createImportLogEntry: vi.fn(),
    checkDuplicateImport: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { epicDAL } from '@/lib/dal'
import { mapAppointmentToPreview, createCaseFromImport } from '../case-mapper'
import type { ResolvedAppointment } from '../fhir-client'
import type { EpicEntityMapping, FhirAppointment, FhirPatient, FhirPractitioner, FhirLocation } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// FIXTURES
// =====================================================

const mockFacilityId = 'facility-123'
const mockConnectionId = 'conn-456'

const mockAppointment: FhirAppointment = {
  resourceType: 'Appointment',
  id: 'appt-001',
  status: 'booked',
  start: '2026-03-05T08:30:00Z',
  end: '2026-03-05T10:30:00Z',
  minutesDuration: 120,
  serviceType: [{ text: 'Total Hip Replacement' }],
  participant: [
    { actor: { reference: 'Patient/pat-001', display: 'John Smith' }, status: 'accepted' },
    { actor: { reference: 'Practitioner/pract-001', display: 'Dr. Jones' }, status: 'accepted' },
    { actor: { reference: 'Location/loc-001', display: 'OR-1' }, status: 'accepted' },
  ],
}

const mockPatient: FhirPatient = {
  resourceType: 'Patient',
  id: 'pat-001',
  name: [{ use: 'official', family: 'Smith', given: ['John'] }],
  birthDate: '1990-01-15',
  identifier: [
    { type: { coding: [{ code: 'MR' }] }, value: 'MRN-12345' },
  ],
}

const mockPractitioner: FhirPractitioner = {
  resourceType: 'Practitioner',
  id: 'pract-001',
  name: [{ use: 'official', family: 'Jones', given: ['Sarah'] }],
}

const mockLocation: FhirLocation = {
  resourceType: 'Location',
  id: 'loc-001',
  name: 'Operating Room 1',
}

const fullResolved: ResolvedAppointment = {
  appointment: mockAppointment,
  patient: mockPatient,
  practitioner: mockPractitioner,
  location: mockLocation,
}

const mappedSurgeon: EpicEntityMapping = {
  id: 'em-1',
  facility_id: mockFacilityId,
  connection_id: mockConnectionId,
  mapping_type: 'surgeon',
  epic_resource_type: 'Practitioner',
  epic_resource_id: 'pract-001',
  epic_display_name: 'Dr. Jones',
  orbit_entity_id: 'orbit-surgeon-uuid',
  match_method: 'manual',
  match_confidence: null,
  created_at: '',
  updated_at: '',
}

const mappedRoom: EpicEntityMapping = {
  id: 'em-2',
  facility_id: mockFacilityId,
  connection_id: mockConnectionId,
  mapping_type: 'room',
  epic_resource_type: 'Location',
  epic_resource_id: 'loc-001',
  epic_display_name: 'Operating Room 1',
  orbit_entity_id: 'orbit-room-uuid',
  match_method: 'manual',
  match_confidence: null,
  created_at: '',
  updated_at: '',
}

// =====================================================
// mapAppointmentToPreview TESTS
// =====================================================

describe('mapAppointmentToPreview', () => {
  const mockSupabase = {} as SupabaseClient
  const emptyImported = new Set<string>()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should map a fully resolved appointment with all mappings to "ready" status', async () => {
    const entityMappings = [mappedSurgeon, mappedRoom]

    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, entityMappings, emptyImported
    )

    expect(preview.fhirAppointmentId).toBe('appt-001')
    expect(preview.scheduledDate).toBe('2026-03-05')
    expect(preview.startTime).toBeTruthy() // Time parsing depends on timezone
    expect(preview.patientName).toBe('Smith, John')
    expect(preview.patientMrn).toBe('MRN-12345')
    expect(preview.patientDob).toBe('1990-01-15')
    expect(preview.surgeonName).toBe('Jones, Sarah')
    expect(preview.surgeonId).toBe('orbit-surgeon-uuid')
    expect(preview.roomName).toBe('Operating Room 1')
    expect(preview.roomId).toBe('orbit-room-uuid')
    expect(preview.procedureName).toBe('Total Hip Replacement')
    expect(preview.status).toBe('ready')
    expect(preview.missingMappings).toEqual([])
  })

  it('should set status to "missing_mappings" when surgeon is unmapped', async () => {
    const entityMappings = [mappedRoom] // No surgeon mapping

    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, entityMappings, emptyImported
    )

    expect(preview.status).toBe('missing_mappings')
    expect(preview.missingMappings).toContain('surgeon')
    expect(preview.surgeonId).toBeNull()
    expect(preview.roomId).toBe('orbit-room-uuid') // Room is still mapped
  })

  it('should set status to "missing_mappings" when both surgeon and room are unmapped', async () => {
    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, [], emptyImported
    )

    expect(preview.status).toBe('missing_mappings')
    expect(preview.missingMappings).toContain('surgeon')
    expect(preview.missingMappings).toContain('room')
  })

  it('should set status to "already_imported" when appointment ID is in imported set', async () => {
    const importedIds = new Set(['appt-001'])

    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], importedIds
    )

    expect(preview.status).toBe('already_imported')
  })

  it('should handle appointment without patient data', async () => {
    const resolved: ResolvedAppointment = {
      ...fullResolved,
      patient: null,
    }

    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      resolved, [mappedSurgeon, mappedRoom], emptyImported
    )

    expect(preview.patientName).toBeNull()
    expect(preview.patientMrn).toBeNull()
    expect(preview.patientDob).toBeNull()
    expect(preview.status).toBe('ready') // Patient data isn't required for mapping status
  })

  it('should extract MRN from patient identifiers with MR code', async () => {
    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], emptyImported
    )

    expect(preview.patientMrn).toBe('MRN-12345')
  })

  it('should handle patient with multiple names (prefer official)', async () => {
    const resolvedWithMultipleNames: ResolvedAppointment = {
      ...fullResolved,
      patient: {
        ...mockPatient,
        name: [
          { use: 'nickname', given: ['Johnny'], family: 'S' },
          { use: 'official', family: 'Smith', given: ['John', 'Michael'] },
        ],
      },
    }

    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      resolvedWithMultipleNames, [mappedSurgeon, mappedRoom], emptyImported
    )

    expect(preview.patientName).toBe('Smith, John')
  })

  it('should extract service type from appointment', async () => {
    const preview = await mapAppointmentToPreview(
      mockSupabase, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], emptyImported
    )

    expect(preview.epicServiceType).toBe('Total Hip Replacement')
    expect(preview.procedureName).toBe('Total Hip Replacement')
  })
})

// =====================================================
// createCaseFromImport TESTS
// =====================================================

describe('createCaseFromImport', () => {
  const mockImportedBy = 'user-789'
  const mockScheduledStatusId = 'status-scheduled'

  // Build a mock supabase that chains .from().select().eq() etc
  function buildMockSupabase(overrides?: {
    patientLookup?: { data: { id: string } | null }
    patientInsert?: { data: { id: string } | null; error: { message: string } | null }
    rpc?: { data: string | null; error: { message: string } | null }
  }) {
    const defaultOverrides = {
      patientLookup: { data: null },
      patientInsert: { data: { id: 'new-patient-id' }, error: null },
      rpc: { data: 'new-case-id', error: null },
      ...overrides,
    }

    return {
      from: vi.fn((table: string) => {
        if (table === 'patients') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue(defaultOverrides.patientLookup),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(defaultOverrides.patientInsert),
              }),
            }),
          }
        }
        if (table === 'epic_import_log') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'epic_field_mappings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      rpc: vi.fn().mockResolvedValue(defaultOverrides.rpc),
    } as unknown as SupabaseClient
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(epicDAL.listFieldMappings).mockResolvedValue({ data: [], error: null })
    vi.mocked(epicDAL.createImportLogEntry).mockResolvedValue({ data: null, error: null })
  })

  it('should create case with patient and return success', async () => {
    const mockSb = buildMockSupabase()

    const preview = await mapAppointmentToPreview(
      {} as SupabaseClient, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], new Set()
    )

    const result = await createCaseFromImport(
      mockSb, mockFacilityId, mockConnectionId,
      preview, mockImportedBy, mockScheduledStatusId
    )

    expect(result.success).toBe(true)
    expect(result.caseId).toBe('new-case-id')
    expect(result.error).toBeNull()

    // Verify RPC was called with correct params
    expect(mockSb.rpc).toHaveBeenCalledWith('create_case_with_milestones', expect.objectContaining({
      p_case_number: 'EPIC-appt-001',
      p_source: 'epic',
      p_surgeon_id: 'orbit-surgeon-uuid',
      p_or_room_id: 'orbit-room-uuid',
      p_facility_id: mockFacilityId,
      p_created_by: mockImportedBy,
      p_status_id: mockScheduledStatusId,
    }))
  })

  it('should link to existing patient when MRN matches', async () => {
    const mockSb = buildMockSupabase({
      patientLookup: { data: { id: 'existing-patient-id' } },
    })

    const preview = await mapAppointmentToPreview(
      {} as SupabaseClient, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], new Set()
    )

    const result = await createCaseFromImport(
      mockSb, mockFacilityId, mockConnectionId,
      preview, mockImportedBy, mockScheduledStatusId
    )

    expect(result.success).toBe(true)
    expect(result.patientId).toBe('existing-patient-id')

    // RPC should get the existing patient ID
    expect(mockSb.rpc).toHaveBeenCalledWith('create_case_with_milestones', expect.objectContaining({
      p_patient_id: 'existing-patient-id',
    }))
  })

  it('should return error when RPC fails', async () => {
    const mockSb = buildMockSupabase({
      rpc: { data: null, error: { message: 'RPC failed: constraint violation' } },
    })

    const preview = await mapAppointmentToPreview(
      {} as SupabaseClient, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], new Set()
    )

    const result = await createCaseFromImport(
      mockSb, mockFacilityId, mockConnectionId,
      preview, mockImportedBy, mockScheduledStatusId
    )

    expect(result.success).toBe(false)
    expect(result.caseId).toBeNull()
    expect(result.error).toContain('Case creation failed')
  })

  it('should generate EPIC-{id} case number format', async () => {
    const mockSb = buildMockSupabase()

    const preview = await mapAppointmentToPreview(
      {} as SupabaseClient, mockFacilityId, mockConnectionId,
      fullResolved, [mappedSurgeon, mappedRoom], new Set()
    )

    await createCaseFromImport(
      mockSb, mockFacilityId, mockConnectionId,
      preview, mockImportedBy, mockScheduledStatusId
    )

    expect(mockSb.rpc).toHaveBeenCalledWith('create_case_with_milestones', expect.objectContaining({
      p_case_number: 'EPIC-appt-001',
    }))
  })

  it('should handle appointment without patient gracefully', async () => {
    const resolvedNoPatient: ResolvedAppointment = {
      ...fullResolved,
      patient: null,
    }
    const mockSb = buildMockSupabase()

    const preview = await mapAppointmentToPreview(
      {} as SupabaseClient, mockFacilityId, mockConnectionId,
      resolvedNoPatient, [mappedSurgeon, mappedRoom], new Set()
    )

    const result = await createCaseFromImport(
      mockSb, mockFacilityId, mockConnectionId,
      preview, mockImportedBy, mockScheduledStatusId
    )

    expect(result.success).toBe(true)
    // Patient ID should be null since no patient data
    expect(mockSb.rpc).toHaveBeenCalledWith('create_case_with_milestones', expect.objectContaining({
      p_patient_id: null,
    }))
  })
})
