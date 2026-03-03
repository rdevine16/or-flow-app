/**
 * CaseHistoryTimeline — Reusable vertical timeline for case history entries.
 *
 * Renders a list of CaseHistoryEntry items as a vertical timeline with:
 * - Colored dot per change_type (green=created, blue=updated, amber=status_change, red=cancelled)
 * - Vertical connecting line between entries
 * - Change type badge, source badge, changed-by name
 * - Human-readable field change descriptions (old → new)
 * - "View HL7v2 message" link for integration-sourced entries
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { caseHistoryDAL } from '@/lib/dal/case-history'
import type {
  CaseHistoryEntry,
  CaseHistoryChangeType,
  CaseHistoryChangeSource,
} from '@/lib/integrations/shared/integration-types'

// ============================================
// HELPERS
// ============================================

const CHANGE_TYPE_CONFIG: Record<CaseHistoryChangeType, {
  label: string
  dotColor: string
  badgeBg: string
  badgeText: string
}> = {
  created: {
    label: 'Created',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  updated: {
    label: 'Updated',
    dotColor: 'bg-blue-500',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
  },
  status_change: {
    label: 'Status Change',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
  },
  cancelled: {
    label: 'Cancelled',
    dotColor: 'bg-red-500',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
  },
}

const SOURCE_CONFIG: Record<CaseHistoryChangeSource, {
  label: string
  badgeBg: string
  badgeText: string
}> = {
  manual: {
    label: 'Manual',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
  },
  epic_hl7v2: {
    label: 'Epic HL7v2',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
  },
  cerner_hl7v2: {
    label: 'Cerner HL7v2',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
  },
  meditech_hl7v2: {
    label: 'MEDITECH HL7v2',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
  },
  system: {
    label: 'System',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-500',
  },
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return ''
}

// ============================================
// CHANGE DESCRIPTION
// ============================================

function ChangeDescription({ entry }: { entry: CaseHistoryEntry }) {
  const fields = Object.entries(entry.changedFields)

  if (entry.changeType === 'created' && fields.length === 0) {
    return <p className="text-xs text-slate-600">Case created</p>
  }

  if (entry.changeType === 'cancelled') {
    const cancelNotes = entry.changedFields['cancellation_notes']
    return (
      <div className="space-y-0.5">
        <p className="text-xs text-slate-600">Case cancelled</p>
        {cancelNotes?.new && (
          <p className="text-xs text-slate-500 italic truncate max-w-[400px]">
            {cancelNotes.new}
          </p>
        )}
      </div>
    )
  }

  // For created with fields or updated/status_change
  return (
    <div className="space-y-0.5">
      {fields.map(([field, change]) => {
        const label = caseHistoryDAL.getFieldLabel(field)
        const oldVal = change.old
        const newVal = change.new

        // For "created", only show the new value
        if (entry.changeType === 'created') {
          return (
            <p key={field} className="text-xs text-slate-600">
              <span className="text-slate-500">{label}:</span>{' '}
              <span className="font-medium text-slate-700">{newVal ?? '—'}</span>
            </p>
          )
        }

        return (
          <p key={field} className="text-xs text-slate-600">
            <span className="text-slate-500">{label}:</span>{' '}
            <span className="text-slate-400">{oldVal ?? '(empty)'}</span>
            <span className="mx-1 text-slate-300">&rarr;</span>
            <span className="font-medium text-slate-700">{newVal ?? '(empty)'}</span>
          </p>
        )
      })}
    </div>
  )
}

// ============================================
// TIMELINE ENTRY
// ============================================

function TimelineEntry({
  entry,
  isLast,
}: {
  entry: CaseHistoryEntry
  isLast: boolean
}) {
  const typeConfig = CHANGE_TYPE_CONFIG[entry.changeType]
  const sourceConfig = SOURCE_CONFIG[entry.changeSource]
  const relative = formatRelativeTime(entry.createdAt)

  return (
    <div className="relative flex gap-3">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${typeConfig.dotColor}`}
        />
        {!isLast && (
          <div className="w-px flex-1 bg-slate-200 mt-1" />
        )}
      </div>

      {/* Entry content */}
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
        {/* Top row: change type badge + timestamp */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceConfig.badgeBg} ${sourceConfig.badgeText}`}
            >
              {sourceConfig.label}
            </span>
          </div>
          <span
            className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0"
            title={relative || undefined}
          >
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>

        {/* Change description */}
        <ChangeDescription entry={entry} />

        {/* Attribution + HL7v2 link */}
        <div className="flex items-center gap-2 mt-1">
          {entry.changedByName && (
            <span className="text-[10px] text-slate-400">
              by {entry.changedByName}
            </span>
          )}
          {!entry.changedByName && entry.changedBy === null && (
            <span className="text-[10px] text-slate-400">
              by System
            </span>
          )}
          {entry.ehrIntegrationLogId && (
            <Link
              href={`/settings/integrations/epic?tab=logs&logId=${entry.ehrIntegrationLogId}`}
              className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 hover:text-purple-700 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              View message
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

interface CaseHistoryTimelineProps {
  entries: CaseHistoryEntry[]
}

export default function CaseHistoryTimeline({ entries }: CaseHistoryTimelineProps) {
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  )

  if (sortedEntries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-slate-400 italic">
          No history recorded for this case
        </p>
        <p className="text-[10px] text-slate-300 mt-1">
          History tracking starts when the case is created or modified after this feature was enabled
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {sortedEntries.map((entry, i) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          isLast={i === sortedEntries.length - 1}
        />
      ))}
    </div>
  )
}
