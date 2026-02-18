// app/admin/facilities/[id]/page.tsx
// Enterprise Facility Detail Page - View and manage individual facility
// Professional SaaS dashboard with usage metrics and status indicators

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { BreadcrumbLabel } from '@/lib/BreadcrumbContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { startImpersonation } from '@/lib/impersonation'
import { formatAuditAction } from '@/lib/audit'
import { facilityAudit, userAudit, adminAudit } from '@/lib/audit-logger'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, EmptyStateIcons } from '@/components/ui/EmptyState'
import { generateInvitationToken } from '@/lib/passwords'
import { sendInvitationEmail } from '@/lib/email'
import { formatLastLogin } from '@/lib/auth-helpers'
import FacilityLogoUpload from '@/components/FacilityLogoUpload'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Building2, CheckCircle2, ChevronLeft, ClipboardList, Clock, Eye, FlaskConical, Plus, Trash2, TrendingUp, UserPlus, Users } from 'lucide-react'

type TabType = 'overview' | 'users' | 'rooms' | 'procedures' | 'subscription' | 'audit'

// =====================================================
// TYPES
// =====================================================

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
  target_label?: string
}

interface UserRole {
  id: string
  name: string
}

interface FacilityStats {
  casesThisMonth: number
  casesLastMonth: number
  casesAllTime: number
  activeUsers: number
  totalUsers: number
  completedCases: number
  avgCasesPerDay: number
  lastActivity: string | null
  dataQualityScore: number
  openIssues: number
}

// =====================================================
// PLAN DATA
// =====================================================

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 750,
    limits: { casesPerMonth: 100, users: 5 },
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 1500,
    limits: { casesPerMonth: 300, users: 20 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2500,
    limits: { casesPerMonth: Infinity, users: Infinity },
  },
]

// =====================================================
// SKELETON COMPONENTS
// =====================================================

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-32" />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Hero Card Skeleton */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <div className="h-4 bg-slate-700 rounded w-20" />
            <div className="h-8 bg-slate-700 rounded w-40" />
            <div className="h-4 bg-slate-700 rounded w-32" />
          </div>
          <div className="h-12 w-24 bg-slate-700 rounded-lg" />
        </div>
      </div>
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

// =====================================================
// STAT CARD COMPONENT
// =====================================================

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  trend?: { value: number; isPositive: boolean }
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'slate'
}

function StatCard({ label, value, subtext, icon, trend, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  )
}

// =====================================================
// PROGRESS BAR COMPONENT
// =====================================================

interface UsageBarProps {
  label: string
  used: number
  limit: number
  subtext?: string
  formatValue?: (val: number) => string
}

