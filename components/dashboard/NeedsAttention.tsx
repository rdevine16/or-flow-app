// components/dashboard/NeedsAttention.tsx
// Actionable alert list for the facility admin dashboard.
// Surfaces operational issues from real data queries, prioritized by severity.

'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileWarning,
  CalendarClock,
} from 'lucide-react'
import type { DashboardAlert, AlertType, AlertPriority } from '@/lib/hooks/useDashboardAlerts'

// ============================================
// Config
// ============================================

const MAX_VISIBLE = 6

const ALERT_ICONS: Record<AlertType, React.ElementType> = {
  validation: ClipboardCheck,
  missing_milestones: FileWarning,
  behind_schedule: Clock,
  stale_cases: CalendarClock,
}

const PRIORITY_COLORS: Record<AlertPriority, { dot: string; bg: string }> = {
  high: { dot: 'bg-red-500', bg: 'hover:bg-red-50/50' },
  medium: { dot: 'bg-amber-500', bg: 'hover:bg-amber-50/50' },
  low: { dot: 'bg-slate-400', bg: 'hover:bg-slate-50/50' },
}

// ============================================
// Component
// ============================================

interface NeedsAttentionProps {
  alerts: DashboardAlert[]
  loading?: boolean
}

export function NeedsAttention({ alerts, loading = false }: NeedsAttentionProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-start gap-3 py-3">
              <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-64 bg-slate-100 rounded" />
              </div>
              <div className="w-4 h-4 bg-slate-100 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE)
  const hasMore = alerts.length > MAX_VISIBLE

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>
        {alerts.length > 0 && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {alerts.length} item{alerts.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1">
          {visibleAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}

          {hasMore && (
            <Link
              href="/cases"
              className="block mt-3 text-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2 rounded-lg hover:bg-blue-50/50 transition-colors"
            >
              View all ({alerts.length}) items
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Alert item
// ============================================

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const Icon = ALERT_ICONS[alert.type]
  const colors = PRIORITY_COLORS[alert.priority]

  return (
    <Link
      href={alert.linkTo}
      className={`flex items-start gap-3 py-3 px-3 -mx-3 rounded-lg transition-colors group ${colors.bg}`}
    >
      {/* Priority dot */}
      <div className={`w-2 h-2 rounded-full ${colors.dot} mt-1.5 shrink-0`} />

      {/* Icon */}
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-snug">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate">
          {alert.description}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors mt-0.5 shrink-0" />
    </Link>
  )
}

// ============================================
// Empty state
// ============================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      </div>
      <p className="text-sm font-medium text-slate-700">All clear</p>
      <p className="text-xs text-slate-400 mt-1">No items need attention right now.</p>
    </div>
  )
}
