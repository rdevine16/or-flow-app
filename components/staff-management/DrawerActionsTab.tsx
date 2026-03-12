// components/staff-management/DrawerActionsTab.tsx
// Actions tab for StaffDetailDrawer — placeholder buttons for Phase 12.
'use client'

import { Pencil, Send, UserX } from 'lucide-react'

// ============================================
// Types
// ============================================

interface DrawerActionsTabProps {
  userName: string
}

// ============================================
// Component
// ============================================

export function DrawerActionsTab({ userName }: DrawerActionsTabProps) {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          User Actions
        </h4>
        <p className="text-sm text-slate-500">
          Manage account settings for {userName}.
        </p>
      </div>

      <div className="space-y-3">
        {/* Edit Profile */}
        <ActionButton
          icon={<Pencil className="w-4 h-4" />}
          label="Edit Profile"
          description="Update name, email, role, and access level"
          disabled
        />

        {/* Send / Resend Invite */}
        <ActionButton
          icon={<Send className="w-4 h-4" />}
          label="Send Invite"
          description="Send account invitation email"
          disabled
        />

        {/* Deactivate */}
        <ActionButton
          icon={<UserX className="w-4 h-4" />}
          label="Deactivate Account"
          description="Soft-deactivate this user account"
          disabled
          variant="danger"
        />
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        Actions will be available in a future update.
      </p>
    </div>
  )
}

// ============================================
// Sub-component
// ============================================

function ActionButton({
  icon,
  label,
  description,
  disabled,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  description: string
  disabled?: boolean
  variant?: 'default' | 'danger'
}) {
  const baseStyles =
    'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors'
  const variantStyles =
    variant === 'danger'
      ? 'border-red-200 bg-red-50/50 text-red-700 hover:bg-red-100 disabled:bg-red-50/30 disabled:text-red-400'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-50/50 disabled:text-slate-400'

  return (
    <button
      className={`${baseStyles} ${variantStyles}`}
      disabled={disabled}
      title={disabled ? 'Coming in a future update' : label}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs opacity-70">{description}</p>
      </div>
    </button>
  )
}
