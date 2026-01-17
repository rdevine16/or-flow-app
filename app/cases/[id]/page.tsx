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
import ImplantSection from '../../../components/cases/ImplantSection'
import FloatingActionButton from '../../../components/ui/FloatingActionButton'
import CallNextPatientModal from '../../../components/CallNextPatientModal'
import AnesthesiaPopover from '../../../components/ui/AnesthesiaPopover'
import CompletedCaseView from '../../../components/cases/CompletedCaseView'



// Now includes pairing fields from facility_milestones
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

// Operative Side Badge
function OperativeSideBadge({ side }: { side: string | null | undefined }) {
  if (!side || side === 'n/a') return null
  
  const config: Record<string, { label: string; color: string }> = {
    left: { label: 'Left', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    right: { label: 'Right', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    bilateral: { label: 'Bilateral', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  }
  
  const cfg = config[side]
  if (!cfg) return null
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [milestoneTypes, setMilestoneTypes] = useState<FacilityMilestone[]>([])
  const [caseMilestones, setCaseMilestones] = useState<CaseMilestone[]>([])
  const [caseStaff, setCaseStaff] = useState<CaseStaff[]>([])
  const [availableStaff, setAvailableStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [surgeonAverages, setSurgeonAverages] = useState<{ avgTotalTime: number | null; avgSurgicalTime: number | null }>({
    avgTotalTime: null,
    avgSurgicalTime: null,
  })
  const [delays, setDelays] = useState<{
  id: string
  typeName: string
  durationMinutes: number | null
  notes: string | null
  recordedAt: string
}[]>([])

const [patientCallTime, setPatientCallTime] = useState<string | null>(null)

const [surgeonProcedureAverage, setSurgeonProcedureAverage] = useState<{
  avgTotalMinutes: number | null
  sampleSize: number
} | null>(null)

const [milestoneAverages, setMilestoneAverages] = useState<{
  milestoneName: string
  avgMinutesFromStart: number
}[]>([])

  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // FAB / Call Next Patient state
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)
  const [implants, setImplants] = useState<{
  fixation_type: string | null
  cup_brand: string | null
  cup_size_templated: string | null
  cup_size_final: string | null
  stem_brand: string | null
  stem_size_templated: string | null
  stem_size_final: string | null
  head_size_templated: string | null
  head_size_final: string | null
  liner_size_templated: string | null
  liner_size_final: string | null
  femur_brand: string | null
  femur_type: string | null
  femur_size_templated: string | null
  femur_size_final: string | null
  tibia_brand: string | null
  tibia_size_templated: string | null
  tibia_size_final: string | null
  poly_brand: string | null
  poly_size_templated: string | null
  poly_size_final: string | null
  patella_brand: string | null
  patella_type: string | null
  patella_size_templated: string | null
  patella_size_final: string | null
} | null>(null)

const [implantCategory, setImplantCategory] = useState<'hip' | 'knee' | null>(null)
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

  // Fetch data once we have the user's facility ID
  useEffect(() => {
    if (!userFacilityId) return

    async function fetchData() {
      setLoading(true)

      // Fetch case data first (we need procedure_type_id)
const { data: caseResult } = await supabase
  .from('cases')
  .select(`
    id,
    case_number,
    scheduled_date,
    start_time,
    operative_side,
    procedure_type_id,
    notes,
    call_time,
    or_rooms (name),
    procedure_types (name),
    case_statuses (id, name),
    surgeon:users!cases_surgeon_id_fkey (id, first_name, last_name),
    anesthesiologist:users!cases_anesthesiologist_id_fkey (id, first_name, last_name)
  `)
  .eq('id', id)
  .single()

      // PHASE 2: Fetch procedure-specific milestones
      let milestoneTypesResult: FacilityMilestone[] = []
      
      if (caseResult?.procedure_type_id) {
        // Try to get milestones configured for this procedure
        const { data: configuredMilestones } = await supabase
          .from('procedure_milestone_config')
          .select(`
            facility_milestone_id,
            display_order,
            facility_milestones (
              id,
              name,
              display_name,
              display_order,
              pair_with_id,
              pair_position,
              source_milestone_type_id
            )
          `)
          .eq('procedure_type_id', caseResult.procedure_type_id)
          .eq('facility_id', userFacilityId)
          .order('display_order')

        if (configuredMilestones && configuredMilestones.length > 0) {
          // Use procedure-specific milestones
          milestoneTypesResult = configuredMilestones
            .map(cm => cm.facility_milestones as unknown as FacilityMilestone)
            .filter(Boolean)
            .sort((a, b) => a.display_order - b.display_order)
        }
      }

      // Fallback: If no procedure-specific config, get all facility milestones
      if (milestoneTypesResult.length === 0) {
        const { data: allMilestones } = await supabase
          .from('facility_milestones')
          .select('id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id')
          .eq('facility_id', userFacilityId)
          .eq('is_active', true)
          .order('display_order')

        milestoneTypesResult = allMilestones || []
      }

      // Fetch recorded milestones for this case
      const { data: milestonesResult } = await supabase
        .from('case_milestones')
        .select('id, milestone_type_id, facility_milestone_id, recorded_at')
        .eq('case_id', id)

// Fetch case staff (only active - exclude soft-deleted)
const { data: staffResult, error: staffError } = await supabase
  .from('case_staff')
  .select(`
    id,
    user_id,
    role_id,
    users!case_staff_user_id_fkey (
      first_name, 
      last_name
    ),
    user_roles!case_staff_role_id_fkey (
      name
    )
  `)
  .eq('case_id', id)
  .is('removed_at', null)

// Debug - remove after testing
console.log('Staff Debug:', { staffResult, staffError, caseId: id })

// ADD THIS DEBUG LOG
console.log('Staff Query Debug:', { 
  caseId: id, 
  staffResult, 
  staffError,
  count: staffResult?.length 
}) // Only get active staff, not soft-deleted

      // Fetch ALL users at this facility
      const { data: allFacilityUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, role_id, user_roles(name)')
        .eq('facility_id', userFacilityId)

      // Filter to nurses, techs, and anesthesiologists (unified staff management)
      const staffUsers = (allFacilityUsers || []).filter(u => {
        const roleName = Array.isArray(u.user_roles) 
          ? u.user_roles[0]?.name 
          : (u.user_roles as any)?.name
        return roleName === 'nurse' || roleName === 'tech' || roleName === 'anesthesiologist'
      })
// ========================================
// Fetch implant data for this case
// ========================================
const { data: implantData } = await supabase
  .from('case_implants')
  .select('*')
  .eq('case_id', id)
  .maybeSingle()

if (implantData) {
  setImplants(implantData)
}

// Fetch implant category from procedure type
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
      // ========================================
      // NEW: Fetch delays for this case
      // ========================================
      const { data: delaysResult } = await supabase
        .from('case_delays')
        .select(`
          id,
          duration_minutes,
          notes,
          recorded_at,
          delay_types (name)
        `)
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

      // ========================================
      // NEW: Fetch patient call notification
      // ========================================
      const { data: callNotification } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('case_id', id)
        .eq('type', 'patient_call')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

setPatientCallTime(caseResult?.call_time || null)

      // Get surgeon reference for averages queries
      const surgeon = getFirst(caseResult?.surgeon)

      // ========================================
      // NEW: Fetch surgeon procedure average
      // ========================================
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

        // Fetch milestone averages for this surgeon + procedure
        const { data: milestoneAvgs } = await supabase
          .from('surgeon_milestone_averages')
          .select(`
            avg_minutes_from_start,
            milestone_type_id,
            milestone_types (name)
          `)
          .eq('surgeon_id', surgeon.id)
          .eq('procedure_type_id', caseResult.procedure_type_id)

        if (milestoneAvgs) {
          setMilestoneAverages(milestoneAvgs.map(ma => ({
            milestoneName: (ma.milestone_types as any)?.name || 'unknown',
            avgMinutesFromStart: Number(ma.avg_minutes_from_start)
          })))
        }
      }

      // ========================================
      // EXISTING: Fetch surgeon averages (for timer cards)
      // ========================================
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

      // ========================================
      // SET ALL STATE
      // ========================================
      setCaseData(caseResult)
      setMilestoneTypes(milestoneTypesResult)
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(staffUsers as User[] || [])

      setLoading(false)
    }

    fetchData()
  }, [id, userFacilityId])

  // Milestone functions

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
        await milestoneAudit.recorded(
          supabase,
          caseData.case_number,
          milestoneType.display_name,
          data.id,
          timestamp
        )
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

      if (milestoneType && caseData && milestone) {
        await milestoneAudit.deleted(
          supabase,
          caseData.case_number,
          milestoneType.display_name,
          milestoneId,
          milestone.recorded_at
        )
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
      const oldStatus = getFirst(caseData?.case_statuses)
      
      await supabase
        .from('cases')
        .update({ status_id: statusData.id })
        .eq('id', id)

      if (caseData) {
        setCaseData({
          ...caseData,
          case_statuses: { id: statusData.id, name: statusName }
        })

        if (oldStatus?.name !== statusName) {
          await caseAudit.statusChanged(
            supabase,
            { id: caseData.id, case_number: caseData.case_number },
            oldStatus?.name || 'unknown',
            statusName
          )
        }
      }
    }
  }

  // Staff functions
  const addStaff = async (staffUserId: string) => {
    const staffMember = availableStaff.find(s => s.id === staffUserId)
    const roleName = Array.isArray(staffMember?.user_roles) 
      ? staffMember.user_roles[0]?.name 
      : (staffMember?.user_roles as any)?.name

    let roleId = null
    if (roleName) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', roleName)
        .single()
      roleId = roleData?.id
    }

    const { data, error } = await supabase
      .from('case_staff')
      .insert({ case_id: id, user_id: staffUserId, role_id: roleId })
      .select(`
        id,
        user_id,
        users (first_name, last_name),
        user_roles (name)
      `)
      .single()

    if (!error && data) {
      setCaseStaff([...caseStaff, data as CaseStaff])

      const staffUser = getFirst((data as CaseStaff).users)
      const staffRole = getFirst((data as CaseStaff).user_roles)
      if (caseData && staffUser) {
        await staffAudit.added(
          supabase,
          caseData.case_number,
          `${staffUser.first_name} ${staffUser.last_name}`,
          staffRole?.name || 'staff',
          data.id
        )
      }
    }
  }

  const removeStaff = async (staffId: string) => {
    const staffToRemove = caseStaff.find(s => s.id === staffId)
    const staffUser = staffToRemove ? getFirst(staffToRemove.users) : null
    const staffRole = staffToRemove ? getFirst(staffToRemove.user_roles) : null

    const { error } = await supabase
      .from('case_staff')
      .delete()
      .eq('id', staffId)

    if (!error) {
      setCaseStaff(caseStaff.filter(s => s.id !== staffId))

      if (caseData && staffUser) {
        await staffAudit.removed(
          supabase,
          caseData.case_number,
          `${staffUser.first_name} ${staffUser.last_name}`,
          staffRole?.name || 'staff',
          staffId
        )
      }
    }
  }

  const updateAnesthesiologist = async (anesthId: string) => {
    const oldAnesthesiologist = getFirst(caseData?.anesthesiologist)
    
    const { error } = await supabase
      .from('cases')
      .update({ anesthesiologist_id: anesthId || null })
      .eq('id', id)

    if (!error) {
      const newAnesth = anesthesiologists.find(a => a.id === anesthId)
      if (caseData) {
        setCaseData({
          ...caseData,
          anesthesiologist: newAnesth ? { id: newAnesth.id, first_name: newAnesth.first_name, last_name: newAnesth.last_name } : null
        })

        if (newAnesth) {
          const newName = `${newAnesth.first_name} ${newAnesth.last_name}`
          if (oldAnesthesiologist) {
            const oldName = `${oldAnesthesiologist.first_name} ${oldAnesthesiologist.last_name}`
            await staffAudit.removed(
              supabase,
              caseData.case_number,
              oldName,
              'anesthesiologist',
              oldAnesthesiologist.id
            )
          }
          await staffAudit.added(
            supabase,
            caseData.case_number,
            newName,
            'anesthesiologist',
            newAnesth.id
          )
        }
      }
    }
  }

  const removeAnesthesiologist = async () => {
    const oldAnesthesiologist = getFirst(caseData?.anesthesiologist)
    
    const { error } = await supabase
      .from('cases')
      .update({ anesthesiologist_id: null })
      .eq('id', id)

    if (!error && caseData) {
      setCaseData({
        ...caseData,
        anesthesiologist: null
      })

      if (oldAnesthesiologist) {
        await staffAudit.removed(
          supabase,
          caseData.case_number,
          `${oldAnesthesiologist.first_name} ${oldAnesthesiologist.last_name}`,
          'anesthesiologist',
          oldAnesthesiologist.id
        )
      }
    }
  }

  // Helper functions for milestones
  const getMilestoneByTypeId = (typeId: string) => caseMilestones.find(m => 
    m.facility_milestone_id === typeId || m.milestone_type_id === typeId
  )
  const getMilestoneByName = (name: string) => {
    const type = milestoneTypes.find(t => t.name === name)
    return type ? getMilestoneByTypeId(type.id) : undefined
  }
  const getMilestoneTypeByName = (name: string) => milestoneTypes.find(t => t.name === name)

  // Calculate times
  const patientInMilestone = getMilestoneByName('patient_in')
  const patientOutMilestone = getMilestoneByName('patient_out')
  const incisionMilestone = getMilestoneByName('incision')
  const closingMilestone = getMilestoneByName('closing')

  const calculateElapsedTime = (startMilestone: CaseMilestone | undefined, endMilestone: CaseMilestone | undefined) => {
    if (!startMilestone) return '-- : -- : --'
    const startTime = new Date(startMilestone.recorded_at).getTime()
    const endTime = endMilestone ? new Date(endMilestone.recorded_at).getTime() : currentTime
    const elapsed = endTime - startTime
    const hours = Math.floor(elapsed / (1000 * 60 * 60))
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const totalTime = calculateElapsedTime(patientInMilestone, patientOutMilestone)
  const surgicalTime = calculateElapsedTime(incisionMilestone, closingMilestone)

  // Dynamic milestone grouping based on database pairing
  const pairedMilestones = milestoneTypes.filter(mt => mt.pair_position === 'start')
  const singleMilestones = milestoneTypes.filter(mt => !mt.pair_position)

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

  // ============================================================================
  // CHECK IF CASE IS COMPLETED - THIS IS THE KEY LOGIC
  // ============================================================================
  const isCompleted = status?.name === 'completed'

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

  // ============================================================================
  // RENDER READ-ONLY SUMMARY VIEW FOR COMPLETED CASES
  // ============================================================================

  // ============================================================================
  // RENDER EDITABLE VIEW FOR NON-COMPLETED CASES (existing code)
  // ============================================================================
  
  // Helper to get the partner milestone for a paired milestone
  const getPartnerMilestone = (milestone: FacilityMilestone): FacilityMilestone | undefined => {
    if (!milestone.pair_with_id) return undefined
    return milestoneTypes.find(mt => mt.id === milestone.pair_with_id)
  }

  // Helper to generate display name for paired milestone button
  const getPairDisplayName = (startMilestone: FacilityMilestone): string => {
    const name = startMilestone.display_name
    if (name.toLowerCase().endsWith(' start')) {
      return name.slice(0, -6)
    }
    return name
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/cases" 
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{caseData.case_number}</h1>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                  <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`}></div>
                  <span className={`text-xs font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(caseData.scheduled_date)}</p>
            </div>
          </div>
        </div>
{isCompleted ? (
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
  />
) : (
          /* Main Content Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Case Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Case Details Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="space-y-4">
                {/* Procedure */}
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Procedure</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{procedure?.name || 'Not specified'}</p>
                    <OperativeSideBadge side={caseData.operative_side} />
                  </div>
                </div>

                {/* Room & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Room</p>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-sm font-medium text-slate-700">{room?.name || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Scheduled</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono">{formatTime(caseData.start_time)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Surgeon Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Surgeon</p>
              <div className="flex items-center gap-3">
                <SurgeonAvatar name={surgeon ? `${surgeon.first_name} ${surgeon.last_name}` : 'Unassigned'} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {surgeon ? `Dr. ${surgeon.last_name}` : 'Unassigned'}
                  </p>
                  {surgeon && (
                    <p className="text-xs text-slate-500">{surgeon.first_name} {surgeon.last_name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Team Section - All staff including anesthesiologists */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <StaffPopover
                staff={caseStaff.map(cs => {
                  const user = getFirst(cs.users)
                  const role = getFirst(cs.user_roles)
                  return {
                    id: cs.id,
                    name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                    role: role?.name || 'staff'
                  }
                })}
                availableStaff={availableStaff.map(s => {
                  const roleName = Array.isArray(s.user_roles) 
                    ? s.user_roles[0]?.name 
                    : (s.user_roles as any)?.name
                  return {
                    id: s.id,
                    label: `${s.first_name} ${s.last_name}`,
                    subtitle: roleName || 'Staff'
                  }
                })}
                onAdd={addStaff}
                onRemove={removeStaff}
              />
            </div>

            {/* Implant Section */}
            <ImplantSection 
              caseId={id} 
              procedureTypeId={caseData.procedure_type_id}
              supabase={supabase}
            />

            {/* Notes Section */}
            {caseData.notes && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
                <p className="text-sm text-slate-600">{caseData.notes}</p>
              </div>
            )}
          </div>

          {/* Right Column - Timers & Milestones */}
          <div className="lg:col-span-2 space-y-4">
            {/* Timer Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Total Time Card */}
              <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-4 text-center relative overflow-hidden shadow-lg shadow-emerald-600/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent)]" />
                <p className="text-emerald-100 text-[10px] font-semibold tracking-wider uppercase mb-1">Total Time</p>
                <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight relative font-mono tabular-nums">
                  {totalTime}
                </p>
                <p className="text-emerald-200 text-[10px] mt-1">Patient In → Patient Out</p>
                {surgeonAverages.avgTotalTime && (
                  <div className="mt-2 pt-2 border-t border-emerald-400/30">
                    <p className="text-emerald-200 text-[10px]">
                      Avg: <span className="text-white font-semibold font-mono">
                        {Math.floor(surgeonAverages.avgTotalTime / 60).toString().padStart(2, '0')}:{(surgeonAverages.avgTotalTime % 60).toString().padStart(2, '0')}:00
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Surgical Time Card */}
              <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 rounded-xl p-4 text-center relative overflow-hidden shadow-lg shadow-blue-600/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent)]" />
                <p className="text-blue-100 text-[10px] font-semibold tracking-wider uppercase mb-1">Surgical Time</p>
                <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight relative font-mono tabular-nums">
                  {surgicalTime}
                </p>
                <p className="text-blue-200 text-[10px] mt-1">Incision → Closing</p>
                {surgeonAverages.avgSurgicalTime && (
                  <div className="mt-2 pt-2 border-t border-blue-400/30">
                    <p className="text-blue-200 text-[10px]">
                      Avg: <span className="text-white font-semibold font-mono">
                        {Math.floor(surgeonAverages.avgSurgicalTime / 60).toString().padStart(2, '0')}:{(surgeonAverages.avgSurgicalTime % 60).toString().padStart(2, '0')}:00
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Milestones Section - Compact */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Milestones Header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Milestones</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {completedMilestones}/{totalMilestoneTypes}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Milestones Grid - Dynamic rendering */}
              <div className="p-4">
                {milestoneTypes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No milestones configured for this procedure.</p>
                    <p className="text-xs mt-1">Configure milestones in Settings → Procedure Milestones</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {milestoneTypes
                      .filter(mt => mt.pair_position !== 'end')
                      .map(milestone => {
                        if (milestone.pair_position === 'start') {
                          const endMilestone = getPartnerMilestone(milestone)
                          if (!endMilestone) return null

                          const startRecorded = getMilestoneByTypeId(milestone.id)
                          const endRecorded = getMilestoneByTypeId(endMilestone.id)

                          return (
                            <PairedMilestoneButton
                              key={milestone.id}
                              displayName={getPairDisplayName(milestone)}
                              startRecordedAt={startRecorded?.recorded_at}
                              endRecordedAt={endRecorded?.recorded_at}
                              onRecordStart={() => recordMilestone(milestone.id)}
                              onRecordEnd={() => recordMilestone(endMilestone.id)}
                              onUndoStart={() => startRecorded && undoMilestone(startRecorded.id)}
                              onUndoEnd={() => endRecorded && undoMilestone(endRecorded.id)}
                            />
                          )
                        }

                        const recorded = getMilestoneByTypeId(milestone.id)
                        return (
                          <MilestoneButton
                            key={milestone.id}
                            name={milestone.name}
                            displayName={milestone.display_name}
                            recordedAt={recorded?.recorded_at}
                            onRecord={() => recordMilestone(milestone.id)}
                            onUndo={() => recorded && undoMilestone(recorded.id)}
                          />
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
              )}  
      </div>

      {/* Floating Action Button - Only show for non-completed cases */}
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
