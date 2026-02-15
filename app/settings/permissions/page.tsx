// app/settings/permissions/page.tsx
// Facility Admin — Roles & Permissions
//
// Configure what each access level can do at this facility.
// Nearly identical to the global admin template page, but reads/writes
// facility_permissions scoped to the current facility.

'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { PermissionMatrix, Permission } from '@/components/permissions/PermissionMatrix'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Info, ShieldAlert } from 'lucide-react'

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

export default function FacilityPermissionsPage() {
  const supabase = createClient()
  const { isAdmin, loading: userLoading, userData, effectiveFacilityId } = useUser()
  const { showToast } = useToast()

  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>('user')

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

  // Access denied for non-admins
  if (!userLoading && !isAdmin) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Roles & Permissions" description="Configure what each access level can do at your facility.">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Access Denied</h2>
              <p className="text-sm text-slate-500 max-w-sm">
                You don&apos;t have permission to manage roles and permissions. Contact your facility administrator.
              </p>
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  const loading = permsLoading || facilityPermsLoading
  const error = permsError || facilityPermsError

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout
          title="Roles & Permissions"
          description="Configure what each access level can do at your facility."
        >
          <div className="space-y-6">
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
        </SettingsLayout>
      </Container>
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
