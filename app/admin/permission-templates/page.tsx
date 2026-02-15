// app/admin/permission-templates/page.tsx
// Global Admin — Permission Template Management
//
// Configure default permissions for new facilities. Changes here do NOT
// affect existing facilities — only new facilities created after the
// change will inherit the updated defaults.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { PermissionMatrix, Permission } from '@/components/permissions/PermissionMatrix'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, Info } from 'lucide-react'
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

      // Get all facilities
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
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    )
  }

  const loading = permsLoading || templatesLoading
  const error = permsError || templatesError

  return (
    <DashboardLayout>
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

        {/* Matrix */}
        {loading ? (
          <PermissionMatrixSkeleton />
        ) : permissions ? (
          <PermissionMatrix
            permissions={permissions}
            grants={grants}
            onToggle={handleToggle}
          />
        ) : null}
      </div>
    </DashboardLayout>
  )
}

// =====================================================
// SKELETON
// =====================================================

function PermissionMatrixSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-8">
                <div className="h-4 bg-slate-200 rounded w-28 animate-pulse" />
                <div className="flex gap-8">
                  {[1, 2, 3, 4].map(k => (
                    <div key={k} className="h-5 w-9 bg-slate-200 rounded-full animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
