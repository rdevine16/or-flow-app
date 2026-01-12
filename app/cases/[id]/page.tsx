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
        .eq('facility_id', userFacilityId)
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
        .eq('facility_id', userFacilityId)
        .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'anesthesiologist').single()).data?.id)

      setCaseData(caseResult as CaseData)
      setMilestoneTypes(milestoneTypesResult || [])
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(availableResult as User[] || [])
      setAnesthesiologists(anesthResult as User[] || [])

      // Fetch surgeon's historical averages
      const surgeonData = Array.isArray(caseResult?.surgeon) ? caseResult?.surgeon[0] : caseResult?.surgeon
      if (surgeonData?.id) {
        const surgeonId = surgeonData.id
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
          .eq('surgeon_id', surgeonId)
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

  // Helper functions
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

  const singleMilestones = milestoneTypes.filter(m => !SKIP_IN_LIST.includes(m.name))

  // Progress calculation
  const completedMilestones = caseMilestones.length
  const totalMilestoneTypes = milestoneTypes.length
  const progressPercentage = totalMilestoneTypes > 0 ? Math.round((completedMilestones / totalMilestoneTypes) * 100) : 0

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-500 font-medium">Loading case details...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Not found state
  if (!caseData) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Case not found</h2>
          <p className="text-sm text-slate-500 mb-6">The case you're looking for doesn't exist or you don't have access.</p>
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const statusConfig = getStatusConfig(getFirst(caseData.case_statuses)?.name || null)
  const surgeon = getFirst(caseData.surgeon)
  const surgeonName = surgeon ? `${surgeon.first_name} ${surgeon.last_name}` : 'Unassigned'

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
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="mt-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Link href="/cases" className="hover:text-slate-700 transition-colors">Cases</Link>
                <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-700 font-medium">{caseData.case_number}</span>
              </div>
              
              {/* Title Row */}
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{getFirst(caseData.procedure_types)?.name || 'Untitled Procedure'}</h1>
              </div>
              
              {/* Meta Info */}
              <p className="text-sm text-slate-500 mt-1">
                {formatDate(caseData.scheduled_date)} • {formatTime(caseData.start_time)}
              </p>
            </div>
          </div>
          
          {/* Status Badge & Actions */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
              <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`}></div>
              <span className={`text-sm font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
            </div>
            
            <button
              onClick={() => router.push(`/cases/${id}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* OR Room Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Room</p>
                <p className="text-base font-semibold text-slate-900">{getFirst(caseData.or_rooms)?.name || 'Not assigned'}</p>
              </div>
            </div>
          </div>

          {/* Surgeon Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <SurgeonAvatar name={surgeonName} size="md" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Surgeon</p>
                <p className="text-base font-semibold text-slate-900">{surgeon ? `Dr. ${surgeon.last_name}` : 'Unassigned'}</p>
              </div>
            </div>
          </div>

          {/* Anesthesiologist Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Anesthesiologist</p>
            <SearchableDropdown
              placeholder="Select Anesthesiologist"
              value={getFirst(caseData.anesthesiologist)?.id}
              onChange={updateAnesthesiologist}
              options={anesthesiologists.map(a => ({
                id: a.id,
                label: `Dr. ${a.first_name} ${a.last_name}`,
                subtitle: 'Anesthesiologist',
              }))}
            />
          </div>

          {/* Staff Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Assigned Staff</p>
            <StaffPopover
              staff={staffForPopover}
              availableStaff={availableStaffOptions}
              onAdd={addStaff}
              onRemove={removeStaff}
            />
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
