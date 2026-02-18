'use client'

// ============================================================================
// CASE DETAIL PAGE - COMMAND CENTER DESIGN
// ============================================================================
// Dense, data-rich dashboard layout
// Professional milestone section that sells the product

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useBreadcrumbLabel } from '@/lib/BreadcrumbContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { milestoneAudit, staffAudit } from '@/lib/audit-logger'
import CaseActivitySummary from '@/components/cases/CaseActivitySummary'
import MilestoneTimelineV2, { type CaseFlagForTimeline } from '@/components/cases/MilestoneTimelineV2'
import { type DelayTypeOption } from '@/components/cases/AddDelayForm'
import TeamMember from '@/components/cases/TeamMember'
import ImplantSection from '@/components/cases/ImplantSection'
import { runDetectionForCase } from '@/lib/dataQuality'
import PiPMilestoneWrapper, { PiPButton } from '@/components/pip/PiPMilestoneWrapper'
// CaseFlagsSection removed — flags now inline on milestone timeline (Phase 4)
import IncompleteCaseModal from '@/components/cases/IncompleteCaseModal'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Check, ChevronLeft, ClipboardList, Flag, LogOut } from 'lucide-react'
import { StatusBadgeDot } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import {
  getJoinedValue,
  formatDisplayTime,
  formatTimestamp,
  formatElapsedMs,
  formatMinutesHMS,
} from '@/lib/formatters'
import { useMilestoneRealtime } from '@/lib/hooks/useMilestoneRealtime'
import { type SurgeonMilestoneStats } from '@/types/pace'
import { TimerChip, ProgressChip } from '@/components/cases/TimerChip'
import { checkMilestoneOrder } from '@/lib/milestone-order'
import { useFlipRoom } from '@/lib/hooks/useFlipRoom'
import FlipRoomCard from '@/components/cases/FlipRoomCard'

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const { showToast } = useToast()

  // User context — replaces manual fetchUserFacility
  const {
    userData,
    loading: userLoading,
    effectiveFacilityId,
    can,
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

  // Pace stats (median-based, from surgeon_procedure_stats / surgeon_milestone_stats)
  const [procedureStats, setProcedureStats] = useState<{
    medianDuration: number
    p25Duration: number | null
    p75Duration: number | null
    sampleSize: number
  } | null>(null)
  const [milestoneStats, setMilestoneStats] = useState<SurgeonMilestoneStats[]>([])
  const [caseSequence, setCaseSequence] = useState<{ current: number; total: number } | null>(null)

  // Implants
  const [implants, setImplants] = useState<{
    hip?: { femoral_head_size?: string; acetabular_liner?: string }
    knee?: { femoral_component_size?: string; tibial_insert_size?: string }
    cup_size_final?: string | null
    stem_size_final?: string | null
    head_size_final?: string | null
    liner_size_final?: string | null
    femur_size_final?: string | null
    tibia_size_final?: string | null
    poly_size_final?: string | null
    patella_size_final?: string | null
  } | null>(null)
  const [implantCategory, setImplantCategory] = useState<'hip' | 'knee' | 'total_hip' | 'total_knee' | null>(null)

  // Flags & delays (Phase 4: inline on timeline)
  const [caseFlags, setCaseFlags] = useState<CaseFlagForTimeline[]>([])
  const [delayTypeOptions, setDelayTypeOptions] = useState<DelayTypeOption[]>([])

  // UI state
  const [activeTab, setActiveTab] = useState<'milestones' | 'implants'>('milestones')
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

  // Register dynamic breadcrumb label — "Case #1042"
  useBreadcrumbLabel('/cases/[id]', caseData?.case_number ? `Case #${caseData.case_number}` : undefined)

  // Live clock — only tick for active (non-completed) cases
  const isCompleted = caseData ? getJoinedValue(caseData.case_statuses)?.name === 'completed' : false
  useEffect(() => {
    if (isCompleted) return
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isCompleted])

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
        const roleName = Array.isArray(u.user_roles) ? u.user_roles[0]?.name : (u.user_roles as unknown as { name?: string })?.name
        return roleName === 'nurse' || roleName === 'tech' || roleName === 'anesthesiologist'
      })

      // Fetch dropdown options for incomplete case modal
      const surgeonUsers = (allFacilityUsers || []).filter(u => {
        const roleName = Array.isArray(u.user_roles) ? u.user_roles[0]?.name : (u.user_roles as unknown as { name?: string })?.name
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

      // Fetch case flags (threshold + delay) for inline timeline display
      const { data: flagsData } = await supabase
        .from('case_flags')
        .select(`
          id, flag_type, severity, metric_value, threshold_value, comparison_scope,
          delay_type_id, duration_minutes, note, created_by, facility_milestone_id,
          flag_rules (name, end_milestone),
          delay_types (display_name)
        `)
        .eq('case_id', id)
        .order('created_at', { ascending: true })

      if (flagsData) {
        const mapped: CaseFlagForTimeline[] = flagsData.map((f: Record<string, unknown>) => {
          const flagRule = Array.isArray(f.flag_rules) ? f.flag_rules[0] : f.flag_rules
          const delayType = Array.isArray(f.delay_types) ? f.delay_types[0] : f.delay_types

          // Resolve milestone: direct for delays, derived from flag_rules.end_milestone for threshold
          let resolvedMilestoneId = f.facility_milestone_id as string | null
          if (!resolvedMilestoneId && flagRule?.end_milestone) {
            const match = milestoneTypesResult.find(mt => mt.name === flagRule.end_milestone)
            if (match) resolvedMilestoneId = match.id
          }

          // Label
          const label = f.flag_type === 'threshold'
            ? (flagRule?.name || 'Threshold Flag')
            : ((delayType as { display_name?: string })?.display_name || 'Delay')

          // Detail
          let detail: string | null = null
          if (f.flag_type === 'threshold') {
            const actual = f.metric_value !== null ? Math.round(f.metric_value as number) : null
            const threshold = f.threshold_value !== null ? Math.round(f.threshold_value as number) : null
            if (actual !== null && threshold !== null) {
              detail = `${actual} min (threshold: ${threshold} min)`
            }
          } else if (f.duration_minutes) {
            detail = `${f.duration_minutes} min`
          }

          return {
            id: f.id as string,
            flag_type: f.flag_type as 'threshold' | 'delay',
            severity: (f.severity as 'critical' | 'warning' | 'info') || 'info',
            label,
            detail,
            facility_milestone_id: resolvedMilestoneId,
            duration_minutes: f.duration_minutes as number | null,
            note: f.note as string | null,
            created_by: f.created_by as string | null,
          }
        })
        setCaseFlags(mapped)
      }

      // Fetch delay types for the AddDelayForm
      const { data: delayTypesData } = await supabase
        .from('delay_types')
        .select('id, name, display_name')
        .or(`facility_id.eq.${effectiveFacilityId},facility_id.is.null`)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (delayTypesData) setDelayTypeOptions(delayTypesData)

      // Fetch surgeon pace stats (median-based, from materialized views)
      const surgeon = getJoinedValue(caseResult?.surgeon)
      if (caseResult?.procedure_type_id && surgeon) {
        // Procedure-level stats (total case duration)
        const { data: procStats } = await supabase
          .from('surgeon_procedure_stats')
          .select('median_duration, p25_duration, p75_duration, sample_size')
          .eq('surgeon_id', surgeon.id)
          .eq('procedure_type_id', caseResult.procedure_type_id)
          .eq('facility_id', effectiveFacilityId)
          .maybeSingle()

        if (procStats) {
          setProcedureStats({
            medianDuration: Number(procStats.median_duration),
            p25Duration: procStats.p25_duration != null ? Number(procStats.p25_duration) : null,
            p75Duration: procStats.p75_duration != null ? Number(procStats.p75_duration) : null,
            sampleSize: procStats.sample_size,
          })
        }

        // Per-milestone stats (time from start to each milestone)
        const { data: msStatsData } = await supabase
          .from('surgeon_milestone_stats')
          .select('milestone_type_id, milestone_name, median_minutes_from_start, p25_minutes_from_start, p75_minutes_from_start, sample_size, avg_minutes_from_start, stddev_minutes_from_start')
          .eq('surgeon_id', surgeon.id)
          .eq('procedure_type_id', caseResult.procedure_type_id)
          .eq('facility_id', effectiveFacilityId)

        if (msStatsData) {
          setMilestoneStats(msStatsData.map(ms => ({
            facility_id: effectiveFacilityId,
            surgeon_id: surgeon.id,
            procedure_type_id: caseResult.procedure_type_id!,
            milestone_type_id: ms.milestone_type_id,
            milestone_name: ms.milestone_name,
            sample_size: ms.sample_size,
            median_minutes_from_start: Number(ms.median_minutes_from_start),
            p25_minutes_from_start: ms.p25_minutes_from_start != null ? Number(ms.p25_minutes_from_start) : null,
            p75_minutes_from_start: ms.p75_minutes_from_start != null ? Number(ms.p75_minutes_from_start) : null,
            avg_minutes_from_start: ms.avg_minutes_from_start != null ? Number(ms.avg_minutes_from_start) : null,
            stddev_minutes_from_start: ms.stddev_minutes_from_start != null ? Number(ms.stddev_minutes_from_start) : null,
          })))
        }
      }

      // Case sequence — "Case 3 of 5 today"
      if (surgeon && caseResult?.scheduled_date) {
        const { data: daysCases } = await supabase
          .from('cases')
          .select('id, start_time, case_statuses (name)')
          .eq('surgeon_id', surgeon.id)
          .eq('scheduled_date', caseResult.scheduled_date)
          .eq('facility_id', effectiveFacilityId)
          .order('start_time', { ascending: true })

        if (daysCases) {
          const nonCancelled = daysCases.filter(c => {
            const s = getJoinedValue(c.case_statuses as { name: string }[] | { name: string } | null)
            return s?.name !== 'cancelled'
          })
          const currentIndex = nonCancelled.findIndex(c => c.id === id)
          if (currentIndex >= 0) {
            setCaseSequence({ current: currentIndex + 1, total: nonCancelled.length })
          }
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

  // Flip room — surgeon's next case in a different room
  const { flipRoom, nextSameRoomCaseNumber, setCalledBackAt } = useFlipRoom({
    supabase,
    surgeonId: caseData?.surgeon_id || null,
    currentCaseId: id,
    currentRoomId: caseData?.or_room_id || null,
    scheduledDate: caseData?.scheduled_date || null,
    facilityId: effectiveFacilityId,
    enabled: !loading && !!caseData,
  })
  const [flipRoomCallingBack, setFlipRoomCallingBack] = useState(false)

  // ============================================================================
  // MILESTONE FUNCTIONS
  // ============================================================================

  const getMilestoneByTypeId = (typeId: string): CaseMilestone | undefined => {
    return caseMilestones.find(m => m.facility_milestone_id === typeId)
  }

  const performRecord = async (milestoneTypeId: string) => {
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

  // Out-of-order milestone warning — intercepts before recording
  const recordMilestone = async (milestoneTypeId: string): Promise<void> => {
    const { isOutOfOrder, skippedCount } = checkMilestoneOrder(
      milestoneTypeId,
      milestoneTypes,
      caseMilestones,
    )

    if (isOutOfOrder) {
      const milestoneType = milestoneTypes.find(mt => mt.id === milestoneTypeId)
      showConfirm({
        variant: 'warning',
        title: 'Out-of-order milestone',
        message: `You're recording ${milestoneType?.display_name || 'this milestone'} with ${skippedCount} earlier milestone${skippedCount === 1 ? '' : 's'} unrecorded. Continue anyway?`,
        confirmText: 'Record anyway',
        cancelText: 'Cancel',
        onConfirm: () => performRecord(milestoneTypeId),
      })
      return
    }

    performRecord(milestoneTypeId)
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
  // FLAG & DELAY FUNCTIONS (Phase 4: inline on timeline)
  // ============================================================================

  const handleAddDelay = async (data: {
    delayTypeId: string
    durationMinutes: number | null
    note: string | null
    facilityMilestoneId: string
  }) => {
    if (!effectiveFacilityId) return

    // Write to case_flags (new system)
    const { data: newFlag, error: flagError } = await supabase
      .from('case_flags')
      .insert({
        case_id: id,
        facility_id: effectiveFacilityId,
        flag_type: 'delay',
        delay_type_id: data.delayTypeId,
        duration_minutes: data.durationMinutes,
        severity: 'warning',
        note: data.note,
        created_by: userData.userId,
        facility_milestone_id: data.facilityMilestoneId,
      })
      .select('id, delay_types (display_name)')
      .single()

    if (flagError) {
      showToast({ type: 'error', title: 'Failed to log delay', message: flagError.message })
      throw flagError
    }

    // Write to case_delays (backward compat)
    await supabase.from('case_delays').insert({
      case_id: id,
      delay_type_id: data.delayTypeId,
      duration_minutes: data.durationMinutes,
      notes: data.note,
      recorded_at: new Date().toISOString(),
      recorded_by: userData.userId,
    })

    // Optimistic local state update
    if (newFlag) {
      const delayType = Array.isArray(newFlag.delay_types) ? newFlag.delay_types[0] : newFlag.delay_types
      setCaseFlags(prev => [...prev, {
        id: newFlag.id,
        flag_type: 'delay',
        severity: 'warning',
        label: (delayType as { display_name?: string })?.display_name || 'Delay',
        detail: data.durationMinutes ? `${data.durationMinutes} min` : null,
        facility_milestone_id: data.facilityMilestoneId,
        duration_minutes: data.durationMinutes,
        note: data.note,
        created_by: userData.userId,
      }])
    }

    showToast({ type: 'success', title: 'Delay logged' })
  }

  const handleRemoveDelay = async (flagId: string) => {
    const { error } = await supabase.from('case_flags').delete().eq('id', flagId)
    if (error) {
      showToast({ type: 'error', title: 'Failed to remove delay', message: error.message })
      return
    }
    setCaseFlags(prev => prev.filter(f => f.id !== flagId))
    showToast({ type: 'success', title: 'Delay removed' })
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
  // FLIP ROOM CALLBACK FUNCTIONS
  // ============================================================================

  const callBackFlipRoom = async () => {
    if (!flipRoom || !effectiveFacilityId || !userData.userId) return

    setFlipRoomCallingBack(true)
    const now = new Date().toISOString()

    // Optimistic update
    setCalledBackAt(now)

    try {
      // 1. Set called_back_at on the flip room case
      const { error: updateError } = await supabase
        .from('cases')
        .update({ called_back_at: now, called_back_by: userData.userId })
        .eq('id', flipRoom.caseId)

      if (updateError) throw updateError

      // 2. Create notification
      const title = `${flipRoom.roomName} Can Go Back`
      const message = `${flipRoom.caseNumber}: ${flipRoom.procedureName}`

      await supabase
        .from('notifications')
        .insert({
          facility_id: effectiveFacilityId,
          type: 'patient_call',
          title,
          message,
          room_id: caseData?.or_room_id,
          case_id: flipRoom.caseId,
          sent_by: userData.userId,
        })

      // 3. Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            facility_id: effectiveFacilityId,
            title,
            body: message,
            exclude_user_id: userData.userId,
          },
        })
      } catch {
        // Push failure is non-blocking
      }

      // 4. Audit log
      await supabase.from('audit_log').insert({
        user_id: userData.userId,
        user_email: userData.userEmail,
        action: 'patient_call.created',
        facility_id: effectiveFacilityId,
        target_type: 'case',
        target_id: flipRoom.caseId,
        target_label: `Case #${flipRoom.caseNumber}`,
        new_values: {
          room_name: flipRoom.roomName,
          procedure: flipRoom.procedureName,
          source: 'flip_room_card',
        },
        metadata: { platform: 'web' },
        success: true,
      })

      showToast({ type: 'success', title: 'Patient call sent!' })
    } catch (err) {
      // Rollback optimistic update
      setCalledBackAt(null)
      showToast({
        type: 'error',
        title: 'Failed to send call',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setFlipRoomCallingBack(false)
    }
  }

  const undoCallBackFlipRoom = async () => {
    if (!flipRoom || !effectiveFacilityId || !userData.userId) return

    setFlipRoomCallingBack(true)
    const previousCalledBackAt = flipRoom.calledBackAt

    // Optimistic update
    setCalledBackAt(null)

    try {
      // 1. Clear called_back_at
      await supabase
        .from('cases')
        .update({ called_back_at: null, called_back_by: null })
        .eq('id', flipRoom.caseId)

      // 2. Delete recent notifications for this case
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      await supabase
        .from('notifications')
        .delete()
        .eq('case_id', flipRoom.caseId)
        .eq('type', 'patient_call')
        .gte('created_at', thirtyMinutesAgo)

      // 3. Send cancellation push
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            facility_id: effectiveFacilityId,
            title: `${flipRoom.roomName} Call Cancelled`,
            body: `Patient call for ${flipRoom.caseNumber} has been cancelled`,
            exclude_user_id: userData.userId,
          },
        })
      } catch {
        // Push failure is non-blocking
      }

      // 4. Audit log
      await supabase.from('audit_log').insert({
        user_id: userData.userId,
        user_email: userData.userEmail,
        action: 'patient_call.cancelled',
        facility_id: effectiveFacilityId,
        target_type: 'case',
        target_id: flipRoom.caseId,
        target_label: `Case #${flipRoom.caseNumber}`,
        old_values: {
          room_name: flipRoom.roomName,
          procedure: flipRoom.procedureName,
          source: 'flip_room_card',
        },
        metadata: { platform: 'web' },
        success: true,
      })

      showToast({ type: 'success', title: 'Call cancelled' })
    } catch (err) {
      // Rollback optimistic update
      setCalledBackAt(previousCalledBackAt)
      showToast({
        type: 'error',
        title: 'Failed to cancel call',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setFlipRoomCallingBack(false)
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
        const roleName = Array.isArray(staffMember.user_roles) ? staffMember.user_roles[0]?.name : (staffMember.user_roles as unknown as { name?: string })?.name
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

  let surgicalTimeMs = 0
  if (incisionTime) {
    const endTime = closingTime ? new Date(closingTime).getTime() : currentTime
    surgicalTimeMs = endTime - new Date(incisionTime).getTime()
  }
  const surgicalTime = formatElapsedMs(surgicalTimeMs)

  // Median-based comparisons for timer chips
  const medianTotalMinutes = procedureStats?.medianDuration ?? null

  // Surgical time median: closing milestone median - incision milestone median
  const incisionStats = milestoneStats.find(ms => ms.milestone_name === 'incision')
  const closingStats = milestoneStats.find(ms => ms.milestone_name === 'closing')
  const medianSurgicalMinutes = (incisionStats && closingStats)
    ? Math.round(closingStats.median_minutes_from_start - incisionStats.median_minutes_from_start)
    : null

  const completedMilestones = caseMilestones.filter(cm => cm.recorded_at !== null).length
  const totalMilestoneCount = milestoneTypes.length
  const closingStarted = !!closingTime
  const patientOutRecorded = !!patientOutTime

  const assignedStaff = caseStaff.filter(cs => {
    const role = getJoinedValue(cs.user_roles)
    return role?.name !== 'surgeon'
  })

  const unassignedStaff = availableStaff.filter(s => !caseStaff.some(cs => cs.user_id === s.id))

  // Implant count for tab badge — count non-null final size fields
  const implantFilledCount = implants ? [
    implants.cup_size_final, implants.stem_size_final, implants.head_size_final, implants.liner_size_final,
    implants.femur_size_final, implants.tibia_size_final, implants.poly_size_final, implants.patella_size_final,
  ].filter(Boolean).length : 0

  // ============================================================================
  // LOADING / ERROR / NOT FOUND
  // ============================================================================

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-6">
            {/* Main content skeleton */}
            <div className="space-y-4">
              {/* Header skeleton */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded skeleton-pulse" />
                  <div className="h-6 w-48 rounded skeleton-pulse" />
                  <div className="h-5 w-20 rounded-full skeleton-pulse" />
                </div>
                <div className="flex items-center gap-2 ml-8">
                  <div className="h-5 w-16 rounded skeleton-pulse" />
                  <div className="h-4 w-12 rounded skeleton-pulse" />
                  <div className="h-4 w-20 rounded skeleton-pulse" />
                  <div className="h-4 w-16 rounded skeleton-pulse" />
                </div>
              </div>
              {/* Timer chips skeleton */}
              <div className="flex gap-3">
                <div className="flex-1 h-24 rounded-2xl skeleton-pulse min-w-[170px]" />
                <div className="flex-1 h-24 rounded-2xl skeleton-pulse min-w-[170px]" />
                <div className="h-24 w-[120px] rounded-2xl skeleton-pulse" />
              </div>
              {/* Tab bar skeleton */}
              <div className="flex gap-1">
                <div className="h-8 w-24 rounded-lg skeleton-pulse" />
                <div className="h-8 w-20 rounded-lg skeleton-pulse" />
              </div>
              {/* Timeline skeleton */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-7 h-7 rounded-full skeleton-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-32 rounded skeleton-pulse" />
                      {i < 2 && <div className="h-3 w-20 rounded skeleton-pulse" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sidebar skeleton */}
            <div className="space-y-4">
              <div className="h-32 rounded-[14px] skeleton-pulse" />
              <div className="h-24 rounded-[14px] skeleton-pulse" />
              <div className="h-40 rounded-[14px] skeleton-pulse" />
            </div>
          </div>
        </div>
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

  // Permission flags — disabled for completed cases
  const canManage = !isCompleted && can('milestones.manage')
  const canCreateFlags = !isCompleted && can('flags.create')

  // ============================================================================
  // CASE VIEW (unified for active + completed)
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* Error Banner */}
        <ErrorBanner
          message={error}
          onRetry={fetchData}
          onDismiss={() => setError(null)}
          className="mb-4"
        />

        {/* ================================================================== */}
        {/* TWO-COLUMN LAYOUT: Main + Sidebar */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-6">

          {/* ============ MAIN CONTENT ============ */}
          <div className="space-y-4">

            {/* CASE HEADER */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/cases" className="text-slate-400 hover:text-slate-600 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-slate-900">
                  {procedure?.name || 'No Procedure'}
                </h1>
                <StatusBadgeDot status={status?.name || 'scheduled'} />
                {caseFlags.filter(f => f.flag_type === 'threshold').length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-500/[0.08] px-2.5 py-0.5 rounded-md">
                    <Flag className="w-3 h-3" />
                    {caseFlags.filter(f => f.flag_type === 'threshold').length} flag{caseFlags.filter(f => f.flag_type === 'threshold').length !== 1 ? 's' : ''}
                  </span>
                )}
                {caseFlags.filter(f => f.flag_type === 'delay').length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/[0.08] px-2.5 py-0.5 rounded-md">
                    ⏱ {caseFlags.filter(f => f.flag_type === 'delay').length} delay{caseFlags.filter(f => f.flag_type === 'delay').length !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="ml-auto">
                  <PiPButton onClick={() => setIsPiPOpen(true)} disabled={isPiPOpen} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500 flex-wrap ml-8">
                <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 rounded font-mono text-xs text-slate-600">
                  {caseData.case_number}
                </span>
                {room && (<><span className="text-slate-300">&middot;</span><span>{room.name}</span></>)}
                {caseData.operative_side && (<><span className="text-slate-300">&middot;</span><span className="capitalize">{caseData.operative_side}</span></>)}
                {surgeon && (<><span className="text-slate-300">&middot;</span><span>Dr. {surgeon.last_name}</span></>)}
                {caseData.start_time && (<><span className="text-slate-300">&middot;</span><span>{formatDisplayTime(caseData.start_time, { fallback: '--:--' })}</span></>)}
                {caseSequence && (<><span className="text-slate-300">&middot;</span><span>Case {caseSequence.current} of {caseSequence.total}</span></>)}
              </div>
            </div>

            {/* TIMERS */}
            <div className="flex gap-3 flex-wrap">
              <TimerChip
                label="Total Time"
                formattedTime={totalTime}
                medianFormatted={medianTotalMinutes !== null ? formatMinutesHMS(medianTotalMinutes) : null}
                isRunning={!isCompleted && !!patientInTime && !patientOutTime}
                color="indigo"
                ratio={medianTotalMinutes !== null && medianTotalMinutes > 0 ? totalTimeMs / (medianTotalMinutes * 60000) : null}
              />
              <TimerChip
                label="Surgical Time"
                formattedTime={surgicalTime}
                medianFormatted={medianSurgicalMinutes !== null ? formatMinutesHMS(medianSurgicalMinutes) : null}
                isRunning={!isCompleted && !!incisionTime && !closingTime}
                color="cyan"
                ratio={medianSurgicalMinutes !== null && medianSurgicalMinutes > 0 ? surgicalTimeMs / (medianSurgicalMinutes * 60000) : null}
              />
              <ProgressChip
                completedCount={completedMilestones}
                totalCount={totalMilestoneCount}
              />
            </div>


            {/* TAB SWITCHER — pill-style tabs outside the content card */}
            <div className="flex items-center gap-0.5" role="tablist" aria-label="Case detail tabs">
              <button
                role="tab"
                id="tab-milestones"
                aria-selected={activeTab === 'milestones'}
                aria-controls="tabpanel-milestones"
                tabIndex={activeTab === 'milestones' ? 0 : -1}
                onClick={() => setActiveTab('milestones')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setActiveTab(activeTab === 'milestones' ? 'implants' : 'milestones')
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-[7px] text-[13px] rounded-[9px] transition-all ${
                  activeTab === 'milestones'
                    ? 'font-bold text-slate-900 bg-white border border-slate-200/50 shadow-sm'
                    : 'font-medium text-slate-400 bg-transparent border border-transparent'
                }`}
              >
                Milestones
              </button>
              <button
                role="tab"
                id="tab-implants"
                aria-selected={activeTab === 'implants'}
                aria-controls="tabpanel-implants"
                tabIndex={activeTab === 'implants' ? 0 : -1}
                onClick={() => setActiveTab('implants')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setActiveTab(activeTab === 'milestones' ? 'implants' : 'milestones')
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-[7px] text-[13px] rounded-[9px] transition-all ${
                  activeTab === 'implants'
                    ? 'font-bold text-slate-900 bg-white border border-slate-200/50 shadow-sm'
                    : 'font-medium text-slate-400 bg-transparent border border-transparent'
                }`}
              >
                Implants
                {implantFilledCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-bold rounded bg-cyan-500/10 text-cyan-600">
                    {implantFilledCount}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT — separate content card */}
            {activeTab === 'milestones' && (
              <div role="tabpanel" id="tabpanel-milestones" aria-labelledby="tab-milestones" className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] px-5 py-5 animate-in">
                {milestoneTypes.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-medium">No milestones configured</p>
                    <p className="text-xs mt-1">Configure milestones in Settings</p>
                  </div>
                ) : (
                  <MilestoneTimelineV2
                    milestoneTypes={milestoneTypes}
                    caseMilestones={caseMilestones}
                    onRecord={recordMilestone}
                    onUndo={undoMilestone}
                    recordingMilestoneIds={recordingMilestoneIds}
                    canManage={canManage}
                    timeZone={userData.facilityTimezone}
                    caseFlags={caseFlags}
                    delayTypes={delayTypeOptions}
                    onAddDelay={handleAddDelay}
                    onRemoveDelay={handleRemoveDelay}
                    canCreateFlags={canCreateFlags}
                    currentUserId={userData.userId}
                  />
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
            )}

            {activeTab === 'implants' && (
              <div role="tabpanel" id="tabpanel-implants" aria-labelledby="tab-implants" className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] px-5 py-5 animate-in">
                {!caseData.procedure_type_id ? (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-sm font-medium">No procedure assigned</p>
                    <p className="text-xs mt-1">Assign a procedure to track implants</p>
                  </div>
                ) : !implantCategory ? (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-sm font-medium">This procedure type doesn&apos;t track implants</p>
                    <p className="text-xs mt-1">Only hip and knee procedures have implant tracking</p>
                  </div>
                ) : (
                  <ImplantSection
                    caseId={id}
                    procedureTypeId={caseData.procedure_type_id}
                    supabase={supabase}
                    readOnly={isCompleted}
                  />
                )}
              </div>
            )}

          </div>

          {/* ============ SIDEBAR ============ */}
          <div className="bg-white lg:border-l border-slate-100 lg:-mr-8 pl-5 pr-5 py-5 space-y-4 lg:space-y-5">

            {/* FLIP ROOM — surgeon's next case in a different room */}
            {flipRoom && (
              <FlipRoomCard
                caseNumber={flipRoom.caseNumber}
                roomName={flipRoom.roomName}
                procedureName={flipRoom.procedureName}
                lastMilestoneDisplayName={flipRoom.lastMilestoneDisplayName}
                lastMilestoneRecordedAt={flipRoom.lastMilestoneRecordedAt}
                calledBackAt={flipRoom.calledBackAt}
                currentTime={currentTime}
                timeZone={userData.facilityTimezone}
                onCallBack={callBackFlipRoom}
                onUndoCallBack={undoCallBackFlipRoom}
                callingBack={flipRoomCallingBack}
              />
            )}

            {/* NEXT SAME ROOM — inline note when next case is same room */}
            {!flipRoom && nextSameRoomCaseNumber && (
              <div className="bg-slate-50/50 rounded-[14px] border border-slate-100 px-4 py-2.5">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Next:</span> {nextSameRoomCaseNumber} (same room)
                </p>
              </div>
            )}

            {/* SURGEON LEFT — moved above team per user preference */}
            <div className="rounded-[14px] border border-slate-100 overflow-hidden">
              <div className="px-4 py-3">
                <h3 className="text-[13px] font-bold text-slate-900">Surgeon Status</h3>
              </div>
              <div className="px-4 pb-4">
                {!surgeonLeftAt ? (
                  <button
                    onClick={recordSurgeonLeft}
                    disabled={isCompleted || !closingStarted || patientOutRecorded || !can('milestones.manage')}
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

            {/* TEAM */}
            <div className="rounded-[14px] border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-900">Team</h3>
                <span className="text-[11.5px] text-slate-400">{assignedStaff.length + (surgeon ? 1 : 0) + (anesthesiologist ? 1 : 0)} assigned</span>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {surgeon && <TeamMember name={`Dr. ${surgeon.last_name}`} role="Surgeon" roleName="surgeon" />}
                {anesthesiologist && <TeamMember name={`Dr. ${anesthesiologist.last_name}`} role="Anesthesia" roleName="anesthesiologist" />}
                {assignedStaff.map(cs => {
                  const user = getJoinedValue(cs.users)
                  const role = getJoinedValue(cs.user_roles)
                  return (
                    <TeamMember
                      key={cs.id}
                      name={user ? `${user.first_name} ${user.last_name}` : 'Unknown'}
                      role={role?.name || 'Staff'}
                      roleName={role?.name || 'admin'}
                      onRemove={!isCompleted && can('staff.delete') ? () => removeStaff(cs.id) : undefined}
                    />
                  )
                })}

                {!isCompleted && can('staff.create') && (
                  showAddStaff ? (
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
                          const roleName = Array.isArray(s.user_roles) ? s.user_roles[0]?.name : (s.user_roles as unknown as { name?: string })?.name
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
                  )
                )}
              </div>
            </div>

            {/* CASE ACTIVITY SUMMARY */}
            <CaseActivitySummary
              completedMilestones={completedMilestones}
              totalMilestones={totalMilestoneCount}
              implantsFilled={implantFilledCount}
              implantTotal={implantCategory === 'hip' || implantCategory === 'total_hip' || implantCategory === 'knee' || implantCategory === 'total_knee' ? 4 : 0}
              delayCount={caseFlags.filter(f => f.flag_type === 'delay').length}
              flagCount={caseFlags.filter(f => f.flag_type === 'threshold').length}
            />

            {/* NOTES */}
            {caseData.notes && (
              <div className="rounded-[14px] border border-slate-100 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-slate-700">{caseData.notes}</p>
              </div>
            )}

          </div>
        </div>
      </div>

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