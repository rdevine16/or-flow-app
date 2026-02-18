// app/settings/phases/page.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { phaseDefinitionAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Info, Plus } from 'lucide-react'
import { PhaseCard, PhaseCardOverlay, type PhaseCardData } from '@/components/settings/phases/PhaseCard'
import { PhaseFormModal, type PhaseFormData } from '@/components/settings/phases/PhaseFormModal'
import { ArchivedPhasesSection } from '@/components/settings/phases/ArchivedPhasesSection'
import { SkeletonTable } from '@/components/ui/Skeleton'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

interface PhaseDefinition {
  id: string
  facility_id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_id: string
  end_milestone_id: string
  color_key: string | null
  is_active: boolean
  deleted_at: string | null
  parent_phase_id: string | null
}

interface FacilityMilestone {
  id: string
  display_name: string
  display_order: number
}

interface PhaseTreeNode {
  phase: PhaseDefinition
  children: PhaseDefinition[]
}

/** Flat item in the rendered list (parent or child) with metadata for DnD */
interface FlatPhaseItem {
  phase: PhaseDefinition
  isChild: boolean
  /** Index in the flat list */
  flatIndex: number
}

type DropIntent =
  | { type: 'reorder'; targetId: string; position: 'before' | 'after' }
  | { type: 'nest'; targetId: string }
  | null

// ── Draggable Phase Card wrapper ─────────────────────────

function DraggablePhaseCard({
  item,
  milestones,
  activePhases,
  onEdit,
  onArchive,
  dropIntent,
}: {
  item: FlatPhaseItem
  milestones: { id: string; display_name: string }[]
  activePhases: PhaseCardData[]
  onEdit: (phase: PhaseCardData, field: string, value: string) => void
  onArchive: (phase: PhaseCardData) => void
  dropIntent: DropIntent
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${item.phase.id}`,
    data: { phaseId: item.phase.id },
  })

  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop-${item.phase.id}`,
    data: { phaseId: item.phase.id, isChild: item.isChild },
  })

  // Merge refs
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])

  const isNestTarget = dropIntent?.type === 'nest' && dropIntent.targetId === item.phase.id
  const dropIndicator =
    dropIntent?.type === 'reorder' && dropIntent.targetId === item.phase.id
      ? dropIntent.position
      : null

  return (
    <PhaseCard
      ref={mergedRef}
      phase={item.phase}
      milestones={milestones}
      activePhases={activePhases}
      onEdit={onEdit}
      onArchive={onArchive}
      isChild={item.isChild}
      isNestTarget={isNestTarget}
      dropIndicator={dropIndicator}
      isDragging={isDragging}
      dragHandleListeners={listeners}
      dragHandleAttributes={attributes}
    />
  )
}

// ── Main Page ──────────────────────────────────────────────

