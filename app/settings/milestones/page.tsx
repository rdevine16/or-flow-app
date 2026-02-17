// app/settings/milestones/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Info, Plus, AlertTriangle } from 'lucide-react'
import { inferPhaseGroup, type PhaseGroup } from '@/lib/utils/inferPhaseGroup'
import { MilestoneFormModal } from '@/components/settings/milestones/MilestoneFormModal'
import { ArchivedMilestonesSection } from '@/components/settings/milestones/ArchivedMilestonesSection'
import { PhaseBlock, type PhaseBlockMilestone } from '@/components/settings/milestones/PhaseBlock'
import { BoundaryMarker } from '@/components/settings/milestones/BoundaryMarker'
import { PairBracketOverlay, computeBracketData, computeBracketAreaWidth } from '@/components/settings/milestones/PairBracketOverlay'
import { detectPairIssues, countPairIssuesInPhase } from '@/lib/utils/pairIssues'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import { Skeleton } from '@/components/ui/Skeleton'

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

interface PhaseDefinitionRow {
  id: string
  name: string
  display_name: string
  display_order: number
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
  is_active: boolean
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

  const { data: phaseDefinitions, loading: phasesLoading } = useSupabaseQuery<PhaseDefinitionRow[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('phase_definitions')
        .select('id, name, display_name, display_order, color_key, start_milestone_id, end_milestone_id, is_active')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
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

  // ── Computed data for new phase-block layout ────────────────────────

  // Set of milestone IDs that are boundary milestones (referenced in phase_definitions)
  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    if (!phaseDefinitions) return ids
    for (const pd of phaseDefinitions) {
      ids.add(pd.start_milestone_id)
      ids.add(pd.end_milestone_id)
    }
    return ids
  }, [phaseDefinitions])

  // Milestone lookup by ID
  const milestoneById = useMemo(() => {
    const map = new Map<string, FacilityMilestone>()
    for (const m of (milestones || [])) {
      map.set(m.id, m)
    }
    return map
  }, [milestones])

  // Derive pair_group: both milestones in a pair share the START milestone's ID
  const pairGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of activeMilestones) {
      if (!m.pair_with_id || !m.pair_position) continue
      if (m.pair_position === 'start') {
        map.set(m.id, m.id)
      } else if (m.pair_position === 'end') {
        map.set(m.id, m.pair_with_id)
      }
    }
    return map
  }, [activeMilestones])

  // Build PhaseBlockMilestone arrays per phase
  const phaseBlockData = useMemo(() => {
    if (!phaseDefinitions?.length) return []

    return phaseDefinitions.map(pd => {
      const color = resolveColorKey(pd.color_key).hex
      const phaseMilestones: PhaseBlockMilestone[] = activeMilestones
        .filter(m => m.phase_group === pd.name && !boundaryMilestoneIds.has(m.id))
        .map(m => ({
          id: m.id,
          display_name: m.display_name,
          phase_group: m.phase_group,
          is_boundary: false,
          pair_with_id: m.pair_with_id,
          pair_position: m.pair_position,
          pair_group: pairGroupMap.get(m.id) || null,
        }))

      return { phaseDef: pd, color, milestones: phaseMilestones }
    })
  }, [phaseDefinitions, activeMilestones, boundaryMilestoneIds, pairGroupMap])

  // All milestones as PairIssueMilestone for issue detection
  const allPairIssueMilestones = useMemo(() => {
    return activeMilestones.map(m => ({
      id: m.id,
      phase_group: m.phase_group,
      pair_with_id: m.pair_with_id,
      pair_position: m.pair_position,
      pair_group: pairGroupMap.get(m.id) || null,
    }))
  }, [activeMilestones, pairGroupMap])

  const pairIssues = useMemo(() => detectPairIssues(allPairIssueMilestones), [allPairIssueMilestones])
  const totalPairIssueCount = Object.keys(pairIssues).length

  // Precompute render data: boundary markers + bracket info per phase
  const renderData = useMemo(() => {
    if (!phaseBlockData.length) return []

    return phaseBlockData.map((phase, idx) => {
      const isFirst = idx === 0
      const isLast = idx === phaseBlockData.length - 1

      // Boundary before this phase block
      let boundaryBefore: { name: string; topColor: string; bottomColor: string; solid: boolean } | null = null
      if (isFirst) {
        const ms = milestoneById.get(phase.phaseDef.start_milestone_id)
        if (ms) {
          boundaryBefore = { name: ms.display_name, topColor: phase.color, bottomColor: phase.color, solid: true }
        }
      }

      // Boundary after this phase block
      let boundaryAfter: { name: string; topColor: string; bottomColor: string; solid: boolean } | null = null
      if (isLast) {
        const ms = milestoneById.get(phase.phaseDef.end_milestone_id)
        if (ms) {
          boundaryAfter = { name: ms.display_name, topColor: phase.color, bottomColor: phase.color, solid: true }
        }
      } else {
        const nextColor = phaseBlockData[idx + 1].color
        const ms = milestoneById.get(phase.phaseDef.end_milestone_id)
        if (ms) {
          boundaryAfter = { name: ms.display_name, topColor: phase.color, bottomColor: nextColor, solid: false }
        }
      }

      // Pair bracket computation
      const brackets = computeBracketData(phase.milestones, pairIssues)
      const bracketWidth = computeBracketAreaWidth(brackets)
      const issueCount = countPairIssuesInPhase(allPairIssueMilestones, pairIssues, phase.phaseDef.name)

      // Running counter for numbered rows (across all phases)
      const startCounter = phaseBlockData.slice(0, idx).reduce((sum, p) => sum + p.milestones.length, 0) + 1

      return { ...phase, boundaryBefore, boundaryAfter, brackets, bracketWidth, issueCount, startCounter }
    })
  }, [phaseBlockData, milestoneById, pairIssues, allPairIssueMilestones])

  // Summary counts
  const totalCount = activeMilestones.length
  const boundaryCount = activeMilestones.filter(m => boundaryMilestoneIds.has(m.id)).length
  const optionalCount = totalCount - boundaryCount

  // Available milestones for pairing in add modal
  const availableForPairing = useMemo(() => {
    return activeMilestones
      .filter(m => !m.pair_with_id && !boundaryMilestoneIds.has(m.id))
      .map(m => ({ id: m.id, display_name: m.display_name, phase_group: m.phase_group }))
  }, [activeMilestones, boundaryMilestoneIds])

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
    pairWithId: string
    pairRole: 'start' | 'end'
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
    pairWithId?: string
    pairRole?: 'start' | 'end'
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

      let newMilestone = { ...insertedData, deleted_at: null } as FacilityMilestone

      // Set up pairing if requested
      if (data.pairWithId && data.pairRole) {
        const isStart = data.pairRole === 'start'
        const { error: pairErr1 } = await supabase
          .from('facility_milestones')
          .update({
            pair_with_id: data.pairWithId,
            pair_position: isStart ? 'start' : 'end',
            validation_type: isStart ? 'duration' : 'sequence_gap',
          })
          .eq('id', insertedData.id)
        if (pairErr1) throw pairErr1

        const { error: pairErr2 } = await supabase
          .from('facility_milestones')
          .update({
            pair_with_id: insertedData.id,
            pair_position: isStart ? 'end' : 'start',
            validation_type: isStart ? 'sequence_gap' : 'duration',
          })
          .eq('id', data.pairWithId)
        if (pairErr2) throw pairErr2

        const partner = (milestones || []).find(m => m.id === data.pairWithId)
        await milestoneTypeAudit.linked(supabase, data.displayName, partner?.display_name || 'Unknown')

        newMilestone = {
          ...newMilestone,
          pair_with_id: data.pairWithId,
          pair_position: (isStart ? 'start' : 'end') as 'start' | 'end',
          validation_type: (isStart ? 'duration' : 'sequence_gap') as 'duration' | 'sequence_gap',
        }

        // Update local state: add new + update partner
        setMilestones(prev => {
          const updated = [...(prev || []), newMilestone]
          return updated.map(m => {
            if (m.id === data.pairWithId) {
              return {
                ...m,
                pair_with_id: insertedData.id,
                pair_position: (isStart ? 'end' : 'start') as 'start' | 'end',
                validation_type: (isStart ? 'sequence_gap' : 'duration') as 'duration' | 'sequence_gap',
              }
            }
            return m
          })
        })
      } else {
        setMilestones([...(milestones || []), newMilestone])
      }

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

  const handleReorder = useCallback(async (phaseKey: string, newOrder: PhaseBlockMilestone[]) => {
    const milestoneIds = newOrder.map(m => m.id)
    // Optimistically update local state
    const updated = (milestones || []).map(m => {
      const idx = milestoneIds.indexOf(m.id)
      if (idx !== -1) {
        return { ...m, display_order: idx + 1 }
      }
      return m
    })
    updated.sort((a, b) => a.display_order - b.display_order)
    setMilestones(updated)

    // Persist to DB
    try {
      for (let i = 0; i < milestoneIds.length; i++) {
        const { error: updateError } = await supabase
          .from('facility_milestones')
          .update({ display_order: i + 1 })
          .eq('id', milestoneIds[i])
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

  const handleArchiveById = (milestoneId: string) => {
    const milestone = (milestones || []).find(m => m.id === milestoneId)
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
        <div className="flex items-center gap-2">
          {totalPairIssueCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 rounded-md text-[10px] font-semibold text-red-600">
              <AlertTriangle className="w-3 h-3" /> {totalPairIssueCount} pair issue{totalPairIssueCount > 1 ? 's' : ''}
            </div>
          )}
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            Add Milestone
          </Button>
        </div>
      </div>
      <p className="text-slate-500 mb-4">Facility-level milestone definitions. Drag to reorder, add or remove milestones.</p>

      {/* Phase blocks with boundary markers */}
      {loading || phasesLoading ? (
        <div className="max-w-[620px] space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="ml-[11px] border-l-[2.5px] border-slate-200 rounded-r-[5px] bg-white">
                <div className="flex items-center gap-2 px-2.5 py-[7px]">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="space-y-0">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-[34px] flex items-center gap-2 px-2 border-b border-[#F5F5F5]">
                      <Skeleton className="w-3 h-3" />
                      <Skeleton className="w-[18px] h-3" />
                      <Skeleton className="h-3 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-[620px]">
          <div className="flex flex-col">
            {renderData.map((phase) => (
              <Fragment key={phase.phaseDef.id}>
                {phase.boundaryBefore && (
                  <BoundaryMarker
                    name={phase.boundaryBefore.name}
                    topColor={phase.boundaryBefore.topColor}
                    bottomColor={phase.boundaryBefore.bottomColor}
                    solid={phase.boundaryBefore.solid}
                  />
                )}
                <PhaseBlock
                  phaseColor={phase.color}
                  phaseLabel={phase.phaseDef.display_name}
                  phaseKey={phase.phaseDef.name}
                  mode="table"
                  milestones={phase.milestones}
                  pairIssueCount={phase.issueCount}
                  onReorder={handleReorder}
                  draggable
                  onDelete={handleArchiveById}
                  startCounter={phase.startCounter}
                  bracketAreaWidth={phase.bracketWidth}
                >
                  {phase.brackets.length > 0 && (
                    <PairBracketOverlay
                      milestones={phase.milestones}
                      pairIssues={pairIssues}
                    />
                  )}
                </PhaseBlock>
                {phase.boundaryAfter && (
                  <BoundaryMarker
                    name={phase.boundaryAfter.name}
                    topColor={phase.boundaryAfter.topColor}
                    bottomColor={phase.boundaryAfter.bottomColor}
                    solid={phase.boundaryAfter.solid}
                  />
                )}
              </Fragment>
            ))}
          </div>

          {/* Summary footer */}
          <div className="mt-3 px-3.5 py-2 bg-white rounded-md border border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>{totalCount} total &middot; {boundaryCount} boundary &middot; {optionalCount} optional</span>
          </div>
        </div>
      )}

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
        availableForPairing={availableForPairing}
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
