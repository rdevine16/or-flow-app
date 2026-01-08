'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Badge from '../../../components/ui/Badge'
import MilestoneButton, { PairedMilestoneButton } from '../../../components/ui/MilestoneButton'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'
import StaffPopover from '../../../components/ui/StaffPopover'

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
}

interface CaseMilestone {
  id: string
  milestone_type_id: string
  recorded_at: string
}

interface CaseData {
  id: string
  case_number: string
  scheduled_date: string
  notes: string | null
  or_rooms: { name: string }[] | null
  procedure_types: { name: string }[] | null
  case_statuses: { id: string; name: string }[] | null
  surgeon: { id: string; first_name: string; last_name: string }[] | null
  anesthesiologist: { id: string; first_name: string; last_name: string }[] | null
}

interface User {
  id: string
  first_name: string
  last_name: string
  user_roles: { name: string }[] | null
}

interface CaseStaff {
  id: string
  user_id: string
  users: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  user_roles: { name: string }[] | { name: string } | null
}

// Define which milestones are paired (start/stop)
const PAIRED_MILESTONES = {
  anesthesia: { start: 'anes_start', end: 'anes_end', displayName: 'Anesthesia' },
  draping: { start: 'prepped', end: 'incision', displayName: 'Prep & Drape' },
}

