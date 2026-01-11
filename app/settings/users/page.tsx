'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import SearchableDropdown from '../../../components/ui/SearchableDropdown'
import Badge from '../../../components/ui/Badge'
import InviteUserModal from '@/components/InviteUserModal'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role_id: string
  access_level: string
  user_roles: { name: string }[] | { name: string } | null
}

interface UserRole {
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
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentUserFacilityId, setCurrentUserFacilityId] = useState<string | null>(null)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role_id: '',
  })

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
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
      .select('id, first_name, last_name, email, role_id, access_level, user_roles (name)')
      .order('last_name')

    // If not global admin, filter by facility
    if (!isGlobal && facilityId) {
      usersQuery = usersQuery.eq('facility_id', facilityId)
    }

    const [usersRes, rolesRes] = await Promise.all([
      usersQuery,
      supabase.from('user_roles').select('id, name').order('name'),
    ])

    setUsers((usersRes.data as User[]) || [])
    setRoles(rolesRes.data || [])
    setLoading(false)
  }

  const handleInviteSuccess = () => {
    setSuccessMessage('Invitation sent successfully! The user will receive an email to set their password.')
    fetchData(currentUserFacilityId, isGlobalAdmin)
    
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const handleEdit = async (id: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role_id: formData.role_id,
      })
      .eq('id', id)

    if (!error) {
      const role = roles.find(r => r.id === formData.role_id)
      setUsers(
        users
          .map(u => u.id === id ? {
            ...u,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            role_id: formData.role_id,
            user_roles: role ? { name: role.name } : null,
          } : u)
          .sort((a, b) => a.last_name.localeCompare(b.last_name))
      )
      setEditingId(null)
      setFormData({ first_name: '', last_name: '', email: '', role_id: '' })
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id)

    if (!error) {
      setUsers(users.filter(u => u.id !== id))
      setDeleteConfirm(null)
    }
  }

  const startEditing = (user: User) => {
    setEditingId(user.id)
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role_id: user.role_id,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setFormData({ first_name: '', last_name: '', email: '', role_id: '' })
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

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Users & Roles"
          description="Manage staff members who can access this facility."
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
                  <div>
                    <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  </div>
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
                  <p className="text-slate-400 text-xs mt-1">Invite surgeons, nurses, and staff to get started</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {users.map((user) => {
                    const roleName = getRoleName(user.user_roles)

                    return (
                      <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        {editingId === user.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                placeholder="First Name"
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                              <input
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                placeholder="Last Name"
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="Email"
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                              <SearchableDropdown
                                placeholder="Select Role"
                                value={formData.role_id}
                                onChange={(id) => setFormData({ ...formData, role_id: id })}
                                options={roles.map(r => ({
                                  id: r.id,
                                  label: r.name.charAt(0).toUpperCase() + r.name.slice(1),
                                }))}
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={cancelEditing}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEdit(user.id)}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
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
                                  {getAccessLevelBadge(user.access_level)}
                                </div>
                                <p className="text-sm text-slate-500">{user.email}</p>
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
                                    <button
                                      onClick={() => startEditing(user)}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(user.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {users.length > 0 && (
                <p className="text-sm text-slate-400">
                  {users.length} user{users.length !== 1 ? 's' : ''} total
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
    </DashboardLayout>
  )
}