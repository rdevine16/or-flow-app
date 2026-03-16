// app/settings/permissions/page.tsx
// Facility Admin — Roles & Permissions
//
// Two-column layout: searchable category list on the left,
// permission toggles for the selected category on the right.
// Tabs at top select User vs Coordinator access level.

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { PermissionMatrix, Permission } from '@/components/permissions/PermissionMatrix'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import AccessDenied from '@/components/ui/AccessDenied'
import { Info, Search, Shield } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

type AccessLevel = 'user' | 'coordinator'

interface FacilityPermission {
  id: string
  facility_id: string
  access_level: string
  permission_key: string
  granted: boolean
}

interface CategoryItem {
  category: string
  count: number
}

// =====================================================
// CONSTANTS
// =====================================================

const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'coordinator', label: 'Coordinator' },
]

/** Permission categories visible to the coordinator subscription tier */
const COORDINATOR_TIER_CATEGORIES = new Set(['Scheduling', 'Settings', 'Admin'])

// =====================================================
// COMPONENT
// =====================================================

export default function FacilityPermissionsPage() {
  const supabase = createClient()
  const { isAdmin, loading: userLoading, userData, effectiveFacilityId, can, isTierAtLeast } = useUser()
  const { showToast } = useToast()

  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('user')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch all permissions (master registry)
  const {
    data: permissions,
    loading: permsLoading,
    error: permsError,
  } = useSupabaseQuery<Permission[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('permissions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    { deps: [], enabled: !userLoading && isAdmin },
  )

  // Fetch facility permissions for the selected access level
  const {
    data: facilityPerms,
    loading: facilityPermsLoading,
    error: facilityPermsError,
    setData: setFacilityPerms,
    refetch: refetchFacilityPerms,
  } = useSupabaseQuery<FacilityPermission[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_permissions')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .eq('access_level', selectedLevel)
      if (error) throw error
      return data ?? []
    },
    {
      deps: [selectedLevel, effectiveFacilityId],
      enabled: !userLoading && isAdmin && !!effectiveFacilityId,
    },
  )

  // Build grants map
  const grants: Record<string, boolean> = {}
  if (facilityPerms) {
    for (const fp of facilityPerms) {
      grants[fp.permission_key] = fp.granted
    }
  }

  // Filter permissions by tier
  const visiblePermissions = useMemo(() => {
    if (!permissions) return []
    if (isTierAtLeast('essential')) return permissions
    return permissions.filter(p => COORDINATOR_TIER_CATEGORIES.has(p.category))
  }, [permissions, isTierAtLeast])

  // Build category list with counts
  const categories = useMemo<CategoryItem[]>(() => {
    const categoryMap = new Map<string, number>()
    const categoryOrder: string[] = []
    for (const p of visiblePermissions) {
      if (!categoryMap.has(p.category)) {
        categoryOrder.push(p.category)
        categoryMap.set(p.category, 0)
      }
      categoryMap.set(p.category, categoryMap.get(p.category)! + 1)
    }
    return categoryOrder.map(cat => ({ category: cat, count: categoryMap.get(cat)! }))
  }, [visiblePermissions])

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories
    return categories.filter(c =>
      c.category.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [categories, searchQuery])

  // Auto-select first category (or re-select if current is filtered out)
  useEffect(() => {
    if (
      filteredCategories.length > 0 &&
      (!selectedCategory || !filteredCategories.find(c => c.category === selectedCategory))
    ) {
      setSelectedCategory(filteredCategories[0].category)
    }
  }, [filteredCategories, selectedCategory])

  // Permissions for the selected category only
  const categoryPermissions = useMemo(() => {
    if (!selectedCategory) return []
    return visiblePermissions.filter(p => p.category === selectedCategory)
  }, [visiblePermissions, selectedCategory])

  // Handle toggle
  const handleToggle = useCallback(
    async (key: string, granted: boolean) => {
      if (!userData.userId || !effectiveFacilityId) return

      // Optimistic update
      setFacilityPerms((prev) => {
        if (!prev) return prev
        const existing = prev.find(fp => fp.permission_key === key)
        if (existing) {
          return prev.map(fp =>
            fp.permission_key === key ? { ...fp, granted } : fp,
          )
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            facility_id: effectiveFacilityId,
            access_level: selectedLevel,
            permission_key: key,
            granted,
          },
        ]
      })

      const { error } = await supabase
        .from('facility_permissions')
        .upsert(
          {
            facility_id: effectiveFacilityId,
            access_level: selectedLevel,
            permission_key: key,
            granted,
            updated_by: userData.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'facility_id,access_level,permission_key' },
        )

      if (error) {
        showToast({ type: 'error', title: 'Save Failed', message: error.message })
        refetchFacilityPerms()
        return
      }

      showToast({ type: 'success', title: 'Saved' })
    },
    [selectedLevel, effectiveFacilityId, userData.userId, supabase, showToast, setFacilityPerms, refetchFacilityPerms],
  )

  // Access denied for users without settings.permissions
  if (!userLoading && !can('settings.permissions')) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Roles & Permissions</h1>
        <p className="text-slate-500 mb-6">Configure what each access level can do at your facility.</p>
        <AccessDenied message="You don't have permission to manage roles and permissions. Contact your facility administrator." />
      </>
    )
  }

  const loading = permsLoading || facilityPermsLoading
  const error = permsError || facilityPermsError

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Roles & Permissions</h1>
      <p className="text-slate-500 mb-6">Configure what each access level can do at your facility.</p>

      <div className="space-y-4">
        {/* Access Level Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {ACCESS_LEVELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedLevel(value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedLevel === value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Admins always have full access</span>
          </div>
        </div>

        {/* Error State */}
        {error && <ErrorBanner message={error} />}

        {/* Two-Column Layout */}
        {loading ? (
          <TwoColumnSkeleton />
        ) : (
          <div
            className="flex flex-col md:flex-row border border-slate-200 rounded-xl overflow-hidden bg-white"
            style={{ minHeight: 500 }}
          >
            {/* Left Panel — Category List */}
            <div className="w-full md:w-[280px] md:min-w-[280px] border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col max-h-[300px] md:max-h-none">
              {/* Search */}
              <div className="p-3 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Category List */}
              <div className="flex-1 overflow-y-auto">
                {filteredCategories.map(({ category, count }) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-50 text-blue-900 font-medium border-l-2 border-l-blue-500'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{category}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          selectedCategory === category
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    No categories match &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel — Permission Toggles */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              {selectedCategory && categoryPermissions.length > 0 ? (
                <div className="overflow-y-auto p-4 md:p-6">
                  <PermissionMatrix
                    permissions={categoryPermissions}
                    grants={grants}
                    onToggle={handleToggle}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a category to configure permissions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// =====================================================
// SKELETON
// =====================================================

function TwoColumnSkeleton() {
  return (
    <div
      className="flex flex-col md:flex-row border border-slate-200 rounded-xl overflow-hidden bg-white"
      style={{ minHeight: 500 }}
    >
      {/* Left Panel Skeleton */}
      <div className="w-full md:w-[280px] md:min-w-[280px] border-b md:border-b-0 md:border-r border-slate-200 bg-white">
        <div className="p-3 border-b border-slate-200">
          <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="p-2 space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 30}px` }} />
              <div className="h-5 w-6 bg-slate-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel Skeleton */}
      <div className="flex-1 bg-slate-50 p-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center gap-8">
                <div className="h-4 bg-slate-200 rounded w-28 animate-pulse" />
                <div className="flex gap-8">
                  {[1, 2, 3].map(k => (
                    <div key={k} className="h-5 w-9 bg-slate-200 rounded-full animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
