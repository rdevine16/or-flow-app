// hooks/useAdminTemplateBuilder.ts
// Admin-level template builder hook. Queries global admin tables
// (milestone_template_types, milestone_template_type_items, milestone_types,
// phase_templates, procedure_type_templates) and maps them to the same
// UseTemplateBuilderReturn interface so TemplateBuilder renders identically.
'use client'

import { useReducer, useCallback, useMemo, useEffect, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'
import type { MilestoneTemplate } from '@/hooks/useTemplateBuilder'
import type { UseTemplateBuilderReturn } from '@/hooks/useTemplateBuilder'

// ─── Reducer (identical to facility version) ─────────────

interface BuilderState {
  items: TemplateItemData[]
}

type BuilderAction =
  | { type: 'SET_ITEMS'; items: TemplateItemData[] }
  | { type: 'ADD_ITEM'; item: TemplateItemData }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'BULK_REMOVE_BY_PHASE'; phaseId: string }
  | { type: 'REORDER_ITEMS'; items: TemplateItemData[] }
  | { type: 'MOVE_ITEM_WITHIN_PHASE'; phaseId: string; activeId: string; overId: string }

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
    case 'MOVE_ITEM_WITHIN_PHASE': {
      const phaseKey = action.phaseId === 'unassigned' ? null : action.phaseId
      const phaseItems = state.items
        .filter(i => (i.facility_phase_id ?? null) === phaseKey)
        .sort((a, b) => a.display_order - b.display_order)

      const oldIndex = phaseItems.findIndex(i => i.id === action.activeId)
      const newIndex = phaseItems.findIndex(i => i.id === action.overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state

      const reordered = arrayMove(phaseItems, oldIndex, newIndex)
      const orders = phaseItems.map(i => i.display_order)
      const updated = reordered.map((item, idx) => ({ ...item, display_order: orders[idx] }))

      const idSet = new Set(phaseItems.map(i => i.id))
      const otherItems = state.items.filter(i => !idSet.has(i.id))
      return { items: [...otherItems, ...updated].sort((a, b) => a.display_order - b.display_order) }
    }
    default:
      return state
  }
}

// ─── Hook ────────────────────────────────────────────────

