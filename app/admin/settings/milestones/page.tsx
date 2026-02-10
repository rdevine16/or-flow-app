// app/admin/settings/milestones/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'


interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
}

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <div className="text-sm text-slate-600 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminMilestonesSettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [milestones, setMilestones] = useState<MilestoneType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<MilestoneType | null>(null)
  const [pairingMilestone, setPairingMilestone] = useState<MilestoneType | null>(null)
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
  })
  
  // Form states
  const [newName, setNewName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [selectedPairId, setSelectedPairId] = useState<string>('')
// Archive state
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])
useEffect(() => {
    fetchMilestones()
  }, [showArchived])

const fetchMilestones = async () => {
    setLoading(true)
    
    let query = supabase
      .from('milestone_types')
      .select('id, name, display_name, display_order, pair_with_id, pair_position, is_active, deleted_at, deleted_by')

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    query = query.order('display_order')

    const { data } = await query
    
    setMilestones(data?.map(m => ({ ...m, is_active: m.is_active ?? true })) || [])

    // Get archived count
    const { count } = await supabase
      .from('milestone_types')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)

    setArchivedCount(count || 0)
    setLoading(false)
  }

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // Generate internal name from display name
  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleAdd = async () => {
    if (!newDisplayName.trim()) return
    
    setSaving(true)
    const name = newName.trim() || generateName(newDisplayName)
    const maxOrder = milestones.length > 0 
      ? Math.max(...milestones.map(m => m.display_order)) 
      : 0

    const { data, error } = await supabase
      .from('milestone_types')
      .insert({
        name,
        display_name: newDisplayName.trim(),
        display_order: maxOrder + 1,
        is_active: true,
      })
      .select()
      .single()

    if (!error && data) {
      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      await propagateToFacilities(data)
      
      setMilestones([...milestones, { ...data, pair_with_id: null, pair_position: null, is_active: true }])
      setNewName('')
      setNewDisplayName('')
      setShowAddModal(false)
    }
    setSaving(false)
  }

  const propagateToFacilities = async (milestone: MilestoneType) => {
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id')

    if (facilities) {
      const insertions = facilities.map(f => ({
        facility_id: f.id,
        name: milestone.name,
        display_name: milestone.display_name,
        display_order: milestone.display_order,
        source_milestone_type_id: milestone.id,
        is_active: true,
      }))

      await supabase
        .from('facility_milestones')
        .insert(insertions)
    }
  }

  const handleEdit = async () => {
    if (!editingMilestone || !editDisplayName.trim()) return
    
    setSaving(true)
    const oldDisplayName = editingMilestone.display_name

    const { error } = await supabase
      .from('milestone_types')
      .update({ display_name: editDisplayName.trim() })
      .eq('id', editingMilestone.id)

    if (!error) {
      if (oldDisplayName !== editDisplayName.trim()) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, editDisplayName.trim())
      }

      await supabase
        .from('facility_milestones')
        .update({ display_name: editDisplayName.trim() })
        .eq('source_milestone_type_id', editingMilestone.id)

      setMilestones(milestones.map(m => 
        m.id === editingMilestone.id 
          ? { ...m, display_name: editDisplayName.trim() }
          : m
      ))
      setShowEditModal(false)
      setEditingMilestone(null)
    }
    setSaving(false)
  }

  const handleToggleActive = async (milestone: MilestoneType) => {
    const newIsActive = !milestone.is_active
    const action = newIsActive ? 'reactivate' : 'deactivate'
    
    setConfirmModal({
      isOpen: true,
      title: `${newIsActive ? 'Activate' : 'Deactivate'} Milestone`,
      message: (
        <p>
          {newIsActive 
            ? `Activate "${milestone.display_name}"? It will be included when new facilities are created.`
            : `Deactivate "${milestone.display_name}"? It will be hidden from new facilities. Existing facilities are not affected.`
          }
        </p>
      ),
      confirmLabel: newIsActive ? 'Activate' : 'Deactivate',
      confirmVariant: newIsActive ? 'primary' : 'danger',
      onConfirm: async () => {
        setSaving(true)
        
        const { error } = await supabase
          .from('milestone_types')
          .update({ is_active: newIsActive })
          .eq('id', milestone.id)

        if (!error) {
          
          setMilestones(milestones.map(m => 
            m.id === milestone.id ? { ...m, is_active: newIsActive } : m
          ))
        }
        
        setSaving(false)
        closeConfirmModal()
      },
    })
  }

  const getPairedName = (pairedId: string | null) => {
    if (!pairedId) return null
    return milestones.find(m => m.id === pairedId)?.display_name || null
  }

  const getAvailableForPairing = (excludeId: string) => {
    return milestones.filter(m => 
      m.id !== excludeId && 
      !m.pair_with_id &&
      m.is_active
    )
  }

  const openPairModal = (milestone: MilestoneType) => {
    setPairingMilestone(milestone)
    setSelectedPairId(milestone.pair_with_id || '')
    setShowPairModal(true)
  }

  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return
    
    setSaving(true)
    const partner = milestones.find(m => m.id === selectedPairId)

    // Clear any existing pairing for this milestone first
    if (pairingMilestone.pair_with_id) {
      await supabase
        .from('milestone_types')
        .update({ pair_with_id: null, pair_position: null })
        .eq('id', pairingMilestone.pair_with_id)
    }

    // Set new pairing
    await supabase
      .from('milestone_types')
      .update({ pair_with_id: selectedPairId, pair_position: 'start' })
      .eq('id', pairingMilestone.id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: pairingMilestone.id, pair_position: 'end' })
      .eq('id', selectedPairId)

    await milestoneTypeAudit.linked(
      supabase,
      pairingMilestone.display_name,
      partner?.display_name || 'Unknown'
    )

    // Update local state
    setMilestones(milestones.map(m => {
      if (m.id === pairingMilestone.id) {
        return { ...m, pair_with_id: selectedPairId, pair_position: 'start' }
      }
      if (m.id === selectedPairId) {
        return { ...m, pair_with_id: pairingMilestone.id, pair_position: 'end' }
      }
      if (m.id === pairingMilestone.pair_with_id) {
        return { ...m, pair_with_id: null, pair_position: null }
      }
      return m
    }))

    setShowPairModal(false)
    setPairingMilestone(null)
    setSelectedPairId('')
    setSaving(false)
  }

  const handleUnlink = async (milestone: MilestoneType) => {
    if (!milestone.pair_with_id) return
    
    setSaving(true)
    const partnerName = getPairedName(milestone.pair_with_id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: null, pair_position: null })
      .eq('id', milestone.id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: null, pair_position: null })
      .eq('id', milestone.pair_with_id)

    await milestoneTypeAudit.unlinked(supabase, milestone.display_name, partnerName || 'Unknown')

    setMilestones(milestones.map(m => {
      if (m.id === milestone.id || m.id === milestone.pair_with_id) {
        return { ...m, pair_with_id: null, pair_position: null }
      }
      return m
    }))

    setShowPairModal(false)
    setPairingMilestone(null)
    setSaving(false)
  }