function UsageBar({ label, used, limit, subtext, formatValue }: UsageBarProps) {
  const percentage = limit === Infinity ? 0 : Math.min((used / limit) * 100, 100)
  const displayLimit = limit === Infinity ? '∞' : formatValue ? formatValue(limit) : limit.toLocaleString()
  const displayUsed = formatValue ? formatValue(used) : used.toLocaleString()

  const getBarColor = () => {
    if (percentage > 90) return 'bg-red-500'
    if (percentage > 75) return 'bg-amber-500'
    return 'bg-blue-500'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-medium text-slate-900">
          {displayUsed} / {displayLimit}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function FacilityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const facilityId = params.id as string
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [roles, setRoles] = useState<UserRole[]>([])
  const [stats, setStats] = useState<FacilityStats | null>(null)

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

  // Determine current plan (would come from database in production)
  const currentPlan = plans[1] // Professional

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch facility stats
  const fetchStats = useCallback(async () => {
    if (!facilityId) return
    setStatsLoading(true)

    try {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const [
        thisMonthRes,
        lastMonthRes,
        allTimeRes,
        activeUsersRes,
        totalUsersRes,
        completedRes,
        recentActivityRes,
        openIssuesRes,
      ] = await Promise.all([
        // Cases this month
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .gte('scheduled_date', firstOfMonth.toISOString().split('T')[0]),
        // Cases last month
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .gte('scheduled_date', firstOfLastMonth.toISOString().split('T')[0])
          .lte('scheduled_date', lastOfLastMonth.toISOString().split('T')[0]),
        // All time cases
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId),
        // Active users
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .eq('is_active', true),
        // Total users
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId),
        // Completed cases (last 30 days)
        supabase
          .from('cases')
          .select('id, case_statuses!inner(name)', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .eq('case_statuses.name', 'completed')
          .gte('scheduled_date', thirtyDaysAgo.toISOString().split('T')[0]),
        // Last activity
        supabase
          .from('audit_log')
          .select('created_at')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        // Open data quality issues
        supabase
          .from('metric_issues')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)
          .is('resolved_at', null),
      ])

      const casesThisMonth = thisMonthRes.count || 0
      const casesLastMonth = lastMonthRes.count || 0
      const dayOfMonth = now.getDate()
      const avgCasesPerDay = dayOfMonth > 0 ? Math.round((casesThisMonth / dayOfMonth) * 10) / 10 : 0

      // Calculate data quality score (simplified)
      const totalCases = allTimeRes.count || 1
      const issues = openIssuesRes.count || 0
      const dataQualityScore = Math.max(0, Math.min(100, Math.round(100 - (issues / totalCases) * 100)))

      setStats({
        casesThisMonth,
        casesLastMonth,
        casesAllTime: allTimeRes.count || 0,
        activeUsers: activeUsersRes.count || 0,
        totalUsers: totalUsersRes.count || 0,
        completedCases: completedRes.count || 0,
        avgCasesPerDay,
        lastActivity: recentActivityRes.data?.created_at || null,
        dataQualityScore,
        openIssues: issues,
      })
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error fetching facility stats:',
    message: error instanceof Error ? error.message : 'Error fetching facility stats:',
  })
} finally {
      setStatsLoading(false)
    }
  }, [facilityId, supabase, showToast])

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
          .is('deleted_at', null)
          .order('name')

        if (roomsData) setRooms(roomsData)

        // Fetch procedures
        const { data: proceduresData } = await supabase
          .from('procedure_types')
          .select('*')
          .eq('facility_id', facilityId)
          .is('deleted_at', null)
          .order('name')

        if (proceduresData) setProcedures(proceduresData)

        // Fetch audit log
        const { data: auditData } = await supabase
          .from('audit_log')
          .select('id, user_email, action, created_at, success, target_label')
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
        showToast({
  type: 'error',
  title: 'Error fetching facility data:',
  message: error instanceof Error ? error.message : 'Error fetching facility data:'
})

      } finally {
        setLoading(false)
      }
    }

    fetchData()
    fetchStats()
  }, [isGlobalAdmin, facilityId, supabase, fetchStats, showToast])

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
      await facilityAudit.updated(supabase, facility.name, facility.id, updates)

      // Update local state
      setFacility({ ...facility, ...updates })
      alert('Facility updated successfully!')
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error updating facility:',
  message: error instanceof Error ? error.message : 'Error updating facility:'
})
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
      await userAudit.invited(supabase, inviteEmail.trim(), newUser.id)

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
      showToast({
  type: 'error',
  title: 'Error inviting user:',
  message: error instanceof Error ? error.message : 'Error inviting user:'
})
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
      showToast({
  type: 'error',
  title: 'Error adding room:',
  message: error instanceof Error ? error.message : 'Error adding room:'
})
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
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', roomId)

      if (error) throw error

      setRooms(rooms.filter(r => r.id !== roomId))
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error deleting room:',
  message: error instanceof Error ? error.message : 'Error deleting room:'
})
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
      showToast({
  type: 'error',
  title: 'Error adding procedure:',
  message: error instanceof Error ? error.message : 'Error adding procedure:'
})
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
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', procedureId)

      if (error) throw error

      setProcedures(procedures.filter(p => p.id !== procedureId))
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error deleting procedure:',
  message: error instanceof Error ? error.message : 'Error deleting procedure:'
})
      alert('Failed to delete procedure')
    }
  }

  // Toggle user active status
  const handleToggleUserActive = async (user: User) => {
    const newStatus = !user.is_active

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
      const userName = `${user.first_name} ${user.last_name}`
      if (newStatus) {
        await userAudit.reactivated(supabase, userName, user.email, user.id)
      } else {
        await userAudit.deactivated(supabase, userName, user.email, user.id)
      }
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error updating user status:',
  message: error instanceof Error ? error.message : 'Error updating user status:'
})
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
      await adminAudit.impersonationStarted(supabase, facility.name, facility.id)

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

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  // Get days until trial ends
  const getDaysRemaining = () => {
    if (!facility?.trial_ends_at) return null
    const diff = new Date(facility.trial_ends_at).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  // Get usage trend
  const getUsageTrend = () => {
    if (!stats || stats.casesLastMonth === 0) return null
    const change = ((stats.casesThisMonth - stats.casesLastMonth) / stats.casesLastMonth) * 100
    return { value: Math.round(Math.abs(change)), isPositive: change >= 0 }
  }

  // Get status badge config
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      active: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500', label: 'Active' },
      trial: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Trial' },
      past_due: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'Past Due' },
      cancelled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Cancelled' },
      disabled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Disabled' },
    }
    return configs[status] || configs.disabled
  }

  // Loading
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <BreadcrumbLabel routeKey="/admin/facilities/[id]" label={undefined} />
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
  const statusConfig = getStatusConfig(facility.subscription_status)
  const usageTrend = getUsageTrend()

  return (
    <DashboardLayout>
      <BreadcrumbLabel routeKey="/admin/facilities/[id]" label={facility?.name} />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/admin/facilities"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{facility.name}</h1>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bg}`}>
                <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                <span className={`text-sm font-medium ${statusConfig.text}`}>
                  {statusConfig.label}
                  {facility.subscription_status === 'trial' && daysRemaining !== null && ` • ${daysRemaining}d left`}
                </span>
              </div>
              {facility.is_demo && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  Demo
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-1">{facility.address || 'No address on file'}</p>
          </div>
          <button
            onClick={handleImpersonate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
          >
            <Eye className="w-5 h-5" />
            View as Facility
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1">
          {(['overview', 'users', 'rooms', 'procedures', 'subscription', 'audit'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'users' && <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{users.length}</span>}
              {tab === 'rooms' && <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{rooms.length}</span>}
              {tab === 'procedures' && <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{procedures.length}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          statsLoading ? <OverviewSkeleton /> : (
            <div className="p-6 space-y-6">
              {/* Hero Status Card */}
              <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl p-6 text-white relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#grid)" />
                  </svg>
                </div>

                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Current Plan</p>
                    <h2 className="text-3xl font-bold mb-1">{currentPlan.name}</h2>
                    <p className="text-slate-400">
                      Member since {formatDate(facility.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">${currentPlan.price}</p>
                    <p className="text-slate-400 text-sm">/month</p>
                  </div>
                </div>

                <div className="relative flex items-center gap-6 pt-4 mt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      facility.subscription_status === 'active' ? 'bg-green-400' :
                      facility.subscription_status === 'trial' ? 'bg-blue-400' :
                      'bg-red-400'
                    }`} />
                    <span className="text-sm text-slate-300">{statusConfig.label}</span>
                  </div>
                  {stats?.lastActivity && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-sm text-slate-400">
                        Last activity: {formatRelativeTime(stats.lastActivity)}
                      </span>
                    </>
                  )}
                  {facility.subscription_status === 'trial' && daysRemaining !== null && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className={`text-sm ${daysRemaining <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                        Trial ends in {daysRemaining} days
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Cases This Month"
                  value={stats?.casesThisMonth || 0}
                  subtext={`${stats?.casesLastMonth || 0} last month`}
                  trend={usageTrend || undefined}
                  color="blue"
                  icon={
                    <ClipboardList className="w-5 h-5" />
                  }
                />
                <StatCard
                  label="Active Users"
                  value={stats?.activeUsers || 0}
                  subtext={`of ${stats?.totalUsers || 0} total`}
                  color="green"
                  icon={
                    <Users className="w-5 h-5" />
                  }
                />
                <StatCard
                  label="Data Quality"
                  value={`${stats?.dataQualityScore || 100}%`}
                  subtext={`${stats?.openIssues || 0} open issues`}
                  color={stats?.dataQualityScore && stats.dataQualityScore < 80 ? 'amber' : 'purple'}
                  icon={
                    <CheckCircle2 className="w-5 h-5" />
                  }
                />
                <StatCard
                  label="All Time Cases"
                  value={stats?.casesAllTime?.toLocaleString() || 0}
                  subtext={`~${stats?.avgCasesPerDay || 0} per day avg`}
                  color="slate"
                  icon={
                    <TrendingUp className="w-5 h-5" />
                  }
                />
              </div>

              {/* Usage Metrics */}
              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Plan Usage</h3>
                  <span className="text-xs text-slate-500">Resets monthly</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UsageBar
                    label="Cases This Month"
                    used={stats?.casesThisMonth || 0}
                    limit={currentPlan.limits.casesPerMonth}
                    subtext={currentPlan.limits.casesPerMonth === Infinity ? 'Unlimited plan' : `${currentPlan.limits.casesPerMonth - (stats?.casesThisMonth || 0)} remaining`}
                  />
                  <UsageBar
                    label="Active Users"
                    used={stats?.activeUsers || 0}
                    limit={currentPlan.limits.users}
                    subtext={currentPlan.limits.users === Infinity ? 'Unlimited plan' : `${currentPlan.limits.users - (stats?.activeUsers || 0)} seats available`}
                  />
                </div>
              </div>

              {/* Quick Actions & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveTab('users')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
                    >
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <p className="font-medium text-slate-900">Invite User</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add team members</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('rooms')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
                    >
                      <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <p className="font-medium text-slate-900">Manage Rooms</p>
                      <p className="text-xs text-slate-500 mt-0.5">{rooms.length} configured</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('procedures')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
                    >
                      <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <p className="font-medium text-slate-900">Procedures</p>
                      <p className="text-xs text-slate-500 mt-0.5">{procedures.length} types</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
                    >
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <p className="font-medium text-slate-900">Audit Log</p>
                      <p className="text-xs text-slate-500 mt-0.5">View activity</p>
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Recent Activity</h3>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {auditEntries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          entry.success ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">
                            <span className="font-medium">{entry.user_email.split('@')[0]}</span>
                            {' '}
                            <span className="text-slate-500">{formatAuditAction(entry.action)}</span>
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatRelativeTime(entry.created_at)}
                        </span>
                      </div>
                    ))}
                    {auditEntries.length === 0 && (
                      <div className="p-6 text-center text-slate-400 text-sm">
                        No activity recorded yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Facility Details Form */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-4">Facility Details</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Facility Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="123 Medical Center Drive"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleSaveFacility}
                      disabled={saving}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Facility Logo</label>
                    <p className="text-sm text-slate-500 mb-3">
                      Displayed in the header when viewing this facility
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
            </div>
          )
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-900">Users</h2>
                <p className="text-sm text-slate-500">{users.filter(u => u.is_active).length} active of {users.length} total</p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Invite User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Access</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {user.first_name[0]}{user.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">{user.user_roles?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          user.access_level === 'facility_admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {user.access_level === 'facility_admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.invitation_token ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : user.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {user.last_login_at ? formatLastLogin(user.last_login_at) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleUserActive(user)}
                          className={`text-sm font-medium transition-colors ${
                            user.is_active
                              ? 'text-slate-500 hover:text-red-600'
                              : 'text-green-600 hover:text-green-600'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <EmptyState
                icon={EmptyStateIcons.Users}
                title="No users yet"
                description="Invite someone to get started"
              />
            )}
          </div>
        )}

        {/* ===== ROOMS TAB ===== */}
        {activeTab === 'rooms' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-900">Operating Rooms</h2>
                <p className="text-sm text-slate-500">{rooms.length} rooms configured</p>
              </div>
              <button
                onClick={() => setShowRoomModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Room
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {rooms.map((room) => (
                <div key={room.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="font-medium text-slate-900">{room.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteRoom(room.id, room.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {rooms.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No rooms configured</p>
                  <p className="text-sm text-slate-400 mt-1">Add operating rooms to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== PROCEDURES TAB ===== */}
        {activeTab === 'procedures' && (
          <div>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-900">Procedure Types</h2>
                <p className="text-sm text-slate-500">{procedures.length} procedures configured</p>
              </div>
              <button
                onClick={() => setShowProcedureModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Procedure
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {procedures.map((proc) => (
                <div key={proc.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                      <FlaskConical className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="font-medium text-slate-900">{proc.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteProcedure(proc.id, proc.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {procedures.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FlaskConical className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No procedures configured</p>
                  <p className="text-sm text-slate-400 mt-1">Add procedure types to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SUBSCRIPTION TAB ===== */}
        {activeTab === 'subscription' && (
          <div className="p-6 space-y-6">
            {/* Plan Overview Card */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Current Plan</p>
                  <h2 className="text-2xl font-bold">{currentPlan.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">${currentPlan.price}</p>
                  <p className="text-slate-400 text-sm">per month</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    facility.subscription_status === 'active' ? 'bg-green-400' :
                    facility.subscription_status === 'trial' ? 'bg-blue-400' : 'bg-red-400'
                  }`} />
                  <span className="text-sm text-slate-300">{statusConfig.label}</span>
                </div>
                {facility.subscription_started_at && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-sm text-slate-400">
                      Started {formatDate(facility.subscription_started_at)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Status Management */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Subscription Status</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trial Length</label>
                    <select
                      value={editTrialDays}
                      onChange={(e) => setEditTrialDays(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                  <div className={`p-4 rounded-lg ${
                    daysRemaining !== null && daysRemaining <= 7
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <p className={`text-sm ${
                      daysRemaining !== null && daysRemaining <= 7 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      Trial ends: <strong>{formatDate(facility.trial_ends_at)}</strong>
                      {daysRemaining !== null && (
                        <span className="ml-2">({daysRemaining} days remaining)</span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDemo"
                    checked={facility.is_demo}
                    disabled
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label htmlFor="isDemo" className="text-sm text-slate-600">Demo account</label>
                </div>

                <button
                  onClick={handleSaveFacility}
                  disabled={saving}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== AUDIT TAB ===== */}
        {activeTab === 'audit' && (
          <div>
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Activity Log</h2>
              <p className="text-sm text-slate-500">Recent actions performed at this facility</p>
            </div>
            <div className="divide-y divide-slate-100">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-start justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      entry.success ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{entry.user_email}</span>
                        {' '}
                        <span className="text-slate-600">{formatAuditAction(entry.action)}</span>
                        {entry.target_label && (
                          <span className="text-slate-400 ml-1">• {entry.target_label}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                    entry.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {entry.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
              {auditEntries.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No activity yet</p>
                  <p className="text-sm text-slate-400 mt-1">Actions will appear here as they happen</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Invite User Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite User"
      >
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

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowInviteModal(false)} />
          <Modal.Action
            onClick={handleInviteUser}
            loading={saving}
            disabled={!inviteEmail || !inviteFirstName || !inviteLastName}
          >
            Send Invitation
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Add Room Modal */}
      <Modal
        open={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        title="Add Room"
        size="sm"
      >
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g., OR 4"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowRoomModal(false)} />
          <Modal.Action onClick={handleAddRoom} loading={saving} disabled={!newRoomName.trim()}>
            Add Room
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Add Procedure Modal */}
      <Modal
        open={showProcedureModal}
        onClose={() => setShowProcedureModal(false)}
        title="Add Procedure"
        size="sm"
      >
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Name</label>
              <input
                type="text"
                value={newProcedureName}
                onChange={(e) => setNewProcedureName(e.target.value)}
                placeholder="e.g., Total Hip Replacement"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />

        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowProcedureModal(false)} />
          <Modal.Action onClick={handleAddProcedure} loading={saving} disabled={!newProcedureName.trim()}>
            Add Procedure
          </Modal.Action>
        </Modal.Footer>
      </Modal>
    </DashboardLayout>
  )
}