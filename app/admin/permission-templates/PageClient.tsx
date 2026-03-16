// app/admin/permission-templates/page.tsx
// Global Admin — Permission Template Management
//
// Two-column layout: searchable category list on the left,
// permission toggles for the selected category on the right.
// Tabs at top select User vs Coordinator access level.
//
// Changes here do NOT affect existing facilities — only new
// facilities created after the change inherit updated defaults.

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import AdminConfigTabLayout from '@/components/admin/AdminConfigTabLayout'
import { PermissionMatrix, Permission } from '@/components/permissions/PermissionMatrix'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, Info, Search, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// =====================================================
// TYPES
// =====================================================

type AccessLevel = 'user' | 'coordinator'

interface PermissionTemplate {
  id: string
  access_level: string
  permission_key: string
  granted: boolean
}

interface FacilitySyncInfo {
  facility_name: string
  facility_id: string
  missing_count: number
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

// =====================================================
// COMPONENT
// =====================================================

export default function PermissionTemplatesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading, userData } = useUser()
  const { showToast } = useToast()

  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('user')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

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
    { deps: [], enabled: !userLoading && isGlobalAdmin },
  )

  // Fetch templates for the selected access level
  const {
    data: templates,
    loading: templatesLoading,
    error: templatesError,
    setData: setTemplates,
    refetch: refetchTemplates,
  } = useSupabaseQuery<PermissionTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('permission_templates')
        .select('*')
        .eq('access_level', selectedLevel)
      if (error) throw error
      return data ?? []
    },
    { deps: [selectedLevel], enabled: !userLoading && isGlobalAdmin },
  )

  // Check for out-of-sync facilities (missing permissions)
  const {
    data: syncInfo,
    loading: syncLoading,
    refetch: refetchSync,
  } = useSupabaseQuery<FacilitySyncInfo[]>(
    async (sb) => {
      if (!permissions || permissions.length === 0) return []

      const { data: facilities, error: facError } = await sb
        .from('facilities')
        .select('id, name')
      if (facError) throw facError
      if (!facilities || facilities.length === 0) return []

      const expectedCount = permissions.length * ACCESS_LEVELS.length
      const result: FacilitySyncInfo[] = []

      for (const fac of facilities) {
        const { count, error: countError } = await sb
          .from('facility_permissions')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', fac.id)
        if (countError) continue

        const actualCount = count ?? 0
        if (actualCount < expectedCount) {
          result.push({
            facility_name: fac.name,
            facility_id: fac.id,
            missing_count: expectedCount - actualCount,
          })
        }
      }

      return result
    },
    { deps: [permissions], enabled: !userLoading && isGlobalAdmin && !!permissions },
  )

  // Build grants map from templates
  const grants: Record<string, boolean> = {}
  if (templates) {
    for (const t of templates) {
      grants[t.permission_key] = t.granted
    }
  }

  // Build category list with counts
  const categories = useMemo<CategoryItem[]>(() => {
    if (!permissions) return []
    const categoryMap = new Map<string, number>()
    const categoryOrder: string[] = []
    for (const p of permissions) {
      if (!categoryMap.has(p.category)) {
        categoryOrder.push(p.category)
        categoryMap.set(p.category, 0)
      }
      categoryMap.set(p.category, categoryMap.get(p.category)! + 1)
    }
    return categoryOrder.map(cat => ({ category: cat, count: categoryMap.get(cat)! }))
  }, [permissions])

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
    if (!permissions || !selectedCategory) return []
    return permissions.filter(p => p.category === selectedCategory)
  }, [permissions, selectedCategory])

  // Handle toggle
  const handleToggle = useCallback(
    async (key: string, granted: boolean) => {
      if (!userData.userId) return

      // Optimistic update
      setTemplates((prev) => {
        if (!prev) return prev
        const existing = prev.find(t => t.permission_key === key)
        if (existing) {
          return prev.map(t =>
            t.permission_key === key ? { ...t, granted } : t,
          )
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            access_level: selectedLevel,
            permission_key: key,
            granted,
          },
        ]
      })

      const { error } = await supabase
        .from('permission_templates')
        .upsert(
          {
            access_level: selectedLevel,
            permission_key: key,
            granted,
            updated_by: userData.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'access_level,permission_key' },
        )

      if (error) {
        showToast({ type: 'error', title: 'Save Failed', message: error.message })
        refetchTemplates()
        return
      }

      showToast({ type: 'success', title: 'Saved' })
    },
    [selectedLevel, userData.userId, supabase, showToast, setTemplates, refetchTemplates],
  )

  // Push template defaults to out-of-sync facilities
  const [pushing, setPushing] = useState(false)

  const handlePushDefaults = useCallback(async () => {
    if (!syncInfo || syncInfo.length === 0) return
    setPushing(true)

    try {
      for (const fac of syncInfo) {
        const { error } = await supabase.rpc('copy_permission_template_to_facility', {
          p_facility_id: fac.facility_id,
        })
        if (error) throw error
      }

      showToast({
        type: 'success',
        title: 'Templates Pushed',
        message: `Updated ${syncInfo.length} facilities with missing permissions.`,
      })
      refetchSync()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Push Failed',
        message: err instanceof Error ? err.message : 'Failed to push templates',
      })
    } finally {
      setPushing(false)
    }
  }, [syncInfo, supabase, showToast, refetchSync])

  // Loading state
  if (userLoading || (!isGlobalAdmin && !userLoading)) {
    return (
      <DashboardLayout><AdminConfigTabLayout>
        <PageLoader />
      </AdminConfigTabLayout></DashboardLayout>
    )
  }

  const loading = permsLoading || templatesLoading
  const error = permsError || templatesError

  return (
    <DashboardLayout><AdminConfigTabLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Permission Templates
          </h1>
          <p className="text-slate-500 mt-1">
            Configure default permissions for new facilities. Changes do not affect existing facilities.
          </p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            These defaults apply to <strong>newly created facilities only</strong>. Existing facilities manage their own permissions from Settings &rarr; Permissions.
          </p>
        </div>

        {/* Sync Warning Banner */}
        {!syncLoading && syncInfo && syncInfo.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                {syncInfo.length} {syncInfo.length === 1 ? 'facility is' : 'facilities are'} missing permissions
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                {syncInfo.map(f => f.facility_name).join(', ')} — missing permissions will default to denied.
              </p>
            </div>
            <Button
              variant="warning"
              size="sm"
              onClick={handlePushDefaults}
              loading={pushing}
            >
              Push Defaults
            </Button>
          </div>
        )}

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
    </AdminConfigTabLayout></DashboardLayout>
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
