'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import { Modal } from '@/components/ui/Modal'
import SearchableDropdown from '@/components/ui/SearchableDropdown'
import DatePickerCalendar from '@/components/ui/DatePickerCalendar'
import TimePicker from '@/components/ui/TimePicker'
import { AlertTriangle } from 'lucide-react'
import type {
  EhrTestTriggerEvent,
  EhrTestScheduleWithEntities,
  EhrTestScheduleInsert,
  EhrTestScheduleUpdate,
  EhrTestSurgeon,
  EhrTestProcedure,
  EhrTestRoom,
  EhrTestPatient,
  EhrTestDiagnosis,
  EhrTestSchedule,
} from '@/lib/integrations/shared/integration-types'

// -- Trigger event config ---------------------------------------------------

const TRIGGER_EVENTS: { value: EhrTestTriggerEvent; label: string; color: string }[] = [
  { value: 'S12', label: 'New Schedule', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'S13', label: 'Reschedule', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'S14', label: 'Modify', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'S15', label: 'Cancel', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'S16', label: 'Discontinue', color: 'bg-red-100 text-red-700 border-red-300' },
]

// -- Props ------------------------------------------------------------------

interface ScheduleEntryFormProps {
  open: boolean
  onClose: () => void
  onSaved: (savedId?: string) => void
  facilityId: string
  editingSchedule: EhrTestScheduleWithEntities | null
}

// -- Helper: today's date in YYYY-MM-DD format ------------------------------

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// -- Component --------------------------------------------------------------

