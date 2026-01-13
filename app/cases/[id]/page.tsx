'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import MilestoneButton, { PairedMilestoneButton } from '../../../components/ui/MilestoneButton'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'
import StaffPopover from '../../../components/ui/StaffPopover'
import SurgeonAvatar from '../../../components/ui/SurgeonAvatar'
import { milestoneAudit, staffAudit, caseAudit } from '../../../lib/audit-logger'

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
  start_time: string | null
  notes: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { id: string; name: string }[] | { id: string; name: string } | null
  surgeon: { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null
  anesthesiologist: { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null
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

// Milestones to skip in the regular list (they're handled as pairs)
const SKIP_IN_LIST = ['anes_start', 'anes_end', 'prepped', 'draping_complete', 'closing', 'closing_complete']

// Helper to safely get first item from array or object
function getFirst<T>(data: T[] | T | null | undefined): T | null {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

// Format date for display
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format time for display
function formatTime(time: string | null): string {
  if (!time) return '--:--'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Status configuration
function getStatusConfig(status: string | null) {
  switch (status) {
    case 'in_progress':
      return {
        label: 'In Progress',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
      }
    case 'completed':
      return {
        label: 'Completed',
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
        dotColor: 'bg-slate-400',
      }
    case 'delayed':
      return {
        label: 'Delayed',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
      }
    case 'scheduled':
    default:
      return {
        label: 'Scheduled',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        dotColor: 'bg-blue-500',
      }
  }
}

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
  const [surgeonAverages, setSurgeonAverages] = useState<{ avgTotalTime: number | null; avgSurgicalTime: number | null }>({
    avgTotalTime: null,
    avgSurgicalTime: null,
  })
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Get logged-in user's facility
  useEffect(() => {
    async function fetchUserFacility() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userData?.facility_id) {
        setUserFacilityId(userData.facility_id)
      }
    }
    fetchUserFacility()
  }, [])

  // Fetch data once we have the user's facility ID
  useEffect(() => {
    if (!userFacilityId) return

    async function fetchData() {
      setLoading(true)

      const { data: caseResult } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          start_time,
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
        .select('id, name, display_name, display_order')
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

      const { data: allStaff } = await supabase
        .from('users')
        .select('id, first_name, last_name, user_roles (name)')
        .eq('facility_id', userFacilityId)

      const { data: anesthesiologistsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, user_roles!inner (name)')
        .eq('facility_id', userFacilityId)
        .eq('user_roles.name', 'anesthesiologist')

      setCaseData(caseResult)
      setMilestoneTypes(milestoneTypesResult || [])
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(allStaff as User[] || [])
      setAnesthesiologists(anesthesiologistsData as User[] || [])

      // Fetch surgeon averages
      const surgeon = getFirst(caseResult?.surgeon)
      if (surgeon) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: surgeonCases } = await supabase
          .from('cases')
          .select(`
            id,
            case_milestones (
              recorded_at,
              milestone_types (name)
            )
          `)
          .eq('surgeon_id', surgeon.id)
          .neq('id', id)
          .eq('facility_id', userFacilityId)
          .gte('scheduled_date', thirtyDaysAgo.toISOString().split('T')[0])

        if (surgeonCases && surgeonCases.length > 0) {
          const totalTimes: number[] = []
          const surgicalTimes: number[] = []

          surgeonCases.forEach((sc) => {
            const milestones: { [key: string]: string } = {}
            sc.case_milestones?.forEach((m) => {
              const milestoneType = Array.isArray(m.milestone_types) ? m.milestone_types[0] : m.milestone_types
              const name = milestoneType?.name
              if (name) milestones[name] = m.recorded_at
            })

            if (milestones.patient_in && milestones.patient_out) {
              const diff = new Date(milestones.patient_out).getTime() - new Date(milestones.patient_in).getTime()
              totalTimes.push(Math.round(diff / (1000 * 60)))
            }

            if (milestones.incision && milestones.closing) {
              const diff = new Date(milestones.closing).getTime() - new Date(milestones.incision).getTime()
              surgicalTimes.push(Math.round(diff / (1000 * 60)))
            }
          })

          setSurgeonAverages({
            avgTotalTime: totalTimes.length > 0 ? Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length) : null,
            avgSurgicalTime: surgicalTimes.length > 0 ? Math.round(surgicalTimes.reduce((a, b) => a + b, 0) / surgicalTimes.length) : null,
          })
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [id, userFacilityId])

  // Milestone functions
  const recordMilestone = async (milestoneTypeId: string) => {
    const timestamp = new Date().toISOString()
    const { data, error } = await supabase
      .from('case_milestones')
      .insert({
        case_id: id,
        milestone_type_id: milestoneTypeId,
        recorded_at: timestamp,
      })
      .select()
      .single()

    if (!error && data) {
      setCaseMilestones([...caseMilestones, data])

      // Get milestone type name for audit log
      const milestoneType = milestoneTypes.find(m => m.id === milestoneTypeId)
      
      // Audit log the milestone recording
      if (milestoneType && caseData) {
        await milestoneAudit.recorded(
          supabase,
          caseData.case_number,
          milestoneType.display_name,
          data.id,
          timestamp
        )
      }

      // Update case status to in_progress on first milestone
      if (caseMilestones.length === 0) {
        const { data: statusData } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'in_progress')
          .single()

        if (statusData && caseData) {
          await supabase.from('cases').update({ status_id: statusData.id }).eq('id', id)
          setCaseData(prev => prev ? { ...prev, case_statuses: [{ id: statusData.id, name: 'in_progress' }] } : null)
          
          // Audit log status change
          await caseAudit.statusChanged(
            supabase,
            { id: caseData.id, case_number: caseData.case_number },
            'scheduled',
            'in_progress'
          )
        }
      }

      // Update case status to completed on patient_out
      if (milestoneType?.name === 'patient_out' && caseData) {
        const { data: statusData } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'completed')
          .single()

        if (statusData) {
          await supabase.from('cases').update({ status_id: statusData.id }).eq('id', id)
          setCaseData(prev => prev ? { ...prev, case_statuses: [{ id: statusData.id, name: 'completed' }] } : null)
          
          // Audit log status change
          await caseAudit.statusChanged(
            supabase,
            { id: caseData.id, case_number: caseData.case_number },
            'in_progress',
            'completed'
          )
        }
      }
    }
  }

  const undoMilestone = async (milestoneId: string) => {
    // Get milestone info for audit log before deleting
    const milestone = caseMilestones.find(m => m.id === milestoneId)
    const milestoneType = milestone ? milestoneTypes.find(mt => mt.id === milestone.milestone_type_id) : null

    await supabase.from('case_milestones').delete().eq('id', milestoneId)
    setCaseMilestones(caseMilestones.filter(m => m.id !== milestoneId))

    // Audit log the milestone deletion
    if (milestoneType && caseData) {
      await milestoneAudit.deleted(
        supabase,
        caseData.case_number,
        milestoneType.display_name,
        milestoneId
      )
    }
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

      // Audit log staff addition
      if (caseData) {
        const roleName = getFirst(user.user_roles)?.name || 'Staff'
        await staffAudit.added(
          supabase,
          caseData.case_number,
          `${user.first_name} ${user.last_name}`,
          roleName,
          data.id
        )
      }
    }
  }

  const removeStaff = async (staffId: string) => {
    // Get staff info for audit log before removing
    const staffMember = caseStaff.find(s => s.id === staffId)
    const staffUser = staffMember ? getFirst(staffMember.users) : null
    const staffRole = staffMember ? getFirst(staffMember.user_roles)?.name : null

    await supabase.from('case_staff').delete().eq('id', staffId)
    setCaseStaff(caseStaff.filter(s => s.id !== staffId))

    // Audit log staff removal
    if (caseData && staffUser) {
      await staffAudit.removed(
        supabase,
        caseData.case_number,
        `${staffUser.first_name} ${staffUser.last_name}`,
        staffRole || 'Staff',
        staffId
      )
    }
  }

  // Helper functions
  const getMilestoneByName = (name: string) => {
    const type = milestoneTypes.find(t => t.name === name)
    return type ? caseMilestones.find(m => m.milestone_type_id === type.id) : undefined
  }

  const getMilestoneTypeByName = (name: string) => {
    return milestoneTypes.find(t => t.name === name)
  }

  // Calculate times
  const calculateDuration = (start: CaseMilestone | undefined, end: CaseMilestone | undefined, live = false): string => {
    if (!start) return '--:--:--'
    const startTime = new Date(start.recorded_at).getTime()
    const endTime = end ? new Date(end.recorded_at).getTime() : (live ? currentTime : startTime)
    const diffMs = endTime - startTime
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const patientIn = getMilestoneByName('patient_in')
  const patientOut = getMilestoneByName('patient_out')
  const incision = getMilestoneByName('incision')
  const closing = getMilestoneByName('closing')

  const totalTime = calculateDuration(patientIn, patientOut, patientIn && !patientOut)
  const surgicalTime = calculateDuration(incision, closing, incision && !closing)

  // Calculate progress
  const singleMilestones = milestoneTypes.filter(t => !SKIP_IN_LIST.includes(t.name))
  const completedMilestones = caseMilestones.length
  const totalMilestoneTypes = milestoneTypes.length
  const progressPercentage = totalMilestoneTypes > 0 ? (completedMilestones / totalMilestoneTypes) * 100 : 0

  // Get display values
  const room = getFirst(caseData?.or_rooms)
  const procedure = getFirst(caseData?.procedure_types)
  const status = getFirst(caseData?.case_statuses)
  const surgeon = getFirst(caseData?.surgeon)
  const anesthesiologist = getFirst(caseData?.anesthesiologist)
  const statusConfig = getStatusConfig(status?.name || null)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!caseData) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-slate-500">Case not found</p>
          <Link href="/cases" className="text-blue-600 hover:underline">
            Back to cases
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/cases')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{caseData.case_number}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}>
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-slate-500 mt-1">{formatDate(caseData.scheduled_date)}</p>
            </div>
          </div>
          <Link
            href={`/cases/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Case
          </Link>
        </div>

        {/* Case Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Room</p>
              <p className="text-lg font-semibold text-slate-900">{room?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Procedure</p>
              <p className="text-lg font-semibold text-slate-900">{procedure?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Surgeon</p>
              <div className="flex items-center gap-2">
                {surgeon && <SurgeonAvatar name={`${surgeon.first_name} ${surgeon.last_name}`} size="sm" />}
                <p className="text-lg font-semibold text-slate-900">
                  {surgeon ? `Dr. ${surgeon.last_name}` : '—'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Start Time</p>
              <p className="text-lg font-semibold text-slate-900">{formatTime(caseData.start_time)}</p>
            </div>
          </div>

          {/* Staff Section */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned Staff</p>
              <StaffPopover
                staff={caseStaff.map(cs => {
                  const user = cs.users ? (Array.isArray(cs.users) ? cs.users[0] : cs.users) : null
                  const role = cs.user_roles ? (Array.isArray(cs.user_roles) ? cs.user_roles[0] : cs.user_roles) : null
                  return {
                    id: cs.id,
                    name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                    role: role?.name || 'Staff',
                  }
                })}
                availableStaff={availableStaff
                  .filter(s => !caseStaff.some(cs => cs.user_id === s.id))
                  .map(s => ({
                    id: s.id,
                    label: `${s.first_name} ${s.last_name}`,
                    subtitle: Array.isArray(s.user_roles) ? s.user_roles[0]?.name || '' : (s.user_roles as { name: string } | null)?.name || '',
                  }))}
                onAdd={addStaff}
                onRemove={removeStaff}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Anesthesiologist */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-sm text-amber-700">
                  {anesthesiologist ? `${anesthesiologist.first_name} ${anesthesiologist.last_name}` : 'No Anesthesiologist'}
                </span>
                <SearchableDropdown
                  options={anesthesiologists.map(a => ({ id: a.id, label: `${a.first_name} ${a.last_name}` }))}
                  value={anesthesiologist?.id || ''}
                  onChange={updateAnesthesiologist}
                  placeholder="Select..."
                />
              </div>

              {/* Other Staff */}
              {caseStaff.map(staff => {
                const staffUser = getFirst(staff.users)
                const staffRole = getFirst(staff.user_roles)
                return (
                  <div key={staff.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg group">
                    <span className="text-sm text-slate-700">
                      {staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : 'Unknown'}
                    </span>
                    {staffRole && (
                      <span className="text-xs text-slate-500 capitalize">{staffRole.name}</span>
                    )}
                    <button
                      onClick={() => removeStaff(staff.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Time Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Time Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-center relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.05),transparent)]" />
            <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase mb-2">Total Time</p>
            <p className="text-5xl lg:text-6xl font-bold text-white tracking-tight relative font-mono tabular-nums">
              {totalTime}
            </p>
            <p className="text-slate-500 text-xs mt-3">Patient In → Patient Out</p>
            {surgeonAverages.avgTotalTime && (
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <p className="text-slate-400 text-xs">
                  Surgeon Avg: <span className="text-slate-300 font-semibold font-mono">
                    {Math.floor(surgeonAverages.avgTotalTime / 60).toString().padStart(2, '0')}:{(surgeonAverages.avgTotalTime % 60).toString().padStart(2, '0')}:00
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Surgical Time Card */}
          <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 rounded-2xl p-6 text-center relative overflow-hidden shadow-xl shadow-blue-600/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent)]" />
            <p className="text-blue-100 text-xs font-semibold tracking-wider uppercase mb-2">Surgical Time</p>
            <p className="text-5xl lg:text-6xl font-bold text-white tracking-tight relative font-mono tabular-nums">
              {surgicalTime}
            </p>
            <p className="text-blue-200 text-xs mt-3">Incision → Closing</p>
            {surgeonAverages.avgSurgicalTime && (
              <div className="mt-4 pt-4 border-t border-blue-400/30">
                <p className="text-blue-200 text-xs">
                  Surgeon Avg: <span className="text-white font-semibold font-mono">
                    {Math.floor(surgeonAverages.avgSurgicalTime / 60).toString().padStart(2, '0')}:{(surgeonAverages.avgSurgicalTime % 60).toString().padStart(2, '0')}:00
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Milestones Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          {/* Milestones Header */}
          <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Case Milestones</h2>
                <p className="text-sm text-slate-500 mt-0.5">Track surgical progress through each phase</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Progress indicator */}
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-600">
                    {completedMilestones}/{totalMilestoneTypes}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Milestones Grid */}
          <div className="p-6">
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

              {/* Prep & Drape (Paired) */}
              {(() => {
                const startType = getMilestoneTypeByName('prepped')
                const endType = getMilestoneTypeByName('draping_complete')
                const startMilestone = getMilestoneByName('prepped')
                const endMilestone = getMilestoneByName('draping_complete')
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

              {/* Incision */}
              {(() => {
                const type = getMilestoneTypeByName('incision')
                const milestone = getMilestoneByName('incision')
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

              {/* Closing (Paired) */}
              {(() => {
                const startType = getMilestoneTypeByName('closing')
                const endType = getMilestoneTypeByName('closing_complete')
                const startMilestone = getMilestoneByName('closing')
                const endMilestone = getMilestoneByName('closing_complete')
                if (!startType || !endType) return null
                return (
                  <PairedMilestoneButton
                    key="closing"
                    displayName="Closing"
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
                .filter(type => !['patient_in', 'incision'].includes(type.name))
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

        {/* Notes Section */}
        {caseData.notes && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{caseData.notes}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
