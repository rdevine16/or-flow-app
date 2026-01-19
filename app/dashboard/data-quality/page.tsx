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

// Helper to format the issue description more clearly
function formatIssueDescription(issue: MetricIssue): string {
  const issueType = issue.issue_type as IssueType | null
  const typeName = issueType?.name || ''
  
  // For "missing" type - don't show N/A, just describe what's missing
  if (typeName === 'missing') {
    return 'Not recorded'
  }
  
  // For issues with numeric values
  if (issue.detected_value !== null) {
    const value = Math.round(issue.detected_value)
    const details = issue.details as Record<string, unknown> | null
    
    // For stale cases, it's days
    if (details?.days_overdue !== undefined) {
      return `${value} day${value !== 1 ? 's' : ''} overdue`
    }
    
    // For incomplete cases, it's hours
    if (details?.hours_since_activity !== undefined) {
      return `${value} hour${value !== 1 ? 's' : ''} since activity`
    }
    
    // For milestone durations, it's minutes
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

export default function DataQualityPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get user ID from Supabase auth
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

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Combined modal state (detail + resolve)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    issue: MetricIssue | null
    isBulk: boolean
    bulkIds: string[]
  }>({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })
  
  const [selectedResolution, setSelectedResolution] = useState<string>('approved')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Running detection state
  const [runningDetection, setRunningDetection] = useState(false)
  const [detectionResult, setDetectionResult] = useState<string | null>(null)
  const [detectionStep, setDetectionStep] = useState(0)

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
    setResolutionTypes(resTypesData.filter(rt => rt.name !== 'expired')) // Hide auto-expire from manual options
    setSummary(summaryData)
    setSelectedIds(new Set())
    setLoading(false)
  }, [effectiveFacilityId, showResolved, filterType, supabase])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      loadData()
    }
  }, [userLoading, effectiveFacilityId, loadData])

  const handleRunDetection = async () => {
    if (!effectiveFacilityId) return
    
    setRunningDetection(true)
    setDetectionResult(null)
    setDetectionStep(0)

    // Step 1: Expire old issues
    setDetectionStep(1)
    const expiredCount = await expireOldIssues(supabase)

    // Step 2: Run detection (this does multiple checks internally)
    setDetectionStep(2)
    
    // Simulate progress through detection steps
    const stepTimer = setInterval(() => {
      setDetectionStep(prev => Math.min(prev + 1, 6))
    }, 800)

    const result = await runDetectionForFacility(supabase, effectiveFacilityId, 7)
    
    clearInterval(stepTimer)
    setDetectionStep(7) // Complete

    // Brief pause to show completion
    await new Promise(resolve => setTimeout(resolve, 500))

    setDetectionResult(`Checked ${result.casesChecked} cases, found ${result.issuesFound} issues${expiredCount ? ` · Expired ${expiredCount} old issues` : ''}`)

    // AUDIT LOG: Detection run
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

  const handleResolve = async () => {
    if (!currentUserId || !effectiveFacilityId) return
    
    const issueIds = modalState.isBulk ? modalState.bulkIds : (modalState.issue ? [modalState.issue.id] : [])
    if (issueIds.length === 0) return
    
    setSaving(true)

    if (issueIds.length === 1) {
      // Single issue resolution
      await resolveIssue(supabase, issueIds[0], currentUserId, selectedResolution, resolutionNotes)
      
      // Find the issue for audit log details
      const issue = issues.find(i => i.id === issueIds[0])
      
      // AUDIT LOG: Single issue resolved
      await dataQualityAudit.issueResolved(
        supabase,
        issueIds[0],
        (issue?.issue_type as IssueType)?.name || 'unknown',
        issue?.cases?.case_number || 'unknown',
        selectedResolution as 'corrected' | 'excluded' | 'approved',
        effectiveFacilityId,
        resolutionNotes || undefined
      )
    } else {
      // Bulk resolution
      await resolveMultipleIssues(supabase, issueIds, currentUserId, selectedResolution, resolutionNotes)
      
      // AUDIT LOG: Bulk resolved
      await dataQualityAudit.bulkResolved(
        supabase,
        issueIds.length,
        selectedResolution as 'corrected' | 'excluded' | 'approved',
        effectiveFacilityId,
        resolutionNotes || undefined
      )
    }

    closeModal()
    setSaving(false)
    await loadData()
  }

  const openModal = (issue: MetricIssue) => {
    setModalState({ isOpen: true, issue, isBulk: false, bulkIds: [] })
    setSelectedResolution('approved')
    setResolutionNotes('')
  }

  const openBulkModal = (ids: string[]) => {
    setModalState({ isOpen: true, issue: null, isBulk: true, bulkIds: ids })
    setSelectedResolution('approved')
    setResolutionNotes('')
  }

  const closeModal = () => {
    setModalState({ isOpen: false, issue: null, isBulk: false, bulkIds: [] })
    setSelectedResolution('approved')
    setResolutionNotes('')
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

  // Get the milestone name that has the issue (for highlighting in timeline)
  const getIssueMilestoneName = (issue: MetricIssue): string | null => {
    return issue.facility_milestone?.name || null
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
                {/* Quality Score */}
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

                {/* Open Issues */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Open Issues</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{summary.totalUnresolved}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {summary.bySeverity.error || 0} errors · {summary.bySeverity.warning || 0} warnings
                  </p>
                </div>

                {/* Expiring Soon */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-medium text-slate-500">Expiring This Week</p>
                  <p className={`text-3xl font-bold mt-1 ${summary.expiringThisWeek > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {summary.expiringThisWeek}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Auto-resolved if not addressed
                  </p>
                </div>

                {/* By Severity */}
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
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Select All
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => openBulkModal(Array.from(selectedIds))}
                      className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Resolve Selected
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
                    {showResolved 
                      ? 'No data quality issues to display.' 
                      : 'All data quality issues have been resolved!'
                    }
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
                        {/* Checkbox (only for unresolved) */}
                        {!issue.resolved_at && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleSelect(issue.id)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300"
                          />
                        )}

                        {/* Issue Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {/* Issue Type Badge */}
                            {issueType && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issueType.severity)}`}>
                                {issueType.display_name}
                              </span>
                            )}
                            {/* Resolved Badge */}
                            {issue.resolved_at && issue.resolution_type && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                {(issue.resolution_type as ResolutionType).display_name}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-sm text-slate-900 font-medium">
                            {issue.facility_milestone?.display_name 
                              ? `${issue.facility_milestone.display_name}: ` 
                              : ''
                            }
                            {formatIssueDescription(issue)}
                          </p>

                          {/* Case Info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                            {issue.cases && (
                              <span className="font-medium">
                                Case: {issue.cases.case_number}
                                {issue.cases.procedure_types?.name && ` · ${issue.cases.procedure_types.name}`}
                              </span>
                            )}
                            <span>Detected {formatTimeAgo(issue.detected_at)}</span>
                            {!issue.resolved_at && (
                              <span className={daysUntilExpiry <= 7 ? 'text-amber-600 font-medium' : ''}>
                                Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {/* Resolution Notes */}
                          {issue.resolved_at && issue.resolution_notes && (
                            <p className="mt-2 text-xs text-slate-500 italic">
                              Note: {issue.resolution_notes}
                            </p>
                          )}
                        </div>

                        {/* Resolve Button (only for unresolved) */}
                        {!issue.resolved_at && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openModal(issue)
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                          >
                            Resolve
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
              <h3 className="text-lg font-semibold text-slate-900">
                Running Data Quality Check
              </h3>
            </div>

            <div className="p-6">
              {/* Progress Bar */}
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

              {/* Steps List */}
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
                      detectionStep > step 
                        ? 'text-emerald-700' 
                        : detectionStep === step 
                          ? 'text-blue-700 font-medium' 
                          : 'text-slate-400'
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

      {/* Combined Issue Detail + Resolution Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalState.isBulk 
                    ? `Resolve ${modalState.bulkIds.length} Issues` 
                    : 'Issue Details'
                  }
                </h3>
                {!modalState.isBulk && modalState.issue?.cases && (
                  <p className="text-sm text-slate-500">
                    Case: {modalState.issue.cases.case_number}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resolution Options - Always at Top */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-emerald-800 mb-3">Resolution Action</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {resolutionTypes.map(type => (
                    <label 
                      key={type.id} 
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedResolution === type.name
                          ? 'border-emerald-500 bg-emerald-100'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resolutionType"
                        value={type.name}
                        checked={selectedResolution === type.name}
                        onChange={() => setSelectedResolution(type.name)}
                        className="w-4 h-4 text-emerald-600 border-slate-300"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-900">{type.display_name}</span>
                      </div>
                    </label>
                  ))}
                </div>
                
                {/* Notes */}
                <div className="mt-3">
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes (optional)..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              {/* Single Issue Details (not shown for bulk) */}
              {!modalState.isBulk && modalState.issue && (
                <>
                  {/* Issue Description */}
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
                          {modalState.issue.facility_milestone?.display_name 
                            ? `${modalState.issue.facility_milestone.display_name}: ` 
                            : ''
                          }
                          {formatIssueDescription(modalState.issue)}
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                          Detected {formatTimeAgo(modalState.issue.detected_at)}
                          {modalState.issue.expires_at && (
                            <> · Expires in {getDaysUntilExpiration(modalState.issue.expires_at)} days</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Case Information */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Case Information</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Procedure</span>
                        <p className="font-medium text-slate-900">
                          {modalState.issue.cases?.procedure_types?.name || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Date</span>
                        <p className="font-medium text-slate-900">
                          {modalState.issue.cases?.scheduled_date 
                            ? new Date(modalState.issue.cases.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })
                            : 'Unknown'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Scheduled Start</span>
                        <p className="font-medium text-slate-900">
                          {modalState.issue.cases?.start_time 
                            ? new Date(`2000-01-01T${modalState.issue.cases.start_time}`).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })
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
                        <p className="font-medium text-slate-900">
                          {modalState.issue.cases?.or_rooms?.name || 'Not assigned'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Milestones Timeline */}
                  {modalState.issue.cases?.case_milestones && modalState.issue.cases.case_milestones.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Milestone Timeline</h4>
                      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {modalState.issue.cases.case_milestones
                          .sort((a, b) => 
                            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
                          )
                          .map((milestone) => {
                            const issueMilestoneName = getIssueMilestoneName(modalState.issue!)
                            const isRelatedToIssue = milestone.milestone_types?.name === issueMilestoneName
                            return (
                              <div 
                                key={milestone.id}
                                className={`flex items-center gap-3 px-4 py-3 ${
                                  isRelatedToIssue ? 'bg-amber-50' : ''
                                }`}
                              >
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  isRelatedToIssue ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-medium ${
                                    isRelatedToIssue ? 'text-amber-800' : 'text-slate-900'
                                  }`}>
                                    {milestone.milestone_types?.display_name || 'Unknown'}
                                  </span>
                                  {isRelatedToIssue && (
                                    <span className="ml-2 text-xs text-amber-600 font-medium">
                                      (Issue related)
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-slate-500">
                                  {new Date(milestone.recorded_at).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Resolution Options Help */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Resolution Guide</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li><strong>Approved:</strong> The data is actually correct as-is</li>
                      <li><strong>Corrected:</strong> I fixed the data in the case record</li>
                      <li><strong>Excluded:</strong> Exclude this case from analytics</li>
                    </ul>
                  </div>
                </>
              )}

              {/* Bulk Resolution Info */}
              {modalState.isBulk && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Bulk Resolution</h4>
                  <p className="text-sm text-blue-700">
                    You are about to resolve {modalState.bulkIds.length} issues with the same resolution type. 
                    This action cannot be undone.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3 flex-shrink-0">
              {!modalState.isBulk && modalState.issue && (
                <button
                  onClick={() => {
                    const caseId = modalState.issue?.case_id
                    if (caseId) {
                      window.open(`/cases/${caseId}`, '_blank')
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Open Case
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Resolving...' : 'Resolve Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}