// components/global/ActiveAlertCard.tsx
// Active (computed) alert card for the notification panel.
// Displays priority dot, icon, title, description, dismiss button, and click-through.
// Fade-out animation on dismiss before removing from DOM.

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  X,
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

const ALERT_ICONS: Record<AlertType, React.ElementType> = {
  validation: ClipboardCheck,
  missing_milestones: FileWarning,
  behind_schedule: Clock,
  stale_cases: CalendarClock,
}

const PRIORITY_COLORS: Record<AlertPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
}

const DISMISS_DURATION_MS = 250

// ============================================
// Component
// ============================================

interface ActiveAlertCardProps {
  alert: DashboardAlert
  onDismiss: (id: string) => void
  onNavigate: () => void
}

export function ActiveAlertCard({ alert, onDismiss, onNavigate }: ActiveAlertCardProps) {
  const Icon = ALERT_ICONS[alert.type]
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissing(true)
    // Wait for fade-out animation to complete, then trigger actual dismiss
    setTimeout(() => onDismiss(alert.id), DISMISS_DURATION_MS)
  }, [alert.id, onDismiss])

  return (
    <Link
      href={alert.linkTo}
      onClick={onNavigate}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-amber-50/50 transition-all group rounded-lg ${
        dismissing
          ? 'opacity-0 scale-95 max-h-0 py-0 overflow-hidden'
          : 'opacity-100 scale-100 max-h-24'
      }`}
      style={{ transitionDuration: `${DISMISS_DURATION_MS}ms` }}
    >
      <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[alert.priority]} mt-1.5 shrink-0`} />
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-snug">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{alert.description}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200"
        aria-label="Dismiss alert"
        title="Dismiss until next refresh"
      >
        <X className="w-3.5 h-3.5 text-slate-400" />
      </button>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors mt-0.5 shrink-0" />
    </Link>
  )
}
