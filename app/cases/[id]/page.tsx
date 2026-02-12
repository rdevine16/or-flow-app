'use client'

// ============================================================================
// CASE DETAIL PAGE - COMMAND CENTER DESIGN
// ============================================================================
// Dense, data-rich dashboard layout
// Professional milestone section that sells the product

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { milestoneAudit, staffAudit } from '@/lib/audit-logger'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import CallNextPatientModal from '@/components/CallNextPatientModal'
import CompletedCaseView from '@/components/cases/CompletedCaseView'
import DeviceRepSection from '@/components/cases/DeviceRepSection'
import MilestoneCard, { type MilestoneCardData } from '@/components/cases/MilestoneCard'
import TeamMember from '@/components/cases/TeamMember'
import ImplantBadge from '@/components/cases/ImplantBadge'
import { runDetectionForCase } from '@/lib/dataQuality'
import PiPMilestoneWrapper, { PiPButton } from '@/components/pip/PiPMilestoneWrapper'
import CaseFlagsSection from '@/components/cases/CaseFlagsSection'
import IncompleteCaseModal from '@/components/cases/IncompleteCaseModal'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Check, ChevronLeft, ClipboardList, LogOut } from 'lucide-react'
import { PageLoader } from '@/components/ui/Loading'
import { StatusBadgeDot } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import {
  getJoinedValue,
  formatDisplayTime,
  formatTimestamp,
  formatTimestamp24,
  formatElapsedMs,
  formatMinutesHMS,
  getStatusConfig,
} from '@/lib/formatters'
import { useMilestoneRealtime } from '@/lib/hooks/useMilestoneRealtime'

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
  facility_milestone_id: string
  recorded_at: string | null
}

interface CaseData {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  call_time: string | null
  operative_side: string | null
  procedure_type_id: string | null
  surgeon_id: string | null
  or_room_id: string | null
  is_draft: boolean
  notes: string | null
  surgeon_left_at: string | null
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
  role_id: string
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
// MAIN COMPONENT
// ============================================================================

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  // User context — replaces manual fetchUserFacility
  const {
    userData,
    loading: userLoading,
    effectiveFacilityId,
  } = useUser()

  // Core state
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [milestoneTypes, setMilestoneTypes] = useState<FacilityMilestone[]>([])
  const [caseMilestones, setCaseMilestones] = useState<CaseMilestone[]>([])
  const [caseStaff, setCaseStaff] = useState<CaseStaff[]>([])
  const [availableStaff, setAvailableStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

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

  // Implants
  const [implants, setImplants] = useState<any>(null)
  const [implantCategory, setImplantCategory] = useState<'hip' | 'knee' | 'total_hip' | 'total_knee' | null>(null)

  // Device companies
  const [deviceCompanies, setDeviceCompanies] = useState<DeviceCompanyData[]>([])

  // UI state
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)
  const [patientCallTime, setPatientCallTime] = useState<string | null>(null)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [surgeonLeftAt, setSurgeonLeftAt] = useState<string | null>(null)
  const [isPiPOpen, setIsPiPOpen] = useState(false)

  // Milestone recording in-flight state (debounce protection)
  const [recordingMilestoneIds, setRecordingMilestoneIds] = useState<Set<string>>(new Set())

  // Undo confirmation dialog
  const { confirmDialog, showConfirm } = useConfirmDialog()

  // Incomplete case modal — dropdown options
  const [allSurgeons, setAllSurgeons] = useState<{ id: string; label: string }[]>([])
  const [allProcedures, setAllProcedures] = useState<{ id: string; label: string }[]>([])
  const [allRooms, setAllRooms] = useState<{ id: string; label: string }[]>([])
  const [showIncompleteModal, setShowIncompleteModal] = useState(false)

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ============================================================================
  // FETCH ALL DATA
  // ============================================================================

