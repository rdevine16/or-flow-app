// components/staff-management/StaffDirectoryTab.tsx
// Staff directory data table with search, role filter, and per-user time-off totals.
'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import { timeOffDAL } from '@/lib/dal/time-off'
import type { UserTimeOffSummary } from '@/types/time-off'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Search, ChevronDown, ChevronUp, Users } from 'lucide-react'

// ============================================
// Types
// ============================================

interface StaffDirectoryTabProps {
  facilityId: string
}

type SortField = 'name' | 'role' | 'email' | 'total_days'
type SortDirection = 'asc' | 'desc'

// ============================================
// Role display helpers
// ============================================

const ROLE_BADGE_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'info' | 'purple' | 'error'> = {
  surgeon: 'info',
  nurse: 'success',
  'scrub tech': 'purple',
  anesthesiologist: 'warning',
  pa: 'default',
  'first assist': 'default',
  'device rep': 'error',
}

function getRoleBadgeVariant(roleName: string | null): 'default' | 'success' | 'warning' | 'info' | 'purple' | 'error' {
  if (!roleName) return 'default'
  return ROLE_BADGE_VARIANTS[roleName.toLowerCase()] ?? 'default'
}

// ============================================
// Access level labels
// ============================================

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  global_admin: 'Global Admin',
  facility_admin: 'Facility Admin',
  coordinator: 'Coordinator',
  user: 'Staff',
}

// ============================================
// Component
// ============================================

