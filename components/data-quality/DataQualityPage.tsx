'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layouts/DashboardLayout'

import { dataQualityAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { AlertTriangle, Check, Clock, RefreshCw, X } from 'lucide-react'
import SummaryRow from './SummaryRow'
import ScanProgress from './ScanProgress'
import FilterBar from './FilterBar'
import IssuesTable from './IssuesTable'
import ReviewDrawer from './ReviewDrawer'
import MilestoneTimeline, { type EditableMilestone } from './MilestoneTimeline'
import {
  fetchMetricIssues,
  fetchIssueTypes,
  fetchResolutionTypes,
  calculateDataQualitySummary,
  resolveIssue,
  resolveMultipleIssues,
  runDetectionForFacility,
  expireOldIssues,
  METRIC_REQUIREMENTS,
  type MetricIssue,
  type IssueType,
  type ResolutionType,
  type DataQualitySummary
} from '@/lib/dataQuality'

// ============================================
// TYPES
// ============================================

interface CaseIssue {
  id: string
  issue_type: IssueType
  facility_milestone_name: string | null
  facility_milestone_display_name: string | null
  detected_value: number | null
  resolved: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================


// LocalStorage key for last scan time
const LAST_SCAN_KEY = 'orbit_data_quality_last_scan'

function getStoredLastScan(): Date | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(LAST_SCAN_KEY)
  if (stored) {
    const date = new Date(stored)
    if (!isNaN(date.getTime())) return date
  }
  return null
}

function storeLastScan(date: Date): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SCAN_KEY, date.toISOString())
}

// ============================================
// MAIN COMPONENT
// ============================================

const log = logger('DataQualityPage')

