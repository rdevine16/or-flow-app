// components/global/AnnouncementBanner.tsx
// Global announcement banners rendered in DashboardLayout.
// Displays active announcements with priority-based styling,
// expand/collapse, per-user dismissal, and Realtime live updates.

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  X,
  Megaphone,
  Wrench,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useActiveAnnouncements } from '@/hooks/useAnnouncements'
import type { Announcement, AnnouncementPriority, AnnouncementCategory } from '@/types/announcements'
import { logger } from '@/lib/logger'

const log = logger('AnnouncementBanner')

// ============================================
// PRIORITY CONFIG
// ============================================

interface PriorityConfig {
  bg: string
  text: string
  border: string
  icon: typeof Info
  dismissible: boolean
}

const PRIORITY_STYLES: Record<AnnouncementPriority, PriorityConfig> = {
  normal: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: Info,
    dismissible: true,
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertTriangle,
    dismissible: true,
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: AlertOctagon,
    dismissible: false,
  },
}

// ============================================
// CATEGORY ICONS
// ============================================

const CATEGORY_ICONS: Record<AnnouncementCategory, typeof Megaphone> = {
  general: Megaphone,
  maintenance: Wrench,
  policy_update: FileText,
  safety_alert: ShieldAlert,
}

const CATEGORY_DISPLAY: Record<AnnouncementCategory, string> = {
  general: 'General',
  maintenance: 'Maintenance',
  policy_update: 'Policy',
  safety_alert: 'Safety',
}

// ============================================
// TIME HELPERS
// ============================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const absDiffMs = Math.abs(diffMs)

  const minutes = Math.floor(absDiffMs / 60000)
  const hours = Math.floor(absDiffMs / 3600000)
  const days = Math.floor(absDiffMs / 86400000)

  if (diffMs > 0) {
    // Future — expires in
    if (days > 0) return `expires in ${days}d`
    if (hours > 0) return `expires in ${hours}h`
    return `expires in ${minutes}m`
  } else {
    // Past — created X ago
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'just now'
  }
}

// ============================================
// AUDIENCE FILTER
// ============================================

function matchesAudience(
  announcement: Announcement,
  userRoleName: string | null
): boolean {
  if (announcement.audience === 'both') return true
  const isSurgeon = userRoleName?.toLowerCase() === 'surgeon'
  if (announcement.audience === 'surgeons') return isSurgeon
  if (announcement.audience === 'staff') return !isSurgeon
  return true
}

// ============================================
// SINGLE BANNER ITEM
// ============================================

interface BannerItemProps {
  announcement: Announcement
  onDismiss: (id: string) => void
  dismissing: boolean
}

function BannerItem({ announcement, onDismiss, dismissing }: BannerItemProps) {
  const [expanded, setExpanded] = useState(false)

  const config = PRIORITY_STYLES[announcement.priority]
  const PriorityIcon = config.icon
  const CategoryIcon = CATEGORY_ICONS[announcement.category]

  const hasBody = !!announcement.body?.trim()
  const timeInfo = formatRelativeTime(announcement.expires_at)

  return (
    <div
      className={`${config.bg} ${config.border} border-b px-4 py-2.5 transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        {/* Priority icon */}
        <PriorityIcon className={`w-4 h-4 ${config.text} shrink-0`} />

        {/* Category badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}
        >
          <CategoryIcon className="w-3 h-3" />
          {CATEGORY_DISPLAY[announcement.category]}
        </span>

        {/* Title + time */}
        <button
          type="button"
          className={`flex-1 text-left text-sm font-medium ${config.text} ${hasBody ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
          onClick={() => hasBody && setExpanded(!expanded)}
          disabled={!hasBody}
        >
          {announcement.title}
        </button>

        <span className={`text-xs ${config.text} opacity-70 shrink-0`}>
          {timeInfo}
        </span>

        {/* Expand chevron (only if body exists) */}
        {hasBody && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`p-0.5 rounded hover:bg-black/5 ${config.text}`}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Dismiss button (not for critical) */}
        {config.dismissible && (
          <button
            type="button"
            onClick={() => onDismiss(announcement.id)}
            disabled={dismissing}
            className={`p-0.5 rounded hover:bg-black/5 ${config.text} ${dismissing ? 'opacity-50' : ''}`}
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded body */}
      {expanded && hasBody && (
        <div className={`mt-2 ml-7 text-sm ${config.text} opacity-80`}>
          {announcement.body}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AnnouncementBanner() {
  const { userData, effectiveFacilityId, isGlobalAdmin } = useUser()
  const facilityId = effectiveFacilityId
  const userId = userData.userId
  const roleName = userData.roleName

  const {
    announcements,
    loading,
    refetch,
    dismissAnnouncement,
  } = useActiveAnnouncements({ facilityId, userId })

  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  // ============================================
  // Realtime subscription
  // ============================================

  useEffect(() => {
    if (!facilityId) return

    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()
      channel = supabase
        .channel(`announcements:${facilityId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'announcements',
            filter: `facility_id=eq.${facilityId}`,
          },
          () => {
            log.info('Realtime announcement change detected, refetching')
            refetch()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel!)
      }
    } catch {
      log.warn('Failed to subscribe to announcement Realtime channel')
      return undefined
    }
  }, [facilityId, refetch])

  // ============================================
  // Dismiss handler
  // ============================================

  const handleDismiss = useCallback(
    async (announcementId: string) => {
      setDismissingIds((prev) => new Set(prev).add(announcementId))
      try {
        const result = await dismissAnnouncement(announcementId)
        if (!result.success) {
          log.warn('Failed to dismiss announcement', { announcementId, error: result.error })
        }
      } finally {
        setDismissingIds((prev) => {
          const next = new Set(prev)
          next.delete(announcementId)
          return next
        })
      }
    },
    [dismissAnnouncement]
  )

  // ============================================
  // Filter by audience
  // ============================================

  const filteredAnnouncements = useMemo(() => {
    if (!announcements || !Array.isArray(announcements)) return []
    return announcements.filter((a) => matchesAudience(a, roleName))
  }, [announcements, roleName])

  // ============================================
  // Render
  // ============================================

  // Global admins manage announcements — they don't need to see banners
  if (isGlobalAdmin) return null

  if (loading || filteredAnnouncements.length === 0) {
    return null
  }

  return (
    <div data-testid="announcement-banner-stack">
      {filteredAnnouncements.map((announcement) => (
        <BannerItem
          key={announcement.id}
          announcement={announcement}
          onDismiss={handleDismiss}
          dismissing={dismissingIds.has(announcement.id)}
        />
      ))}
    </div>
  )
}
