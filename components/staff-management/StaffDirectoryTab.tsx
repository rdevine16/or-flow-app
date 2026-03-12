// components/staff-management/StaffDirectoryTab.tsx
// Staff directory data table with search, role filter, account status, and per-user time-off totals.
// Clicking a row opens the StaffDetailDrawer (Phase 11).
'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import { timeOffDAL } from '@/lib/dal/time-off'
import type { UserTimeOffSummary } from '@/types/time-off'
import Badge from '@/components/ui/Badge'
import { UserTimeOffSummaryDisplay } from './UserTimeOffSummary'
import { deriveAccountStatus, STATUS_CONFIG } from './DrawerProfileTab'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Search, ChevronDown, ChevronUp, Users, Plus, Eye, EyeOff } from 'lucide-react'

// ============================================
// Types
// ============================================

interface StaffDirectoryTabProps {
  facilityId: string
  onSelectUser: (user: UserListItem) => void
  showDeactivated: boolean
  onToggleDeactivated: () => void
  onAddStaff: () => void
}

type SortField = 'name' | 'role' | 'email' | 'total_days' | 'status'
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
// Status sort order
// ============================================

const STATUS_SORT_ORDER: Record<string, number> = {
  active: 0,
  pending: 1,
  inactive: 2,
}

// ============================================
// Component
// ============================================

export function StaffDirectoryTab({
  facilityId,
  onSelectUser,
  showDeactivated,
  onToggleDeactivated,
  onAddStaff,
}: StaffDirectoryTabProps) {
  const currentYear = new Date().getFullYear()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Sort
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Lookups
  const { data: roles } = useUserRoles()

  // Data fetch: staff list + time-off totals in parallel
  const { data, loading, errors, refetch } = useSupabaseQueries<{
    staff: UserListItem[]
    totals: UserTimeOffSummary[]
  }>(
    {
      staff: async (supabase) => {
        const result = await usersDAL.listByFacility(supabase, facilityId, showDeactivated)
        if (result.error) throw result.error
        return result.data
      },
      totals: async (supabase) => {
        const result = await timeOffDAL.fetchUserTimeOffTotals(supabase, facilityId, currentYear)
        if (result.error) throw result.error
        return result.data
      },
    },
    { deps: [facilityId, currentYear, showDeactivated], enabled: !!facilityId }
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

    // When showDeactivated, only show inactive; otherwise only active
    if (showDeactivated) {
      items = items.filter((u) => !u.is_active)
    } else {
      items = items.filter((u) => u.is_active)
    }

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
        case 'status': {
          const statusA = deriveAccountStatus(a)
          const statusB = deriveAccountStatus(b)
          cmp = (STATUS_SORT_ORDER[statusA] ?? 9) - (STATUS_SORT_ORDER[statusB] ?? 9)
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return items
  }, [data?.staff, searchQuery, roleFilter, sortField, sortDirection, totalsMap, showDeactivated])

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

        {/* View Deactivated toggle */}
        <button
          onClick={onToggleDeactivated}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
            ${showDeactivated
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
        >
          {showDeactivated ? (
            <>
              <EyeOff className="w-4 h-4" />
              View Active
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              View Deactivated
            </>
          )}
        </button>

        {/* Count */}
        <span className="text-sm text-slate-500 whitespace-nowrap">
          {filteredStaff.length} {showDeactivated ? 'deactivated' : 'active'} member{filteredStaff.length !== 1 ? 's' : ''}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add Staff */}
        {!showDeactivated && (
          <button
            onClick={onAddStaff}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Staff
          </button>
        )}
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
              style={{ gridTemplateColumns: '1fr 140px 180px 100px 100px' }}
            >
              <button className="text-left" onClick={() => toggleSort('name')}>
                Name <SortIcon field="name" />
              </button>
              <button className="text-left" onClick={() => toggleSort('role')}>
                Role <SortIcon field="role" />
              </button>
              <button className="text-left" onClick={() => toggleSort('total_days')}>
                Time Off (YTD) <SortIcon field="total_days" />
              </button>
              <button className="text-left" onClick={() => toggleSort('status')}>
                Status <SortIcon field="status" />
              </button>
              <div className="text-left">Access</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filteredStaff.map((user) => {
                const roleName = getRoleName(user)
                const totals = totalsMap.get(user.id)
                const accountStatus = deriveAccountStatus(user)
                const statusCfg = STATUS_CONFIG[accountStatus]

                return (
                  <div
                    key={user.id}
                    className={`grid items-center px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}
                    style={{ gridTemplateColumns: '1fr 140px 180px 100px 100px' }}
                    onClick={() => onSelectUser(user)}
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
                        <p className="text-xs text-slate-500 truncate">{user.email ?? ''}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      {roleName ? (
                        <Badge variant={getRoleBadgeVariant(roleName)} size="sm">
                          {roleName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </div>

                    {/* Time-Off Totals */}
                    <div className="text-sm text-slate-600">
                      <UserTimeOffSummaryDisplay totals={totals} variant="inline" />
                    </div>

                    {/* Account Status */}
                    <div>
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Access Level */}
                    <div className="text-xs text-slate-500">
                      {ACCESS_LEVEL_LABELS[user.access_level] ?? user.access_level}
                    </div>
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
// Helpers
// ============================================

function getRoleName(user: UserListItem): string | null {
  if (!user.role) return null
  if (Array.isArray(user.role)) return (user.role as { name: string }[])[0]?.name ?? null
  return user.role.name
}
