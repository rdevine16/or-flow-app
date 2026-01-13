// app/admin/facilities/[id]/page.tsx
// Facility Detail Page - View and manage individual facility

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import { startImpersonation } from '../../../../lib/impersonation'
import { quickAuditLog, formatAuditAction } from '../../../../lib/audit'
import { generateInvitationToken } from '../../../../lib/passwords'
import { sendInvitationEmail } from '../../../../lib/email'
import { formatLastLogin } from '../../../../lib/auth-helpers'
import FacilityLogoUpload from '../../../../components/FacilityLogoUpload'

type TabType = 'overview' | 'users' | 'rooms' | 'procedures' | 'subscription' | 'audit'

interface Facility {
  id: string
  name: string
  address: string | null
  logo_url: string | null
  subscription_status: string
  trial_ends_at: string | null
  subscription_started_at: string | null
  is_demo: boolean
  created_at: string
}

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  access_level: string
  role_id: string
  created_at: string
  last_login_at: string | null
  is_active: boolean
  invitation_token: string | null
  user_roles?: { name: string }
}

interface Room {
  id: string
  name: string
  created_at: string
}

interface ProcedureType {
  id: string
  name: string
  body_region_id: string | null
  created_at: string
}

interface AuditEntry {
  id: string
  user_email: string
  action: string
  created_at: string
  success: boolean
}

interface UserRole {
  id: string
  name: string
}

