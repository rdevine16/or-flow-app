// components/global/NotificationCard.tsx
// Individual notification card for the notification panel.
// Displays icon, title, message preview, timestamp, unread dot, and click-through.

'use client'

import { useRouter } from 'next/navigation'
import {
  LinkIcon,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Ban,
  Bell,
  CheckCircle,
  CalendarPlus,
  XCircle,
} from 'lucide-react'
import type { NotificationWithReadState } from '@/lib/dal/notifications'

// ============================================
// Config: notification type → icon + color
// ============================================

const NOTIFICATION_TYPE_CONFIG: Record<string, {
  icon: React.ElementType
  color: string
}> = {
  case_auto_created: { icon: FileCheck, color: 'text-green-500' },
  case_auto_updated: { icon: RefreshCw, color: 'text-blue-500' },
  case_auto_cancelled: { icon: Ban, color: 'text-red-500' },
  data_quality_issue: { icon: AlertTriangle, color: 'text-amber-500' },
  time_off_requested: { icon: CalendarPlus, color: 'text-blue-500' },
  time_off_approved: { icon: CheckCircle, color: 'text-green-500' },
  time_off_denied: { icon: XCircle, color: 'text-red-500' },
}

const DEFAULT_CONFIG = { icon: Bell, color: 'text-slate-400' }

// ============================================
// Helpers
// ============================================

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

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Get the source label from metadata */
function getSourceLabel(metadata: Record<string, unknown>): string | null {
  if (metadata.source === 'epic_hl7v2') return 'via Epic HL7v2'
  return null
}

// ============================================
// Component
// ============================================

interface NotificationCardProps {
  notification: NotificationWithReadState
  onMarkAsRead: (id: string) => void
  onNavigate: () => void
}

export function NotificationCard({ notification, onMarkAsRead, onNavigate }: NotificationCardProps) {
  const router = useRouter()
  const config = NOTIFICATION_TYPE_CONFIG[notification.type] ?? DEFAULT_CONFIG
  const Icon = config.icon
  const metadata = notification.metadata ?? {}
  const linkTo = metadata.link_to as string | undefined
  const sourceLabel = getSourceLabel(metadata)

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
    if (linkTo) {
      router.push(linkTo)
      onNavigate()
    }
  }

  const handleMarkReadClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMarkAsRead(notification.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
    >
      {/* Unread dot */}
      <div className="w-2 shrink-0 pt-2">
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Icon */}
      <div className={`shrink-0 mt-0.5 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-1">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {notification.message}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {sourceLabel && (
            <>
              <span className="text-[10px] text-slate-400">{sourceLabel}</span>
              <span className="text-[10px] text-slate-300">&middot;</span>
            </>
          )}
          <span className="text-[10px] text-slate-400">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
      </div>

      {/* Mark as read button (hover only) */}
      {!notification.is_read && (
        <button
          onClick={handleMarkReadClick}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200"
          aria-label="Mark as read"
          title="Mark as read"
        >
          <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}

      {/* Link indicator */}
      {linkTo && (
        <LinkIcon className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-1" />
      )}
    </div>
  )
}
