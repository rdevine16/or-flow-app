// ReviewDrawer — Radix Dialog slide-over panel for case review

import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Eye, X } from 'lucide-react'
import IssueChip from './IssueChip'
import {
  formatTimeAgo,
  type MetricIssue,
  type IssueType,
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

interface ReviewDrawerProps {
  isOpen: boolean
  onClose: () => void
  issue: MetricIssue | null
  caseIssues: CaseIssue[]
  issueTypes: IssueType[]
  /** Content rendered in the scrollable body after the case details section (Phase 6+) */
  children?: ReactNode
  /** Content rendered as a sticky footer (Phase 6+) */
  footer?: ReactNode
}

// ============================================
// HELPERS
// ============================================

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 }

function getMaxSeverity(issues: CaseIssue[], issueTypes: IssueType[]): 'error' | 'warning' | 'info' {
  let max: 'error' | 'warning' | 'info' = 'info'
  for (const ci of issues) {
    const severity = ci.issue_type?.severity || 'info'
    if (SEVERITY_ORDER[severity] < SEVERITY_ORDER[max]) {
      max = severity
    }
  }
  // Also check from issueTypes if caseIssues don't have severity
  return max
}

function aggregateIssueTypes(caseIssues: CaseIssue[]): Array<{ type: IssueType; count: number }> {
  const map = new Map<string, { type: IssueType; count: number }>()
  for (const ci of caseIssues) {
    if (!ci.issue_type) continue
    const key = ci.issue_type.name
    if (!map.has(key)) {
      map.set(key, { type: ci.issue_type, count: 0 })
    }
    map.get(key)!.count++
  }
  return Array.from(map.values())
}

// ============================================
// COMPONENT
// ============================================

export default function ReviewDrawer({
  isOpen,
  onClose,
  issue,
  caseIssues,
  issueTypes,
  children,
  footer,
}: ReviewDrawerProps) {
  if (!issue) return null

  const cases = issue.cases
  const maxSeverity = getMaxSeverity(caseIssues, issueTypes)
  const aggregatedTypes = aggregateIssueTypes(caseIssues)
  const unresolvedCount = caseIssues.filter(ci => !ci.resolved).length

  // Severity banner colors
  const severityConfig = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      subtextColor: 'text-red-700',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-800',
      subtextColor: 'text-amber-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      subtextColor: 'text-blue-700',
    },
  }

  const sc = severityConfig[maxSeverity]

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Drawer panel */}
        <Dialog.Content
          data-testid="review-drawer"
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[550px] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)] border-l border-slate-200 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          aria-describedby={undefined}
        >
          {/* ======== HEADER ======== */}
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
            {/* Title row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
                >
                  <Eye className="w-3.5 h-3.5 text-white" />
                </div>
                <Dialog.Title className="text-[15px] font-bold text-slate-900">
                  Review Case
                </Dialog.Title>
              </div>

              <Dialog.Close asChild>
                <button
                  className="w-7 h-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </Dialog.Close>
            </div>

            {/* Case info line */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[15px] font-bold text-blue-600">
                {cases?.case_number || 'Unknown'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[13px] text-slate-500">
                {cases?.surgeon ? `Dr. ${cases.surgeon.last_name}` : 'No surgeon'}
                {cases?.procedure_types?.name ? ` · ${cases.procedure_types.name}` : ''}
                {cases?.operative_side ? ` · ${cases.operative_side}` : ''}
              </span>
            </div>
          </div>

          {/* ======== SCROLLABLE BODY ======== */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Issues Banner */}
            <div className={`${sc.bg} border ${sc.border} rounded-[10px] p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${sc.iconColor}`} />
                <span className={`text-sm font-bold ${sc.titleColor}`}>
                  {unresolvedCount} {unresolvedCount === 1 ? 'Issue' : 'Issues'} Detected
                </span>
              </div>

              {/* Issue type chips */}
              <div className="flex flex-wrap gap-1.5">
                {aggregatedTypes.map(({ type, count }) => (
                  <IssueChip
                    key={type.name}
                    label={type.display_name}
                    severity={type.severity}
                    count={count}
                  />
                ))}
              </div>

              {/* Detection time */}
              <p className={`text-[11px] ${sc.subtextColor} mt-2 opacity-80`}>
                Resolving will address all issues for this case. Detected {formatTimeAgo(issue.detected_at)}.
              </p>
            </div>

            {/* Case Details */}
            <div className="bg-stone-50 rounded-[10px] p-4 border border-stone-100">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 mb-3">
                Case Details
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <DetailField
                  label="Procedure"
                  value={cases?.procedure_types?.name || 'Not specified'}
                />
                <DetailField
                  label="Side"
                  value={cases?.operative_side ? capitalize(cases.operative_side) : 'Not specified'}
                />
                <DetailField
                  label="Date"
                  value={
                    cases?.scheduled_date
                      ? new Date(cases.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Unknown'
                  }
                />
                <DetailField
                  label="Scheduled"
                  value={
                    cases?.start_time
                      ? new Date(`2000-01-01T${cases.start_time}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : 'Not set'
                  }
                />
                <DetailField
                  label="Surgeon"
                  value={
                    cases?.surgeon
                      ? `Dr. ${cases.surgeon.first_name} ${cases.surgeon.last_name}`
                      : 'Not assigned'
                  }
                />
                <DetailField
                  label="Room"
                  value={cases?.or_rooms?.name || 'Not assigned'}
                />
              </div>
            </div>

            {/* Phase 6+ content passed as children */}
            {children}
          </div>

          {/* ======== FOOTER (Phase 6+) ======== */}
          {footer && (
            <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex-shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </span>
      <p className="text-[13px] font-semibold text-slate-900 mt-0.5">
        {value}
      </p>
    </div>
  )
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
