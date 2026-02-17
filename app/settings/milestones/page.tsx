// app/settings/milestones/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Info, Plus } from 'lucide-react'
import { inferPhaseGroup, type PhaseGroup } from '@/lib/utils/inferPhaseGroup'
import { MilestonesTable } from '@/components/settings/milestones/MilestonesTable'
import { MilestoneFormModal } from '@/components/settings/milestones/MilestoneFormModal'
import { ArchivedMilestonesSection } from '@/components/settings/milestones/ArchivedMilestonesSection'
import type { MilestoneRowData } from '@/components/settings/milestones/MilestoneRow'

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
  deleted_by: string | null
  min_minutes: number | null
  max_minutes: number | null
  validation_type: 'duration' | 'sequence_gap' | null
  phase_group: PhaseGroup | null
}

export default function MilestonesSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const { data: milestones, loading, error, setData: setMilestones } = useSupabaseQuery<FacilityMilestone[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('facility_milestones')
        .select('id, facility_id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id, is_active, deleted_at, deleted_by, min_minutes, max_minutes, validation_type, phase_group')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingMilestone, setEditingMilestone] = useState<FacilityMilestone | null>(null)
  const [showPairModal, setShowPairModal] = useState(false)
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

  // Pair modal form state
  const [selectedPairId, setSelectedPairId] = useState<string>('')

  // Usage counts for milestones
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  const fetchUsageCounts = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('case_milestones')
        .select('facility_milestone_id')
        .not('facility_milestone_id', 'is', null)
      if (fetchError) throw fetchError
      if (data) {
        const counts: Record<string, number> = {}
        data.forEach(row => {
          if (row.facility_milestone_id) {
            counts[row.facility_milestone_id] = (counts[row.facility_milestone_id] || 0) + 1
          }
        })
        setUsageCounts(counts)
      }
    } catch {
      // Non-critical
    }
  }, [supabase])

  useEffect(() => {
    if (effectiveFacilityId && milestones) {
      fetchUsageCounts()
    }
  }, [effectiveFacilityId, milestones, fetchUsageCounts])

  // Filtered milestone lists
  const activeMilestones = useMemo(
    () => (milestones || []).filter(m => !m.deleted_at && m.is_active),
    [milestones]
  )

  const deletedMilestones = useMemo(
    () => (milestones || []).filter(m => m.deleted_at),
    [milestones]
  )

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // ── Mutation handlers ────────────────────────────────────

  const handleFormSubmit = async (data: {
    displayName: string
    internalName: string
    phaseGroup: PhaseGroup | ''
    minMinutes: number
    maxMinutes: number
  }) => {
    if (formMode === 'add') {
      await handleAdd(data)
    } else {
      await handleEdit(data)
    }
  }

  const handleAdd = async (data: {
    displayName: string
    internalName: string
    phaseGroup: PhaseGroup | ''
  }) => {
    if (!data.displayName || !effectiveFacilityId) return

    setSaving(true)
    try {
      const maxOrder = (milestones || []).length > 0
        ? Math.max(...(milestones || []).map(m => m.display_order))
        : 0

      const resolvedPhaseGroup = data.phaseGroup || inferPhaseGroup(data.internalName) || null

      const { data: insertedData, error: insertError } = await supabase
        .from('facility_milestones')
        .insert({
          facility_id: effectiveFacilityId,
          name: data.internalName,
          display_name: data.displayName,
          display_order: maxOrder + 1,
          source_milestone_type_id: null,
          is_active: true,
          min_minutes: 1,
          max_minutes: 90,
          validation_type: 'sequence_gap',
          phase_group: resolvedPhaseGroup,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await milestoneTypeAudit.created(supabase, data.displayName, insertedData.id)
      setMilestones([...(milestones || []), { ...insertedData, deleted_at: null }])
      setShowFormModal(false)
      showToast({ type: 'success', title: `"${data.displayName}" created` })
    } catch {
      showToast({ type: 'error', title: 'Failed to create milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data: {
    displayName: string
    phaseGroup: PhaseGroup | ''
    minMinutes: number
    maxMinutes: number
  }) => {
    if (!editingMilestone || !data.displayName) return

    setSaving(true)
    try {
      const oldDisplayName = editingMilestone.display_name
      const resolvedPhaseGroup = data.phaseGroup || null

      const { error: updateError } = await supabase
        .from('facility_milestones')
        .update({
          display_name: data.displayName,
          min_minutes: data.minMinutes,
          max_minutes: data.maxMinutes,
          phase_group: resolvedPhaseGroup,
        })
        .eq('id', editingMilestone.id)

      if (updateError) throw updateError

      if (oldDisplayName !== data.displayName) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, data.displayName)
      }

      setMilestones(
        (milestones || []).map(m => m.id === editingMilestone.id
          ? { ...m, display_name: data.displayName, min_minutes: data.minMinutes, max_minutes: data.maxMinutes, phase_group: resolvedPhaseGroup }
          : m
        )
      )
      setShowFormModal(false)
      setEditingMilestone(null)
    } catch {
      showToast({ type: 'error', title: 'Failed to update milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (milestone: FacilityMilestone) => {
    const usageCount = usageCounts[milestone.id] || 0
    const partner = milestone.pair_with_id
      ? (milestones || []).find(m => m.id === milestone.pair_with_id)
      : null

    setConfirmModal({
      isOpen: true,
      title: 'Archive Milestone',
      message: (
        <div>
          <p>Archive <strong>&ldquo;{milestone.display_name}&rdquo;</strong>?</p>
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
                This milestone is paired with <strong>&ldquo;{partner.display_name}&rdquo;</strong>.
                The pairing will be removed but the partner milestone will remain.
              </p>
            </div>
          )}
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this milestone from the archived section below.
          </p>
        </div>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        try {
          if (milestone.pair_with_id) {
            const { error: unlinkErr } = await supabase
              .from('facility_milestones')
              .update({ pair_with_id: null, pair_position: null })
              .eq('id', milestone.pair_with_id)
            if (unlinkErr) throw unlinkErr

            await milestoneTypeAudit.unlinked(
              supabase,
              milestone.display_name,
              partner?.display_name || 'Unknown'
            )
          }

          const { error: archiveError } = await supabase
            .from('facility_milestones')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              is_active: false,
              pair_with_id: null,
              pair_position: null,
            })
            .eq('id', milestone.id)

          if (archiveError) throw archiveError

          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)

          setMilestones((milestones || []).map(m => {
            if (m.id === milestone.id) {
              return { ...m, deleted_at: new Date().toISOString(), deleted_by: currentUserId, is_active: false, pair_with_id: null, pair_position: null }
            }
            if (m.id === milestone.pair_with_id) {
              return { ...m, pair_with_id: null, pair_position: null }
            }
            return m
          }))
          showToast({ type: 'success', title: `"${milestone.display_name}" archived` })
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive milestone' })
        }

        closeConfirmModal()
        setShowFormModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  const handleRestore = async (milestone: { id: string; display_name: string }) => {
    setSaving(true)
    try {
      const { error: restoreError } = await supabase
        .from('facility_milestones')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true,
        })
        .eq('id', milestone.id)

      if (restoreError) throw restoreError

      await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)

      setMilestones((milestones || []).map(m =>
        m.id === milestone.id
          ? { ...m, deleted_at: null, deleted_by: null, is_active: true }
          : m
      ))
      showToast({ type: 'success', title: `"${milestone.display_name}" restored` })
    } catch {
      showToast({ type: 'error', title: 'Failed to restore milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleReorder = useCallback(async (phaseKey: string, milestoneIds: string[]) => {
    // Optimistically update local state
    const updated = (milestones || []).map(m => {
      const idx = milestoneIds.indexOf(m.id)
      if (idx !== -1) {
        return { ...m, display_order: idx + 1 }
      }
      return m
    })
    // Sort by display_order so the table re-renders correctly
    updated.sort((a, b) => a.display_order - b.display_order)
    setMilestones(updated)

    // Persist to DB
    try {
      const updates = milestoneIds.map((id, idx) => ({
        id,
        display_order: idx + 1,
      }))

      for (const { id, display_order } of updates) {
        const { error: updateError } = await supabase
          .from('facility_milestones')
          .update({ display_order })
          .eq('id', id)
        if (updateError) throw updateError
      }
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
    }
  }, [milestones, setMilestones, supabase, showToast])

  const handleUnlink = async (milestone: FacilityMilestone) => {
    if (!milestone.pair_with_id) return

    const partner = (milestones || []).find(m => m.id === milestone.pair_with_id)

    setConfirmModal({
      isOpen: true,
      title: 'Unlink Milestones',
      message: (
        <div>
          <p>Remove the pairing between these milestones?</p>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600">Start</span>
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
        try {
          const { error: err1 } = await supabase
            .from('facility_milestones')
            .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
            .eq('id', milestone.id)
          if (err1) throw err1

          const { error: err2 } = await supabase
            .from('facility_milestones')
            .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
            .eq('id', milestone.pair_with_id)
          if (err2) throw err2

          await milestoneTypeAudit.unlinked(
            supabase,
            milestone.display_name,
            partner?.display_name || 'Unknown'
          )

          setMilestones((milestones || []).map(m => {
            if (m.id === milestone.id || m.id === milestone.pair_with_id) {
              return { ...m, pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' }
            }
            return m
          }))
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to unlink milestones' })
        }

        closeConfirmModal()
        setShowPairModal(false)
        setPairingMilestone(null)
        setSaving(false)
      },
    })
  }

  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return

    const partner = (milestones || []).find(m => m.id === selectedPairId)
    if (!partner) return

    setSaving(true)
    try {
      if (pairingMilestone.pair_with_id && pairingMilestone.pair_with_id !== selectedPairId) {
        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
          .eq('id', pairingMilestone.pair_with_id)
      }

      if (partner.pair_with_id && partner.pair_with_id !== pairingMilestone.id) {
        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
          .eq('id', partner.pair_with_id)
      }

      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: selectedPairId, pair_position: 'start', validation_type: 'duration' })
        .eq('id', pairingMilestone.id)

      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: pairingMilestone.id, pair_position: 'end', validation_type: 'sequence_gap' })
        .eq('id', selectedPairId)

      await milestoneTypeAudit.linked(
        supabase,
        pairingMilestone.display_name,
        partner.display_name
      )

      setMilestones((milestones || []).map(m => {
        if (m.id === pairingMilestone.pair_with_id || m.id === partner.pair_with_id) {
          if (m.id !== pairingMilestone.id && m.id !== selectedPairId) {
            return { ...m, pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' }
          }
        }
        if (m.id === pairingMilestone.id) {
          return { ...m, pair_with_id: selectedPairId, pair_position: 'start' as const, validation_type: 'duration' as const }
        }
        if (m.id === selectedPairId) {
          return { ...m, pair_with_id: pairingMilestone.id, pair_position: 'end' as const, validation_type: 'sequence_gap' as const }
        }
        return m
      }))

      setShowPairModal(false)
      setPairingMilestone(null)
      setSelectedPairId('')
    } catch {
      showToast({ type: 'error', title: 'Failed to set milestone pairing' })
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────

  const getPairedName = (pairWithId: string): string => {
    const paired = (milestones || []).find(m => m.id === pairWithId)
    return paired?.display_name || 'Unknown'
  }

  const getAvailableForPairing = (excludeId: string): FacilityMilestone[] => {
    return (milestones || []).filter(m =>
      m.id !== excludeId &&
      !m.deleted_at &&
      m.is_active &&
      !m.pair_with_id
    )
  }

  const openAddModal = () => {
    setFormMode('add')
    setEditingMilestone(null)
    setShowFormModal(true)
  }

  const openEditModal = (row: MilestoneRowData) => {
    const milestone = (milestones || []).find(m => m.id === row.id)
    if (!milestone) return
    setFormMode('edit')
    setEditingMilestone(milestone)
    setShowFormModal(true)
  }

  const handleArchiveFromRow = (row: MilestoneRowData) => {
    const milestone = (milestones || []).find(m => m.id === row.id)
    if (milestone) handleArchive(milestone)
  }

  const handleArchiveFromModal = () => {
    if (editingMilestone) handleArchive(editingMilestone)
  }

  return (
    <>
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Milestones</h1>
        <Button onClick={openAddModal}>
          <Plus className="w-4 h-4" />
          Add Custom Milestone
        </Button>
      </div>
      <p className="text-slate-500 mb-4">Configure the surgical milestones tracked during cases.</p>

      {/* Info bar */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-slate-50 border-l-[3px] border-indigo-400 rounded-r-lg text-sm text-slate-600">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          <span className="text-indigo-400">&#x25C6;</span> indicates a custom milestone. All others are global defaults. Drag to reorder within each phase.
        </span>
      </div>

      {/* Phase-grouped milestones table */}
      <MilestonesTable
        milestones={activeMilestones}
        loading={loading}
        onEdit={openEditModal}
        onArchive={handleArchiveFromRow}
        onReorder={handleReorder}
      />

      {/* Archived milestones section */}
      <ArchivedMilestonesSection
        milestones={deletedMilestones}
        saving={saving}
        onRestore={handleRestore}
      />

      {/* Add/Edit Modal */}
      <MilestoneFormModal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingMilestone(null) }}
        mode={formMode}
        milestone={editingMilestone}
        pairedName={editingMilestone?.pair_with_id ? getPairedName(editingMilestone.pair_with_id) : null}
        saving={saving}
        onSubmit={handleFormSubmit}
        onArchive={handleArchiveFromModal}
      />

      {/* Pair/Unlink Modal */}
      <Modal
        open={showPairModal && !!pairingMilestone}
        onClose={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}
        title={pairingMilestone?.pair_with_id ? 'Manage Pairing' : 'Set Up Pairing'}
      >
        {pairingMilestone && (
          <>
            <p className="text-sm text-slate-600">
              {pairingMilestone.pair_with_id
                ? `"${pairingMilestone.display_name}" is paired with "${getPairedName(pairingMilestone.pair_with_id)}".`
                : `Pair "${pairingMilestone.display_name}" with another milestone.`
              }
            </p>

            {pairingMilestone.pair_with_id && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Current Pairing</span>
                  {!pairingMilestone.source_milestone_type_id && (
                    <button
                      onClick={() => handleUnlink(pairingMilestone)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Unlink
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600">Start</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'start'
                        ? pairingMilestone.display_name
                        : pairingMilestone.pair_position === 'end'
                          ? getPairedName(pairingMilestone.pair_with_id)
                          : pairingMilestone.display_name
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">End</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'end'
                        ? pairingMilestone.display_name
                        : pairingMilestone.pair_position === 'start'
                          ? getPairedName(pairingMilestone.pair_with_id)
                          : getPairedName(pairingMilestone.pair_with_id)
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {pairingMilestone.source_milestone_type_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Global milestone pairings are managed by ORbit and cannot be changed.
                </p>
              </div>
            )}

            {!pairingMilestone.source_milestone_type_id && (
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
                      <span className="font-medium">{pairingMilestone.display_name}</span> &rarr; Start
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">{(milestones || []).find(m => m.id === selectedPairId)?.display_name}</span> &rarr; End
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}>
            {pairingMilestone?.source_milestone_type_id || pairingMilestone?.pair_with_id ? 'Close' : 'Cancel'}
          </Modal.Cancel>
          {pairingMilestone && !pairingMilestone.source_milestone_type_id && selectedPairId && selectedPairId !== pairingMilestone.pair_with_id && (
            <Modal.Action onClick={handleSetPair} loading={saving}>
              {pairingMilestone.pair_with_id ? 'Change Pairing' : 'Create Pairing'}
            </Modal.Action>
          )}
        </Modal.Footer>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'primary' ? 'info' : 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </>
  )
}
