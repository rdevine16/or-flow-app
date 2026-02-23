// hooks/useTemplateBuilder.ts
// Custom hook for the template builder: data fetching + useReducer + CRUD mutations.
// Bundles all queries for a selected template and provides optimistic mutation dispatch.
'use client'

import { useReducer, useCallback, useMemo, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'

// ─── Types ───────────────────────────────────────────────

export interface MilestoneTemplate {
  id: string
  facility_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
}

// ─── Reducer ─────────────────────────────────────────────

interface BuilderState {
  items: TemplateItemData[]
}

type BuilderAction =
  | { type: 'SET_ITEMS'; items: TemplateItemData[] }
  | { type: 'ADD_ITEM'; item: TemplateItemData }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'BULK_REMOVE_BY_PHASE'; phaseId: string }
  | { type: 'REORDER_ITEMS'; items: TemplateItemData[] }

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.items }
    case 'ADD_ITEM':
      return { items: [...state.items, action.item] }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => i.id !== action.itemId) }
    case 'BULK_REMOVE_BY_PHASE':
      return { items: state.items.filter(i => i.facility_phase_id !== action.phaseId) }
    case 'REORDER_ITEMS':
      return { items: action.items }
    default:
      return state
  }
}

// ─── Hook ────────────────────────────────────────────────