// Archive a milestone (soft delete)
  const handleArchive = async (milestone: MilestoneType) => {
    if (!currentUserId) return

    // If paired, need to unlink first
    if (milestone.pair_with_id) {
      const partner = milestones.find(m => m.id === milestone.pair_with_id)
      
      setConfirmModal({
        isOpen: true,
        title: 'Archive Paired Milestone',
        message: (
          <div>
            <p>This milestone is paired with <strong>"{partner?.display_name}"</strong>.</p>
            <p className="mt-2">Archiving will remove the pairing. The partner milestone will remain active.</p>
          </div>
        ),
        confirmLabel: 'Archive',
        confirmVariant: 'danger',
        onConfirm: async () => {
          setSaving(true)

          // Unlink partner first
          await supabase
            .from('milestone_types')
            .update({ pair_with_id: null, pair_position: null })
            .eq('id', milestone.pair_with_id)

          // Archive this milestone
          const { error } = await supabase
            .from('milestone_types')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              pair_with_id: null,
              pair_position: null
            })
            .eq('id', milestone.id)

          if (!error) {
            await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
            setMilestones(milestones.filter(m => m.id !== milestone.id))
            setArchivedCount(prev => prev + 1)
            showToast({ type: 'success', title: `"${milestone.display_name}" moved to archive` })
          }

          closeConfirmModal()
          setSaving(false)
        },
      })
      return
    }

    // Not paired - simple archive
    setConfirmModal({
      isOpen: true,
      title: 'Archive Milestone',
      message: (
        <p>Archive <strong>"{milestone.display_name}"</strong>? It will be hidden from new facilities. You can restore it later.</p>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)

        const { error } = await supabase
          .from('milestone_types')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId
          })
          .eq('id', milestone.id)

        if (!error) {
          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
          setMilestones(milestones.filter(m => m.id !== milestone.id))
          setArchivedCount(prev => prev + 1)
          showToast({ type: 'success', title: `"${milestone.display_name}" moved to archive` })
        }

        closeConfirmModal()
        setSaving(false)
      },
    })
  }

  // Restore an archived milestone
  const handleRestore = async (milestone: MilestoneType) => {
    setSaving(true)

    const { error } = await supabase
      .from('milestone_types')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', milestone.id)

    if (!error) {
      await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)
      setMilestones(milestones.filter(m => m.id !== milestone.id))
      setArchivedCount(prev => prev - 1)
      showToast({ type: 'success', title: `"${milestone.display_name}" restored successfully` })
    } else {
      showToast({ type: 'error', title: 'Failed to restore milestone' })
    }

    setSaving(false)
  }
  // Filter based on showInactive
  const visibleMilestones = showInactive 
    ? milestones 
    : milestones.filter(m => m.is_active)

  const inactiveCount = milestones.filter(m => !m.is_active).length
  const activeCount = milestones.filter(m => m.is_active).length

  return (
    <DashboardLayout>
      <Container className="py-8">
<div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Global Milestones</h1>
              <p className="text-slate-500 mt-1">
                Milestone templates for new facilities. Changes here don't affect existing facilities.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Archive Toggle */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  showArchived
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {showArchived ? 'View Active' : `Archive (${archivedCount})`}
              </button>

              {/* Add Milestone - hide when viewing archived */}
              {!showArchived && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Milestone
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {activeCount} active milestone{activeCount !== 1 ? 's' : ''}
            </span>
            {inactiveCount > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">
                  Show inactive ({inactiveCount})
                </span>
              </label>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : visibleMilestones.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No milestones found</p>
                {!showInactive && inactiveCount > 0 && (
                  <button
                    onClick={() => setShowInactive(true)}
                    className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Show {inactiveCount} inactive
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Display Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Internal Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pairing</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleMilestones.map((milestone, index) => (
                    <tr 
                      key={milestone.id} 
                      className={`group hover:bg-slate-50 transition-colors ${!milestone.is_active ? 'opacity-50' : ''}`}
                    >
                      {/* Order */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400 font-medium">{index + 1}</span>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(milestone)}
                          disabled={saving}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                            milestone.is_active
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          title={milestone.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {milestone.is_active && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>

                      {/* Display Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{milestone.display_name}</span>
                          {milestone.pair_position === 'start' && milestone.is_active && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                              Start
                            </span>
                          )}
                          {milestone.pair_position === 'end' && milestone.is_active && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                              End
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Internal Name */}
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {milestone.name}
                        </code>
                      </td>

                      {/* Pairing */}
                      <td className="px-4 py-3">
                        {milestone.pair_with_id && milestone.is_active ? (
                          <span className="text-sm text-blue-600">
                            → {getPairedName(milestone.pair_with_id)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>

                     {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {showArchived ? (
                            <button
                              onClick={() => handleRestore(milestone)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              {milestone.is_active && (
                                <button
                                  onClick={() => openPairModal(milestone)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    milestone.pair_with_id
                                      ? 'text-blue-600 hover:bg-blue-50'
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title={milestone.pair_with_id ? 'Manage pairing' : 'Set up pairing'}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingMilestone(milestone)
                                  setEditDisplayName(milestone.display_name)
                                  setShowEditModal(true)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleArchive(milestone)}
                                disabled={saving}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Archive"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">About milestone pairing</p>
                <p>
                  Paired milestones create Start/End buttons in the mobile app for tracking durations 
                  (e.g., Anesthesia Start → Anesthesia End). Click the link icon to manage pairings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Milestone</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., Patient In Room"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newDisplayName ? generateName(newDisplayName) : 'e.g., patient_in'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">Used for code references. Lowercase, underscores only.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewName('')
                  setNewDisplayName('')
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Adding...' : 'Add Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Milestone</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={editingMilestone.name}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              {editingMilestone.pair_with_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Paired Milestone</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingMilestone(null)
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pair/Unlink Modal */}
      {showPairModal && pairingMilestone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {pairingMilestone.pair_with_id ? 'Manage Pairing' : 'Set Up Pairing'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {pairingMilestone.pair_with_id 
                ? `"${pairingMilestone.display_name}" is paired with "${getPairedName(pairingMilestone.pair_with_id)}".`
                : `Pair "${pairingMilestone.display_name}" with another milestone to create a Start/End pair.`
              }
            </p>
            
            {pairingMilestone.pair_with_id && (
              <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Current Pairing</span>
                  <button
                    onClick={() => handleUnlink(pairingMilestone)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Unlink
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700">Start</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'start' ? pairingMilestone.display_name : getPairedName(pairingMilestone.pair_with_id)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">End</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'end' ? pairingMilestone.display_name : getPairedName(pairingMilestone.pair_with_id)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {pairingMilestone.pair_with_id ? 'Change pairing to:' : 'Pair with:'}
              </label>
              <select
                value={selectedPairId}
                onChange={(e) => setSelectedPairId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a milestone...</option>
                {getAvailableForPairing(pairingMilestone.id).map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
              
              {selectedPairId && selectedPairId !== pairingMilestone.pair_with_id && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">New pairing:</p>
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">{pairingMilestone.display_name}</span> → Start
                  </p>
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">{milestones.find(m => m.id === selectedPairId)?.display_name}</span> → End
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPairModal(false)
                  setPairingMilestone(null)
                  setSelectedPairId('')
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {pairingMilestone.pair_with_id ? 'Close' : 'Cancel'}
              </button>
              {selectedPairId && selectedPairId !== pairingMilestone.pair_with_id && (
                <button
                  onClick={handleSetPair}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : pairingMilestone.pair_with_id ? 'Change Pairing' : 'Create Pairing'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isLoading={saving}
      />
    </DashboardLayout>
  )
}