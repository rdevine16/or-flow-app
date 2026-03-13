// components/staff-management/DrawerProfileTab.tsx
// Profile tab for StaffDetailDrawer — shows user info, role, account status.
'use client'

import type { UserListItem } from '@/lib/dal/users'
import Badge from '@/components/ui/Badge'
import { Mail, Phone, Shield, Clock, LogIn, Building2 } from 'lucide-react'

// ============================================
// Types
// ============================================

interface DrawerProfileTabProps {
  user: UserListItem
  facilityName: string | null
}

type AccountStatus = 'active' | 'pending' | 'not_configured' | 'inactive'

// ============================================
// Helpers
// ============================================

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  global_admin: 'Global Admin',
  facility_admin: 'Facility Admin',
  coordinator: 'Coordinator',
  user: 'Staff',
}

function deriveAccountStatus(user: UserListItem): AccountStatus {
  if (!user.is_active) return 'inactive'
  if (!user.email) return 'not_configured'
  if (!user.last_login_at) return 'pending'
  return 'active'
}

const STATUS_CONFIG: Record<AccountStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default'; icon: string }> = {
  active: { label: 'Active', variant: 'success', icon: '✓' },
  pending: { label: 'Pending Invite', variant: 'warning', icon: '●' },
  not_configured: { label: 'Not Configured', variant: 'default', icon: '—' },
  inactive: { label: 'Inactive', variant: 'error', icon: '○' },
}

function getRoleName(user: UserListItem): string | null {
  if (!user.role) return null
  if (Array.isArray(user.role)) return (user.role as { name: string }[])[0]?.name ?? null
  return user.role.name
}

// ============================================
// Component
// ============================================

export function DrawerProfileTab({ user, facilityName }: DrawerProfileTabProps) {
  const status = deriveAccountStatus(user)
  const statusCfg = STATUS_CONFIG[status]
  const roleName = getRoleName(user)

  return (
    <div className="space-y-6 p-4">
      {/* Account status banner */}
      <div className="flex items-center gap-2">
        <Badge variant={statusCfg.variant} size="md">
          {statusCfg.icon} {statusCfg.label}
        </Badge>
      </div>

      {/* Contact info */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">{user.email ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Role & access */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Role & Access</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">{roleName ?? 'No role assigned'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">
              {ACCESS_LEVEL_LABELS[user.access_level] ?? user.access_level}
            </span>
          </div>
        </div>
      </div>

      {/* Facility */}
      {facilityName && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Facility</h4>
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700">{facilityName}</span>
          </div>
        </div>
      )}

      {/* Account dates */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-500">Joined:</span>
            <span className="text-slate-700">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              }) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LogIn className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-500">Last login:</span>
            <span className="text-slate-700">
              {user.last_login_at
                ? new Date(user.last_login_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : 'Never'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export status helpers for use in directory table
export { deriveAccountStatus, STATUS_CONFIG, type AccountStatus }
