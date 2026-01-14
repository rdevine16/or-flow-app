// ============================================
// FILE: components/cases/CaseForm.tsx
// UPDATED: Added operative_side field
// ============================================

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import SearchableDropdown from '../ui/SearchableDropdown'
import { getLocalDateString } from '../../lib/date-utils'
import { caseAudit } from '../../lib/audit-logger'
import ImplantCompanySelect from '../cases/ImplantCompanySelect'
import SurgeonPreferenceSelect from '../cases/SurgeonPreferenceSelect'

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
  operative_side: string  // NEW
  notes: string
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
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
    operative_side: '',  // NEW
    notes: '',
  })

  // NEW: State for implant companies
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [originalCompanyIds, setOriginalCompanyIds] = useState<string[]>([])

  // Store original data for edit mode to track changes
  const [originalData, setOriginalData] = useState<FormData | null>(null)

  const [orRooms, setOrRooms] = useState<{ id: string; name: string }[]>([])
  const [procedureTypes, setProcedureTypes] = useState<{ id: string; name: string }[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [surgeons, setSurgeons] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [anesthesiologists, setAnesthesiologists] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  
  // NEW: Store implant companies for audit logging
  const [implantCompanies, setImplantCompanies] = useState<{ id: string; name: string }[]>([])

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
  }, [])

  // Once we have the facility ID, fetch the dropdown options
  useEffect(() => {
    async function fetchOptions() {
      if (!userFacilityId) return

      const [roomsRes, proceduresRes, statusesRes, usersRes, companiesRes] = await Promise.all([
        supabase.from('or_rooms').select('id, name').eq('facility_id', userFacilityId).order('name'),
        // UPDATED: Fetch both global (NULL) and facility-specific procedures
        supabase.from('procedure_types').select('id, name')
          .or(`facility_id.is.null,facility_id.eq.${userFacilityId}`)
          .order('name'),
        supabase.from('case_statuses').select('id, name').order('display_order'),
        supabase.from('users').select('id, first_name, last_name, role_id').eq('facility_id', userFacilityId),
        // NEW: Fetch implant companies for audit logging
        supabase.from('implant_companies').select('id, name')
          .or(`facility_id.is.null,facility_id.eq.${userFacilityId}`)
          .order('name'),
      ])

      setOrRooms(roomsRes.data || [])
      setProcedureTypes(proceduresRes.data || [])
      setStatuses(statusesRes.data || [])
      setImplantCompanies(companiesRes.data || [])

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
        setFormData(prev => ({
          ...prev,
          scheduled_date: getLocalDateString(),
        }))
        
        if (statusesRes.data) {
          const scheduledStatus = statusesRes.data.find(s => s.name === 'scheduled')
          if (scheduledStatus) {
            setFormData(prev => ({ ...prev, status_id: scheduledStatus.id }))
          }
        }
        
        setInitialLoading(false)
      }
    }

    fetchOptions()
  }, [userFacilityId, mode])

  // Fetch existing case data for edit mode
  useEffect(() => {
    async function fetchCase() {
      if (mode !== 'edit' || !caseId) return

      // Fetch case data
      const { data, error } = await supabase
        .from('cases')
        .select('*')
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
        operative_side: data.operative_side || '',  // NEW
        notes: data.notes || '',
      }

      setFormData(caseFormData)
      setOriginalData(caseFormData)

      // NEW: Fetch existing implant companies for this case
      const { data: caseCompanies } = await supabase
        .from('case_implant_companies')
        .select('implant_company_id')
        .eq('case_id', caseId)

      if (caseCompanies) {
        const companyIds = caseCompanies.map(cc => cc.implant_company_id)
        setSelectedCompanyIds(companyIds)
        setOriginalCompanyIds(companyIds)
      }

      setInitialLoading(false)
    }

    if (userFacilityId) {
      fetchCase()
    }
  }, [caseId, mode, userFacilityId])

  // NEW: Handle surgeon preference selection (quick-fill)
  const handlePreferenceSelect = (preference: { procedureTypeId: string; implantCompanyIds: string[] }) => {
    setFormData(prev => ({ ...prev, procedure_type_id: preference.procedureTypeId }))
    setSelectedCompanyIds(preference.implantCompanyIds)
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

    const caseData = {
      case_number: formData.case_number,
      scheduled_date: formData.scheduled_date,
      start_time: formData.start_time,
      or_room_id: formData.or_room_id || null,
      procedure_type_id: formData.procedure_type_id || null,
      status_id: formData.status_id,
      surgeon_id: formData.surgeon_id || null,
      anesthesiologist_id: formData.anesthesiologist_id || null,
      operative_side: formData.operative_side || null,  // NEW
      notes: formData.notes || null,
      facility_id: userFacilityId,
    }

    let result
    let savedCaseId: string

    if (mode === 'create') {
      result = await supabase.from('cases').insert(caseData).select().single()
      
      if (!result.error && result.data) {
        savedCaseId = result.data.id
        const procedure = procedureTypes.find(p => p.id === formData.procedure_type_id)
        
        await caseAudit.created(supabase, {
          id: result.data.id,
          case_number: formData.case_number,
          procedure_name: procedure?.name,
        })

        // NEW: Save implant companies
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
        }
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
        // NEW: Track operative side changes
        if (formData.operative_side !== originalData.operative_side) {
          changes.operative_side = formData.operative_side || 'None'
          oldValues.operative_side = originalData.operative_side || 'None'
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

        // NEW: Handle implant company changes
        const addedCompanies = selectedCompanyIds.filter(id => !originalCompanyIds.includes(id))
        const removedCompanies = originalCompanyIds.filter(id => !selectedCompanyIds.includes(id))

        // Remove old companies
        if (removedCompanies.length > 0) {
          await supabase
            .from('case_implant_companies')
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

        // Add new companies
        if (addedCompanies.length > 0) {
          await supabase.from('case_implant_companies').insert(
            addedCompanies.map(companyId => ({
              case_id: savedCaseId,
              implant_company_id: companyId,
            }))
          )

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
      }
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    router.push('/cases')
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Case Number, Date & Start Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Case Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.case_number}
            onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
            required
            placeholder="e.g., C-2025-001"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Scheduled Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* OR Room & Surgeon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SearchableDropdown
          label="OR Room"
          placeholder="Select OR Room"
          value={formData.or_room_id}
          onChange={(id) => setFormData({ ...formData, or_room_id: id })}
          options={orRooms.map(r => ({ id: r.id, label: r.name }))}
        />
        <SearchableDropdown
          label="Surgeon"
          placeholder="Select Surgeon"
          value={formData.surgeon_id}
          onChange={(id) => setFormData({ ...formData, surgeon_id: id })}
          options={surgeons.map(s => ({ id: s.id, label: `Dr. ${s.first_name} ${s.last_name}` }))}
        />
      </div>

      {/* NEW: Surgeon Preference Quick-Fill */}
      {userFacilityId && (
        <SurgeonPreferenceSelect
          surgeonId={formData.surgeon_id || null}
          facilityId={userFacilityId}
          onSelect={handlePreferenceSelect}
        />
      )}

      {/* Procedure Type & Operative Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <SearchableDropdown
            label="Procedure Type"
            placeholder="Select Procedure"
            value={formData.procedure_type_id}
            onChange={(id) => setFormData({ ...formData, procedure_type_id: id })}
            options={procedureTypes.map(p => ({ id: p.id, label: p.name }))}
          />
        </div>
        {/* NEW: Operative Side */}
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
      </div>

      {/* NEW: Implant Companies */}
      {userFacilityId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Implant Companies
          </label>
          <ImplantCompanySelect
            facilityId={userFacilityId}
            selectedIds={selectedCompanyIds}
            onChange={setSelectedCompanyIds}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Select all vendors providing implants for this case
          </p>
        </div>
      )}

      {/* Anesthesiologist */}
      <SearchableDropdown
        label="Anesthesiologist"
        placeholder="Select Anesthesiologist"
        value={formData.anesthesiologist_id}
        onChange={(id) => setFormData({ ...formData, anesthesiologist_id: id })}
        options={anesthesiologists.map(a => ({ id: a.id, label: `Dr. ${a.first_name} ${a.last_name}` }))}
      />

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

      {/* Notes */}
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
          onClick={() => router.push('/cases')}
          className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Case' : 'Update Case'}
        </button>
      </div>
    </form>
  )
}