export default function DataQualityPage() {
  const supabase = createClient()
  const { loading: userLoading, effectiveFacilityId } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get current user ID from auth
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getUserId()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Data state
  const [issues, setIssues] = useState<MetricIssue[]>([])
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([])
  const [resolutionTypes, setResolutionTypes] = useState<ResolutionType[]>([])
  const [summary, setSummary] = useState<DataQualitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  // Filter state
  const [filterType, setFilterType] = useState<string>('all')
  const [showResolved, setShowResolved] = useState(false)
  const filterCaseId = searchParams.get('caseId') || null

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    issue: MetricIssue | null
    isBulk: boolean
    bulkIds: string[]
  }>({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })

  // All issues for the current case (for multi-issue handling)
  const [caseIssues, setCaseIssues] = useState<CaseIssue[]>([])

  // Set of milestone IDs that have issues (for highlighting)
  const [issueMilestoneIds, setIssueMilestoneIds] = useState<Set<string>>(new Set())

  // Editable milestones for modal
  const [editableMilestones, setEditableMilestones] = useState<EditableMilestone[]>([])
  const [loadingMilestones, setLoadingMilestones] = useState(false)

  // Impact analysis
  const [impact, setImpact] = useState<{ canCalculate: string[]; cannotCalculate: string[] }>({
    canCalculate: [],
    cannotCalculate: []
  })

  // Validation warning
  const [showValidationWarning, setShowValidationWarning] = useState(false)
  const [missingMilestones, setMissingMilestones] = useState<string[]>([])
  const [affectedMetrics, setAffectedMetrics] = useState<string[]>([])

  const [resolutionNotes, setResolutionNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Detection state
  const [runningDetection, setRunningDetection] = useState(false)
  const [detectionResult, setDetectionResult] = useState<string | null>(null)
  const [detectionStep, setDetectionStep] = useState(0)
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)

  // Derive case number from loaded issues when filtered by caseId
  const filterCaseNumber = useMemo(() => {
    if (!filterCaseId || issues.length === 0) return null
    const firstIssue = issues[0]
    const cases = firstIssue.cases as { case_number?: string } | null
    return cases?.case_number || filterCaseId.slice(0, 8)
  }, [filterCaseId, issues])

  // Load last scan time from localStorage on mount
  useEffect(() => {
    setLastScanTime(getStoredLastScan())
  }, [])

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)

    const [issuesData, typesData, resTypesData, summaryData] = await Promise.all([
      fetchMetricIssues(supabase, effectiveFacilityId, {
        unresolvedOnly: !showResolved,
        issueTypeName: filterType !== 'all' ? filterType : undefined,
        caseId: filterCaseId || undefined,
        limit: 100
      }),
      fetchIssueTypes(supabase),
      fetchResolutionTypes(supabase),
      calculateDataQualitySummary(supabase, effectiveFacilityId)
    ])

    setIssues(issuesData)
    setIssueTypes(typesData)
    setResolutionTypes(resTypesData.filter(rt => rt.name !== 'expired'))
    setSummary(summaryData)
    setSelectedIds(new Set())
    setLoading(false)
  }, [effectiveFacilityId, showResolved, filterType, filterCaseId, supabase])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      loadData()
    }
  }, [userLoading, effectiveFacilityId, loadData])

  // ============================================
  // MODAL - LOAD ALL MILESTONES FOR CASE
  // ============================================

  const loadAllMilestonesForCase = async (
    caseId: string
  ) => {
    setLoadingMilestones(true)

    try {
      // 1. Get milestones FOR THIS SPECIFIC CASE (without join to avoid RLS issues)
      const { data: caseMilestones, error: cmError } = await supabase
        .from('case_milestones')
        .select('id, recorded_at, facility_milestone_id')
        .eq('case_id', caseId)

      if (cmError) {
        showToast({
          type: 'error',
          title: 'Error loading case milestones:',
          message: cmError.message || 'Error loading case milestones'
        })
      }

      // 2. Get unique facility_milestone_ids to look up
      const facilityMilestoneIds = [...new Set(
        caseMilestones?.map(cm => cm.facility_milestone_id).filter(Boolean) || []
      )]

      // 3. Fetch facility_milestones separately (bypasses join RLS issues)
      let facilityMilestones: Array<{
        id: string
        name: string
        display_name: string
        display_order: number
        pair_with_id: string | null
      }> = []

      if (facilityMilestoneIds.length > 0) {
        const { data: fmData, error: fmError } = await supabase
          .from('facility_milestones')
          .select('id, name, display_name, display_order, pair_with_id')
          .in('id', facilityMilestoneIds)

        if (fmError) {
          showToast({
            type: 'error',
            title: 'Error loading facility_milestones:',
            message: fmError.message || 'Error loading facility_milestones'
          })
        } else {
          facilityMilestones = fmData || []
        }
      }

      // Create lookup map for facility_milestones
      const fmLookup = new Map(facilityMilestones.map(fm => [fm.id, fm]))

      // 4. Get ALL unresolved issues for this case
      const { data: allCaseIssues, error: issuesError } = await supabase
        .from('metric_issues')
        .select('facility_milestone_id, issue_type_id, issue_types(name)')
        .eq('case_id', caseId)
        .is('resolved_at', null)

      if (issuesError) {
        showToast({
  type: 'error',
  title: 'Error loading case issues:',
  message: `Error loading case issues: ${issuesError}`
})
      }

      // Also fetch facility_milestones for issues (might have some not in case_milestones)
      const issueFmIds = [...new Set(
        allCaseIssues?.map(i => i.facility_milestone_id).filter(Boolean) || []
      )].filter(id => !fmLookup.has(id))

      if (issueFmIds.length > 0) {
        const { data: issueFmData } = await supabase
          .from('facility_milestones')
          .select('id, name, display_name, display_order, pair_with_id')
          .in('id', issueFmIds)

        issueFmData?.forEach(fm => fmLookup.set(fm.id, fm))
      }

      // Build set of milestone IDs that have issues and their types
      const localIssueMilestoneIds = new Set<string>()
      const issueMilestoneTypes = new Map<string, string>() // milestone_id -> issue_type
      allCaseIssues?.forEach(issue => {
        if (issue.facility_milestone_id) {
          localIssueMilestoneIds.add(issue.facility_milestone_id)
          const issueTypeName = Array.isArray(issue.issue_types)
            ? issue.issue_types[0]?.name
            : (issue.issue_types as { name: string } | null)?.name
          if (issueTypeName) {
            issueMilestoneTypes.set(issue.facility_milestone_id, issueTypeName)
          }
        }
      })

      // Build milestone map from case_milestones
      const milestoneMap = new Map<string, {
        id: string
        name: string
        display_name: string
        display_order: number
        pair_with_id: string | null
        recorded_at: string | null
        isFromCase: boolean
      }>()

      caseMilestones?.forEach(cm => {
        if (cm.facility_milestone_id) {
          const fm = fmLookup.get(cm.facility_milestone_id)
          if (fm) {
            milestoneMap.set(cm.facility_milestone_id, {
              id: cm.facility_milestone_id,
              name: fm.name,
              display_name: fm.display_name,
              display_order: fm.display_order || 0,
              pair_with_id: fm.pair_with_id || null,
              recorded_at: cm.recorded_at,
              isFromCase: true
            })
          }
        }
      })

      // Add missing milestones from issues (they won't be in case_milestones yet)
      allCaseIssues?.forEach(issue => {
        if (issue.facility_milestone_id && !milestoneMap.has(issue.facility_milestone_id)) {
          const fm = fmLookup.get(issue.facility_milestone_id)

          if (fm) {
            milestoneMap.set(issue.facility_milestone_id, {
              id: issue.facility_milestone_id,
              name: fm.name,
              display_name: fm.display_name,
              display_order: fm.display_order || 0,
              pair_with_id: fm.pair_with_id || null,
              recorded_at: null, // Not recorded - that's why it's an issue
              isFromCase: false // Added from issues, not from case_milestones
            })
          }
        }
      })

      // Convert map to sorted array
      const milestoneList = Array.from(milestoneMap.values())
        .sort((a, b) => a.display_order - b.display_order)

      // Determine which milestones can be EDITED based on ALL issues for this case
      const editableMilestoneIds = new Set<string>()

      // Add all milestones that have issues (and their pairs for duration issues)
      allCaseIssues?.forEach(issue => {
        if (issue.facility_milestone_id) {
          editableMilestoneIds.add(issue.facility_milestone_id)

          const issueTypeName = Array.isArray(issue.issue_types)
            ? issue.issue_types[0]?.name
            : (issue.issue_types as { name: string } | null)?.name

          // For duration issues, also add the paired milestone
          if (issueTypeName === 'too_fast' || issueTypeName === 'timeout' || issueTypeName === 'impossible') {
            const fm = milestoneMap.get(issue.facility_milestone_id)
            if (fm?.pair_with_id) {
              editableMilestoneIds.add(fm.pair_with_id)
            }
            // Also check reverse pairing
            milestoneList.forEach(otherFm => {
              if (otherFm.pair_with_id === issue.facility_milestone_id) {
                editableMilestoneIds.add(otherFm.id)
              }
            })
          }
        }
      })

      // Build the editable milestone list — all milestones are editable
      const editable: EditableMilestone[] = milestoneList.map(fm => {
        return {
          id: fm.id,
          name: fm.name,
          display_name: fm.display_name,
          display_order: fm.display_order,
          pair_with_id: fm.pair_with_id,
          recorded_at: fm.recorded_at,
          original_recorded_at: fm.recorded_at,
          isEditing: false,
          hasChanged: false,
          canEdit: true,
          isFromCase: fm.isFromCase
        }
      })

      setEditableMilestones(editable)

      // Store which milestones have issues for highlighting
      setIssueMilestoneIds(localIssueMilestoneIds)

      // Calculate initial impact
      const newImpact = calculateImpact(editable)
      setImpact(newImpact)

    } catch (err) {
      showToast({
  type: 'error',
  title: 'Error in loadAllMilestonesForCase:',
  message: err instanceof Error ? err.message : 'Error in loadAllMilestonesForCase:'
})
    }

    setLoadingMilestones(false)
  }

  // Load all issues for a case (for multi-issue handling)
  const loadCaseIssues = async (caseId: string) => {
    const { data, error } = await supabase
      .from('metric_issues')
      .select(`
        id,
        resolved_at,
        detected_value,
        issue_types(name, display_name),
        facility_milestones(name, display_name)
      `)
      .eq('case_id', caseId)
      .is('resolved_at', null)

    if (error) {
      showToast({
        type: 'error',
        title: 'Error loading case issues:',
        message: error.message || 'Error loading case issues'
      })
      return
    }

    const loadedIssues: CaseIssue[] = (data || []).map(d => {
      const issueType = Array.isArray(d.issue_types) ? d.issue_types[0] : d.issue_types
      const fm = Array.isArray(d.facility_milestones) ? d.facility_milestones[0] : d.facility_milestones

      return {
        id: d.id,
        issue_type: issueType as IssueType,
        facility_milestone_name: fm?.name || null,
        facility_milestone_display_name: fm?.display_name || null,
        detected_value: d.detected_value,
        resolved: !!d.resolved_at
      }
    })

    setCaseIssues(loadedIssues)
  }

  // ============================================
  // IMPACT CALCULATION
  // ============================================

  const calculateImpact = (milestones: EditableMilestone[]) => {
    // Only consider milestones that are part of the actual case (not issue-injected ones)
    const caseMilestoneNames = new Set(
      milestones.filter(m => m.isFromCase).map(m => m.name)
    )
    const recordedNames = new Set(
      milestones.filter(m => m.recorded_at).map(m => m.name)
    )

    const canCalculate: string[] = []
    const cannotCalculate: string[] = []

    Object.values(METRIC_REQUIREMENTS).forEach((config) => {
      // Only show metrics whose required milestones are actual case milestones
      const allRequirementsExist = config.requires.every(req => caseMilestoneNames.has(req))
      if (!allRequirementsExist) return // Skip — not part of this case's milestone set

      const hasAll = config.requires.every(req => recordedNames.has(req))
      if (hasAll) {
        canCalculate.push(config.name)
      } else {
        cannotCalculate.push(config.name)
      }
    })

    return { canCalculate, cannotCalculate }
  }

  // Update impact when milestones change
  useEffect(() => {
    if (editableMilestones.length > 0) {
      const newImpact = calculateImpact(editableMilestones)
      setImpact(newImpact)
    }
  }, [editableMilestones])

  // ============================================
  // DETECTION
  // ============================================

  const handleRunDetection = async () => {
    if (!effectiveFacilityId) return

    setRunningDetection(true)
    setDetectionResult(null)
    setDetectionStep(1)

    // Expire old issues first
    const expiredCount = await expireOldIssues(supabase)

    setDetectionStep(2)
    const stepTimer = setInterval(() => {
      setDetectionStep(prev => Math.min(prev + 1, 6))
    }, 800)

    const result = await runDetectionForFacility(supabase, effectiveFacilityId, 7)

    clearInterval(stepTimer)
    setDetectionStep(7)

    await new Promise(resolve => setTimeout(resolve, 500))

    const now = new Date()
    setLastScanTime(now)
    storeLastScan(now)

    // Reload data to get actual current counts
    await loadData()

    // Get the actual unresolved count from the refreshed summary
    const updatedSummary = await calculateDataQualitySummary(supabase, effectiveFacilityId)

    setDetectionResult(`Scanned ${result.casesChecked} cases · ${updatedSummary.totalUnresolved} open issues${expiredCount ? ` · Expired ${expiredCount}` : ''}`)

    await dataQualityAudit.detectionRun(
      supabase,
      effectiveFacilityId,
      7,
      result.issuesFound,
      expiredCount || 0
    )

    setRunningDetection(false)
    setDetectionStep(0)
  }

  // ============================================
  // MILESTONE EDITING
  // ============================================

  const updateMilestoneTime = (index: number, newTime: string) => {
    setEditableMilestones(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        recorded_at: newTime || null,
        hasChanged: newTime !== updated[index].original_recorded_at
      }
      return updated
    })
  }

  const toggleMilestoneEdit = (index: number) => {
    setEditableMilestones(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        isEditing: !updated[index].isEditing
      }
      return updated
    })
  }

  // ============================================
  // VALIDATION
  // ============================================

  const handleValidate = async () => {
    if (!modalState.issue) return

    // Check for still-missing REQUIRED milestones
    const stillMissing = editableMilestones
      .filter(m => !m.recorded_at)
      .map(m => m.display_name)

    // Calculate which metrics would be affected
    const newImpact = calculateImpact(editableMilestones)

    // Only show warning if there are metrics that cannot be calculated
    if (newImpact.cannotCalculate.length > 0) {
      setMissingMilestones(stillMissing)
      setAffectedMetrics(newImpact.cannotCalculate)
      setShowValidationWarning(true)
      return
    }

    // No warning needed, proceed
    await saveAndResolve('approved')
  }

  const handleContinueAnyway = async () => {
    setShowValidationWarning(false)
    await saveAndResolve('approved')
  }

  const handleExclude = async () => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return

    // Set is_excluded_from_metrics on the case
    await supabase
      .from('cases')
      .update({ is_excluded_from_metrics: true })
      .eq('id', modalState.issue.case_id)

    await saveAndResolve('excluded')
  }

  // ============================================
  // STALE CASE HELPERS
  // ============================================

  const STALE_ISSUE_TYPES = ['stale_in_progress', 'abandoned_scheduled', 'no_activity']

  const isStaleCase = (): boolean => {
    const issueTypeName = (modalState.issue?.issue_type as IssueType)?.name
    return STALE_ISSUE_TYPES.includes(issueTypeName || '')
  }

  const getStaleCaseDetails = (): { hours_elapsed?: number; days_overdue?: number; last_activity?: string } | null => {
    if (!modalState.issue) return null
    try {
      const detectedValue = modalState.issue.detected_value
      if (typeof detectedValue === 'string') {
        return JSON.parse(detectedValue) as Record<string, unknown>
      }
      return detectedValue as Record<string, unknown> | null
    } catch {
      return null
    }
  }

  const handleMarkCompleted = async () => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return

    setSaving(true)

    // Get completed status ID
    const { data: completedStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (completedStatus) {
      // Update case status to completed
      await supabase
        .from('cases')
        .update({
          status_id: completedStatus.id,
          data_validated: false // Will need review for missing milestones
        })
        .eq('id', modalState.issue.case_id)
    }

    // Resolve the stale issue
    await resolveIssue(
      supabase,
      modalState.issue.id,
      currentUserId,
      'approved',
      'Case marked as completed'
    )

    // Audit log
    await dataQualityAudit.issueResolved(
      supabase,
      modalState.issue.id,
      (modalState.issue.issue_type as IssueType)?.name || 'unknown',
      modalState.issue.cases?.case_number || 'unknown',
      'approved',
      effectiveFacilityId,
      'Case marked as completed'
    )

    closeModal()
    setSaving(false)
    await loadData()
  }

  const handleMarkCancelled = async () => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return

    setSaving(true)

    // Get cancelled status ID
    const { data: cancelledStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'cancelled')
      .single()

    if (cancelledStatus) {
      // Update case status to cancelled and exclude from metrics
      await supabase
        .from('cases')
        .update({
          status_id: cancelledStatus.id,
          is_excluded_from_metrics: true,
          data_validated: true // Cancelled = reviewed and excluded
        })
        .eq('id', modalState.issue.case_id)
    }

    // Resolve the stale issue
    await resolveIssue(
      supabase,
      modalState.issue.id,
      currentUserId,
      'excluded',
      'Case marked as cancelled'
    )

    // Audit log
    await dataQualityAudit.issueResolved(
      supabase,
      modalState.issue.id,
      (modalState.issue.issue_type as IssueType)?.name || 'unknown',
      modalState.issue.cases?.case_number || 'unknown',
      'excluded',
      effectiveFacilityId,
      'Case marked as cancelled'
    )

    closeModal()
    setSaving(false)
    await loadData()
  }

  const saveAndResolve = async (resolutionType: 'approved' | 'excluded') => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return

    setSaving(true)

    // Save any changed milestones
    const changedMilestones = editableMilestones.filter(m => m.hasChanged && m.recorded_at)

    for (const milestone of changedMilestones) {
      // Skip if no milestone id
      if (!milestone.id) continue

      // Check if milestone exists
      const { data: existing } = await supabase
        .from('case_milestones')
        .select('id')
        .eq('case_id', modalState.issue.case_id)
        .eq('facility_milestone_id', milestone.id)
        .single()

      if (existing) {
        // Update existing
        await supabase
          .from('case_milestones')
          .update({
            recorded_at: milestone.recorded_at,
            recorded_by: currentUserId
          })
          .eq('id', existing.id)
      } else {
        // Insert new milestone row with facility_milestone_id
        await supabase
          .from('case_milestones')
          .insert({
            case_id: modalState.issue.case_id,
            facility_milestone_id: milestone.id,
            recorded_at: milestone.recorded_at,
            recorded_by: currentUserId
          })
      }
    }

    // Resolve ALL unresolved issues for this case (multi-issue handling)
    for (const caseIssue of caseIssues) {
      if (!caseIssue.resolved) {
        await resolveIssue(
          supabase,
          caseIssue.id,
          currentUserId,
          resolutionType,
          resolutionNotes || undefined
        )
      }
    }

    // Also resolve the current issue if not in caseIssues
    const currentIssueResolved = caseIssues.some(ci => ci.id === modalState.issue!.id)
    if (!currentIssueResolved) {
      await resolveIssue(
        supabase,
        modalState.issue.id,
        currentUserId,
        resolutionType,
        resolutionNotes || undefined
      )
    }

    // ============================================
    // MARK CASE AS VALIDATED + AUTO-COMPLETE
    // Now that all issues are resolved, this case's
    // data is approved for inclusion in analytics.
    // If still in_progress, move to completed.
    // ============================================
    if (modalState.issue.case_id) {
      const updatePayload: Record<string, unknown> = {
        data_validated: true,
        validated_at: new Date().toISOString(),
        validated_by: currentUserId
      }

      // Auto-complete in-progress cases on validation or exclusion
      const { data: caseData } = await supabase
        .from('cases')
        .select('status_id, case_statuses(name)')
        .eq('id', modalState.issue.case_id)
        .single()

      const statusName = Array.isArray(caseData?.case_statuses)
        ? caseData.case_statuses[0]?.name
        : (caseData?.case_statuses as unknown as { name: string } | null)?.name

      if (statusName === 'in_progress') {
        const { data: completedStatus } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'completed')
          .single()

        if (completedStatus) {
          updatePayload.status_id = completedStatus.id
        }
      }

      const { error: updateError } = await supabase
        .from('cases')
        .update(updatePayload)
        .eq('id', modalState.issue.case_id)

      if (updateError) {
        log.error('Failed to update case after validation', {
          caseId: modalState.issue.case_id,
          error: updateError.message,
          payload: updatePayload,
        })
        // If the combined update failed (e.g. trigger conflict), retry with just validation fields
        if (updatePayload.status_id) {
          const { status_id: _dropped, ...validationOnly } = updatePayload
          await supabase
            .from('cases')
            .update(validationOnly)
            .eq('id', modalState.issue.case_id)
          // Then try the status change separately
          await supabase
            .from('cases')
            .update({ status_id: updatePayload.status_id })
            .eq('id', modalState.issue.case_id)
        }
      }
    }

    // Audit log
    await dataQualityAudit.issueResolved(
      supabase,
      modalState.issue.id,
      (modalState.issue.issue_type as IssueType)?.name || 'unknown',
      modalState.issue.cases?.case_number || 'unknown',
      resolutionType,
      effectiveFacilityId,
      resolutionNotes || undefined
    )

    closeModal()
    setSaving(false)
    await loadData()
  }

  // Bulk resolve
  const handleBulkExclude = async () => {
    if (!currentUserId || !effectiveFacilityId || modalState.bulkIds.length === 0) return

    setSaving(true)

    // Get case IDs for all selected issues and mark them excluded
    const { data: issueCases } = await supabase
      .from('metric_issues')
      .select('case_id')
      .in('id', modalState.bulkIds)

    const caseIds = [...new Set(issueCases?.map(ic => ic.case_id) || [])]

    // Mark all cases as excluded AND validated (reviewed but excluded)
    if (caseIds.length > 0) {
      await supabase
        .from('cases')
        .update({
          is_excluded_from_metrics: true,
          data_validated: true,  // Marked as reviewed
          validated_at: new Date().toISOString(),
          validated_by: currentUserId
        })
        .in('id', caseIds)
    }

    await resolveMultipleIssues(
      supabase,
      modalState.bulkIds,
      currentUserId,
      'excluded',
      resolutionNotes
    )

    await dataQualityAudit.bulkResolved(
      supabase,
      modalState.bulkIds.length,
      'excluded',
      effectiveFacilityId,
      resolutionNotes || undefined
    )

    closeModal()
    setSaving(false)
    await loadData()
  }

  // ============================================
  // MODAL CONTROLS
  // ============================================

  const openModal = async (issue: MetricIssue) => {
    setModalState({ isOpen: true, issue, isBulk: false, bulkIds: [] })
    setResolutionNotes('')
    setShowValidationWarning(false)
    setMissingMilestones([])
    setAffectedMetrics([])
    setCaseIssues([])

    // Load all issues for this case
    await loadCaseIssues(issue.case_id)

    // Load all milestones - pass the facility_milestone_id for pairing logic
    await loadAllMilestonesForCase(issue.case_id)
  }

  const openBulkModal = (ids: string[]) => {
    setModalState({ isOpen: true, issue: null, isBulk: true, bulkIds: ids })
    setResolutionNotes('')
    setEditableMilestones([])
    setCaseIssues([])
  }

  const closeModal = () => {
    setModalState({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })
    setEditableMilestones([])
    setShowValidationWarning(false)
    setCaseIssues([])
    setIssueMilestoneIds(new Set())
  }

  const openCaseInNewTab = () => {
    if (!modalState.issue?.case_id) return
    const caseId = modalState.issue.case_id
    closeModal()
    window.open(`/cases/${caseId}`, '_blank')
  }

  // ============================================
  // HELPERS
  // ============================================

  const getIssueMilestoneId = (): string | null => {
    return modalState.issue?.facility_milestone_id || null
  }

  // Check if issue can be considered "stale" (milestone now exists)
  const isIssueStale = () => {
    if (!modalState.issue) return false

    const issueType = (modalState.issue.issue_type as IssueType)?.name
    if (issueType !== 'missing') return false

    const issueMilestoneId = getIssueMilestoneId()
    if (!issueMilestoneId) return false

    const milestone = editableMilestones.find(m => m.id === issueMilestoneId)
    if (!milestone) return false

    return milestone.recorded_at !== null && !milestone.hasChanged
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <DashboardLayout>
        {/* Header */}
        <div className="flex items-center justify-between py-6 border-b border-slate-200 mb-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Data Quality</h1>
            </div>
            <p className="text-[13px] text-slate-500">
              Monitor and resolve data integrity issues across surgical cases
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Scan status indicator */}
            {lastScanTime && (() => {
              const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
              const isCurrent = lastScanTime > hourAgo

              return (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-[7px] h-[7px] rounded-full ${isCurrent ? 'bg-green-600' : 'bg-amber-500'}`}
                    style={{ boxShadow: isCurrent ? '0 0 6px rgba(5,150,105,0.25)' : '0 0 6px rgba(217,119,6,0.25)' }}
                  />
                  <span className="text-xs text-slate-500">
                    {lastScanTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {' · '}
                    {lastScanTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )
            })()}

            {/* Run Detection button */}
            <button
              onClick={handleRunDetection}
              disabled={runningDetection}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-60 disabled:cursor-default text-white shadow-md hover:shadow-lg"
              style={{
                background: runningDetection
                  ? '#F5F5F4'
                  : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: runningDetection ? '#78716C' : 'white',
                boxShadow: runningDetection ? 'none' : '0 2px 8px rgba(37,99,235,0.19)',
              }}
            >
              {runningDetection ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Detection
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inline scan progress */}
        {runningDetection && <ScanProgress step={detectionStep} />}

        {/* Detection result banner */}
        {detectionResult && !runningDetection && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 animate-in">
            {detectionResult}
          </div>
        )}

        {loading ? (
          <div data-testid="loading-skeleton" className="space-y-4">
            {/* Summary skeleton */}
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
                  <div className="h-7 bg-slate-200 rounded w-16" />
                </div>
              ))}
            </div>
            {/* Filter bar skeleton */}
            <div className="bg-white border border-slate-200 rounded-[10px] px-4 py-3 animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-7 bg-slate-200 rounded w-32" />
                <div className="h-4 bg-slate-200 rounded w-24" />
              </div>
              <div className="h-3 bg-slate-200 rounded w-20" />
            </div>
            {/* Table skeleton */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50 animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-full max-w-md" />
              </div>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="px-4 py-3 border-b border-stone-100 animate-pulse flex items-center gap-4">
                  <div className="w-3.5 h-3.5 bg-slate-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-48" />
                    <div className="h-3 bg-slate-100 rounded w-32" />
                  </div>
                  <div className="h-5 bg-slate-200 rounded w-24" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                  <div className="h-4 bg-slate-200 rounded w-12" />
                  <div className="h-7 bg-slate-200 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Row — Quality Gauge + 3 Stat Cards */}
            <div className="stagger-item">
              {summary && <SummaryRow summary={summary} />}
            </div>

            {/* Filter Bar */}
            <div className="stagger-item">
              <FilterBar
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                showResolved={showResolved}
                onShowResolvedChange={setShowResolved}
                issueTypes={issueTypes}
                selectedCount={selectedIds.size}
                onBulkExclude={() => openBulkModal(Array.from(selectedIds))}
                caseCount={new Set(issues.map(i => i.case_id)).size}
                issueCount={issues.length}
                filterCaseId={filterCaseId}
                filterCaseNumber={filterCaseNumber}
                onClearCaseFilter={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('caseId')
                  const newUrl = params.toString()
                    ? `${window.location.pathname}?${params.toString()}`
                    : window.location.pathname
                  router.replace(newUrl)
                }}
              />
            </div>

            {/* Issues Table */}
            <div className="stagger-item">
              <IssuesTable
                issues={issues}
                issueTypes={issueTypes}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onReview={openModal}
                activeCaseId={modalState.isOpen && modalState.issue ? modalState.issue.case_id : null}
              />
            </div>
          </>
        )}

        {/* Review Drawer — single-issue overlay panel */}
        <ReviewDrawer
          isOpen={modalState.isOpen && !modalState.isBulk}
          onClose={closeModal}
          issue={modalState.issue}
          caseIssues={caseIssues}
          issueTypes={issueTypes}
          footer={
            modalState.issue && (
              <div className="flex items-center justify-between">
                <button
                  onClick={openCaseInNewTab}
                  className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] border border-blue-600/10 bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  Open Case
                </button>
                <div className="flex items-center gap-2">
                  {isStaleCase() ? (
                    <>
                      <button
                        onClick={handleMarkCancelled}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-[7px] border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving...' : 'Mark Cancelled'}
                      </button>
                      <button
                        onClick={handleMarkCompleted}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-5 py-[7px] rounded-[7px] border-none text-white text-xs font-semibold disabled:opacity-50 transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          boxShadow: '0 2px 8px rgba(5,150,105,0.19)',
                        }}
                      >
                        {saving ? 'Saving...' : 'Mark Completed'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleExclude}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-[7px] border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        Exclude
                      </button>
                      <button
                        onClick={handleValidate}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-5 py-[7px] rounded-[7px] border-none text-white text-xs font-semibold disabled:opacity-50 transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          boxShadow: '0 2px 8px rgba(5,150,105,0.19)',
                        }}
                      >
                        {saving ? 'Saving...' : 'Validate & Resolve'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          }
        >
          {/* Drawer body content — impact analysis, milestone timeline, notes, validation */}
          {modalState.issue && (
            <>
              {/* Stale Case Banner */}
              {isStaleCase() && (
                <div className="bg-orange-50 border border-orange-200 rounded-[10px] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-800">
                        {(modalState.issue.issue_type as IssueType)?.display_name || 'Stale Case'}
                      </h4>
                      <p className="text-sm text-orange-700 mt-1">
                        {(() => {
                          const details = getStaleCaseDetails()
                          const issueType = (modalState.issue!.issue_type as IssueType)?.name

                          if (issueType === 'stale_in_progress' && details?.hours_elapsed) {
                            return `This case has been in progress for ${Math.round(details.hours_elapsed)} hours without being completed.`
                          }
                          if (issueType === 'abandoned_scheduled' && details?.days_overdue) {
                            return `This case was scheduled ${details.days_overdue} days ago but was never started.`
                          }
                          if (issueType === 'no_activity') {
                            const hours = details?.hours_elapsed
                            return `No milestone activity recorded for ${hours ? Math.round(hours) : 'several'} hours.`
                          }
                          return 'This case appears to be orphaned or abandoned.'
                        })()}
                      </p>
                      <div className="mt-3 p-2 bg-orange-100 rounded-lg">
                        <p className="text-xs text-orange-800 font-medium">What would you like to do?</p>
                        <ul className="mt-1 text-xs text-orange-700 space-y-1">
                          <li>• <strong>Mark Completed</strong> — Case is done, will be reviewed for missing milestones</li>
                          <li>• <strong>Mark Cancelled</strong> — Case was cancelled, exclude from metrics</li>
                          <li>• <strong>Open Case</strong> — Review and update the case directly</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stale Issue Alert (missing type that's now recorded) */}
              {!isStaleCase() && isIssueStale() && (
                <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-green-800">Issue Already Resolved</h4>
                      <p className="text-sm text-green-600 mt-1">
                        The {modalState.issue.facility_milestone?.display_name} milestone has been recorded since this issue was detected.
                        You can validate to close this issue.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Impact Analysis - NOT shown for stale cases */}
              {!isStaleCase() && (
                <div className="bg-white border border-slate-200 rounded-[10px] p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">Impact Analysis</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cannot Calculate */}
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-red-600">Cannot Calculate</span>
                      <div className="mt-2 flex flex-col gap-1">
                        {impact.cannotCalculate.length > 0 ? (
                          impact.cannotCalculate.map(metric => (
                            <div key={metric} className="flex items-center gap-1.5">
                              <X className="w-3 h-3 text-red-600 flex-shrink-0" />
                              <span className="text-xs font-medium text-red-900">{metric}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-green-600 font-medium">All metrics available</span>
                        )}
                      </div>
                    </div>
                    {/* Can Calculate */}
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-green-600">Can Calculate</span>
                      <div className="mt-2 flex flex-col gap-1">
                        {impact.canCalculate.length > 0 ? (
                          impact.canCalculate.map(metric => (
                            <div key={metric} className="flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-xs font-medium text-green-900">{metric}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No metrics available</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Milestone Timeline - NOT shown for stale cases */}
              {!isStaleCase() && (
                <div className="bg-white border border-slate-200 rounded-[10px] p-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 mb-3">Milestone Timeline</h4>
                  <MilestoneTimeline
                    milestones={editableMilestones}
                    issueMilestoneIds={issueMilestoneIds}
                    loading={loadingMilestones}
                    onToggleEdit={toggleMilestoneEdit}
                    onTimeChange={updateMilestoneTime}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Resolution Notes <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add context about this resolution..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[13px]"
                />
              </div>

              {/* Validation Warning Overlay */}
              {showValidationWarning && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-[10px] p-5">
                  <h4 className="text-base font-semibold text-amber-800 mb-3">Missing Milestones</h4>
                  {missingMilestones.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-amber-700 mb-2">The following milestones are still not recorded:</p>
                      <div className="bg-amber-100 rounded-lg p-3">
                        {missingMilestones.map(m => (
                          <div key={m} className="flex items-center gap-2 text-sm text-amber-800">
                            <AlertTriangle className="w-4 h-4" />
                            {m}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-amber-700 mb-2">The following metrics will <strong>NOT</strong> be saved to analytics:</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    {affectedMetrics.map(m => (
                      <div key={m} className="flex items-center gap-2 text-sm text-red-600">
                        <X className="w-4 h-4 text-red-600" />
                        {m}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowValidationWarning(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleContinueAnyway}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                      Continue Anyway
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </ReviewDrawer>

        {/* Bulk Exclude Modal — center-screen modal for bulk operations */}
        {modalState.isOpen && modalState.isBulk && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 rounded-xl shadow-xl max-w-lg w-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white rounded-t-xl">
                <h3 className="text-lg font-semibold text-slate-900">Bulk Exclude Issues</h3>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Exclude from Metrics</h4>
                  <p className="text-sm text-red-600">
                    {(() => {
                      const caseCount = new Set(
                        issues.filter(i => modalState.bulkIds.includes(i.id)).map(i => i.case_id)
                      ).size
                      return `You are about to exclude ${caseCount} ${caseCount === 1 ? 'case' : 'cases'} (${modalState.bulkIds.length} ${modalState.bulkIds.length === 1 ? 'issue' : 'issues'}) from all analytics calculations.`
                    })()}
                    {' '}This action marks the issues as resolved but removes the cases from aggregate metrics.
                  </p>
                  <div className="mt-3">
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Add notes (optional)..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white rounded-b-xl">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkExclude}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {saving ? 'Excluding...' : (() => {
                    const caseCount = new Set(
                      issues.filter(i => modalState.bulkIds.includes(i.id)).map(i => i.case_id)
                    ).size
                    return `Exclude ${caseCount} ${caseCount === 1 ? 'Case' : 'Cases'}`
                  })()}
                </button>
              </div>
            </div>
          </div>
        )}
    </DashboardLayout>
  )
}
