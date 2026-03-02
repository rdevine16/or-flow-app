/**
 * Data Access Layer — EHR Test Data Manager
 *
 * Full CRUD for facility-scoped test entity pools:
 * surgeons, procedures, rooms, patients, diagnoses, schedules.
 *
 * All functions take `supabase` as first arg and return `{ data, error }`.
 * All queries filter by `facility_id` for facility scoping.
 */

import type { PostgrestError } from '@supabase/supabase-js'
import type { AnySupabaseClient, DALResult, DALListResult } from './index'
import type {
  EhrTestSurgeon,
  EhrTestSurgeonInsert,
  EhrTestSurgeonUpdate,
  EhrTestProcedure,
  EhrTestProcedureInsert,
  EhrTestProcedureUpdate,
  EhrTestRoom,
  EhrTestRoomInsert,
  EhrTestRoomUpdate,
  EhrTestPatient,
  EhrTestPatientInsert,
  EhrTestPatientUpdate,
  EhrTestDiagnosis,
  EhrTestDiagnosisInsert,
  EhrTestDiagnosisUpdate,
  EhrTestSchedule,
  EhrTestScheduleInsert,
  EhrTestScheduleUpdate,
  EhrTestScheduleWithEntities,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// SURGEONS
// =====================================================

async function listSurgeons(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestSurgeon>> {
  const { data, error } = await supabase
    .from('ehr_test_surgeons')
    .select('*')
    .eq('facility_id', facilityId)
    .order('name', { ascending: true })

  return { data: (data as unknown as EhrTestSurgeon[]) || [], error }
}

async function getSurgeon(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestSurgeon>> {
  const { data, error } = await supabase
    .from('ehr_test_surgeons')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestSurgeon | null, error }
}

async function createSurgeon(
  supabase: AnySupabaseClient,
  surgeon: EhrTestSurgeonInsert
): Promise<DALResult<EhrTestSurgeon>> {
  const { data, error } = await supabase
    .from('ehr_test_surgeons')
    .insert(surgeon)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestSurgeon | null, error }
}

async function updateSurgeon(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestSurgeonUpdate
): Promise<DALResult<EhrTestSurgeon>> {
  const { data, error } = await supabase
    .from('ehr_test_surgeons')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestSurgeon | null, error }
}

async function deleteSurgeon(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_surgeons')
    .delete()
    .eq('id', id)

  return { error }
}

/** Count schedule entries referencing this surgeon (for cascade warning) */
async function countSurgeonScheduleRefs(
  supabase: AnySupabaseClient,
  surgeonId: string
): Promise<DALResult<number>> {
  const { count, error } = await supabase
    .from('ehr_test_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('surgeon_id', surgeonId)

  return { data: count ?? 0, error }
}

// =====================================================
// PROCEDURES
// =====================================================

async function listProcedures(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestProcedure>> {
  const { data, error } = await supabase
    .from('ehr_test_procedures')
    .select('*')
    .eq('facility_id', facilityId)
    .order('name', { ascending: true })

  return { data: (data as unknown as EhrTestProcedure[]) || [], error }
}

async function getProcedure(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestProcedure>> {
  const { data, error } = await supabase
    .from('ehr_test_procedures')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestProcedure | null, error }
}

async function createProcedure(
  supabase: AnySupabaseClient,
  procedure: EhrTestProcedureInsert
): Promise<DALResult<EhrTestProcedure>> {
  const { data, error } = await supabase
    .from('ehr_test_procedures')
    .insert(procedure)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestProcedure | null, error }
}

async function updateProcedure(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestProcedureUpdate
): Promise<DALResult<EhrTestProcedure>> {
  const { data, error } = await supabase
    .from('ehr_test_procedures')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestProcedure | null, error }
}

async function deleteProcedure(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_procedures')
    .delete()
    .eq('id', id)

  return { error }
}

