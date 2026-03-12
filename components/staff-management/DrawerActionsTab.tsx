// components/staff-management/DrawerActionsTab.tsx
// Actions tab for StaffDetailDrawer — edit profile, invite/resend, deactivate/reactivate.
'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { usersDAL, type UserListItem } from '@/lib/dal/users'
import { userAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EditUserForm } from './EditUserForm'
import { deriveAccountStatus } from './DrawerProfileTab'
import { Pencil, Send, UserX, UserCheck, Loader2 } from 'lucide-react'

// ============================================
// Types
// ============================================

interface DrawerActionsTabProps {
  user: UserListItem
  currentUserId: string
  onUserUpdated: () => void
}

// ============================================
// Component
// ============================================

export function DrawerActionsTab({ user, currentUserId, onUserUpdated }: DrawerActionsTabProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const isSelf = user.id === currentUserId
  const accountStatus = deriveAccountStatus(user)
  const fullName = `${user.first_name} ${user.last_name}`
  const hasEmail = !!user.email

  // ---- Edit Profile ----
  const handleSaveEdit = useCallback(async (updates: Record<string, unknown>) => {
    setEditLoading(true)
    try {
      const result = await usersDAL.updateUser(supabase, user.id, updates as Parameters<typeof usersDAL.updateUser>[2])
      if (result.error) {
        showToast({ type: 'error', title: 'Update Failed', message: result.error.message })
        return
      }

      // Build changes record for audit
      const changes: Record<string, { old: string; new: string }> = {}
      const userRecord = user as unknown as Record<string, unknown>
      for (const [key, value] of Object.entries(updates)) {
        changes[key] = { old: String(userRecord[key] ?? ''), new: String(value ?? '') }
      }

      await userAudit.updated(supabase, fullName, user.email ?? '', user.id, changes)
      showToast({ type: 'success', title: 'Profile Updated', message: `${fullName}'s profile has been updated.` })
      setIsEditing(false)
      onUserUpdated()
    } catch {
      showToast({ type: 'error', title: 'Update Failed', message: 'An unexpected error occurred.' })
    } finally {
      setEditLoading(false)
    }
  }, [supabase, user, fullName, showToast, onUserUpdated])

  // ---- Send / Resend Invite ----
  const handleSendInvite = useCallback(async () => {
    if (!user.email) return
    setInviteLoading(true)
    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          accessLevel: user.access_level,
          facilityId: undefined, // server resolves from the admin's context
          roleId: user.role_id,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        showToast({ type: 'error', title: 'Invite Failed', message: data.error || 'Failed to send invitation.' })
        return
      }

      await userAudit.invited(supabase, user.email, user.id)
      showToast({ type: 'success', title: 'Invite Sent', message: `Invitation sent to ${user.email}.` })
      onUserUpdated()
    } catch {
      showToast({ type: 'error', title: 'Invite Failed', message: 'An unexpected error occurred.' })
    } finally {
      setInviteLoading(false)
    }
  }, [user, supabase, showToast, onUserUpdated])

  // ---- Deactivate / Reactivate ----
  const { confirmDialog, showConfirm } = useConfirmDialog()

  const handleDeactivate = useCallback(() => {
    showConfirm({
      variant: 'danger',
      title: `Deactivate ${fullName}?`,
      message: `${fullName} will no longer be able to access the platform. They will be moved to the deactivated list and can be reactivated later.`,
      confirmText: 'Deactivate',
      onConfirm: async () => {
        setDeactivateLoading(true)
        try {
          const result = await usersDAL.deactivateUser(supabase, user.id)
          if (result.error) {
            showToast({ type: 'error', title: 'Deactivation Failed', message: result.error.message })
            return
          }
          await userAudit.deactivated(supabase, fullName, user.email ?? '', user.id)
          showToast({ type: 'success', title: 'Account Deactivated', message: `${fullName} has been deactivated.` })
          onUserUpdated()
        } catch {
          showToast({ type: 'error', title: 'Deactivation Failed', message: 'An unexpected error occurred.' })
        } finally {
          setDeactivateLoading(false)
        }
      },
    })
  }, [supabase, user.id, user.email, fullName, showConfirm, showToast, onUserUpdated])

  const handleReactivate = useCallback(async () => {
    setDeactivateLoading(true)
    try {
      const result = await usersDAL.reactivateUser(supabase, user.id)
      if (result.error) {
        showToast({ type: 'error', title: 'Reactivation Failed', message: result.error.message })
        return
      }
      await userAudit.reactivated(supabase, fullName, user.email ?? '', user.id)
      showToast({ type: 'success', title: 'Account Reactivated', message: `${fullName} has been reactivated.` })
      onUserUpdated()
    } catch {
      showToast({ type: 'error', title: 'Reactivation Failed', message: 'An unexpected error occurred.' })
    } finally {
      setDeactivateLoading(false)
    }
  }, [supabase, user.id, user.email, fullName, showToast, onUserUpdated])

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          User Actions
        </h4>
        <p className="text-sm text-slate-500">
          Manage account settings for {fullName}.
        </p>
      </div>

      {/* Edit Profile */}
      <div className="space-y-3">
        {isEditing ? (
          <EditUserForm
            userId={user.id}
            initialValues={{
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email ?? '',
              role_id: user.role_id ?? '',
              access_level: user.access_level,
            }}
            isSelf={isSelf}
            loading={editLoading}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <ActionButton
            icon={<Pencil className="w-4 h-4" />}
            label="Edit Profile"
            description="Update name, email, role, and access level"
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>

      {/* Send / Resend Invite */}
      {hasEmail && accountStatus !== 'active' && user.is_active && (
        <ActionButton
          icon={inviteLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
          label={accountStatus === 'pending' ? 'Resend Invite' : 'Send Invite'}
          description={
            accountStatus === 'pending'
              ? 'Resend the account invitation email'
              : 'Send account invitation email'
          }
          onClick={handleSendInvite}
          disabled={inviteLoading}
        />
      )}

      {/* No email hint */}
      {!hasEmail && user.is_active && (
        <div className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            This staff member has no email address.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Add an email via Edit Profile to send an account invitation.
          </p>
        </div>
      )}

      {/* Deactivate / Reactivate */}
      {!isSelf && (
        user.is_active ? (
          <ActionButton
            icon={deactivateLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <UserX className="w-4 h-4" />
            }
            label="Deactivate Account"
            description="Soft-deactivate this user account"
            onClick={handleDeactivate}
            disabled={deactivateLoading}
            variant="danger"
          />
        ) : (
          <ActionButton
            icon={deactivateLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <UserCheck className="w-4 h-4" />
            }
            label="Reactivate Account"
            description="Restore this user's access to the platform"
            onClick={handleReactivate}
            disabled={deactivateLoading}
            variant="default"
          />
        )
      )}

      {isSelf && (
        <p className="text-xs text-slate-400 text-center pt-2">
          You cannot deactivate your own account.
        </p>
      )}

      {confirmDialog}
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
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  disabled?: boolean
  variant?: 'default' | 'danger'
  onClick?: () => void
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
      onClick={onClick}
      title={label}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs opacity-70">{description}</p>
      </div>
    </button>
  )
}
