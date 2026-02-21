// IssuesTable — CSS Grid case-grouped table

import { useState, useMemo } from 'react'
import { Check, Eye } from 'lucide-react'
import IssueChip from './IssueChip'
import {
  getDaysUntilExpiration,
  type MetricIssue,
  type IssueType,
} from '@/lib/dataQuality'

// ============================================
// TYPES
// ============================================

interface CaseGroup {
  caseId: string
  caseNumber: string
  surgeon: string | null
  procedure: string | null
  side: string | null
  milestoneSummary: string
  issueTypes: Array<{ type: IssueType; count: number }>
  issueCount: number
  maxSeverity: 'error' | 'warning' | 'info'
  earliestExpiry: number | null
  isResolved: boolean
  unresolvedIssueIds: string[]
  firstIssue: MetricIssue
}

interface IssuesTableProps {
  issues: MetricIssue[]
  issueTypes: IssueType[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onReview: (issue: MetricIssue) => void
  activeCaseId: string | null
}

// ============================================
// HELPERS
// ============================================

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 }

function getMaxSeverity(types: Array<{ type: IssueType }>): 'error' | 'warning' | 'info' {
  let max: 'error' | 'warning' | 'info' = 'info'
  for (const { type } of types) {
    if (SEVERITY_ORDER[type.severity] < SEVERITY_ORDER[max]) {
      max = type.severity
    }
  }
  return max
}

function buildMilestoneSummary(issues: MetricIssue[]): string {
  const milestones = issues
    .filter(i => i.facility_milestone?.display_name)
    .map(i => i.facility_milestone!.display_name)
  const unique = [...new Set(milestones)]
  if (unique.length === 0) return 'No milestone specified'
  if (unique.length <= 3) return unique.join(', ')
  return `${unique.slice(0, 3).join(', ')} +${unique.length - 3} more`
}

// ============================================
// COMPONENT
// ============================================

