import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock token-manager before importing fhir-client
vi.mock('../token-manager', () => ({
  epicFhirRequest: vi.fn(),
}))

import { epicFhirRequest } from '../token-manager'
import {
  searchSurgicalAppointments,
  getPatient,
  getPractitioner,
  searchPractitioners,
  searchLocations,
  resolveAppointmentDetails,
} from '../fhir-client'
import type { FhirAppointment, FhirPatient, FhirPractitioner, FhirLocation, FhirBundle } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockSupabase = {} as SupabaseClient
const mockFacilityId = 'facility-123'
const mockEpicFhirRequest = vi.mocked(epicFhirRequest)

// =====================================================
// FIXTURES
// =====================================================

const mockAppointment: FhirAppointment = {
  resourceType: 'Appointment',
  id: 'appt-001',
  status: 'booked',
  start: '2026-03-05T08:00:00Z',
  end: '2026-03-05T10:00:00Z',
  minutesDuration: 120,
  serviceType: [{ text: 'Total Hip Replacement', coding: [{ display: 'Total Hip Replacement' }] }],
  participant: [
    {
      actor: { reference: 'Patient/pat-001', display: 'John Smith' },
      status: 'accepted',
    },
    {
      actor: { reference: 'Practitioner/pract-001', display: 'Dr. Jones' },
      status: 'accepted',
    },
    {
      actor: { reference: 'Location/loc-001', display: 'OR-1' },
      status: 'accepted',
    },
  ],
}

const mockCancelledAppointment: FhirAppointment = {
  resourceType: 'Appointment',
  id: 'appt-cancelled',
  status: 'cancelled',
  start: '2026-03-05T14:00:00Z',
  participant: [
    { actor: { reference: 'Patient/pat-002' }, status: 'declined' },
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
  name: [{ use: 'official', family: 'Jones', given: ['Sarah'], prefix: ['Dr.'] }],
}

const mockLocation: FhirLocation = {
  resourceType: 'Location',
  id: 'loc-001',
  name: 'Operating Room 1',
  status: 'active',
}

// =====================================================
// TESTS
// =====================================================

describe('searchSurgicalAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return active appointments from FHIR bundle', async () => {
    const bundle: FhirBundle<FhirAppointment> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 2,
      entry: [
        { resource: mockAppointment, search: { mode: 'match' } },
        { resource: mockCancelledAppointment, search: { mode: 'match' } },
      ],
    }

    mockEpicFhirRequest.mockResolvedValue({ data: bundle, error: null })

    const result = await searchSurgicalAppointments(mockSupabase, mockFacilityId, {
      dateFrom: '2026-03-05',
      dateTo: '2026-03-12',
    })

    expect(result.error).toBeNull()
    // Only 'booked' appointment — cancelled is filtered out
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('appt-001')
    expect(result.data[0].status).toBe('booked')
  })

  it('should pass practitioner filter when provided', async () => {
    mockEpicFhirRequest.mockResolvedValue({
      data: { resourceType: 'Bundle', type: 'searchset', entry: [] },
      error: null,
    })

    await searchSurgicalAppointments(mockSupabase, mockFacilityId, {
      dateFrom: '2026-03-05',
      dateTo: '2026-03-12',
      practitionerId: 'pract-001',
    })

    // Verify the resource path includes the practitioner filter
    expect(mockEpicFhirRequest).toHaveBeenCalledWith(
      mockSupabase,
      mockFacilityId,
      expect.stringContaining('practitioner=Practitioner%2Fpract-001')
    )
  })

  it('should return empty array on FHIR error', async () => {
    mockEpicFhirRequest.mockResolvedValue({ data: null, error: 'Token expired' })

    const result = await searchSurgicalAppointments(mockSupabase, mockFacilityId, {
      dateFrom: '2026-03-05',
      dateTo: '2026-03-12',
    })

    expect(result.data).toEqual([])
    expect(result.error).toBe('Token expired')
  })

  it('should handle empty bundle (no entry key)', async () => {
    mockEpicFhirRequest.mockResolvedValue({
      data: { resourceType: 'Bundle', type: 'searchset', total: 0 },
      error: null,
    })

    const result = await searchSurgicalAppointments(mockSupabase, mockFacilityId, {
      dateFrom: '2026-03-05',
      dateTo: '2026-03-12',
    })

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })
})