  const fetchData = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch case
      const { data: caseResult, error: caseError } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, operative_side, procedure_type_id, surgeon_id, or_room_id, is_draft, notes, call_time, surgeon_left_at,
          or_rooms (name),
          procedure_types (name),
          case_statuses (id, name),
          surgeon:users!cases_surgeon_id_fkey (id, first_name, last_name),
          anesthesiologist:users!cases_anesthesiologist_id_fkey (id, first_name, last_name)
        `)
        .eq('id', id)
        .single()

      if (caseError) throw caseError

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
          .eq('facility_id', effectiveFacilityId)
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
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true)
          .order('display_order')
        milestoneTypesResult = allMilestones || []
      }

      // Fetch recorded milestones
      const { data: milestonesResult } = await supabase
        .from('case_milestones')
        .select('id, facility_milestone_id, recorded_at')
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
        .eq('facility_id', effectiveFacilityId)

      const staffUsers = (allFacilityUsers || []).filter(u => {
        const roleName = Array.isArray(u.user_roles) ? u.user_roles[0]?.name : (u.user_roles as any)?.name
        return roleName === 'nurse' || roleName === 'tech' || roleName === 'anesthesiologist'
      })

      // Fetch dropdown options for incomplete case modal
      const surgeonUsers = (allFacilityUsers || []).filter(u => {
        const roleName = Array.isArray(u.user_roles) ? u.user_roles[0]?.name : (u.user_roles as any)?.name
        return roleName === 'surgeon'
      })
      setAllSurgeons(surgeonUsers.map(s => ({ id: s.id, label: `Dr. ${s.first_name} ${s.last_name}` })))

      const [roomsRes, proceduresRes] = await Promise.all([
        supabase.from('or_rooms').select('id, name').eq('facility_id', effectiveFacilityId).order('name'),
        supabase.from('procedure_types').select('id, name')
          .or(`facility_id.is.null,facility_id.eq.${effectiveFacilityId}`)
          .order('name'),
      ])
      setAllRooms((roomsRes.data || []).map(r => ({ id: r.id, label: r.name })))
      setAllProcedures((proceduresRes.data || []).map(p => ({ id: p.id, label: p.name })))

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
          setImplantCategory(procData.implant_category as 'hip' | 'knee' | 'total_hip' | 'total_knee')
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

      setPatientCallTime(caseResult?.call_time || null)

      // Fetch surgeon averages
      const surgeon = getJoinedValue(caseResult?.surgeon)
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
          .select('avg_minutes_from_start, milestone_type_id, milestone_types (name)')
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
          .select('id, case_milestones (recorded_at, facility_milestone_id, facility_milestones (name))')
          .eq('surgeon_id', surgeon.id)
          .neq('id', id)
          .eq('facility_id', effectiveFacilityId)
          .gte('scheduled_date', thirtyDaysAgo.toISOString().split('T')[0])

        if (surgeonCases && surgeonCases.length > 0) {
          const totalTimes: number[] = []
          const surgicalTimes: number[] = []

          surgeonCases.forEach((sc) => {
            const milestones: { [key: string]: string } = {}
            sc.case_milestones?.forEach((m) => {
              const facilityMilestone = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
              const name = facilityMilestone?.name
              if (name && m.recorded_at) milestones[name] = m.recorded_at
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
      setSurgeonLeftAt(caseResult?.surgeon_left_at || null)

      // Check for incomplete case (missing required fields) — show modal
      if (caseResult && !caseResult.is_draft) {
        const hasMissing = !caseResult.surgeon_id || !caseResult.procedure_type_id || !caseResult.or_room_id
        setShowIncompleteModal(hasMissing)
      }
      setMilestoneTypes(milestoneTypesResult)
      setCaseMilestones(milestonesResult || [])
      setCaseStaff(staffResult as CaseStaff[] || [])
      setAvailableStaff(staffUsers as User[] || [])
    } catch (err) {
      setError('Failed to load case data. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load case',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setLoading(false)
    }
  }, [id, effectiveFacilityId, supabase, showToast])

  useEffect(() => {
    if (effectiveFacilityId) fetchData()
    else if (!userLoading) setLoading(false)
  }, [effectiveFacilityId, fetchData, userLoading])

  // Realtime subscription — syncs milestone changes from other devices
  useMilestoneRealtime({
    supabase,
    caseId: id,
    enabled: !loading && !!caseData,
    setCaseMilestones,
  })

  // ============================================================================
  // MILESTONE FUNCTIONS
  // ============================================================================

  const getMilestoneByTypeId = (typeId: string): CaseMilestone | undefined => {
    return caseMilestones.find(m => m.facility_milestone_id === typeId)
  }

  const recordMilestone = async (milestoneTypeId: string) => {
    // Debounce: prevent double-tap by checking if this milestone is already in-flight
    if (recordingMilestoneIds.has(milestoneTypeId)) return
    setRecordingMilestoneIds(prev => new Set(prev).add(milestoneTypeId))

    try {
      const timestamp = new Date().toISOString()
      const milestoneType = milestoneTypes.find(mt => mt.id === milestoneTypeId)

      // Optimistic UI: update local state immediately
      const currentMilestones = await new Promise<CaseMilestone[]>(resolve => {
        setCaseMilestones(prev => { resolve(prev); return prev })
      })

      const existingMilestone = currentMilestones.find(cm => cm.facility_milestone_id === milestoneTypeId)

      // Apply optimistic update
      if (existingMilestone) {
        setCaseMilestones(prev =>
          prev.map(cm => cm.id === existingMilestone.id ? { ...cm, recorded_at: timestamp } : cm)
        )
      } else {
        const optimisticId = `optimistic-${milestoneTypeId}`
        setCaseMilestones(prev => [...prev, {
          id: optimisticId,
          facility_milestone_id: milestoneTypeId,
          recorded_at: timestamp,
        }])
      }

      // DB write
      let savedMilestone: CaseMilestone | null = null

      if (existingMilestone) {
        const { data, error } = await supabase
          .from('case_milestones')
          .update({ recorded_at: timestamp })
          .eq('id', existingMilestone.id)
          .select()
          .single()

        if (error) throw error
        savedMilestone = data
      } else {
        const { data, error } = await supabase
          .from('case_milestones')
          .insert({ case_id: id, facility_milestone_id: milestoneTypeId, recorded_at: timestamp })
          .select()
          .single()

        if (error) throw error
        savedMilestone = data

        // Replace optimistic entry with real DB row
        if (data) {
          setCaseMilestones(prev =>
            prev.map(cm => cm.id === `optimistic-${milestoneTypeId}` ? data : cm)
          )
        }
      }

      if (savedMilestone) {
        // Auto-update case status
        if (milestoneType?.name === 'patient_in') {
          await updateCaseStatus('in_progress')
        } else if (milestoneType?.name === 'patient_out') {
          await updateCaseStatus('completed')

          // Auto-detection: Run quality checks on completed case
          try {
            const issuesFound = await runDetectionForCase(supabase, id)

            if (issuesFound === 0) {
              await supabase
                .from('cases')
                .update({ data_validated: true, validated_at: new Date().toISOString(), validated_by: null })
                .eq('id', id)
              showToast({ type: 'info', title: 'Case auto-validated', message: 'No quality issues found' })
            } else {
              await supabase
                .from('cases')
                .update({ data_validated: false, validated_at: null, validated_by: null })
                .eq('id', id)
              showToast({
                type: 'warning',
                title: `Case has ${issuesFound} quality issues`,
                message: 'Manual review required'
              })
            }
          } catch (err) {
            showToast({
              type: 'error',
              title: 'Detection Error',
              message: err instanceof Error ? err.message : 'An error occurred during detection.'
            })
          }
        }

        // Audit logging
        if (milestoneType && caseData) {
          await milestoneAudit.recorded(supabase, caseData.case_number, milestoneType.display_name, savedMilestone.id, timestamp)
        }
      }
    } catch (err) {
      // Roll back optimistic update on failure
      const currentMilestones = await new Promise<CaseMilestone[]>(resolve => {
        setCaseMilestones(prev => { resolve(prev); return prev })
      })
      const existingMilestone = currentMilestones.find(cm => cm.facility_milestone_id === milestoneTypeId)
      if (existingMilestone) {
        setCaseMilestones(prev =>
          prev.map(cm => cm.id === existingMilestone.id ? { ...cm, recorded_at: null } : cm)
            .filter(cm => !cm.id.startsWith('optimistic-'))
        )
      }
      showToast({
        type: 'error',
        title: 'Failed to record milestone',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setRecordingMilestoneIds(prev => {
        const next = new Set(prev)
        next.delete(milestoneTypeId)
        return next
      })
    }
  }

  const performUndo = async (milestoneId: string) => {
    const currentMilestones = await new Promise<CaseMilestone[]>(resolve => {
      setCaseMilestones(prev => { resolve(prev); return prev })
    })

    const milestone = currentMilestones.find(m => m.id === milestoneId)
    const milestoneType = milestone ? milestoneTypes.find(mt => mt.id === milestone.facility_milestone_id) : null

    const { error } = await supabase
      .from('case_milestones')
      .update({ recorded_at: null })
      .eq('id', milestoneId)

    if (!error) {
      setCaseMilestones(prev =>
        prev.map(m => m.id === milestoneId ? { ...m, recorded_at: null } : m)
      )

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

  const undoMilestone = async (milestoneId: string): Promise<void> => {
    showConfirm({
      variant: 'warning',
      title: 'Undo milestone?',
      message: 'Are you sure you want to undo this milestone?',
      confirmText: 'Undo',
      cancelText: 'Cancel',
      onConfirm: () => performUndo(milestoneId),
    })
  }

  const updateCaseStatus = async (statusName: string) => {
    const { data: statusData } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', statusName)
      .single()

    if (statusData) {
      await supabase.from('cases').update({ status_id: statusData.id }).eq('id', id)
      if (caseData) {
        setCaseData({ ...caseData, case_statuses: { id: statusData.id, name: statusName } })
      }
    }
  }

  // ============================================================================
  // SURGEON LEFT FUNCTIONS
  // ============================================================================

  const recordSurgeonLeft = async () => {
    const timestamp = new Date().toISOString()
    const { error } = await supabase.from('cases').update({ surgeon_left_at: timestamp }).eq('id', id)
    if (!error) setSurgeonLeftAt(timestamp)
  }

  const clearSurgeonLeft = async () => {
    const { error } = await supabase.from('cases').update({ surgeon_left_at: null }).eq('id', id)
    if (!error) setSurgeonLeftAt(null)
  }

  // ============================================================================
  // STAFF FUNCTIONS
  // ============================================================================

  const addStaff = async (staffId: string) => {
    const staffMember = availableStaff.find(s => s.id === staffId)
    if (!staffMember) return

    const { data, error } = await supabase
      .from('case_staff')
      .insert({ case_id: id, user_id: staffId, role_id: staffMember.role_id })
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
    const { error } = await supabase.from('case_staff').update({ removed_at: new Date().toISOString() }).eq('id', caseStaffId)

    if (!error) {
      setCaseStaff(caseStaff.filter(cs => cs.id !== caseStaffId))
      if (staffRecord && caseData) {
        const user = getJoinedValue(staffRecord.users)
        const role = getJoinedValue(staffRecord.user_roles)
        await staffAudit.removed(supabase, caseData.case_number, user ? `${user.first_name} ${user.last_name}` : 'Unknown', role?.name || 'staff', caseStaffId)
      }
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const room = getJoinedValue(caseData?.or_rooms)
  const procedure = getJoinedValue(caseData?.procedure_types)
  const status = getJoinedValue(caseData?.case_statuses)
  const surgeon = getJoinedValue(caseData?.surgeon)
  const anesthesiologist = getJoinedValue(caseData?.anesthesiologist)
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

  let totalTimeMs = 0
  if (patientInTime) {
    const endTime = patientOutTime ? new Date(patientOutTime).getTime() : currentTime
    totalTimeMs = endTime - new Date(patientInTime).getTime()
  }
  const totalTime = formatElapsedMs(totalTimeMs)
  const totalMinutes = Math.round(totalTimeMs / 60000)

  let surgicalTimeMs = 0
  if (incisionTime) {
    const endTime = closingTime ? new Date(closingTime).getTime() : currentTime
    surgicalTimeMs = endTime - new Date(incisionTime).getTime()
  }
  const surgicalTime = formatElapsedMs(surgicalTimeMs)
  const surgicalMinutes = Math.round(surgicalTimeMs / 60000)

  const totalVariance = surgeonAverages.avgTotalTime ? totalMinutes - surgeonAverages.avgTotalTime : null
  const surgicalVariance = surgeonAverages.avgSurgicalTime ? surgicalMinutes - surgeonAverages.avgSurgicalTime : null

  const completedMilestones = caseMilestones.filter(cm => cm.recorded_at !== null).length
  const totalMilestoneCount = milestoneTypes.length
  const closingStarted = !!closingTime
  const patientOutRecorded = !!patientOutTime

  const assignedStaff = caseStaff.filter(cs => {
    const role = getJoinedValue(cs.user_roles)
    return role?.name !== 'surgeon'
  })

  const unassignedStaff = availableStaff.filter(s => !caseStaff.some(cs => cs.user_id === s.id))

  // ============================================================================
  // LOADING / ERROR / NOT FOUND
  // ============================================================================

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading case..." />
      </DashboardLayout>
    )
  }

  if (!caseData) {
    return (
      <DashboardLayout>
        <ErrorBanner
          message={error}
          onRetry={fetchData}
          onDismiss={() => setError(null)}
          className="mb-6"
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-slate-500">Case not found</p>
          <Link href="/cases" className="text-blue-600 hover:underline">Back to cases</Link>
        </div>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // INCOMPLETE CASE MODAL
  // ============================================================================

  const incompleteMissingFields = {
    surgeon_id: !caseData.surgeon_id,
    procedure_type_id: !caseData.procedure_type_id,
    or_room_id: !caseData.or_room_id,
  }

  const handleIncompleteSave = async (values: {
    surgeon_id?: string
    procedure_type_id?: string
    or_room_id?: string
  }) => {
    const { error: updateError } = await supabase
      .from('cases')
      .update(values)
      .eq('id', id)

    if (updateError) {
      showToast({
        type: 'error',
        title: 'Failed to update case',
        message: updateError.message,
      })
      return
    }

    showToast({
      type: 'success',
      title: 'Case updated',
      message: 'Missing fields have been filled in.',
    })

    setShowIncompleteModal(false)
    fetchData() // Refresh all data
  }

  // ============================================================================
  // COMPLETED CASE VIEW
  // ============================================================================

  if (isCompleted) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/cases" className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{caseData.case_number}</h1>
                <StatusBadgeDot status="completed" />
              </div>
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
              const user = getJoinedValue(cs.users)
              const role = getJoinedValue(cs.user_roles)
              return {
                id: cs.id,
                name: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                role: role?.name || 'staff'
              }
            })}
            patientCallTime={patientCallTime}
            surgeonAverage={surgeonProcedureAverage}
            milestoneAverages={milestoneAverages}
            implants={implants}
            implantCategory={implantCategory}
            facilityId={effectiveFacilityId!}
            userId={userData.userId}
            supabase={supabase}
            deviceCompanies={deviceCompanies}
          />
        </div>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // BUILD MILESTONE DATA FOR GRID
  // ============================================================================

  const getPartnerMilestone = (milestone: FacilityMilestone): FacilityMilestone | undefined => {
    if (!milestone.pair_with_id) return undefined
    return milestoneTypes.find(mt => mt.id === milestone.pair_with_id)
  }

  const milestoneCards: MilestoneCardData[] = milestoneTypes
    .filter(mt => mt.pair_position !== 'end')
    .map(mt => {
      const recorded = getMilestoneByTypeId(mt.id)
      const isPaired = mt.pair_position === 'start'
      const partner = isPaired ? getPartnerMilestone(mt) : undefined
      const partnerRecorded = partner ? getMilestoneByTypeId(partner.id) : undefined

      let elapsedDisplay = ''
      if (isPaired && recorded?.recorded_at) {
        const endTime = partnerRecorded?.recorded_at
          ? new Date(partnerRecorded.recorded_at).getTime()
          : currentTime
        const elapsedMs = endTime - new Date(recorded.recorded_at).getTime()
        const totalSeconds = Math.floor(elapsedMs / 1000)
        const mins = Math.floor(totalSeconds / 60)
        const secs = totalSeconds % 60
        elapsedDisplay = `${mins}m ${secs}s`
      }

      return {
        milestone: mt,
        recorded,
        isPaired,
        partner,
        partnerRecorded,
        elapsedMs: 0,
        elapsedDisplay,
        displayName: mt.display_name.replace(/ Start$/i, ''),
        isComplete: isPaired ? !!partnerRecorded?.recorded_at : !!recorded?.recorded_at,
        isInProgress: isPaired ? (!!recorded?.recorded_at && !partnerRecorded?.recorded_at) : false,
      }
    })

  // ============================================================================
  // ACTIVE CASE VIEW - COMMAND CENTER
  // ============================================================================

  return (
    <DashboardLayout>
      {/* Undo confirmation dialog */}
      {confirmDialog}

      {/* Incomplete Case Modal — blocks interaction until required fields are filled */}
      {showIncompleteModal && (
        <IncompleteCaseModal
          caseId={id}
          missingFields={incompleteMissingFields}
          surgeons={allSurgeons}
          procedures={allProcedures}
          rooms={allRooms}
          existingValues={{
            surgeon_id: caseData.surgeon_id,
            procedure_type_id: caseData.procedure_type_id,
            or_room_id: caseData.or_room_id,
          }}
          onSave={handleIncompleteSave}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24">

        {/* Error Banner */}
        <ErrorBanner
          message={error}
          onRetry={fetchData}
          onDismiss={() => setError(null)}
          className="mb-4"
        />

        {/* ================================================================== */}
        {/* TOP ROW: Timers + Quick Info */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* TIMERS (2 cols) - HERO SIZE */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {/* Total Time */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 relative overflow-hidden min-h-[180px] flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  {patientInTime && !patientOutTime ? (
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-slate-600 rounded-full" />
                  )}
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Time</span>
                </div>
                <p className="text-5xl lg:text-6xl font-bold text-white font-mono tabular-nums tracking-tight">
                  {totalTime}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {surgeonAverages.avgTotalTime && (
                    <>
                      <span className="text-sm text-slate-500">Avg: {formatMinutesHMS(surgeonAverages.avgTotalTime)}</span>
                      {totalVariance !== null && patientInTime && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          totalVariance > 10 ? 'bg-red-500/20 text-red-400' :
                          totalVariance < -10 ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {totalVariance > 0 ? '+' : ''}{totalVariance}m
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Surgical Time */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 relative overflow-hidden min-h-[180px] flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  {incisionTime && !closingTime ? (
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-slate-600 rounded-full" />
                  )}
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Surgical Time</span>
                </div>
                <p className="text-5xl lg:text-6xl font-bold text-white font-mono tabular-nums tracking-tight">
                  {surgicalTime}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {surgeonAverages.avgSurgicalTime && (
                    <>
                      <span className="text-sm text-slate-500">Avg: {formatMinutesHMS(surgeonAverages.avgSurgicalTime)}</span>
                      {surgicalVariance !== null && incisionTime && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          surgicalVariance > 10 ? 'bg-red-500/20 text-red-400' :
                          surgicalVariance < -10 ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {surgicalVariance > 0 ? '+' : ''}{surgicalVariance}m
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* QUICK INFO (1 col) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/cases" className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                  <h1 className="text-lg font-bold text-slate-900">{caseData.case_number}</h1>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{procedure?.name || 'No procedure'}</p>
              </div>
              <StatusBadgeDot status={status?.name || 'scheduled'} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Room</p>
                <p className="font-semibold text-slate-900">{room?.name || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Scheduled</p>
                <p className="font-semibold text-slate-900">{formatDisplayTime(caseData.start_time, { fallback: '--:--' })}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Surgeon</p>
                <p className="font-semibold text-slate-900">{surgeon ? `Dr. ${surgeon.last_name}` : '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Side</p>
                <p className="font-semibold text-slate-900 capitalize">{caseData.operative_side || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* BOTTOM ROW: Milestones + Sidebar */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* MILESTONE SECTION (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Milestones</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {completedMilestones} of {totalMilestoneCount} recorded
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${totalMilestoneCount > 0 ? (completedMilestones / totalMilestoneCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {totalMilestoneCount > 0 ? Math.round((completedMilestones / totalMilestoneCount) * 100) : 0}%
                </span>
                <PiPButton onClick={() => setIsPiPOpen(true)} disabled={isPiPOpen} />
              </div>
            </div>

            <div className="p-5">
              {milestoneTypes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium">No milestones configured</p>
                  <p className="text-xs mt-1">Configure milestones in Settings</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {milestoneCards.map((card) => (
                    <MilestoneCard
                      key={card.milestone.id}
                      card={card}
                      onRecord={() => recordMilestone(card.milestone.id)}
                      onRecordEnd={() => card.partner && recordMilestone(card.partner.id)}
                      onUndo={() => card.recorded && undoMilestone(card.recorded.id)}
                      onUndoEnd={() => card.partnerRecorded && undoMilestone(card.partnerRecorded.id)}
                      loading={recordingMilestoneIds.has(card.milestone.id) || (card.partner ? recordingMilestoneIds.has(card.partner.id) : false)}
                      timeZone={userData.facilityTimezone}
                    />
                  ))}
                </div>
              )}

              {/* Surgeon Left Confirmation */}
              {surgeonLeftAt && !patientOutRecorded && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-semibold text-orange-800">Surgeon Left</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-0.5">{formatTimestamp(surgeonLeftAt, { timeZone: userData.facilityTimezone })}</p>
                    </div>
                    <button
                      onClick={clearSurgeonLeft}
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium px-2 py-1 rounded hover:bg-orange-100 transition-colors"
                    >
                      Undo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR (1 col) */}
          <div className="space-y-4">

            {/* TEAM */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Team</h3>
                <span className="text-xs text-slate-400">{assignedStaff.length + (surgeon ? 1 : 0) + (anesthesiologist ? 1 : 0)} assigned</span>
              </div>
              <div className="p-3 space-y-1">
                {surgeon && <TeamMember name={`Dr. ${surgeon.last_name}`} role="Surgeon" color="blue" />}
                {anesthesiologist && <TeamMember name={`Dr. ${anesthesiologist.last_name}`} role="Anesthesia" color="amber" />}
                {assignedStaff.map(cs => {
                  const user = getJoinedValue(cs.users)
                  const role = getJoinedValue(cs.user_roles)
                  return (
                    <TeamMember
                      key={cs.id}
                      name={user ? `${user.first_name} ${user.last_name}` : 'Unknown'}
                      role={role?.name || 'Staff'}
                      color={role?.name === 'nurse' ? 'emerald' : 'purple'}
                      onRemove={() => removeStaff(cs.id)}
                    />
                  )
                })}

                {showAddStaff ? (
                  <div className="pt-2">
                    <select
                      autoFocus
                      onChange={(e) => { if (e.target.value) { addStaff(e.target.value); setShowAddStaff(false) } }}
                      onBlur={() => setShowAddStaff(false)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Select staff...</option>
                      {unassignedStaff.map(s => {
                        const roleName = Array.isArray(s.user_roles) ? s.user_roles[0]?.name : (s.user_roles as any)?.name
                        return <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({roleName})</option>
                      })}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-2 mt-1 border border-dashed border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    + Add Staff
                  </button>
                )}
              </div>
            </div>

            {/* SURGEON LEFT */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Surgeon Status</h3>
              </div>
              <div className="p-3">
                {!surgeonLeftAt ? (
                  <button
                    onClick={recordSurgeonLeft}
                    disabled={!closingStarted || patientOutRecorded}
                    className={`w-full py-2.5 px-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                      closingStarted && !patientOutRecorded
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-sm hover:shadow'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    Surgeon Left OR
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-semibold text-orange-800">Surgeon Left</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-0.5">{formatTimestamp(surgeonLeftAt, { timeZone: userData.facilityTimezone })}</p>
                    </div>
                    {!patientOutRecorded && (
                      <button
                        onClick={clearSurgeonLeft}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium px-2 py-1 rounded hover:bg-orange-100 transition-colors"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                )}
                {!closingStarted && !surgeonLeftAt && (
                  <p className="text-xs text-slate-400 text-center mt-2">Available after closing starts</p>
                )}
              </div>
            </div>

            {/* TRAYS */}
            <DeviceRepSection caseId={id} supabase={supabase} compact />

            {/* IMPLANTS */}
            {implants && implantCategory && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">Implants</h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(implantCategory === 'hip' || implantCategory === 'total_hip') && (
                      <>
                        <ImplantBadge label="Cup" value={implants.cup_size_final} />
                        <ImplantBadge label="Stem" value={implants.stem_size_final} />
                        <ImplantBadge label="Head" value={implants.head_size_final} />
                        <ImplantBadge label="Liner" value={implants.liner_size_final} />
                      </>
                    )}
                    {(implantCategory === 'knee' || implantCategory === 'total_knee') && (
                      <>
                        <ImplantBadge label="Femur" value={implants.femur_size_final} />
                        <ImplantBadge label="Tibia" value={implants.tibia_size_final} />
                        <ImplantBadge label="Poly" value={implants.poly_size_final} />
                        <ImplantBadge label="Patella" value={implants.patella_size_final} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* NOTES */}
            {caseData.notes && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-slate-700">{caseData.notes}</p>
              </div>
            )}

            {/* FLAGS & DELAYS */}
            {effectiveFacilityId && (
              <CaseFlagsSection
                caseId={id}
                facilityId={effectiveFacilityId}
                isCompleted={false}
                userId={userData.userId}
                supabase={supabase}
              />
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      {effectiveFacilityId && (
        <FloatingActionButton
          actions={[{
            id: 'call-next-patient',
            label: 'Call Next Patient',
            icon: 'megaphone',
            onClick: () => setShowCallNextPatient(true)
          }]}
        />
      )}

      {/* Call Next Patient Modal */}
      {effectiveFacilityId && userData.userId && userData.userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={effectiveFacilityId}
          userId={userData.userId}
          userEmail={userData.userEmail}
        />
      )}

      {/* Picture-in-Picture Milestone Panel */}
      {caseData && (
        <PiPMilestoneWrapper
          isOpen={isPiPOpen}
          onOpenChange={setIsPiPOpen}
          caseId={caseData.id}
          caseNumber={caseData.case_number}
          procedureName={procedure?.name || 'Unknown Procedure'}
          roomName={room?.name || 'Unknown Room'}
          surgeonName={surgeon ? `Dr. ${surgeon.last_name}` : 'No Surgeon'}
          milestones={milestoneTypes.map(mt => ({
            id: mt.id,
            name: mt.name,
            display_name: mt.display_name,
            display_order: mt.display_order,
            pair_with_id: mt.pair_with_id,
            pair_position: mt.pair_position,
          }))}
          recordedMilestones={caseMilestones
            .filter(cm => cm.recorded_at !== null)
            .map(cm => ({
              id: cm.id,
              facility_milestone_id: cm.facility_milestone_id,
              recorded_at: cm.recorded_at!,
            }))}
          onRecordMilestone={recordMilestone}
          onUndoMilestone={undoMilestone}
          onRefresh={() => {
            const fetchMilestones = async () => {
              const { data } = await supabase
                .from('case_milestones')
                .select('id, facility_milestone_id, recorded_at')
                .eq('case_id', id)
              if (data) setCaseMilestones(data)
            }
            fetchMilestones()
          }}
          timeZone={userData.facilityTimezone}
        />
      )}
    </DashboardLayout>
  )
}