export default function IssuesTable({
  issues,
  issueTypes,
  selectedIds,
  onSelectionChange,
  onReview,
  activeCaseId,
}: IssuesTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Group issues by case_id
  const caseGroups: CaseGroup[] = useMemo(() => {
    const groupMap = new Map<string, MetricIssue[]>()
    issues.forEach(issue => {
      const caseId = issue.case_id || 'unknown'
      if (!groupMap.has(caseId)) groupMap.set(caseId, [])
      groupMap.get(caseId)!.push(issue)
    })

    return Array.from(groupMap.entries()).map(([caseId, caseIssues]) => {
      const first = caseIssues[0]
      const unresolvedIssues = caseIssues.filter(i => !i.resolved_at)

      // Aggregate issue types
      const typeMap = new Map<string, { type: IssueType; count: number }>()
      caseIssues.forEach(issue => {
        const matched = issueTypes.find(t => t.id === issue.issue_type_id)
        if (matched) {
          if (!typeMap.has(matched.id)) typeMap.set(matched.id, { type: matched, count: 0 })
          typeMap.get(matched.id)!.count++
        }
      })
      const aggregatedTypes = Array.from(typeMap.values())

      // Earliest expiry among unresolved
      const expiryDays = unresolvedIssues
        .filter(i => i.expires_at)
        .map(i => getDaysUntilExpiration(i.expires_at))
      const earliestExpiry = expiryDays.length > 0 ? Math.min(...expiryDays) : null

      return {
        caseId,
        caseNumber: first.cases?.case_number || caseId.slice(0, 8),
        surgeon: first.cases?.surgeon ? `Dr. ${first.cases.surgeon.last_name}` : null,
        procedure: first.cases?.procedure_types?.name || null,
        side: first.cases?.operative_side || null,
        milestoneSummary: buildMilestoneSummary(caseIssues),
        issueTypes: aggregatedTypes,
        issueCount: unresolvedIssues.length,
        maxSeverity: getMaxSeverity(aggregatedTypes),
        earliestExpiry,
        isResolved: caseIssues.every(i => i.resolved_at),
        unresolvedIssueIds: unresolvedIssues.map(i => i.id),
        firstIssue: first,
      }
    })
  }, [issues, issueTypes])

  // Selection helpers
  const allUnresolvedIds = useMemo(
    () => caseGroups.flatMap(g => g.unresolvedIssueIds),
    [caseGroups]
  )
  const allSelected = allUnresolvedIds.length > 0 && allUnresolvedIds.every(id => selectedIds.has(id))
  const someSelected = allUnresolvedIds.some(id => selectedIds.has(id))

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(allUnresolvedIds))
    }
  }

  const toggleCaseSelection = (group: CaseGroup) => {
    const next = new Set(selectedIds)
    const caseAllSelected = group.unresolvedIssueIds.every(id => next.has(id))
    if (caseAllSelected) {
      group.unresolvedIssueIds.forEach(id => next.delete(id))
    } else {
      group.unresolvedIssueIds.forEach(id => next.add(id))
    }
    onSelectionChange(next)
  }

  // ============================================
  // EMPTY STATE
  // ============================================

  if (issues.length === 0) {
    return (
      <div data-testid="issues-table" className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-slate-600 font-medium">No issues found</p>
          <p className="text-sm text-slate-500 mt-1">Your data quality looks great!</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div data-testid="issues-table" className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Table header */}
      <div
        className="grid items-center px-4 py-2.5 border-b border-stone-200 bg-stone-50"
        style={{ gridTemplateColumns: '36px 1fr 200px 100px 80px 72px' }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
          onChange={toggleSelectAll}
          className="w-3.5 h-3.5 accent-blue-600"
          aria-label="Select all cases"
        />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Case</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Issues</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Severity</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Expires</span>
        <span />
      </div>

      {/* Case rows */}
      {caseGroups.map((group, i) => {
        const isActive = activeCaseId === group.caseId
        const isHovered = hoveredRow === group.caseId
        const hasError = group.maxSeverity === 'error'
        const caseAllSelected = group.unresolvedIssueIds.every(id => selectedIds.has(id))
        const caseSomeSelected = group.unresolvedIssueIds.some(id => selectedIds.has(id))

        // Left border color: active > error > transparent
        const borderLeftColor = isActive
          ? 'border-l-blue-600'
          : hasError && !group.isResolved
            ? 'border-l-red-500'
            : 'border-l-transparent'

        return (
          <div
            key={group.caseId}
            data-testid={`case-row-${group.caseId}`}
            onMouseEnter={() => setHoveredRow(group.caseId)}
            onMouseLeave={() => setHoveredRow(null)}
            onClick={() => !group.isResolved && onReview(group.firstIssue)}
            className={`grid items-center px-4 py-3 border-l-[3px] cursor-pointer transition-colors ${borderLeftColor} ${
              isActive ? 'bg-blue-50' : isHovered ? 'bg-stone-50' : ''
            } ${group.isResolved ? 'opacity-60 cursor-default' : ''} ${
              i < caseGroups.length - 1 ? 'border-b border-b-stone-100' : ''
            }`}
            style={{ gridTemplateColumns: '36px 1fr 200px 100px 80px 72px' }}
          >
            {/* Checkbox */}
            <div onClick={e => e.stopPropagation()}>
              {!group.isResolved ? (
                <input
                  type="checkbox"
                  checked={caseAllSelected}
                  ref={el => { if (el) el.indeterminate = caseSomeSelected && !caseAllSelected }}
                  onChange={() => toggleCaseSelection(group)}
                  className="w-3.5 h-3.5 accent-blue-600"
                  aria-label={`Select case ${group.caseNumber}`}
                />
              ) : (
                <div className="w-3.5" />
              )}
            </div>

            {/* Case info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[13px] font-semibold text-blue-600">
                  {group.caseNumber}
                </span>
                {group.surgeon && (
                  <span className="text-xs text-stone-500">{group.surgeon}</span>
                )}
                {group.procedure && (
                  <>
                    <span className="text-[11px] text-stone-300">·</span>
                    <span className="text-xs text-stone-500">{group.procedure}</span>
                  </>
                )}
                {group.side && (
                  <>
                    <span className="text-[11px] text-stone-300">·</span>
                    <span className="text-xs text-stone-400 capitalize">{group.side}</span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-stone-400 line-clamp-1">
                {group.milestoneSummary}
              </span>
            </div>

            {/* Issue type chips */}
            <div className="flex flex-wrap gap-1">
              {group.issueTypes.map(({ type, count }) => (
                <IssueChip
                  key={type.id}
                  label={type.display_name}
                  severity={type.severity}
                  count={count}
                />
              ))}
              {group.isResolved && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">
                  Resolved
                </span>
              )}
            </div>

            {/* Severity indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  group.maxSeverity === 'error'
                    ? 'bg-red-600'
                    : group.maxSeverity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                }`}
              />
              <span
                className={`text-xs font-semibold ${
                  group.maxSeverity === 'error'
                    ? 'text-red-600'
                    : group.maxSeverity === 'warning'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                }`}
              >
                {group.issueCount} issue{group.issueCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Expires */}
            <span
              className={`text-xs font-mono font-medium ${
                group.earliestExpiry === null
                  ? 'text-stone-400'
                  : group.earliestExpiry <= 7
                    ? 'text-red-600'
                    : group.earliestExpiry <= 14
                      ? 'text-amber-600'
                      : 'text-stone-500'
              }`}
            >
              {group.earliestExpiry !== null ? `${group.earliestExpiry}d` : '—'}
            </span>

            {/* Review button */}
            <div onClick={e => e.stopPropagation()}>
              {!group.isResolved && (
                <button
                  onClick={() => onReview(group.firstIssue)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    isHovered || isActive
                      ? 'bg-blue-600 text-white border border-blue-600'
                      : 'bg-white text-stone-500 border border-stone-200 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Review
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
