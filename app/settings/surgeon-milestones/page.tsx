// app/settings/surgeon-milestones/page.tsx
'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useSurgeons, useProcedureTypes } from '@/hooks'
import { PageLoader } from '@/components/ui/Loading'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Info, RotateCcw, User, ClipboardList } from 'lucide-react'
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
import { PhaseSection } from '@/components/settings/procedure-milestones/PhaseSection'
import { SurgeonMilestoneRow } from '@/components/settings/surgeon-milestones/SurgeonMilestoneRow'

// ── Types ────────────────────────────────────────────

interface FacilityMilestoneWithPhase {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
  pair_with_id: string | null
  phase_group: string | null
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

interface ProcedureMilestoneConfigItem {
  id: string
  procedure_type_id: string
  facility_milestone_id: string
  display_order: number
  is_enabled: boolean
}

interface SurgeonMilestoneConfigItem {
  id: string
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  facility_milestone_id: string
  is_enabled: boolean
  display_order: number | null
}

interface PhaseInfo {
  name: string
  display_name: string
  display_order: number
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
}

// ── Page ────────────────────────────────────────────

export default function SurgeonMilestonesSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────

  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(effectiveFacilityId)
  const { data: procedureTypes, loading: proceduresLoading } = useProcedureTypes(effectiveFacilityId)

  const { data: milestones, loading: milestonesLoading } = useSupabaseQuery<FacilityMilestoneWithPhase[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_milestones')
        .select('id, name, display_name, display_order, pair_position, pair_with_id, phase_group')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const { data: phaseDefinitions, loading: phasesLoading } = useSupabaseQuery<PhaseDefinitionRow[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('phase_definitions')
        .select('id, name, display_name, display_order, color_key, start_milestone_id, end_milestone_id, is_active')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Procedure milestone configs (the "defaults")
  const { data: procedureConfigs, loading: procConfigsLoading } = useSupabaseQuery<ProcedureMilestoneConfigItem[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_milestone_config')
        .select('id, procedure_type_id, facility_milestone_id, display_order, is_enabled')
        .eq('facility_id', effectiveFacilityId!)
        .eq('procedure_type_id', selectedProcedure!)
      if (error) throw error
      return data || []
    },
    {
      deps: [effectiveFacilityId, selectedProcedure],
      enabled: !userLoading && !!effectiveFacilityId && !!selectedProcedure,
    }
  )

  // Surgeon milestone configs (the "overrides")
  const {
    data: surgeonConfigs,
    loading: surgeonConfigsLoading,
    refetch: refetchSurgeonConfigs,
    setData: setSurgeonConfigs,
  } = useSupabaseQuery<SurgeonMilestoneConfigItem[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('surgeon_milestone_config')
        .select('id, facility_id, surgeon_id, procedure_type_id, facility_milestone_id, is_enabled, display_order')
        .eq('facility_id', effectiveFacilityId!)
        .eq('surgeon_id', selectedSurgeon!)
        .eq('procedure_type_id', selectedProcedure!)
      if (error) throw error
      return data || []
    },
    {
      deps: [effectiveFacilityId, selectedSurgeon, selectedProcedure],
      enabled: !userLoading && !!effectiveFacilityId && !!selectedSurgeon && !!selectedProcedure,
    }
  )

  // ── Safe arrays (useSupabaseQuery returns null before first fetch) ──

  const safeConfigs = useMemo(() => surgeonConfigs ?? [], [surgeonConfigs])

