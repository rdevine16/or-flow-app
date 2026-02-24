// hooks/useTemplateBuilder.ts
// Custom hook for the template builder: data fetching + useReducer + CRUD mutations.
// Bundles all queries for a selected template and provides optimistic mutation dispatch.
'use client'

import { useReducer, useCallback, useMemo, useEffect, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'
import {
  REQUIRED_PHASE_NAMES,
  REQUIRED_PHASE_MILESTONES,
  isRequiredMilestone,
  isRequiredPhase,
} from '@/lib/template-defaults'

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
  block_order: Record<string, string[]>
  sub_phase_map: Record<string, string>
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

export function useTemplateBuilder() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [builderState, dispatch] = useReducer(builderReducer, { items: [] })
  const [emptyPhaseIds, setEmptyPhaseIds] = useState<Set<string>>(new Set())
  const [blockOrder, setBlockOrder] = useState<Record<string, string[]>>({})
  const [subPhaseMap, setSubPhaseMap] = useState<Record<string, string>>({})

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
        .select('id, facility_id, name, description, is_default, is_active, deleted_at, deleted_by, block_order, sub_phase_map')
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

  // Sync blockOrder and subPhaseMap when selected template changes
  useEffect(() => {
    const tpl = (templates || []).find(t => t.id === selectedTemplateId)
    setBlockOrder(tpl?.block_order ?? {})
    setSubPhaseMap(tpl?.sub_phase_map ?? {})
  }, [selectedTemplateId, templates])

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

  // Phases already in the selected template (from items + explicitly added empty phases)
  const assignedPhaseIds = useMemo(() => {
    const fromItems = builderState.items.map(i => i.facility_phase_id).filter(Boolean) as string[]
    return new Set([...fromItems, ...emptyPhaseIds])
  }, [builderState.items, emptyPhaseIds])

  // All milestones for library — includes already-assigned ones so users can
  // add the same milestone to multiple phases (creating shared boundaries).
  const availableMilestones = useMemo(
    () => milestones || [],
    [milestones],
  )

  // Available phases for library (not already in template)
  const availablePhases = useMemo(
    () => (phases || []).filter(p => !assignedPhaseIds.has(p.id)),
    [phases, assignedPhaseIds],
  )

  // ── Required milestone/phase enforcement ──────────────
  // Build lookup maps: milestone ID → name, phase ID → name
  const milestoneNameById = useMemo(
    () => new Map((milestones || []).map(m => [m.id, m.name])),
    [milestones],
  )
  const phaseNameById = useMemo(
    () => new Map((phases || []).map(p => [p.id, p.name])),
    [phases],
  )

  // Determine if the current template has the full required structure.
  // If it does → enforce. If it doesn't → grandfathered (no enforcement).
  const templateHasRequiredStructure = useMemo(() => {
    if (builderState.items.length === 0) return false
    // Check every required placement: for each phase, every milestone must be present
    for (const [phaseName, msNames] of Object.entries(REQUIRED_PHASE_MILESTONES)) {
      const phaseEntry = (phases || []).find(p => p.name === phaseName)
      if (!phaseEntry) return false
      for (const msName of msNames) {
        const msEntry = (milestones || []).find(m => m.name === msName)
        if (!msEntry) return false
        const exists = builderState.items.some(
          i => i.facility_milestone_id === msEntry.id && i.facility_phase_id === phaseEntry.id,
        )
        if (!exists) return false
      }
    }
    return true
  }, [builderState.items, phases, milestones])

  // Sets of item IDs and phase IDs that are required (for UI to disable delete buttons)
  const requiredMilestoneItemIds = useMemo(() => {
    if (!templateHasRequiredStructure) return new Set<string>()
    const ids = new Set<string>()
    for (const item of builderState.items) {
      const msName = milestoneNameById.get(item.facility_milestone_id)
      const phaseName = item.facility_phase_id ? phaseNameById.get(item.facility_phase_id) : null
      if (msName && phaseName && isRequiredMilestone(msName) && isRequiredPhase(phaseName)) {
        // Check this specific milestone-in-phase is a required placement
        const requiredMs = REQUIRED_PHASE_MILESTONES[phaseName]
        if (requiredMs?.includes(msName)) {
          ids.add(item.id)
        }
      }
    }
    return ids
  }, [templateHasRequiredStructure, builderState.items, milestoneNameById, phaseNameById])

  const requiredPhaseIds = useMemo(() => {
    if (!templateHasRequiredStructure) return new Set<string>()
    const ids = new Set<string>()
    for (const phase of (phases || [])) {
      if (isRequiredPhase(phase.name)) {
        ids.add(phase.id)
      }
    }
    return ids
  }, [templateHasRequiredStructure, phases])

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

      // Auto-populate required phases + milestones
      const phaseLookup = phases || []
      const milestoneLookup = milestones || []
      const phaseByName = new Map(phaseLookup.map(p => [p.name, p]))
      const milestoneByName = new Map(milestoneLookup.map(m => [m.name, m]))

      const requiredItems: Array<{
        template_id: string
        facility_milestone_id: string
        facility_phase_id: string
        display_order: number
      }> = []
      const requiredEmptyPhaseIds = new Set<string>()
      let displayOrder = 0

      for (const phaseName of REQUIRED_PHASE_NAMES) {
        const phase = phaseByName.get(phaseName)
        if (!phase) continue

        requiredEmptyPhaseIds.add(phase.id)
        const milestonesForPhase = REQUIRED_PHASE_MILESTONES[phaseName] || []

        for (const msName of milestonesForPhase) {
          const ms = milestoneByName.get(msName)
          if (!ms) continue

          displayOrder += 1
          requiredItems.push({
            template_id: inserted.id,
            facility_milestone_id: ms.id,
            facility_phase_id: phase.id,
            display_order: displayOrder,
          })
        }
      }

      let insertedItems: TemplateItemData[] = []
      if (requiredItems.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('milestone_template_items')
          .insert(requiredItems)
          .select('id, template_id, facility_milestone_id, facility_phase_id, display_order')

        if (itemsError) throw itemsError
        insertedItems = (itemsData || []) as TemplateItemData[]
      }

      const newTemplate = { ...inserted, deleted_at: null } as MilestoneTemplate
      setTemplates([...(templates || []), newTemplate])
      setSelectedTemplateId(newTemplate.id)

      // Update optimistic state with the inserted items + empty phases
      if (insertedItems.length > 0) {
        dispatch({ type: 'SET_ITEMS', items: insertedItems })
      }
      // Track phases that may have items (still add to emptyPhaseIds — they'll
      // be cleaned up automatically when items exist)
      setEmptyPhaseIds(requiredEmptyPhaseIds)

      showToast({ type: 'success', title: `"${name}" created` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to create template' })
    } finally {
      setSaving(false)
    }
  }, [effectiveFacilityId, supabase, templates, setTemplates, showToast, phases, milestones])

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
          block_order: source.block_order ?? {},
          sub_phase_map: source.sub_phase_map ?? {},
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

    // Clear from empty phases if present
    setEmptyPhaseIds(prev => {
      if (!prev.has(phaseId)) return prev
      const next = new Set(prev)
      next.delete(phaseId)
      return next
    })

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

    // Block removal of required milestones on templates with required structure
    if (requiredMilestoneItemIds.has(itemId)) {
      showToast({ type: 'error', title: 'This milestone is required and cannot be removed' })
      return
    }

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
  }, [builderState.items, supabase, showToast, requiredMilestoneItemIds])

  const removePhaseFromTemplate = useCallback(async (phaseId: string) => {
    if (!selectedTemplateId) return

    // Block removal of required phases on templates with required structure
    if (requiredPhaseIds.has(phaseId)) {
      showToast({ type: 'error', title: 'This phase is required and cannot be removed' })
      return
    }

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
  }, [selectedTemplateId, builderState.items, supabase, showToast, requiredPhaseIds])

  // ── Reorder within phase ───────────────────────────────

  const reorderItemsInPhase = useCallback(async (phaseId: string, activeId: string, overId: string) => {
    const phaseKey = phaseId === 'unassigned' ? null : phaseId
    const phaseItems = builderState.items
      .filter(i => (i.facility_phase_id ?? null) === phaseKey)
      .sort((a, b) => a.display_order - b.display_order)

    const oldIndex = phaseItems.findIndex(i => i.id === activeId)
    const newIndex = phaseItems.findIndex(i => i.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // Optimistic update
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
            .from('milestone_template_items')
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

  // ── Add empty phase to template ───────────────────────

  const addPhaseToTemplate = useCallback((phaseId: string) => {
    setEmptyPhaseIds(prev => new Set([...prev, phaseId]))
  }, [])

  // Clear empty phase when a milestone is added to it (handled by addMilestoneToPhase internally)

  // ── Nest phase as sub-phase (template-specific) ─────────

  const nestPhaseAsSubPhase = useCallback(async (childPhaseId: string, parentPhaseId: string) => {
    if (!selectedTemplateId) return
    const child = (phases || []).find(p => p.id === childPhaseId)
    if (!child) return

    // Prevent nesting under itself or under a phase that is already a sub-phase in this template
    const parent = (phases || []).find(p => p.id === parentPhaseId)
    if (!parent || subPhaseMap[parentPhaseId]) return

    // Optimistic: update sub_phase_map and add to empty phases so it renders
    const prevMap = subPhaseMap
    const newMap = { ...subPhaseMap, [childPhaseId]: parentPhaseId }
    setSubPhaseMap(newMap)
    setEmptyPhaseIds(prev => new Set([...prev, childPhaseId]))

    try {
      const { error } = await supabase
        .from('milestone_templates')
        .update({ sub_phase_map: newMap })
        .eq('id', selectedTemplateId)

      if (error) throw error
      showToast({ type: 'success', title: `"${child.display_name}" nested under "${parent.display_name}"` })
    } catch (err) {
      // Revert
      setSubPhaseMap(prevMap)
      setEmptyPhaseIds(prev => {
        const next = new Set(prev)
        next.delete(childPhaseId)
        return next
      })
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to nest phase' })
    }
  }, [phases, subPhaseMap, selectedTemplateId, supabase, showToast])

  // ── Remove sub-phase (un-nest, template-specific) ──────────

  const removeSubPhase = useCallback(async (childPhaseId: string) => {
    if (!selectedTemplateId) return
    const child = (phases || []).find(p => p.id === childPhaseId)
    if (!child || !subPhaseMap[childPhaseId]) return

    const prevMap = subPhaseMap

    // Optimistic: remove from sub_phase_map and emptyPhaseIds
    const newMap = { ...subPhaseMap }
    delete newMap[childPhaseId]
    setSubPhaseMap(newMap)
    setEmptyPhaseIds(prev => {
      const next = new Set(prev)
      next.delete(childPhaseId)
      return next
    })

    // Also remove any template items belonging to this sub-phase
    const subPhaseItems = builderState.items.filter(i => i.facility_phase_id === childPhaseId)
    if (subPhaseItems.length > 0) {
      dispatch({ type: 'BULK_REMOVE_BY_PHASE', phaseId: childPhaseId })
    }

    try {
      const { error } = await supabase
        .from('milestone_templates')
        .update({ sub_phase_map: newMap })
        .eq('id', selectedTemplateId)

      if (error) throw error

      // Also delete template items for this sub-phase from DB
      if (subPhaseItems.length > 0) {
        await supabase
          .from('milestone_template_items')
          .delete()
          .eq('template_id', selectedTemplateId)
          .eq('facility_phase_id', childPhaseId)
      }

      showToast({ type: 'success', title: `"${child.display_name}" removed as sub-phase` })
    } catch (err) {
      // Revert
      setSubPhaseMap(prevMap)
      setEmptyPhaseIds(prev => new Set([...prev, childPhaseId]))
      if (subPhaseItems.length > 0) {
        dispatch({ type: 'SET_ITEMS', items: [...builderState.items, ...subPhaseItems] })
      }
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to remove sub-phase' })
    }
  }, [phases, subPhaseMap, selectedTemplateId, supabase, showToast, builderState.items])

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
        .from('milestone_templates')
        .update({ block_order: newBlockOrder })
        .eq('id', selectedTemplateId)

      if (error) throw error
    } catch {
      setBlockOrder(prevBlockOrder) // revert
    }
  }, [blockOrder, selectedTemplateId, supabase])

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
    reorderItemsInPhase,
    addPhaseToTemplate,
    nestPhaseAsSubPhase,
    removeSubPhase,
    emptyPhaseIds,
    dispatch,

    // Block ordering
    blockOrder,
    updateBlockOrder,

    // Sub-phase nesting (template-specific)
    subPhaseMap,

    // Required milestone/phase enforcement
    requiredMilestoneItemIds,
    requiredPhaseIds,
  }
}

/** Exported return type so TemplateBuilder can accept it as a prop. */
export type UseTemplateBuilderReturn = ReturnType<typeof useTemplateBuilder>
