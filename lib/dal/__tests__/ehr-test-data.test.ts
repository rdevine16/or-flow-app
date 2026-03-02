import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ehrTestDataDAL } from '../ehr-test-data'
import type {
  EhrTestSurgeon,
  EhrTestProcedure,
  EhrTestRoom,
  EhrTestPatient,
  EhrTestDiagnosis,
  EhrTestSchedule,
  EhrTestScheduleWithEntities,
} from '@/lib/integrations/shared/integration-types'

// ============================================
// MOCK SUPABASE CLIENT
// ============================================

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }

  return {
    client: { from: vi.fn().mockReturnValue(chainable) },
    chainable,
  }
}

// ============================================
// UNIT TESTS — SURGEONS
// ============================================

describe('ehrTestDataDAL - Surgeons CRUD', () => {
  it('should list surgeons for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockSurgeons: EhrTestSurgeon[] = [
      {
        id: 'surg-1',
        facility_id: 'fac-1',
        name: 'Dr. Alice Smith',
        npi: '1234567890',
        specialty: 'Orthopedic Surgery',
        external_provider_id: 'EPIC-PROV-001',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
      {
        id: 'surg-2',
        facility_id: 'fac-1',
        name: 'Dr. Bob Jones',
        npi: '9876543210',
        specialty: 'General Surgery',
        external_provider_id: 'EPIC-PROV-002',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    chainable.order.mockResolvedValue({ data: mockSurgeons, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listSurgeons(client as any, 'fac-1')

    expect(client.from).toHaveBeenCalledWith('ehr_test_surgeons')
    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(result.data).toHaveLength(2)
    expect(result.data?.[0].name).toBe('Dr. Alice Smith')
  })

  it('should get a surgeon by id', async () => {
    const { client, chainable } = createMockSupabase()
    const mockSurgeon: EhrTestSurgeon = {
      id: 'surg-1',
      facility_id: 'fac-1',
      name: 'Dr. Alice Smith',
      npi: '1234567890',
      specialty: 'Orthopedic Surgery',
      external_provider_id: 'EPIC-PROV-001',
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: mockSurgeon, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.getSurgeon(client as any, 'surg-1')

    expect(chainable.eq).toHaveBeenCalledWith('id', 'surg-1')
    expect(result.data?.name).toBe('Dr. Alice Smith')
  })

  it('should create a surgeon', async () => {
    const { client, chainable } = createMockSupabase()
    const newSurgeon = {
      facility_id: 'fac-1',
      name: 'Dr. Carol White',
      npi: '1111111111',
      specialty: 'Cardiology',
      external_provider_id: 'EPIC-PROV-003',
    }
    const created: EhrTestSurgeon = {
      id: 'surg-3',
      ...newSurgeon,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: created, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createSurgeon(client as any, newSurgeon)

    expect(chainable.insert).toHaveBeenCalledWith(newSurgeon)
    expect(result.data?.id).toBe('surg-3')
  })

  it('should update a surgeon', async () => {
    const { client, chainable } = createMockSupabase()
    const updates = { name: 'Dr. Alice Smith-Johnson', specialty: 'Ortho & Sports Medicine' }
    const updated: EhrTestSurgeon = {
      id: 'surg-1',
      facility_id: 'fac-1',
      name: 'Dr. Alice Smith-Johnson',
      npi: '1234567890',
      specialty: 'Ortho & Sports Medicine',
      external_provider_id: 'EPIC-PROV-001',
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T13:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: updated, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.updateSurgeon(client as any, 'surg-1', updates)

    expect(chainable.update).toHaveBeenCalledWith(updates)
    expect(chainable.eq).toHaveBeenCalledWith('id', 'surg-1')
    expect(result.data?.name).toBe('Dr. Alice Smith-Johnson')
  })

  it('should delete a surgeon', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.deleteSurgeon(client as any, 'surg-1')

    expect(chainable.delete).toHaveBeenCalled()
    expect(chainable.eq).toHaveBeenCalledWith('id', 'surg-1')
    expect(result.error).toBeNull()
  })

  it('should count schedule references for a surgeon', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ count: 3, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.countSurgeonScheduleRefs(client as any, 'surg-1')

    expect(client.from).toHaveBeenCalledWith('ehr_test_schedules')
    expect(chainable.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(chainable.eq).toHaveBeenCalledWith('surgeon_id', 'surg-1')
    expect(result.data).toBe(3)
  })
})

// ============================================
// UNIT TESTS — PROCEDURES
// ============================================

describe('ehrTestDataDAL - Procedures CRUD', () => {
  it('should list procedures for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockProcedures: EhrTestProcedure[] = [
      {
        id: 'proc-1',
        facility_id: 'fac-1',
        name: 'Total Knee Replacement',
        cpt_code: '27447',
        typical_duration_min: 90,
        specialty: 'Orthopedics',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    chainable.order.mockResolvedValue({ data: mockProcedures, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listProcedures(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0].cpt_code).toBe('27447')
  })

  it('should create a procedure', async () => {
    const { client, chainable } = createMockSupabase()
    const newProcedure = {
      facility_id: 'fac-1',
      name: 'Appendectomy',
      cpt_code: '44950',
      typical_duration_min: 60,
      specialty: 'General Surgery',
    }
    const created: EhrTestProcedure = {
      id: 'proc-2',
      ...newProcedure,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: created, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createProcedure(client as any, newProcedure)

    expect(chainable.insert).toHaveBeenCalledWith(newProcedure)
    expect(result.data?.cpt_code).toBe('44950')
  })
})

// ============================================
// UNIT TESTS — ROOMS
// ============================================

describe('ehrTestDataDAL - Rooms CRUD', () => {
  it('should list rooms for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockRooms: EhrTestRoom[] = [
      {
        id: 'room-1',
        facility_id: 'fac-1',
        name: 'OR-1',
        location_code: 'MAIN-OR-01',
        room_type: 'operating_room',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    chainable.order.mockResolvedValue({ data: mockRooms, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listRooms(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(result.data?.[0].room_type).toBe('operating_room')
  })

  it('should create a room', async () => {
    const { client, chainable } = createMockSupabase()
    const newRoom = {
      facility_id: 'fac-1',
      name: 'OR-2',
      location_code: 'MAIN-OR-02',
      room_type: 'operating_room' as const,
    }
    const created: EhrTestRoom = {
      id: 'room-2',
      ...newRoom,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: created, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createRoom(client as any, newRoom)

    expect(chainable.insert).toHaveBeenCalledWith(newRoom)
    expect(result.data?.name).toBe('OR-2')
  })
})

// ============================================
// UNIT TESTS — PATIENTS
// ============================================

describe('ehrTestDataDAL - Patients CRUD', () => {
  it('should list patients for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockPatients: EhrTestPatient[] = [
      {
        id: 'pat-1',
        facility_id: 'fac-1',
        first_name: 'John',
        last_name: 'Doe',
        mrn: 'MRN-123456',
        date_of_birth: '1980-01-15',
        gender: 'M',
        address_line: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        phone: '555-1234',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    chainable.order.mockResolvedValue({ data: mockPatients, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listPatients(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('last_name', { ascending: true })
    expect(result.data?.[0].mrn).toBe('MRN-123456')
  })

  it('should create a patient', async () => {
    const { client, chainable } = createMockSupabase()
    const newPatient = {
      facility_id: 'fac-1',
      first_name: 'Jane',
      last_name: 'Smith',
      mrn: 'MRN-789012',
      date_of_birth: '1990-05-20',
      gender: 'F' as const,
    }
    const created: EhrTestPatient = {
      id: 'pat-2',
      ...newPatient,
      address_line: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: created, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createPatient(client as any, newPatient)

    expect(chainable.insert).toHaveBeenCalledWith(newPatient)
    expect(result.data?.last_name).toBe('Smith')
  })
})

// ============================================
// UNIT TESTS — DIAGNOSES
// ============================================

describe('ehrTestDataDAL - Diagnoses CRUD', () => {
  it('should list diagnoses for a facility', async () => {
    const { client, chainable } = createMockSupabase()
    const mockDiagnoses: EhrTestDiagnosis[] = [
      {
        id: 'diag-1',
        facility_id: 'fac-1',
        icd10_code: 'M17.11',
        description: 'Unilateral primary osteoarthritis, right knee',
        specialty: 'Orthopedics',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    chainable.order.mockResolvedValue({ data: mockDiagnoses, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listDiagnoses(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('icd10_code', { ascending: true })
    expect(result.data?.[0].icd10_code).toBe('M17.11')
  })

  it('should create a diagnosis', async () => {
    const { client, chainable } = createMockSupabase()
    const newDiagnosis = {
      facility_id: 'fac-1',
      icd10_code: 'K35.80',
      description: 'Unspecified acute appendicitis',
      specialty: 'General Surgery',
    }
    const created: EhrTestDiagnosis = {
      id: 'diag-2',
      ...newDiagnosis,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValue({ data: created, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createDiagnosis(client as any, newDiagnosis)

    expect(chainable.insert).toHaveBeenCalledWith(newDiagnosis)
    expect(result.data?.icd10_code).toBe('K35.80')
  })
})

// ============================================
// UNIT TESTS — SCHEDULES
// ============================================

describe('ehrTestDataDAL - Schedules CRUD', () => {
  it('should list schedules with joined entity data', async () => {
    const { client, chainable } = createMockSupabase()

    const mockSchedules: EhrTestScheduleWithEntities[] = [
      {
        id: 'sched-1',
        facility_id: 'fac-1',
        patient_id: 'pat-1',
        surgeon_id: 'surg-1',
        procedure_id: 'proc-1',
        room_id: 'room-1',
        diagnosis_id: 'diag-1',
        scheduled_date: '2026-03-15',
        start_time: '08:00:00',
        duration_min: 90,
        trigger_event: 'S12',
        external_case_id: 'TEST-ABC123',
        references_schedule_id: null,
        notes: null,
        sequence_order: 1,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
        patient: {
          id: 'pat-1',
          facility_id: 'fac-1',
          first_name: 'John',
          last_name: 'Doe',
          mrn: 'MRN-123456',
          date_of_birth: '1980-01-15',
          gender: 'M',
          address_line: null,
          city: null,
          state: null,
          zip: null,
          phone: null,
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        surgeon: {
          id: 'surg-1',
          facility_id: 'fac-1',
          name: 'Dr. Alice Smith',
          npi: '1234567890',
          specialty: 'Orthopedic Surgery',
          external_provider_id: 'EPIC-PROV-001',
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        procedure: {
          id: 'proc-1',
          facility_id: 'fac-1',
          name: 'Total Knee Replacement',
          cpt_code: '27447',
          typical_duration_min: 90,
          specialty: 'Orthopedics',
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        room: {
          id: 'room-1',
          facility_id: 'fac-1',
          name: 'OR-1',
          location_code: 'MAIN-OR-01',
          room_type: 'operating_room',
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        diagnosis: {
          id: 'diag-1',
          facility_id: 'fac-1',
          icd10_code: 'M17.11',
          description: 'Unilateral primary osteoarthritis, right knee',
          specialty: 'Orthopedics',
          created_at: '2026-03-01T12:00:00Z',
          updated_at: '2026-03-01T12:00:00Z',
        },
        referenced_schedule: null,
      },
    ]
    // listSchedules chain: .select() → .eq() → .order() → .order() → .order()
    // Need order to return chainable for first two calls, then resolve on third
    chainable.order
      .mockReturnValueOnce(chainable)
      .mockReturnValueOnce(chainable)
      .mockResolvedValueOnce({ data: mockSchedules, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listSchedules(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.order).toHaveBeenCalledWith('sequence_order', { ascending: true })
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0].patient?.first_name).toBe('John')
    expect(result.data?.[0].surgeon?.name).toBe('Dr. Alice Smith')
  })

  it('should auto-generate external_case_id for S12 schedules when not provided', async () => {
    const { client, chainable } = createMockSupabase()
    const newSchedule = {
      facility_id: 'fac-1',
      patient_id: 'pat-1',
      surgeon_id: 'surg-1',
      procedure_id: 'proc-1',
      room_id: 'room-1',
      diagnosis_id: 'diag-1',
      scheduled_date: '2026-03-15',
      start_time: '08:00:00',
      duration_min: 90,
      trigger_event: 'S12' as const,
      sequence_order: 1,
    }
    chainable.single.mockResolvedValue({
      data: { id: 'sched-1', ...newSchedule, external_case_id: 'TEST-ABCD1234' },
      error: null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ehrTestDataDAL.createSchedule(client as any, newSchedule)

    // Verify that insert was called with an auto-generated external_case_id
    expect(chainable.insert).toHaveBeenCalled()
    const insertedData = chainable.insert.mock.calls[0][0]
    expect(insertedData.external_case_id).toBeDefined()
    expect(insertedData.external_case_id).toMatch(/^TEST-[A-Z0-9]{8}$/)
  })

  it('should inherit external_case_id from referenced schedule for S13-S16', async () => {
    const { client, chainable } = createMockSupabase()
    const newSchedule = {
      facility_id: 'fac-1',
      patient_id: 'pat-1',
      surgeon_id: 'surg-1',
      procedure_id: 'proc-1',
      room_id: 'room-1',
      scheduled_date: '2026-03-15',
      start_time: '08:00:00',
      duration_min: 90,
      trigger_event: 'S13' as const,
      references_schedule_id: 'sched-1',
      sequence_order: 2,
    }

    // Mock the referenced schedule query
    const refChainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { external_case_id: 'TEST-ABC123' },
        error: null,
      }),
    }
    client.from.mockReturnValueOnce(refChainable).mockReturnValueOnce(chainable)

    chainable.single.mockResolvedValue({
      data: { id: 'sched-2', ...newSchedule, external_case_id: 'TEST-ABC123' },
      error: null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.createSchedule(client as any, newSchedule)

    // Verify the inheritance logic fetched the referenced schedule
    expect(refChainable.eq).toHaveBeenCalledWith('id', 'sched-1')
    expect(chainable.insert).toHaveBeenCalled()
    const insertedData = chainable.insert.mock.calls[0][0]
    expect(insertedData.external_case_id).toBe('TEST-ABC123')
  })

  it('should list original S12 schedules for referencing', async () => {
    const { client, chainable } = createMockSupabase()
    const mockOriginals: EhrTestSchedule[] = [
      {
        id: 'sched-1',
        facility_id: 'fac-1',
        patient_id: 'pat-1',
        surgeon_id: 'surg-1',
        procedure_id: 'proc-1',
        room_id: 'room-1',
        diagnosis_id: 'diag-1',
        scheduled_date: '2026-03-15',
        start_time: '08:00:00',
        duration_min: 90,
        trigger_event: 'S12',
        external_case_id: 'TEST-ABC123',
        references_schedule_id: null,
        notes: null,
        sequence_order: 1,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      },
    ]
    // Chain: .select() → .eq() → .eq() → .order()
    chainable.order.mockResolvedValue({ data: mockOriginals, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.listOriginalSchedules(client as any, 'fac-1')

    expect(chainable.eq).toHaveBeenCalledWith('facility_id', 'fac-1')
    expect(chainable.eq).toHaveBeenCalledWith('trigger_event', 'S12')
    expect(result.data?.[0].external_case_id).toBe('TEST-ABC123')
  })
})

// ============================================
// INTEGRATION TESTS — Cross-entity workflow
// ============================================

describe('ehrTestDataDAL - Integration: Create full test dataset', () => {
  it('should create entities and schedule with all FKs', async () => {
    const { client, chainable } = createMockSupabase()

    // Surgeon
    const surgeon = {
      id: 'surg-1',
      facility_id: 'fac-1',
      name: 'Dr. Test',
      npi: '1234567890',
      specialty: 'Orthopedics',
      external_provider_id: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: surgeon, error: null })

    // Procedure
    const procedure = {
      id: 'proc-1',
      facility_id: 'fac-1',
      name: 'Knee Replacement',
      cpt_code: '27447',
      typical_duration_min: 90,
      specialty: 'Orthopedics',
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: procedure, error: null })

    // Room
    const room = {
      id: 'room-1',
      facility_id: 'fac-1',
      name: 'OR-1',
      location_code: 'MAIN-OR-01',
      room_type: 'operating_room' as const,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: room, error: null })

    // Patient
    const patient = {
      id: 'pat-1',
      facility_id: 'fac-1',
      first_name: 'John',
      last_name: 'Doe',
      mrn: 'MRN-123456',
      date_of_birth: '1980-01-15',
      gender: 'M' as const,
      address_line: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: patient, error: null })

    // Diagnosis
    const diagnosis = {
      id: 'diag-1',
      facility_id: 'fac-1',
      icd10_code: 'M17.11',
      description: 'Osteoarthritis, right knee',
      specialty: 'Orthopedics',
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: diagnosis, error: null })

    // Schedule
    const schedule = {
      id: 'sched-1',
      facility_id: 'fac-1',
      patient_id: 'pat-1',
      surgeon_id: 'surg-1',
      procedure_id: 'proc-1',
      room_id: 'room-1',
      diagnosis_id: 'diag-1',
      scheduled_date: '2026-03-15',
      start_time: '08:00:00',
      duration_min: 90,
      trigger_event: 'S12' as const,
      external_case_id: 'TEST-ABC123',
      references_schedule_id: null,
      notes: null,
      sequence_order: 1,
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    }
    chainable.single.mockResolvedValueOnce({ data: schedule, error: null })

    // Execute
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surgeonRes = await ehrTestDataDAL.createSurgeon(client as any, {
      facility_id: 'fac-1',
      name: 'Dr. Test',
      npi: '1234567890',
      specialty: 'Orthopedics',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const procRes = await ehrTestDataDAL.createProcedure(client as any, {
      facility_id: 'fac-1',
      name: 'Knee Replacement',
      cpt_code: '27447',
      typical_duration_min: 90,
      specialty: 'Orthopedics',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomRes = await ehrTestDataDAL.createRoom(client as any, {
      facility_id: 'fac-1',
      name: 'OR-1',
      location_code: 'MAIN-OR-01',
      room_type: 'operating_room',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patRes = await ehrTestDataDAL.createPatient(client as any, {
      facility_id: 'fac-1',
      first_name: 'John',
      last_name: 'Doe',
      mrn: 'MRN-123456',
      date_of_birth: '1980-01-15',
      gender: 'M',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diagRes = await ehrTestDataDAL.createDiagnosis(client as any, {
      facility_id: 'fac-1',
      icd10_code: 'M17.11',
      description: 'Osteoarthritis, right knee',
      specialty: 'Orthopedics',
    })

    // Now create schedule with all FKs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedRes = await ehrTestDataDAL.createSchedule(client as any, {
      facility_id: 'fac-1',
      patient_id: patRes.data!.id,
      surgeon_id: surgeonRes.data!.id,
      procedure_id: procRes.data!.id,
      room_id: roomRes.data!.id,
      diagnosis_id: diagRes.data!.id,
      scheduled_date: '2026-03-15',
      start_time: '08:00:00',
      duration_min: 90,
      trigger_event: 'S12',
      sequence_order: 1,
    })

    // Verify all entities created
    expect(surgeonRes.data?.id).toBe('surg-1')
    expect(procRes.data?.id).toBe('proc-1')
    expect(roomRes.data?.id).toBe('room-1')
    expect(patRes.data?.id).toBe('pat-1')
    expect(diagRes.data?.id).toBe('diag-1')
    expect(schedRes.data?.id).toBe('sched-1')
    expect(schedRes.data?.patient_id).toBe('pat-1')
  })

  it('should verify cascade counts before deletion', async () => {
    const { client, chainable } = createMockSupabase()
    chainable.eq.mockResolvedValue({ count: 5, error: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ehrTestDataDAL.countSurgeonScheduleRefs(client as any, 'surg-1')

    expect(result.data).toBe(5)
    // In a real UI workflow, this would trigger a warning:
    // "This surgeon is referenced by 5 schedules. Delete those first or cascade."
  })
})

// ============================================
// WORKFLOW TEST — Full scenario
// ============================================

describe('ehrTestDataDAL - Workflow: Create test dataset + sequence', () => {
  it('should create full dataset and multi-trigger schedule sequence', async () => {
    const { client, chainable } = createMockSupabase()

    // Mock all entity creations
    chainable.single
      .mockResolvedValueOnce({
        data: { id: 'surg-1', facility_id: 'fac-1', name: 'Dr. A' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proc-1', facility_id: 'fac-1', name: 'Procedure A' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'room-1', facility_id: 'fac-1', name: 'OR-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'pat-1', facility_id: 'fac-1', first_name: 'John', last_name: 'Doe' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'diag-1', facility_id: 'fac-1', icd10_code: 'M17.11' },
        error: null,
      })

    // S12 schedule
    chainable.single.mockResolvedValueOnce({
      data: {
        id: 'sched-1',
        facility_id: 'fac-1',
        trigger_event: 'S12',
        external_case_id: 'TEST-ABC123',
        sequence_order: 1,
      },
      error: null,
    })

    // Mock reference lookup for S13 (inherits external_case_id from S12)
    const refChainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { external_case_id: 'TEST-ABC123' },
        error: null,
      }),
    }

    client.from
      .mockReturnValueOnce(chainable) // surgeon
      .mockReturnValueOnce(chainable) // procedure
      .mockReturnValueOnce(chainable) // room
      .mockReturnValueOnce(chainable) // patient
      .mockReturnValueOnce(chainable) // diagnosis
      .mockReturnValueOnce(chainable) // S12 schedule
      .mockReturnValueOnce(refChainable) // reference lookup
      .mockReturnValueOnce(chainable) // S13 insert

    // S13 schedule
    chainable.single.mockResolvedValueOnce({
      data: {
        id: 'sched-2',
        facility_id: 'fac-1',
        trigger_event: 'S13',
        external_case_id: 'TEST-ABC123',
        references_schedule_id: 'sched-1',
        sequence_order: 2,
      },
      error: null,
    })

    // Create entities
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surg = await ehrTestDataDAL.createSurgeon(client as any, { facility_id: 'fac-1', name: 'Dr. A' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = await ehrTestDataDAL.createProcedure(client as any, { facility_id: 'fac-1', name: 'Procedure A' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const room = await ehrTestDataDAL.createRoom(client as any, { facility_id: 'fac-1', name: 'OR-1' })
    const pat = await ehrTestDataDAL.createPatient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { facility_id: 'fac-1', first_name: 'John', last_name: 'Doe' }
    )
    const diag = await ehrTestDataDAL.createDiagnosis(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { facility_id: 'fac-1', icd10_code: 'M17.11', description: 'Osteoarthritis' }
    )

    // Create S12
    const s12 = await ehrTestDataDAL.createSchedule(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      {
        facility_id: 'fac-1',
        patient_id: pat.data!.id,
        surgeon_id: surg.data!.id,
        procedure_id: proc.data!.id,
        room_id: room.data!.id,
        diagnosis_id: diag.data!.id,
        scheduled_date: '2026-03-15',
        start_time: '08:00:00',
        duration_min: 90,
        trigger_event: 'S12',
        sequence_order: 1,
      }
    )

    // Create S13 referencing S12
    const s13 = await ehrTestDataDAL.createSchedule(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      {
        facility_id: 'fac-1',
        patient_id: pat.data!.id,
        surgeon_id: surg.data!.id,
        procedure_id: proc.data!.id,
        room_id: room.data!.id,
        scheduled_date: '2026-03-15',
        start_time: '08:30:00',
        duration_min: 10,
        trigger_event: 'S13',
        references_schedule_id: s12.data!.id,
        sequence_order: 2,
      }
    )

    // Verify sequence
    expect(s12.data?.trigger_event).toBe('S12')
    expect(s12.data?.external_case_id).toBe('TEST-ABC123')
    expect(s13.data?.trigger_event).toBe('S13')
    expect(s13.data?.references_schedule_id).toBe('sched-1')
    expect(s13.data?.external_case_id).toBe('TEST-ABC123') // inherited
  })
})
