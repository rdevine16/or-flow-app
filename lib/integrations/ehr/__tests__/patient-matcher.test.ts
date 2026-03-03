import { describe, it, expect, vi } from 'vitest'
import { matchOrCreatePatient, type PatientData } from '../patient-matcher'

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock supabase client
function createMockSupabase(options?: {
  existingPatient?: { id: string; first_name: string | null; last_name: string | null; date_of_birth: string | null; is_active: boolean } | null
  insertResult?: { id: string } | null
  insertError?: { message: string; code: string } | null
  queryError?: { message: string; code: string } | null
}) {
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: options?.existingPatient ?? null,
    error: options?.queryError ?? null,
  })

  const selectAfterInsertMock = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: options?.insertResult ?? { id: 'new-patient-1' },
      error: options?.insertError ?? null,
    }),
  })

  const insertMock = vi.fn().mockReturnValue({
    select: selectAfterInsertMock,
  })

  const eqChain = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: maybeSingleMock,
    }),
    maybeSingle: maybeSingleMock,
  }

  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue(eqChain),
  })

  return {
    from: vi.fn().mockReturnValue({
      select: selectMock,
      insert: insertMock,
    }),
  } as unknown as Parameters<typeof matchOrCreatePatient>[0]
}

const basePatient: PatientData = {
  mrn: 'MRN12345',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1965-04-15',
  gender: 'F',
}

describe('matchOrCreatePatient', () => {
  it('matches existing patient by MRN', async () => {
    const supabase = createMockSupabase({
      existingPatient: {
        id: 'patient-1',
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: '1965-04-15',
        is_active: true,
      },
    })

    const result = await matchOrCreatePatient(supabase, 'fac-1', basePatient)
    expect(result.matched).toBe(true)
    expect(result.patientId).toBe('patient-1')
    expect(result.isNewPatient).toBe(false)
    expect(result.demographicsMismatch).toBeNull()
  })

  it('flags demographics mismatch when MRN matches but last name differs', async () => {
    const supabase = createMockSupabase({
      existingPatient: {
        id: 'patient-1',
        first_name: 'Jane',
        last_name: 'Smith', // Different last name
        date_of_birth: '1965-04-15',
        is_active: true,
      },
    })

    const result = await matchOrCreatePatient(supabase, 'fac-1', basePatient)
    expect(result.matched).toBe(true)
    expect(result.patientId).toBe('patient-1')
    expect(result.demographicsMismatch).not.toBeNull()
    expect(result.demographicsMismatch!.field).toBe('last_name')
    expect(result.demographicsMismatch!.expected).toBe('Smith')
    expect(result.demographicsMismatch!.received).toBe('Doe')
  })

  it('flags demographics mismatch when DOB differs', async () => {
    const supabase = createMockSupabase({
      existingPatient: {
        id: 'patient-1',
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: '1970-01-01', // Different DOB
        is_active: true,
      },
    })

    const result = await matchOrCreatePatient(supabase, 'fac-1', basePatient)
    expect(result.demographicsMismatch).not.toBeNull()
    expect(result.demographicsMismatch!.field).toBe('date_of_birth')
  })

  it('creates new patient when MRN not found', async () => {
    const supabase = createMockSupabase({ existingPatient: null })

    const result = await matchOrCreatePatient(supabase, 'fac-1', basePatient)
    expect(result.matched).toBe(true)
    expect(result.patientId).toBe('new-patient-1')
    expect(result.isNewPatient).toBe(true)
    expect(result.demographicsMismatch).toBeNull()
  })

  it('creates new patient when no MRN provided', async () => {
    const supabase = createMockSupabase({ existingPatient: null })
    const noMrnPatient = { ...basePatient, mrn: '' }

    const result = await matchOrCreatePatient(supabase, 'fac-1', noMrnPatient)
    expect(result.matched).toBe(true)
    expect(result.isNewPatient).toBe(true)
  })

  it('throws on query error', async () => {
    const supabase = createMockSupabase({
      queryError: { message: 'DB connection failed', code: '500' },
    })

    await expect(matchOrCreatePatient(supabase, 'fac-1', basePatient)).rejects.toThrow('Patient lookup failed')
  })

  it('throws on insert error', async () => {
    const supabase = createMockSupabase({
      existingPatient: null,
      insertResult: null,
      insertError: { message: 'Insert failed', code: '500' },
    })

    await expect(matchOrCreatePatient(supabase, 'fac-1', basePatient)).rejects.toThrow('Patient creation failed')
  })

  it('is case-insensitive for name comparison', async () => {
    const supabase = createMockSupabase({
      existingPatient: {
        id: 'patient-1',
        first_name: 'JANE',
        last_name: 'DOE',
        date_of_birth: '1965-04-15',
        is_active: true,
      },
    })

    const result = await matchOrCreatePatient(supabase, 'fac-1', basePatient)
    expect(result.demographicsMismatch).toBeNull()
  })
})
