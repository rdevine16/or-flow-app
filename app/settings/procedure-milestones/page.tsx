// app/settings/procedure-milestones/page.tsx
'use client'

import { useState, useCallback, useMemo, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useSurgeons } from '@/hooks'
import { Skeleton } from '@/components/ui/Skeleton'
import { Search, User, Undo2 } from 'lucide-react'
import { PhaseBlock, type PhaseBlockMilestone } from '@/components/settings/milestones/PhaseBlock'
import { BoundaryMarker } from '@/components/settings/milestones/BoundaryMarker'
import { InheritanceBreadcrumb } from '@/components/settings/milestones/InheritanceBreadcrumb'
import {
  PairBracketOverlay,
  computeBracketData,
  computeBracketAreaWidth,
} from '@/components/settings/milestones/PairBracketOverlay'
import { detectPairIssues, countPairIssuesInPhase } from '@/lib/utils/pairIssues'
import { resolveColorKey } from '@/lib/milestone-phase-config'

// ── Types ────────────────────────────────────────────

interface ProcedureType {
  id: string
  name: string
}

interface FacilityMilestone {
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
  parent_phase_id: string | null
}

interface ProcedureMilestoneConfigItem {
  id: string
  procedure_type_id: string
  facility_milestone_id: string
  display_order: number
  is_enabled: boolean
}

interface SurgeonConfigSummary {
  surgeon_id: string
  procedure_type_id: string
}

type FilterTab = 'all' | 'customized' | 'default' | 'surgeon-overrides'

// ── Page ────────────────────────────────────────────