export function StaffDirectoryTab({ facilityId }: StaffDirectoryTabProps) {
  const currentYear = new Date().getFullYear()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Sort
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Expanded row
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Lookups
  const { data: roles } = useUserRoles()

  // Data fetch: staff list + time-off totals in parallel
  const { data, loading, errors, refetch } = useSupabaseQueries<{
    staff: UserListItem[]
    totals: UserTimeOffSummary[]
  }>(
    {
      staff: async (supabase) => {
        const result = await usersDAL.listByFacility(supabase, facilityId)
        if (result.error) throw result.error
        return result.data
      },
      totals: async (supabase) => {
        const result = await timeOffDAL.fetchUserTimeOffTotals(supabase, facilityId, currentYear)
        if (result.error) throw result.error
        return result.data
      },
    },
    { deps: [facilityId, currentYear], enabled: !!facilityId }
  )

  // Build totals lookup map
  const totalsMap = useMemo(() => {
    const map = new Map<string, UserTimeOffSummary>()
    if (data?.totals) {
      for (const t of data.totals) {
        map.set(t.user_id, t)
      }
    }
    return map
  }, [data?.totals])

  // Filter + sort staff
  const filteredStaff = useMemo(() => {
    if (!data?.staff) return []

    let items = data.staff

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (u) =>
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
      )
    }

    // Role filter
    if (roleFilter !== 'all') {
      items = items.filter((u) => u.role_id === roleFilter)
    }

    // Sort
    items = [...items].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
          break
        case 'role': {
          const roleA = getRoleName(a) ?? ''
          const roleB = getRoleName(b) ?? ''
          cmp = roleA.localeCompare(roleB)
          break
        }
        case 'email':
          cmp = (a.email ?? '').localeCompare(b.email ?? '')
          break
        case 'total_days': {
          const daysA = totalsMap.get(a.id)?.total_days ?? 0
          const daysB = totalsMap.get(b.id)?.total_days ?? 0
          cmp = daysA - daysB
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return items
  }, [data?.staff, searchQuery, roleFilter, sortField, sortDirection, totalsMap])

  // Column sort toggle
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
  }

  if (loading) return <PageLoader />

  const errorMsg = errors.staff ? String(errors.staff) : errors.totals ? String(errors.totals) : null
  if (errorMsg) return <ErrorBanner message={errorMsg} onRetry={refetch} />

  return (
    <div className="space-y-4">
      {/* Toolbar: search + role filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Roles</option>
          {(roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Count */}
        <span className="text-sm text-slate-500 whitespace-nowrap">
          {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredStaff.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No staff members found</p>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery || roleFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'No active staff in this facility.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="grid items-center px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 140px 200px 180px 100px' }}
            >
              <button className="text-left" onClick={() => toggleSort('name')}>
                Name <SortIcon field="name" />
              </button>
              <button className="text-left" onClick={() => toggleSort('role')}>
                Role <SortIcon field="role" />
              </button>
              <button className="text-left" onClick={() => toggleSort('email')}>
                Email <SortIcon field="email" />
              </button>
              <button className="text-left" onClick={() => toggleSort('total_days')}>
                Time Off (YTD) <SortIcon field="total_days" />
              </button>
              <div className="text-left">Access</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filteredStaff.map((user) => {
                const roleName = getRoleName(user)
                const totals = totalsMap.get(user.id)
                const isExpanded = expandedUserId === user.id

                return (
                  <div key={user.id}>
                    <div
                      className="grid items-center px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      style={{ gridTemplateColumns: '1fr 140px 200px 180px 100px' }}
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {user.first_name} {user.last_name}
                          </p>
                        </div>
                      </div>

                      {/* Role */}
                      <div>
                        {roleName ? (
                          <Badge variant={getRoleBadgeVariant(roleName)} size="sm">
                            {roleName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>

                      {/* Email */}
                      <div className="text-sm text-slate-600 truncate">
                        {user.email ?? '—'}
                      </div>

                      {/* Time-Off Totals */}
                      <div className="text-sm text-slate-600">
                        {totals ? (
                          <TimeOffInline totals={totals} />
                        ) : (
                          <span className="text-slate-400">0d</span>
                        )}
                      </div>

                      {/* Access Level */}
                      <div className="text-xs text-slate-500">
                        {ACCESS_LEVEL_LABELS[user.access_level] ?? user.access_level}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <StaffRowDetail user={user} totals={totals} />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function getRoleName(user: UserListItem): string | null {
  if (!user.role) return null
  if (Array.isArray(user.role)) return (user.role as { name: string }[])[0]?.name ?? null
  return user.role.name
}

/** Inline time-off totals: "PTO: 5d | Sick: 2d" */
function TimeOffInline({ totals }: { totals: UserTimeOffSummary }) {
  const parts: string[] = []
  if (totals.pto_days > 0) parts.push(`PTO: ${formatDays(totals.pto_days)}`)
  if (totals.sick_days > 0) parts.push(`Sick: ${formatDays(totals.sick_days)}`)
  if (totals.personal_days > 0) parts.push(`Personal: ${formatDays(totals.personal_days)}`)

  if (parts.length === 0) return <span className="text-slate-400">0d</span>

  return <span>{parts.join(' | ')}</span>
}

/** Expanded row detail panel */
function StaffRowDetail({
  user,
  totals,
}: {
  user: UserListItem
  totals: UserTimeOffSummary | undefined
}) {
  const roleName = getRoleName(user)

  return (
    <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-1">Full Name</p>
          <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Email</p>
          <p className="text-slate-700">{user.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Role</p>
          <p className="text-slate-700">{roleName ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Access Level</p>
          <p className="text-slate-700">{ACCESS_LEVEL_LABELS[user.access_level] ?? user.access_level}</p>
        </div>
      </div>

      {/* Time-off breakdown */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 mb-2">Time Off This Year</p>
        <div className="flex items-center gap-4">
          <TimeOffBadge label="PTO" days={totals?.pto_days ?? 0} variant="info" />
          <TimeOffBadge label="Sick" days={totals?.sick_days ?? 0} variant="warning" />
          <TimeOffBadge label="Personal" days={totals?.personal_days ?? 0} variant="purple" />
          <div className="ml-auto text-sm font-medium text-slate-700">
            Total: {formatDays(totals?.total_days ?? 0)}
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>
            Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
          </span>
          <span>
            Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
          </span>
          <span>
            Status: {user.is_active ? (
              <span className="text-green-600 font-medium">Active</span>
            ) : (
              <span className="text-red-600 font-medium">Inactive</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function TimeOffBadge({
  label,
  days,
  variant,
}: {
  label: string
  days: number
  variant: 'info' | 'warning' | 'purple'
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={variant} size="sm">{label}</Badge>
      <span className="text-sm text-slate-700">{formatDays(days)}</span>
    </div>
  )
}

function formatDays(days: number): string {
  if (days === 0) return '0d'
  if (Number.isInteger(days)) return `${days}d`
  return `${days.toFixed(1)}d`
}