export function useTemplateBuilder() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [builderState, dispatch] = useReducer(builderReducer, { items: [] })

  // ── Fetch templates ─────────────────────────────────────

  const {
    data: templates,
    loading: templatesLoading,
    error: templatesError,
    setData: setTemplates,
  } = useSupabaseQuery<MilestoneTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_templates')
        .select('id, facility_id, name, description, is_default, is_active, deleted_at, deleted_by')
        .eq('facility_id', effectiveFacilityId!)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // Auto-select default template on first load
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      const activeTemplates = templates.filter(t => t.is_active && !t.deleted_at)
      const defaultTemplate = activeTemplates.find(t => t.is_default)
      setSelectedTemplateId(defaultTemplate?.id ?? activeTemplates[0]?.id ?? null)
    }
  }, [templates, selectedTemplateId])

  // ── Fetch items for selected template ───────────────────

  const {
    data: rawItems,
    loading: itemsLoading,
    error: itemsError,
  } = useSupabaseQuery<TemplateItemData[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_items')
        .select('id, template_id, facility_milestone_id, facility_phase_id, display_order')
        .eq('template_id', selectedTemplateId!)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [selectedTemplateId], enabled: !!selectedTemplateId },
  )

  // Sync fetched items into reducer
  useEffect(() => {
    if (rawItems) {
      dispatch({ type: 'SET_ITEMS', items: rawItems })
    }
  }, [rawItems])

  // ── Fetch milestones (for library panel) ─────────────────

  const {
    data: milestones,
    loading: milestonesLoading,
    error: milestonesError,
  } = useSupabaseQuery<MilestoneLookup[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_milestones')
        .select('id, name, display_name, pair_with_id, pair_position')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch phases (for library + builder) ─────────────────

  const {
    data: phases,
    loading: phasesLoading,
    error: phasesError,
  } = useSupabaseQuery<PhaseLookup[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_phases')
        .select('id, name, display_name, color_key, display_order, parent_phase_id')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch procedure assignment counts (for archive check) ─

  const {
    data: procedureCounts,
  } = useSupabaseQuery<Record<string, number>>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_types')
        .select('milestone_template_id')
        .eq('facility_id', effectiveFacilityId!)
        .not('milestone_template_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const tid = row.milestone_template_id as string
        counts[tid] = (counts[tid] || 0) + 1
      }
      return counts
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Derived data ────────────────────────────────────────

  const activeTemplates = useMemo(
    () => (templates || []).filter(t => t.is_active && !t.deleted_at),
    [templates],
  )

  const selectedTemplate = useMemo(
    () => activeTemplates.find(t => t.id === selectedTemplateId) ?? null,
    [activeTemplates, selectedTemplateId],
  )

  // Milestones already in the selected template (for library filtering)
  const assignedMilestoneIds = useMemo(
    () => new Set(builderState.items.map(i => i.facility_milestone_id)),
    [builderState.items],
  )

  // Phases already in the selected template
  const assignedPhaseIds = useMemo(
    () => new Set(builderState.items.map(i => i.facility_phase_id).filter(Boolean) as string[]),
    [builderState.items],
  )

  // Available milestones for library (not already in template)
  const availableMilestones = useMemo(
    () => (milestones || []).filter(m => !assignedMilestoneIds.has(m.id)),
    [milestones, assignedMilestoneIds],
  )

  // Available phases for library (not already in template)
  const availablePhases = useMemo(
    () => (phases || []).filter(p => !assignedPhaseIds.has(p.id)),
    [phases, assignedPhaseIds],
  )

  // ── Template CRUD ───────────────────────────────────────

  const createTemplate = useCallback(async (name: string, description: string) => {
    if (!effectiveFacilityId) return
    setSaving(true)
    try {
      const { data: inserted, error } = await supabase
        .from('milestone_templates')
        .insert({
          facility_id: effectiveFacilityId,
          name: name.trim(),
          description: description.trim() || null,
          is_default: false,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      const newTemplate = { ...inserted, deleted_at: null } as MilestoneTemplate
      setTemplates([...(templates || []), newTemplate])
      setSelectedTemplateId(newTemplate.id)
      showToast({ type: 'success', title: `"${name}" created` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create template' })
    } finally {
      setSaving(false)
    }
  }, [effectiveFacilityId, supabase, templates, setTemplates, showToast])

  const duplicateTemplate = useCallback(async (sourceId: string) => {
    if (!effectiveFacilityId) return
    const source = (templates || []).find(t => t.id === sourceId)
    if (!source) return

    setSaving(true)
    try {
      // Create copy
      const { data: inserted, error: insertErr } = await supabase
        .from('milestone_templates')
        .insert({
          facility_id: effectiveFacilityId,
          name: `${source.name} (Copy)`,
          description: source.description,
          is_default: false,
          is_active: true,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // Copy items
      const { data: sourceItems, error: itemsErr } = await supabase
        .from('milestone_template_items')
        .select('facility_milestone_id, facility_phase_id, display_order')
        .eq('template_id', sourceId)
        .order('display_order')

      if (itemsErr) throw itemsErr

      if (sourceItems && sourceItems.length > 0) {
        const newItems = sourceItems.map(si => ({
          template_id: inserted.id,
          facility_milestone_id: si.facility_milestone_id,
          facility_phase_id: si.facility_phase_id,
          display_order: si.display_order,
        }))

        const { error: copyErr } = await supabase
          .from('milestone_template_items')
          .insert(newItems)

        if (copyErr) throw copyErr
      }

      const newTemplate = { ...inserted, deleted_at: null } as MilestoneTemplate
      setTemplates([...(templates || []), newTemplate])
      setSelectedTemplateId(newTemplate.id)
      showToast({ type: 'success', title: `"${newTemplate.name}" created` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to duplicate template' })
    } finally {
      setSaving(false)
    }
  }, [effectiveFacilityId, supabase, templates, setTemplates, showToast])

  const setDefaultTemplate = useCallback(async (templateId: string) => {
    setSaving(true)
    try {
      // DB trigger handles clearing previous default
      const { error } = await supabase
        .from('milestone_templates')
        .update({ is_default: true })
        .eq('id', templateId)

      if (error) throw error

      setTemplates((templates || []).map(t => ({
        ...t,
        is_default: t.id === templateId,
      })))
      showToast({ type: 'success', title: 'Default template updated' })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to set default' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setTemplates, showToast])

  const archiveTemplate = useCallback(async (templateId: string): Promise<{ blocked: boolean; reason?: string }> => {
    const template = (templates || []).find(t => t.id === templateId)
    if (!template) return { blocked: true, reason: 'Template not found' }

    // Block: default template
    if (template.is_default) {
      return { blocked: true, reason: 'Set a different template as default before archiving this one.' }
    }

    // Block: assigned to procedures
    const assignedCount = procedureCounts?.[templateId] ?? 0
    if (assignedCount > 0) {
      return {
        blocked: true,
        reason: `This template is assigned to ${assignedCount} procedure${assignedCount !== 1 ? 's' : ''}. Reassign them before archiving.`,
      }
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('milestone_templates')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', templateId)

      if (error) throw error

      setTemplates((templates || []).map(t =>
        t.id === templateId
          ? { ...t, deleted_at: new Date().toISOString(), is_active: false }
          : t,
      ))

      // If archived the selected template, switch to default
      if (selectedTemplateId === templateId) {
        const remaining = (templates || []).filter(t => t.id !== templateId && t.is_active && !t.deleted_at)
        setSelectedTemplateId(remaining.find(t => t.is_default)?.id ?? remaining[0]?.id ?? null)
      }

      showToast({ type: 'success', title: `"${template.name}" archived` })
      return { blocked: false }
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive template' })
      return { blocked: true, reason: 'Database error' }
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setTemplates, selectedTemplateId, procedureCounts, showToast])

  const renameTemplate = useCallback(async (templateId: string, newName: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('milestone_templates')
        .update({ name: newName.trim() })
        .eq('id', templateId)

      if (error) throw error

      setTemplates((templates || []).map(t =>
        t.id === templateId ? { ...t, name: newName.trim() } : t,
      ))
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to rename template' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setTemplates, showToast])

  // ── Item Mutations ──────────────────────────────────────

  const addMilestoneToPhase = useCallback(async (phaseId: string, milestoneId: string) => {
    if (!selectedTemplateId) return

    // Compute next display_order for this phase
    const phaseItems = builderState.items.filter(i => i.facility_phase_id === phaseId)
    const maxOrder = phaseItems.length > 0
      ? Math.max(...phaseItems.map(i => i.display_order))
      : (builderState.items.length > 0 ? Math.max(...builderState.items.map(i => i.display_order)) : 0)

    const tempId = `temp-${Date.now()}`
    const optimisticItem: TemplateItemData = {
      id: tempId,
      template_id: selectedTemplateId,
      facility_milestone_id: milestoneId,
      facility_phase_id: phaseId,
      display_order: maxOrder + 1,
    }

    // Optimistic add
    dispatch({ type: 'ADD_ITEM', item: optimisticItem })

    try {
      const { data: inserted, error } = await supabase
        .from('milestone_template_items')
        .insert({
          template_id: selectedTemplateId,
          facility_milestone_id: milestoneId,
          facility_phase_id: phaseId,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error

      // Replace temp with real item
      dispatch({
        type: 'REORDER_ITEMS',
        items: builderState.items
          .filter(i => i.id !== tempId)
          .concat([{ ...inserted } as TemplateItemData]),
      })
    } catch (err) {
      // Revert
      dispatch({ type: 'REMOVE_ITEM', itemId: tempId })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to add milestone' })
    }
  }, [selectedTemplateId, builderState.items, supabase, showToast])

  const removeMilestone = useCallback(async (itemId: string) => {
    const item = builderState.items.find(i => i.id === itemId)
    if (!item) return

    // Optimistic remove
    dispatch({ type: 'REMOVE_ITEM', itemId })

    try {
      const { error } = await supabase
        .from('milestone_template_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
    } catch (err) {
      // Revert
      dispatch({ type: 'ADD_ITEM', item })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to remove milestone' })
    }
  }, [builderState.items, supabase, showToast])

  const removePhaseFromTemplate = useCallback(async (phaseId: string) => {
    if (!selectedTemplateId) return
    const phaseItems = builderState.items.filter(i => i.facility_phase_id === phaseId)

    // Optimistic remove
    dispatch({ type: 'BULK_REMOVE_BY_PHASE', phaseId })

    try {
      if (phaseItems.length > 0) {
        const { error } = await supabase
          .from('milestone_template_items')
          .delete()
          .eq('template_id', selectedTemplateId)
          .eq('facility_phase_id', phaseId)

        if (error) throw error
      }
    } catch (err) {
      // Revert
      dispatch({ type: 'SET_ITEMS', items: [...builderState.items, ...phaseItems] })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to remove phase' })
    }
  }, [selectedTemplateId, builderState.items, supabase, showToast])

  // ── Loading / Error ─────────────────────────────────────

  const loading = templatesLoading || milestonesLoading || phasesLoading
  const itemsLoadingState = itemsLoading
  const error = templatesError || itemsError || milestonesError || phasesError

  return {
    // Data
    templates: activeTemplates,
    selectedTemplate,
    selectedTemplateId,
    items: builderState.items,
    milestones: milestones || [],
    phases: phases || [],
    availableMilestones,
    availablePhases,
    assignedMilestoneIds,
    assignedPhaseIds,
    procedureCounts: procedureCounts || {},

    // State
    loading,
    itemsLoading: itemsLoadingState,
    error,
    saving,

    // Template actions
    setSelectedTemplateId,
    createTemplate,
    duplicateTemplate,
    setDefaultTemplate,
    archiveTemplate,
    renameTemplate,

    // Item actions
    addMilestoneToPhase,
    removeMilestone,
    removePhaseFromTemplate,
    dispatch,
  }
}
