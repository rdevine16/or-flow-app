// components/staff-management/StaffDirectoryTab.tsx
// Staff directory data table with search, role filter, account status, and per-user time-off totals.
// Clicking a row opens the StaffDetailDrawer (Phase 11).
'use client'

import { useMemo, useState } from 'react'
import { useSupabaseQueries } from '@/hooks/useSupabaseQuery'
import { useUserRoles } from '@/hooks/useLookups'
import { usersDAL, type UserListItem, type PendingInvite } from '@/lib/dal/users'
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
  facilityId: string | null
  onSelectUser: (user: UserListItem) => void
  showDeactivated: boolean
  onToggleDeactivated: () => void
  onAddStaff?: () => void
  isAllFacilitiesMode?: boolean
}

type SortField = 'name' | 'role' | 'email' | 'total_days' | 'status' | 'facility'
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
  not_configured: 2,
  inactive: 3,
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
  isAllFacilitiesMode = false,
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

  // Data fetch: staff list + pending invites + time-off totals in parallel
  const { data, loading, errors, refetch } = useSupabaseQueries<{
    staff: UserListItem[]
    pendingInvites: PendingInvite[]
    totals: UserTimeOffSummary[]
  }>(
    {
      staff: async (supabase) => {
        if (isAllFacilitiesMode) {
          const result = await usersDAL.listAllFacilities(supabase, showDeactivated)
          if (result.error) throw result.error
          return result.data
        }
        if (!facilityId) return []
        const result = await usersDAL.listByFacility(supabase, facilityId, showDeactivated)
        if (result.error) throw result.error
        return result.data
      },
      pendingInvites: async (supabase) => {
        // Only fetch pending invites in active (non-deactivated) view
        if (showDeactivated) return []
        if (isAllFacilitiesMode) {
          const result = await usersDAL.listAllPendingInvites(supabase)
          if (result.error) throw result.error
          return result.data
        }
        if (!facilityId) return []
        const result = await usersDAL.listPendingInvites(supabase, facilityId)
        if (result.error) throw result.error
        return result.data
      },
      totals: async (supabase) => {
        // Time-off totals require a specific facility
        if (!facilityId) return []
        const result = await timeOffDAL.fetchUserTimeOffTotals(supabase, facilityId, currentYear)
        if (result.error) throw result.error
        return result.data
      },
    },
    { deps: [facilityId, currentYear, showDeactivated, isAllFacilitiesMode], enabled: !!facilityId || isAllFacilitiesMode }
  )

  // Convert pending invites to UserListItem shape so they appear in the staff table
  const pendingAsUsers: UserListItem[] = useMemo(() => {
    if (!data?.pendingInvites) return []
    return data.pendingInvites.map((inv): UserListItem => ({
      id: `invite-${inv.id}`,
      email: inv.email,
      first_name: inv.first_name,
      last_name: inv.last_name,
      role_id: inv.role_id,
      facility_id: inv.facility_id,
      is_active: true,
      access_level: inv.access_level,
      last_login_at: null,
      created_at: inv.created_at,
      role: inv.role_name ? { name: inv.role_name } : null,
      facility: inv.facility_name ? { name: inv.facility_name } : null,
      _isPendingInvite: true,
    }))
  }, [data?.pendingInvites])

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

  // Filter + sort staff (includes pending invites merged in)
  const filteredStaff = useMemo(() => {
    if (!data?.staff) return []

    let items = [...data.staff, ...pendingAsUsers]

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
        case 'facility': {
          const facA = getFacilityName(a) ?? ''
          const facB = getFacilityName(b) ?? ''
          cmp = facA.localeCompare(facB)
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return items
  }, [data?.staff, pendingAsUsers, searchQuery, roleFilter, sortField, sortDirection, totalsMap, showDeactivated])

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
            aria-label="Search staff by name or email"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
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

        {/* Add Staff (only when manage permission granted) */}
        {!showDeactivated && onAddStaff && (
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
          <div className="overflow-x-auto" role="table" aria-label="Staff directory">
            {/* Header */}
            <div
              className="grid items-center px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[600px]"
              role="row"
              style={{
                gridTemplateColumns: isAllFacilitiesMode
                  ? '1fr 140px 140px 100px 100px'
                  : '1fr 140px 180px 100px 100px',
              }}
            >
              <button className="text-left" onClick={() => toggleSort('name')} aria-label={`Sort by name ${sortField === 'name' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`} role="columnheader">
                Name <SortIcon field="name" />
              </button>
              <button className="text-left" onClick={() => toggleSort('role')} aria-label={`Sort by role`} role="columnheader">
                Role <SortIcon field="role" />
              </button>
              {isAllFacilitiesMode ? (
                <button className="text-left" onClick={() => toggleSort('facility')} aria-label="Sort by facility" role="columnheader">
                  Facility <SortIcon field="facility" />
                </button>
              ) : (
                <button className="text-left" onClick={() => toggleSort('total_days')} aria-label="Sort by time off" role="columnheader">
                  Time Off (YTD) <SortIcon field="total_days" />
                </button>
              )}
              <button className="text-left" onClick={() => toggleSort('status')} aria-label="Sort by status" role="columnheader">
                Status <SortIcon field="status" />
              </button>
              <div className="text-left" role="columnheader">Access</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filteredStaff.map((user) => {
                const roleName = getRoleName(user)
                const totals = totalsMap.get(user.id)
                const isPending = user._isPendingInvite
                const accountStatus = isPending ? 'pending' as const : deriveAccountStatus(user)
                const statusCfg = STATUS_CONFIG[accountStatus]

                return (
                  <div
                    key={user.id}
                    className={`grid items-center px-4 py-3 transition-colors min-w-[600px] ${!user.is_active ? 'opacity-60' : ''} ${isPending ? 'bg-amber-50/40' : 'cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500'}`}
                    style={{
                      gridTemplateColumns: isAllFacilitiesMode
                        ? '1fr 140px 140px 100px 100px'
                        : '1fr 140px 180px 100px 100px',
                    }}
                    role="row"
                    tabIndex={isPending ? undefined : 0}
                    onClick={isPending ? undefined : () => onSelectUser(user)}
                    onKeyDown={isPending ? undefined : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectUser(user)
                      }
                    }}
                    aria-label={`${user.first_name} ${user.last_name}, ${roleName ?? 'no role'}, ${statusCfg.label}`}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0" role="cell">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0" aria-hidden="true">
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
                    <div role="cell">
                      {roleName ? (
                        <Badge variant={getRoleBadgeVariant(roleName)} size="sm">
                          {roleName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </div>

                    {/* Facility (all-facilities mode) or Time-Off Totals */}
                    <div role="cell">
                      {isAllFacilitiesMode ? (
                        <span className="text-sm text-slate-600 truncate">
                          {getFacilityName(user) ?? <span className="text-slate-400">&mdash;</span>}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">
                          <UserTimeOffSummaryDisplay totals={totals} variant="inline" />
                        </span>
                      )}
                    </div>

                    {/* Account Status */}
                    <div role="cell">
                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Access Level */}
                    <div className="text-xs text-slate-500" role="cell">
                      {ACCESS_LEVEL_LABELS[user.access_level] ?? user.access_level}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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

function getFacilityName(user: UserListItem): string | null {
  if (!user.facility) return null
  if (Array.isArray(user.facility)) return (user.facility as { name: string }[])[0]?.name ?? null
  return user.facility.name
}
