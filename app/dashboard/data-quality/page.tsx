'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { dataQualityAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import {
  fetchMetricIssues,
  fetchIssueTypes,
  fetchResolutionTypes,
  calculateDataQualitySummary,
  resolveIssue,
  resolveMultipleIssues,
  runDetectionForFacility,
  expireOldIssues,
  formatTimeAgo,
  getDaysUntilExpiration,
  type MetricIssue,
  type IssueType,
  type ResolutionType,
  type DataQualitySummary
} from '@/lib/dataQuality'

// ============================================
// CONSTANTS
// ============================================

// What metrics require which milestones
const METRIC_REQUIREMENTS: Record<string, { name: string; requires: string[] }> = {
  case_count: {
    name: 'Case Count',
    requires: [] // Always calculable - just counting the case
  },
  total_case_time: {
    name: 'Total Case Time',
    requires: ['patient_in', 'patient_out']
  },
  fcots: {
    name: 'First Case On-Time Start (FCOTS)',
    requires: ['patient_in']
  },
  surgical_time: {
    name: 'Surgical Time',
    requires: ['incision', 'closing']
  },
  anesthesia_duration: {
    name: 'Anesthesia Duration',
    requires: ['anes_start', 'anes_end']
  },
  room_turnover: {
    name: 'Room Turnover Time',
    requires: ['patient_out', 'room_cleaned']
  },
  pre_incision_time: {
    name: 'Pre-Incision Time',
    requires: ['patient_in', 'incision']
  },
  closing_time: {
    name: 'Closing Duration',
    requires: ['closing', 'closing_complete']
  },
  emergence_time: {
    name: 'Emergence Time',
    requires: ['closing_complete', 'patient_out']
  }
}

// ============================================
// TYPES
// ============================================

interface EditableMilestone {
  id?: string // facility_milestone_id
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null // Dynamic pairing from database
  recorded_at: string | null
  original_recorded_at: string | null
  isEditing: boolean
  hasChanged: boolean
  canEdit: boolean // Based on issue type and pairs
}

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

// Severity color with BLACK text
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'error': return 'bg-red-100 text-slate-900 border-red-200'
    case 'warning': return 'bg-amber-100 text-slate-900 border-amber-200'
    case 'info': return 'bg-blue-100 text-slate-900 border-blue-200'
    default: return 'bg-slate-100 text-slate-900 border-slate-200'
  }
}

function formatIssueDescription(issue: MetricIssue): string {
  const issueType = issue.issue_type as IssueType | null
  const typeName = issueType?.name || ''
  
  if (typeName === 'missing') {
    return 'Not recorded'
  }
  
  if (issue.detected_value !== null) {
    const value = Math.round(issue.detected_value)
    const details = issue.details as Record<string, unknown> | null
    
    if (typeName === 'too_fast' || typeName === 'timeout') {
      const min = issue.expected_min ? `${Math.round(issue.expected_min)}` : '—'
      const max = issue.expected_max ? `${Math.round(issue.expected_max)}` : '—'
      return `${value} min (expected ${min}–${max} min)`
    }
    
    if (typeName === 'impossible') {
      const prevMilestone = details?.previous_milestone as string
      return `Recorded ${Math.abs(value)} min before ${prevMilestone || 'previous milestone'}`
    }
    
    if (typeName === 'stale') {
      return `${value} days overdue`
    }
    
    if (typeName === 'incomplete') {
      return `No activity for ${Math.round(value)} hours`
    }
    
    return `${value}`
  }
  
  return 'Review required'
}

function formatTimeWithSeconds(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return isoString
  }
}

function formatFullDateTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return isoString
  }
}

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

