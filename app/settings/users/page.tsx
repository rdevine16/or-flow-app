'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
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
  email: string
  role_id: string
  access_level: string
  facility_id: string | null
  user_roles: { name: string }[] | { name: string } | null
  facilities?: { name: string } | null
  email_confirmed?: boolean
}

interface UserRole {
  id: string
  name: string
}

interface Facility {
  id: string
  name: string
}

const getRoleName = (userRoles: { name: string }[] | { name: string } | null): string | null => {
  if (!userRoles) return null
  if (Array.isArray(userRoles)) return userRoles[0]?.name || null
  return userRoles.name
}

export default function UsersSettingsPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<UserRole[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [currentUserFacilityId, setCurrentUserFacilityId] = useState<string | null>(null)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set())

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    role_id: '',
    access_level: 'user',
    facility_id: '',
  })

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      if (userData) {
        setCurrentUserFacilityId(userData.facility_id)
        setIsGlobalAdmin(userData.access_level === 'global_admin')
        fetchData(userData.facility_id, userData.access_level === 'global_admin')
      }
    }
  }

  const fetchData = async (facilityId: string | null, isGlobal: boolean) => {
    setLoading(true)

    let usersQuery = supabase
      .from('users')
      .select('id, first_name, last_name, email, role_id, access_level, facility_id, user_roles(name), facilities(name)')
      .order('last_name')

    if (!isGlobal && facilityId) {
      usersQuery = usersQuery.eq('facility_id', facilityId)
    }

    const [usersRes, rolesRes, facilitiesRes] = await Promise.all([
      usersQuery,
      supabase.from('user_roles').select('id, name').order('name'),
      isGlobal 
        ? supabase.from('facilities').select('id, name').order('name')
        : Promise.resolve({ data: [] }),
    ])

    const usersData = (usersRes.data as unknown as User[]) || []
    setUsers(usersData)
    setRoles(rolesRes.data || [])
    setFacilities(facilitiesRes.data || [])

    await fetchPendingStatus(usersData.map(u => u.email))

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

  const handleInviteSuccess = () => {
    setSuccessMessage('Invitation sent successfully!')
    fetchData(currentUserFacilityId, isGlobalAdmin)
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const handleResendInvite = async (user: User) => {
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

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      first_name: user.first_name,
      last_name: user.last_name,
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
      role_id: '',
      access_level: 'user',
      facility_id: '',
    })
  }

  const handleEdit = async () => {
    if (!editingUser) return

    const updateData: Record<string, string | null> = {
      first_name: editFormData.first_name,
      last_name: editFormData.last_name,
      role_id: editFormData.role_id,
      access_level: editFormData.access_level,
    }

    if (isGlobalAdmin && editFormData.facility_id) {
      updateData.facility_id = editFormData.facility_id
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', editingUser.id)

    if (!error) {
      // Audit log the update
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

      if (Object.keys(changes).length > 0) {
        await userAudit.updated(
          supabase,
          `${editFormData.first_name} ${editFormData.last_name}`,
          editingUser.email,
          editingUser.id,
          changes
        )
      }

      setSuccessMessage('User updated successfully!')
      fetchData(currentUserFacilityId, isGlobalAdmin)
      closeEditModal()
      setTimeout(() => setSuccessMessage(null), 5000)
    }
  }

  const handleDelete = async (id: string) => {
    if (id === currentUserId) {
      return
    }

    // Get user info for audit log before deleting
    const user = users.find(u => u.id === id)
    const userName = user ? `${user.first_name} ${user.last_name}` : 'Unknown'
    const userEmail = user?.email || ''

    const { error } = await supabase.from('users').delete().eq('id', id)

    if (!error) {
      // Audit log the deletion
      await userAudit.deleted(supabase, userName, userEmail, id)

      setUsers(users.filter(u => u.id !== id))
      setDeleteConfirm(null)
      setSuccessMessage('User deleted successfully!')
      setTimeout(() => setSuccessMessage(null), 5000)
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

  const getAccessLevelBadge = (accessLevel: string) => {
    switch (accessLevel) {
      case 'global_admin':
        return <Badge variant="error" size="sm">Global Admin</Badge>
      case 'facility_admin':
        return <Badge variant="warning" size="sm">Facility Admin</Badge>
      default:
        return null
    }
  }

  const isPending = (userId: string) => pendingUserIds.has(userId)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Users & Roles"
          description="Manage staff members who can access the system."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
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
                  <button 
                    onClick={() => setSuccessMessage(null)}
                    className="ml-auto text-green-500 hover:text-green-700"
                  >
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
                  <button 
                    onClick={() => setErrorMessage(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Invite Button */}
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite New User
              </button>

              {/* Users List */}
              {users.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">No users yet</p>
                  <p className="text-slate-400 text-xs mt-1">Invite staff members to get started</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {users.map((user) => {
                    const roleName = getRoleName(user.user_roles)
                    const isCurrentUser = user.id === currentUserId
                    const userIsPending = isPending(user.id)

                    return (
                      <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                              userIsPending 
                                ? 'bg-amber-100 text-amber-600' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {user.first_name[0]}{user.last_name[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">
                                  {roleName === 'surgeon' || roleName === 'anesthesiologist'
                                    ? `Dr. ${user.first_name} ${user.last_name}`
                                    : `${user.first_name} ${user.last_name}`
                                  }
                                </p>
                                {userIsPending && (
                                  <Badge variant="warning" size="sm">Pending</Badge>
                                )}
                                {getAccessLevelBadge(user.access_level)}
                                {isCurrentUser && (
                                  <span className="text-xs text-slate-400">(you)</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500">{user.email}</p>
                              {isGlobalAdmin && user.facilities && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {(user.facilities as { name: string }).name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={getRoleBadgeVariant(roleName)} size="sm">
                              {roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'Unknown'}
                            </Badge>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {deleteConfirm === user.id ? (
                                <>
                                  <span className="text-xs text-slate-500 mr-2">Delete?</span>
                                  <button
                                    onClick={() => handleDelete(user.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  {userIsPending && (
                                    <button
                                      onClick={() => handleResendInvite(user)}
                                      disabled={resendingInvite === user.id}
                                      className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Resend invite email"
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
                                  <button
                                    onClick={() => openEditModal(user)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => setDeleteConfirm(user.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {users.length > 0 && (
                <p className="text-sm text-slate-400">
                  {users.length} user{users.length !== 1 ? 's' : ''} total
                  {pendingUserIds.size > 0 && (
                    <span className="text-amber-500"> · {pendingUserIds.size} pending</span>
                  )}
                </p>
              )}
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={handleInviteSuccess}
        facilityId={currentUserFacilityId}
        roles={roles}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
                <p className="text-sm text-slate-500 mt-0.5">{editingUser.email}</p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Staff Role
                </label>
                <select
                  value={editFormData.role_id}
                  onChange={(e) => setEditFormData({ ...editFormData, role_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Permissions
                </label>
                <select
                  value={editFormData.access_level}
                  onChange={(e) => setEditFormData({ ...editFormData, access_level: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  disabled={editingUser.id === currentUserId}
                >
                  <option value="user">Staff — View cases, record milestones</option>
                  <option value="facility_admin">Facility Admin — Full facility access</option>
                  {isGlobalAdmin && (
                    <option value="global_admin">Global Admin — All facilities access</option>
                  )}
                </select>
                {editingUser.id === currentUserId && (
                  <p className="mt-1 text-xs text-slate-400">You cannot change your own permissions</p>
                )}
              </div>

              {isGlobalAdmin && facilities.length > 0 && editFormData.access_level !== 'global_admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Facility
                  </label>
                  <select
                    value={editFormData.facility_id}
                    onChange={(e) => setEditFormData({ ...editFormData, facility_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select a facility...</option>
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Move this user to a different facility</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!editFormData.first_name || !editFormData.last_name || !editFormData.role_id}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