export default function PhasesSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  useCurrentUser() // ensure auth context is loaded

  // Fetch phase definitions
  const { data: phases, loading, error, setData: setPhases } = useSupabaseQuery<PhaseDefinition[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('phase_definitions')
        .select('id, facility_id, name, display_name, display_order, start_milestone_id, end_milestone_id, color_key, is_active, deleted_at, parent_phase_id')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Fetch facility milestones for dropdowns
  const { data: milestones } = useSupabaseQuery<FacilityMilestone[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('facility_milestones')
        .select('id, display_name, display_order')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent>(null)


  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    confirmVariant: 'danger' | 'warning' | 'info'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'warning',
    onConfirm: () => {},
  })

  // Filtered phase lists
  const activePhases = useMemo(
    () => (phases || []).filter(p => !p.deleted_at && p.is_active).sort((a, b) => a.display_order - b.display_order),
    [phases]
  )

  const archivedPhases = useMemo(
    () => (phases || []).filter(p => p.deleted_at),
    [phases]
  )

  // Build phase tree for rendering
  const phaseTree = useMemo((): PhaseTreeNode[] => {
    const topLevel = activePhases.filter(p => !p.parent_phase_id)
    const childMap = new Map<string, PhaseDefinition[]>()
    for (const p of activePhases) {
      if (p.parent_phase_id) {
        const existing = childMap.get(p.parent_phase_id) || []
        existing.push(p)
        childMap.set(p.parent_phase_id, existing)
      }
    }
    return topLevel.map(p => ({
      phase: p,
      children: (childMap.get(p.id) || []).sort((a, b) => a.display_order - b.display_order),
    }))
  }, [activePhases])

  // Flatten tree into ordered list for DnD
  const flatItems = useMemo((): FlatPhaseItem[] => {
    const items: FlatPhaseItem[] = []
    let idx = 0
    for (const node of phaseTree) {
      items.push({ phase: node.phase, isChild: false, flatIndex: idx++ })
      for (const child of node.children) {
        items.push({ phase: child, isChild: true, flatIndex: idx++ })
      }
    }
    return items
  }, [phaseTree])

  const milestoneOptions = useMemo(
    () => (milestones || []).map(m => ({ id: m.id, display_name: m.display_name })),
    [milestones]
  )

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // ── @dnd-kit ────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const phaseId = event.active.data.current?.phaseId as string
    setActiveDragId(phaseId)
  }, [])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active, over } = event
    if (!over) {
      setDropIntent(null)
      return
    }

    const draggedPhaseId = active.data.current?.phaseId as string
    const targetPhaseId = over.data.current?.phaseId as string | undefined
    if (!targetPhaseId || targetPhaseId === draggedPhaseId) {
      setDropIntent(null)
      return
    }

    // Get the over element's rect to determine position within the card
    const overRect = over.rect
    if (!overRect) {
      setDropIntent(null)
      return
    }

    // Use pointer position to determine zone
    // We use the active's translated position to approximate pointer location
    const pointerY = (event.activatorEvent as PointerEvent).clientY + (event.delta?.y ?? 0)
    const cardTop = overRect.top
    const cardHeight = overRect.height
    const relativeY = pointerY - cardTop
    const ratio = relativeY / cardHeight

    const targetPhase = activePhases.find(p => p.id === targetPhaseId)
    const draggedPhase = activePhases.find(p => p.id === draggedPhaseId)
    if (!targetPhase || !draggedPhase) {
      setDropIntent(null)
      return
    }

    const draggedHasChildren = activePhases.some(p => p.parent_phase_id === draggedPhaseId)
    const targetIsTopLevel = !targetPhase.parent_phase_id
    const canNest = targetIsTopLevel && !draggedHasChildren

    if (ratio < 0.25) {
      // Top zone: insert before
      setDropIntent({ type: 'reorder', targetId: targetPhaseId, position: 'before' })
    } else if (ratio > 0.75) {
      // Bottom zone: insert after
      setDropIntent({ type: 'reorder', targetId: targetPhaseId, position: 'after' })
    } else if (canNest) {
      // Center zone: nest under target
      setDropIntent({ type: 'nest', targetId: targetPhaseId })
    } else {
      // Can't nest, fall back to nearest edge
      setDropIntent({
        type: 'reorder',
        targetId: targetPhaseId,
        position: ratio < 0.5 ? 'before' : 'after',
      })
    }
  }, [activePhases])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const intent = dropIntent
    const draggedPhaseId = event.active.data.current?.phaseId as string

    // Reset DnD state immediately
    setActiveDragId(null)
    setDropIntent(null)

    if (!intent || !draggedPhaseId) return

    const draggedPhase = activePhases.find(p => p.id === draggedPhaseId)
    if (!draggedPhase) return

    if (intent.type === 'nest') {
      // Nest under target
      const targetPhase = activePhases.find(p => p.id === intent.targetId)
      if (!targetPhase) return

      const hasChildren = activePhases.some(p => p.parent_phase_id === draggedPhaseId)
      if (hasChildren) {
        showToast({ type: 'error', title: 'Cannot nest a phase that has subphases' })
        return
      }

      setSaving(true)
      try {
        const { error: updateError } = await supabase
          .from('phase_definitions')
          .update({ parent_phase_id: intent.targetId })
          .eq('id', draggedPhaseId)

        if (updateError) throw updateError

        setPhases(
          (phases || []).map(p => p.id === draggedPhaseId ? { ...p, parent_phase_id: intent.targetId } : p)
        )
        showToast({ type: 'success', title: `"${draggedPhase.display_name}" nested under "${targetPhase.display_name}"` })
      } catch {
        showToast({ type: 'error', title: 'Failed to nest phase' })
      } finally {
        setSaving(false)
      }
    } else if (intent.type === 'reorder') {
      // Reorder: compute new flat order
      const targetPhaseId = intent.targetId

      // Work with the flat list of top-level phases (reorder among top-level only)
      // If the dragged phase is a child, un-nest it first by clearing parent_phase_id
      const wasChild = !!draggedPhase.parent_phase_id

      // Build the new top-level order
      const topLevel = activePhases
        .filter(p => !p.parent_phase_id && p.id !== draggedPhaseId)
        .sort((a, b) => a.display_order - b.display_order)

      // Find where to insert: based on the target's position in the flat list
      const targetItem = flatItems.find(fi => fi.phase.id === targetPhaseId)
      if (!targetItem) return

      // Determine the top-level phase to insert relative to
      let insertRelativeToId = targetPhaseId
      let insertPosition = intent.position

      // If target is a child, insert relative to its parent instead
      if (targetItem.isChild && targetItem.phase.parent_phase_id) {
        insertRelativeToId = targetItem.phase.parent_phase_id
        // If dropping after a child, insert after the parent group
        if (intent.position === 'after') {
          insertPosition = 'after'
        } else {
          // Dropping before a child means insert before the parent
          insertPosition = 'before'
        }
      }

      // Build new ordered list
      const newTopLevel: PhaseDefinition[] = []
      for (const p of topLevel) {
        if (p.id === insertRelativeToId && insertPosition === 'before') {
          newTopLevel.push({ ...draggedPhase, parent_phase_id: null })
        }
        newTopLevel.push(p)
        if (p.id === insertRelativeToId && insertPosition === 'after') {
          newTopLevel.push({ ...draggedPhase, parent_phase_id: null })
        }
      }

      // If target wasn't found in top-level (edge case), append
      if (!newTopLevel.some(p => p.id === draggedPhaseId)) {
        newTopLevel.push({ ...draggedPhase, parent_phase_id: null })
      }

      // Compute new display_order values for all affected phases
      const updates: { id: string; display_order: number; parent_phase_id: string | null }[] = []
      let order = 1
      for (const p of newTopLevel) {
        const needsOrderUpdate = p.display_order !== order
        const needsParentUpdate = p.id === draggedPhaseId && wasChild

        if (needsOrderUpdate || needsParentUpdate) {
          updates.push({
            id: p.id,
            display_order: order,
            parent_phase_id: p.id === draggedPhaseId ? null : p.parent_phase_id,
          })
        }
        order++
      }

      if (updates.length === 0) return

      setSaving(true)
      try {
        // Batch update all changed phases
        for (const u of updates) {
          const { error: updateError } = await supabase
            .from('phase_definitions')
            .update({ display_order: u.display_order, parent_phase_id: u.parent_phase_id })
            .eq('id', u.id)

          if (updateError) throw updateError
        }

        // Update local state
        const updateMap = new Map(updates.map(u => [u.id, u]))
        setPhases(
          (phases || []).map(p => {
            const u = updateMap.get(p.id)
            if (u) return { ...p, display_order: u.display_order, parent_phase_id: u.parent_phase_id }
            return p
          })
        )

        if (wasChild) {
          showToast({ type: 'success', title: `"${draggedPhase.display_name}" moved to top level` })
        }
      } catch {
        showToast({ type: 'error', title: 'Failed to reorder phases' })
      } finally {
        setSaving(false)
      }
    }
  }, [dropIntent, activePhases, flatItems, phases, setPhases, supabase, showToast])

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null)
    setDropIntent(null)
  }, [])

  const activeDragPhase = activeDragId ? activePhases.find(p => p.id === activeDragId) : null

  // ── CRUD Handlers ────────────────────────────────────────

  const handleAdd = async (data: PhaseFormData) => {
    if (!effectiveFacilityId) return

    setSaving(true)
    try {
      const maxOrder = activePhases.length > 0
        ? Math.max(...activePhases.map(p => p.display_order))
        : 0

      const { data: insertedData, error: insertError } = await supabase
        .from('phase_definitions')
        .insert({
          facility_id: effectiveFacilityId,
          name: data.internalName,
          display_name: data.displayName,
          display_order: maxOrder + 1,
          start_milestone_id: data.startMilestoneId,
          end_milestone_id: data.endMilestoneId,
          color_key: data.colorKey,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await phaseDefinitionAudit.created(supabase, data.displayName, insertedData.id)
      setPhases([...(phases || []), { ...insertedData, deleted_at: null }])
      setShowFormModal(false)
      showToast({ type: 'success', title: `"${data.displayName}" created` })
    } catch {
      showToast({ type: 'error', title: 'Failed to create phase' })
    } finally {
      setSaving(false)
    }
  }

  const applyEdit = async (phase: PhaseCardData, field: string, value: string) => {
    setSaving(true)
    try {
      const oldDisplayName = phase.display_name

      // parent_phase_id: empty string → null
      const resolvedValue = field === 'parent_phase_id' && !value ? null : value
      const updatePayload: Record<string, string | null> = { [field]: resolvedValue }

      const { error: updateError } = await supabase
        .from('phase_definitions')
        .update(updatePayload)
        .eq('id', phase.id)

      if (updateError) throw updateError

      if (field === 'display_name' && oldDisplayName !== value) {
        await phaseDefinitionAudit.updated(supabase, phase.id, oldDisplayName, value)
      }

      setPhases(
        (phases || []).map(p => p.id === phase.id ? { ...p, [field]: resolvedValue } : p)
      )
    } catch {
      showToast({ type: 'error', title: 'Failed to update phase' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (phase: PhaseCardData, field: string, value: string) => {
    // Boundary milestone changes need confirmation
    if (field === 'start_milestone_id' || field === 'end_milestone_id') {
      setConfirmModal({
        isOpen: true,
        title: 'Change Phase Boundary',
        message: (
          <div>
            <p>Changing this boundary will affect how phase durations are calculated for all cases.</p>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                Historical analytics will recalculate using the new boundary milestone.
              </p>
            </div>
          </div>
        ),
        confirmLabel: 'Change Boundary',
        confirmVariant: 'warning',
        onConfirm: async () => {
          await applyEdit(phase, field, value)
          closeConfirmModal()
        },
      })
      return
    }

    // Non-boundary edits: apply immediately
    applyEdit(phase, field, value)
  }

  const handleArchive = async (phase: PhaseCardData) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Phase',
      message: (
        <div>
          <p>Archive <strong>&ldquo;{phase.display_name}&rdquo;</strong>?</p>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              This phase will no longer appear in analytics or time allocation views.
              Existing case data is preserved.
            </p>
          </div>
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this phase from the archived section below.
          </p>
        </div>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        try {
          const { error: archiveError } = await supabase
            .from('phase_definitions')
            .update({
              deleted_at: new Date().toISOString(),
              is_active: false,
            })
            .eq('id', phase.id)

          if (archiveError) throw archiveError

          await phaseDefinitionAudit.deleted(supabase, phase.display_name, phase.id)

          setPhases((phases || []).map(p =>
            p.id === phase.id
              ? { ...p, deleted_at: new Date().toISOString(), is_active: false }
              : p
          ))
          showToast({ type: 'success', title: `"${phase.display_name}" archived` })
        } catch {
          showToast({ type: 'error', title: 'Failed to archive phase' })
        }

        closeConfirmModal()
        setSaving(false)
      },
    })
  }

  const handleRestore = async (phase: { id: string; display_name: string }) => {
    setSaving(true)
    try {
      const { error: restoreError } = await supabase
        .from('phase_definitions')
        .update({
          deleted_at: null,
          is_active: true,
        })
        .eq('id', phase.id)

      if (restoreError) throw restoreError

      await phaseDefinitionAudit.restored(supabase, phase.display_name, phase.id)

      setPhases((phases || []).map(p =>
        p.id === phase.id
          ? { ...p, deleted_at: null, is_active: true }
          : p
      ))
      showToast({ type: 'success', title: `"${phase.display_name}" restored` })
    } catch {
      showToast({ type: 'error', title: 'Failed to restore phase' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <ErrorBanner message={error} />

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Phases</h1>
        <Button onClick={() => setShowFormModal(true)}>
          <Plus className="w-4 h-4" />
          Add Phase
        </Button>
      </div>
      <p className="text-slate-500 mb-4">
        Define surgical phases as time spans between boundary milestones. Phases power time allocation analytics and cross-surgeon comparison.
      </p>

      {/* Info bar */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-slate-50 border-l-[3px] border-indigo-400 rounded-r-lg text-sm text-slate-600">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          Drag between phases to reorder. Drag onto a phase to nest it as a subphase. Use the parent dropdown or color swatch to configure.
        </span>
      </div>

      {/* Phase cards with tree rendering */}
      {loading ? (
        <SkeletonTable rows={4} columns={3} />
      ) : activePhases.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
          <p className="text-slate-500">No phases defined yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Phases are usually seeded automatically when a facility is created.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-2">
            {flatItems.map((item) => (
              <div key={item.phase.id} className={item.isChild ? 'mt-1.5' : ''}>
                <DraggablePhaseCard
                  item={item}
                  milestones={milestoneOptions}
                  activePhases={activePhases}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                  dropIntent={dropIntent}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragPhase ? <PhaseCardOverlay phase={activeDragPhase} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Archived phases section */}
      <ArchivedPhasesSection
        phases={archivedPhases}
        saving={saving}
        onRestore={handleRestore}
      />

      {/* Add Phase Modal */}
      <PhaseFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        milestones={milestoneOptions}
        saving={saving}
        onSubmit={handleAdd}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'danger' ? 'danger' : 'warning'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </>
  )
}