  // ── Derived data ──────────────────────────────────

  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pd of phaseDefinitions || []) {
      ids.add(pd.start_milestone_id)
      ids.add(pd.end_milestone_id)
    }
    return ids
  }, [phaseDefinitions])

  const phases: PhaseInfo[] = useMemo(
    () => (phaseDefinitions || []).map(pd => ({
      name: pd.name,
      display_name: pd.display_name,
      display_order: pd.display_order,
      color_key: pd.color_key,
      start_milestone_id: pd.start_milestone_id,
      end_milestone_id: pd.end_milestone_id,
    })),
    [phaseDefinitions]
  )

  // Procedure default enabled set
  const procedureEnabledSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of procedureConfigs || []) {
      if (c.is_enabled) s.add(c.facility_milestone_id)
    }
    return s
  }, [procedureConfigs])

  // Config display_order lookup for ordering within phases
  const configOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    // Start with procedure config order
    for (const c of procedureConfigs || []) {
      map.set(c.facility_milestone_id, c.display_order)
    }
    // Surgeon overrides can have their own display_order
    for (const c of safeConfigs) {
      if (c.display_order !== null) {
        map.set(c.facility_milestone_id, c.display_order)
      }
    }
    return map
  }, [procedureConfigs, safeConfigs])

  // Surgeon override lookup
  const surgeonOverrideMap = useMemo(() => {
    const map = new Map<string, SurgeonMilestoneConfigItem>()
    for (const c of safeConfigs) {
      map.set(c.facility_milestone_id, c)
    }
    return map
  }, [safeConfigs])

  // Override count
  const overrideCount = safeConfigs.length

  // Visible milestones (hide pair_position='end')
  const visibleMilestones = useMemo(
    () => (milestones || []).filter(m => m.pair_position !== 'end'),
    [milestones]
  )

  // Phase groups (same logic as ProcedureMilestoneList)
  const phaseGroups = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => a.display_order - b.display_order)
    const groups: { phase: PhaseInfo; milestones: FacilityMilestoneWithPhase[] }[] = []
    const usedMilestoneIds = new Set<string>()

    for (const phase of sortedPhases) {
      const phaseMs = visibleMilestones
        .filter(m => m.phase_group === phase.name && !usedMilestoneIds.has(m.id))
        .sort((a, b) => {
          const aOrder = configOrderMap.get(a.id) ?? a.display_order
          const bOrder = configOrderMap.get(b.id) ?? b.display_order
          return aOrder - bOrder
        })
      phaseMs.forEach(m => usedMilestoneIds.add(m.id))
      if (phaseMs.length > 0) {
        groups.push({ phase, milestones: phaseMs })
      }
    }

    const unassigned = visibleMilestones.filter(m => !usedMilestoneIds.has(m.id))
    if (unassigned.length > 0) {
      groups.push({
        phase: {
          name: '_unassigned',
          display_name: 'Other',
          display_order: 999,
          color_key: 'slate',
          start_milestone_id: '',
          end_milestone_id: '',
        },
        milestones: unassigned,
      })
    }

    return groups
  }, [phases, visibleMilestones, configOrderMap])

  // ── Resolve milestone enabled state ───────────────

  const isMilestoneEnabled = useCallback((milestoneId: string): boolean => {
    if (boundaryMilestoneIds.has(milestoneId)) return true
    const override = surgeonOverrideMap.get(milestoneId)
    if (override) return override.is_enabled
    return procedureEnabledSet.has(milestoneId)
  }, [boundaryMilestoneIds, surgeonOverrideMap, procedureEnabledSet])

  const isProcedureDefault = useCallback((milestoneId: string): boolean => {
    return procedureEnabledSet.has(milestoneId)
  }, [procedureEnabledSet])

  const isOverride = useCallback((milestoneId: string): boolean => {
    return surgeonOverrideMap.has(milestoneId)
  }, [surgeonOverrideMap])

  // ── Saving state ──────────────────────────────────

  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const pendingOps = useRef<Set<string>>(new Set())

  const markSaving = useCallback((milestoneIds: string[]) => {
    setSavingKeys(prev => {
      const next = new Set(prev)
      milestoneIds.forEach(mid => next.add(mid))
      return next
    })
  }, [])

  const clearSaving = useCallback((milestoneIds: string[]) => {
    setSavingKeys(prev => {
      const next = new Set(prev)
      milestoneIds.forEach(mid => next.delete(mid))
      return next
    })
  }, [])

  // ── Toggle handler ────────────────────────────────

  const toggleMilestone = useCallback(async (milestoneId: string) => {
    if (!effectiveFacilityId || !selectedSurgeon || !selectedProcedure) return
    if (pendingOps.current.has(milestoneId)) return
    pendingOps.current.add(milestoneId)
    markSaving([milestoneId])

    const currentlyEnabled = isMilestoneEnabled(milestoneId)
    const procedureDefaultEnabled = isProcedureDefault(milestoneId)
    const existingOverride = surgeonOverrideMap.get(milestoneId)
    const newEnabled = !currentlyEnabled

    // If toggling back to match the procedure default, remove the override
    if (newEnabled === procedureDefaultEnabled && existingOverride) {
      // Optimistic: remove override
      setSurgeonConfigs(prev => (prev || []).filter(c => c.facility_milestone_id !== milestoneId))

      const { error } = await supabase
        .from('surgeon_milestone_config')
        .delete()
        .eq('id', existingOverride.id)

      if (error) {
        showToast({ type: 'error', title: 'Failed to remove override. Reverting.' })
        await refetchSurgeonConfigs()
      }
    } else if (existingOverride) {
      // Update existing override
      setSurgeonConfigs(prev =>
        (prev || []).map(c => c.facility_milestone_id === milestoneId ? { ...c, is_enabled: newEnabled } : c)
      )

      const { error } = await supabase
        .from('surgeon_milestone_config')
        .update({ is_enabled: newEnabled })
        .eq('id', existingOverride.id)

      if (error) {
        showToast({ type: 'error', title: 'Failed to update override. Reverting.' })
        await refetchSurgeonConfigs()
      }
    } else {
      // Create new override
      const optimistic: SurgeonMilestoneConfigItem = {
        id: `optimistic-${milestoneId}`,
        facility_id: effectiveFacilityId,
        surgeon_id: selectedSurgeon,
        procedure_type_id: selectedProcedure,
        facility_milestone_id: milestoneId,
        is_enabled: newEnabled,
        display_order: null,
      }
      setSurgeonConfigs(prev => [...(prev || []), optimistic])

      const { data, error } = await supabase
        .from('surgeon_milestone_config')
        .insert({
          facility_id: effectiveFacilityId,
          surgeon_id: selectedSurgeon,
          procedure_type_id: selectedProcedure,
          facility_milestone_id: milestoneId,
          is_enabled: newEnabled,
        })
        .select()
        .single()

      if (error || !data) {
        showToast({ type: 'error', title: 'Failed to create override. Reverting.' })
        await refetchSurgeonConfigs()
      } else {
        setSurgeonConfigs(prev => (prev || []).map(c =>
          c.id === `optimistic-${milestoneId}` ? data as SurgeonMilestoneConfigItem : c
        ))
      }
    }

    clearSaving([milestoneId])
    pendingOps.current.delete(milestoneId)
  }, [effectiveFacilityId, selectedSurgeon, selectedProcedure, isMilestoneEnabled, isProcedureDefault, surgeonOverrideMap, markSaving, clearSaving, supabase, showToast, refetchSurgeonConfigs, setSurgeonConfigs])

  // Handle paired milestone toggle (toggle both start + end)
  const togglePairedMilestone = useCallback((startMilestoneId: string) => {
    const startMs = (milestones || []).find(m => m.id === startMilestoneId)
    if (!startMs?.pair_with_id) {
      toggleMilestone(startMilestoneId)
      return
    }

    // Toggle both start and end milestones
    toggleMilestone(startMilestoneId)
    toggleMilestone(startMs.pair_with_id)
  }, [milestones, toggleMilestone])

  // ── Reorder handler ───────────────────────────────

  const handleReorder = useCallback(async (phaseGroup: string, orderedMilestoneIds: string[]) => {
    if (!effectiveFacilityId || !selectedSurgeon || !selectedProcedure) return

    // Optimistic: update display_order in surgeon configs (or create overrides for order)
    setSurgeonConfigs(prev => {
      const updated = [...(prev || [])]
      for (const [idx, milestoneId] of orderedMilestoneIds.entries()) {
        const existing = updated.find(c => c.facility_milestone_id === milestoneId)
        if (existing) {
          existing.display_order = idx + 1
        }
      }
      return updated
    })

    // Persist reorder — upsert display_order for each milestone
    try {
      for (const [idx, milestoneId] of orderedMilestoneIds.entries()) {
        const existing = safeConfigs.find(c => c.facility_milestone_id === milestoneId)
        if (existing && !existing.id.startsWith('optimistic-')) {
          await supabase
            .from('surgeon_milestone_config')
            .update({ display_order: idx + 1 })
            .eq('id', existing.id)
        } else {
          // Need to create an override row just for order
          const currentEnabled = isMilestoneEnabled(milestoneId)
          await supabase
            .from('surgeon_milestone_config')
            .upsert({
              facility_id: effectiveFacilityId,
              surgeon_id: selectedSurgeon,
              procedure_type_id: selectedProcedure,
              facility_milestone_id: milestoneId,
              is_enabled: currentEnabled,
              display_order: idx + 1,
            }, { onConflict: 'facility_id,surgeon_id,procedure_type_id,facility_milestone_id' })
        }
      }
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
      await refetchSurgeonConfigs()
    }
  }, [effectiveFacilityId, selectedSurgeon, selectedProcedure, safeConfigs, isMilestoneEnabled, supabase, showToast, refetchSurgeonConfigs, setSurgeonConfigs])

  // ── Reset to defaults ─────────────────────────────

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleReset = useCallback(async () => {
    if (!effectiveFacilityId || !selectedSurgeon || !selectedProcedure) return

    setResetting(true)
    // Optimistic: clear all overrides
    setSurgeonConfigs([])

    const { error } = await supabase
      .from('surgeon_milestone_config')
      .delete()
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeon)
      .eq('procedure_type_id', selectedProcedure)

    if (error) {
      showToast({ type: 'error', title: 'Failed to reset. Reverting.' })
      await refetchSurgeonConfigs()
    } else {
      showToast({ type: 'success', title: 'Reset to procedure defaults' })
    }

    setResetting(false)
    setShowResetConfirm(false)
  }, [effectiveFacilityId, selectedSurgeon, selectedProcedure, supabase, showToast, refetchSurgeonConfigs, setSurgeonConfigs])

  // ── DnD ───────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((phaseGroup: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const group = phaseGroups.find(g => g.phase.name === phaseGroup)
    if (!group) return

    const ids = group.milestones.map(m => m.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const newIds = [...ids]
    const [moved] = newIds.splice(oldIndex, 1)
    newIds.splice(newIndex, 0, moved)

    handleReorder(phaseGroup, newIds)
  }, [phaseGroups, handleReorder])

  // ── Collapsed phases ──────────────────────────────

  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())

  const togglePhaseCollapse = useCallback((phaseName: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseName)) {
        next.delete(phaseName)
      } else {
        next.add(phaseName)
      }
      return next
    })
  }, [])

  // ── Loading states ────────────────────────────────

  const baseLoading = userLoading || surgeonsLoading || proceduresLoading || milestonesLoading || phasesLoading
  const configLoading = procConfigsLoading || surgeonConfigsLoading
  const bothSelected = !!selectedSurgeon && !!selectedProcedure
  const isAnySaving = savingKeys.size > 0

  if (baseLoading) {
    return <PageLoader message="Loading surgeon milestones..." />
  }

  // ── Render ────────────────────────────────────────

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Surgeon Milestones</h1>
      <p className="text-slate-500 mb-6">
        Override which milestones are tracked per surgeon. Changes here only affect the selected surgeon&apos;s cases.
      </p>

      {/* Info bar */}
      <div className="mb-6 flex items-center gap-2 px-3 py-2 bg-slate-50 border-l-[3px] border-indigo-400 rounded-r-lg text-sm text-slate-600">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          Surgeon overrides take precedence over procedure defaults. Boundary milestones cannot be disabled.
        </span>
      </div>

      {/* Surgeon selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Surgeon</label>
          <select
            value={selectedSurgeon || ''}
            onChange={(e) => {
              setSelectedSurgeon(e.target.value || null)
              setSelectedProcedure(null)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a surgeon...</option>
            {surgeons.map(s => (
              <option key={s.id} value={s.id}>
                {s.last_name}, {s.first_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Type</label>
          <select
            value={selectedProcedure || ''}
            onChange={(e) => setSelectedProcedure(e.target.value || null)}
            disabled={!selectedSurgeon}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {selectedSurgeon ? 'Select a procedure type...' : 'Select a surgeon first'}
            </option>
            {procedureTypes.map(pt => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state when nothing selected */}
      {!bothSelected && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">
            {!selectedSurgeon
              ? 'Select a surgeon to configure their milestone overrides.'
              : 'Select a procedure type to view milestones.'}
          </p>
        </div>
      )}

      {/* Loading state for configs */}
      {bothSelected && configLoading && (
        <PageLoader message="Loading milestone configuration..." />
      )}

      {/* Milestone list */}
      {bothSelected && !configLoading && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Header with reset button + override count */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {surgeons.find(s => s.id === selectedSurgeon)?.last_name},{' '}
                  {surgeons.find(s => s.id === selectedSurgeon)?.first_name}
                  {' — '}
                  {procedureTypes.find(pt => pt.id === selectedProcedure)?.name}
                </h3>
                <span className="text-xs text-slate-500">
                  {overrideCount === 0
                    ? 'Using procedure defaults'
                    : `${overrideCount} override${overrideCount !== 1 ? 's' : ''} active`}
                </span>
              </div>
            </div>

            {overrideCount > 0 && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isAnySaving || resetting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Defaults
              </button>
            )}
          </div>

          {/* Phase-grouped milestone rows */}
          <div className="p-4 bg-slate-50">
            <p className="text-sm text-slate-600 mb-3">
              Milestones grouped by phase. Amber rows indicate surgeon-specific overrides.
            </p>

            {phaseGroups.map((group) => {
              const phaseName = group.phase.name
              const isExpanded = !collapsedPhases.has(phaseName)
              const enabledCount = group.milestones.filter(m =>
                isMilestoneEnabled(m.id)
              ).length

              return (
                <PhaseSection
                  key={phaseName}
                  phaseName={phaseName}
                  phaseDisplayName={group.phase.display_name}
                  colorKey={group.phase.color_key}
                  milestoneCount={group.milestones.length}
                  enabledCount={enabledCount}
                  isExpanded={isExpanded}
                  onToggle={() => togglePhaseCollapse(phaseName)}
                >
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd(phaseName)}
                  >
                    <SortableContext
                      items={group.milestones.map(m => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.milestones.map((milestone) => {
                        const isBoundary = boundaryMilestoneIds.has(milestone.id)
                        const enabled = isMilestoneEnabled(milestone.id)
                        const isPaired = milestone.pair_position === 'start' && !!milestone.pair_with_id
                        const hasOverride = isOverride(milestone.id)
                        const procDefault = isProcedureDefault(milestone.id)

                        return (
                          <SurgeonMilestoneRow
                            key={milestone.id}
                            id={milestone.id}
                            displayName={milestone.display_name}
                            isEnabled={enabled}
                            procedureDefault={procDefault}
                            isBoundary={isBoundary}
                            isPaired={isPaired}
                            isOverride={hasOverride}
                            isSaving={savingKeys.has(milestone.id)}
                            onToggle={() => {
                              if (isPaired) {
                                togglePairedMilestone(milestone.id)
                              } else {
                                toggleMilestone(milestone.id)
                              }
                            }}
                          />
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                </PhaseSection>
              )
            })}

            {phaseGroups.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p>No milestones configured for this procedure.</p>
                <p className="text-sm mt-1">Configure milestones in Procedure Milestones settings first.</p>
              </div>
            )}
          </div>

          {/* Footer with override count */}
          {overrideCount > 0 && (
            <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-sm text-amber-700">
              {overrideCount} override{overrideCount !== 1 ? 's' : ''} active for this surgeon + procedure combination
            </div>
          )}
        </div>
      )}

      {/* Reset confirmation dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        variant="warning"
        title="Reset to Procedure Defaults"
        message={
          <div>
            <p>Remove all surgeon-specific overrides for this procedure?</p>
            <p className="mt-2 text-sm text-slate-500">
              This will delete {overrideCount} override{overrideCount !== 1 ? 's' : ''} and
              revert to the procedure&apos;s default milestone configuration.
            </p>
          </div>
        }
        confirmText="Reset to Defaults"
        loading={resetting}
      />
    </>
  )
}