export function useAdminTemplateBuilder(): UseTemplateBuilderReturn {
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [builderState, dispatch] = useReducer(builderReducer, { items: [] })
  const [emptyPhaseIds, setEmptyPhaseIds] = useState<Set<string>>(new Set())
  const [blockOrder, setBlockOrder] = useState<Record<string, string[]>>({})
  const [subPhaseMap, setSubPhaseMap] = useState<Record<string, string>>({})

  const enabled = !userLoading && !!isGlobalAdmin

  // ── Fetch templates (milestone_template_types) ───────────

  const {
    data: rawTemplates,
    loading: templatesLoading,
    error: templatesError,
    setData: setRawTemplates,
  } = useSupabaseQuery<MilestoneTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_types')
        .select('id, name, description, is_default, is_active, block_order, sub_phase_map')
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      // Map to MilestoneTemplate interface (admin has no facility_id / soft-delete columns)
      return (data || []).map(t => ({
        id: t.id as string,
        facility_id: '',
        name: t.name as string,
        description: (t.description as string | null) ?? null,
        is_default: t.is_default as boolean,
        is_active: t.is_active as boolean,
        deleted_at: null,
        deleted_by: null,
        block_order: (t.block_order as Record<string, string[]>) ?? {},
        sub_phase_map: (t.sub_phase_map as Record<string, string>) ?? {},
      }))
    },
    { deps: [], enabled },
  )

  const templates = rawTemplates

  // Auto-select default template on first load
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      const active = templates.filter(t => t.is_active)
      const def = active.find(t => t.is_default)
      setSelectedTemplateId(def?.id ?? active[0]?.id ?? null)
    }
  }, [templates, selectedTemplateId])

  // Sync blockOrder and subPhaseMap when selected template changes
  useEffect(() => {
    const tpl = (templates || []).find(t => t.id === selectedTemplateId)
    setBlockOrder(tpl?.block_order ?? {})
    setSubPhaseMap(tpl?.sub_phase_map ?? {})
  }, [selectedTemplateId, templates])

  // ── Fetch items (milestone_template_type_items) ──────────

  const {
    data: rawItems,
    loading: itemsLoading,
    error: itemsError,
  } = useSupabaseQuery<TemplateItemData[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_type_items')
        .select('id, template_type_id, milestone_type_id, phase_template_id, display_order')
        .eq('template_type_id', selectedTemplateId!)
        .order('display_order')
      if (error) throw error
      // Map admin column names → canonical TemplateItemData
      return (data || []).map(i => ({
        id: i.id as string,
        template_id: i.template_type_id as string,
        facility_milestone_id: i.milestone_type_id as string,
        facility_phase_id: (i.phase_template_id as string | null) ?? null,
        display_order: i.display_order as number,
      }))
    },
    { deps: [selectedTemplateId], enabled: !!selectedTemplateId },
  )

  useEffect(() => {
    if (rawItems) {
      dispatch({ type: 'SET_ITEMS', items: rawItems })
    }
  }, [rawItems])

  // ── Fetch milestones (milestone_types) ────────────────────

  const {
    data: milestones,
    loading: milestonesLoading,
    error: milestonesError,
  } = useSupabaseQuery<MilestoneLookup[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_types')
        .select('id, name, display_name, pair_with_id, pair_position')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order')
      if (error) throw error
      return (data || []).map(m => ({
        id: m.id as string,
        name: m.name as string,
        display_name: m.display_name as string,
        pair_with_id: (m.pair_with_id as string | null) ?? null,
        pair_position: (m.pair_position as 'start' | 'end' | null) ?? null,
      }))
    },
    { deps: [], enabled },
  )

  // ── Fetch phases (phase_templates) ────────────────────────

  const {
    data: phases,
    loading: phasesLoading,
    error: phasesError,
  } = useSupabaseQuery<PhaseLookup[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('phase_templates')
        .select('id, name, display_name, color_key, display_order, parent_phase_template_id')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      // Map parent_phase_template_id → parent_phase_id for canonical interface
      return (data || []).map(p => ({
        id: p.id as string,
        name: p.name as string,
        display_name: p.display_name as string,
        color_key: (p.color_key as string | null) ?? null,
        display_order: p.display_order as number,
        parent_phase_id: (p.parent_phase_template_id as string | null) ?? null,
      }))
    },
    { deps: [], enabled },
  )

  // ── Fetch procedure assignment counts ─────────────────────

  const {
    data: procedureCounts,
  } = useSupabaseQuery<Record<string, number>>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_type_templates')
        .select('milestone_template_type_id')
        .not('milestone_template_type_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const tid = row.milestone_template_type_id as string
        counts[tid] = (counts[tid] || 0) + 1
      }
      return counts
    },
    { deps: [], enabled },
  )

  // ── Derived data ─────────────────────────────────────────

  const activeTemplates = useMemo(
    () => (templates || []).filter(t => t.is_active),
    [templates],
  )

  const selectedTemplate = useMemo(
    () => activeTemplates.find(t => t.id === selectedTemplateId) ?? null,
    [activeTemplates, selectedTemplateId],
  )

  const assignedMilestoneIds = useMemo(
    () => new Set(builderState.items.map(i => i.facility_milestone_id)),
    [builderState.items],
  )

  const assignedPhaseIds = useMemo(() => {
    const fromItems = builderState.items.map(i => i.facility_phase_id).filter(Boolean) as string[]
    return new Set([...fromItems, ...emptyPhaseIds])
  }, [builderState.items, emptyPhaseIds])

  const availableMilestones = useMemo(
    () => (milestones || []).filter(m => !assignedMilestoneIds.has(m.id)),
    [milestones, assignedMilestoneIds],
  )

  const availablePhases = useMemo(
    () => (phases || []).filter(p => !assignedPhaseIds.has(p.id)),
    [phases, assignedPhaseIds],
  )

  // ── Template CRUD ────────────────────────────────────────

  const createTemplate = useCallback(async (name: string, description: string) => {
    setSaving(true)
    try {
      const { data: inserted, error } = await supabase
        .from('milestone_template_types')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          is_default: false,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      const newTemplate: MilestoneTemplate = {
        id: inserted.id,
        facility_id: '',
        name: inserted.name,
        description: inserted.description ?? null,
        is_default: inserted.is_default,
        is_active: inserted.is_active,
        deleted_at: null,
        deleted_by: null,
        block_order: {},
        sub_phase_map: {},
      }
      setRawTemplates([...(templates || []), newTemplate])
      setSelectedTemplateId(newTemplate.id)
      showToast({ type: 'success', title: `"${name}" created` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create template' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setRawTemplates, showToast])

  const duplicateTemplate = useCallback(async (sourceId: string) => {
    const source = (templates || []).find(t => t.id === sourceId)
    if (!source) return

    setSaving(true)
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('milestone_template_types')
        .insert({
          name: `${source.name} (Copy)`,
          description: source.description,
          is_default: false,
          is_active: true,
          block_order: source.block_order ?? {},
          sub_phase_map: source.sub_phase_map ?? {},
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // Copy items
      const { data: sourceItems, error: itemsErr } = await supabase
        .from('milestone_template_type_items')
        .select('milestone_type_id, phase_template_id, display_order')
        .eq('template_type_id', sourceId)
        .order('display_order')

      if (itemsErr) throw itemsErr

      if (sourceItems && sourceItems.length > 0) {
        const newItems = sourceItems.map(si => ({
          template_type_id: inserted.id,
          milestone_type_id: si.milestone_type_id,
          phase_template_id: si.phase_template_id,
          display_order: si.display_order,
        }))

        const { error: copyErr } = await supabase
          .from('milestone_template_type_items')
          .insert(newItems)

        if (copyErr) throw copyErr
      }

      const newTemplate: MilestoneTemplate = {
        id: inserted.id,
        facility_id: '',
        name: inserted.name,
        description: inserted.description ?? null,
        is_default: inserted.is_default,
        is_active: inserted.is_active,
        deleted_at: null,
        deleted_by: null,
        block_order: source.block_order ?? {},
        sub_phase_map: source.sub_phase_map ?? {},
      }
      setRawTemplates([...(templates || []), newTemplate])
      setSelectedTemplateId(newTemplate.id)
      showToast({ type: 'success', title: `"${newTemplate.name}" created` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to duplicate template' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setRawTemplates, showToast])

  const setDefaultTemplate = useCallback(async (templateId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('milestone_template_types')
        .update({ is_default: true })
        .eq('id', templateId)

      if (error) throw error

      setRawTemplates((templates || []).map(t => ({
        ...t,
        is_default: t.id === templateId,
      })))
      showToast({ type: 'success', title: 'Default template updated' })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to set default' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setRawTemplates, showToast])

  const archiveTemplate = useCallback(async (templateId: string): Promise<{ blocked: boolean; reason?: string }> => {
    const template = (templates || []).find(t => t.id === templateId)
    if (!template) return { blocked: true, reason: 'Template not found' }

    if (template.is_default) {
      return { blocked: true, reason: 'Set a different template as default before archiving this one.' }
    }

    const assignedCount = procedureCounts?.[templateId] ?? 0
    if (assignedCount > 0) {
      return {
        blocked: true,
        reason: `This template is assigned to ${assignedCount} procedure type${assignedCount !== 1 ? 's' : ''}. Reassign them before archiving.`,
      }
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('milestone_template_types')
        .update({ is_active: false })
        .eq('id', templateId)

      if (error) throw error

      setRawTemplates((templates || []).map(t =>
        t.id === templateId ? { ...t, is_active: false } : t,
      ))

      if (selectedTemplateId === templateId) {
        const remaining = (templates || []).filter(t => t.id !== templateId && t.is_active)
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
  }, [supabase, templates, setRawTemplates, selectedTemplateId, procedureCounts, showToast])

  const renameTemplate = useCallback(async (templateId: string, newName: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('milestone_template_types')
        .update({ name: newName.trim() })
        .eq('id', templateId)

      if (error) throw error

      setRawTemplates((templates || []).map(t =>
        t.id === templateId ? { ...t, name: newName.trim() } : t,
      ))
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to rename template' })
    } finally {
      setSaving(false)
    }
  }, [supabase, templates, setRawTemplates, showToast])

  // ── Item Mutations ───────────────────────────────────────

  const addMilestoneToPhase = useCallback(async (phaseId: string, milestoneId: string) => {
    if (!selectedTemplateId) return

    setEmptyPhaseIds(prev => {
      if (!prev.has(phaseId)) return prev
      const next = new Set(prev)
      next.delete(phaseId)
      return next
    })

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

    dispatch({ type: 'ADD_ITEM', item: optimisticItem })

    try {
      const { data: inserted, error } = await supabase
        .from('milestone_template_type_items')
        .insert({
          template_type_id: selectedTemplateId,
          milestone_type_id: milestoneId,
          phase_template_id: phaseId,
          display_order: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error

      // Map inserted row to canonical format and replace temp
      const realItem: TemplateItemData = {
        id: inserted.id,
        template_id: inserted.template_type_id,
        facility_milestone_id: inserted.milestone_type_id,
        facility_phase_id: inserted.phase_template_id ?? null,
        display_order: inserted.display_order,
      }

      dispatch({
        type: 'REORDER_ITEMS',
        items: builderState.items
          .filter(i => i.id !== tempId)
          .concat([realItem]),
      })
    } catch (err) {
      dispatch({ type: 'REMOVE_ITEM', itemId: tempId })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to add milestone' })
    }
  }, [selectedTemplateId, builderState.items, supabase, showToast])

  const removeMilestone = useCallback(async (itemId: string) => {
    const item = builderState.items.find(i => i.id === itemId)
    if (!item) return

    dispatch({ type: 'REMOVE_ITEM', itemId })

    try {
      const { error } = await supabase
        .from('milestone_template_type_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
    } catch (err) {
      dispatch({ type: 'ADD_ITEM', item })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to remove milestone' })
    }
  }, [builderState.items, supabase, showToast])

  const removePhaseFromTemplate = useCallback(async (phaseId: string) => {
    if (!selectedTemplateId) return
    const phaseItems = builderState.items.filter(i => i.facility_phase_id === phaseId)

    dispatch({ type: 'BULK_REMOVE_BY_PHASE', phaseId })

    try {
      if (phaseItems.length > 0) {
        const { error } = await supabase
          .from('milestone_template_type_items')
          .delete()
          .eq('template_type_id', selectedTemplateId)
          .eq('phase_template_id', phaseId)

        if (error) throw error
      }
    } catch (err) {
      dispatch({ type: 'SET_ITEMS', items: [...builderState.items, ...phaseItems] })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to remove phase' })
    }
  }, [selectedTemplateId, builderState.items, supabase, showToast])

  const reorderItemsInPhase = useCallback(async (phaseId: string, activeId: string, overId: string) => {
    const phaseKey = phaseId === 'unassigned' ? null : phaseId
    const phaseItems = builderState.items
      .filter(i => (i.facility_phase_id ?? null) === phaseKey)
      .sort((a, b) => a.display_order - b.display_order)

    const oldIndex = phaseItems.findIndex(i => i.id === activeId)
    const newIndex = phaseItems.findIndex(i => i.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    dispatch({ type: 'MOVE_ITEM_WITHIN_PHASE', phaseId, activeId, overId })

    const reordered = arrayMove(phaseItems, oldIndex, newIndex)
    const orders = phaseItems.map(i => i.display_order)

    try {
      const updates = reordered
        .map((item, idx) => ({ id: item.id, display_order: orders[idx] }))
        .filter((u, idx) => u.display_order !== phaseItems[idx].display_order)

      await Promise.all(
        updates.map(u =>
          supabase
            .from('milestone_template_type_items')
            .update({ display_order: u.display_order })
            .eq('id', u.id)
            .then(({ error }) => { if (error) throw error })
        ),
      )
    } catch (err) {
      dispatch({ type: 'SET_ITEMS', items: builderState.items })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to reorder' })
    }
  }, [builderState.items, supabase, showToast])

  const addPhaseToTemplate = useCallback((phaseId: string) => {
    setEmptyPhaseIds(prev => new Set([...prev, phaseId]))
  }, [])

  // ── Block Order Persistence ─────────────────────────────

  const updateBlockOrder = useCallback(async (
    parentPhaseId: string,
    orderedIds: string[],
  ) => {
    const prevBlockOrder = blockOrder
    const newBlockOrder = { ...blockOrder, [parentPhaseId]: orderedIds }
    setBlockOrder(newBlockOrder) // optimistic

    if (!selectedTemplateId) return
    try {
      const { error } = await supabase
        .from('milestone_template_types')
        .update({ block_order: newBlockOrder })
        .eq('id', selectedTemplateId)

      if (error) throw error
    } catch {
      setBlockOrder(prevBlockOrder) // revert
    }
  }, [blockOrder, selectedTemplateId, supabase])

  // ── Loading / Error ──────────────────────────────────────

  const loading = templatesLoading || milestonesLoading || phasesLoading
  const itemsLoadingState = itemsLoading
  const error = templatesError || itemsError || milestonesError || phasesError

  return {
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

    loading,
    itemsLoading: itemsLoadingState,
    error,
    saving,

    setSelectedTemplateId,
    createTemplate,
    duplicateTemplate,
    setDefaultTemplate,
    archiveTemplate,
    renameTemplate,

    addMilestoneToPhase,
    removeMilestone,
    removePhaseFromTemplate,
    reorderItemsInPhase,
    addPhaseToTemplate,
    nestPhaseAsSubPhase: async (childPhaseId: string, parentPhaseId: string) => {
      if (!selectedTemplateId) return
      const child = (phases || []).find(p => p.id === childPhaseId)
      const parent = (phases || []).find(p => p.id === parentPhaseId)
      if (!child || !parent || subPhaseMap[parentPhaseId]) return

      const prevMap = subPhaseMap
      const newMap = { ...subPhaseMap, [childPhaseId]: parentPhaseId }
      setSubPhaseMap(newMap)
      setEmptyPhaseIds(prev => new Set([...prev, childPhaseId]))

      try {
        const { error } = await supabase
          .from('milestone_template_types')
          .update({ sub_phase_map: newMap })
          .eq('id', selectedTemplateId)
        if (error) throw error
        showToast({ type: 'success', title: `"${child.display_name}" nested under "${parent.display_name}"` })
      } catch {
        setSubPhaseMap(prevMap)
        setEmptyPhaseIds(prev => { const next = new Set(prev); next.delete(childPhaseId); return next })
        showToast({ type: 'error', title: 'Failed to nest phase' })
      }
    },
    removeSubPhase: async (childPhaseId: string) => {
      if (!selectedTemplateId || !subPhaseMap[childPhaseId]) return
      const child = (phases || []).find(p => p.id === childPhaseId)

      const prevMap = subPhaseMap
      const newMap = { ...subPhaseMap }
      delete newMap[childPhaseId]
      setSubPhaseMap(newMap)
      setEmptyPhaseIds(prev => { const next = new Set(prev); next.delete(childPhaseId); return next })

      const spItems = builderState.items.filter(i => i.facility_phase_id === childPhaseId)
      if (spItems.length > 0) dispatch({ type: 'BULK_REMOVE_BY_PHASE', phaseId: childPhaseId })

      try {
        const { error } = await supabase
          .from('milestone_template_types')
          .update({ sub_phase_map: newMap })
          .eq('id', selectedTemplateId)
        if (error) throw error
        if (spItems.length > 0) {
          await supabase
            .from('milestone_template_type_items')
            .delete()
            .eq('template_type_id', selectedTemplateId)
            .eq('phase_template_id', childPhaseId)
        }
        showToast({ type: 'success', title: `"${child?.display_name}" removed as sub-phase` })
      } catch {
        setSubPhaseMap(prevMap)
        setEmptyPhaseIds(prev => new Set([...prev, childPhaseId]))
        if (spItems.length > 0) dispatch({ type: 'SET_ITEMS', items: [...builderState.items, ...spItems] })
        showToast({ type: 'error', title: 'Failed to remove sub-phase' })
      }
    },
    emptyPhaseIds,
    dispatch,

    blockOrder,
    updateBlockOrder,

    subPhaseMap,
  }
}
