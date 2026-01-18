'use client'

// ============================================================================
// CASE DETAIL PAGE - REDESIGNED
// ============================================================================
// Compact header, horizontal timers, vertical milestone timeline,
// combined team section, collapsible implants/notes

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import { milestoneAudit, staffAudit, caseAudit } from '../../../lib/audit-logger'
import FloatingActionButton from '../../../components/ui/FloatingActionButton'
import CallNextPatientModal from '../../../components/CallNextPatientModal'
import CompletedCaseView from '../../../components/cases/CompletedCaseView'
import DeviceRepSection from '../../../components/cases/DeviceRepSection'

// ============================================================================
// TYPES
// ============================================================================

interface FacilityMilestone {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  source_milestone_type_id: string | null
}

interface CaseMilestone {
  id: string
  milestone_type_id: string
  facility_milestone_id: string | null
  recorded_at: string
}

interface CaseData {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  call_time: string | null
  operative_side: string | null
  procedure_type_id: string | null
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

interface DeviceCompanyData {
  id: string
  companyName: string
  trayStatus: 'pending' | 'consignment' | 'loaners_confirmed' | 'delivered'
  loanerTrayCount: number | null
  deliveredTrayCount: number | null
  repNotes: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  deliveredAt: string | null
  deliveredByName: string | null
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getFirst<T>(data: T[] | T | null | undefined): T | null {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(time: string | null): string {
  if (!time) return '--:--'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '--:--'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function getStatusConfig(status: string | null) {
  switch (status) {
    case 'in_progress':
      return { label: 'In Progress', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' }
    case 'completed':
      return { label: 'Completed', color: 'bg-slate-400', textColor: 'text-slate-600', bgLight: 'bg-slate-100' }
    case 'delayed':
      return { label: 'Delayed', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50' }
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' }
    default:
      return { label: 'Scheduled', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' }
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function getRoleIcon(role: string): string {
  switch (role?.toLowerCase()) {
    case 'surgeon': return '👨‍⚕️'
    case 'anesthesiologist': return '💉'
    case 'nurse': return '👤'
    case 'tech': return '🔧'
    default: return '👤'
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role?.toLowerCase()) {
    case 'surgeon': return 'bg-blue-100 text-blue-700'
    case 'anesthesiologist': return 'bg-amber-100 text-amber-700'
    case 'nurse': return 'bg-emerald-100 text-emerald-700'
    case 'tech': return 'bg-purple-100 text-purple-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  // Core state
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [milestoneTypes, setMilestoneTypes] = useState<FacilityMilestone[]>([])
  const [caseMilestones, setCaseMilestones] = useState<CaseMilestone[]>([])
  const [caseStaff, setCaseStaff] = useState<CaseStaff[]>([])
  const [availableStaff, setAvailableStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)

  // Averages
  const [surgeonAverages, setSurgeonAverages] = useState<{ avgTotalTime: number | null; avgSurgicalTime: number | null }>({
    avgTotalTime: null,
    avgSurgicalTime: null,
  })
  const [surgeonProcedureAverage, setSurgeonProcedureAverage] = useState<{
    avgTotalMinutes: number | null
    sampleSize: number
  } | null>(null)
  const [milestoneAverages, setMilestoneAverages] = useState<{
    milestoneName: string
    avgMinutesFromStart: number
  }[]>([])

  // Delays
  const [delays, setDelays] = useState<{
    id: string
    typeName: string
    durationMinutes: number | null
    notes: string | null
    recordedAt: string
  }[]>([])

  // Implants
  const [implants, setImplants] = useState<any>(null)
  const [implantCategory, setImplantCategory] = useState<'hip' | 'knee' | null>(null)

  // Device companies (for completed view)
  const [deviceCompanies, setDeviceCompanies] = useState<DeviceCompanyData[]>([])

  // UI state
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [patientCallTime, setPatientCallTime] = useState<string | null>(null)
  const [showImplants, setShowImplants] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showAddStaff, setShowAddStaff] = useState(false)

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch user facility
  useEffect(() => {
    async function fetchUserFacility() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setUserEmail(user.email || null)
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

  // Fetch all data
  useEffect(() => {
    if (!userFacilityId) return

    async function fetchData() {
      setLoading(true)

      // Fetch case
      const { data: caseResult } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, operative_side, procedure_type_id, notes, call_time,
          or_rooms (name),
          procedure_types (name),
          case_statuses (id, name),
          surgeon:users!cases_surgeon_id_fkey (id, first_name, last_name),
          anesthesiologist:users!cases_anesthesiologist_id_fkey (id, first_name, last_name)
        `)
        .eq('id', id)
        .single()

      // Fetch milestones config
      let milestoneTypesResult: FacilityMilestone[] = []
      if (caseResult?.procedure_type_id) {
        const { data: configuredMilestones } = await supabase
          .from('procedure_milestone_config')
          .select(`
            facility_milestone_id, display_order,
            facility_milestones (id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id)
          `)
          .eq('procedure_type_id', caseResult.procedure_type_id)
          .eq('facility_id', userFacilityId)
          .order('display_order')

        if (configuredMilestones && configuredMilestones.length > 0) {
          milestoneTypesResult = configuredMilestones
            .map(cm => cm.facility_milestones as unknown as FacilityMilestone)
            .filter(Boolean)
            .sort((a, b) => a.display_order - b.display_order)
        }
      }

      if (milestoneTypesResult.length === 0) {
        const { data: allMilestones } = await supabase
          .from('facility_milestones')
          .select('id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id')
          .eq('facility_id', userFacilityId)
          .eq('is_active', true)
          .order('display_order')
        milestoneTypesResult = allMilestones || []
      }

      // Fetch recorded milestones
      const { data: milestonesResult } = await supabase
        .from('case_milestones')
        .select('id, milestone_type_id, facility_milestone_id, recorded_at')
        .eq('case_id', id)

      // Fetch case staff
      const { data: staffResult } = await supabase
        .from('case_staff')
        .select(`
          id, user_id, role_id,
          users!case_staff_user_id_fkey (first_name, last_name),
          user_roles!case_staff_role_id_fkey (name)
        `)
        .eq('case_id', id)
        .is('removed_at', null)

      // Fetch available staff
      const { data: allFacilityUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, role_id, user_roles(name)')
        .eq('facility_id', userFacilityId)

      const staffUsers = (allFacilityUsers || []).filter(u => {
        const roleName = Array.isArray(u.user_roles) ? u.user_roles[0]?.name : (u.user_roles as any)?.name
        return roleName === 'nurse' || roleName === 'tech' || roleName === 'anesthesiologist'
      })

      // Fetch implants
      const { data: implantData } = await supabase
        .from('case_implants')
        .select('*')
        .eq('case_id', id)
        .maybeSingle()
      if (implantData) setImplants(implantData)

      // Fetch implant category
      if (caseResult?.procedure_type_id) {
        const { data: procData } = await supabase
          .from('procedure_types')
          .select('implant_category')
          .eq('id', caseResult.procedure_type_id)
          .single()
        if (procData?.implant_category) {
          setImplantCategory(procData.implant_category as 'hip' | 'knee')
        }
      }

      // Fetch device companies
      const { data: deviceCompanyData } = await supabase
        .from('case_device_companies')
        .select(`
          id, tray_status, loaner_tray_count, delivered_tray_count, rep_notes,
          confirmed_at, confirmed_by, delivered_at, delivered_by,
          implant_companies (name),
          confirmed_by_user:users!case_device_companies_confirmed_by_fkey (first_name, last_name),
          delivered_by_user:users!case_device_companies_delivered_by_fkey (first_name, last_name)
        `)
        .eq('case_id', id)

      if (deviceCompanyData) {
        setDeviceCompanies(deviceCompanyData.map((dc: any) => {
          const implantCompany = Array.isArray(dc.implant_companies) ? dc.implant_companies[0] : dc.implant_companies
          const confirmedUser = Array.isArray(dc.confirmed_by_user) ? dc.confirmed_by_user[0] : dc.confirmed_by_user
          const deliveredUser = Array.isArray(dc.delivered_by_user) ? dc.delivered_by_user[0] : dc.delivered_by_user
          return {
            id: dc.id,
            companyName: implantCompany?.name || 'Unknown',
            trayStatus: dc.tray_status,
            loanerTrayCount: dc.loaner_tray_count,
            deliveredTrayCount: dc.delivered_tray_count,
            repNotes: dc.rep_notes,
            confirmedAt: dc.confirmed_at,
            confirmedByName: confirmedUser ? `${confirmedUser.first_name} ${confirmedUser.last_name}` : null,
            deliveredAt: dc.delivered_at,
            deliveredByName: deliveredUser ? `${deliveredUser.first_name} ${deliveredUser.last_name}` : null,
          }
        }))
      }

      // Fetch delays
      const { data: delaysResult } = await supabase
        .from('case_delays')
        .select(`id, duration_minutes, notes, recorded_at, delay_types (name)`)
        .eq('case_id', id)
        .order('recorded_at', { ascending: true })

      if (delaysResult) {
        setDelays(delaysResult.map(d => ({
          id: d.id,
          typeName: (d.delay_types as any)?.name || 'Unknown',
          durationMinutes: d.duration_minutes,
          notes: d.notes,
          recordedAt: d.recorded_at
        })))
      }

      setPatientCallTime(caseResult?.call_time || null)

      // Fetch surgeon averages
      const surgeon = getFirst(caseResult?.surgeon)
      if (caseResult?.procedure_type_id && surgeon) {
        const { data: procAvg } = await supabase
          .from('surgeon_procedure_averages')
          .select('avg_total_minutes, sample_size')
          .eq('surgeon_id', surgeon.id)
          .eq('procedure_type_id', caseResult.procedure_type_id)
          .maybeSingle()

        if (procAvg) {
          setSurgeonProcedureAverage({
            avgTotalMinutes: Number(procAvg.avg_total_minutes),
            sampleSize: procAvg.sample_size
          })
        }

        const { data: milestoneAvgs } = await supabase
          .from('surgeon_milestone_averages')
          .select(`avg_minutes_from_start, milestone_type_id, milestone_types (name)`)
          .eq('surgeon_id', surgeon.id)
          .eq('procedure_type_id', caseResult.procedure_type_id)

        if (milestoneAvgs) {
          setMilestoneAverages(milestoneAvgs.map(ma => ({
            milestoneName: (ma.milestone_types as any)?.name || 'unknown',
            avgMinutesFromStart: Number(ma.avg_minutes_from_start)
          })))
        }
      }

      if (surgeon) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: surgeonCases } = await supabase
          .from('cases')
          .select(`id, case_milestones (recorded_at, milestone_types (name))`)
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

      // Set state
      setCaseData(caseResult)
      setMilestoneTypes(milestoneTypesResult)
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(staffUsers as User[] || [])
      setLoading(false)
    }

    fetchData()
  }, [id, userFacilityId])

  // ============================================================================
  // MILESTONE FUNCTIONS
  // ============================================================================

  const getMilestoneByTypeId = (typeId: string): CaseMilestone | undefined => {
    return caseMilestones.find(m => m.facility_milestone_id === typeId || m.milestone_type_id === typeId)
  }

  const recordMilestone = async (milestoneTypeId: string) => {
    const timestamp = new Date().toISOString()
    const milestoneType = milestoneTypes.find(mt => mt.id === milestoneTypeId)

    const { data, error } = await supabase
      .from('case_milestones')
      .insert({
        case_id: id,
        milestone_type_id: milestoneType?.source_milestone_type_id || milestoneTypeId,
        facility_milestone_id: milestoneTypeId,
        recorded_at: timestamp
      })
      .select()
      .single()

    if (!error && data) {
      setCaseMilestones([...caseMilestones, data])

      if (milestoneType?.name === 'patient_in') {
        await updateCaseStatus('in_progress')
      } else if (milestoneType?.name === 'patient_out') {
        await updateCaseStatus('completed')
      }

      if (milestoneType && caseData) {
        await milestoneAudit.recorded(supabase, caseData.case_number, milestoneType.display_name, data.id, timestamp)
      }
    }
  }

  const undoMilestone = async (milestoneId: string) => {
    const milestone = caseMilestones.find(m => m.id === milestoneId)
    const milestoneType = milestone ? milestoneTypes.find(mt =>
      mt.id === milestone.facility_milestone_id || mt.id === milestone.milestone_type_id
    ) : null

    const { error } = await supabase
      .from('case_milestones')
      .delete()
      .eq('id', milestoneId)

    if (!error) {
      setCaseMilestones(caseMilestones.filter(m => m.id !== milestoneId))

      if (milestoneType?.name === 'patient_in') {
        await updateCaseStatus('scheduled')
      } else if (milestoneType?.name === 'patient_out') {
        await updateCaseStatus('in_progress')
      }

      if (milestoneType && caseData) {
        await milestoneAudit.deleted(supabase, caseData.case_number, milestoneType.display_name, milestoneId)
      }
    }
  }

  const updateCaseStatus = async (statusName: string) => {
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', statusName)
      .single()

    if (statusData) {
      await supabase
        .from('cases')
        .update({ status_id: statusData.id })
        .eq('id', id)

      if (caseData) {
        setCaseData({
          ...caseData,
          case_statuses: { id: statusData.id, name: statusName }
        })
      }
    }
  }

  // ============================================================================
  // STAFF FUNCTIONS
  // ============================================================================

  const addStaff = async (staffId: string) => {
    const staffMember = availableStaff.find(s => s.id === staffId)
    if (!staffMember) return

    const { data, error } = await supabase
      .from('case_staff')
      .insert({
        case_id: id,
        user_id: staffId,
        role_id: staffMember.role_id
      })
      .select(`
        id, user_id, role_id,
        users!case_staff_user_id_fkey (first_name, last_name),
        user_roles!case_staff_role_id_fkey (name)
      `)
      .single()

    if (!error && data) {
      setCaseStaff([...caseStaff, data as CaseStaff])
      if (caseData) {
        const roleName = Array.isArray(staffMember.user_roles) ? staffMember.user_roles[0]?.name : (staffMember.user_roles as any)?.name
        await staffAudit.added(supabase, caseData.case_number, `${staffMember.first_name} ${staffMember.last_name}`, roleName || 'staff', data.id)
      }
    }
  }

  const removeStaff = async (caseStaffId: string) => {
    const staffRecord = caseStaff.find(cs => cs.id === caseStaffId)

    const { error } = await supabase
      .from('case_staff')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', caseStaffId)

    if (!error) {
      setCaseStaff(caseStaff.filter(cs => cs.id !== caseStaffId))
      if (staffRecord && caseData) {
        const user = getFirst(staffRecord.users)
        const role = getFirst(staffRecord.user_roles)
        await staffAudit.removed(supabase, caseData.case_number, user ? `${user.first_name} ${user.last_name}` : 'Unknown', role?.name || 'staff', caseStaffId)
      }
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const room = getFirst(caseData?.or_rooms)
  const procedure = getFirst(caseData?.procedure_types)
  const status = getFirst(caseData?.case_statuses)
  const surgeon = getFirst(caseData?.surgeon)
  const anesthesiologist = getFirst(caseData?.anesthesiologist)
  const statusConfig = getStatusConfig(status?.name || null)
  const isCompleted = status?.name === 'completed'

  // Calculate times
  const patientInMilestone = milestoneTypes.find(mt => mt.name === 'patient_in')
  const patientOutMilestone = milestoneTypes.find(mt => mt.name === 'patient_out')
  const incisionMilestone = milestoneTypes.find(mt => mt.name === 'incision')
  const closingMilestone = milestoneTypes.find(mt => mt.name === 'closing')

  const patientInTime = patientInMilestone ? getMilestoneByTypeId(patientInMilestone.id)?.recorded_at : null
  const patientOutTime = patientOutMilestone ? getMilestoneByTypeId(patientOutMilestone.id)?.recorded_at : null
  const incisionTime = incisionMilestone ? getMilestoneByTypeId(incisionMilestone.id)?.recorded_at : null
  const closingTime = closingMilestone ? getMilestoneByTypeId(closingMilestone.id)?.recorded_at : null

  let totalTime = '0:00:00'
  if (patientInTime) {
    const endTime = patientOutTime ? new Date(patientOutTime).getTime() : currentTime
    totalTime = formatDuration(endTime - new Date(patientInTime).getTime())
  }

  let surgicalTime = '0:00:00'
  if (incisionTime) {
    const endTime = closingTime ? new Date(closingTime).getTime() : currentTime
    surgicalTime = formatDuration(endTime - new Date(incisionTime).getTime())
  }

  const completedMilestones = caseMilestones.length
  const totalMilestoneTypes = milestoneTypes.length
  const progressPercentage = totalMilestoneTypes > 0 ? (completedMilestones / totalMilestoneTypes) * 100 : 0

  // Get assigned staff excluding surgeon
  const assignedStaff = caseStaff.filter(cs => {
    const role = getFirst(cs.user_roles)
    return role?.name !== 'surgeon'
  })

  // Available staff not yet assigned
  const unassignedStaff = availableStaff.filter(s => !caseStaff.some(cs => cs.user_id === s.id))

  // ============================================================================
  // LOADING STATE
  // ============================================================================

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
          <Link href="/cases" className="text-blue-600 hover:underline">Back to cases</Link>
        </div>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // COMPLETED CASE VIEW
  // ============================================================================

  if (isCompleted) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link href="/cases" className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{caseData.case_number}</h1>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bgLight}`}>
                  <div className={`w-2 h-2 rounded-full ${statusConfig.color}`}></div>
                  <span className={`text-xs font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(caseData.scheduled_date)}</p>
            </div>
          </div>

          <CompletedCaseView
            caseData={{
              id: caseData.id,
              caseNumber: caseData.case_number,
              scheduledDate: caseData.scheduled_date,
              startTime: caseData.start_time,
              operativeSide: caseData.operative_side,
              notes: caseData.notes,
              room: room?.name || null,
              procedure: procedure?.name || null,
            }}
            surgeon={surgeon ? { firstName: surgeon.first_name, lastName: surgeon.last_name } : null}
            anesthesiologist={anesthesiologist ? { firstName: anesthesiologist.first_name, lastName: anesthesiologist.last_name } : null}
            milestones={milestoneTypes.map(mt => ({
              id: mt.id,
              name: mt.name,
              displayName: mt.display_name,
              recordedAt: getMilestoneByTypeId(mt.id)?.recorded_at || null,
            }))}
            staff={caseStaff.map(cs => {
              const user = getFirst(cs.users)
              const role = getFirst(cs.user_roles)
              return {
                id: cs.id,
                name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                role: role?.name || 'staff'
              }
            })}
            delays={delays}
            patientCallTime={patientCallTime}
            surgeonAverage={surgeonProcedureAverage}
            milestoneAverages={milestoneAverages}
            implants={implants}
            implantCategory={implantCategory}
            deviceCompanies={deviceCompanies}
          />
        </div>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // ACTIVE CASE VIEW - REDESIGNED
  // ============================================================================

  // Helper for paired milestones
  const getPartnerMilestone = (milestone: FacilityMilestone): FacilityMilestone | undefined => {
    if (!milestone.pair_with_id) return undefined
    return milestoneTypes.find(mt => mt.id === milestone.pair_with_id)
  }

  // Build timeline items
  const timelineItems = milestoneTypes
    .filter(mt => mt.pair_position !== 'end')
    .map(mt => {
      const recorded = getMilestoneByTypeId(mt.id)
      const isPaired = mt.pair_position === 'start'
      const partner = isPaired ? getPartnerMilestone(mt) : null
      const partnerRecorded = partner ? getMilestoneByTypeId(partner.id) : null

      return {
        milestone: mt,
        recorded,
        isPaired,
        partner,
        partnerRecorded,
        displayName: mt.display_name.replace(/ Start$/i, '')
      }
    })

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24">

        {/* ================================================================== */}
        {/* COMPACT HEADER BAR */}
        {/* ================================================================== */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Left: Back + Case Info */}
            <div className="flex items-center gap-4">
              <Link href="/cases" className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{caseData.case_number}</h1>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-700">{procedure?.name || 'No procedure'}</span>
                {caseData.operative_side && caseData.operative_side !== 'n/a' && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                    caseData.operative_side === 'left' ? 'bg-purple-100 text-purple-700' :
                    caseData.operative_side === 'right' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {caseData.operative_side.charAt(0).toUpperCase() + caseData.operative_side.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Room, Time, Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium">{room?.name || '—'}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{formatTime(caseData.start_time)}</span>
              </div>

              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bgLight}`}>
                <div className={`w-2 h-2 rounded-full ${statusConfig.color} ${status?.name === 'in_progress' ? 'animate-pulse' : ''}`}></div>
                <span className={`text-xs font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* TIMER STRIP */}
        {/* ================================================================== */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Total Time */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-emerald-100 text-[10px] font-medium uppercase tracking-wider">Total Time</p>
                <p className="text-xs text-emerald-200">Patient In → Out</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white font-mono tabular-nums">{totalTime}</p>
              {surgeonAverages.avgTotalTime && (
                <p className="text-[10px] text-emerald-200">avg {Math.floor(surgeonAverages.avgTotalTime / 60)}:{(surgeonAverages.avgTotalTime % 60).toString().padStart(2, '0')}:00</p>
              )}
            </div>
          </div>

          {/* Surgical Time */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
              </div>
              <div>
                <p className="text-blue-100 text-[10px] font-medium uppercase tracking-wider">Surgical Time</p>
                <p className="text-xs text-blue-200">Incision → Closing</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white font-mono tabular-nums">{surgicalTime}</p>
              {surgeonAverages.avgSurgicalTime && (
                <p className="text-[10px] text-blue-200">avg {Math.floor(surgeonAverages.avgSurgicalTime / 60)}:{(surgeonAverages.avgSurgicalTime % 60).toString().padStart(2, '0')}:00</p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MAIN CONTENT: TIMELINE + SIDEBAR */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* LEFT: MILESTONE TIMELINE (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Milestones</h2>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500">{completedMilestones}/{totalMilestoneTypes}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4">
              {milestoneTypes.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No milestones configured for this procedure.</p>
                  <p className="text-xs mt-1">Configure milestones in Settings → Procedure Milestones</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {timelineItems.map((item, index) => {
                    const isRecorded = !!item.recorded
                    const isPartnerRecorded = !!item.partnerRecorded
                    const isLast = index === timelineItems.length - 1

                    return (
                      <div key={item.milestone.id} className="relative">
                        {/* Timeline connector line */}
                        {!isLast && (
                          <div className={`absolute left-[15px] top-8 w-0.5 h-full -mb-1 ${isRecorded ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                        )}

                        <div className="flex items-start gap-3 py-2">
                          {/* Timeline dot */}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isRecorded
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}>
                            {isRecorded ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 bg-slate-400 rounded-full" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className={`text-sm font-medium ${isRecorded ? 'text-slate-900' : 'text-slate-500'}`}>
                                  {item.displayName}
                                </p>
                                {item.isPaired && isRecorded && item.partnerRecorded && (
                                  <p className="text-xs text-slate-500">
                                    {formatTimestamp(item.recorded?.recorded_at || null)} → {formatTimestamp(item.partnerRecorded?.recorded_at || null)}
                                    <span className="ml-2 text-emerald-600 font-medium">
                                      {Math.round((new Date(item.partnerRecorded.recorded_at).getTime() - new Date(item.recorded!.recorded_at).getTime()) / 60000)} min
                                    </span>
                                  </p>
                                )}
                                {!item.isPaired && isRecorded && (
                                  <p className="text-xs text-slate-500">{formatTimestamp(item.recorded?.recorded_at || null)}</p>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1">
                                {item.isPaired ? (
                                  // Paired milestone buttons
                                  <>
                                    {!isRecorded ? (
                                      <button
                                        onClick={() => recordMilestone(item.milestone.id)}
                                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                      >
                                        Start
                                      </button>
                                    ) : !isPartnerRecorded ? (
                                      <>
                                        <button
                                          onClick={() => recordMilestone(item.partner!.id)}
                                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                        >
                                          Stop
                                        </button>
                                        <button
                                          onClick={() => undoMilestone(item.recorded!.id)}
                                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                          title="Undo"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                          </svg>
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => undoMilestone(item.partnerRecorded!.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Undo"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  // Single milestone buttons
                                  <>
                                    {!isRecorded ? (
                                      <button
                                        onClick={() => recordMilestone(item.milestone.id)}
                                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                      >
                                        Record
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => undoMilestone(item.recorded!.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Undo"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: SIDEBAR (2 cols) */}
          <div className="lg:col-span-2 space-y-4">

            {/* SURGICAL TEAM CARD */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-900">Surgical Team</h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Surgeon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">
                      👨‍⚕️
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {surgeon ? `Dr. ${surgeon.first_name} ${surgeon.last_name}` : 'No surgeon assigned'}
                      </p>
                      <p className="text-xs text-slate-500">Surgeon</p>
                    </div>
                  </div>
                </div>

                {/* Anesthesiologist */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm">
                      💉
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {anesthesiologist ? `Dr. ${anesthesiologist.first_name} ${anesthesiologist.last_name}` : 'No anesthesiologist'}
                      </p>
                      <p className="text-xs text-slate-500">Anesthesiologist</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                {assignedStaff.length > 0 && <div className="border-t border-slate-100 pt-3 mt-3" />}

                {/* Assigned Staff */}
                {assignedStaff.map(cs => {
                  const user = getFirst(cs.users)
                  const role = getFirst(cs.user_roles)
                  return (
                    <div key={cs.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                          role?.name === 'nurse' ? 'bg-emerald-100' :
                          role?.name === 'tech' ? 'bg-purple-100' : 'bg-slate-100'
                        }`}>
                          {getRoleIcon(role?.name || '')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {user ? `${user.first_name} ${user.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">{role?.name || 'Staff'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeStaff(cs.id)}
                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}

                {/* Add Staff Button */}
                <div className="pt-2">
                  {showAddStaff ? (
                    <div className="space-y-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addStaff(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        defaultValue=""
                      >
                        <option value="" disabled>Select staff to add...</option>
                        {unassignedStaff.map(s => {
                          const roleName = Array.isArray(s.user_roles) ? s.user_roles[0]?.name : (s.user_roles as any)?.name
                          return (
                            <option key={s.id} value={s.id}>
                              {s.first_name} {s.last_name} ({roleName})
                            </option>
                          )
                        })}
                      </select>
                      <button
                        onClick={() => setShowAddStaff(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddStaff(true)}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 border border-dashed border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      + Add Staff
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* DEVICE REP SECTION */}
            <DeviceRepSection caseId={id} supabase={supabase} />

            {/* IMPLANTS - Collapsible */}
            {implants && implantCategory && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowImplants(!showImplants)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-900">Implants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!showImplants && (
                      <span className="text-xs text-slate-500">
                        {implantCategory === 'hip' || implantCategory === 'total_hip'
                          ? `Cup: ${implants.cup_size_final || '—'} | Stem: ${implants.stem_size_final || '—'}`
                          : `Femur: ${implants.femur_size_final || '—'} | Tibia: ${implants.tibia_size_final || '—'}`
                        }
                      </span>
                    )}
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showImplants ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {showImplants && (
                  <div className="p-4 border-t border-slate-100">
                    {implants.fixation_type && (
                      <p className="text-xs text-slate-500 mb-3">
                        Fixation: <span className="font-medium text-slate-700 capitalize">{implants.fixation_type}</span>
                      </p>
                    )}
                    <div className="space-y-2 text-sm">
                      {(implantCategory === 'hip' || implantCategory === 'total_hip') && (
                        <>
                          <ImplantRow label="Cup" brand={implants.cup_brand} size={implants.cup_size_final} templated={implants.cup_size_templated} />
                          <ImplantRow label="Stem" brand={implants.stem_brand} size={implants.stem_size_final} templated={implants.stem_size_templated} />
                          <ImplantRow label="Head" size={implants.head_size_final} templated={implants.head_size_templated} />
                          <ImplantRow label="Liner" size={implants.liner_size_final} templated={implants.liner_size_templated} />
                        </>
                      )}
                      {(implantCategory === 'knee' || implantCategory === 'total_knee') && (
                        <>
                          <ImplantRow label="Femur" brand={implants.femur_brand} size={implants.femur_size_final} templated={implants.femur_size_templated} />
                          <ImplantRow label="Tibia" brand={implants.tibia_brand} size={implants.tibia_size_final} templated={implants.tibia_size_templated} />
                          <ImplantRow label="Poly" brand={implants.poly_brand} size={implants.poly_size_final} templated={implants.poly_size_templated} />
                          <ImplantRow label="Patella" brand={implants.patella_brand} size={implants.patella_size_final} templated={implants.patella_size_templated} />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOTES - Collapsible */}
            {caseData.notes && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-900">Notes</span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${showNotes ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showNotes && (
                  <div className="p-4 border-t border-slate-100">
                    <p className="text-sm text-slate-600">{caseData.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* DELAYS */}
            {delays.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Delays ({delays.length})</h3>
                <div className="space-y-2">
                  {delays.map(delay => (
                    <div key={delay.id} className="text-xs">
                      <span className="font-medium text-amber-700">{delay.typeName}</span>
                      {delay.durationMinutes && <span className="text-amber-600 ml-1">({delay.durationMinutes} min)</span>}
                      {delay.notes && <p className="text-amber-600 mt-0.5">{delay.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      {userFacilityId && (
        <FloatingActionButton
          actions={[
            {
              id: 'call-next-patient',
              label: 'Call Next Patient',
              icon: 'megaphone',
              onClick: () => setShowCallNextPatient(true)
            }
          ]}
        />
      )}

      {/* Call Next Patient Modal */}
      {userFacilityId && userId && userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={userFacilityId}
          userId={userId}
          userEmail={userEmail}
        />
      )}
    </DashboardLayout>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ImplantRow({ label, brand, size, templated }: { label: string; brand?: string | null; size?: string | null; templated?: string | null }) {
  if (!size && !templated && !brand) return null
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-600">{label}</span>
      <div className="text-right">
        {brand && <span className="text-xs text-slate-400 mr-2">{brand}</span>}
        <span className="font-medium text-slate-900">{size || '—'}</span>
        {templated && templated !== size && (
          <span className="text-xs text-slate-400 ml-1">(tmpl: {templated})</span>
        )}
      </div>
    </div>
  )
}