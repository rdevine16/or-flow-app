// components/staff-management/CoverageIndicator.tsx
// Shows available staff count per role for a given date range.
// Compares total active staff minus approved time-off for each date.
// Used in the TimeOffReviewModal to show coverage impact.
'use client'

import type { TimeOffRequest } from '@/types/time-off'
import type { UserListItem } from '@/lib/dal/users'
import { AlertTriangle, CheckCircle } from 'lucide-react'

// ============================================
// Types
// ============================================

interface CoverageIndicatorProps {
  /** All approved time-off requests for the facility */
  approvedRequests: TimeOffRequest[]
  /** Full staff list for the facility */
  staffList: UserListItem[]
  /** The date range being evaluated (from the request under review) */
  startDate: string
  endDate: string
  /** If true, includes the request under review in the "off" count (simulates approval) */
  includeRequestUserId?: string
}

interface RoleCoverage {
  roleName: string
  total: number
  off: number
  available: number
}

// ============================================
// Helpers
// ============================================

function getRoleName(user: UserListItem): string {
  if (!user.role) return 'Unassigned'
  if (Array.isArray(user.role)) return (user.role as { name: string }[])[0]?.name ?? 'Unassigned'
  return user.role.name
}

/**
 * For each date in the range, find users who are off.
 * Returns the worst-case day (most people off) as the aggregate.
 */
function computeRoleCoverage(
  staffList: UserListItem[],
  approvedRequests: TimeOffRequest[],
  startDate: string,
  endDate: string,
  includeUserId?: string,
): RoleCoverage[] {
  const activeStaff = staffList.filter((s) => s.is_active)

  // Group staff by role
  const staffByRole = new Map<string, UserListItem[]>()
  for (const s of activeStaff) {
    const role = getRoleName(s)
    const arr = staffByRole.get(role) ?? []
    arr.push(s)
    staffByRole.set(role, arr)
  }

  // Find worst-case day: iterate each business day in the range
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const current = new Date(start)

  // Track max off per role across all days
  const maxOffByRole = new Map<string, Set<string>>()

  while (current <= end) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateStr = formatDateStr(current)

      for (const [role, members] of staffByRole) {
        const offSet = new Set<string>()

        for (const member of members) {
          // Check if member has approved time off on this date
          const isOff = approvedRequests.some(
            (r) =>
              r.user_id === member.id &&
              r.start_date <= dateStr &&
              r.end_date >= dateStr,
          )
          // Also count the user whose request is being reviewed
          const isRequestUser = includeUserId === member.id

          if (isOff || isRequestUser) {
            offSet.add(member.id)
          }
        }

        const existing = maxOffByRole.get(role)
        if (!existing || offSet.size > existing.size) {
          maxOffByRole.set(role, offSet)
        }
      }
    }
    current.setDate(current.getDate() + 1)
  }

  // Build result
  const results: RoleCoverage[] = []
  for (const [role, members] of staffByRole) {
    const off = maxOffByRole.get(role)?.size ?? 0
    results.push({
      roleName: role,
      total: members.length,
      off,
      available: members.length - off,
    })
  }

  return results.sort((a, b) => a.roleName.localeCompare(b.roleName))
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ============================================
// Component
// ============================================

export function CoverageIndicator({
  approvedRequests,
  staffList,
  startDate,
  endDate,
  includeRequestUserId,
}: CoverageIndicatorProps) {
  const roleCoverage = computeRoleCoverage(
    staffList,
    approvedRequests,
    startDate,
    endDate,
    includeRequestUserId,
  )

  if (roleCoverage.length === 0) return null

  const hasWarning = roleCoverage.some(
    (rc) => rc.total > 0 && rc.available <= Math.ceil(rc.total * 0.5),
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {hasWarning ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        )}
        <span>Coverage Impact {includeRequestUserId ? '(if approved)' : ''}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="status" aria-label="Staff coverage by role">
        {roleCoverage.map((rc) => {
          const isLow = rc.total > 0 && rc.available <= Math.ceil(rc.total * 0.5)
          return (
            <div
              key={rc.roleName}
              className={`
                flex items-center justify-between px-3 py-1.5 rounded-lg text-sm
                ${isLow ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700'}
              `}
              aria-label={`${rc.roleName}: ${rc.available} of ${rc.total} available${isLow ? ', low coverage' : ''}`}
            >
              <span className="font-medium truncate">{rc.roleName}</span>
              <span className={`tabular-nums ${isLow ? 'font-semibold' : ''}`}>
                {rc.available}/{rc.total}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
