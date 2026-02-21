// ============================================
// FILE: components/cases/CaseForm.tsx
// UPDATED: Added milestone initialization on case creation
// When a case is created, all expected milestones for the procedure type
// are inserted into case_milestones with recorded_at = NULL
// ============================================

'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import SearchableDropdown from '../ui/SearchableDropdown'
import { getLocalDateString } from '@/lib/date-utils'
import { caseAudit, caseDeviceAudit } from '@/lib/audit-logger'
import TimePicker from '../ui/TimePicker'
import DatePickerCalendar from '../ui/DatePickerCalendar'
import ImplantCompanySelect from '../cases/ImplantCompanySelect'
import SurgeonPreferenceSelect from '../cases/SurgeonPreferenceSelect'
import CaseComplexitySelector from '../cases/CaseComplexitySelector'
import StaffMultiSelect from '../cases/StaffMultiSelect'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { LeaveConfirm } from '@/components/ui/ConfirmDialog'
import { createCaseSchema, draftCaseSchema, validateField } from '@/lib/validation/schemas'

interface StaffSelection {
  user_id: string
  role_id: string
}

interface RoomConflict {
  case_number: string
  start_time: string
  end_time: string
  surgeon_name: string | null
}

interface CaseFormProps {
  caseId?: string
  mode: 'create' | 'edit'
}

interface FormData {
  case_number: string
  scheduled_date: string
  start_time: string
  or_room_id: string
  procedure_type_id: string
  status_id: string
  surgeon_id: string
  anesthesiologist_id: string
  operative_side: string
  payer_id: string
  notes: string
}

interface ProcedureType {
  id: string
  name: string
  requires_rep: boolean
  requires_operative_side: boolean
  procedure_category_id: string | null
  expected_duration_minutes: number | null
}

const DEFAULT_CASE_DURATION_MINUTES = 60

