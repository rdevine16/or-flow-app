// app/settings/general/page.tsx
// Facility Overview: View and edit facility details with audit logging

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { facilityAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { Building2, CalendarDays, Check, ClipboardList, Copy, LayoutDashboard, Lock, Pencil, UsersRound } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface Facility {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  timezone: string
  created_at: string
  updated_at: string | null
}

interface FacilityStats {
  totalCases: number
  totalUsers: number
  totalRooms: number
  casesThisMonth: number
}

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
]

// US States
const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

// =====================================================
// SKELETON COMPONENTS
// =====================================================

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Account Status Card Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-5 bg-slate-200 rounded w-32 animate-pulse" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-slate-200 rounded w-16 mx-auto mb-2 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-20 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Facility Details Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-5 bg-slate-200 rounded w-40 animate-pulse" />
        </div>
        <div className="p-6 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-24 animate-pulse" />
              <div className="h-10 bg-slate-100 rounded w-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ICONS
// =====================================================

const icons = {
  building: (
    <Building2 className="w-5 h-5" />
  ),
  cases: (
    <ClipboardList className="w-5 h-5" />
  ),
  users: (
    <UsersRound className="w-5 h-5" />
  ),
  rooms: (
    <LayoutDashboard className="w-5 h-5" />
  ),
  calendar: (
    <CalendarDays className="w-5 h-5" />
  ),
  check: (
    <Check className="w-4 h-4" />
  ),
  edit: (
    <Pencil className="w-4 h-4" />
  ),
  lock: (
    <Lock className="w-4 h-4" />
  ),
  copy: (
    <Copy className="w-4 h-4" />
  ),
}

// =====================================================
// COMPONENT
// =====================================================

