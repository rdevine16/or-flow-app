'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import Badge from '../../../components/ui/Badge'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  access_level: string
  user_roles: { name: string }[] | null
}

interface Facility {
  id: string
  name: string
  address: string | null
  created_at: string
  users?: User[]
  _count?: number
}

export default function FacilitiesSettingsPage() {
  const supabase = createClient()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFacility, setExpandedFacility] = useState<string | null>(null)
  const [facilityUsers, setFacilityUsers] = useState<Record<string, User[]>>({})
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  })

  useEffect(() => {
    fetchFacilities()
  }, [])

  const fetchFacilities = async () => {
    setLoading(true)
    
    // Fetch facilities with user count
    const { data: facilitiesData, error } = await supabase
      .from('facilities')
      .select('id, name, address, created_at')
      .order('name')

    if (facilitiesData) {
      // Get user counts for each facility
      const facilitiesWithCounts = await Promise.all(
        facilitiesData.map(async (facility) => {
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('facility_id', facility.id)
          
          return { ...facility, _count: count || 0 }
        })
      )
      setFacilities(facilitiesWithCounts)
    }
    
    setLoading(false)
  }

  const fetchFacilityUsers = async (facilityId: string) => {
    if (facilityUsers[facilityId]) {
      // Already loaded
      return
    }
    
    setLoadingUsers(facilityId)
    
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, access_level, user_roles(name)')
      .eq('facility_id', facilityId)
      .order('last_name')

    if (data) {
      setFacilityUsers(prev => ({ ...prev, [facilityId]: data as User[] }))
    }
    
    setLoadingUsers(null)
  }

  const toggleExpand = async (facilityId: string) => {
    if (expandedFacility === facilityId) {
      setExpandedFacility(null)
    } else {
      setExpandedFacility(facilityId)
      await fetchFacilityUsers(facilityId)
    }
  }

  const handleAdd = async () => {
    if (!formData.name.trim()) return

    const { data, error } = await supabase
      .from('facilities')
      .insert({
        name: formData.name.trim(),
        address: formData.address.trim() || null,
      })
      .select()
      .single()

    if (!error && data) {
      setFacilities([...facilities, { ...data, _count: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData({ name: '', address: '' })
      setShowAddModal(false)
    }
  }

  const handleEdit = async () => {
    if (!editingFacility || !formData.name.trim()) return

    const { error } = await supabase
      .from('facilities')
      .update({
        name: formData.name.trim(),
        address: formData.address.trim() || null,
      })
      .eq('id', editingFacility.id)

    if (!error) {
      setFacilities(
        facilities
          .map(f => f.id === editingFacility.id 
            ? { ...f, name: formData.name.trim(), address: formData.address.trim() || null }
            : f
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setEditingFacility(null)
      setFormData({ name: '', address: '' })
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', id)

    if (!error) {
      setFacilities(facilities.filter(f => f.id !== id))
      setDeleteConfirm(null)
      if (expandedFacility === id) {
        setExpandedFacility(null)
      }
    }
  }

  const openEditModal = (facility: Facility) => {
    setEditingFacility(facility)
    setFormData({
      name: facility.name,
      address: facility.address || '',
    })
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingFacility(null)
    setFormData({ name: '', address: '' })
  }

  const getAccessLevelBadge = (accessLevel: string) => {
    switch (accessLevel) {
      case 'global_admin':
        return <Badge variant="error" size="sm">Global Admin</Badge>
      case 'facility_admin':
        return <Badge variant="warning" size="sm">Admin</Badge>
      default:
        return <Badge variant="default" size="sm">Staff</Badge>
    }
  }

  const getRoleName = (userRoles: { name: string }[] | null): string => {
    return userRoles?.[0]?.name || 'Unknown'
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Facilities"
          description="Manage hospitals and surgery centers using ORbit."
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
              {/* Add Facility Button */}
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Facility
              </button>

              {/* Facilities List */}
              {facilities.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">No facilities yet</p>
                  <p className="text-slate-400 text-xs mt-1">Add your first hospital or surgery center</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {facilities.map((facility) => (
                    <div key={facility.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Facility Header */}
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(facility.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{facility.name}</p>
                            {facility.address && (
                              <p className="text-sm text-slate-500">{facility.address}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-500">
                            {facility._count} user{facility._count !== 1 ? 's' : ''}
                          </span>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {deleteConfirm === facility.id ? (
                              <>
                                <span className="text-xs text-slate-500 mr-2">Delete?</span>
                                <button
                                  onClick={() => handleDelete(facility.id)}
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
                                  onClick={() => openEditModal(facility)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(facility.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                          
                          {/* Expand Arrow */}
                          <svg 
                            className={`w-5 h-5 text-slate-400 transition-transform ${expandedFacility === facility.id ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Users List */}
                      {expandedFacility === facility.id && (
                        <div className="border-t border-slate-100 bg-slate-50">
                          {loadingUsers === facility.id ? (
                            <div className="p-6 flex items-center justify-center">
                              <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                          ) : facilityUsers[facility.id]?.length === 0 ? (
                            <div className="p-6 text-center">
                              <p className="text-sm text-slate-500">No users at this facility</p>
                              <p className="text-xs text-slate-400 mt-1">Invite users from the Users & Roles settings</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {facilityUsers[facility.id]?.map((user) => (
                                <div key={user.id} className="px-4 py-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                                      {user.first_name[0]}{user.last_name[0]}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-slate-900">
                                        {user.first_name} {user.last_name}
                                      </p>
                                      <p className="text-xs text-slate-500">{user.email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="info" size="sm">
                                      {getRoleName(user.user_roles).charAt(0).toUpperCase() + getRoleName(user.user_roles).slice(1)}
                                    </Badge>
                                    {getAccessLevelBadge(user.access_level)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {facilities.length > 0 && (
                <p className="text-sm text-slate-400">
                  {facilities.length} facilit{facilities.length !== 1 ? 'ies' : 'y'} total
                </p>
              )}
            </div>
          )}
        </SettingsLayout>
      </Container>

      {/* Add/Edit Modal */}
      {(showAddModal || editingFacility) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingFacility ? 'Edit Facility' : 'Add New Facility'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="Memorial General Hospital"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Address <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="123 Medical Center Drive, Chicago, IL 60601"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingFacility ? handleEdit : handleAdd}
                  disabled={!formData.name.trim()}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingFacility ? 'Save Changes' : 'Add Facility'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}