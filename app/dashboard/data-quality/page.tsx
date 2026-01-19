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
  getSeverityColor,
  formatTimeAgo,
  getDaysUntilExpiration,
  type MetricIssue,
  type IssueType,
  type ResolutionType,
  type DataQualitySummary
} from '@/lib/dataQuality'

// ============================================
// IMPACT ANALYSIS - What metrics require which milestones
// ============================================
const METRIC_REQUIREMENTS: Record<string, { name: string; requires: string[] }> = {
  total_case_time: {
    name: 'Total Case Time',
    requires: ['patient_in', 'patient_out']
  },
  fcots: {
    name: 'First Case On-Time Start (FCOTS)',
    requires: ['patient_in'] // Also needs scheduled_time but that's case-level
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

// Standard milestone order for display
const MILESTONE_ORDER = [
  'patient_in',
  'anes_start',
  'anes_end',
  'prepped',
  'draping_complete',
  'incision',
  'closing',
  'closing_complete',
  'patient_out',
  'room_cleaned'
]

interface EditableMilestone {
  name: string
  display_name: string
  display_order: number
  recorded_at: string | null
  original_recorded_at: string | null
  isEditing: boolean
  hasChanged: boolean
}

// Helper to format issue description
function formatIssueDescription(issue: MetricIssue): string {
  const issueType = issue.issue_type as IssueType | null
  const typeName = issueType?.name || ''
  
  if (typeName === 'missing') {
    return 'Not recorded'
  }
  
  if (issue.detected_value !== null) {
    const value = Math.round(issue.detected_value)
    const details = issue.details as Record<string, unknown> | null
    
    if (details?.days_overdue !== undefined) {
      return `${value} day${value !== 1 ? 's' : ''} overdue`
    }
    
    if (details?.hours_since_activity !== undefined) {
      return `${value} hour${value !== 1 ? 's' : ''} since activity`
    }
    
    const min = issue.expected_min !== null ? Math.round(issue.expected_min) : null
    const max = issue.expected_max !== null ? Math.round(issue.expected_max) : null
    
    let rangeStr = ''
    if (min !== null && max !== null) {
      rangeStr = ` (expected ${min}-${max} min)`
    } else if (max !== null) {
      rangeStr = ` (expected ≤${max} min)`
    } else if (min !== null) {
      rangeStr = ` (expected ≥${min} min)`
    }
    
    return `${value} min${rangeStr}`
  }
  
  return 'Issue detected'
}

// Format time with seconds
function formatTimeWithSeconds(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

export default function DataQualityPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getUserId()
  }, [supabase])

  // Data state
  const [issues, setIssues] = useState<MetricIssue[]>([])
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([])
  const [resolutionTypes, setResolutionTypes] = useState<ResolutionType[]>([])
  const [summary, setSummary] = useState<DataQualitySummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Filter state
  const [showResolved, setShowResolved] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    issue: MetricIssue | null
    isBulk: boolean
    bulkIds: string[]
  }>({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })
  
  // Editable milestones for the modal
  const [editableMilestones, setEditableMilestones] = useState<EditableMilestone[]>([])
  const [loadingMilestones, setLoadingMilestones] = useState(false)
  
  // Validation warning state
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

  // Fetch FRESH milestone data when modal opens
  // Only shows milestones that actually exist for this case, plus the issue milestone if missing
  const loadFreshMilestones = async (caseId: string, issueMilestoneName: string | null) => {
    setLoadingMilestones(true)
    
    try {
      // Get actual recorded milestones for this case
      const { data: caseMilestones, error: cmError } = await supabase
        .from('case_milestones')
        .select(`
          id,
          recorded_at,
          milestone_type_id,
          facility_milestone_id,
          facility_milestones(name, display_name, display_order),
          milestone_types(name, display_name)
        `)
        .eq('case_id', caseId)
        .order('recorded_at', { ascending: true })
      
      if (cmError) {
        console.error('Error loading case milestones:', cmError)
      }
      
      // Helper to normalize Supabase join data (may come as array or object)
      const normalizeJoin = <T,>(data: T | T[] | null): T | null => {
        if (Array.isArray(data)) return data[0] || null
        return data
      }
      
      // Build editable milestone list from actual case milestones
      const editable: EditableMilestone[] = (caseMilestones || [])
        .map(cm => {
          // Normalize Supabase join data (may come as array or object)
          const rawFacilityMilestone = cm.facility_milestones
          const facilityMilestone = Array.isArray(rawFacilityMilestone) 
            ? rawFacilityMilestone[0] as { name: string; display_name: string; display_order: number } | undefined
            : rawFacilityMilestone as { name: string; display_name: string; display_order: number } | null
          
          const rawMilestoneType = cm.milestone_types
          const milestoneType = Array.isArray(rawMilestoneType)
            ? rawMilestoneType[0] as { name: string; display_name: string } | undefined
            : rawMilestoneType as { name: string; display_name: string } | null
          
          // Use facility milestone name if available, otherwise fall back to milestone type
          const name = facilityMilestone?.name || milestoneType?.name || ''
          const displayName = facilityMilestone?.display_name || milestoneType?.display_name || name
          const displayOrder = facilityMilestone?.display_order || 0
          
          return {
            name,
            display_name: displayName,
            display_order: displayOrder,
            recorded_at: cm.recorded_at,
            original_recorded_at: cm.recorded_at,
            isEditing: false,
            hasChanged: false
          }
        })
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      
      // If the issue is about a missing milestone, add it to the list if not present
      if (issueMilestoneName) {
        const existsInList = editable.some(m => m.name === issueMilestoneName)
        if (!existsInList) {
          // Fetch the facility milestone info for this missing milestone
          const { data: missingMilestone } = await supabase
            .from('facility_milestones')
            .select('name, display_name, display_order')
            .eq('name', issueMilestoneName)
            .single()
          
          if (missingMilestone) {
            editable.push({
              name: missingMilestone.name,
              display_name: missingMilestone.display_name,
              display_order: missingMilestone.display_order || 999,
              recorded_at: null,
              original_recorded_at: null,
              isEditing: false,
              hasChanged: false
            })
            // Re-sort after adding
            editable.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          }
        }
      }
      
      setEditableMilestones(editable)
    } catch (err) {
      console.error('Error in loadFreshMilestones:', err)
    }
    
    setLoadingMilestones(false)
  }

  // Calculate impact analysis based on current milestone state
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

  const handleRunDetection = async () => {
    if (!effectiveFacilityId) return
    
    setRunningDetection(true)
    setDetectionResult(null)
    setDetectionStep(0)

    setDetectionStep(1)
    const expiredCount = await expireOldIssues(supabase)

    setDetectionStep(2)
    const stepTimer = setInterval(() => {
      setDetectionStep(prev => Math.min(prev + 1, 6))
    }, 800)

    const result = await runDetectionForFacility(supabase, effectiveFacilityId, 7)
    
    clearInterval(stepTimer)
    setDetectionStep(7)

    await new Promise(resolve => setTimeout(resolve, 500))

    setDetectionResult(`Checked ${result.casesChecked} cases, found ${result.issuesFound} issues${expiredCount ? ` · Expired ${expiredCount} old issues` : ''}`)
    setLastScanTime(new Date())

    await dataQualityAudit.detectionRun(
      supabase,
      effectiveFacilityId,
      7,
      result.issuesFound,
      expiredCount || 0
    )

    await loadData()
    setRunningDetection(false)
    setDetectionStep(0)
  }

  // Handle milestone time change
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

  // Toggle editing mode for a milestone
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

  // Handle Validate button click
  const handleValidate = async () => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return
    
    // Check what's still missing
    const stillMissing = editableMilestones
      .filter(m => !m.recorded_at)
      .map(m => m.display_name)
    
    const { cannotCalculate } = calculateImpact(editableMilestones)
    
    // If there are still missing milestones, show warning
    if (stillMissing.length > 0) {
      setMissingMilestones(stillMissing)
      setAffectedMetrics(cannotCalculate)
      setShowValidationWarning(true)
      return
    }
    
    // All milestones filled - proceed with save
    await saveAndResolve('approved')
  }

  // Handle "Continue Anyway" from warning
  const handleContinueAnyway = async () => {
    setShowValidationWarning(false)
    await saveAndResolve('approved')
  }

  // Handle Exclude from Metrics
  const handleExclude = async () => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return
    await saveAndResolve('excluded')
  }

  // Save milestone changes and resolve issue
  const saveAndResolve = async (resolutionType: 'approved' | 'excluded') => {
    if (!modalState.issue || !currentUserId || !effectiveFacilityId) return
    
    setSaving(true)
    
    // Save any changed milestones
    const changedMilestones = editableMilestones.filter(m => m.hasChanged && m.recorded_at)
    
    for (const milestone of changedMilestones) {
      // Get milestone type ID
      const { data: milestoneType } = await supabase
        .from('milestone_types')
        .select('id')
        .eq('name', milestone.name)
        .single()
      
      if (milestoneType) {
        // Check if milestone exists
        const { data: existing } = await supabase
          .from('case_milestones')
          .select('id')
          .eq('case_id', modalState.issue.case_id)
          .eq('milestone_type_id', milestoneType.id)
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
          // Insert new
          await supabase
            .from('case_milestones')
            .insert({
              case_id: modalState.issue.case_id,
              milestone_type_id: milestoneType.id,
              recorded_at: milestone.recorded_at,
              recorded_by: currentUserId
            })
        }
      }
    }
    
    // Resolve the issue
    await resolveIssue(
      supabase,
      modalState.issue.id,
      currentUserId,
      resolutionType,
      resolutionNotes || undefined
    )
    
    // Audit log
    await dataQualityAudit.issueResolved(
      supabase,
      modalState.issue.id,
      (modalState.issue.issue_type as IssueType)?.name || 'unknown',
      modalState.issue.cases?.case_number || 'unknown',
      resolutionType === 'approved' ? 'approved' : 'excluded',
      effectiveFacilityId,
      resolutionNotes || undefined
    )
    
    closeModal()
    setSaving(false)
    await loadData()
  }

  // Bulk resolve (for excluded only in bulk mode)
  const handleBulkExclude = async () => {
    if (!currentUserId || !effectiveFacilityId || modalState.bulkIds.length === 0) return
    
    setSaving(true)
    
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

  const openModal = async (issue: MetricIssue) => {
    setModalState({ isOpen: true, issue, isBulk: false, bulkIds: [] })
    setResolutionNotes('')
    setShowValidationWarning(false)
    // Pass the issue's milestone name so we can add it if missing
    const issueMilestoneName = issue.facility_milestone?.name || null
    await loadFreshMilestones(issue.case_id, issueMilestoneName)
  }

  const openBulkModal = (ids: string[]) => {
    setModalState({ isOpen: true, issue: null, isBulk: true, bulkIds: ids })
    setResolutionNotes('')
    setEditableMilestones([])
  }

  const closeModal = () => {
    setModalState({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })
    setResolutionNotes('')
    setEditableMilestones([])
    setShowValidationWarning(false)
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    const unresolvedIds = issues.filter(i => !i.resolved_at).map(i => i.id)
    setSelectedIds(new Set(unresolvedIds))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const unresolvedIssues = issues.filter(i => !i.resolved_at)

  // Get impact analysis for display
  const impact = calculateImpact(editableMilestones)

  // Check if the issue is now stale (milestone was recorded after issue was created)
  // Only applies to "missing" issue type - other issue types have milestones that already exist
  const isIssueStale = () => {
    if (!modalState.issue) return false
    if (editableMilestones.length === 0) return false // Still loading or no milestones
    
    // Only "missing" issues can become stale by recording the milestone
    const issueType = modalState.issue.issue_type as IssueType | null
    if (issueType?.name !== 'missing') return false
    
    // Check if the missing milestone now exists
    const issueMilestoneName = modalState.issue.facility_milestone?.name
    if (!issueMilestoneName) return false
    
    const milestone = editableMilestones.find(m => m.name === issueMilestoneName)
    if (!milestone) return false // Milestone not found in list
    
    return milestone.recorded_at !== null
  }
  
  // Helper to get the issue's milestone name
  const getIssueMilestoneName = (): string | null => {
    return modalState.issue?.facility_milestone?.name || null
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="mb-6 flex items-center justify-between">
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

        {/* Last Scan Info */}
        {lastScanTime && (
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Current
            </span>
            <span className="text-sm text-slate-500">
              Last scan: {lastScanTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' · '}
              {lastScanTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

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
                  <p className="text-3xl font-bold text-slate-900 mt-1">{summary.totalUnresolved}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {summary.bySeverity.error || 0} errors · {summary.bySeverity.warning || 0} warnings
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Expiring This Week</p>
                  <p className={`text-3xl font-bold mt-1 ${summary.expiringThisWeek > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {summary.expiringThisWeek}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Auto-resolved if not addressed</p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">By Severity</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm font-medium">{summary.bySeverity.error || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium">{summary.bySeverity.warning || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium">{summary.bySeverity.info || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Issue Type Filter Pills */}
            {issueTypes.length > 0 && summary && summary.totalUnresolved > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Filter by Type</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filterType === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All ({summary.totalUnresolved})
                  </button>
                  {issueTypes.map(type => {
                    const count = summary.byType[type.name] || 0
                    if (count === 0 && filterType !== type.name) return null
                    return (
                      <button
                        key={type.id}
                        onClick={() => setFilterType(type.name)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          filterType === type.name
                            ? 'bg-blue-600 text-white'
                            : getSeverityColor(type.severity)
                        }`}
                      >
                        {type.display_name}: {count}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Filters & Actions Bar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResolved}
                    onChange={(e) => setShowResolved(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">Show resolved</span>
                </label>

                {selectedIds.size > 0 && (
                  <span className="text-sm text-blue-600 font-medium">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unresolvedIssues.length > 0 && selectedIds.size === 0 && (
                  <button onClick={selectAll} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                    Select All
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <>
                    <button onClick={clearSelection} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                      Clear
                    </button>
                    <button
                      onClick={() => openBulkModal(Array.from(selectedIds))}
                      className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Exclude Selected
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Issues List */}
            <div className="space-y-2">
              {issues.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">No Issues Found</h3>
                  <p className="text-slate-500">
                    {showResolved ? 'No data quality issues to display.' : 'All data quality issues have been resolved!'}
                  </p>
                </div>
              ) : (
                issues.map(issue => {
                  const issueType = issue.issue_type as IssueType | undefined
                  const isSelected = selectedIds.has(issue.id)
                  const daysUntilExpiry = getDaysUntilExpiration(issue.expires_at)

                  return (
                    <div
                      key={issue.id}
                      onClick={() => !issue.resolved_at && openModal(issue)}
                      className={`bg-white rounded-xl border p-4 transition-colors ${
                        issue.resolved_at 
                          ? 'border-slate-200 opacity-60' 
                          : isSelected
                            ? 'border-blue-400 bg-blue-50/30'
                            : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!issue.resolved_at && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(issue.id) }}
                            onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => { e.stopPropagation(); openModal(issue) }}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </Container>

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

      {/* Main Issue Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalState.isBulk ? `Exclude ${modalState.bulkIds.length} Issues` : 'Review Issue'}
                </h3>
                {!modalState.isBulk && modalState.issue?.cases && (
                  <p className="text-sm text-slate-500">Case: {modalState.issue.cases.case_number}</p>
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
                  {/* Stale Issue Alert */}
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
                          <p className="text-sm text-slate-500 italic">All metrics can be calculated</p>
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

                  {/* Editable Milestones */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Milestone Timeline</h4>
                    {loadingMilestones ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {editableMilestones.map((milestone, index) => {
                          const isIssueMilestone = milestone.name === getIssueMilestoneName()
                          const isMissing = !milestone.recorded_at
                          
                          return (
                            <div 
                              key={milestone.name}
                              className={`px-4 py-3 ${isIssueMilestone && isMissing ? 'bg-amber-50' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  isMissing 
                                    ? 'bg-slate-300' 
                                    : milestone.hasChanged 
                                      ? 'bg-blue-500' 
                                      : 'bg-emerald-500'
                                }`} />
                                
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-medium ${
                                    isIssueMilestone && isMissing ? 'text-amber-800' : 'text-slate-900'
                                  }`}>
                                    {milestone.display_name}
                                  </span>
                                  {isIssueMilestone && isMissing && (
                                    <span className="ml-2 text-xs text-amber-600 font-medium">(Issue)</span>
                                  )}
                                  {milestone.hasChanged && (
                                    <span className="ml-2 text-xs text-blue-600 font-medium">(Modified)</span>
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

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3 flex-shrink-0">
              {!modalState.isBulk && modalState.issue && (
                <button
                  onClick={() => window.open(`/cases/${modalState.issue?.case_id}`, '_blank')}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Open Case
                </button>
              )}
              <div className="flex-1" />
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              
              {modalState.isBulk ? (
                <button
                  onClick={handleBulkExclude}
                  disabled={saving}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Excluding...' : 'Exclude All'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleExclude}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Exclude from Metrics
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={saving}
                    className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Validating...' : 'Validate'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation Warning Modal */}
      {showValidationWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-amber-800">Missing Milestones</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                The following milestones are still not recorded:
              </p>
              <ul className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {missingMilestones.map(name => (
                  <li key={name} className="flex items-center gap-2 text-sm text-amber-800">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {name}
                  </li>
                ))}
              </ul>
              
              {affectedMetrics.length > 0 && (
                <>
                  <p className="text-sm text-slate-700">
                    The following metrics will <strong>NOT</strong> be saved to analytics:
                  </p>
                  <ul className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                    {affectedMetrics.map(metric => (
                      <li key={metric} className="flex items-center gap-2 text-sm text-red-800">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {metric}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowValidationWarning(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleContinueAnyway}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Continue Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}