async function countProcedureScheduleRefs(
  supabase: AnySupabaseClient,
  procedureId: string
): Promise<DALResult<number>> {
  const { count, error } = await supabase
    .from('ehr_test_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('procedure_id', procedureId)

  return { data: count ?? 0, error }
}

// =====================================================
// ROOMS
// =====================================================

async function listRooms(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestRoom>> {
  const { data, error } = await supabase
    .from('ehr_test_rooms')
    .select('*')
    .eq('facility_id', facilityId)
    .order('name', { ascending: true })

  return { data: (data as unknown as EhrTestRoom[]) || [], error }
}

async function getRoom(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestRoom>> {
  const { data, error } = await supabase
    .from('ehr_test_rooms')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestRoom | null, error }
}

async function createRoom(
  supabase: AnySupabaseClient,
  room: EhrTestRoomInsert
): Promise<DALResult<EhrTestRoom>> {
  const { data, error } = await supabase
    .from('ehr_test_rooms')
    .insert(room)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestRoom | null, error }
}

async function updateRoom(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestRoomUpdate
): Promise<DALResult<EhrTestRoom>> {
  const { data, error } = await supabase
    .from('ehr_test_rooms')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestRoom | null, error }
}

async function deleteRoom(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_rooms')
    .delete()
    .eq('id', id)

  return { error }
}

async function countRoomScheduleRefs(
  supabase: AnySupabaseClient,
  roomId: string
): Promise<DALResult<number>> {
  const { count, error } = await supabase
    .from('ehr_test_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)

  return { data: count ?? 0, error }
}

// =====================================================
// PATIENTS
// =====================================================

async function listPatients(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestPatient>> {
  const { data, error } = await supabase
    .from('ehr_test_patients')
    .select('*')
    .eq('facility_id', facilityId)
    .order('last_name', { ascending: true })

  return { data: (data as unknown as EhrTestPatient[]) || [], error }
}

async function getPatient(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestPatient>> {
  const { data, error } = await supabase
    .from('ehr_test_patients')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestPatient | null, error }
}

async function createPatient(
  supabase: AnySupabaseClient,
  patient: EhrTestPatientInsert
): Promise<DALResult<EhrTestPatient>> {
  const { data, error } = await supabase
    .from('ehr_test_patients')
    .insert(patient)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestPatient | null, error }
}

async function updatePatient(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestPatientUpdate
): Promise<DALResult<EhrTestPatient>> {
  const { data, error } = await supabase
    .from('ehr_test_patients')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestPatient | null, error }
}

async function deletePatient(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_patients')
    .delete()
    .eq('id', id)

  return { error }
}

async function countPatientScheduleRefs(
  supabase: AnySupabaseClient,
  patientId: string
): Promise<DALResult<number>> {
  const { count, error } = await supabase
    .from('ehr_test_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)

  return { data: count ?? 0, error }
}

// =====================================================
// DIAGNOSES
// =====================================================

async function listDiagnoses(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestDiagnosis>> {
  const { data, error } = await supabase
    .from('ehr_test_diagnoses')
    .select('*')
    .eq('facility_id', facilityId)
    .order('icd10_code', { ascending: true })

  return { data: (data as unknown as EhrTestDiagnosis[]) || [], error }
}

async function getDiagnosis(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestDiagnosis>> {
  const { data, error } = await supabase
    .from('ehr_test_diagnoses')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestDiagnosis | null, error }
}

async function createDiagnosis(
  supabase: AnySupabaseClient,
  diagnosis: EhrTestDiagnosisInsert
): Promise<DALResult<EhrTestDiagnosis>> {
  const { data, error } = await supabase
    .from('ehr_test_diagnoses')
    .insert(diagnosis)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestDiagnosis | null, error }
}

async function updateDiagnosis(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestDiagnosisUpdate
): Promise<DALResult<EhrTestDiagnosis>> {
  const { data, error } = await supabase
    .from('ehr_test_diagnoses')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestDiagnosis | null, error }
}

async function deleteDiagnosis(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_diagnoses')
    .delete()
    .eq('id', id)

  return { error }
}