export default function ProcedureMilestonesSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // ── UI State ──────────────────────────────────────
  const [selectedProcId, setSelectedProcId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const pendingOps = useRef<Set<string>>(new Set())

  // ── Data Fetching ────────────────────────────────

  const { data: procedures, loading: proceduresLoading } = useSupabaseQuery<ProcedureType[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_types')
        .select('id, name')
        .eq('facility_id', effectiveFacilityId!)
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const { data: milestones, loading: milestonesLoading } = useSupabaseQuery<FacilityMilestone[]>(
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
        .select('id, name, display_name, display_order, color_key, start_milestone_id, end_milestone_id, is_active, parent_phase_id')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const {
    data: allConfigs,
    loading: configsLoading,
    setData: setConfigs,
    refetch: refetchConfigs,
  } = useSupabaseQuery<ProcedureMilestoneConfigItem[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_milestone_config')
        .select('id, procedure_type_id, facility_milestone_id, display_order, is_enabled')
        .eq('facility_id', effectiveFacilityId!)
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Surgeon override summary: which surgeons override which procedures
  const { data: surgeonConfigSummary, loading: surgeonConfigsLoading } =
    useSupabaseQuery<SurgeonConfigSummary[]>(
      async (sb) => {
        const { data, error } = await sb
          .from('surgeon_milestone_config')
          .select('surgeon_id, procedure_type_id')
          .eq('facility_id', effectiveFacilityId!)
        if (error) throw error
        // Deduplicate: one entry per surgeon+procedure
        const seen = new Set<string>()
        const result: SurgeonConfigSummary[] = []
        for (const row of data || []) {
          const key = `${row.surgeon_id}:${row.procedure_type_id}`
          if (!seen.has(key)) {
            seen.add(key)
            result.push({ surgeon_id: row.surgeon_id, procedure_type_id: row.procedure_type_id })
          }
        }
        return result
      },
      { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
    )

  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(effectiveFacilityId)

  const loading =
    proceduresLoading || milestonesLoading || phasesLoading || configsLoading || surgeonConfigsLoading || surgeonsLoading

  // ── Derived Data ──────────────────────────────────

  const safeMilestones = milestones || []
  const safeConfigs = allConfigs || []
  const safeProcs = procedures || []
  const safeSurgeonSummary = surgeonConfigSummary || []
  const safeSurgeons = surgeons || []

  // Boundary milestone IDs
  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pd of phaseDefinitions || []) {
      ids.add(pd.start_milestone_id)
      ids.add(pd.end_milestone_id)
    }
    return ids
  }, [phaseDefinitions])

  // Non-boundary active milestones
  const optionalMilestones = useMemo(
    () => safeMilestones.filter((m) => !boundaryMilestoneIds.has(m.id)),
    [safeMilestones, boundaryMilestoneIds]
  )

  // Pair group map (both milestones in a pair share the START milestone's ID)
  const pairGroupMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of safeMilestones) {
      if (!m.pair_with_id || !m.pair_position) continue
      if (m.pair_position === 'start') map.set(m.id, m.id)
      else if (m.pair_position === 'end') map.set(m.id, m.pair_with_id)
    }
    return map
  }, [safeMilestones])

  // Milestone lookup
  const milestoneById = useMemo(() => {
    const map = new Map<string, FacilityMilestone>()
    for (const m of safeMilestones) map.set(m.id, m)
    return map
  }, [safeMilestones])

  // Pair issue detection
  const pairIssueMilestones = useMemo(
    () =>
      safeMilestones.map((m) => ({
        id: m.id,
        phase_group: m.phase_group,
        pair_with_id: m.pair_with_id,
        pair_position: m.pair_position,
        pair_group: pairGroupMap.get(m.id) || null,
      })),
    [safeMilestones, pairGroupMap]
  )
  const pairIssues = useMemo(() => detectPairIssues(pairIssueMilestones), [pairIssueMilestones])

  // ── Per-procedure computed data ────────────────────

  // Config rows per procedure
  const configsByProc = useMemo(() => {
    const map = new Map<string, ProcedureMilestoneConfigItem[]>()
    for (const c of safeConfigs) {
      const existing = map.get(c.procedure_type_id) || []
      existing.push(c)
      map.set(c.procedure_type_id, existing)
    }
    return map
  }, [safeConfigs])

  // Whether a procedure has been customized (has any config rows)
  const procIsCustomized = useCallback(
    (procId: string): boolean => {
      return (configsByProc.get(procId)?.length ?? 0) > 0
    },
    [configsByProc]
  )

  // Count overrides (milestones that differ from facility default = all enabled)
  const procOverrideCount = useCallback(
    (procId: string): number => {
      const configs = configsByProc.get(procId) || []
      if (configs.length === 0) return 0
      // Facility default: all optional milestones enabled
      // Override count = optional milestones without a config row (disabled)
      const enabledIds = new Set(configs.filter((c) => c.is_enabled).map((c) => c.facility_milestone_id))
      return optionalMilestones.filter((m) => !enabledIds.has(m.id)).length
    },
    [configsByProc, optionalMilestones]
  )

  // Surgeons overriding each procedure
  const surgeonsPerProc = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of safeSurgeonSummary) {
      const existing = map.get(s.procedure_type_id) || []
      existing.push(s.surgeon_id)
      map.set(s.procedure_type_id, existing)
    }
    return map
  }, [safeSurgeonSummary])

  // ── Filter and search ──────────────────────────────

  const customizedCount = safeProcs.filter((p) => procIsCustomized(p.id)).length
  const defaultCount = safeProcs.length - customizedCount
  const surgOverrideCount = safeProcs.filter((p) => (surgeonsPerProc.get(p.id)?.length ?? 0) > 0).length

  const filteredProcedures = useMemo(() => {
    let list = safeProcs
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    if (filterTab === 'customized') list = list.filter((p) => procIsCustomized(p.id))
    if (filterTab === 'default') list = list.filter((p) => !procIsCustomized(p.id))
    if (filterTab === 'surgeon-overrides')
      list = list.filter((p) => (surgeonsPerProc.get(p.id)?.length ?? 0) > 0)
    return list
  }, [safeProcs, searchQuery, filterTab, procIsCustomized, surgeonsPerProc])

  // ── Selected procedure data ────────────────────────

  const selectedProc = safeProcs.find((p) => p.id === selectedProcId) || null
  const isCustomized = selectedProcId ? procIsCustomized(selectedProcId) : false

  // Effective config: milestone id → enabled
  const effectiveConfig = useMemo(() => {
    const config: Record<string, boolean> = {}
    if (!selectedProcId) return config
    for (const m of optionalMilestones) {
      if (isCustomized) {
        config[m.id] = safeConfigs.some(
          (c) =>
            c.procedure_type_id === selectedProcId &&
            c.facility_milestone_id === m.id &&
            c.is_enabled
        )
      } else {
        config[m.id] = true // facility default: all enabled
      }
    }
    return config
  }, [selectedProcId, optionalMilestones, isCustomized, safeConfigs])

  // Facility default config (all enabled)
  const defaultConfig = useMemo(() => {
    const config: Record<string, boolean> = {}
    for (const m of optionalMilestones) {
      config[m.id] = true
    }
    return config
  }, [optionalMilestones])

  // Overridden IDs (milestones that differ from default)
  const overriddenIds = useMemo(() => {
    const ids = new Set<string>()
    if (!isCustomized) return ids
    for (const msId of Object.keys(defaultConfig)) {
      if (effectiveConfig[msId] !== defaultConfig[msId]) ids.add(msId)
    }
    return ids
  }, [isCustomized, effectiveConfig, defaultConfig])

  // Enabled count for selected procedure
  const enabledCount = useMemo(() => {
    if (!selectedProcId) return 0
    const boundaryCount = boundaryMilestoneIds.size
    const optionalEnabled = Object.values(effectiveConfig).filter(Boolean).length
    return boundaryCount + optionalEnabled
  }, [selectedProcId, effectiveConfig, boundaryMilestoneIds])

  // Surgeon overrides for selected procedure
  const selectedProcSurgeons = useMemo(() => {
    if (!selectedProcId) return []
    const surgeonIds = surgeonsPerProc.get(selectedProcId) || []
    return surgeonIds
      .map((sid) => safeSurgeons.find((s) => s.id === sid))
      .filter((s): s is NonNullable<typeof s> => !!s)
  }, [selectedProcId, surgeonsPerProc, safeSurgeons])

  // ── Phase block render data ────────────────────────

  const phaseBlockData = useMemo(() => {
    if (!phaseDefinitions?.length) return []
    return phaseDefinitions.map((pd) => {
      const color = resolveColorKey(pd.color_key).hex
      const phaseMilestones: PhaseBlockMilestone[] = safeMilestones
        .filter((m) => m.phase_group === pd.name && !boundaryMilestoneIds.has(m.id))
        .map((m) => ({
          id: m.id,
          display_name: m.display_name,
          phase_group: m.phase_group,
          is_boundary: false,
          pair_with_id: m.pair_with_id,
          pair_position: m.pair_position,
          pair_group: pairGroupMap.get(m.id) || null,
          min_minutes: null,
          max_minutes: null,
        }))
      return { phaseDef: pd, color, milestones: phaseMilestones }
    })
  }, [phaseDefinitions, safeMilestones, boundaryMilestoneIds, pairGroupMap])

  // Milestones with no phase_group (unphased, e.g. after Patient Out)
  const unphasedMilestones: PhaseBlockMilestone[] = useMemo(() => {
    return safeMilestones
      .filter((m) => !m.phase_group && !boundaryMilestoneIds.has(m.id))
      .map((m) => ({
        id: m.id,
        display_name: m.display_name,
        phase_group: m.phase_group,
        is_boundary: false,
        pair_with_id: m.pair_with_id,
        pair_position: m.pair_position,
        pair_group: pairGroupMap.get(m.id) || null,
        min_minutes: null,
        max_minutes: null,
      }))
  }, [safeMilestones, boundaryMilestoneIds, pairGroupMap])

  const renderData = useMemo(() => {
    if (!phaseBlockData.length) return []
    return phaseBlockData.map((phase, idx) => {
      const isFirst = idx === 0
      const isLast = idx === phaseBlockData.length - 1

      // Boundary before this phase
      let boundaryBefore: {
        name: string
        topColor: string
        bottomColor: string
        solid: boolean
      } | null = null
      if (isFirst) {
        const ms = milestoneById.get(phase.phaseDef.start_milestone_id)
        if (ms) {
          boundaryBefore = {
            name: ms.display_name,
            topColor: phase.color,
            bottomColor: phase.color,
            solid: true,
          }
        }
      } else {
        // Show start boundary for non-first phases when not shared with previous phase's end
        const prevPhase = phaseBlockData[idx - 1]
        if (prevPhase.phaseDef.end_milestone_id !== phase.phaseDef.start_milestone_id) {
          const ms = milestoneById.get(phase.phaseDef.start_milestone_id)
          if (ms) {
            boundaryBefore = {
              name: ms.display_name,
              topColor: phase.color,
              bottomColor: phase.color,
              solid: true,
            }
          }
        }
      }

      // Boundary after this phase
      let boundaryAfter: {
        name: string
        topColor: string
        bottomColor: string
        solid: boolean
      } | null = null
      if (isLast) {
        const ms = milestoneById.get(phase.phaseDef.end_milestone_id)
        if (ms) {
          boundaryAfter = {
            name: ms.display_name,
            topColor: phase.color,
            bottomColor: phase.color,
            solid: true,
          }
        }
      } else {
        const nextPhase = phaseBlockData[idx + 1]
        const nextColor = nextPhase.color
        const isShared = phase.phaseDef.end_milestone_id === nextPhase.phaseDef.start_milestone_id
        const ms = milestoneById.get(phase.phaseDef.end_milestone_id)
        if (ms) {
          boundaryAfter = {
            name: ms.display_name,
            topColor: phase.color,
            bottomColor: nextColor,
            solid: !isShared,
          }
        }
      }

      const brackets = computeBracketData(phase.milestones, pairIssues)
      const bracketWidth = computeBracketAreaWidth(brackets)
      const issueCount = countPairIssuesInPhase(pairIssueMilestones, pairIssues, phase.phaseDef.name)

      return {
        ...phase,
        boundaryBefore,
        boundaryAfter,
        brackets,
        bracketWidth,
        issueCount,
      }
    })
  }, [phaseBlockData, milestoneById, pairIssues, pairIssueMilestones])

  // ── Toggle handler ─────────────────────────────────

  const handleToggle = useCallback(
    async (milestoneId: string) => {
      if (!effectiveFacilityId || !selectedProcId) return
      if (pendingOps.current.has(milestoneId)) return
      pendingOps.current.add(milestoneId)

      const wasDefault = !procIsCustomized(selectedProcId)
      const currentEnabled = effectiveConfig[milestoneId] ?? true

      try {
        if (wasDefault && currentEnabled) {
          // First toggle on a default procedure: materialize config for all milestones except this one
          const rowsToInsert = optionalMilestones
            .filter((m) => m.id !== milestoneId)
            .map((m) => ({
              facility_id: effectiveFacilityId,
              procedure_type_id: selectedProcId,
              facility_milestone_id: m.id,
              display_order: m.display_order,
              is_enabled: true,
            }))

          // Optimistic update
          const optimistic: ProcedureMilestoneConfigItem[] = rowsToInsert.map((r) => ({
            ...r,
            id: `optimistic-${r.facility_milestone_id}`,
          }))
          setConfigs((prev) => [...(prev || []), ...optimistic])

          const { data, error } = await supabase
            .from('procedure_milestone_config')
            .insert(rowsToInsert)
            .select()

          if (error || !data) {
            showToast({ type: 'error', title: 'Failed to update milestone configuration' })
            await refetchConfigs()
          } else {
            setConfigs((prev) => {
              const cleaned = (prev || []).filter((c) => !c.id.startsWith('optimistic-'))
              return [...cleaned, ...data]
            })
          }
        } else if (currentEnabled) {
          // Disable: delete the config row
          setConfigs((prev) =>
            (prev || []).filter(
              (c) =>
                !(
                  c.procedure_type_id === selectedProcId &&
                  c.facility_milestone_id === milestoneId
                )
            )
          )

          const { error } = await supabase
            .from('procedure_milestone_config')
            .delete()
            .eq('procedure_type_id', selectedProcId)
            .eq('facility_milestone_id', milestoneId)

          if (error) {
            showToast({ type: 'error', title: 'Failed to disable milestone' })
            await refetchConfigs()
          }
        } else {
          // Enable: insert config row
          const m = safeMilestones.find((ms) => ms.id === milestoneId)
          if (!m) return

          const row = {
            facility_id: effectiveFacilityId,
            procedure_type_id: selectedProcId,
            facility_milestone_id: milestoneId,
            display_order: m.display_order,
            is_enabled: true,
          }

          setConfigs((prev) => [
            ...(prev || []),
            { ...row, id: `optimistic-${milestoneId}` },
          ])

          const { data, error } = await supabase
            .from('procedure_milestone_config')
            .insert(row)
            .select()
            .single()

          if (error || !data) {
            showToast({ type: 'error', title: 'Failed to enable milestone' })
            await refetchConfigs()
          } else {
            setConfigs((prev) =>
              (prev || []).map((c) =>
                c.id === `optimistic-${milestoneId}` ? data : c
              )
            )
          }
        }
      } finally {
        pendingOps.current.delete(milestoneId)
      }
    },
    [
      effectiveFacilityId,
      selectedProcId,
      procIsCustomized,
      effectiveConfig,
      optionalMilestones,
      safeMilestones,
      setConfigs,
      supabase,
      showToast,
      refetchConfigs,
    ]
  )

  // ── Reset handler ──────────────────────────────────

  const handleReset = useCallback(async () => {
    if (!effectiveFacilityId || !selectedProcId) return

    // Optimistic: remove all configs for this procedure
    setConfigs((prev) =>
      (prev || []).filter((c) => c.procedure_type_id !== selectedProcId)
    )

    const { error } = await supabase
      .from('procedure_milestone_config')
      .delete()
      .eq('facility_id', effectiveFacilityId)
      .eq('procedure_type_id', selectedProcId)

    if (error) {
      showToast({ type: 'error', title: 'Failed to reset' })
      await refetchConfigs()
    } else {
      showToast({ type: 'success', title: 'Reset to facility defaults' })
    }
  }, [effectiveFacilityId, selectedProcId, setConfigs, supabase, showToast, refetchConfigs])

  // ── Reorder handler ────────────────────────────────

  const handleReorder = useCallback(
    async (phaseKey: string, newOrder: PhaseBlockMilestone[]) => {
      if (!effectiveFacilityId || !selectedProcId) return
      const milestoneIds = newOrder.map((m) => m.id)

      // Optimistic update
      setConfigs((prev) => {
        const updated = [...(prev || [])]
        for (const [idx, msId] of milestoneIds.entries()) {
          const config = updated.find(
            (c) =>
              c.procedure_type_id === selectedProcId &&
              c.facility_milestone_id === msId
          )
          if (config) config.display_order = idx + 1
        }
        return updated
      })

      try {
        for (const [idx, msId] of milestoneIds.entries()) {
          const { error } = await supabase
            .from('procedure_milestone_config')
            .update({ display_order: idx + 1 })
            .eq('facility_id', effectiveFacilityId)
            .eq('procedure_type_id', selectedProcId)
            .eq('facility_milestone_id', msId)
          if (error) throw error
        }
      } catch {
        showToast({ type: 'error', title: 'Failed to save new order' })
        await refetchConfigs()
      }
    },
    [effectiveFacilityId, selectedProcId, setConfigs, supabase, showToast, refetchConfigs]
  )

  // ── Loading ────────────────────────────────────────

  if (userLoading || loading) {
    return (
      <div
        className="flex border border-slate-200 rounded-xl overflow-hidden bg-white"
        style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
      >
        {/* Left panel skeleton */}
        <div className="w-[280px] min-w-[280px] border-r border-slate-200 bg-white flex flex-col p-2.5 gap-2">
          <Skeleton className="h-8 w-full" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-16" rounded="sm" />
            ))}
          </div>
          <div className="space-y-1 mt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" rounded="md" />
            ))}
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center">
          <Skeleton className="w-10 h-10 mb-3" rounded="full" />
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <div className="text-center py-12 text-slate-500">
        No facility found. Please contact support.
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────

  const FILTER_TABS: { id: FilterTab; label: string; count: number; purple?: boolean }[] = [
    { id: 'all', label: 'All', count: safeProcs.length },
    { id: 'customized', label: 'Customized', count: customizedCount },
    { id: 'default', label: 'Default', count: defaultCount },
    { id: 'surgeon-overrides', label: 'Surg. Overrides', count: surgOverrideCount, purple: true },
  ]

  return (
    <div
      className="flex border border-slate-200 rounded-xl overflow-hidden bg-white"
      style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
    >
      {/* ── Left Panel: Procedure List ── */}
      <div className="w-[280px] min-w-[280px] border-r border-slate-200 bg-white flex flex-col">
        {/* Search */}
        <div className="p-2.5 pb-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-[5px] border border-slate-200">
            <Search className="w-[13px] h-[13px] text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search procedures..."
              className="border-none outline-none bg-transparent text-xs text-slate-800 w-full font-inherit"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 px-2.5 pb-1.5 flex-wrap">
          {FILTER_TABS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterTab(f.id)}
              className={`px-[7px] py-[3px] border-none rounded-[3px] text-xs cursor-pointer ${
                filterTab === f.id
                  ? f.purple
                    ? 'font-semibold text-purple-700 bg-purple-100'
                    : 'font-semibold text-slate-800 bg-slate-100'
                  : 'font-normal text-slate-500 bg-transparent'
              }`}
            >
              {f.label}{' '}
              <span className="text-slate-400">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Procedure list */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
          {filteredProcedures.map((p) => {
            const custom = procIsCustomized(p.id)
            const diffCount = procOverrideCount(p.id)
            const surgOvCount = surgeonsPerProc.get(p.id)?.length ?? 0
            const isSel = p.id === selectedProcId

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProcId(p.id)}
                className={`flex items-center justify-between px-2.5 py-2 rounded-[5px] cursor-pointer mb-px ${
                  isSel
                    ? 'bg-blue-50 border border-blue-200'
                    : 'border border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis ${
                      isSel ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {p.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {custom
                        ? `${diffCount} override${diffCount !== 1 ? 's' : ''}`
                        : 'Default'}
                    </span>
                    {surgOvCount > 0 && (
                      <span className="text-xs text-purple-600 font-medium flex items-center gap-0.5">
                        <User className="w-3 h-3" /> {surgOvCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {custom && (
                    <div className="w-[5px] h-[5px] rounded-full bg-amber-500" />
                  )}
                  {surgOvCount > 0 && (
                    <div className="w-[5px] h-[5px] rounded-full bg-purple-500" />
                  )}
                </div>
              </div>
            )
          })}

          {filteredProcedures.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              {searchQuery ? 'No matching procedures' : 'No procedures'}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Procedure Detail ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {selectedProc ? (
          <>
            {/* Header bar */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-slate-900 m-0">
                    {selectedProc.name}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-[3px] ${
                      isCustomized
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCustomized ? 'CUSTOMIZED' : 'DEFAULT'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 m-0">
                  {enabledCount}/{safeMilestones.length} milestones active
                </p>
              </div>
              {isCustomized && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2.5 py-[5px] border border-slate-200 rounded-[5px] bg-white cursor-pointer text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  <Undo2 className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Content */}
            <div className="px-5 py-3.5 max-w-[520px]">
              {/* Inheritance breadcrumb */}
              <InheritanceBreadcrumb
                levels={[
                  { label: 'Facility Default', active: !isCustomized },
                  { label: selectedProc.name, active: isCustomized },
                ]}
              />

              {/* Surgeon override banner */}
              {selectedProcSurgeons.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 mb-2.5 bg-purple-100 border border-purple-200 rounded-[5px] text-xs text-purple-700">
                  <User className="w-3 h-3 mt-0.5 shrink-0" />
                  <div>
                    <strong>
                      {selectedProcSurgeons.length} surgeon
                      {selectedProcSurgeons.length !== 1 ? 's' : ''}
                    </strong>{' '}
                    override this:
                    <div className="flex gap-1 flex-wrap mt-1">
                      {selectedProcSurgeons.map((s) => (
                        <button
                          key={s.id}
                          onClick={() =>
                            router.push(
                              `/settings/surgeon-milestones?surgeon=${s.id}&procedure=${selectedProcId}`
                            )
                          }
                          className="px-1.5 py-0.5 rounded-[3px] bg-purple-200 font-medium text-xs text-purple-700 hover:bg-purple-300 cursor-pointer border-none"
                        >
                          {s.last_name}, {s.first_name} &rarr;
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Phase blocks with checkboxes */}
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
                      mode="config"
                      milestones={phase.milestones}
                      config={effectiveConfig}
                      parentConfig={defaultConfig}
                      overriddenIds={overriddenIds}
                      overrideLabel="OVERRIDE"
                      pairIssueCount={phase.issueCount}
                      onToggle={handleToggle}
                      onReorder={isCustomized ? handleReorder : undefined}
                      draggable={isCustomized}
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

                {/* Unphased milestones (no phase_group assigned) */}
                {unphasedMilestones.length > 0 && (
                  <PhaseBlock
                    phaseColor="#94A3B8"
                    phaseLabel="Unphased"
                    phaseKey="unphased"
                    mode="config"
                    milestones={unphasedMilestones}
                    config={effectiveConfig}
                    parentConfig={defaultConfig}
                    overriddenIds={overriddenIds}
                    overrideLabel="OVERRIDE"
                    onToggle={handleToggle}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Search className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500 mb-1">
              Select a procedure
            </p>
            <p className="text-xs">
              Choose a procedure from the list to configure its milestones.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
