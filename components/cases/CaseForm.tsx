'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import SearchableDropdown from '../ui/SearchableDropdown'

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
  notes: string
}

export default function CaseForm({ caseId, mode }: CaseFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    case_number: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '07:30',
    or_room_id: '',
    procedure_type_id: '',
    status_id: '',
    surgeon_id: '',
    anesthesiologist_id: '',
    notes: '',
  })

  const [orRooms, setOrRooms] = useState<{ id: string; name: string }[]>([])
  const [procedureTypes, setProcedureTypes] = useState<{ id: string; name: string }[]>([])
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([])
  const [surgeons, setSurgeons] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [anesthesiologists, setAnesthesiologists] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  useEffect(() => {
    async function fetchOptions() {
      const facilityId = 'a1111111-1111-1111-1111-111111111111'

      const [roomsRes, proceduresRes, statusesRes, usersRes] = await Promise.all([
        supabase.from('or_rooms').select('id, name').eq('facility_id', facilityId).order('name'),
        supabase.from('procedure_types').select('id, name').eq('facility_id', facilityId).order('name'),
        supabase.from('case_statuses').select('id, name').order('display_order'),
        supabase.from('users').select('id, first_name, last_name, role_id').eq('facility_id', facilityId),
      ])

      setOrRooms(roomsRes.data || [])
      setProcedureTypes(proceduresRes.data || [])
      setStatuses(statusesRes.data || [])

      // Get surgeon role ID
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      // Get anesthesiologist role ID
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

      // Set default status to 'scheduled' for new cases
      if (mode === 'create' && statusesRes.data) {
        const scheduledStatus = statusesRes.data.find(s => s.name === 'scheduled')
        if (scheduledStatus) {
          setFormData(prev => ({ ...prev, status_id: scheduledStatus.id }))
        }
      }
    }

    fetchOptions()
  }, [mode])

  useEffect(() => {
    async function fetchCase() {
      if (mode !== 'edit' || !caseId) return

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single()

      if (error || !data) {
        setError('Case not found')
        return
      }

      setFormData({
        case_number: data.case_number || '',
        scheduled_date: data.scheduled_date || '',
        start_time: data.start_time ? data.start_time.slice(0, 5) : '07:30',
        or_room_id: data.or_room_id || '',
        procedure_type_id: data.procedure_type_id || '',
        status_id: data.status_id || '',
        surgeon_id: data.surgeon_id || '',
        anesthesiologist_id: data.anesthesiologist_id || '',
        notes: data.notes || '',
      })
      setInitialLoading(false)
    }

    fetchCase()
  }, [caseId, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const caseData = {
      case_number: formData.case_number,
      scheduled_date: formData.scheduled_date,
      start_time: formData.start_time,
      or_room_id: formData.or_room_id || null,
      procedure_type_id: formData.procedure_type_id || null,
      status_id: formData.status_id,
      surgeon_id: formData.surgeon_id || null,
      anesthesiologist_id: formData.anesthesiologist_id || null,
      notes: formData.notes || null,
      facility_id: 'a1111111-1111-1111-1111-111111111111',
    }

    let result

    if (mode === 'create') {
      result = await supabase.from('cases').insert(caseData).select().single()
    } else {
      result = await supabase.from('cases').update(caseData).eq('id', caseId).select().single()
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
        <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
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
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      {/* OR Room & Procedure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SearchableDropdown
          label="OR Room"
          placeholder="Select OR Room"
          value={formData.or_room_id}
          onChange={(id) => setFormData({ ...formData, or_room_id: id })}
          options={orRooms.map(r => ({ id: r.id, label: r.name }))}
        />
        <SearchableDropdown
          label="Procedure Type"
          placeholder="Select Procedure"
          value={formData.procedure_type_id}
          onChange={(id) => setFormData({ ...formData, procedure_type_id: id })}
          options={procedureTypes.map(p => ({ id: p.id, label: p.name }))}
        />
      </div>

      {/* Surgeon & Anesthesiologist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SearchableDropdown
          label="Surgeon"
          placeholder="Select Surgeon"
          value={formData.surgeon_id}
          onChange={(id) => setFormData({ ...formData, surgeon_id: id })}
          options={surgeons.map(s => ({ id: s.id, label: `Dr. ${s.first_name} ${s.last_name}` }))}
        />
        <SearchableDropdown
          label="Anesthesiologist"
          placeholder="Select Anesthesiologist"
          value={formData.anesthesiologist_id}
          onChange={(id) => setFormData({ ...formData, anesthesiologist_id: id })}
          options={anesthesiologists.map(a => ({ id: a.id, label: `Dr. ${a.first_name} ${a.last_name}` }))}
        />
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

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
          placeholder="Any additional notes..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
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
          className="px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 disabled:opacity-50"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Case' : 'Update Case'}
        </button>
      </div>
    </form>
  )
}