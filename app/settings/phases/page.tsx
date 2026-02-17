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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PhaseCard, type PhaseCardData } from '@/components/settings/phases/PhaseCard'
import { PhaseFormModal, type PhaseFormData } from '@/components/settings/phases/PhaseFormModal'
import { ArchivedPhasesSection } from '@/components/settings/phases/ArchivedPhasesSection'
import { SkeletonTable } from '@/components/ui/Skeleton'

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

  const milestoneOptions = useMemo(
    () => (milestones || []).map(m => ({ id: m.id, display_name: m.display_name })),
    [milestones]
  )

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // ── DnD Setup ────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = activePhases.map(p => p.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    // Compute new order
    const newIds = [...ids]
    const [moved] = newIds.splice(oldIndex, 1)
    newIds.splice(newIndex, 0, moved)

    // Optimistic update
    const updated = (phases || []).map(p => {
      const idx = newIds.indexOf(p.id)
      if (idx !== -1) return { ...p, display_order: idx + 1 }
      return p
    })
    setPhases(updated)

    // Persist to DB
    try {
      for (const [idx, id] of newIds.entries()) {
        const { error: updateError } = await supabase
          .from('phase_definitions')
          .update({ display_order: idx + 1 })
          .eq('id', id)
        if (updateError) throw updateError
      }
      await phaseDefinitionAudit.reordered(supabase, newIds.length)
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
    }
  }, [activePhases, phases, setPhases, supabase, showToast])

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
      const updatePayload: Record<string, string> = { [field]: value }

      const { error: updateError } = await supabase
        .from('phase_definitions')
        .update(updatePayload)
        .eq('id', phase.id)

      if (updateError) throw updateError

      if (field === 'display_name' && oldDisplayName !== value) {
        await phaseDefinitionAudit.updated(supabase, phase.id, oldDisplayName, value)
      }

      setPhases(
        (phases || []).map(p => p.id === phase.id ? { ...p, [field]: value } : p)
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
          Each phase is defined by a start and end milestone. Drag to reorder. Hover color swatch to change phase color.
        </span>
      </div>

      {/* Phase cards with DnD */}
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
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activePhases.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {activePhases.map((phase) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  milestones={milestoneOptions}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          </SortableContext>
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