export default function DataQualityPage() {
  const supabase = createClient()
  const { loading: userLoading, effectiveFacilityId } = useUser()
  
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

  // Filter state
  const [filterType, setFilterType] = useState<string>('all')
  const [showResolved, setShowResolved] = useState(false)

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
  }, [effectiveFacilityId, showResolved, filterType, supabase])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      loadData()
    }
  }, [userLoading, effectiveFacilityId, loadData])

  // ============================================
  // MODAL - LOAD ALL MILESTONES FOR CASE
  // ============================================

  const loadAllMilestonesForCase = async (
    caseId: string, 
    facilityId: string,
    issueType: string,
    issueFacilityMilestoneId: string | null
  ) => {
    setLoadingMilestones(true)
    
    try {
      // 1. Get milestones FOR THIS SPECIFIC CASE with facility_milestone details
      const { data: caseMilestones, error: cmError } = await supabase
        .from('case_milestones')
        .select(`
          id,
          recorded_at,
          facility_milestone_id,
          facility_milestones(id, name, display_name, display_order, pair_with_id)
        `)
        .eq('case_id', caseId)
      
      if (cmError) {
        console.error('Error loading case milestones:', cmError)
      }
      
      // 2. Get ALL unresolved issues for this case to know which milestones have problems
      const { data: allCaseIssues, error: issuesError } = await supabase
        .from('metric_issues')
        .select(`
          facility_milestone_id, 
          issue_types(name),
          facility_milestones(id, name, display_name, display_order, pair_with_id)
        `)
        .eq('case_id', caseId)
        .is('resolved_at', null)
      
      if (issuesError) {
        console.error('Error loading case issues:', issuesError)
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
      
      // Build milestone map from case_milestones (recorded milestones)
      const milestoneMap = new Map<string, {
        id: string
        name: string
        display_name: string
        display_order: number
        pair_with_id: string | null
        recorded_at: string | null
      }>()
      
      caseMilestones?.forEach(cm => {
        const fm = Array.isArray(cm.facility_milestones) 
          ? cm.facility_milestones[0] 
          : cm.facility_milestones
        
        if (fm && cm.facility_milestone_id) {
          milestoneMap.set(cm.facility_milestone_id, {
            id: cm.facility_milestone_id,
            name: fm.name,
            display_name: fm.display_name,
            display_order: fm.display_order || 0,
            pair_with_id: fm.pair_with_id || null,
            recorded_at: cm.recorded_at
          })
        }
      })
      
      // Add missing milestones from issues (they won't be in case_milestones)
      allCaseIssues?.forEach(issue => {
        if (issue.facility_milestone_id && !milestoneMap.has(issue.facility_milestone_id)) {
          const fm = Array.isArray(issue.facility_milestones) 
            ? issue.facility_milestones[0] 
            : issue.facility_milestones
          
          if (fm) {
            milestoneMap.set(issue.facility_milestone_id, {
              id: issue.facility_milestone_id,
              name: fm.name,
              display_name: fm.display_name,
              display_order: fm.display_order || 0,
              pair_with_id: fm.pair_with_id || null,
              recorded_at: null // Not recorded - that's why it's an issue
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
      
      // Check if there's any "missing" type issue (allows editing unrecorded milestones)
      const hasAnyMissingIssue = Array.from(issueMilestoneTypes.values()).includes('missing')
      
      // Build the editable milestone list
      const editable: EditableMilestone[] = milestoneList.map(fm => {
        // Can edit if:
        // 1. This milestone has an issue, OR
        // 2. This milestone is paired with one that has an issue, OR
        // 3. For missing issues: any unrecorded milestone in this case
        const canEdit = editableMilestoneIds.has(fm.id) || (hasAnyMissingIssue && !fm.recorded_at)
        
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
          canEdit
        }
      })
      
      setEditableMilestones(editable)
      
      // Store which milestones have issues for highlighting
      setIssueMilestoneIds(localIssueMilestoneIds)
      
      // Calculate initial impact
      const newImpact = calculateImpact(editable)
      setImpact(newImpact)
      
    } catch (err) {
      console.error('Error in loadAllMilestonesForCase:', err)
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
      console.error('Error loading case issues:', error)
      return
    }
    
    const issues: CaseIssue[] = (data || []).map(d => {
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
    
    setCaseIssues(issues)
  }

  // ============================================
  // IMPACT CALCULATION
  // ============================================

  const calculateImpact = (milestones: EditableMilestone[]) => {
    const recordedNames = new Set(
      milestones.filter(m => m.recorded_at).map(m => m.name)
    )
    
    const canCalculate: string[] = []
    const cannotCalculate: string[] = []
    
    Object.entries(METRIC_REQUIREMENTS).forEach(([key, config]) => {
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

  const saveAndResolve = async (resolutionType: 'approved' | 'excluded') => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return
    
    setSaving(true)
    
    // Save any changed milestones
    const changedMilestones = editableMilestones.filter(m => m.hasChanged && m.recorded_at)
    
    for (const milestone of changedMilestones) {
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
        // Insert new - need to get milestone_type_id
        const { data: milestoneType } = await supabase
          .from('milestone_types')
          .select('id')
          .eq('name', milestone.name)
          .single()
        
        if (milestoneType) {
          await supabase
            .from('case_milestones')
            .insert({
              case_id: modalState.issue.case_id,
              facility_milestone_id: milestone.id,
              milestone_type_id: milestoneType.id,
              recorded_at: milestone.recorded_at,
              recorded_by: currentUserId
            })
        }
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
    
    // Mark all cases as excluded
    if (caseIds.length > 0) {
      await supabase
        .from('cases')
        .update({ is_excluded_from_metrics: true })
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
    
    const issueType = (issue.issue_type as IssueType)?.name || ''
    const issueFacilityMilestoneId = issue.facility_milestone_id || null
    
    // Load all issues for this case
    await loadCaseIssues(issue.case_id)
    
    // Load all milestones - pass the facility_milestone_id for pairing logic
    await loadAllMilestonesForCase(
      issue.case_id,
      issue.facility_id,
      issueType,
      issueFacilityMilestoneId
    )
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
  // SELECTION
  // ============================================

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === issues.filter(i => !i.resolved_at).length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(issues.filter(i => !i.resolved_at).map(i => i.id)))
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  const getIssueMilestoneId = (): string | null => {
    return modalState.issue?.facility_milestone_id || null
  }

  const getIssueMilestoneName = (): string | null => {
    return modalState.issue?.facility_milestone?.name || null
  }
  
  // Get paired milestone ID using the loaded milestone data (dynamic from database)
  const getPairedMilestoneId = (): string | null => {
    const issueMilestoneId = getIssueMilestoneId()
    if (!issueMilestoneId) return null
    
    // Find the issue milestone in our loaded data
    const issueMilestone = editableMilestones.find(m => m.id === issueMilestoneId)
    if (issueMilestone?.pair_with_id) {
      return issueMilestone.pair_with_id
    }
    
    // Also check if any milestone is paired WITH the issue milestone
    const pairedWith = editableMilestones.find(m => m.pair_with_id === issueMilestoneId)
    return pairedWith?.id || null
  }

  // Check if a milestone is the paired one (for highlighting)
  const isPairedMilestone = (milestoneId: string | undefined): boolean => {
    if (!milestoneId) return false
    const pairedId = getPairedMilestoneId()
    return milestoneId === pairedId
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
      <Container>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Quality</h1>
            <p className="text-slate-500 mt-1">Monitor and resolve data quality issues</p>
          </div>
          <button
            onClick={handleRunDetection}
            disabled={runningDetection}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {runningDetection ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run Detection
              </>
            )}
          </button>
        </div>

        {/* Last Scan Info - Always visible if we have a time */}
        {lastScanTime && (() => {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
          const isCurrent = lastScanTime > hourAgo
          
          return (
            <div className="mb-4 flex items-center gap-2">
              {isCurrent ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Current
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Not Current
                </span>
              )}
              <span className="text-sm text-slate-500">
                Last scan: {lastScanTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                {' · '}
                {lastScanTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )
        })()}

        {detectionResult && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {detectionResult}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Quality Score</p>
                  <p className={`text-3xl font-bold mt-1 ${
                    summary.qualityScore >= 90 ? 'text-emerald-600' :
                    summary.qualityScore >= 70 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {summary.qualityScore}%
                  </p>
                  <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        summary.qualityScore >= 90 ? 'bg-emerald-500' :
                        summary.qualityScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${summary.qualityScore}%` }}
                    />
                  </div>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Open Issues</p>
                  <p className="text-3xl font-bold mt-1 text-slate-900">{summary.totalUnresolved}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Requires attention
                  </p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
                  <p className="text-3xl font-bold mt-1 text-amber-600">{summary.expiringThisWeek}</p>
                  <p className="text-xs text-slate-500 mt-2">Within 7 days</p>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">By Severity</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm font-medium text-slate-900">{summary.bySeverity.error || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium text-slate-900">{summary.bySeverity.warning || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-slate-900">{summary.bySeverity.info || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters and Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {/* Filter by type */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Issue Types</option>
                    {issueTypes.map(type => (
                      <option key={type.id} value={type.name}>{type.display_name}</option>
                    ))}
                  </select>
                  
                  {/* Show resolved toggle */}
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showResolved}
                      onChange={(e) => setShowResolved(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Show resolved</span>
                  </label>
                </div>
                
                {/* Bulk actions */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{selectedIds.size} selected</span>
                    <button
                      onClick={() => openBulkModal(Array.from(selectedIds))}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                    >
                      Exclude Selected
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Issues List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === issues.filter(i => !i.resolved_at).length && issues.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {issues.length} issue{issues.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              {/* Issue rows */}
              {issues.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">No issues found</p>
                  <p className="text-sm text-slate-500 mt-1">Your data quality looks great!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {issues.map(issue => {
                    const issueType = issueTypes.find(t => t.id === issue.issue_type_id)
                    const daysUntilExpiry = getDaysUntilExpiration(issue.expires_at)
                    
                    return (
                      <div 
                        key={issue.id}
                        className={`px-4 py-3 hover:bg-slate-50 transition-colors ${
                          issue.resolved_at ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!issue.resolved_at && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(issue.id)}
                              onChange={() => toggleSelect(issue.id)}
                              className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {issueType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issueType.severity)}`}>
                                  {issueType.display_name}
                                </span>
                              )}
                              {issue.resolved_at && issue.resolution_type && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  {(issue.resolution_type as ResolutionType).display_name}
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-slate-900 font-medium">
                              {issue.facility_milestone?.display_name ? `${issue.facility_milestone.display_name}: ` : ''}
                              {formatIssueDescription(issue)}
                            </p>

                            {/* Case Info Row */}
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 flex-wrap">
                              {issue.cases && (
                                <>
                                  <span className="font-semibold text-slate-700">
                                    {issue.cases.case_number}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  {issue.cases.surgeon && (
                                    <>
                                      <span>
                                        Dr. {issue.cases.surgeon.last_name}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                    </>
                                  )}
                                  {issue.cases.procedure_types?.name && (
                                    <span>{issue.cases.procedure_types.name}</span>
                                  )}
                                  {issue.cases.operative_side && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span className="capitalize">{issue.cases.operative_side}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Timing Info Row */}
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                              <span>Detected {formatTimeAgo(issue.detected_at)}</span>
                              {!issue.resolved_at && (
                                <span className={daysUntilExpiry <= 7 ? 'text-amber-600 font-medium' : ''}>
                                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {!issue.resolved_at && (
                            <button
                              onClick={() => openModal(issue)}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Detection Progress Modal */}
        {runningDetection && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Running Data Quality Check</h3>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-slate-600 mb-2">
                    <span>Progress</span>
                    <span>{Math.round((detectionStep / 7) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${(detectionStep / 7) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { step: 1, label: 'Expiring old issues' },
                    { step: 2, label: 'Loading recent cases' },
                    { step: 3, label: 'Checking impossible values' },
                    { step: 4, label: 'Checking negative durations' },
                    { step: 5, label: 'Checking milestone sequences' },
                    { step: 6, label: 'Checking missing milestones' },
                    { step: 7, label: 'Finalizing results' },
                  ].map(({ step, label }) => (
                    <div key={step} className="flex items-center gap-3">
                      {detectionStep > step ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : detectionStep === step ? (
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                          <div className="w-2 h-2 bg-slate-300 rounded-full" />
                        </div>
                      )}
                      <span className={`text-sm ${
                        detectionStep > step ? 'text-emerald-700' : detectionStep === step ? 'text-blue-700 font-medium' : 'text-slate-400'
                      }`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {modalState.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modalState.isBulk ? 'Bulk Exclude Issues' : 'Review Issue'}
                  </h3>
                  {!modalState.isBulk && modalState.issue?.cases && (
                    <p className="text-sm text-slate-500">Case: <span className="font-medium text-blue-600">{modalState.issue.cases.case_number}</span></p>
                  )}
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Bulk Mode */}
                {modalState.isBulk && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Exclude from Metrics</h4>
                    <p className="text-sm text-red-700">
                      You are about to exclude {modalState.bulkIds.length} cases from all analytics calculations.
                      This action marks the issues as resolved but removes the cases from aggregate metrics.
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
                )}

                {/* Single Issue Mode */}
                {!modalState.isBulk && modalState.issue && (
                  <>
                    {/* Multiple Issues Warning */}
                    {caseIssues.length > 1 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-blue-800">Multiple Issues for This Case</h4>
                            <p className="text-sm text-blue-700 mt-1">
                              This case has {caseIssues.length} unresolved issues. Resolving will address all of them.
                            </p>
                            <ul className="mt-2 space-y-1">
                              {caseIssues.map(ci => (
                                <li key={ci.id} className="text-xs text-blue-600 flex items-center gap-1">
                                  <span>•</span>
                                  <span>{ci.issue_type?.display_name}: {ci.facility_milestone_display_name || 'General'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stale Issue Alert (only for "missing" type that's now recorded) */}
                    {isIssueStale() && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-emerald-800">Issue Already Resolved</h4>
                            <p className="text-sm text-emerald-700 mt-1">
                              The {modalState.issue.facility_milestone?.display_name} milestone has been recorded since this issue was detected.
                              You can validate to close this issue.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Issue Description (only if not stale) */}
                    {!isIssueStale() && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-amber-800">
                              {(modalState.issue.issue_type as IssueType)?.display_name || 'Issue Detected'}
                            </h4>
                            <p className="text-sm text-amber-700 mt-1">
                              {modalState.issue.facility_milestone?.display_name}: {formatIssueDescription(modalState.issue)}
                            </p>
                            <p className="text-xs text-amber-600 mt-2">
                              Detected {formatTimeAgo(modalState.issue.detected_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Impact Analysis */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Impact Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Cannot Calculate</p>
                          {impact.cannotCalculate.length > 0 ? (
                            <ul className="space-y-1">
                              {impact.cannotCalculate.map(metric => (
                                <li key={metric} className="flex items-center gap-2 text-sm text-slate-600">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  {metric}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-emerald-600 font-medium">All metrics can be calculated ✓</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">Can Calculate</p>
                          {impact.canCalculate.length > 0 ? (
                            <ul className="space-y-1">
                              {impact.canCalculate.map(metric => (
                                <li key={metric} className="flex items-center gap-2 text-sm text-slate-600">
                                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {metric}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No metrics available</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Case Information */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Case Information</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Procedure</span>
                          <p className="font-medium text-slate-900">{modalState.issue.cases?.procedure_types?.name || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Operative Side</span>
                          <p className="font-medium text-slate-900 capitalize">{modalState.issue.cases?.operative_side || 'Not specified'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Date</span>
                          <p className="font-medium text-slate-900">
                            {modalState.issue.cases?.scheduled_date 
                              ? new Date(modalState.issue.cases.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Unknown'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Scheduled Start</span>
                          <p className="font-medium text-slate-900">
                            {modalState.issue.cases?.start_time 
                              ? new Date(`2000-01-01T${modalState.issue.cases.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                              : 'Not set'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Surgeon</span>
                          <p className="font-medium text-slate-900">
                            {modalState.issue.cases?.surgeon 
                              ? `Dr. ${modalState.issue.cases.surgeon.first_name} ${modalState.issue.cases.surgeon.last_name}`
                              : 'Not assigned'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Room</span>
                          <p className="font-medium text-slate-900">{modalState.issue.cases?.or_rooms?.name || 'Not assigned'}</p>
                        </div>
                      </div>
                    </div>

                    {/* All Milestones Timeline */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Milestone Timeline</h4>
                      {loadingMilestones ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                          {editableMilestones.map((milestone, index) => {
                            // Check if this milestone has an issue (using global state)
                            const hasIssue = issueMilestoneIds.has(milestone.id)
                            const isMissing = !milestone.recorded_at
                            
                            // Find the paired milestone for visual indicator
                            const pairedMilestone = milestone.pair_with_id 
                              ? editableMilestones.find(m => m.id === milestone.pair_with_id)
                              : null
                            const isStartOfPair = pairedMilestone && milestone.display_order < (pairedMilestone.display_order || 999)
                            const isEndOfPair = pairedMilestone && milestone.display_order > (pairedMilestone.display_order || 0)
                            
                            // Find if we should show the pairing bracket (only on start milestone)
                            const showPairBracket = isStartOfPair && pairedMilestone
                            const pairEndIndex = showPairBracket 
                              ? editableMilestones.findIndex(m => m.id === pairedMilestone.id)
                              : -1
                            const pairSpan = pairEndIndex > index ? pairEndIndex - index : 0
                            
                            return (
                              <div 
                                key={milestone.id || milestone.name}
                                className={`relative ${
                                  hasIssue ? 'bg-amber-50' : ''
                                }`}
                              >
                                <div className="px-4 py-3 flex items-center gap-3">
                                  {/* Pair indicator column */}
                                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                                    {(isStartOfPair || isEndOfPair) && (
                                      <div className={`flex items-center ${isStartOfPair ? 'text-slate-400' : 'text-slate-400'}`}>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                          {isStartOfPair ? (
                                            // Top of bracket - curved arrow pointing down
                                            <path d="M12 4 C12 4, 6 4, 6 10 L6 14" strokeLinecap="round" />
                                          ) : (
                                            // Bottom of bracket - curved arrow pointing up
                                            <path d="M6 10 L6 14 C6 20, 12 20, 12 20" strokeLinecap="round" />
                                          )}
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Status dot */}
                                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                    isMissing 
                                      ? 'bg-slate-300' 
                                      : milestone.hasChanged 
                                        ? 'bg-blue-500' 
                                        : 'bg-emerald-500'
                                  }`} />
                                  
                                  {/* Milestone name and badges */}
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className={`text-sm font-medium ${
                                      hasIssue ? 'text-amber-800' : 'text-slate-900'
                                    }`}>
                                      {milestone.display_name}
                                    </span>
                                    
                                    {/* Start/End badge for paired milestones */}
                                    {isStartOfPair && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                        Start
                                      </span>
                                    )}
                                    {isEndOfPair && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                        End
                                      </span>
                                    )}
                                    
                                    {/* Issue indicator */}
                                    {hasIssue && (
                                      <span className="text-xs text-amber-600 font-medium">(Issue)</span>
                                    )}
                                    
                                    {/* Modified indicator */}
                                    {milestone.hasChanged && (
                                      <span className="text-xs text-blue-600 font-medium">(Modified)</span>
                                    )}
                                  </div>
                                  
                                  {/* Time display/edit */}
                                  <div className="flex items-center gap-2">
                                    {milestone.isEditing ? (
                                      <input
                                        type="datetime-local"
                                        step="1"
                                        value={milestone.recorded_at ? milestone.recorded_at.slice(0, 19) : ''}
                                        onChange={(e) => updateMilestoneTime(index, e.target.value ? new Date(e.target.value).toISOString() : '')}
                                        className="px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                      />
                                    ) : (
                                      <span className={`text-sm ${isMissing ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                                        {milestone.recorded_at 
                                          ? formatTimeWithSeconds(milestone.recorded_at)
                                          : 'Not recorded'
                                        }
                                      </span>
                                    )}
                                    
                                    {milestone.canEdit && (
                                      <button
                                        onClick={() => toggleMilestoneEdit(index)}
                                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                          milestone.isEditing
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {milestone.isEditing ? 'Done' : isMissing ? 'Add' : 'Edit'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Add any context about this resolution..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Validation Warning Overlay */}
              {showValidationWarning && (
                <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-6 rounded-2xl">
                  <div className="max-w-md w-full">
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-amber-800 mb-3">Missing Milestones</h4>
                      
                      {missingMilestones.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm text-amber-700 mb-2">The following milestones are still not recorded:</p>
                          <div className="bg-amber-100 rounded-lg p-3">
                            {missingMilestones.map(m => (
                              <div key={m} className="flex items-center gap-2 text-sm text-amber-800">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {m}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-sm text-amber-700 mb-2">The following metrics will <strong>NOT</strong> be saved to analytics:</p>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        {affectedMetrics.map(m => (
                          <div key={m} className="flex items-center gap-2 text-sm text-red-700">
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
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
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl">
                {modalState.isBulk ? (
                  <>
                    <div />
                    <div className="flex items-center gap-3">
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
                        {saving ? 'Excluding...' : `Exclude ${modalState.bulkIds.length} Cases`}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={openCaseInNewTab}
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                    >
                      Open Case
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={closeModal}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleExclude}
                        disabled={saving}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        Exclude from Metrics
                      </button>
                      <button
                        onClick={handleValidate}
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
                      >
                        {saving ? 'Saving...' : 'Validate'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Container>
    </DashboardLayout>
  )
}