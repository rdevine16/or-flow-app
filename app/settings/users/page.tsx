// app/settings/users/page.tsx
// This page allows facility admins and global admins to manage cancellation reasons that staff can select when cancelling a surgical case. Reasons can be categorized, and archived if no longer relevant. Auditing is implemented for all create, update, delete, and restore actions to maintain a history of changes for compliance and accountability purposes.
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import Badge from '@/components/ui/Badge'
import InviteUserModal from '@/components/InviteUserModal'
import { userAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { Archive, Ban, CheckCircle2, Loader2, Mail, Pencil, Plus, RefreshCw, Send, Users, X } from 'lucide-react'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string | null
  role_id: string
  access_level: string
  facility_id: string | null
  is_active: boolean
  deleted_at: string | null
  user_roles: { name: string }[] | { name: string } | null
  facilities?: { name: string } | null
  last_login_at?: string | null
}

interface UserRole {
  id: string
  name: string
}

interface Facility {
  id: string
  name: string
}

type AccountStatus = 'active' | 'pending' | 'no_account'

const getRoleName = (userRoles: { name: string }[] | { name: string } | null): string | null => {
  if (!userRoles) return null
  if (Array.isArray(userRoles)) return userRoles[0]?.name || null
  return userRoles.name
}

export default function UsersSettingsPage() {
  const supabase = createClient()
  
  const { 
    isGlobalAdmin, 
    effectiveFacilityId, 
    isImpersonating,
    loading: userLoading 
  } = useUser()
  
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<UserRole[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set())
  const [authUserIds, setAuthUserIds] = useState<Set<string>>(new Set())
  const { showToast } = useToast()
  const [showArchived, setShowArchived] = useState(false)
  
  // Invite prompt state
  const [showInvitePrompt, setShowInvitePrompt] = useState(false)
  const [pendingInviteUser, setPendingInviteUser] = useState<User | null>(null)

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role_id: '',
    access_level: 'user',
    facility_id: '',
  })

  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const showAllUsers = isGlobalAdmin && !isImpersonating

  const { data: queryData, loading, error, refetch: refetchUsers } = useSupabaseQuery<{
    users: User[]
    roles: UserRole[]
    facilities: Facility[]
  }>(
    async (sb) => {
      let usersQuery = sb
        .from('users')
        .select('id, first_name, last_name, email, role_id, access_level, facility_id, is_active, deleted_at, last_login_at, user_roles(name), facilities(name)')
        .order('last_name')

      const allUsers = isGlobalAdmin && !isImpersonating

      if (!allUsers && effectiveFacilityId) {
        usersQuery = usersQuery
          .eq('facility_id', effectiveFacilityId)
          .in('access_level', ['user', 'facility_admin'])
      }

      if (!showArchived) {
        usersQuery = usersQuery.eq('is_active', true)
      }

      const [usersRes, rolesRes, facilitiesRes] = await Promise.all([
        usersQuery,
        sb.from('user_roles').select('id, name').order('name'),
        allUsers
          ? sb.from('facilities').select('id, name').order('name')
          : Promise.resolve({ data: [] as Facility[], error: null }),
      ])

      if (usersRes.error) throw usersRes.error
      if (rolesRes.error) throw rolesRes.error

      return {
        users: (usersRes.data as unknown as User[]) || [],
        roles: rolesRes.data || [],
        facilities: (facilitiesRes.data as Facility[]) || [],
      }
    },
    { deps: [effectiveFacilityId, isImpersonating, showArchived, isGlobalAdmin], enabled: !userLoading }
  )

  // Sync query data to local state
  useEffect(() => {
    if (queryData) {
      setUsers(queryData.users)
      setRoles(queryData.roles)
      setFacilities(queryData.facilities)
    }
  }, [queryData])

  // Fetch pending/auth status after users load
  useEffect(() => {
    if (!queryData?.users.length) return
    const emailsToCheck = queryData.users.filter(u => u.email).map(u => u.email as string)
    if (emailsToCheck.length > 0) fetchPendingStatus(emailsToCheck)
    fetchAuthStatus(queryData.users.map(u => u.id))
  }, [queryData])

  const fetchPendingStatus = async (emails: string[]) => {
    try {
      const response = await fetch('/api/check-user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })

      if (response.ok) {
        const data = await response.json()
        setPendingUserIds(new Set(data.pendingUserIds || []))
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error fetching pending status',
        message: error instanceof Error ? error.message : 'Failed to fetch pending status'
      })
    }
  }

  const fetchAuthStatus = async (userIds: string[]) => {
    try {
      const response = await fetch('/api/check-auth-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })

      if (response.ok) {
        const data = await response.json()
        setAuthUserIds(new Set(data.authUserIds || []))
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error fetching auth status',
        message: error instanceof Error ? error.message : 'Failed to fetch auth status'
      })
    }
  }

  const getAccountStatus = (user: User): AccountStatus => {
    if (!user.email) return 'no_account'
    if (!authUserIds.has(user.id)) return 'no_account'
    if (pendingUserIds.has(user.id)) return 'pending'
    return 'active'
  }

  const handleInviteSuccess = () => {
    showToast({ type: 'success', title: 'Staff member added successfully!' })
    refetchUsers()
  }

  const handleResendInvite = async (user: User) => {
    if (!user.email) return
    
    setResendingInvite(user.id)

    try {
      const response = await fetch('/api/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        showToast({ type: 'error', title: data.error || 'Failed to resend invite' })
      } else {
        showToast({ type: 'success', title: `Invite resent to ${user.email}` })
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to resend invite' })
    }

    setResendingInvite(null)
  }

  const handleSendInvite = async (user: User) => {
    if (!user.email) return
    
    setSendingInvite(user.id)

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          accessLevel: user.access_level,
          facilityId: user.facility_id,
          roleId: user.role_id,
          existingUserId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        showToast({ type: 'error', title: data.error || 'Failed to send invitation' })
      } else {
        // Audit log the invite
        await userAudit.invited(supabase, user.email!, user.id)
        
        showToast({ type: 'success', title: `Invitation sent to ${user.email}` })
        refetchUsers()
      }
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to send invitation' })
    }

    setSendingInvite(null)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      role_id: user.role_id,
      access_level: user.access_level,
      facility_id: user.facility_id || '',
    })
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setEditFormData({
      first_name: '',
      last_name: '',
      email: '',
      role_id: '',
      access_level: 'user',
      facility_id: '',
    })
  }

  const handleEdit = async () => {
    if (!editingUser) return

    const canChangeFacility = isGlobalAdmin && !isImpersonating
    const trimmedEmail = editFormData.email.trim()
    const hadNoEmail = !editingUser.email
    const emailWasAdded = hadNoEmail && trimmedEmail

    const updateData: Record<string, string | null> = {
      first_name: editFormData.first_name,
      last_name: editFormData.last_name,
      role_id: editFormData.role_id,
      access_level: editFormData.access_level,
    }

    if (trimmedEmail !== (editingUser.email || '')) {
      updateData.email = trimmedEmail || null
    }

    if (canChangeFacility && editFormData.facility_id) {
      updateData.facility_id = editFormData.facility_id
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', editingUser.id)

    if (!error) {
      const changes: Record<string, { old: string; new: string }> = {}
      if (editFormData.first_name !== editingUser.first_name) {
        changes.first_name = { old: editingUser.first_name, new: editFormData.first_name }
      }
      if (editFormData.last_name !== editingUser.last_name) {
        changes.last_name = { old: editingUser.last_name, new: editFormData.last_name }
      }
      if (editFormData.access_level !== editingUser.access_level) {
        changes.access_level = { old: editingUser.access_level, new: editFormData.access_level }
      }
      if (trimmedEmail !== (editingUser.email || '')) {
        changes.email = { old: editingUser.email || '(none)', new: trimmedEmail || '(none)' }
      }

      if (Object.keys(changes).length > 0) {
        await userAudit.updated(
          supabase,
          `${editFormData.first_name} ${editFormData.last_name}`,
          trimmedEmail || editingUser.email || '',
          editingUser.id,
          changes
        )
      }

      closeEditModal()

      if (emailWasAdded) {
        const updatedUser: User = {
          ...editingUser,
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          email: trimmedEmail,
          role_id: editFormData.role_id,
          access_level: editFormData.access_level,
        }
        setPendingInviteUser(updatedUser)
        setShowInvitePrompt(true)
      } else {
        showToast({ type: 'success', title: 'User updated successfully!' })
      }

      refetchUsers()
    } else {
      showToast({ type: 'error', title: error.message || 'Failed to update user' })
    }
  }

  const handleInvitePromptSend = async () => {
    if (!pendingInviteUser) return
    
    setShowInvitePrompt(false)
    await handleSendInvite(pendingInviteUser)
    setPendingInviteUser(null)
  }

  const handleInvitePromptSkip = () => {
    setShowInvitePrompt(false)
    setPendingInviteUser(null)
    showToast({ type: 'success', title: 'Email added. You can send an invite later.' })
  }

  // NEW: Deactivate user (soft delete)
  const handleDeactivate = async (id: string) => {
    if (id === currentUserId) return

    const user = users.find(u => u.id === id)
    if (!user) return
    
    const userName = `${user.first_name} ${user.last_name}`
    const userEmail = user.email || ''

    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('users')
      .update({ 
        is_active: false, 
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser?.id 
      })
      .eq('id', id)

    if (!error) {
      await userAudit.deactivated(supabase, userName, userEmail, id)
      setDeactivateConfirm(null)
      showToast({ type: 'success', title: `${userName} has been deactivated` })
      refetchUsers()
    } else {
      showToast({ type: 'error', title: 'Failed to deactivate user' })
    }
  }

  // NEW: Reactivate user (restore from soft delete)
  const handleReactivate = async (id: string) => {
    const user = users.find(u => u.id === id)
    if (!user) return
    
    const userName = `${user.first_name} ${user.last_name}`
    const userEmail = user.email || ''

    const { error } = await supabase
      .from('users')
      .update({ 
        is_active: true, 
        deleted_at: null,
        deleted_by: null 
      })
      .eq('id', id)

    if (!error) {
      await userAudit.reactivated(supabase, userName, userEmail, id)
      showToast({ type: 'success', title: `${userName} has been reactivated` })
      refetchUsers()
    } else {
      showToast({ type: 'error', title: 'Failed to reactivate user' })
    }
  }

  const getRoleBadgeVariant = (role: string | null): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (role) {
      case 'surgeon': return 'info'
      case 'anesthesiologist': return 'warning'
      case 'nurse': return 'success'
      case 'tech': return 'default'
      case 'admin': return 'error'
      default: return 'default'
    }
  }

  const getAccessLevelLabel = (accessLevel: string): string => {
    switch (accessLevel) {
      case 'global_admin': return 'Global Admin'
      case 'facility_admin': return 'Facility Admin'
      case 'coordinator': return 'Coordinator'
      default: return 'Staff'
    }
  }

  const getAccountStatusDisplay = (status: AccountStatus, isDeactivated: boolean) => {
    // If deactivated, show that instead
    if (isDeactivated) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
          Deactivated
        </span>
      )
    }
    
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            Pending
          </span>
        )
      case 'no_account':
        return <span className="text-xs text-slate-400">No account</span>
    }
  }

  // Count stats - separate active from deactivated
  const activeUsers = users.filter(u => u.is_active !== false)
  const deactivatedUsers = users.filter(u => u.is_active === false)
  const activeCount = activeUsers.filter(u => getAccountStatus(u) === 'active').length
  const pendingCount = activeUsers.filter(u => getAccountStatus(u) === 'pending').length
  const noAccountCount = activeUsers.filter(u => getAccountStatus(u) === 'no_account').length

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} />
        <SettingsLayout
          title="Users & Roles"
          description="Manage staff members at your facility."
        >
          {loading || userLoading ? (
            <PageLoader message="Loading users..." />
          ) : !effectiveFacilityId && !showAllUsers ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">Staff Members</h3>
                    <p className="text-sm text-slate-500">
                      {showArchived ? (
                        <>
                          {deactivatedUsers.length} deactivated
                          <button 
                            onClick={() => setShowArchived(false)}
                            className="text-blue-600 hover:underline ml-2"
                          >
                            ← Back to active
                          </button>
                        </>
                      ) : (
                        <>
                          {activeUsers.length} total
                          {activeCount > 0 && <span className="text-green-600"> · {activeCount} active</span>}
                          {pendingCount > 0 && <span className="text-amber-700"> · {pendingCount} pending</span>}
                          {noAccountCount > 0 && <span> · {noAccountCount} without account</span>}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Show Archived Toggle */}
                    {!showArchived && (
                      <button
                        onClick={() => setShowArchived(true)}
                        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                      >
                        <Archive className="w-4 h-4" />
                        View Deactivated
                      </button>
                    )}
                    {!showArchived && (
                      <Button onClick={() => setShowInviteModal(true)}>
                        <Plus className="w-4 h-4" />
                        Add Staff Member
                      </Button>
                    )}
                  </div>
                </div>

                {/* Table */}
                {users.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500">
                      {showArchived ? 'No deactivated staff members.' : 'No staff members yet.'}
                    </p>
                    {!showArchived && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Add your first staff member
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-4">Name</div>
                      <div className="col-span-2">Role</div>
                      <div className="col-span-2">Permissions</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {users.map((user) => {
                        const roleName = getRoleName(user.user_roles)
                        const isCurrentUser = user.id === currentUserId
                        const accountStatus = getAccountStatus(user)
                        const isDeactivated = user.is_active === false

                        return (
                          <div 
                            key={user.id} 
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                              isDeactivated 
                                ? 'bg-slate-50/50 hover:bg-slate-100/50' 
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Name */}
                            <div className="col-span-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                                  isDeactivated
                                    ? 'bg-slate-100 text-slate-400'
                                    : accountStatus === 'pending' 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : accountStatus === 'no_account'
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {user.first_name[0]}{user.last_name[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-medium truncate ${isDeactivated ? 'text-slate-400' : 'text-slate-900'}`}>
                                    {roleName === 'surgeon' || roleName === 'anesthesiologist'
                                      ? `Dr. ${user.first_name} ${user.last_name}`
                                      : `${user.first_name} ${user.last_name}`
                                    }
                                    {isCurrentUser && (
                                      <span className="text-xs text-slate-400 font-normal ml-1">(you)</span>
                                    )}
                                  </p>
                                  <p className={`text-sm truncate ${isDeactivated ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {user.email || <span className="italic text-slate-400">No email</span>}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Role */}
                            <div className="col-span-2">
                              <span className={isDeactivated ? 'opacity-50' : ''}>
                                <Badge 
                                  variant={isDeactivated ? 'default' : getRoleBadgeVariant(roleName)} 
                                  size="sm"
                                >
                                  {roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'Unknown'}
                                </Badge>
                              </span>
                            </div>

                            {/* Permissions */}
                            <div className="col-span-2">
                              <span className={`text-sm ${isDeactivated ? 'text-slate-400' : 'text-slate-600'}`}>
                                {getAccessLevelLabel(user.access_level)}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="col-span-2">
                              {getAccountStatusDisplay(accountStatus, isDeactivated)}
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {isDeactivated ? (
                                // Reactivate button for deactivated users
                                <button
                                  onClick={() => handleReactivate(user.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Reactivate
                                </button>
                              ) : deactivateConfirm === user.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeactivate(user.id)}
                                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeactivateConfirm(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Resend Invite - for pending users */}
                                  {accountStatus === 'pending' && (
                                    <button
                                      onClick={() => handleResendInvite(user)}
                                      disabled={resendingInvite === user.id}
                                      className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Resend invite"
                                    >
                                      {resendingInvite === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Mail className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  
                                  {/* Send Invite - for staff with email but no account */}
                                  {accountStatus === 'no_account' && user.email && (
                                    <button
                                      onClick={() => handleSendInvite(user)}
                                      disabled={sendingInvite === user.id}
                                      className="p-2 text-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Send invite"
                                    >
                                      {sendingInvite === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Send className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => openEditModal(user)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  
                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => setDeactivateConfirm(user.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Deactivate"
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Add Staff Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={handleInviteSuccess}
        facilityId={effectiveFacilityId}
        roles={roles}
      />

      {/* Edit User Modal */}
      <Modal
        open={!!editingUser}
        onClose={closeEditModal}
        title="Edit Staff Member"
      >
            {editingUser && (
            <>
              <p className="text-sm text-slate-500 -mt-2 mb-2">{editingUser.email || 'No email on file'}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                  {!editingUser.email && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
                </label>
                {getAccountStatus(editingUser) === 'no_account' ? (
                  <>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="john.smith@hospital.com"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      {!editingUser.email ? "Add an email to enable app access" : "You can send an invite after saving"}
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="email"
                      value={editFormData.email}
                      disabled
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Email cannot be changed for users with accounts</p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Staff Role</label>
                <select
                  value={editFormData.role_id}
                  onChange={(e) => setEditFormData({ ...editFormData, role_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Permissions</label>
                <select
                  value={editFormData.access_level}
                  onChange={(e) => setEditFormData({ ...editFormData, access_level: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  disabled={editingUser.id === currentUserId}
                >
                  <option value="user">Staff — View cases, record milestones</option>
                  <option value="coordinator">Coordinator — Create and edit cases</option>
                  <option value="facility_admin">Facility Admin — Full facility access</option>
                  {showAllUsers && <option value="global_admin">Global Admin — All facilities access</option>}
                </select>
                {editingUser.id === currentUserId && (
                  <p className="text-xs text-slate-500 mt-1.5">You cannot change your own permissions</p>
                )}
              </div>

              {showAllUsers && facilities.length > 0 && editFormData.access_level !== 'global_admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Facility</label>
                  <select
                    value={editFormData.facility_id}
                    onChange={(e) => setEditFormData({ ...editFormData, facility_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select a facility...</option>
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>{facility.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">Move this user to a different facility</p>
                </div>
              )}
            </>
            )}

        <Modal.Footer>
          <Modal.Cancel onClick={closeEditModal} />
          <Modal.Action
            onClick={handleEdit}
            disabled={!editFormData.first_name || !editFormData.last_name || !editFormData.role_id}
          >
            Save Changes
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Invite Prompt Modal */}
      <ConfirmDialog
        open={showInvitePrompt && !!pendingInviteUser}
        onClose={handleInvitePromptSkip}
        onConfirm={handleInvitePromptSend}
        variant="info"
        title="Email Added"
        message={`Would you like to send ${pendingInviteUser?.first_name} an invitation to access the app?`}
        confirmText="Send Invite"
        cancelText="Not Now"
        icon={
          <Mail className="w-6 h-6" />
        }
      />
    </DashboardLayout>
  )
}