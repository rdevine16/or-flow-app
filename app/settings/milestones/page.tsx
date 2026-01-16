'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { milestoneTypeAudit } from '../../../lib/audit-logger'
import { useUser } from '../../../lib/UserContext'


interface FacilityMilestone {
  id: string
  facility_id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  source_milestone_type_id: string | null
  is_active: boolean
  deleted_at: string | null
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

export default function MilestonesSettingsPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  
  const [milestones, setMilestones] = useState<FacilityMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<FacilityMilestone | null>(null)
  const [pairingMilestone, setPairingMilestone] = useState<FacilityMilestone | null>(null)
  
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

  // Usage counts for milestones
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchMilestones()
      fetchUsageCounts()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])


  const fetchMilestones = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)
    const { data } = await supabase
      .from('facility_milestones')
      .select('id, facility_id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id, is_active, deleted_at')
      .eq('facility_id', effectiveFacilityId)
      .order('display_order')

    setMilestones(data || [])
    setLoading(false)
  }

  // Check how many cases use each milestone
  const fetchUsageCounts = async () => {
    const { data } = await supabase
      .from('case_milestones')
      .select('facility_milestone_id')
      .not('facility_milestone_id', 'is', null)

    if (data) {
      const counts: Record<string, number> = {}
      data.forEach(row => {
        if (row.facility_milestone_id) {
          counts[row.facility_milestone_id] = (counts[row.facility_milestone_id] || 0) + 1
        }
      })
      setUsageCounts(counts)
    }
  }

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleAdd = async () => {
    if (!newDisplayName.trim() || !effectiveFacilityId) return
    
    setSaving(true)
    const name = newName.trim() || generateName(newDisplayName)
    const maxOrder = milestones.length > 0 
      ? Math.max(...milestones.map(m => m.display_order)) 
      : 0

    const { data, error } = await supabase
      .from('facility_milestones')
      .insert({
        facility_id: effectiveFacilityId,
        name,
        display_name: newDisplayName.trim(),
        display_order: maxOrder + 1,
        source_milestone_type_id: null,
        is_active: true,
      })
      .select()
      .single()

    if (!error && data) {
      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      setMilestones([...milestones, { ...data, deleted_at: null }])
      setNewName('')
      setNewDisplayName('')
      setShowAddModal(false)
    }
    setSaving(false)
  }

  const handleEdit = async () => {
    if (!editingMilestone || !editDisplayName.trim()) return
    
    setSaving(true)
    const oldDisplayName = editingMilestone.display_name

    const { error } = await supabase
      .from('facility_milestones')
      .update({ display_name: editDisplayName.trim() })
      .eq('id', editingMilestone.id)

    if (!error) {
      if (oldDisplayName !== editDisplayName.trim()) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, editDisplayName.trim())
      }

      setMilestones(
        milestones.map(m => m.id === editingMilestone.id 
          ? { ...m, display_name: editDisplayName.trim() } 
          : m
        )
      )
      setShowEditModal(false)
      setEditingMilestone(null)
    }
    setSaving(false)
  }

  // Toggle active/inactive
  const handleToggleActive = async (milestone: FacilityMilestone) => {
    const newActiveState = !milestone.is_active

    if (!newActiveState && milestone.pair_with_id) {
      const partner = milestones.find(m => m.id === milestone.pair_with_id)
      
      setConfirmModal({
        isOpen: true,
        title: 'Deactivate Paired Milestone',
        message: (
          <div>
            <p>This will deactivate both milestones in the pair:</p>
            <ul className="mt-2 ml-4 list-disc text-slate-700">
              <li><strong>{milestone.display_name}</strong></li>
              {partner && <li><strong>{partner.display_name}</strong></li>}
            </ul>
          </div>
        ),
        confirmLabel: 'Deactivate Both',
        confirmVariant: 'danger',
        onConfirm: async () => {
          setSaving(true)
          
          await supabase
            .from('facility_milestones')
            .update({ is_active: false })
            .eq('id', milestone.id)

          if (partner) {
            await supabase
              .from('facility_milestones')
              .update({ is_active: false })
              .eq('id', partner.id)
          }

          setMilestones(milestones.map(m => {
            if (m.id === milestone.id || m.id === milestone.pair_with_id) {
              return { ...m, is_active: false }
            }
            return m
          }))

          closeConfirmModal()
          setSaving(false)
        },
      })
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('facility_milestones')
      .update({ is_active: newActiveState })
      .eq('id', milestone.id)

    if (!error) {
      setMilestones(milestones.map(m => 
        m.id === milestone.id ? { ...m, is_active: newActiveState } : m
      ))
    }
    setSaving(false)
  }

  // Soft delete (move to deleted bucket)
  const handleDelete = async (milestone: FacilityMilestone) => {
    const usageCount = usageCounts[milestone.id] || 0
    const partner = milestone.pair_with_id 
      ? milestones.find(m => m.id === milestone.pair_with_id) 
      : null

    // If used in cases, show warning but still allow soft delete
    setConfirmModal({
      isOpen: true,
      title: 'Delete Milestone',
      message: (
        <div>
          <p>Delete <strong>"{milestone.display_name}"</strong>?</p>
          
          {usageCount > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                This milestone has been used in <strong>{usageCount} case{usageCount !== 1 ? 's' : ''}</strong>. 
                Historical data will be preserved.
              </p>
            </div>
          )}
          
          {partner && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                This milestone is paired with <strong>"{partner.display_name}"</strong>. 
                The pairing will be removed but the partner milestone will remain.
              </p>
            </div>
          )}
          
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this milestone from the "Recently Deleted" section.
          </p>
        </div>
      ),
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)

        // If paired, unlink partner first
        if (milestone.pair_with_id) {
          await supabase
            .from('facility_milestones')
            .update({ pair_with_id: null, pair_position: null })
            .eq('id', milestone.pair_with_id)

          await milestoneTypeAudit.unlinked(
            supabase,
            milestone.display_name,
            partner?.display_name || 'Unknown'
          )
        }
        
        // Soft delete - set deleted_at timestamp
        const { error } = await supabase
          .from('facility_milestones')
          .update({ 
            deleted_at: new Date().toISOString(),
            is_active: false,
            pair_with_id: null,
            pair_position: null,
          })
          .eq('id', milestone.id)

        if (!error) {
          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
          
          setMilestones(milestones.map(m => {
            if (m.id === milestone.id) {
              return { ...m, deleted_at: new Date().toISOString(), is_active: false, pair_with_id: null, pair_position: null }
            }
            if (m.id === milestone.pair_with_id) {
              return { ...m, pair_with_id: null, pair_position: null }
            }
            return m
          }))
        }

        closeConfirmModal()
        setShowEditModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  // Restore deleted milestone
const handleRestore = async (milestone: FacilityMilestone) => {
  setSaving(true)
  
  const { error } = await supabase
    .from('facility_milestones')
    .update({ 
      deleted_at: null,
      is_active: true,
    })
    .eq('id', milestone.id)

  if (!error) {
    // ADD THIS LINE:
    await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)
    
    setMilestones(milestones.map(m => 
      m.id === milestone.id 
        ? { ...m, deleted_at: null, is_active: true } 
        : m
    ))
  }
  setSaving(false)
}

  // Unlink milestones
  const handleUnlink = async (milestone: FacilityMilestone) => {
    if (!milestone.pair_with_id) return

    const partner = milestones.find(m => m.id === milestone.pair_with_id)
    
    setConfirmModal({
      isOpen: true,
      title: 'Unlink Milestones',
      message: (
        <div>
          <p>Remove the pairing between these milestones?</p>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Start</span>
              <span className="font-medium text-slate-900">{milestone.pair_position === 'start' ? milestone.display_name : partner?.display_name}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">End</span>
              <span className="font-medium text-slate-900">{milestone.pair_position === 'end' ? milestone.display_name : partner?.display_name}</span>
            </div>
          </div>
          <p className="mt-3 text-slate-500">This only affects how buttons display. Historical data is not affected.</p>
        </div>
      ),
      confirmLabel: 'Unlink',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setSaving(true)

        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null })
          .eq('id', milestone.id)

        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null })
          .eq('id', milestone.pair_with_id)

        await milestoneTypeAudit.unlinked(
          supabase,
          milestone.display_name,
          partner?.display_name || 'Unknown'
        )

        setMilestones(milestones.map(m => {
          if (m.id === milestone.id || m.id === milestone.pair_with_id) {
            return { ...m, pair_with_id: null, pair_position: null }
          }
          return m
        }))

        closeConfirmModal()
        setShowPairModal(false)
        setPairingMilestone(null)
        setSaving(false)
      },
    })
  }

  // Set up pairing
  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return
    
    setSaving(true)

    const partner = milestones.find(m => m.id === selectedPairId)
    const oldPartner = pairingMilestone.pair_with_id
      ? milestones.find(m => m.id === pairingMilestone.pair_with_id)
      : null

    if (pairingMilestone.pair_with_id && pairingMilestone.pair_with_id !== selectedPairId) {
      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: null, pair_position: null })
        .eq('id', pairingMilestone.pair_with_id)

      await milestoneTypeAudit.unlinked(
        supabase,
        pairingMilestone.display_name,
        oldPartner?.display_name || 'Unknown'
      )
    }

    await supabase
      .from('facility_milestones')
      .update({ pair_with_id: selectedPairId, pair_position: 'start' })
      .eq('id', pairingMilestone.id)

    await supabase
      .from('facility_milestones')
      .update({ pair_with_id: pairingMilestone.id, pair_position: 'end' })
      .eq('id', selectedPairId)

    await milestoneTypeAudit.linked(
      supabase,
      pairingMilestone.display_name,
      partner?.display_name || 'Unknown'
    )

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

  const getPairedName = (pairWithId: string | null): string | null => {
    if (!pairWithId) return null
    const paired = milestones.find(m => m.id === pairWithId)
    return paired?.display_name || null
  }

  const getAvailableForPairing = (currentId: string): FacilityMilestone[] => {
    return milestones.filter(m => 
      m.id !== currentId && 
      !m.pair_with_id &&
      m.is_active &&
      !m.deleted_at
    )
  }

  const openPairModal = (milestone: FacilityMilestone) => {
    setPairingMilestone(milestone)
    setSelectedPairId(milestone.pair_with_id || '')
    setShowPairModal(true)
  }

  const formatDeletedDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Filter milestones
  const activeMilestones = milestones.filter(m => !m.deleted_at && m.is_active)
  const inactiveMilestones = milestones.filter(m => !m.deleted_at && !m.is_active)
  const deletedMilestones = milestones.filter(m => m.deleted_at)

  const visibleMilestones = milestones.filter(m => {
    if (m.deleted_at) return false
    if (!m.is_active && !showInactive) return false
    return true
  })

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Milestones"
          description="Configure the surgical milestones tracked during cases."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800">Global vs Custom Milestones</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    <strong>Global milestones</strong> (blue badge) are provided by ORbit.
                    <strong> Custom milestones</strong> (purple badge) are created by your facility.
                    Deleted milestones can be restored from the "Recently Deleted" section.
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  {inactiveMilestones.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">
                        Show inactive ({inactiveMilestones.length})
                      </span>
                    </label>
                  )}
                  {deletedMilestones.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeleted}
                        onChange={(e) => setShowDeleted(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">
                        Recently deleted ({deletedMilestones.length})
                      </span>
                    </label>
                  )}
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Custom Milestone
                </button>
              </div>

              {/* Active Milestones List */}
              <div className="space-y-2">
                {visibleMilestones.map((milestone, index) => {
                  const isGlobal = !!milestone.source_milestone_type_id
                  const usageCount = usageCounts[milestone.id] || 0

                  return (
                    <div
                      key={milestone.id}
                      className={`bg-white border rounded-xl p-4 transition-colors ${
                        milestone.is_active 
                          ? 'hover:border-blue-300' 
                          : 'opacity-60 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Active Toggle */}
                        <button
                          onClick={() => handleToggleActive(milestone)}
                          disabled={saving}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
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

                        {/* Order Number */}
                        <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                          {index + 1}
                        </span>

                        {/* Milestone Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${milestone.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                              {milestone.display_name}
                            </span>
                            
                            {isGlobal ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                Global
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                Custom
                              </span>
                            )}

                            {!milestone.is_active && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                Inactive
                              </span>
                            )}
                            
                            {milestone.pair_position && milestone.is_active && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                milestone.pair_position === 'start' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {milestone.pair_position === 'start' ? 'Start' : 'End'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-0.5">
                            {milestone.pair_with_id && milestone.is_active && (
                              <p className="text-xs text-slate-500">
                                Paired with: <span className="font-medium">{getPairedName(milestone.pair_with_id)}</span>
                              </p>
                            )}
                            {usageCount > 0 && (
                              <p className="text-xs text-slate-400">
                                Used in {usageCount} case{usageCount !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {milestone.is_active && (
                            <button
                              onClick={() => openPairModal(milestone)}
                              className={`p-2 rounded-lg transition-colors ${
                                milestone.pair_with_id 
                                  ? 'text-emerald-600 hover:bg-emerald-50' 
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
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDelete(milestone)}
                            disabled={saving}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {visibleMilestones.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No milestones to display.</p>
                  </div>
                )}
              </div>

              {/* Recently Deleted Section */}
              {showDeleted && deletedMilestones.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Recently Deleted
                  </h3>
                  <div className="space-y-2">
                    {deletedMilestones.map(milestone => {
                      const isGlobal = !!milestone.source_milestone_type_id
                      
                      return (
                        <div
                          key={milestone.id}
                          className="bg-red-50 border border-red-200 rounded-xl p-4 opacity-75"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700 line-through">
                                  {milestone.display_name}
                                </span>
                                {isGlobal ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    Global
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    Custom
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-red-600 mt-0.5">
                                Deleted {milestone.deleted_at ? formatDeletedDate(milestone.deleted_at) : ''}
                              </p>
                            </div>

                            <button
                              onClick={() => handleRestore(milestone)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-medium text-slate-600 mb-2">Legend</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Global</span>
                    <span className="text-slate-500">System milestone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Custom</span>
                    <span className="text-slate-500">Facility milestone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Start</span>
                    <span className="text-slate-500">First button in pair</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">End</span>
                    <span className="text-slate-500">Second button in pair</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SettingsLayout>
      </Container>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Custom Milestone</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., Array Placement"
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
                  placeholder={newDisplayName ? generateName(newDisplayName) : 'e.g., array_placement'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
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
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm font-medium text-emerald-900">Paired Milestone</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => handleDelete(editingMilestone)}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                Delete
              </button>
              <div className="flex gap-3">
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
                : `Pair "${pairingMilestone.display_name}" with another milestone.`
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
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Start</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'start' 
                        ? pairingMilestone.display_name 
                        : getPairedName(pairingMilestone.pair_with_id)
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">End</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'end' 
                        ? pairingMilestone.display_name 
                        : getPairedName(pairingMilestone.pair_with_id)
                      }
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