// Milestones to skip in the regular list (they're handled as pairs)
const SKIP_IN_LIST = ['anes_start', 'anes_end', 'prepped']

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [milestoneTypes, setMilestoneTypes] = useState<MilestoneType[]>([])
  const [caseMilestones, setCaseMilestones] = useState<CaseMilestone[]>([])
  const [caseStaff, setCaseStaff] = useState<CaseStaff[]>([])
  const [availableStaff, setAvailableStaff] = useState<User[]>([])
  const [anesthesiologists, setAnesthesiologists] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: caseResult } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          notes,
          or_rooms (name),
          procedure_types (name),
          case_statuses (id, name),
          surgeon:users!cases_surgeon_id_fkey (id, first_name, last_name),
          anesthesiologist:users!cases_anesthesiologist_id_fkey (id, first_name, last_name)
        `)
        .eq('id', id)
        .single()

      const { data: milestoneTypesResult } = await supabase
        .from('milestone_types')
        .select('*')
        .order('display_order')

      const { data: milestonesResult } = await supabase
        .from('case_milestones')
        .select('id, milestone_type_id, recorded_at')
        .eq('case_id', id)

      const { data: staffResult } = await supabase
        .from('case_staff')
        .select(`
          id,
          user_id,
          users (first_name, last_name),
          user_roles (name)
        `)
        .eq('case_id', id)

      const { data: availableResult } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          user_roles (name)
        `)
        .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
        .in('role_id', [
          (await supabase.from('user_roles').select('id').eq('name', 'nurse').single()).data?.id,
          (await supabase.from('user_roles').select('id').eq('name', 'tech').single()).data?.id,
        ].filter(Boolean))

      const { data: anesthResult } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          user_roles (name)
        `)
        .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
        .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'anesthesiologist').single()).data?.id)

      setCaseData(caseResult as CaseData)
      setMilestoneTypes(milestoneTypesResult || [])
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(availableResult as User[] || [])
      setAnesthesiologists(anesthResult as User[] || [])
      setLoading(false)
    }

    fetchData()
  }, [id])

  const recordMilestone = async (milestoneTypeId: string) => {
    const { data, error } = await supabase
      .from('case_milestones')
      .insert({
        case_id: id,
        milestone_type_id: milestoneTypeId,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (!error && data) {
      setCaseMilestones([...caseMilestones, data])

      if (caseMilestones.length === 0) {
        const { data: statusData } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'in_progress')
          .single()

        if (statusData) {
          await supabase.from('cases').update({ status_id: statusData.id }).eq('id', id)
          setCaseData(prev => prev ? { ...prev, case_statuses: [{ id: statusData.id, name: 'in_progress' }] } : null)
        }
      }

      const milestoneType = milestoneTypes.find(m => m.id === milestoneTypeId)
      if (milestoneType?.name === 'patient_out') {
        const { data: statusData } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'completed')
          .single()

        if (statusData) {
          await supabase.from('cases').update({ status_id: statusData.id }).eq('id', id)
          setCaseData(prev => prev ? { ...prev, case_statuses: [{ id: statusData.id, name: 'completed' }] } : null)
        }
      }
    }
  }

  const undoMilestone = async (milestoneId: string) => {
    await supabase.from('case_milestones').delete().eq('id', milestoneId)
    setCaseMilestones(caseMilestones.filter(m => m.id !== milestoneId))
  }

  const updateAnesthesiologist = async (userId: string) => {
    await supabase.from('cases').update({ anesthesiologist_id: userId }).eq('id', id)
    const user = anesthesiologists.find(a => a.id === userId)
    if (user) {
      setCaseData(prev => prev ? {
        ...prev,
        anesthesiologist: [{ id: user.id, first_name: user.first_name, last_name: user.last_name }]
      } : null)
    }
  }

  const addStaff = async (userId: string) => {
    const user = availableStaff.find(s => s.id === userId)
    if (!user) return

    const { data: roleData } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', userId)
      .single()

    const { data, error } = await supabase
      .from('case_staff')
      .insert({
        case_id: id,
        user_id: userId,
        role_id: roleData?.role_id,
      })
      .select(`
        id,
        user_id,
        users (first_name, last_name),
        user_roles (name)
      `)
      .single()

    if (!error && data) {
      setCaseStaff([...caseStaff, data as CaseStaff])
    }
  }

  const removeStaff = async (staffId: string) => {
    await supabase.from('case_staff').delete().eq('id', staffId)
    setCaseStaff(caseStaff.filter(s => s.id !== staffId))
  }

  // Helper to get milestone by name
  const getMilestoneByName = (name: string) => {
    const type = milestoneTypes.find(m => m.name === name)
    if (!type) return null
    return caseMilestones.find(m => m.milestone_type_id === type.id)
  }

  const getMilestoneTypeByName = (name: string) => {
    return milestoneTypes.find(m => m.name === name)
  }

  const getMilestoneTime = (name: string): string | null => {
    const milestone = getMilestoneByName(name)
    return milestone?.recorded_at || null
  }

  const calculateDuration = (startName: string, endName: string): string => {
    const startTime = getMilestoneTime(startName)
    const endTime = getMilestoneTime(endName)

    if (!startTime || !endTime) return '--:--:--'

    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const calculateRunningTime = (startName: string): string => {
    const startTime = getMilestoneTime(startName)
    if (!startTime) return '--:--:--'

    const diffMs = currentTime - new Date(startTime).getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const [currentTime, setCurrentTime] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const totalTime = getMilestoneTime('patient_out')
    ? calculateDuration('patient_in', 'patient_out')
    : getMilestoneTime('patient_in')
    ? calculateRunningTime('patient_in')
    : '--:--:--'

  const surgicalTime = getMilestoneTime('closing')
    ? calculateDuration('incision', 'closing')
    : getMilestoneTime('incision')
    ? calculateRunningTime('incision')
    : '--:--:--'

  const getStatusVariant = (status: string | undefined): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'warning'
      case 'delayed': return 'error'
      case 'cancelled': return 'error'
      default: return 'info'
    }
  }

  // Get milestones for display (excluding paired ones that are handled separately)
  const singleMilestones = milestoneTypes.filter(m => !SKIP_IN_LIST.includes(m.name))

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </DashboardLayout>
    )
  }

  if (!caseData) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold text-slate-900">Case not found</h2>
          <button onClick={() => router.push('/dashboard')} className="mt-4 text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const staffForPopover = caseStaff.map(s => {
    const user = Array.isArray(s.users) ? s.users[0] : s.users
    const role = Array.isArray(s.user_roles) ? s.user_roles[0] : s.user_roles
    return {
      id: s.id,
      name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      role: role?.name || 'Staff',
    }
  })

  const availableStaffOptions = availableStaff
    .filter(s => !caseStaff.some(cs => cs.user_id === s.id))
    .map(s => ({
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      subtitle: s.user_roles?.[0]?.name || 'Staff',
    }))

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col p-6 overflow-auto">
        
        {/* Top Bar - Case Info */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{caseData.case_number}</h1>
                  <span className="text-slate-300">•</span>
                  <span className="text-lg text-slate-600">{caseData.procedure_types?.[0]?.name}</span>
                </div>
              </div>
            </div>
            <Badge variant={getStatusVariant(caseData.case_statuses?.[0]?.name)} size="md">
              {caseData.case_statuses?.[0]?.name?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}
            </Badge>
          </div>

          {/* Info Bar */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {/* OR Room */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-sm font-semibold text-slate-700">{caseData.or_rooms?.[0]?.name || 'No Room'}</span>
            </div>

            {/* Surgeon */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <span className="text-xs text-slate-400">Surgeon</span>
                <p className="text-sm font-semibold text-slate-700">
                  {caseData.surgeon?.[0] ? `Dr. ${caseData.surgeon[0].first_name} ${caseData.surgeon[0].last_name}` : 'Not assigned'}
                </p>
              </div>
            </div>

            {/* Anesthesiologist Dropdown */}
            <div className="min-w-[200px]">
              <SearchableDropdown
                placeholder="Select Anesthesiologist"
                value={caseData.anesthesiologist?.[0]?.id}
                onChange={updateAnesthesiologist}
                options={anesthesiologists.map(a => ({
                  id: a.id,
                  label: `Dr. ${a.first_name} ${a.last_name}`,
                  subtitle: 'Anesthesiologist',
                }))}
              />
            </div>

            {/* Staff Popover */}
            <StaffPopover
              staff={staffForPopover}
              availableStaff={availableStaffOptions}
              onAdd={addStaff}
              onRemove={removeStaff}
            />
          </div>
        </div>

        {/* Time Cards */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-6 mb-6">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.05),transparent)]" />
            <p className="text-slate-400 text-sm font-medium tracking-wider mb-1">TOTAL TIME</p>
            <p className="text-5xl lg:text-6xl font-bold text-white font-mono tracking-wider relative">{totalTime}</p>
            <p className="text-slate-500 text-xs mt-2">Patient In → Patient Out</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent)]" />
            <p className="text-blue-100 text-sm font-medium tracking-wider mb-1">SURGICAL TIME</p>
            <p className="text-5xl lg:text-6xl font-bold text-white font-mono tracking-wider relative">{surgicalTime}</p>
            <p className="text-blue-200 text-xs mt-2">Incision → Closing</p>
          </div>
        </div>

        {/* Milestones - Responsive Grid */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Case Milestones</h2>
            <div className="text-sm text-slate-400">
              {caseMilestones.length} of {milestoneTypes.length} recorded
            </div>
          </div>
          
          {/* Responsive Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* Patient In */}
            {(() => {
              const type = getMilestoneTypeByName('patient_in')
              const milestone = getMilestoneByName('patient_in')
              if (!type) return null
              return (
                <MilestoneButton
                  key={type.id}
                  name={type.name}
                  displayName={type.display_name}
                  recordedAt={milestone?.recorded_at}
                  onRecord={() => recordMilestone(type.id)}
                  onUndo={() => milestone && undoMilestone(milestone.id)}
                />
              )
            })()}

            {/* Anesthesia (Paired) */}
            {(() => {
              const startType = getMilestoneTypeByName('anes_start')
              const endType = getMilestoneTypeByName('anes_end')
              const startMilestone = getMilestoneByName('anes_start')
              const endMilestone = getMilestoneByName('anes_end')
              if (!startType || !endType) return null
              return (
                <PairedMilestoneButton
                  key="anesthesia"
                  displayName="Anesthesia"
                  startRecordedAt={startMilestone?.recorded_at}
                  endRecordedAt={endMilestone?.recorded_at}
                  onRecordStart={() => recordMilestone(startType.id)}
                  onRecordEnd={() => recordMilestone(endType.id)}
                  onUndoStart={() => startMilestone && undoMilestone(startMilestone.id)}
                  onUndoEnd={() => endMilestone && undoMilestone(endMilestone.id)}
                />
              )
            })()}

            {/* Prep & Drape (Paired: prepped -> incision) */}
            {(() => {
              const startType = getMilestoneTypeByName('prepped')
              const endType = getMilestoneTypeByName('incision')
              const startMilestone = getMilestoneByName('prepped')
              const endMilestone = getMilestoneByName('incision')
              if (!startType || !endType) return null
              return (
                <PairedMilestoneButton
                  key="draping"
                  displayName="Prep & Drape"
                  startRecordedAt={startMilestone?.recorded_at}
                  endRecordedAt={endMilestone?.recorded_at}
                  onRecordStart={() => recordMilestone(startType.id)}
                  onRecordEnd={() => recordMilestone(endType.id)}
                  onUndoStart={() => startMilestone && undoMilestone(startMilestone.id)}
                  onUndoEnd={() => endMilestone && undoMilestone(endMilestone.id)}
                />
              )
            })()}

            {/* Remaining Single Milestones */}
            {singleMilestones
              .filter(type => !['patient_in', 'incision'].includes(type.name)) // incision is handled in Prep & Drape
              .map(type => {
                const milestone = caseMilestones.find(m => m.milestone_type_id === type.id)
                return (
                  <MilestoneButton
                    key={type.id}
                    name={type.name}
                    displayName={type.display_name}
                    recordedAt={milestone?.recorded_at}
                    onRecord={() => recordMilestone(type.id)}
                    onUndo={() => milestone && undoMilestone(milestone.id)}
                  />
                )
              })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