async function countDiagnosisScheduleRefs(
  supabase: AnySupabaseClient,
  diagnosisId: string
): Promise<DALResult<number>> {
  const { count, error } = await supabase
    .from('ehr_test_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('diagnosis_id', diagnosisId)

  return { data: count ?? 0, error }
}

// =====================================================
// SCHEDULES
// =====================================================

const SCHEDULE_WITH_ENTITIES_SELECT = `
  *,
  patient:ehr_test_patients!patient_id(*),
  surgeon:ehr_test_surgeons!surgeon_id(*),
  procedure:ehr_test_procedures!procedure_id(*),
  room:ehr_test_rooms!room_id(*),
  diagnosis:ehr_test_diagnoses!diagnosis_id(*),
  referenced_schedule:ehr_test_schedules!references_schedule_id(id, external_case_id, trigger_event)
`

async function listSchedules(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestScheduleWithEntities>> {
  const { data, error } = await supabase
    .from('ehr_test_schedules')
    .select(SCHEDULE_WITH_ENTITIES_SELECT)
    .eq('facility_id', facilityId)
    .order('sequence_order', { ascending: true })
    .order('scheduled_date', { ascending: true })
    .order('start_time', { ascending: true })

  return { data: (data as unknown as EhrTestScheduleWithEntities[]) || [], error }
}

async function getSchedule(
  supabase: AnySupabaseClient,
  id: string
): Promise<DALResult<EhrTestScheduleWithEntities>> {
  const { data, error } = await supabase
    .from('ehr_test_schedules')
    .select(SCHEDULE_WITH_ENTITIES_SELECT)
    .eq('id', id)
    .single()

  return { data: data as unknown as EhrTestScheduleWithEntities | null, error }
}

async function createSchedule(
  supabase: AnySupabaseClient,
  schedule: EhrTestScheduleInsert
): Promise<DALResult<EhrTestSchedule>> {
  // Auto-generate external_case_id for S12 entries if not provided
  const insertData = { ...schedule }
  if (!insertData.external_case_id && (!insertData.trigger_event || insertData.trigger_event === 'S12')) {
    insertData.external_case_id = `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  }

  // For S13/S14/S15/S16, inherit external_case_id from referenced schedule
  if (insertData.references_schedule_id && !insertData.external_case_id) {
    const { data: refSchedule } = await supabase
      .from('ehr_test_schedules')
      .select('external_case_id')
      .eq('id', insertData.references_schedule_id)
      .single()

    if (refSchedule) {
      insertData.external_case_id = (refSchedule as { external_case_id: string | null }).external_case_id ?? undefined
    }
  }

  const { data, error } = await supabase
    .from('ehr_test_schedules')
    .insert(insertData)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestSchedule | null, error }
}

async function updateSchedule(
  supabase: AnySupabaseClient,
  id: string,
  updates: EhrTestScheduleUpdate
): Promise<DALResult<EhrTestSchedule>> {
  const { data, error } = await supabase
    .from('ehr_test_schedules')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as unknown as EhrTestSchedule | null, error }
}

async function deleteSchedule(
  supabase: AnySupabaseClient,
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('ehr_test_schedules')
    .delete()
    .eq('id', id)

  return { error }
}

/** List S12 entries for a facility (for referencing from S13/S14/S15/S16) */
async function listOriginalSchedules(
  supabase: AnySupabaseClient,
  facilityId: string
): Promise<DALListResult<EhrTestSchedule>> {
  const { data, error } = await supabase
    .from('ehr_test_schedules')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('trigger_event', 'S12')
    .order('scheduled_date', { ascending: true })

  return { data: (data as unknown as EhrTestSchedule[]) || [], error }
}

// =====================================================
// EXPORT
// =====================================================

export const ehrTestDataDAL = {
  // Surgeons
  listSurgeons,
  getSurgeon,
  createSurgeon,
  updateSurgeon,
  deleteSurgeon,
  countSurgeonScheduleRefs,
  // Procedures
  listProcedures,
  getProcedure,
  createProcedure,
  updateProcedure,
  deleteProcedure,
  countProcedureScheduleRefs,
  // Rooms
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  countRoomScheduleRefs,
  // Patients
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  countPatientScheduleRefs,
  // Diagnoses
  listDiagnoses,
  getDiagnosis,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
  countDiagnosisScheduleRefs,
  // Schedules
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listOriginalSchedules,
}
