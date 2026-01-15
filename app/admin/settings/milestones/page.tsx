'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import SettingsLayout from '../../../../components/settings/SettingsLayout'
import { milestoneTypeAudit } from '../../../../lib/audit-logger'

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
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
  const [milestones, setMilestones] = useState<MilestoneType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
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

  useEffect(() => {
    fetchMilestones()
  }, [])

  const fetchMilestones = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('milestone_types')
      .select('id, name, display_name, display_order, pair_with_id, pair_position')
      .order('display_order')

    setMilestones(data || [])
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
      })
      .select()
      .single()

    if (!error && data) {
      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      
      // Propagate to all existing facilities
      await propagateToFacilities(data)
      
      setMilestones([...milestones, { ...data, pair_with_id: null, pair_position: null }])
      setNewName('')
      setNewDisplayName('')
      setShowAddModal(false)
    }
    setSaving(false)
  }

  // Propagate new milestone to all existing facilities
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

      // Update in facility_milestones too (for ones linked to this global)
      await supabase
        .from('facility_milestones')
        .update({ display_name: editDisplayName.trim() })
        .eq('source_milestone_type_id', editingMilestone.id)

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

  // Delete milestone with confirmation
  const handleDelete = async (milestone: MilestoneType) => {
    const partner = milestone.pair_with_id 
      ? milestones.find(m => m.id === milestone.pair_with_id) 
      : null

    setConfirmModal({
      isOpen: true,
      title: 'Delete Global Milestone',
      message: (
        <div>
          <p>Permanently delete <strong>"{milestone.display_name}"</strong>?</p>
          {partner && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                This milestone is paired with <strong>"{partner.display_name}"</strong>. 
                Deleting it will unlink the pair.
              </p>
            </div>
          )}
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              <strong>Warning:</strong> This will also remove this milestone from all facilities.
            </p>
          </div>
        </div>
      ),
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)

        // If paired, unlink partner first
        if (milestone.pair_with_id) {
          await supabase
            .from('milestone_types')
            .update({ pair_with_id: null, pair_position: null })
            .eq('id', milestone.pair_with_id)

          // Also update facility milestones
await updateFacilityPairing(milestone.pair_with_id!, null, null)


          await milestoneTypeAudit.unlinked(
            supabase,
            milestone.display_name,
            partner?.display_name || 'Unknown'
          )
        }
        
        // Delete from facility_milestones
        await supabase
          .from('facility_milestones')
          .delete()
          .eq('source_milestone_type_id', milestone.id)

        // Delete from milestone_types
        const { error } = await supabase
          .from('milestone_types')
          .delete()
          .eq('id', milestone.id)

        if (!error) {
          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
          
          // Update state
          setMilestones(milestones
            .filter(m => m.id !== milestone.id)
            .map(m => {
              if (m.id === milestone.pair_with_id) {
                return { ...m, pair_with_id: null, pair_position: null }
              }
              return m
            })
          )
        }

        closeConfirmModal()
        setShowEditModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  // Unlink milestones
  const handleUnlink = async (milestone: MilestoneType) => {
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
          <p className="mt-3 text-slate-500">This will also update all facility milestones.</p>
        </div>
      ),
      confirmLabel: 'Unlink',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setSaving(true)

        // Unlink both milestones
        await supabase
          .from('milestone_types')
          .update({ pair_with_id: null, pair_position: null })
          .eq('id', milestone.id)

        await supabase
          .from('milestone_types')
          .update({ pair_with_id: null, pair_position: null })
          .eq('id', milestone.pair_with_id)

        // Update facility milestones
        await updateFacilityPairing(milestone.id, null, null)
await updateFacilityPairing(milestone.pair_with_id!, null, null)

        // Audit
        await milestoneTypeAudit.unlinked(
          supabase,
          milestone.display_name,
          partner?.display_name || 'Unknown'
        )

        // Update local state
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

  // Set up new pairing
  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return
    
    setSaving(true)

    const partner = milestones.find(m => m.id === selectedPairId)
    const oldPartner = pairingMilestone.pair_with_id
      ? milestones.find(m => m.id === pairingMilestone.pair_with_id)
      : null

    // If there was an old pairing, unlink it first
    if (pairingMilestone.pair_with_id && pairingMilestone.pair_with_id !== selectedPairId) {
      await supabase
        .from('milestone_types')
        .update({ pair_with_id: null, pair_position: null })
        .eq('id', pairingMilestone.pair_with_id)

      await updateFacilityPairing(pairingMilestone.pair_with_id, null, null)

      await milestoneTypeAudit.unlinked(
        supabase,
        pairingMilestone.display_name,
        oldPartner?.display_name || 'Unknown'
      )
    }

    // Create new pairing
    await supabase
      .from('milestone_types')
      .update({ pair_with_id: selectedPairId, pair_position: 'start' })
      .eq('id', pairingMilestone.id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: pairingMilestone.id, pair_position: 'end' })
      .eq('id', selectedPairId)

    // Update facility milestones
    await updateFacilityPairing(pairingMilestone.id, selectedPairId, 'start')
    await updateFacilityPairing(selectedPairId, pairingMilestone.id, 'end')

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
      // Clear old partner's pairing
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

  // Update pairing in facility_milestones across all facilities
  const updateFacilityPairing = async (
    sourceId: string, 
    partnerSourceId: string | null, 
    position: 'start' | 'end' | null
  ) => {
    if (partnerSourceId === null) {
      // Clear pairing
      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: null, pair_position: null })
        .eq('source_milestone_type_id', sourceId)
    } else {
      // Set up pairing - need to match by facility
      const { data: facilities } = await supabase.from('facilities').select('id')
      
      if (facilities) {
        for (const facility of facilities) {
          const { data: fm1 } = await supabase
            .from('facility_milestones')
            .select('id')
            .eq('facility_id', facility.id)
            .eq('source_milestone_type_id', sourceId)
            .single()
          
          const { data: fm2 } = await supabase
            .from('facility_milestones')
            .select('id')
            .eq('facility_id', facility.id)
            .eq('source_milestone_type_id', partnerSourceId)
            .single()
          
          if (fm1 && fm2) {
            await supabase
              .from('facility_milestones')
              .update({ pair_with_id: fm2.id, pair_position: position })
              .eq('id', fm1.id)
          }
        }
      }
    }
  }

  const getPairedName = (pairedId: string | null) => {
    if (!pairedId) return null
    return milestones.find(m => m.id === pairedId)?.display_name || null
  }

  const getAvailableForPairing = (excludeId: string) => {
    return milestones.filter(m => 
      m.id !== excludeId && 
      !m.pair_with_id
    )
  }

  const openPairModal = (milestone: MilestoneType) => {
    setPairingMilestone(milestone)
    setSelectedPairId(milestone.pair_with_id || '')
    setShowPairModal(true)
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Global Milestones"
          description="Manage milestone types that are available across all facilities. Changes here propagate to all facilities."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Header Actions */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-slate-500">
                  {milestones.length} milestone{milestones.length !== 1 ? 's' : ''} configured
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Milestone
                </button>
              </div>

              {/* Milestones List */}
              <div className="space-y-2">
                {milestones.map((milestone, index) => (
                  <div
                    key={milestone.id}
                    className={`group flex items-center gap-4 p-4 bg-white border rounded-xl transition-all hover:shadow-md ${
                      milestone.pair_with_id 
                        ? 'border-l-4 border-l-blue-400 border-slate-200' 
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Order Number */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-500">
                      {index + 1}
                    </div>

                    {/* Milestone Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{milestone.display_name}</span>
                        {milestone.pair_position === 'start' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            Start
                          </span>
                        )}
                        {milestone.pair_position === 'end' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            End
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">{milestone.name}</span>
                        {milestone.pair_with_id && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-blue-600">
                              Paired with: {getPairedName(milestone.pair_with_id)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Pair/Unlink Button */}
                      <button
                        onClick={() => openPairModal(milestone)}
                        className={`p-2 rounded-lg transition-colors ${
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

                      {/* Edit Button */}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
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
                ))}

                {milestones.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No milestones configured yet.</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Add your first milestone
                    </button>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-medium text-slate-600 mb-2">Pairing Legend</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Start</span>
                    <span className="text-slate-500">First button in a paired milestone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">End</span>
                    <span className="text-slate-500">Second button in a paired milestone</span>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Global Milestone</h3>
            
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

              {/* Pairing Info */}
              {editingMilestone.pair_with_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Paired Milestone</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Use the link icon on the milestone row to manage pairing.
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
                ? `"${pairingMilestone.display_name}" is currently paired with "${getPairedName(pairingMilestone.pair_with_id)}".`
                : `Pair "${pairingMilestone.display_name}" with another milestone to create a Start/End pair.`
              }
            </p>
            
            {/* Current Pairing - with Unlink option */}
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

            {/* New Pairing Selection */}
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