/** Convert "HH:MM" to total minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes since midnight back to "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Operative side options
const OPERATIVE_SIDE_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'bilateral', label: 'Bilateral' },
  { id: 'n/a', label: 'N/A' },
]

export default function CaseForm({ caseId, mode }: CaseFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    case_number: '',
    scheduled_date: '',
    start_time: '07:30',
    or_room_id: '',
    procedure_type_id: '',
    status_id: '',
    surgeon_id: '',
    anesthesiologist_id: '',
    operative_side: '',
    payer_id: '',
    notes: '',
  })

  // State for implant companies
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [originalCompanyIds, setOriginalCompanyIds] = useState<string[]>([])
  const [selectedComplexityIds, setSelectedComplexityIds] = useState<string[]>([])
  const [originalComplexityIds, setOriginalComplexityIds] = useState<string[]>([])
  // NEW: Rep required override state
  // null = use procedure default, true = force require, false = force no require
  const [repRequiredOverride, setRepRequiredOverride] = useState<boolean | null>(null)
  const [originalRepRequiredOverride, setOriginalRepRequiredOverride] = useState<boolean | null>(null)

  // Phase 3.1: Staff assignment state
  const [selectedStaff, setSelectedStaff] = useState<StaffSelection[]>([])
  const [originalStaff, setOriginalStaff] = useState<StaffSelection[]>([])

  // Phase 3.3: Room conflict detection state
  const [roomConflicts, setRoomConflicts] = useState<RoomConflict[]>([])
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Draft state
  const [isDraft, setIsDraft] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Store original data for edit mode to track changes
  const [originalData, setOriginalData] = useState<FormData | null>(null)

  const [orRooms, setOrRooms] = useState<{ id: string; name: string }[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [surgeons, setSurgeons] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [anesthesiologists, setAnesthesiologists] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  
  // Payers state
  const [payers, setPayers] = useState<{ id: string; name: string }[]>([])
  
  // Store implant companies for audit logging
  const [implantCompanies, setImplantCompanies] = useState<{ id: string; name: string }[]>([])

  // Phase 1.4: Case number uniqueness check
  const [caseNumberUnique, setCaseNumberUnique] = useState<boolean | null>(null) // null = not checked
  const [checkingCaseNumber, setCheckingCaseNumber] = useState(false)
  const caseNumberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkCaseNumberUniqueness = useCallback((caseNumber: string) => {
    // Clear any pending check
    if (caseNumberTimerRef.current) {
      clearTimeout(caseNumberTimerRef.current)
    }

    // Reset state if empty
    if (!caseNumber.trim()) {
      setCaseNumberUnique(null)
      setCheckingCaseNumber(false)
      return
    }

    setCheckingCaseNumber(true)
    setCaseNumberUnique(null)

    // Debounce 300ms
    caseNumberTimerRef.current = setTimeout(async () => {
      if (!userFacilityId) {
        setCheckingCaseNumber(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from('cases')
        .select('id')
        .eq('facility_id', userFacilityId)
        .eq('case_number', caseNumber.trim())
        .maybeSingle()

      if (queryError) {
        setCheckingCaseNumber(false)
        setCaseNumberUnique(null)
        return
      }

      // In edit mode, ignore the current case's own number
      const isDuplicate = data !== null && (mode === 'create' || data.id !== caseId)
      setCaseNumberUnique(!isDuplicate)
      setCheckingCaseNumber(false)

      if (isDuplicate) {
        setFieldErrors(prev => ({ ...prev, case_number: 'This case number already exists at this facility' }))
      } else {
        setFieldErrors(prev => {
          const next = { ...prev }
          if (next.case_number === 'This case number already exists at this facility') {
            delete next.case_number
          }
          return next
        })
      }
    }, 300)
  }, [userFacilityId, mode, caseId, supabase])

  // Phase 3.3: Room conflict detection — checks for time-overlapping cases in the same room
  const checkRoomConflicts = useCallback((roomId: string, date: string, time: string, procedureTypeId: string) => {
    if (conflictTimerRef.current) {
      clearTimeout(conflictTimerRef.current)
    }

    if (!roomId || !date || !time || !userFacilityId) {
      setRoomConflicts([])
      return
    }

    conflictTimerRef.current = setTimeout(async () => {
      const query = supabase
        .from('cases')
        .select('id, case_number, start_time, procedure_type:procedure_types(expected_duration_minutes), surgeon:users!cases_surgeon_id_fkey(first_name, last_name)')
        .eq('or_room_id', roomId)
        .eq('scheduled_date', date)
        .eq('facility_id', userFacilityId)
        .is('is_draft', false)

      // In edit mode, exclude the current case
      if (mode === 'edit' && caseId) {
        query.neq('id', caseId)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        setRoomConflicts([])
        return
      }

      // Determine the new case's duration from its procedure type
      const newProc = procedureTypes.find(p => p.id === procedureTypeId)
      const newDuration = newProc?.expected_duration_minutes ?? DEFAULT_CASE_DURATION_MINUTES
      const newStart = timeToMinutes(time)
      const newEnd = newStart + newDuration

      // Filter to only cases whose time window overlaps with the new case
      const conflicts: RoomConflict[] = (data || [])
        .map((c: Record<string, unknown>) => {
          const surgeon = c.surgeon as { first_name: string; last_name: string } | null
          const procType = c.procedure_type as { expected_duration_minutes: number | null } | null
          const existingDuration = procType?.expected_duration_minutes ?? DEFAULT_CASE_DURATION_MINUTES
          const startStr = c.start_time ? (c.start_time as string).slice(0, 5) : ''
          const existingStart = startStr ? timeToMinutes(startStr) : 0
          const existingEnd = existingStart + existingDuration

          return {
            case_number: c.case_number as string,
            start_time: startStr,
            end_time: minutesToTime(existingEnd),
            surgeon_name: surgeon ? `Dr. ${surgeon.first_name} ${surgeon.last_name}` : null,
            _overlaps: startStr ? (newStart < existingEnd && newEnd > existingStart) : true,
          }
        })
        .filter(c => c._overlaps)
        .map(({ _overlaps, ...rest }) => rest)

      setRoomConflicts(conflicts)
    }, 300)
  }, [userFacilityId, mode, caseId, supabase, procedureTypes])

  // Re-check conflicts when room, date, time, or procedure changes
  useEffect(() => {
    checkRoomConflicts(formData.or_room_id, formData.scheduled_date, formData.start_time, formData.procedure_type_id)
  }, [formData.or_room_id, formData.scheduled_date, formData.start_time, formData.procedure_type_id, checkRoomConflicts])

  // Compute effective rep required status
  const selectedProcedure = procedureTypes.find(p => p.id === formData.procedure_type_id)
  const procedureRequiresRep = selectedProcedure?.requires_rep ?? false
  const effectiveRepRequired = repRequiredOverride !== null ? repRequiredOverride : procedureRequiresRep

  // ============================================
  // DIRTY STATE: Track unsaved changes
  // ============================================
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const isDirty = useMemo(() => {
    if (!originalData) return false

    // Compare formData fields
    const formChanged = (Object.keys(originalData) as (keyof FormData)[]).some(
      key => formData[key] !== originalData[key]
    )
    if (formChanged) return true

    // Compare company selections
    if (selectedCompanyIds.length !== originalCompanyIds.length ||
        selectedCompanyIds.some(id => !originalCompanyIds.includes(id))) return true

    // Compare complexity selections
    if (selectedComplexityIds.length !== originalComplexityIds.length ||
        selectedComplexityIds.some(id => !originalComplexityIds.includes(id))) return true

    // Compare rep required override
    if (repRequiredOverride !== originalRepRequiredOverride) return true

    // Compare staff selections
    if (selectedStaff.length !== originalStaff.length ||
        selectedStaff.some(s => !originalStaff.find(o => o.user_id === s.user_id))) return true

    return false
  }, [formData, originalData, selectedCompanyIds, originalCompanyIds, selectedComplexityIds, originalComplexityIds, repRequiredOverride, originalRepRequiredOverride, selectedStaff, originalStaff])

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowLeaveConfirm(true)
    } else {
      router.push('/cases')
    }
  }, [isDirty, router])

  // Warn on browser/tab close when form is dirty
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // First, get the current user's facility
  useEffect(() => {
    async function fetchUserFacility() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('You must be logged in to create a case')
        setInitialLoading(false)
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userError || !userData?.facility_id) {
        setError('Could not determine your facility. Please contact an administrator.')
        setInitialLoading(false)
        return
      }

      setUserFacilityId(userData.facility_id)
    }

    fetchUserFacility()
  }, [supabase])

  // Once we have the facility ID, fetch the dropdown options
  useEffect(() => {
    async function fetchOptions() {
      if (!userFacilityId) return

      const [roomsRes, proceduresRes, statusesRes, usersRes, companiesRes, payersRes] = await Promise.all([
        supabase.from('or_rooms').select('id, name').eq('facility_id', userFacilityId).order('name'),
        // UPDATED: Fetch requires_rep along with procedure types
        supabase.from('procedure_types').select('id, name, requires_rep, requires_operative_side, procedure_category_id, expected_duration_minutes')
          .or(`facility_id.is.null,facility_id.eq.${userFacilityId}`)
          .order('name'),
        supabase.from('case_statuses').select('id, name').order('display_order'),
        supabase.from('users').select('id, first_name, last_name, role_id').eq('facility_id', userFacilityId),
        supabase.from('implant_companies').select('id, name')
          .or(`facility_id.is.null,facility_id.eq.${userFacilityId}`)
          .order('name'),
        supabase.from('payers').select('id, name')
          .eq('facility_id', userFacilityId)
          .is('deleted_at', null)
          .order('name'),
      ])

      setOrRooms(roomsRes.data || [])
      setProcedureTypes((proceduresRes.data as ProcedureType[]) || [])
      setStatuses(statusesRes.data || [])
      setImplantCompanies(companiesRes.data || [])
      setPayers(payersRes.data || [])

      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      const { data: anesthRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'anesthesiologist')
        .single()

      if (usersRes.data) {
        if (surgeonRole) {
          setSurgeons(usersRes.data.filter(u => u.role_id === surgeonRole.id))
        }
        if (anesthRole) {
          setAnesthesiologists(usersRes.data.filter(u => u.role_id === anesthRole.id))
        }
      }

      if (mode === 'create') {
        const scheduledStatus = statusesRes.data?.find(s => s.name === 'scheduled')
        const dateFromParams = searchParams.get('date')
        const initialData: FormData = {
          case_number: '',
          scheduled_date: dateFromParams || getLocalDateString(),
          start_time: '07:30',
          or_room_id: '',
          procedure_type_id: '',
          status_id: scheduledStatus?.id || '',
          surgeon_id: '',
          anesthesiologist_id: '',
          operative_side: '',
          payer_id: '',
          notes: '',
        }
        setFormData(initialData)
        setOriginalData(initialData)
        setInitialLoading(false)
      }
    }

    fetchOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFacilityId, mode, supabase])

  // Fetch existing case data for edit mode
  useEffect(() => {
    async function fetchCase() {
      if (mode !== 'edit' || !caseId) return

      // Fetch case data including rep_required_override
      const { data, error } = await supabase
        .from('cases')
        .select('*, rep_required_override')
        .eq('id', caseId)
        .single()

      if (error || !data) {
        setError('Case not found')
        return
      }

      const caseFormData = {
        case_number: data.case_number || '',
        scheduled_date: data.scheduled_date || '',
        start_time: data.start_time ? data.start_time.slice(0, 5) : '07:30',
        or_room_id: data.or_room_id || '',
        procedure_type_id: data.procedure_type_id || '',
        status_id: data.status_id || '',
        surgeon_id: data.surgeon_id || '',
        anesthesiologist_id: data.anesthesiologist_id || '',
        operative_side: data.operative_side || '',
        payer_id: data.payer_id || '',
        notes: data.notes || '',
      }

      setFormData(caseFormData)
      setOriginalData(caseFormData)

      // Set draft state
      if (data.is_draft) {
        setIsDraft(true)
      }

      // Set rep required override
      setRepRequiredOverride(data.rep_required_override)
      setOriginalRepRequiredOverride(data.rep_required_override)

      // Fetch existing implant companies for this case
      const { data: caseCompanies } = await supabase
        .from('case_implant_companies')
        .select('implant_company_id')
        .eq('case_id', caseId)

      if (caseCompanies) {
        const companyIds = caseCompanies.map(cc => cc.implant_company_id)
        setSelectedCompanyIds(companyIds)
        setOriginalCompanyIds(companyIds)
      }
      // Fetch existing complexities for this case
      const { data: caseComplexities } = await supabase
        .from('case_complexities')
        .select('complexity_id')
        .eq('case_id', caseId)

      if (caseComplexities) {
        const complexityIds = caseComplexities.map(cc => cc.complexity_id)
        setSelectedComplexityIds(complexityIds)
        setOriginalComplexityIds(complexityIds)
      }

      // Fetch existing staff assignments for this case
      const { data: caseStaffData } = await supabase
        .from('case_staff')
        .select('user_id, role_id')
        .eq('case_id', caseId)
        .is('removed_at', null)

      if (caseStaffData) {
        setSelectedStaff(caseStaffData)
        setOriginalStaff(caseStaffData)
      }

      setInitialLoading(false)
    }

    if (userFacilityId) {
      fetchCase()
    }
  }, [caseId, mode, userFacilityId, supabase])

  // Handle surgeon preference selection (quick-fill)
  const handlePreferenceSelect = (preference: { procedureTypeId: string; implantCompanyIds: string[] }) => {
    setFormData(prev => ({ ...prev, procedure_type_id: preference.procedureTypeId }))
    setSelectedCompanyIds(preference.implantCompanyIds)
  }

  // NEW: Handle rep required toggle
  const handleRepRequiredToggle = () => {
    // Cycle through: use default -> force yes -> force no -> use default
    if (repRequiredOverride === null) {
      // Currently using default, switch to opposite of default
      setRepRequiredOverride(!procedureRequiresRep)
    } else if (repRequiredOverride === true) {
      // Currently forced yes, switch to forced no
      setRepRequiredOverride(false)
    } else {
      // Currently forced no, switch back to using default
      setRepRequiredOverride(null)
    }
  }

  // ============================================
  // VALIDATION: Zod-based field + form validation
  // ============================================

  // Validate the full form — returns a map of field → error message
  const validateForm = (): Record<string, string> => {
    const result = createCaseSchema.safeParse(formData)
    if (result.success) return {}

    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (field && !errors[field]) {
        errors[field] = issue.message
      }
    }
    return errors
  }

  // Validate a single field on blur
  const handleFieldBlur = (field: string) => {
    const value = formData[field as keyof FormData]
    const error = validateField(createCaseSchema, field, value)
    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }))
    } else {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Clear a specific field error when the user changes that field
  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // ============================================
  // DRAFT SAVE: Relaxed validation, no milestones
  // ============================================
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setError(null)

    if (!userFacilityId) {
      setError('Could not determine your facility. Please try again.')
      setSavingDraft(false)
      return
    }

    // Validate with relaxed draft schema (only date required)
    const draftResult = draftCaseSchema.safeParse(formData)
    if (!draftResult.success) {
      const errors: Record<string, string> = {}
      for (const issue of draftResult.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
      setFieldErrors(errors)
      setError('Please fix the highlighted fields.')
      setSavingDraft(false)
      return
    }
    setFieldErrors({})

    const currentUser = (await supabase.auth.getUser()).data.user

    // Find the "scheduled" status ID for drafts
    let statusId = formData.status_id
    if (!statusId) {
      const scheduledStatus = statuses.find(s => s.name === 'scheduled')
      if (scheduledStatus) statusId = scheduledStatus.id
    }

    const { error: rpcError } = await supabase.rpc('create_case_with_milestones', {
      p_case_number: formData.case_number || `DRAFT-${Date.now()}`,
      p_scheduled_date: formData.scheduled_date,
      p_start_time: formData.start_time || null,
      p_or_room_id: formData.or_room_id || null,
      p_procedure_type_id: formData.procedure_type_id || null,
      p_status_id: statusId || null,
      p_surgeon_id: formData.surgeon_id || null,
      p_facility_id: userFacilityId,
      p_created_by: currentUser?.id || null,
      p_operative_side: formData.operative_side || null,
      p_payer_id: formData.payer_id || null,
      p_notes: formData.notes || null,
      p_rep_required_override: repRequiredOverride,
      p_is_draft: true,
      p_staff_assignments: selectedStaff.length > 0 ? JSON.stringify(selectedStaff) : null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setSavingDraft(false)
      return
    }

    showToast({
      type: 'success',
      title: 'Draft saved',
      message: 'Case saved as draft. You can complete it later.',
    })

    router.push('/cases')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!userFacilityId) {
      setError('Could not determine your facility. Please try again.')
      setLoading(false)
      return
    }

    // Validate required fields via Zod schema
    const errors = validateForm()

    // Phase 1.4: Block if case number is a known duplicate
    if (caseNumberUnique === false) {
      errors.case_number = 'This case number already exists at this facility'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError('Please fill in all required fields.')
      setLoading(false)
      return
    }
    setFieldErrors({})

    // Phase 0.3: Check milestone config BEFORE creating the case
    if (mode === 'create' && formData.procedure_type_id) {
      const { data: procedureMilestones, error: pmError } = await supabase
        .from('procedure_milestone_config')
        .select('facility_milestone_id')
        .eq('procedure_type_id', formData.procedure_type_id)
        .eq('facility_id', userFacilityId)
        .eq('is_enabled', true)

      if (pmError) {
        showToast({
          type: 'error',
          title: 'Milestone Check Failed',
          message: 'Could not verify milestone configuration. Please try again.',
        })
        setLoading(false)
        return
      }

      if (!procedureMilestones || procedureMilestones.length === 0) {
        showToast({
          type: 'error',
          title: 'No Milestones Configured',
          message: 'No milestones are configured for this procedure type. Contact an admin to set up milestones before creating a case.',
        })
        setLoading(false)
        return
      }
    }

    // NEW: Warning if rep required but no company assigned
    if (effectiveRepRequired && selectedCompanyIds.length === 0) {
      const proceed = window.confirm(
        'This case requires a device rep but no implant company is assigned. ' +
        'The case will appear as "No Company Assigned" on the SPD dashboard.\n\n' +
        'Do you want to continue anyway?'
      )
      if (!proceed) {
        setLoading(false)
        return
      }
    }

    const caseData = {
      case_number: formData.case_number,
      scheduled_date: formData.scheduled_date,
      start_time: formData.start_time,
      or_room_id: formData.or_room_id || null,
      procedure_type_id: formData.procedure_type_id || null,
      status_id: formData.status_id,
      surgeon_id: formData.surgeon_id || null,
      operative_side: formData.operative_side || null,
      payer_id: formData.payer_id || null,
      notes: formData.notes || null,
      facility_id: userFacilityId,
      rep_required_override: repRequiredOverride, // NEW
    }

    let result: { data: { id: string } | null; error: { message: string } | null }
    let savedCaseId: string

    if (mode === 'create') {
      // Phase 1.1: Atomic case+milestone creation via RPC
      const currentUser = (await supabase.auth.getUser()).data.user
      const { data: rpcCaseId, error: rpcError } = await supabase.rpc('create_case_with_milestones', {
        p_case_number: formData.case_number,
        p_scheduled_date: formData.scheduled_date,
        p_start_time: formData.start_time,
        p_or_room_id: formData.or_room_id || null,
        p_procedure_type_id: formData.procedure_type_id || null,
        p_status_id: formData.status_id,
        p_surgeon_id: formData.surgeon_id || null,
        p_facility_id: userFacilityId,
        p_created_by: currentUser?.id || null,
        p_operative_side: formData.operative_side || null,
        p_payer_id: formData.payer_id || null,
        p_notes: formData.notes || null,
        p_rep_required_override: repRequiredOverride,
        p_staff_assignments: selectedStaff.length > 0 ? JSON.stringify(selectedStaff) : null,
      })

      result = rpcError
        ? { data: null, error: { message: rpcError.message } }
        : { data: { id: rpcCaseId as string }, error: null }

      if (!result.error && result.data) {
        savedCaseId = result.data.id
        const procedure = procedureTypes.find(p => p.id === formData.procedure_type_id)

        await caseAudit.created(supabase, {
          id: savedCaseId,
          case_number: formData.case_number,
          procedure_name: procedure?.name,
        })

        // Save case complexities
        if (selectedComplexityIds.length > 0) {
          await supabase.from('case_complexities').insert(
            selectedComplexityIds.map(complexityId => ({
              case_id: savedCaseId,
              complexity_id: complexityId,
            }))
          )
        }

        // Save implant companies
        if (selectedCompanyIds.length > 0) {
          await supabase.from('case_implant_companies').insert(
            selectedCompanyIds.map(companyId => ({
              case_id: savedCaseId,
              implant_company_id: companyId,
            }))
          )

          // Audit log each company added
          for (const companyId of selectedCompanyIds) {
            const company = implantCompanies.find(c => c.id === companyId)
            if (company) {
              await caseAudit.implantCompanyAdded(
                supabase,
                savedCaseId,
                formData.case_number,
                company.name,
                companyId,
                userFacilityId
              )
            }
          }

          // If rep is required, also create case_device_companies entries for SPD tracking
          if (effectiveRepRequired) {
            await supabase.from('case_device_companies').insert(
              selectedCompanyIds.map(companyId => ({
                case_id: savedCaseId,
                implant_company_id: companyId,
                tray_status: 'pending',
              }))
            )

            // Create activity log entries
            for (const companyId of selectedCompanyIds) {
              const company = implantCompanies.find(c => c.id === companyId)
              if (company) {
                await supabase.from('case_device_activity').insert({
                  case_id: savedCaseId,
                  implant_company_id: companyId,
                  activity_type: 'company_assigned',
                  actor_id: currentUser?.id,
                  actor_type: 'facility_staff',
                  message: `${company.name} assigned to case`,
                  metadata: { company_name: company.name },
                })

                // Audit log for SPD
                await caseDeviceAudit.companyAssigned(
                  supabase,
                  savedCaseId,
                  formData.case_number,
                  company.name,
                  companyId,
                  userFacilityId
                )
              }
            }
          }
        }
      }
    } else if (isDraft && caseId) {
      // Finalizing a draft → use finalize_draft_case RPC (creates milestones atomically)
      const { data: finalizedId, error: finalizeError } = await supabase.rpc('finalize_draft_case', {
        p_case_id: caseId,
        p_case_number: formData.case_number,
        p_scheduled_date: formData.scheduled_date,
        p_start_time: formData.start_time,
        p_or_room_id: formData.or_room_id || null,
        p_procedure_type_id: formData.procedure_type_id || null,
        p_status_id: formData.status_id,
        p_surgeon_id: formData.surgeon_id || null,
        p_facility_id: userFacilityId,
        p_operative_side: formData.operative_side || null,
        p_payer_id: formData.payer_id || null,
        p_notes: formData.notes || null,
        p_rep_required_override: repRequiredOverride,
      })

      result = finalizeError
        ? { data: null, error: { message: finalizeError.message } }
        : { data: { id: finalizedId as string }, error: null }
      savedCaseId = caseId

      if (!result.error) {
        setIsDraft(false)
        const procedure = procedureTypes.find(p => p.id === formData.procedure_type_id)
        await caseAudit.updated(
          supabase,
          { id: savedCaseId, case_number: formData.case_number },
          { status: 'Draft' },
          { status: 'Finalized', procedure: procedure?.name || 'Unknown' }
        )
      }
    } else {
      result = await supabase.from('cases').update(caseData).eq('id', caseId).select().single()
      savedCaseId = caseId!
      
      if (!result.error && result.data && originalData) {
        // Calculate changes for audit
        const changes: Record<string, unknown> = {}
        const oldValues: Record<string, unknown> = {}

        // Compare each field
        if (formData.case_number !== originalData.case_number) {
          changes.case_number = formData.case_number
          oldValues.case_number = originalData.case_number
        }
        if (formData.scheduled_date !== originalData.scheduled_date) {
          changes.scheduled_date = formData.scheduled_date
          oldValues.scheduled_date = originalData.scheduled_date
        }
        if (formData.start_time !== originalData.start_time) {
          changes.start_time = formData.start_time
          oldValues.start_time = originalData.start_time
        }
        if (formData.or_room_id !== originalData.or_room_id) {
          const newRoom = orRooms.find(r => r.id === formData.or_room_id)
          const oldRoom = orRooms.find(r => r.id === originalData.or_room_id)
          changes.or_room = newRoom?.name || 'None'
          oldValues.or_room = oldRoom?.name || 'None'
        }
        if (formData.procedure_type_id !== originalData.procedure_type_id) {
          const newProcedure = procedureTypes.find(p => p.id === formData.procedure_type_id)
          const oldProcedure = procedureTypes.find(p => p.id === originalData.procedure_type_id)
          changes.procedure = newProcedure?.name || 'None'
          oldValues.procedure = oldProcedure?.name || 'None'
        }
        if (formData.surgeon_id !== originalData.surgeon_id) {
          const newSurgeon = surgeons.find(s => s.id === formData.surgeon_id)
          const oldSurgeon = surgeons.find(s => s.id === originalData.surgeon_id)
          changes.surgeon = newSurgeon ? `Dr. ${newSurgeon.first_name} ${newSurgeon.last_name}` : 'None'
          oldValues.surgeon = oldSurgeon ? `Dr. ${oldSurgeon.first_name} ${oldSurgeon.last_name}` : 'None'
        }
        if (formData.status_id !== originalData.status_id) {
          const newStatus = statuses.find(s => s.id === formData.status_id)
          const oldStatus = statuses.find(s => s.id === originalData.status_id)
          changes.status = newStatus?.name || 'None'
          oldValues.status = oldStatus?.name || 'None'
        }
        if (formData.operative_side !== originalData.operative_side) {
          changes.operative_side = formData.operative_side || 'None'
          oldValues.operative_side = originalData.operative_side || 'None'
        }
        if (formData.payer_id !== originalData.payer_id) {
          const newPayer = payers.find(p => p.id === formData.payer_id)
          const oldPayer = payers.find(p => p.id === originalData.payer_id)
          changes.payer = newPayer?.name || 'None (Default)'
          oldValues.payer = oldPayer?.name || 'None (Default)'
        }
        // Track rep_required_override changes
        if (repRequiredOverride !== originalRepRequiredOverride) {
          changes.rep_required = repRequiredOverride === null ? 'Use Procedure Default' : repRequiredOverride ? 'Required' : 'Not Required'
          oldValues.rep_required = originalRepRequiredOverride === null ? 'Use Procedure Default' : originalRepRequiredOverride ? 'Required' : 'Not Required'
        }

        // Only log if there were changes
        if (Object.keys(changes).length > 0) {
          await caseAudit.updated(
            supabase,
            { id: savedCaseId, case_number: formData.case_number },
            oldValues,
            changes
          )
        }

        // Handle implant company changes
        const addedCompanies = selectedCompanyIds.filter(id => !originalCompanyIds.includes(id))
        const removedCompanies = originalCompanyIds.filter(id => !selectedCompanyIds.includes(id))

        // Remove old companies
        if (removedCompanies.length > 0) {
          await supabase
            .from('case_implant_companies')
            .delete()
            .eq('case_id', savedCaseId)
            .in('implant_company_id', removedCompanies)

          // Also remove from case_device_companies
          await supabase
            .from('case_device_companies')
            .delete()
            .eq('case_id', savedCaseId)
            .in('implant_company_id', removedCompanies)

          for (const companyId of removedCompanies) {
            const company = implantCompanies.find(c => c.id === companyId)
            if (company) {
              await caseAudit.implantCompanyRemoved(
                supabase,
                savedCaseId,
                formData.case_number,
                company.name,
                companyId,
                userFacilityId
              )
            }
          }
        }

        // Add newly selected companies
        if (addedCompanies.length > 0) {
          await supabase.from('case_implant_companies').insert(
            addedCompanies.map(companyId => ({
              case_id: savedCaseId,
              implant_company_id: companyId,
            }))
          )

          // If rep is required, also add to case_device_companies
          if (effectiveRepRequired) {
            await supabase.from('case_device_companies').insert(
              addedCompanies.map(companyId => ({
                case_id: savedCaseId,
                implant_company_id: companyId,
                tray_status: 'pending',
              }))
            )

            // Create activity log entries for new companies
            for (const companyId of addedCompanies) {
              const company = implantCompanies.find(c => c.id === companyId)
              if (company) {
                await supabase.from('case_device_activity').insert({
                  case_id: savedCaseId,
                  implant_company_id: companyId,
                  activity_type: 'company_assigned',
                  actor_id: (await supabase.auth.getUser()).data.user?.id,
                  actor_type: 'facility_staff',
                  message: `${company.name} assigned to case`,
                  metadata: { company_name: company.name },
                })
              }
            }
          }

          // Audit log additions
          for (const companyId of addedCompanies) {
            const company = implantCompanies.find(c => c.id === companyId)
            if (company) {
              await caseAudit.implantCompanyAdded(
                supabase,
                savedCaseId,
                formData.case_number,
                company.name,
                companyId,
                userFacilityId
              )
            }
          }
        }
         const addedComplexities = selectedComplexityIds.filter(id => !originalComplexityIds.includes(id))
        const removedComplexities = originalComplexityIds.filter(id => !selectedComplexityIds.includes(id))

        if (removedComplexities.length > 0) {
          await supabase
            .from('case_complexities')
            .delete()
            .eq('case_id', savedCaseId)
            .in('complexity_id', removedComplexities)
        }

        if (addedComplexities.length > 0) {
          await supabase.from('case_complexities').insert(
            addedComplexities.map(complexityId => ({
              case_id: savedCaseId,
              complexity_id: complexityId,
            }))
          )
        }
      }
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    if (mode === 'create') {
      const preservedDate = formData.scheduled_date
      showToast({
        type: 'success',
        title: 'Case created',
        message: `${formData.case_number} created successfully`,
        duration: 8000,
        action: {
          label: 'Create Another',
          onClick: () => router.push(`/cases/new?date=${preservedDate}`),
        },
      })
      setLoading(false)
      router.push('/cases')
    } else {
      showToast({
        type: 'success',
        title: 'Case updated',
        message: `${formData.case_number} updated successfully`,
      })
      router.push('/cases')
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  if (error && !userFacilityId) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 1. Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DatePickerCalendar
          variant="form"
          label="Scheduled Date"
          required
          value={formData.scheduled_date}
          onChange={(date) => {
            setFormData({ ...formData, scheduled_date: date })
            clearFieldError('scheduled_date')
          }}
          onBlur={() => handleFieldBlur('scheduled_date')}
          error={fieldErrors.scheduled_date}
        />
        <TimePicker
          label="Start Time"
          required
          value={formData.start_time}
          onChange={(val) => {
            setFormData({ ...formData, start_time: val })
            clearFieldError('start_time')
          }}
          onBlur={() => handleFieldBlur('start_time')}
          error={fieldErrors.start_time}
        />
      </div>

      {/* 2. Surgeon — with preference quick-fill below */}
      <SearchableDropdown
        label="Surgeon *"
        placeholder="Select Surgeon"
        value={formData.surgeon_id}
        onChange={(id) => {
          setFormData({ ...formData, surgeon_id: id })
          clearFieldError('surgeon_id')
        }}
        options={surgeons.map(s => ({ id: s.id, label: `Dr. ${s.first_name} ${s.last_name}` }))}
        error={fieldErrors.surgeon_id}
      />

      {/* Surgeon Preference Quick Fill - Only show in create mode after surgeon selected */}
      {mode === 'create' && formData.surgeon_id && userFacilityId && (
        <SurgeonPreferenceSelect
          surgeonId={formData.surgeon_id}
          facilityId={userFacilityId}
          onSelect={handlePreferenceSelect}
        />
      )}

      {/* 3. Procedure & Operative Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <SearchableDropdown
            label="Procedure Type *"
            placeholder="Select Procedure"
            value={formData.procedure_type_id}
            onChange={(id) => {
              const proc = procedureTypes.find(p => p.id === id)
              const updates: Partial<FormData> = { procedure_type_id: id }
              // Clear operative side when switching to a procedure that doesn't need it
              if (!proc?.requires_operative_side) {
                updates.operative_side = ''
              }
              setFormData(prev => ({ ...prev, ...updates }))
              clearFieldError('procedure_type_id')
              // Reset rep override when procedure changes
              setRepRequiredOverride(null)
            }}
            options={procedureTypes.map(p => ({ id: p.id, label: p.name }))}
            error={fieldErrors.procedure_type_id}
          />
        </div>
        {selectedProcedure?.requires_operative_side && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Operative Side
            </label>
            <select
              value={formData.operative_side}
              onChange={(e) => setFormData({ ...formData, operative_side: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            >
              <option value="">Select Side</option>
              {OPERATIVE_SIDE_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Room */}
      <SearchableDropdown
        label="OR Room *"
        placeholder="Select Room"
        value={formData.or_room_id}
        onChange={(id) => {
          setFormData({ ...formData, or_room_id: id })
          clearFieldError('or_room_id')
        }}
        options={orRooms.map(r => ({ id: r.id, label: r.name }))}
        error={fieldErrors.or_room_id}
      />

      {/* Room conflict warning — only shown for time-overlapping cases */}
      {roomConflicts.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg" data-testid="room-conflict-warning">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {roomConflicts.length} overlapping case{roomConflicts.length !== 1 ? 's' : ''} in this room
            </p>
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
              {roomConflicts.map(c => (
                <li key={c.case_number}>
                  {c.case_number} {c.start_time}\u2013{c.end_time}{c.surgeon_name ? ` (${c.surgeon_name})` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 5. Case Number — with real-time uniqueness check */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Case Number <span className="text-red-600">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.case_number}
            onChange={(e) => {
              setFormData({ ...formData, case_number: e.target.value })
              clearFieldError('case_number')
              checkCaseNumberUniqueness(e.target.value)
            }}
            onBlur={() => handleFieldBlur('case_number')}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${fieldErrors.case_number ? 'border-red-400 ring-2 ring-red-500/20' : caseNumberUnique === true ? 'border-green-400 ring-2 ring-green-500/20' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
            placeholder="e.g., C-2025-001"
          />
          {/* Uniqueness indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {checkingCaseNumber && (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
            {!checkingCaseNumber && caseNumberUnique === true && !fieldErrors.case_number && (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!checkingCaseNumber && caseNumberUnique === false && (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
        {fieldErrors.case_number && (
          <p className="text-red-600 text-xs mt-1">{fieldErrors.case_number}</p>
        )}
      </div>

      {/* 6. Device Rep & Implant Companies Section */}
      {userFacilityId && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Device Rep & Trays</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure device company requirements for this case
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rep Required Toggle */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Requires Device Rep
              </label>
              <button
                type="button"
                onClick={handleRepRequiredToggle}
                className={`w-full px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                  effectiveRepRequired
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="font-medium">
                  {effectiveRepRequired ? 'Yes' : 'No'}
                </span>
                <div className="flex items-center gap-2">
                  {repRequiredOverride !== null && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      Override
                    </span>
                  )}
                  <div className={`w-10 h-6 rounded-full transition-colors ${effectiveRepRequired ? 'bg-blue-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-1 ${effectiveRepRequired ? 'translate-x-5 ml-0' : 'translate-x-1'}`} />
                  </div>
                </div>
              </button>
              {selectedProcedure && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Procedure default: {procedureRequiresRep ? 'Required' : 'Not required'}
                  {repRequiredOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setRepRequiredOverride(null)}
                      className="ml-2 text-blue-600 hover:underline"
                    >
                      Reset to default
                    </button>
                  )}
                </p>
              )}
            </div>

            {/* Implant Companies */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Implant Companies
                {effectiveRepRequired && <span className="text-amber-700 ml-1">*</span>}
              </label>
              <ImplantCompanySelect
                facilityId={userFacilityId}
                selectedIds={selectedCompanyIds}
                onChange={setSelectedCompanyIds}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                {effectiveRepRequired
                  ? 'Select vendors providing implants. They will be notified to confirm tray requirements.'
                  : 'Select all vendors providing implants for this case (optional)'}
              </p>
            </div>
          </div>

          {/* Warning if rep required but no company selected */}
          {effectiveRepRequired && selectedCompanyIds.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-800">
                This case requires a device rep but no implant company is selected. Please assign at least one company.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 7. Staff Assignment */}
      {userFacilityId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Staff Assignment
          </label>
          <StaffMultiSelect
            facilityId={userFacilityId}
            selectedStaff={selectedStaff}
            onChange={setSelectedStaff}
            excludeUserIds={formData.surgeon_id ? [formData.surgeon_id] : []}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Assign nurses, techs, and other staff to this case (optional)
          </p>
        </div>
      )}

      {/* 8. Anesthesiologist & Payer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SearchableDropdown
          label="Anesthesiologist"
          placeholder="Select Anesthesiologist"
          value={formData.anesthesiologist_id}
          onChange={(id) => setFormData({ ...formData, anesthesiologist_id: id })}
          options={anesthesiologists.map(a => ({ id: a.id, label: `Dr. ${a.first_name} ${a.last_name}` }))}
        />

        {payers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payer
            </label>
            <select
              value={formData.payer_id}
              onChange={(e) => setFormData({ ...formData, payer_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            >
              <option value="">Default Reimbursement</option>
              {payers.map(payer => (
                <option key={payer.id} value={payer.id}>
                  {payer.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Select payer for profitability tracking (optional)
            </p>
          </div>
        )}
      </div>

      {/* Status - Only show in edit mode */}
      {mode === 'edit' && (
        <SearchableDropdown
          label="Status"
          placeholder="Select Status"
          value={formData.status_id}
          onChange={(id) => setFormData({ ...formData, status_id: id })}
          options={statuses.map(s => ({
            id: s.id,
            label: s.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
          }))}
        />
      )}

      {/* 8. Case Complexities */}
      {userFacilityId && (
        <CaseComplexitySelector
          facilityId={userFacilityId}
          selectedIds={selectedComplexityIds}
          onChange={setSelectedComplexityIds}
          procedureCategoryId={
            procedureTypes.find(p => p.id === formData.procedure_type_id)?.procedure_category_id ?? undefined
          }
        />
      )}

      {/* 9. Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
          placeholder="Any additional notes..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
        >
          Cancel
        </button>
        {mode === 'create' && (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || loading}
            className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
          </button>
        )}
        <button
          type="submit"
          disabled={loading || savingDraft}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          {loading ? 'Saving...' : isDraft ? 'Finalize Case' : mode === 'create' ? 'Create Case' : 'Update Case'}
        </button>
      </div>

      {/* Unsaved changes warning */}
      <LeaveConfirm
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => router.push('/cases')}
      />
    </form>
  )
}