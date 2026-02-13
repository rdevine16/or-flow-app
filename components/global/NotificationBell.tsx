// components/global/NotificationBell.tsx
// Notification bell for the global header.
// Shows alert count badge and dropdown with actionable items from useDashboardAlerts.

'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileWarning,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react'
import { useDashboardAlerts, type DashboardAlert, type AlertType, type AlertPriority } from '@/lib/hooks/useDashboardAlerts'

// ============================================
// Config
// ============================================

const ALERT_ICONS: Record<AlertType, React.ElementType> = {
  validation: ClipboardCheck,
  missing_milestones: FileWarning,
  behind_schedule: Clock,
  stale_cases: CalendarClock,
}

const PRIORITY_COLORS: Record<AlertPriority, { dot: string }> = {
  high: { dot: 'bg-red-500' },
  medium: { dot: 'bg-amber-500' },
  low: { dot: 'bg-slate-400' },
}

// ============================================
// Component
// ============================================

export function NotificationBell() {
  const { data: alerts, loading } = useDashboardAlerts()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const alertCount = alerts?.length ?? 0

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        aria-label={`Notifications${alertCount > 0 ? ` (${alertCount})` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {alertCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/80 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {alertCount > 0 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {alertCount}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading...</p>
              </div>
            ) : alertCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">All clear</p>
                <p className="text-xs text-slate-400 mt-1">No items need attention.</p>
              </div>
            ) : (
              <div className="py-1">
                {alerts!.map((alert) => (
                  <NotificationItem
                    key={alert.id}
                    alert={alert}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alertCount > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                View all on Dashboard
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Notification item
// ============================================

function NotificationItem({
  alert,
  onNavigate,
}: {
  alert: DashboardAlert
  onNavigate: () => void
}) {
  const Icon = ALERT_ICONS[alert.type]
  const colors = PRIORITY_COLORS[alert.priority]

  return (
    <Link
      href={alert.linkTo}
      onClick={onNavigate}
      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
    >
      <div className={`w-2 h-2 rounded-full ${colors.dot} mt-1.5 shrink-0`} />
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-snug">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{alert.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors mt-0.5 shrink-0" />
    </Link>
  )
}
