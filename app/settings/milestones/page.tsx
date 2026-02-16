// app/settings/milestones/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { inferPhaseGroup, PHASE_GROUP_OPTIONS, type PhaseGroup } from '@/lib/utils/inferPhaseGroup'
import { MilestonesTable } from '@/components/settings/milestones/MilestonesTable'
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
  const [editMinMinutes, setEditMinMinutes] = useState<number>(0)
  const [editMaxMinutes, setEditMaxMinutes] = useState<number>(90)
  const [newPhaseGroup, setNewPhaseGroup] = useState<PhaseGroup | ''>('')
  const [editPhaseGroup, setEditPhaseGroup] = useState<PhaseGroup | ''>('')

  // Usage counts for milestones
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (effectiveFacilityId && milestones) {
      fetchUsageCounts()
    }
  }, [effectiveFacilityId, milestones])

  const fetchUsageCounts = async () => {
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
  }

  // Filtered milestone lists
  const activeMilestones = useMemo(
    () => (milestones || []).filter(m => !m.deleted_at && m.is_active),
    [milestones]
  )

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

  // ── Mutation handlers ────────────────────────────────────

  const handleAdd = async () => {
    if (!newDisplayName.trim() || !effectiveFacilityId) return

    setSaving(true)
    try {
      const name = newName.trim() || generateName(newDisplayName)
      const maxOrder = (milestones || []).length > 0
        ? Math.max(...(milestones || []).map(m => m.display_order))
        : 0

      const resolvedPhaseGroup = newPhaseGroup || inferPhaseGroup(name) || null

      const { data, error: insertError } = await supabase
        .from('facility_milestones')
        .insert({
          facility_id: effectiveFacilityId,
          name,
          display_name: newDisplayName.trim(),
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

      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      setMilestones([...(milestones || []), { ...data, deleted_at: null }])
      setNewName('')
      setNewDisplayName('')
      setNewPhaseGroup('')
      setShowAddModal(false)
    } catch {
      showToast({ type: 'error', title: 'Failed to create milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editingMilestone || !editDisplayName.trim()) return

    setSaving(true)
    try {
      const oldDisplayName = editingMilestone.display_name
      const resolvedPhaseGroup = editPhaseGroup || null

      const { error: updateError } = await supabase
        .from('facility_milestones')
        .update({
          display_name: editDisplayName.trim(),
          min_minutes: editMinMinutes,
          max_minutes: editMaxMinutes,
          phase_group: resolvedPhaseGroup,
        })
        .eq('id', editingMilestone.id)

      if (updateError) throw updateError

      if (oldDisplayName !== editDisplayName.trim()) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, editDisplayName.trim())
      }

      setMilestones(
        (milestones || []).map(m => m.id === editingMilestone.id
          ? { ...m, display_name: editDisplayName.trim(), min_minutes: editMinMinutes, max_minutes: editMaxMinutes, phase_group: resolvedPhaseGroup }
          : m
        )
      )
      setShowEditModal(false)
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
        setShowEditModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  const handleRestore = async (milestone: FacilityMilestone) => {
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

  const openEditModal = (row: MilestoneRowData) => {
    const milestone = (milestones || []).find(m => m.id === row.id)
    if (!milestone) return
    setEditingMilestone(milestone)
    setEditDisplayName(milestone.display_name)
    setEditMinMinutes(milestone.min_minutes ?? 1)
    setEditMaxMinutes(milestone.max_minutes ?? 90)
    setEditPhaseGroup(milestone.phase_group ?? '')
    setShowEditModal(true)
  }

  const handleArchiveFromRow = (row: MilestoneRowData) => {
    const milestone = (milestones || []).find(m => m.id === row.id)
    if (milestone) handleArchive(milestone)
  }

  const deletedMilestones = useMemo(
    () => (milestones || []).filter(m => m.deleted_at),
    [milestones]
  )

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

  const [showArchived, setShowArchived] = useState(false)

  return (
    <>
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Milestones</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Add Custom Milestone
        </Button>
      </div>
      <p className="text-slate-500 mb-4">Configure the surgical milestones tracked during cases.</p>

      {/* Info bar */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-slate-50 border-l-[3px] border-indigo-400 rounded-r-lg text-sm text-slate-600">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          <span className="text-indigo-400">&#x25C6;</span> indicates a custom milestone. All others are global defaults.
        </span>
      </div>

      {/* Phase-grouped milestones table */}
      <MilestonesTable
        milestones={activeMilestones}
        loading={loading}
        onEdit={openEditModal}
        onArchive={handleArchiveFromRow}
      />

      {/* Archived milestones section */}
      {deletedMilestones.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>&#x25B6;</span>
            Archived ({deletedMilestones.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {deletedMilestones.map(milestone => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-500 line-through">
                      {milestone.display_name}
                    </span>
                    {!milestone.source_milestone_type_id && (
                      <span className="ml-2 text-indigo-400 text-xs">&#x25C6;</span>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Archived {milestone.deleted_at ? formatDeletedDate(milestone.deleted_at) : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(milestone)}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setNewName(''); setNewDisplayName(''); setNewPhaseGroup('') }}
        title="Add Custom Milestone"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Display Name <span className="text-red-600">*</span>
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Phase Group <span className="text-slate-400 font-normal">(auto-inferred from name)</span>
          </label>
          <select
            value={newPhaseGroup}
            onChange={(e) => setNewPhaseGroup(e.target.value as PhaseGroup | '')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              {(() => {
                const inferred = inferPhaseGroup(newName.trim() || generateName(newDisplayName))
                return inferred ? `Auto: ${PHASE_GROUP_OPTIONS.find(o => o.value === inferred)?.label}` : 'None (unassigned)'
              })()}
            </option>
            {PHASE_GROUP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowAddModal(false); setNewName(''); setNewDisplayName(''); setNewPhaseGroup('') }} />
          <Modal.Action onClick={handleAdd} loading={saving} disabled={!newDisplayName.trim()}>
            Add Milestone
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && !!editingMilestone}
        onClose={() => { setShowEditModal(false); setEditingMilestone(null) }}
        title="Edit Milestone"
      >
        {editingMilestone && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Display Name <span className="text-red-600">*</span>
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
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-900">Paired Milestone</p>
                <p className="text-sm text-green-600 mt-1">
                  {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
                </p>
              </div>
            )}

            {editingMilestone.source_milestone_type_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  This is a global milestone. You can edit the name and validation range, but it cannot be archived.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">Phase Group</label>
              <p className="text-xs text-slate-500 mb-2">Used for time allocation bucketing in milestone analytics</p>
              <select
                value={editPhaseGroup}
                onChange={(e) => setEditPhaseGroup(e.target.value as PhaseGroup | '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None (unassigned)</option>
                {PHASE_GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">Expected Duration Range</label>
              <p className="text-xs text-slate-500 mb-3">
                {editingMilestone.validation_type === 'duration' && editingMilestone.pair_with_id
                  ? `Time between ${editingMilestone.display_name} and ${getPairedName(editingMilestone.pair_with_id)}`
                  : 'Time from previous milestone to this one'
                }
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Min (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={editMinMinutes}
                    onChange={(e) => setEditMinMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                  />
                </div>
                <span className="text-slate-400 pt-4">&mdash;</span>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Max (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={editMaxMinutes}
                    onChange={(e) => setEditMaxMinutes(Math.max(1, parseInt(e.target.value) || 90))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Milestones outside this range will be flagged for review in Data Quality.
              </p>
            </div>
          </>
        )}

        {/* Custom footer: Archive left, Cancel/Save right */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
          {editingMilestone && !editingMilestone.source_milestone_type_id ? (
            <Button variant="dangerGhost" onClick={() => handleArchive(editingMilestone)} disabled={saving}>
              Archive
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <Modal.Cancel onClick={() => { setShowEditModal(false); setEditingMilestone(null) }} />
            <Modal.Action onClick={handleEdit} loading={saving} disabled={!editDisplayName.trim()}>
              Save Changes
            </Modal.Action>
          </div>
        </div>
      </Modal>

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