export default function ScheduleEntryForm({
  open,
  onClose,
  onSaved,
  facilityId,
  editingSchedule,
}: ScheduleEntryFormProps) {
  const supabase = createClient()

  // Form state
  const [triggerEvent, setTriggerEvent] = useState<EhrTestTriggerEvent>('S12')
  const [patientId, setPatientId] = useState('')
  const [surgeonId, setSurgeonId] = useState('')
  const [procedureId, setProcedureId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [diagnosisId, setDiagnosisId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('07:30')
  const [durationMin, setDurationMin] = useState(60)
  const [referencesScheduleId, setReferencesScheduleId] = useState('')
  const [notes, setNotes] = useState('')
  const [sequenceOrder, setSequenceOrder] = useState(0)
  const [saving, setSaving] = useState(false)

  // Load entity pools for dropdowns
  const { data: patients } = useSupabaseQuery<EhrTestPatient[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listPatients(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open, deps: [facilityId, open] }
  )

  const { data: surgeons } = useSupabaseQuery<EhrTestSurgeon[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listSurgeons(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open, deps: [facilityId, open] }
  )

  const { data: procedures } = useSupabaseQuery<EhrTestProcedure[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listProcedures(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open, deps: [facilityId, open] }
  )

  const { data: rooms } = useSupabaseQuery<EhrTestRoom[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listRooms(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open, deps: [facilityId, open] }
  )

  const { data: diagnoses } = useSupabaseQuery<EhrTestDiagnosis[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listDiagnoses(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open, deps: [facilityId, open] }
  )

  // Load S12 entries for "References Case" dropdown
  const { data: originalSchedules } = useSupabaseQuery<EhrTestSchedule[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listOriginalSchedules(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId && open && triggerEvent !== 'S12', deps: [facilityId, open, triggerEvent] }
  )

  // Does this trigger event reference another schedule?
  const needsReference = triggerEvent !== 'S12'
  // S15/S16 = cancel/discontinue: entity fields should be read-only
  const entityFieldsReadOnly = triggerEvent === 'S15' || triggerEvent === 'S16'

  // Build dropdown options
  const patientOptions = useMemo(() =>
    (patients || []).map((p) => ({
      id: p.id,
      label: `${p.last_name}, ${p.first_name}`,
      subtitle: p.mrn ? `MRN: ${p.mrn}` : undefined,
    })),
    [patients]
  )

  const surgeonOptions = useMemo(() =>
    (surgeons || []).map((s) => ({
      id: s.id,
      label: s.name,
      subtitle: s.npi ? `NPI: ${s.npi}` : undefined,
    })),
    [surgeons]
  )

  const procedureOptions = useMemo(() =>
    (procedures || []).map((p) => ({
      id: p.id,
      label: p.name,
      subtitle: p.cpt_code ? `CPT: ${p.cpt_code}` : undefined,
    })),
    [procedures]
  )

  const roomOptions = useMemo(() =>
    (rooms || []).map((r) => ({
      id: r.id,
      label: r.name,
      subtitle: r.location_code || undefined,
    })),
    [rooms]
  )

  const diagnosisOptions = useMemo(() =>
    (diagnoses || []).map((d) => ({
      id: d.id,
      label: `${d.icd10_code} - ${d.description}`,
      subtitle: d.specialty || undefined,
    })),
    [diagnoses]
  )

  const referenceOptions = useMemo(() => {
    const schedules = originalSchedules || []
    // Exclude the entry being edited (can't reference itself)
    const filtered = editingSchedule
      ? schedules.filter((s) => s.id !== editingSchedule.id)
      : schedules
    return filtered.map((s) => {
      // Build a label showing patient + procedure + date
      const patientName = (patients || []).find((p) => p.id === s.patient_id)
      const procName = (procedures || []).find((p) => p.id === s.procedure_id)
      const label = [
        patientName ? `${patientName.last_name}, ${patientName.first_name}` : 'Unknown Patient',
        procName?.name || 'Unknown Procedure',
        s.scheduled_date,
      ].join(' | ')
      return {
        id: s.id,
        label,
        subtitle: s.external_case_id ? `ID: ${s.external_case_id}` : undefined,
      }
    })
  }, [originalSchedules, editingSchedule, patients, procedures])

  // Initialize form when opening
  useEffect(() => {
    if (!open) return

    if (editingSchedule) {
      setTriggerEvent(editingSchedule.trigger_event)
      setPatientId(editingSchedule.patient_id)
      setSurgeonId(editingSchedule.surgeon_id)
      setProcedureId(editingSchedule.procedure_id)
      setRoomId(editingSchedule.room_id)
      setDiagnosisId(editingSchedule.diagnosis_id || '')
      setScheduledDate(editingSchedule.scheduled_date)
      setStartTime(editingSchedule.start_time)
      setDurationMin(editingSchedule.duration_min)
      setReferencesScheduleId(editingSchedule.references_schedule_id || '')
      setNotes(editingSchedule.notes || '')
      setSequenceOrder(editingSchedule.sequence_order)
    } else {
      // Reset form for new entry
      setTriggerEvent('S12')
      setPatientId('')
      setSurgeonId('')
      setProcedureId('')
      setRoomId('')
      setDiagnosisId('')
      setScheduledDate(todayStr())
      setStartTime('07:30')
      setDurationMin(60)
      setReferencesScheduleId('')
      setNotes('')
      setSequenceOrder(0)
    }
  }, [open, editingSchedule])

  // Auto-fill from referenced S12 entry
  const handleReferenceChange = (refId: string) => {
    setReferencesScheduleId(refId)
    if (!refId) return

    const refSchedule = (originalSchedules || []).find((s) => s.id === refId)
    if (!refSchedule) return

    setPatientId(refSchedule.patient_id)
    setSurgeonId(refSchedule.surgeon_id)
    setProcedureId(refSchedule.procedure_id)
    setRoomId(refSchedule.room_id)
    setDiagnosisId(refSchedule.diagnosis_id || '')
    setScheduledDate(refSchedule.scheduled_date)
    setStartTime(refSchedule.start_time)
    setDurationMin(refSchedule.duration_min)
  }

  // Auto-fill duration from selected procedure
  const handleProcedureChange = (procId: string) => {
    setProcedureId(procId)
    const proc = (procedures || []).find((p) => p.id === procId)
    if (proc?.typical_duration_min) {
      setDurationMin(proc.typical_duration_min)
    }
  }

  // Sequence order warning: S13+ should have higher sequence than referenced S12
  const sequenceWarning = useMemo(() => {
    if (!needsReference || !referencesScheduleId) return null
    const refSchedule = (originalSchedules || []).find((s) => s.id === referencesScheduleId)
    if (!refSchedule) return null
    if (sequenceOrder <= refSchedule.sequence_order) {
      return `Warning: This ${triggerEvent} entry has a sequence order (${sequenceOrder}) that is not greater than the referenced S12 entry (${refSchedule.sequence_order}). Messages may be sent out of order.`
    }
    return null
  }, [needsReference, referencesScheduleId, originalSchedules, sequenceOrder, triggerEvent])

  // Validation
  const isValid = patientId && surgeonId && procedureId && roomId && scheduledDate && startTime && durationMin > 0

  // Save handler
  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)

    try {
      let savedId: string | undefined
      if (editingSchedule) {
        const updates: EhrTestScheduleUpdate = {
          patient_id: patientId,
          surgeon_id: surgeonId,
          procedure_id: procedureId,
          room_id: roomId,
          diagnosis_id: diagnosisId || null,
          scheduled_date: scheduledDate,
          start_time: startTime,
          duration_min: durationMin,
          trigger_event: triggerEvent,
          references_schedule_id: referencesScheduleId || null,
          notes: notes.trim() || null,
          sequence_order: sequenceOrder,
        }
        const { data, error } = await ehrTestDataDAL.updateSchedule(supabase, editingSchedule.id, updates)
        if (error) throw error
        savedId = data?.id || editingSchedule.id
      } else {
        const insert: EhrTestScheduleInsert = {
          facility_id: facilityId,
          patient_id: patientId,
          surgeon_id: surgeonId,
          procedure_id: procedureId,
          room_id: roomId,
          diagnosis_id: diagnosisId || undefined,
          scheduled_date: scheduledDate,
          start_time: startTime,
          duration_min: durationMin,
          trigger_event: triggerEvent,
          references_schedule_id: referencesScheduleId || undefined,
          notes: notes.trim() || undefined,
          sequence_order: sequenceOrder,
        }
        const { data, error } = await ehrTestDataDAL.createSchedule(supabase, insert)
        if (error) throw error
        savedId = data?.id
      }
      onSaved(savedId)
      onClose()
    } catch (err) {
      // Error handled by parent via toast
      throw err
    } finally {
      setSaving(false)
    }
  }

  // External case ID display
  const externalCaseIdDisplay = editingSchedule?.external_case_id
    || (triggerEvent === 'S12' ? '(auto-generated on save)' : referencesScheduleId
      ? (originalSchedules || []).find((s) => s.id === referencesScheduleId)?.external_case_id || '(inherited from reference)'
      : '(select a reference)')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingSchedule ? 'Edit Schedule Entry' : 'Add Schedule Entry'}
      size="xl"
      scrollable
    >
      <div className="space-y-5">
        {/* Trigger Event Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Trigger Event *
          </label>
          <div className="flex flex-wrap gap-2">
            {TRIGGER_EVENTS.map((te) => (
              <button
                key={te.value}
                type="button"
                onClick={() => {
                  setTriggerEvent(te.value)
                  if (te.value === 'S12') {
                    setReferencesScheduleId('')
                  }
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                  triggerEvent === te.value
                    ? `${te.color} border-current`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {te.value} — {te.label}
              </button>
            ))}
          </div>
        </div>

        {/* References Case (S13-S16 only) */}
        {needsReference && (
          <div>
            <SearchableDropdown
              label="References Case (S12 entry) *"
              options={referenceOptions}
              value={referencesScheduleId}
              onChange={handleReferenceChange}
              placeholder="Select an existing S12 schedule entry..."
            />
            <p className="mt-1 text-xs text-slate-500">
              {triggerEvent === 'S13' || triggerEvent === 'S14'
                ? 'Entity fields will be pre-filled but you can change them'
                : 'Entity fields will be locked to the referenced entry'}
            </p>
          </div>
        )}

        {/* Entity Selectors — 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown
            label="Patient *"
            options={patientOptions}
            value={patientId}
            onChange={setPatientId}
            placeholder="Select patient..."
            disabled={entityFieldsReadOnly && !!referencesScheduleId}
          />
          <SearchableDropdown
            label="Surgeon *"
            options={surgeonOptions}
            value={surgeonId}
            onChange={setSurgeonId}
            placeholder="Select surgeon..."
            disabled={entityFieldsReadOnly && !!referencesScheduleId}
          />
          <SearchableDropdown
            label="Procedure *"
            options={procedureOptions}
            value={procedureId}
            onChange={entityFieldsReadOnly && referencesScheduleId ? () => {} : handleProcedureChange}
            placeholder="Select procedure..."
            disabled={entityFieldsReadOnly && !!referencesScheduleId}
          />
          <SearchableDropdown
            label="Room *"
            options={roomOptions}
            value={roomId}
            onChange={setRoomId}
            placeholder="Select room..."
            disabled={entityFieldsReadOnly && !!referencesScheduleId}
          />
          <SearchableDropdown
            label="Diagnosis (optional)"
            options={diagnosisOptions}
            value={diagnosisId}
            onChange={setDiagnosisId}
            placeholder="Select diagnosis..."
            disabled={entityFieldsReadOnly && !!referencesScheduleId}
          />
        </div>

        {/* Date, Time, Duration — row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DatePickerCalendar
            label="Scheduled Date"
            value={scheduledDate}
            onChange={setScheduledDate}
            variant="form"
            required
          />
          <TimePicker
            label="Start Time"
            value={startTime}
            onChange={setStartTime}
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Duration (min) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={600}
              value={durationMin}
              onChange={(e) => setDurationMin(parseInt(e.target.value, 10) || 60)}
              className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* External Case ID (read-only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            External Case ID
          </label>
          <div className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono">
            {externalCaseIdDisplay}
          </div>
        </div>

        {/* Sequence Order & Notes — row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sequence Order
            </label>
            <input
              type="number"
              min={0}
              value={sequenceOrder}
              onChange={(e) => setSequenceOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">Controls the order messages are sent (lower = earlier)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g., "Tests unknown surgeon scenario"'
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sequence order warning */}
        {sequenceWarning && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{sequenceWarning}</span>
          </div>
        )}
      </div>

      <Modal.Footer>
        <Modal.Cancel onClick={onClose} />
        <Modal.Action onClick={handleSave} loading={saving} disabled={!isValid}>
          {editingSchedule ? 'Save Changes' : 'Add Entry'}
        </Modal.Action>
      </Modal.Footer>
    </Modal>
  )
}