export default function FacilityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const facilityId = params.id as string
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [roles, setRoles] = useState<UserRole[]>([])

  // Edit states
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editTrialDays, setEditTrialDays] = useState(30)

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showProcedureModal, setShowProcedureModal] = useState(false)

  // Form states
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteAccessLevel, setInviteAccessLevel] = useState('user')
  const [newRoomName, setNewRoomName] = useState('')
  const [newProcedureName, setNewProcedureName] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch facility data
  useEffect(() => {
    if (!isGlobalAdmin || !facilityId) return

    async function fetchData() {
      setLoading(true)

      try {
        // Fetch facility
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single()

        if (facilityData) {
          setFacility(facilityData)
          setEditName(facilityData.name)
          setEditAddress(facilityData.address || '')
          setEditStatus(facilityData.subscription_status)
        }

        // Fetch users
        const { data: usersData } = await supabase
          .from('users')
          .select('*, user_roles(name)')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })

        if (usersData) setUsers(usersData)

        // Fetch rooms
        const { data: roomsData } = await supabase
          .from('or_rooms')
          .select('*')
          .eq('facility_id', facilityId)
          .order('name')

        if (roomsData) setRooms(roomsData)

        // Fetch procedures
        const { data: proceduresData } = await supabase
          .from('procedure_types')
          .select('*')
          .eq('facility_id', facilityId)
          .order('name')

        if (proceduresData) setProcedures(proceduresData)

        // Fetch audit log
        const { data: auditData } = await supabase
          .from('audit_log')
          .select('id, user_email, action, created_at, success')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (auditData) setAuditEntries(auditData)

        // Fetch roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('id, name')
          .order('name')

        if (rolesData) {
          setRoles(rolesData)
          if (rolesData.length > 0) {
            setInviteRole(rolesData[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching facility data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isGlobalAdmin, facilityId, supabase])

  // Save facility changes
  const handleSaveFacility = async () => {
    if (!facility) return

    setSaving(true)

    try {
      const updates: Partial<Facility> = {
        name: editName.trim(),
        address: editAddress.trim() || null,
        subscription_status: editStatus,
      }

      // If changing to trial, set trial end date
      if (editStatus === 'trial' && facility.subscription_status !== 'trial') {
        updates.trial_ends_at = new Date(Date.now() + editTrialDays * 86400000).toISOString()
      }

      const { error } = await supabase
        .from('facilities')
        .update(updates)
        .eq('id', facility.id)

      if (error) throw error

      // Log audit
      const { data: { user } } = await supabase.auth.getUser()
      await quickAuditLog(
        supabase,
        user?.id || '',
        user?.email || '',
        'facility.updated',
        {
          facilityId: facility.id,
          targetType: 'facility',
          targetId: facility.id,
          oldValues: { name: facility.name, subscription_status: facility.subscription_status },
          newValues: updates,
        }
      )

      // Update local state
      setFacility({ ...facility, ...updates })
      alert('Facility updated successfully!')
    } catch (error) {
      console.error('Error updating facility:', error)
      alert('Failed to update facility')
    } finally {
      setSaving(false)
    }
  }

  // Invite user
  const handleInviteUser = async () => {
    if (!facility || !inviteEmail || !inviteFirstName || !inviteLastName || !inviteRole) return

    setSaving(true)

    try {
      const token = generateInvitationToken()
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString() // 7 days

      // Get current user for invited_by
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      // Create user record with invitation token
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: inviteEmail.trim(),
          first_name: inviteFirstName.trim(),
          last_name: inviteLastName.trim(),
          facility_id: facility.id,
          role_id: inviteRole,
          access_level: inviteAccessLevel,
          invitation_token: token,
          invitation_expires_at: expiresAt,
          invited_by: currentUser?.id,
        })
        .select()
        .single()

      if (error) throw error

      // Send invitation email
      const inviterName = currentUser?.user_metadata?.first_name 
        ? `${currentUser.user_metadata.first_name} ${currentUser.user_metadata.last_name}`
        : 'Your administrator'

      await sendInvitationEmail(
        inviteEmail.trim(),
        inviteFirstName.trim(),
        facility.name,
        inviterName,
        token
      )

      // Log audit
      await quickAuditLog(
        supabase,
        currentUser?.id || '',
        currentUser?.email || '',
        'user.invited',
        {
          facilityId: facility.id,
          targetType: 'user',
          targetId: newUser.id,
          newValues: { email: inviteEmail, access_level: inviteAccessLevel },
        }
      )

      // Update local state
      setUsers([newUser, ...users])

      // Reset form
      setInviteFirstName('')
      setInviteLastName('')
      setInviteEmail('')
      setInviteAccessLevel('user')
      setShowInviteModal(false)

      alert('Invitation sent!')
    } catch (error) {
      console.error('Error inviting user:', error)
      alert('Failed to invite user: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Add room
  const handleAddRoom = async () => {
    if (!facility || !newRoomName.trim()) return

    setSaving(true)

    try {
      const { data: newRoom, error } = await supabase
        .from('or_rooms')
        .insert({
          facility_id: facility.id,
          name: newRoomName.trim(),
        })
        .select()
        .single()

      if (error) throw error

      setRooms([...rooms, newRoom].sort((a, b) => a.name.localeCompare(b.name)))
      setNewRoomName('')
      setShowRoomModal(false)
    } catch (error) {
      console.error('Error adding room:', error)
      alert('Failed to add room')
    } finally {
      setSaving(false)
    }
  }

  // Delete room
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`Delete "${roomName}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('or_rooms')
        .delete()
        .eq('id', roomId)

      if (error) throw error

      setRooms(rooms.filter(r => r.id !== roomId))
    } catch (error) {
      console.error('Error deleting room:', error)
      alert('Failed to delete room')
    }
  }

  // Add procedure
  const handleAddProcedure = async () => {
    if (!facility || !newProcedureName.trim()) return

    setSaving(true)

    try {
      const { data: newProcedure, error } = await supabase
        .from('procedure_types')
        .insert({
          facility_id: facility.id,
          name: newProcedureName.trim(),
        })
        .select()
        .single()

      if (error) throw error

      setProcedures([...procedures, newProcedure].sort((a, b) => a.name.localeCompare(b.name)))
      setNewProcedureName('')
      setShowProcedureModal(false)
    } catch (error) {
      console.error('Error adding procedure:', error)
      alert('Failed to add procedure')
    } finally {
      setSaving(false)
    }
  }

  // Delete procedure
  const handleDeleteProcedure = async (procedureId: string, procedureName: string) => {
    if (!confirm(`Delete "${procedureName}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('procedure_types')
        .delete()
        .eq('id', procedureId)

      if (error) throw error

      setProcedures(procedures.filter(p => p.id !== procedureId))
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Failed to delete procedure')
    }
  }

  // Toggle user active status
  const handleToggleUserActive = async (user: User) => {
    const newStatus = !user.is_active
    const action = newStatus ? 'reactivate' : 'deactivate'
    
    if (!confirm(`${newStatus ? 'Reactivate' : 'Deactivate'} ${user.first_name} ${user.last_name}?${!newStatus ? ' They will not be able to log in.' : ''}`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id', user.id)

      if (error) throw error

      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, is_active: newStatus } : u
      ))

      // Log the action
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      await quickAuditLog(
        supabase,
        currentUser?.id || '',
        currentUser?.email || '',
        `user.${action}d`,
        {
          facilityId: facility?.id,
          targetType: 'user',
          targetId: user.id,
          metadata: { userEmail: user.email },
        }
      )
    } catch (error) {
      console.error('Error updating user status:', error)
      alert('Failed to update user status')
    }
  }

  // Impersonate
  const handleImpersonate = async () => {
    if (!facility) return

    const { data: { user } } = await supabase.auth.getUser()

    const result = await startImpersonation(
      supabase,
      user?.id || '',
      facility.id,
      facility.name
    )

    if (result.success) {
      await quickAuditLog(
        supabase,
        user?.id || '',
        user?.email || '',
        'admin.impersonation_started',
        {
          facilityId: facility.id,
          targetType: 'facility',
          targetId: facility.id,
        }
      )

      router.push('/dashboard')
      router.refresh()
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get days until trial ends
  const getDaysRemaining = () => {
    if (!facility?.trial_ends_at) return null
    const diff = new Date(facility.trial_ends_at).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  // Loading
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin || !facility) {
    return null
  }

  const daysRemaining = getDaysRemaining()

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/facilities"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{facility.name}</h1>
            <p className="text-slate-500">{facility.address || 'No address'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            facility.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
            facility.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
            facility.subscription_status === 'past_due' ? 'bg-red-100 text-red-800' :
            'bg-slate-100 text-slate-800'
          }`}>
            {facility.subscription_status === 'active' ? 'Active' :
             facility.subscription_status === 'trial' ? `Trial (${daysRemaining}d left)` :
             facility.subscription_status === 'past_due' ? 'Past Due' :
             facility.subscription_status}
          </span>
        </div>
        <button
          onClick={handleImpersonate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View as Facility
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {(['overview', 'users', 'rooms', 'procedures', 'subscription', 'audit'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'users' && ` (${users.length})`}
              {tab === 'rooms' && ` (${rooms.length})`}
              {tab === 'procedures' && ` (${procedures.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Facility Details */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Facility Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Created</label>
                    <p className="text-slate-600">{formatDate(facility.created_at)}</p>
                  </div>
                  <button
                    onClick={handleSaveFacility}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Right Column - Logo Upload */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Facility Logo</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a logo to display in the header when viewing this facility.
                </p>
                <FacilityLogoUpload
                  facilityId={facility.id}
                  currentLogoUrl={facility.logo_url}
                  onLogoChange={(newUrl) => {
                    setFacility({ ...facility, logo_url: newUrl })
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-900">Users ({users.length})</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite User
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Access</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Login</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-slate-50 ${!user.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {user.first_name} {user.last_name}
                        </span>
                        {!user.is_active && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                            Deactivated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {(user.user_roles as any)?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.access_level === 'facility_admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.access_level === 'facility_admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!user.is_active ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">Inactive</span>
                      ) : user.invitation_token ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Pending</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {formatLastLogin(user.last_login_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggleUserActive(user)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          user.is_active
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {user.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No users yet. Invite someone to get started.
              </div>
            )}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-900">Operating Rooms</h2>
              <button
                onClick={() => setShowRoomModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Room
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {rooms.map((room) => (
                <div key={room.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{room.name}</span>
                  <button
                    onClick={() => handleDeleteRoom(room.id, room.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {rooms.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">No rooms yet</div>
              )}
            </div>
          </div>
        )}

        {/* Procedures Tab */}
        {activeTab === 'procedures' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-900">Procedure Types</h2>
              <button
                onClick={() => setShowProcedureModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Procedure
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {procedures.map((proc) => (
                <div key={proc.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{proc.name}</span>
                  <button
                    onClick={() => handleDeleteProcedure(proc.id, proc.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {procedures.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">No procedures yet</div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Subscription</h2>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {editStatus === 'trial' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trial Length (days)</label>
                  <select
                    value={editTrialDays}
                    onChange={(e) => setEditTrialDays(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              )}

              {facility.trial_ends_at && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Trial ends: <strong>{formatDate(facility.trial_ends_at)}</strong>
                    {daysRemaining !== null && (
                      <span className={`ml-2 ${daysRemaining <= 3 ? 'text-red-600' : ''}`}>
                        ({daysRemaining} days remaining)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {facility.subscription_started_at && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Started</label>
                  <p className="text-slate-600">{formatDate(facility.subscription_started_at)}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDemo"
                  checked={facility.is_demo}
                  disabled
                  className="w-4 h-4"
                />
                <label htmlFor="isDemo" className="text-sm text-slate-600">Demo account</label>
              </div>

              <button
                onClick={handleSaveFacility}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div>
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Activity Log</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{entry.user_email}</span>
                      {' '}
                      <span className="text-slate-600">{formatAuditAction(entry.action as any)}</span>
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(entry.created_at)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    entry.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {entry.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
              {auditEntries.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">No activity yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Invite User</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Level</label>
                <select
                  value={inviteAccessLevel}
                  onChange={(e) => setInviteAccessLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="user">User (Staff)</option>
                  <option value="facility_admin">Facility Admin</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={saving || !inviteEmail || !inviteFirstName || !inviteLastName}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Add Room</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g., OR 4"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowRoomModal(false)} className="px-4 py-2 text-slate-600 font-medium">
                Cancel
              </button>
              <button
                onClick={handleAddRoom}
                disabled={saving || !newRoomName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
              >
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Procedure Modal */}
      {showProcedureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Add Procedure</h3>
              <button onClick={() => setShowProcedureModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Name</label>
              <input
                type="text"
                value={newProcedureName}
                onChange={(e) => setNewProcedureName(e.target.value)}
                placeholder="e.g., Total Hip Replacement"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowProcedureModal(false)} className="px-4 py-2 text-slate-600 font-medium">
                Cancel
              </button>
              <button
                onClick={handleAddProcedure}
                disabled={saving || !newProcedureName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
              >
                Add Procedure
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