describe('getPatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should fetch patient by ID', async () => {
    mockEpicFhirRequest.mockResolvedValue({ data: mockPatient, error: null })

    const result = await getPatient(mockSupabase, mockFacilityId, 'pat-001')

    expect(result.data).toEqual(mockPatient)
    expect(mockEpicFhirRequest).toHaveBeenCalledWith(mockSupabase, mockFacilityId, 'Patient/pat-001')
  })

  it('should return null on error', async () => {
    mockEpicFhirRequest.mockResolvedValue({ data: null, error: 'Not found' })

    const result = await getPatient(mockSupabase, mockFacilityId, 'bad-id')
    expect(result.data).toBeNull()
    expect(result.error).toBe('Not found')
  })
})

describe('getPractitioner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should fetch practitioner by ID', async () => {
    mockEpicFhirRequest.mockResolvedValue({ data: mockPractitioner, error: null })

    const result = await getPractitioner(mockSupabase, mockFacilityId, 'pract-001')

    expect(result.data).toEqual(mockPractitioner)
    expect(mockEpicFhirRequest).toHaveBeenCalledWith(mockSupabase, mockFacilityId, 'Practitioner/pract-001')
  })
})

describe('searchPractitioners', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should search practitioners by name', async () => {
    const bundle: FhirBundle<FhirPractitioner> = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [{ resource: mockPractitioner, search: { mode: 'match' } }],
    }
    mockEpicFhirRequest.mockResolvedValue({ data: bundle, error: null })

    const result = await searchPractitioners(mockSupabase, mockFacilityId, { name: 'Jones' })

    expect(result.data).toHaveLength(1)
    expect(mockEpicFhirRequest).toHaveBeenCalledWith(
      mockSupabase,
      mockFacilityId,
      expect.stringContaining('name=Jones')
    )
  })
})

describe('searchLocations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should search all locations', async () => {
    const bundle: FhirBundle<FhirLocation> = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [{ resource: mockLocation, search: { mode: 'match' } }],
    }
    mockEpicFhirRequest.mockResolvedValue({ data: bundle, error: null })

    const result = await searchLocations(mockSupabase, mockFacilityId)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('Operating Room 1')
  })
})

describe('resolveAppointmentDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should resolve all participant references in parallel', async () => {
    // Setup: 3 sequential calls — patient, practitioner, location
    mockEpicFhirRequest
      .mockResolvedValueOnce({ data: mockPatient, error: null })       // getPatient
      .mockResolvedValueOnce({ data: mockPractitioner, error: null })  // getPractitioner
      .mockResolvedValueOnce({ data: mockLocation, error: null })      // Location fetch

    const result = await resolveAppointmentDetails(mockSupabase, mockFacilityId, mockAppointment)

    expect(result.appointment).toEqual(mockAppointment)
    expect(result.patient?.id).toBe('pat-001')
    expect(result.practitioner?.id).toBe('pract-001')
    expect(result.location?.id).toBe('loc-001')
  })

  it('should handle missing participant references gracefully', async () => {
    const appointmentNoRefs: FhirAppointment = {
      resourceType: 'Appointment',
      id: 'appt-bare',
      status: 'booked',
      participant: [],
    }

    const result = await resolveAppointmentDetails(mockSupabase, mockFacilityId, appointmentNoRefs)

    expect(result.patient).toBeNull()
    expect(result.practitioner).toBeNull()
    expect(result.location).toBeNull()
    // No FHIR requests should have been made
    expect(mockEpicFhirRequest).not.toHaveBeenCalled()
  })

  it('should handle partial failures (patient fetch fails)', async () => {
    mockEpicFhirRequest
      .mockResolvedValueOnce({ data: null, error: 'Patient not found' }) // getPatient fails
      .mockResolvedValueOnce({ data: mockPractitioner, error: null })    // getPractitioner OK
      .mockResolvedValueOnce({ data: mockLocation, error: null })        // Location OK

    const result = await resolveAppointmentDetails(mockSupabase, mockFacilityId, mockAppointment)

    expect(result.patient).toBeNull()
    expect(result.practitioner?.id).toBe('pract-001')
    expect(result.location?.id).toBe('loc-001')
  })
})
