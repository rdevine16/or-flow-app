// components/settings/phases/PhaseTemplateSection.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { phaseTemplateAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
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
import { PhaseTemplateCard, type PhaseTemplateCardData } from './PhaseTemplateCard'
import { PhaseTemplateFormModal, type PhaseTemplateFormData } from './PhaseTemplateFormModal'
import { ArchivedPhasesSection } from './ArchivedPhasesSection'
import { SkeletonTable } from '@/components/ui/Skeleton'

interface PhaseTemplate {
  id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_type_id: string
  end_milestone_type_id: string
  color_key: string | null
  is_active: boolean
}

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  is_active: boolean
}

export function PhaseTemplateSection() {
  const supabase = createClient()
  const { showToast } = useToast()

  // Fetch phase templates
  const { data: templates, loading, error, setData: setTemplates } = useSupabaseQuery<PhaseTemplate[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('phase_definition_templates')
        .select('id, name, display_name, display_order, start_milestone_type_id, end_milestone_type_id, color_key, is_active')
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [] }
  )

  // Fetch milestone types for dropdowns
  const { data: milestoneTypes } = useSupabaseQuery<MilestoneType[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('milestone_types')
        .select('id, name, display_name, display_order, is_active')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [] }
  )

  const [saving, setSaving] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)

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

  const activeTemplates = useMemo(
    () => (templates || []).filter(t => t.is_active).sort((a, b) => a.display_order - b.display_order),
    [templates]
  )

  const archivedTemplates = useMemo(
    () => (templates || []).filter(t => !t.is_active),
    [templates]
  )

  // Map archived templates to the shape ArchivedPhasesSection expects
  const archivedForSection = useMemo(
    () => archivedTemplates.map(t => ({
      id: t.id,
      display_name: t.display_name,
      color_key: t.color_key,
      deleted_at: null, // templates use is_active only, no deleted_at
    })),
    [archivedTemplates]
  )

  const milestoneTypeOptions = useMemo(
    () => (milestoneTypes || []).map(m => ({ id: m.id, display_name: m.display_name })),
    [milestoneTypes]
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

    const ids = activeTemplates.map(t => t.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const newIds = [...ids]
    const [moved] = newIds.splice(oldIndex, 1)
    newIds.splice(newIndex, 0, moved)

    // Optimistic update
    const updated = (templates || []).map(t => {
      const idx = newIds.indexOf(t.id)
      if (idx !== -1) return { ...t, display_order: idx + 1 }
      return t
    })
    setTemplates(updated)

    // Persist to DB
    try {
      for (const [idx, id] of newIds.entries()) {
        const { error: updateError } = await supabase
          .from('phase_definition_templates')
          .update({ display_order: idx + 1 })
          .eq('id', id)
        if (updateError) throw updateError
      }
      await phaseTemplateAudit.reordered(supabase, newIds.length)
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
    }
  }, [activeTemplates, templates, setTemplates, supabase, showToast])

  // ── CRUD Handlers ────────────────────────────────────────

  const handleAdd = async (data: PhaseTemplateFormData) => {
    setSaving(true)
    try {
      const maxOrder = activeTemplates.length > 0
        ? Math.max(...activeTemplates.map(t => t.display_order))
        : 0

      const { data: inserted, error: insertError } = await supabase
        .from('phase_definition_templates')
        .insert({
          name: data.internalName,
          display_name: data.displayName,
          display_order: maxOrder + 1,
          start_milestone_type_id: data.startMilestoneTypeId,
          end_milestone_type_id: data.endMilestoneTypeId,
          color_key: data.colorKey,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await phaseTemplateAudit.created(supabase, data.displayName, inserted.id)
      setTemplates([...(templates || []), inserted])
      setShowFormModal(false)
      showToast({ type: 'success', title: `"${data.displayName}" template created` })
    } catch {
      showToast({ type: 'error', title: 'Failed to create phase template' })
    } finally {
      setSaving(false)
    }
  }

  const applyEdit = async (template: PhaseTemplateCardData, field: string, value: string) => {
    setSaving(true)
    try {
      const oldDisplayName = template.display_name
      const updatePayload: Record<string, string> = { [field]: value }

      const { error: updateError } = await supabase
        .from('phase_definition_templates')
        .update(updatePayload)
        .eq('id', template.id)

      if (updateError) throw updateError

      if (field === 'display_name' && oldDisplayName !== value) {
        await phaseTemplateAudit.updated(supabase, template.id, oldDisplayName, value)
      }

      setTemplates(
        (templates || []).map(t => t.id === template.id ? { ...t, [field]: value } : t)
      )
    } catch {
      showToast({ type: 'error', title: 'Failed to update phase template' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (template: PhaseTemplateCardData, field: string, value: string) => {
    // Boundary changes need confirmation (affects new facility seeding)
    if (field === 'start_milestone_type_id' || field === 'end_milestone_type_id') {
      setConfirmModal({
        isOpen: true,
        title: 'Change Template Boundary',
        message: (
          <div>
            <p>Changing this boundary will affect the default phases seeded for new facilities.</p>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                Existing facilities are not affected. Only new facilities created after this change will use the updated boundary.
              </p>
            </div>
          </div>
        ),
        confirmLabel: 'Change Boundary',
        confirmVariant: 'info',
        onConfirm: async () => {
          await applyEdit(template, field, value)
          closeConfirmModal()
        },
      })
      return
    }

    applyEdit(template, field, value)
  }

  const handleArchive = (template: PhaseTemplateCardData) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Phase Template',
      message: (
        <div>
          <p>Archive <strong>&ldquo;{template.display_name}&rdquo;</strong>?</p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              New facilities will no longer receive this phase.
              Existing facilities are not affected.
            </p>
          </div>
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this template from the archived section below.
          </p>
        </div>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        try {
          const { error: archiveError } = await supabase
            .from('phase_definition_templates')
            .update({ is_active: false })
            .eq('id', template.id)

          if (archiveError) throw archiveError

          await phaseTemplateAudit.deleted(supabase, template.display_name, template.id)

          setTemplates((templates || []).map(t =>
            t.id === template.id ? { ...t, is_active: false } : t
          ))
          showToast({ type: 'success', title: `"${template.display_name}" archived` })
        } catch {
          showToast({ type: 'error', title: 'Failed to archive template' })
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
        .from('phase_definition_templates')
        .update({ is_active: true })
        .eq('id', phase.id)

      if (restoreError) throw restoreError

      await phaseTemplateAudit.restored(supabase, phase.display_name, phase.id)

      setTemplates((templates || []).map(t =>
        t.id === phase.id ? { ...t, is_active: true } : t
      ))
      showToast({ type: 'success', title: `"${phase.display_name}" restored` })
    } catch {
      showToast({ type: 'error', title: 'Failed to restore template' })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Phase Templates</h1>
          <p className="text-slate-500 mt-1">
            Define default surgical phases seeded to new facilities. Drag to reorder.
          </p>
        </div>
        <button
          onClick={() => setShowFormModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Changes apply to new facilities only. Existing facilities manage their own phases independently.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Template cards with DnD */}
      {loading ? (
        <SkeletonTable rows={4} columns={3} />
      ) : activeTemplates.length === 0 ? (
        <div className="text-center py-8 bg-white border border-slate-200 rounded-xl">
          <p className="text-slate-500">No active phase templates.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeTemplates.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {activeTemplates.map((template) => (
                <PhaseTemplateCard
                  key={template.id}
                  template={template}
                  milestoneTypes={milestoneTypeOptions}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Archived templates */}
      <ArchivedPhasesSection
        phases={archivedForSection}
        saving={saving}
        onRestore={handleRestore}
      />

      {/* Add Template Modal */}
      <PhaseTemplateFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        milestoneTypes={milestoneTypeOptions}
        saving={saving}
        onSubmit={handleAdd}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'danger' ? 'danger' : 'info'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </div>
  )
}
