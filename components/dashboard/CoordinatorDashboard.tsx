// components/dashboard/CoordinatorDashboard.tsx
// Dashboard for the Coordinator subscription tier.
// Shows block schedule, staff on duty, upcoming time-off, holidays, and quick links.

'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  Gift,
  UserCog,
  Users,
} from 'lucide-react'
import { useCoordinatorDashboard } from '@/lib/hooks/useCoordinatorDashboard'
import { formatTimeRange } from '@/types/block-scheduling'

// ============================================
// Skeleton
// ============================================

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="h-5 bg-slate-200 rounded w-32 mb-4 animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ============================================
// Component
// ============================================

export function CoordinatorDashboard() {
  const { data, loading } = useCoordinatorDashboard()

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const blocks = data?.blocks ?? []
  const staff = data?.staff ?? []
  const timeOff = data?.timeOff ?? []
  const holidays = data?.holidays ?? []

  return (
    <div className="space-y-6">
      {/* Top row: Today's Blocks + Staff On Duty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Block Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Block Schedule</h2>
            <span className="ml-auto text-xs text-slate-400">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="p-4">
            {blocks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No blocks scheduled today</p>
            ) : (
              <div className="space-y-2">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{block.surgeonName}</p>
                      {block.roomName && (
                        <p className="text-xs text-slate-500">{block.roomName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatTimeRange(block.startTime, block.endTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Staff On Duty */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Staff On Duty</h2>
            <span className="ml-auto text-xs text-slate-400">{staff.length} active</span>
          </div>
          <div className="p-4">
            {staff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No staff on duty</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {staff.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <p className="text-sm text-slate-900">
                        {s.firstName} {s.lastName}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 capitalize">{s.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Upcoming Time-Off + Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Time-Off */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Time-Off</h2>
            <span className="ml-auto text-xs text-slate-400">Next 7 days</span>
          </div>
          <div className="p-4">
            {timeOff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No upcoming time-off</p>
            ) : (
              <div className="space-y-2">
                {timeOff.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{req.userName}</p>
                      <p className="text-xs text-slate-500 capitalize">{req.requestType}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDateRange(req.startDate, req.endDate)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Holidays */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Holidays</h2>
          </div>
          <div className="p-4">
            {holidays.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No upcoming holidays</p>
            ) : (
              <div className="space-y-2">
                {holidays.map((h) => (
                  <div
                    key={h.date}
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{h.name}</p>
                      {h.isPartial && h.partialCloseTime && (
                        <p className="text-xs text-amber-600">
                          Early close at {formatTime(h.partialCloseTime)}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{formatHolidayDate(h.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/block-schedule"
            className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                Block Schedule
              </h3>
            </div>
            <p className="text-xs text-slate-500">Manage surgeon block assignments and room scheduling</p>
          </Link>
          <Link
            href="/staff-management"
            className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-2">
              <UserCog className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                Staff Management
              </h3>
            </div>
            <p className="text-xs text-slate-500">Staff directory, time-off, and holiday management</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Helpers
// ============================================

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (start === end) return s.toLocaleDateString('en-US', opts)
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function formatHolidayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
}