export default function GeneralOverviewPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading, can, isGlobalAdmin } = useUser()
  const { showToast } = useToast() 
  
  // Data fetching
  const { data: facility, loading: facilityLoading, error, setData: setFacility } = useSupabaseQuery<Facility | null>(
    async (sb) => {
      const { data, error } = await sb
        .from('facilities')
        .select('*')
        .eq('id', effectiveFacilityId!)
        .single()
      if (error) throw error
      return data
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const { data: stats } = useSupabaseQuery<FacilityStats>(
    async (sb) => {
      const [casesRes, usersRes, roomsRes, casesThisMonthRes] = await Promise.all([
        sb.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', effectiveFacilityId!),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('facility_id', effectiveFacilityId!).eq('is_active', true),
        sb.from('or_rooms').select('id', { count: 'exact', head: true }).eq('facility_id', effectiveFacilityId!).is('deleted_at', null),
        sb.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', effectiveFacilityId!)
          .gte('scheduled_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      ])
      return {
        totalCases: casesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalRooms: roomsRes.count || 0,
        casesThisMonth: casesThisMonthRes.count || 0,
      }
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const loading = facilityLoading
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '', address: '', city: '', state: '', zip: '', phone: '', timezone: '',
  })

  // Sync form from facility data
  useEffect(() => {
    if (facility) {
      setFormData({
        name: facility.name || '', address: facility.address || '',
        city: facility.city || '', state: facility.state || '',
        zip: facility.zip || '', phone: facility.phone || '',
        timezone: facility.timezone || 'America/New_York',
      })
    }
  }, [facility])

  const canEdit = can('settings.manage')

  // =====================================================
  // HANDLERS
  // =====================================================


  const handleSave = async () => {
    if (!facility || !effectiveFacilityId) return
    setSaving(true)

    try {
      // Track what changed for audit log
      const changes: Record<string, unknown> = {}
      if (formData.name !== facility.name) changes.name = formData.name
      if (formData.address !== (facility.address || '')) changes.address = formData.address
      if (formData.city !== (facility.city || '')) changes.city = formData.city
      if (formData.state !== (facility.state || '')) changes.state = formData.state
      if (formData.zip !== (facility.zip || '')) changes.zip = formData.zip
      if (formData.phone !== (facility.phone || '')) changes.phone = formData.phone
      if (formData.timezone !== facility.timezone) changes.timezone = formData.timezone

      if (Object.keys(changes).length === 0) {
        setEditMode(false)
        return
      }

      const { error } = await supabase
        .from('facilities')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state || null,
          zip: formData.zip.trim() || null,
          phone: formData.phone.trim() || null,
          timezone: formData.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', effectiveFacilityId)

      if (error) throw error

      // Audit log
      await facilityAudit.updated(supabase, formData.name, effectiveFacilityId, changes)

      // Update local state
      setFacility({
        ...facility,
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip: formData.zip.trim() || null,
        phone: formData.phone.trim() || null,
        timezone: formData.timezone,
        updated_at: new Date().toISOString(),
      })

setEditMode(false)
showToast({
  type: 'success',
  title: 'Facility Updated',
  message: 'Facility details have been updated successfully'
})
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error Saving Changes',
    message: error instanceof Error ? error.message : 'Failed to save changes'
  })
} finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (facility) {
      setFormData({
        name: facility.name || '',
        address: facility.address || '',
        city: facility.city || '',
        state: facility.state || '',
        zip: facility.zip || '',
        phone: facility.phone || '',
        timezone: facility.timezone || 'America/New_York',
      })
    }
    setEditMode(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getTimezoneLabel = (value: string) => {
    return TIMEZONES.find(tz => tz.value === value)?.label || value
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">General</h1>
      <p className="text-slate-500 mb-6">Manage your facility&apos;s basic information and settings</p>

      <ErrorBanner message={error} />

      {loading ? (
        <OverviewSkeleton />
      ) : !effectiveFacilityId || !facility ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            {icons.building}
          </div>
          <p className="text-slate-500">No facility selected</p>
        </div>
      ) : (
        <div className="space-y-6">
              {/* Quick Stats Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Account Overview</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
                        {icons.cases}
                      </div>
                      <p className="text-2xl font-semibold text-slate-900">{stats?.totalCases.toLocaleString() || 0}</p>
                      <p className="text-sm text-slate-500">Total Cases</p>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-50 text-green-600 mb-3">
                        {icons.calendar}
                      </div>
                      <p className="text-2xl font-semibold text-slate-900">{stats?.casesThisMonth.toLocaleString() || 0}</p>
                      <p className="text-sm text-slate-500">This Month</p>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-50 text-purple-600 mb-3">
                        {icons.users}
                      </div>
                      <p className="text-2xl font-semibold text-slate-900">{stats?.totalUsers || 0}</p>
                      <p className="text-sm text-slate-500">Active Users</p>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600 mb-3">
                        {icons.rooms}
                      </div>
                      <p className="text-2xl font-semibold text-slate-900">{stats?.totalRooms || 0}</p>
                      <p className="text-sm text-slate-500">OR Rooms</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facility Details Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">Facility Details</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Basic information about your facility</p>
                  </div>
                  {canEdit && !editMode && (
                    <Button variant="secondary" onClick={() => setEditMode(true)}>
                      {icons.edit}
                      Edit
                    </Button>
                  )}
                  {editMode && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} loading={saving} disabled={!formData.name.trim()}>
                        {icons.check}
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Facility Name */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Facility Name
                        <span className="text-red-600 ml-1">*</span>
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                          placeholder="Enter facility name"
                        />
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">{facility.name}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Street Address</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                          placeholder="123 Medical Center Drive"
                        />
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {facility.address || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                          placeholder="Chicago"
                        />
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {facility.city || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                      {editMode ? (
                        <select
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
                        >
                          <option value="">Select state</option>
                          {US_STATES.map((state) => (
                            <option key={state.value} value={state.value}>
                              {state.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {US_STATES.find(s => s.value === facility.state)?.label || facility.state || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>

                    {/* ZIP */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.zip}
                          onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                          placeholder="60601"
                          maxLength={10}
                        />
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {facility.zip || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                      {editMode ? (
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                          placeholder="(312) 555-0100"
                        />
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {facility.phone || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>

                    {/* Timezone */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
                      {editMode ? (
                        <select
                          value={formData.timezone}
                          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-900">
                          {getTimezoneLabel(facility.timezone)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Information Card (Read-only) */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">Account Information</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 rounded">
                    {icons.lock}
                    Read-only
                  </span>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Account ID */}
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Account ID</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-2.5 bg-slate-50 rounded-lg text-sm text-slate-600 font-mono truncate">
                          {facility.id}
                        </code>
                        <button
                          onClick={() => copyToClipboard(facility.id)}
                          className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied ? icons.check : icons.copy}
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">Use this ID when contacting support</p>
                    </div>

                    {/* Created Date */}
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Account Created</label>
                      <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-600">
                        {formatDate(facility.created_at)}
                      </p>
                    </div>

                    {/* Account Status */}
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Account Status</label>
                      <div className="px-4 py-2.5 bg-slate-50 rounded-lg">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          Active
                        </span>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Last Updated</label>
                      <p className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-600">
                        {facility.updated_at ? formatDate(facility.updated_at) : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone (Global Admin Only) */}
              {isGlobalAdmin && (
                <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-red-200 bg-red-50">
                    <h3 className="font-medium text-red-900">Danger Zone</h3>
                    <p className="text-sm text-red-600 mt-0.5">Irreversible administrative actions</p>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Delete Facility</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Permanently remove this facility and all associated data. This action cannot be undone.
                        </p>
                      </div>
                      <button
                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        onClick={() => alert('Delete functionality would require typed confirmation')}
                      >
                        Delete Facility
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
    </>
  )
}