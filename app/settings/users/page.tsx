'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import Badge from '../../../components/ui/Badge'
import InviteUserModal from '../../../components/InviteUserModal'
import { userAudit } from '../../../lib/audit-logger'

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
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set())
  const [authUserIds, setAuthUserIds] = useState<Set<string>>(new Set())
  
  // NEW: Show archived users toggle
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

  useEffect(() => {
    if (!userLoading) {
      fetchCurrentUserId()
      fetchData()
    }
  }, [userLoading, effectiveFacilityId, isImpersonating, showArchived])

  const fetchCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }
  }

  const fetchData = async () => {
    setLoading(true)

    let usersQuery = supabase
      .from('users')
      .select('id, first_name, last_name, email, role_id, access_level, facility_id, is_active, deleted_at, last_login_at, user_roles(name), facilities(name)')
      .order('last_name')

    const showAllUsers = isGlobalAdmin && !isImpersonating

    if (!showAllUsers && effectiveFacilityId) {
      usersQuery = usersQuery
        .eq('facility_id', effectiveFacilityId)
        .in('access_level', ['user', 'facility_admin'])
    }

    // Filter by active status
    if (!showArchived) {
      usersQuery = usersQuery.eq('is_active', true)
    }

    const [usersRes, rolesRes, facilitiesRes] = await Promise.all([
      usersQuery,
      supabase.from('user_roles').select('id, name').order('name'),
      showAllUsers
        ? supabase.from('facilities').select('id, name').order('name')
        : Promise.resolve({ data: [] }),
    ])

    const usersData = (usersRes.data as unknown as User[]) || []
    setUsers(usersData)
    setRoles(rolesRes.data || [])
    setFacilities(facilitiesRes.data || [])

    const emailsToCheck = usersData.filter(u => u.email).map(u => u.email as string)
    if (emailsToCheck.length > 0) {
      await fetchPendingStatus(emailsToCheck)
    }

    await fetchAuthStatus(usersData.map(u => u.id))

    setLoading(false)
  }

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
      console.error('Error fetching pending status:', error)
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
      console.error('Error fetching auth status:', error)
    }
  }

  const getAccountStatus = (user: User): AccountStatus => {
    if (!user.email) return 'no_account'
    if (!authUserIds.has(user.id)) return 'no_account'
    if (pendingUserIds.has(user.id)) return 'pending'
    return 'active'
  }

  const handleInviteSuccess = () => {
    setSuccessMessage('Staff member added successfully!')
    fetchData()
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const handleResendInvite = async (user: User) => {
    if (!user.email) return
    
    setResendingInvite(user.id)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || 'Failed to resend invite')
        setTimeout(() => setErrorMessage(null), 5000)
      } else {
        setSuccessMessage(`Invite resent to ${user.email}`)
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (error) {
      setErrorMessage('Failed to resend invite')
      setTimeout(() => setErrorMessage(null), 5000)
    }

    setResendingInvite(null)
  }

  const handleSendInvite = async (user: User) => {
    if (!user.email) return
    
    setSendingInvite(user.id)
    setErrorMessage(null)

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
        setErrorMessage(data.error || 'Failed to send invitation')
        setTimeout(() => setErrorMessage(null), 5000)
      } else {
        // Audit log the invite
        await userAudit.invited(supabase, user.email!, user.id)
        
        setSuccessMessage(`Invitation sent to ${user.email}`)
        fetchData()
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (error) {
      setErrorMessage('Failed to send invitation')
      setTimeout(() => setErrorMessage(null), 5000)
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
        setSuccessMessage('User updated successfully!')
        setTimeout(() => setSuccessMessage(null), 5000)
      }

      fetchData()
    } else {
      setErrorMessage(error.message || 'Failed to update user')
      setTimeout(() => setErrorMessage(null), 5000)
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
    setSuccessMessage('Email added. You can send an invite later.')
    setTimeout(() => setSuccessMessage(null), 5000)
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
      setSuccessMessage(`${userName} has been deactivated`)
      setTimeout(() => setSuccessMessage(null), 5000)
      fetchData()
    } else {
      setErrorMessage('Failed to deactivate user')
      setTimeout(() => setErrorMessage(null), 5000)
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
      setSuccessMessage(`${userName} has been reactivated`)
      setTimeout(() => setSuccessMessage(null), 5000)
      fetchData()
    } else {
      setErrorMessage('Failed to reactivate user')
      setTimeout(() => setErrorMessage(null), 5000)
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
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
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

  const showAllUsers = isGlobalAdmin && !isImpersonating

  // Count stats - separate active from deactivated
  const activeUsers = users.filter(u => u.is_active !== false)
  const deactivatedUsers = users.filter(u => u.is_active === false)
  const activeCount = activeUsers.filter(u => getAccountStatus(u) === 'active').length
  const pendingCount = activeUsers.filter(u => getAccountStatus(u) === 'pending').length
  const noAccountCount = activeUsers.filter(u => getAccountStatus(u) === 'no_account').length

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Users & Roles"
          description="Manage staff members at your facility."
        >
          {loading || userLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : !effectiveFacilityId && !showAllUsers ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                  <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-500 hover:text-red-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

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
                          {pendingCount > 0 && <span className="text-amber-600"> · {pendingCount} pending</span>}
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        View Deactivated
                      </button>
                    )}
                    {!showArchived && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Staff Member
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                {users.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
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
                                    ? 'bg-amber-100 text-amber-600' 
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
                              <Badge 
                                variant={isDeactivated ? 'default' : getRoleBadgeVariant(roleName)} 
                                size="sm"
                                className={isDeactivated ? 'opacity-50' : ''}
                              >
                                {roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'Unknown'}
                              </Badge>
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
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
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
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                  
                                  {/* Send Invite - for staff with email but no account */}
                                  {accountStatus === 'no_account' && user.email && (
                                    <button
                                      onClick={() => handleSendInvite(user)}
                                      disabled={sendingInvite === user.id}
                                      className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Send invite"
                                    >
                                      {sendingInvite === user.id ? (
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => openEditModal(user)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  
                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => setDeactivateConfirm(user.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Deactivate"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
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
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Edit Staff Member</h3>
              <p className="text-sm text-slate-500">{editingUser.email || 'No email on file'}</p>
            </div>

            <div className="p-6 space-y-4">
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
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editFormData.first_name || !editFormData.last_name || !editFormData.role_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Prompt Modal */}
      {showInvitePrompt && pendingInviteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Email Added</h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Would you like to send {pendingInviteUser.first_name} an invitation to access the app?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleInvitePromptSkip}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Not Now
                </button>
                <button
                  onClick={handleInvitePromptSend}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}