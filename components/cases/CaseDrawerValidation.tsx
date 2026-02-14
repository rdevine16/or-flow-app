// components/cases/CaseDrawerValidation.tsx
// Validation tab content for the Case Drawer.
// Shows unresolved metric issues with severity badges, affected milestones,
// detected vs expected values, and a link to the DQ page for resolution.

'use client'

import Link from 'next/link'
import type { MetricIssue } from '@/lib/dataQuality'
import { getSeverityColor, formatTimeAgo, formatDetectedValue } from '@/lib/dataQuality'
import { ExternalLink, ShieldCheck, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'

interface CaseDrawerValidationProps {
  issues: MetricIssue[]
  loading: boolean
  caseId: string
}

const SEVERITY_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const

function getSeverityIcon(severity: string) {
  return SEVERITY_ICONS[severity as keyof typeof SEVERITY_ICONS] ?? Info
}

export default function CaseDrawerValidation({ issues, loading, caseId }: CaseDrawerValidationProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mb-3" />
        <p className="text-sm text-slate-500">Loading validation issues...</p>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm font-medium text-slate-900">No validation issues</p>
        <p className="text-xs text-slate-500 mt-1">All metrics look good</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with count + DQ link */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {issues.length} unresolved {issues.length === 1 ? 'issue' : 'issues'}
        </p>
        <Link
          href={`/dashboard/data-quality?caseId=${caseId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          Resolve in Data Quality
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {issues.map((issue) => {
          const severity = issue.issue_type?.severity ?? 'info'
          const colorClasses = getSeverityColor(severity)
          const Icon = getSeverityIcon(severity)

          return (
            <div
              key={issue.id}
              className={`rounded-lg border p-3 ${colorClasses}`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {/* Severity + issue type */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase">
                      {severity}
                    </span>
                    {issue.issue_type?.display_name && (
                      <span className="text-xs text-slate-600">
                        {issue.issue_type.display_name}
                      </span>
                    )}
                  </div>

                  {/* Affected milestone */}
                  {issue.facility_milestone?.display_name && (
                    <p className="text-sm text-slate-700 mt-1">
                      Milestone: {issue.facility_milestone.display_name}
                    </p>
                  )}

                  {/* Detected vs expected */}
                  {issue.detected_value !== null && (
                    <p className="text-xs text-slate-600 mt-1">
                      {formatDetectedValue(issue)}
                    </p>
                  )}

                  {/* Time detected */}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Detected {formatTimeAgo(issue.detected_at)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
