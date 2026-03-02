// components/global/NotificationBell.tsx
// Notification bell for the global header.
// Badge = unread DB notifications + active dashboard alerts.
// Click opens the slide-out NotificationPanel.

'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useDashboardAlerts } from '@/lib/hooks/useDashboardAlerts'
import { useUnreadCount } from '@/lib/hooks/useUnreadCount'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell() {
  const { data: alerts } = useDashboardAlerts()
  const { count: unreadCount } = useUnreadCount()
  const [panelOpen, setPanelOpen] = useState(false)

  const alertCount = alerts?.length ?? 0
  const totalBadge = unreadCount + alertCount

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        aria-label={`Notifications${totalBadge > 0 ? ` (${totalBadge})` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {totalBadge > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      <NotificationPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </>
  )
}
