// app/settings/general/page.tsx
// Facility Overview: View and edit facility details with audit logging

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { facilityAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  cases: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  rooms: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  copy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
}

// =====================================================
// COMPONENT
// =====================================================

export default function GeneralOverviewPage() {
  const supabase = createClient()
  const { effectiveFacilityId, isFacilityAdmin, isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast() 
  // State
  const [facility, setFacility] = useState<Facility | null>(null)
  const [stats, setStats] = useState<FacilityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    timezone: '',
  })

  const canEdit = isFacilityAdmin || isGlobalAdmin

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchData = useCallback(async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    try {
      // Fetch facility details
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', effectiveFacilityId)
        .single()

      if (facilityError) throw facilityError

      setFacility(facilityData)
      setFormData({
        name: facilityData.name || '',
        address: facilityData.address || '',
        city: facilityData.city || '',
        state: facilityData.state || '',
        zip: facilityData.zip || '',
        phone: facilityData.phone || '',
        timezone: facilityData.timezone || 'America/New_York',
      })

      // Fetch stats
      const [casesRes, usersRes, roomsRes, casesThisMonthRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .eq('is_active', true),
        supabase
          .from('or_rooms')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .is('deleted_at', null),
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', effectiveFacilityId)
          .gte('scheduled_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      ])

      setStats({
        totalCases: casesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalRooms: roomsRes.count || 0,
        casesThisMonth: casesThisMonthRes.count || 0,
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to load facility data',
        message: error instanceof Error ? error.message : 'Failed to load facility data'
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, supabase])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId, fetchData])

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
    <DashboardLayout>
      <Container>
        <SettingsLayout title="General" description="Manage your facility's basic information and settings">
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
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mb-3">
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
                    <button
                      onClick={() => setEditMode(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {icons.edit}
                      Edit
                    </button>
                  )}
                  {editMode && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !formData.name.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            {icons.check}
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Facility Name */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Facility Name
                        <span className="text-red-500 ml-1">*</span>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
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
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}