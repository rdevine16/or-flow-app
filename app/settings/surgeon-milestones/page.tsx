// app/settings/surgeon-milestones/page.tsx
'use client'

import { useState, useCallback, useMemo, useRef, useEffect, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useSurgeons } from '@/hooks'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Search, Undo2, X, CheckCircle2 } from 'lucide-react'
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
import { AddProcedureDropdown } from '@/components/settings/surgeon-milestones/AddProcedureDropdown'

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

interface SurgeonConfigSummaryItem {
  surgeon_id: string
  procedure_type_id: string
}

// ── Page ────────────────────────────────────────────

export default function SurgeonMilestonesSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const pendingOps = useRef<Set<string>>(new Set())

  // ── URL Params (cross-page navigation) ───────────
  const searchParams = useSearchParams()
  const urlSurgeonId = searchParams.get('surgeon')
  const urlProcedureId = searchParams.get('procedure')

  // ── UI State ──────────────────────────────────────

  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(urlSurgeonId)
  const [selectedSurgeonProc, setSelectedSurgeonProc] = useState<string | null>(urlProcedureId)
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  // ── Data Fetching ────────────────────────────────

  // 1. Surgeons list
  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(effectiveFacilityId)

  // 2. Procedure types
  const { data: procedureTypes, loading: proceduresLoading } = useSupabaseQuery<ProcedureType[]>(
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

  // 3. Facility milestones
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

  // 4. Phase definitions
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

  // 5. All procedure configs (for parent config resolution)
  const { data: allProcedureConfigs, loading: allProcConfigsLoading } =
    useSupabaseQuery<ProcedureMilestoneConfigItem[]>(
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

  // 6. Surgeon config summary (for left panel override counts)
  const {
    data: surgeonConfigSummary,
    loading: summaryLoading,
    refetch: refetchSummary,
  } = useSupabaseQuery<SurgeonConfigSummaryItem[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('surgeon_milestone_config')
        .select('surgeon_id, procedure_type_id')
        .eq('facility_id', effectiveFacilityId!)
      if (error) throw error
      // Deduplicate: one entry per surgeon+procedure
      const seen = new Set<string>()
      const result: SurgeonConfigSummaryItem[] = []
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

  // 7. Selected surgeon's configs (ALL procedures for this surgeon)
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
      if (error) throw error
      return data || []
    },
    {
      deps: [effectiveFacilityId, selectedSurgeon],
      enabled: !userLoading && !!effectiveFacilityId && !!selectedSurgeon,
    }
  )

  const loading =
    surgeonsLoading || proceduresLoading || milestonesLoading || phasesLoading || allProcConfigsLoading || summaryLoading

  // ── Safe Arrays ──────────────────────────────────

  const safeMilestones = milestones || []
  const safeSurgeonConfigs = surgeonConfigs || []
  const safeProcs = procedureTypes || []
  const safeSurgeons = surgeons || []
  const safeSummary = surgeonConfigSummary || []
  const safeAllProcConfigs = allProcedureConfigs || []

  // ── Derived Data ──────────────────────────────────

  // Boundary milestone IDs
  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pd of phaseDefinitions || []) {
      ids.add(pd.start_milestone_id)
      ids.add(pd.end_milestone_id)
    }
    return ids
  }, [phaseDefinitions])

  // Non-boundary milestones
  const optionalMilestones = useMemo(
    () => safeMilestones.filter((m) => !boundaryMilestoneIds.has(m.id)),
    [safeMilestones, boundaryMilestoneIds]
  )

  // Pair group map
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

  // Pair issues
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

  // Procedure configs grouped by procedure
  const procConfigsByProc = useMemo(() => {
    const map = new Map<string, ProcedureMilestoneConfigItem[]>()
    for (const c of safeAllProcConfigs) {
      const existing = map.get(c.procedure_type_id) || []
      existing.push(c)
      map.set(c.procedure_type_id, existing)
    }
    return map
  }, [safeAllProcConfigs])

  // Get parent config for any procedure
  const getParentConfig = useCallback(
    (procId: string): Record<string, boolean> => {
      const configs = procConfigsByProc.get(procId) || []
      const result: Record<string, boolean> = {}
      if (configs.length === 0) {
        // No procedure config = facility default = all enabled
        for (const m of optionalMilestones) result[m.id] = true
      } else {
        for (const m of optionalMilestones) {
          result[m.id] = configs.some(
            (c) => c.facility_milestone_id === m.id && c.is_enabled
          )
        }
      }
      return result
    },
    [procConfigsByProc, optionalMilestones]
  )

  // ── Left Panel Data ──────────────────────────────

  // Override count per surgeon (number of procedures overridden)
  const surgeonOverrideCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of safeSummary) {
      map.set(s.surgeon_id, (map.get(s.surgeon_id) || 0) + 1)
    }
    return map
  }, [safeSummary])

  // Filtered surgeon list
  const filteredSurgeons = useMemo(() => {
    let list = safeSurgeons
    if (surgeonSearch) {
      const q = surgeonSearch.toLowerCase()
      list = list.filter(
        (s) =>
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
          `${s.last_name}, ${s.first_name}`.toLowerCase().includes(q)
      )
    }
    return list
  }, [safeSurgeons, surgeonSearch])

  // ── Right Panel Data ─────────────────────────────

  // Procedure IDs the selected surgeon overrides
  const surgeonProcIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of safeSurgeonConfigs) {
      ids.add(c.procedure_type_id)
    }
    return [...ids]
  }, [safeSurgeonConfigs])

  // Procedure objects for chips
  const surgeonProcs = useMemo(
    () =>
      surgeonProcIds
        .map((pid) => safeProcs.find((p) => p.id === pid))
        .filter((p): p is ProcedureType => !!p),
    [surgeonProcIds, safeProcs]
  )

  // Sync URL params to state when navigating from another page
  const appliedUrlParams = useRef(false)
  useEffect(() => {
    if (appliedUrlParams.current) return
    if (urlSurgeonId && safeSurgeons.length > 0) {
      const found = safeSurgeons.find((s) => s.id === urlSurgeonId)
      if (found) {
        setSelectedSurgeon(urlSurgeonId)
        if (urlProcedureId) {
          setSelectedSurgeonProc(urlProcedureId)
        }
        appliedUrlParams.current = true
      }
    }
  }, [urlSurgeonId, urlProcedureId, safeSurgeons])

  // Auto-select first procedure when surgeon configs load
  useEffect(() => {
    if (selectedSurgeon && !surgeonConfigsLoading && surgeonProcIds.length > 0 && !selectedSurgeonProc) {
      setSelectedSurgeonProc(surgeonProcIds[0])
    }
  }, [selectedSurgeon, surgeonConfigsLoading, surgeonProcIds, selectedSurgeonProc])

  // Surgeon configs for the selected procedure
  const surgeonConfigsForProc = useMemo(
    () => safeSurgeonConfigs.filter((c) => c.procedure_type_id === selectedSurgeonProc),
    [safeSurgeonConfigs, selectedSurgeonProc]
  )

  // Surgeon override map for selected procedure
  const surgeonOverrideMap = useMemo(() => {
    const map = new Map<string, SurgeonMilestoneConfigItem>()
    for (const c of surgeonConfigsForProc) {
      map.set(c.facility_milestone_id, c)
    }
    return map
  }, [surgeonConfigsForProc])

  // Parent config for the selected procedure
  const parentConfig = useMemo(
    () => (selectedSurgeonProc ? getParentConfig(selectedSurgeonProc) : {}),
    [selectedSurgeonProc, getParentConfig]
  )

  // Whether the selected procedure has been customized (has procedure-level configs)
  const isProcCustomized = useMemo(
    () =>
      selectedSurgeonProc
        ? (procConfigsByProc.get(selectedSurgeonProc)?.length ?? 0) > 0
        : false,
    [selectedSurgeonProc, procConfigsByProc]
  )

  // Config order map (procedure config + surgeon overrides)
  const configOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    if (selectedSurgeonProc) {
      const procConfigs = procConfigsByProc.get(selectedSurgeonProc) || []
      for (const c of procConfigs) {
        map.set(c.facility_milestone_id, c.display_order)
      }
      for (const c of surgeonConfigsForProc) {
        if (c.display_order !== null) {
          map.set(c.facility_milestone_id, c.display_order)
        }
      }
    }
    return map
  }, [selectedSurgeonProc, procConfigsByProc, surgeonConfigsForProc])

  // Effective config for the surgeon+procedure
  const effectiveConfig = useMemo(() => {
    if (!selectedSurgeonProc) return {} as Record<string, boolean>
    const config: Record<string, boolean> = {}
    for (const m of optionalMilestones) {
      const override = surgeonOverrideMap.get(m.id)
      if (override) {
        config[m.id] = override.is_enabled
      } else {
        config[m.id] = parentConfig[m.id] ?? true
      }
    }
    return config
  }, [selectedSurgeonProc, optionalMilestones, surgeonOverrideMap, parentConfig])

  // Overridden IDs (milestones where surgeon differs from parent)
  const overriddenIds = useMemo(() => {
    const ids = new Set<string>()
    for (const msId of Object.keys(parentConfig)) {
      if (effectiveConfig[msId] !== parentConfig[msId]) ids.add(msId)
    }
    return ids
  }, [effectiveConfig, parentConfig])

  const surgeonIsCustomized = overriddenIds.size > 0

  // Enabled count for selected procedure
  const enabledCount = useMemo(() => {
    if (!selectedSurgeonProc) return 0
    const boundaryCount = boundaryMilestoneIds.size
    const optionalEnabled = Object.values(effectiveConfig).filter(Boolean).length
    return boundaryCount + optionalEnabled
  }, [selectedSurgeonProc, effectiveConfig, boundaryMilestoneIds])

  // Check if a procedure has actual diff from parent for chip indicators
  const hasDiffForProc = useCallback(
    (procId: string): boolean => {
      const parent = getParentConfig(procId)
      const configs = safeSurgeonConfigs.filter((c) => c.procedure_type_id === procId)
      if (configs.length === 0) return false
      for (const c of configs) {
        const parentEnabled = parent[c.facility_milestone_id] ?? true
        if (c.is_enabled !== parentEnabled) return true
      }
      return false
    },
    [getParentConfig, safeSurgeonConfigs]
  )

  // ── Phase Block Render Data ──────────────────────

  const phaseBlockData = useMemo(() => {
    if (!phaseDefinitions?.length) return []
    return phaseDefinitions.map((pd) => {
      const color = resolveColorKey(pd.color_key).hex
      const phaseMilestones: PhaseBlockMilestone[] = safeMilestones
        .filter((m) => m.phase_group === pd.name && !boundaryMilestoneIds.has(m.id))
        .sort((a, b) => {
          const aOrder = configOrderMap.get(a.id) ?? a.display_order
          const bOrder = configOrderMap.get(b.id) ?? b.display_order
          return aOrder - bOrder
        })
        .map((m) => ({
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
  }, [phaseDefinitions, safeMilestones, boundaryMilestoneIds, pairGroupMap, configOrderMap])

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
      }))
  }, [safeMilestones, boundaryMilestoneIds, pairGroupMap])

  const renderData = useMemo(() => {
    if (!phaseBlockData.length) return []
    return phaseBlockData.map((phase, idx) => {
      const isFirst = idx === 0
      const isLast = idx === phaseBlockData.length - 1

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
      }

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
      const issueCount = countPairIssuesInPhase(
        pairIssueMilestones,
        pairIssues,
        phase.phaseDef.name
      )

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

  // ── Toggle Handler ─────────────────────────────────

  const handleToggle = useCallback(
    async (milestoneId: string) => {
      if (!effectiveFacilityId || !selectedSurgeon || !selectedSurgeonProc) return
      if (pendingOps.current.has(milestoneId)) return
      pendingOps.current.add(milestoneId)

      const currentlyEnabled = effectiveConfig[milestoneId] ?? true
      const procedureDefaultEnabled = parentConfig[milestoneId] ?? true
      const existingOverride = surgeonOverrideMap.get(milestoneId)
      const newEnabled = !currentlyEnabled

      try {
        // If toggling back to match the procedure default, remove the override
        if (newEnabled === procedureDefaultEnabled && existingOverride) {
          setSurgeonConfigs((prev) =>
            (prev || []).filter(
              (c) =>
                !(
                  c.facility_milestone_id === milestoneId &&
                  c.procedure_type_id === selectedSurgeonProc
                )
            )
          )

          const { error } = await supabase
            .from('surgeon_milestone_config')
            .delete()
            .eq('id', existingOverride.id)

          if (error) {
            showToast({ type: 'error', title: 'Failed to remove override' })
            await refetchSurgeonConfigs()
          }
        } else if (existingOverride) {
          // Update existing override
          setSurgeonConfigs((prev) =>
            (prev || []).map((c) =>
              c.id === existingOverride.id ? { ...c, is_enabled: newEnabled } : c
            )
          )

          const { error } = await supabase
            .from('surgeon_milestone_config')
            .update({ is_enabled: newEnabled })
            .eq('id', existingOverride.id)

          if (error) {
            showToast({ type: 'error', title: 'Failed to update override' })
            await refetchSurgeonConfigs()
          }
        } else {
          // Create new override
          const optimistic: SurgeonMilestoneConfigItem = {
            id: `optimistic-${milestoneId}`,
            facility_id: effectiveFacilityId,
            surgeon_id: selectedSurgeon,
            procedure_type_id: selectedSurgeonProc,
            facility_milestone_id: milestoneId,
            is_enabled: newEnabled,
            display_order: null,
          }
          setSurgeonConfigs((prev) => [...(prev || []), optimistic])

          const { data, error } = await supabase
            .from('surgeon_milestone_config')
            .insert({
              facility_id: effectiveFacilityId,
              surgeon_id: selectedSurgeon,
              procedure_type_id: selectedSurgeonProc,
              facility_milestone_id: milestoneId,
              is_enabled: newEnabled,
            })
            .select()
            .single()

          if (error || !data) {
            showToast({ type: 'error', title: 'Failed to create override' })
            await refetchSurgeonConfigs()
          } else {
            setSurgeonConfigs((prev) =>
              (prev || []).map((c) =>
                c.id === `optimistic-${milestoneId}`
                  ? (data as SurgeonMilestoneConfigItem)
                  : c
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
      selectedSurgeon,
      selectedSurgeonProc,
      effectiveConfig,
      parentConfig,
      surgeonOverrideMap,
      supabase,
      showToast,
      refetchSurgeonConfigs,
      setSurgeonConfigs,
    ]
  )

  // ── Reorder Handler ────────────────────────────────

  const handleReorder = useCallback(
    async (phaseKey: string, newOrder: PhaseBlockMilestone[]) => {
      if (!effectiveFacilityId || !selectedSurgeon || !selectedSurgeonProc) return
      const milestoneIds = newOrder.map((m) => m.id)

      // Optimistic update
      setSurgeonConfigs((prev) => {
        const updated = [...(prev || [])]
        for (const [idx, msId] of milestoneIds.entries()) {
          const config = updated.find(
            (c) =>
              c.procedure_type_id === selectedSurgeonProc &&
              c.facility_milestone_id === msId
          )
          if (config) config.display_order = idx + 1
        }
        return updated
      })

      try {
        for (const [idx, msId] of milestoneIds.entries()) {
          const existing = surgeonConfigsForProc.find(
            (c) => c.facility_milestone_id === msId && !c.id.startsWith('optimistic-')
          )
          if (existing) {
            await supabase
              .from('surgeon_milestone_config')
              .update({ display_order: idx + 1 })
              .eq('id', existing.id)
          } else {
            const currentEnabled = effectiveConfig[msId] ?? true
            await supabase
              .from('surgeon_milestone_config')
              .upsert(
                {
                  facility_id: effectiveFacilityId,
                  surgeon_id: selectedSurgeon,
                  procedure_type_id: selectedSurgeonProc,
                  facility_milestone_id: msId,
                  is_enabled: currentEnabled,
                  display_order: idx + 1,
                },
                {
                  onConflict:
                    'facility_id,surgeon_id,procedure_type_id,facility_milestone_id',
                }
              )
          }
        }
      } catch {
        showToast({ type: 'error', title: 'Failed to save new order' })
        await refetchSurgeonConfigs()
      }
    },
    [
      effectiveFacilityId,
      selectedSurgeon,
      selectedSurgeonProc,
      surgeonConfigsForProc,
      effectiveConfig,
      setSurgeonConfigs,
      supabase,
      showToast,
      refetchSurgeonConfigs,
    ]
  )

  // ── Add / Remove Procedure Override ────────────────

  const handleAddProcedure = useCallback(
    async (procedureId: string) => {
      if (!effectiveFacilityId || !selectedSurgeon) return

      // Get the procedure's parent config
      const procConfigs = procConfigsByProc.get(procedureId) || []
      const hasProcConfig = procConfigs.length > 0
      const parentMap = new Map(
        procConfigs.map((c) => [c.facility_milestone_id, c])
      )

      // Create rows matching parent config
      const rowsToInsert = optionalMilestones.map((m) => ({
        facility_id: effectiveFacilityId,
        surgeon_id: selectedSurgeon,
        procedure_type_id: procedureId,
        facility_milestone_id: m.id,
        is_enabled: hasProcConfig
          ? (parentMap.get(m.id)?.is_enabled ?? false)
          : true,
        display_order: parentMap.get(m.id)?.display_order ?? m.display_order,
      }))

      const { error } = await supabase
        .from('surgeon_milestone_config')
        .insert(rowsToInsert)

      if (error) {
        showToast({ type: 'error', title: 'Failed to add procedure override' })
      } else {
        setSelectedSurgeonProc(procedureId)
        await refetchSurgeonConfigs()
        await refetchSummary()
      }
    },
    [
      effectiveFacilityId,
      selectedSurgeon,
      optionalMilestones,
      procConfigsByProc,
      supabase,
      showToast,
      refetchSurgeonConfigs,
      refetchSummary,
    ]
  )

  const handleRemoveProcedure = useCallback(
    async (procedureId: string) => {
      if (!effectiveFacilityId || !selectedSurgeon) return

      // Optimistic: remove configs for this procedure
      setSurgeonConfigs((prev) =>
        (prev || []).filter((c) => c.procedure_type_id !== procedureId)
      )

      const { error } = await supabase
        .from('surgeon_milestone_config')
        .delete()
        .eq('facility_id', effectiveFacilityId)
        .eq('surgeon_id', selectedSurgeon)
        .eq('procedure_type_id', procedureId)

      if (error) {
        showToast({ type: 'error', title: 'Failed to remove procedure override' })
        await refetchSurgeonConfigs()
      } else {
        if (selectedSurgeonProc === procedureId) {
          const remaining = surgeonProcIds.filter((id) => id !== procedureId)
          setSelectedSurgeonProc(remaining[0] || null)
        }
        await refetchSummary()
      }
    },
    [
      effectiveFacilityId,
      selectedSurgeon,
      selectedSurgeonProc,
      surgeonProcIds,
      setSurgeonConfigs,
      supabase,
      showToast,
      refetchSurgeonConfigs,
      refetchSummary,
    ]
  )

  // ── Reset Handler ──────────────────────────────────

  const handleReset = useCallback(async () => {
    if (!effectiveFacilityId || !selectedSurgeon || !selectedSurgeonProc) return

    setResetting(true)
    // Optimistic: remove overrides for this procedure
    setSurgeonConfigs((prev) =>
      (prev || []).filter((c) => c.procedure_type_id !== selectedSurgeonProc)
    )

    const { error } = await supabase
      .from('surgeon_milestone_config')
      .delete()
      .eq('facility_id', effectiveFacilityId)
      .eq('surgeon_id', selectedSurgeon)
      .eq('procedure_type_id', selectedSurgeonProc)

    if (error) {
      showToast({ type: 'error', title: 'Failed to reset' })
      await refetchSurgeonConfigs()
    } else {
      showToast({ type: 'success', title: 'Reset to procedure defaults' })
      // Procedure removed from override list since all rows deleted
      const remaining = surgeonProcIds.filter((id) => id !== selectedSurgeonProc)
      setSelectedSurgeonProc(remaining[0] || null)
      await refetchSummary()
    }

    setResetting(false)
    setShowResetConfirm(false)
  }, [
    effectiveFacilityId,
    selectedSurgeon,
    selectedSurgeonProc,
    surgeonProcIds,
    setSurgeonConfigs,
    supabase,
    showToast,
    refetchSurgeonConfigs,
    refetchSummary,
  ])

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
          <div className="space-y-1 mt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2">
                <Skeleton className="w-7 h-7 shrink-0" rounded="md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center">
          <Skeleton className="w-10 h-10 mb-3" rounded="full" />
          <Skeleton className="h-4 w-28 mb-1" />
          <Skeleton className="h-3 w-52" />
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

  // ── Helpers ────────────────────────────────────────

  const selectedSurgeonObj = safeSurgeons.find((s) => s.id === selectedSurgeon) || null

  const getInitials = (s: { first_name: string; last_name: string }) =>
    `${s.first_name.charAt(0)}${s.last_name.charAt(0)}`.toUpperCase()

  // ── Render ────────────────────────────────────────

  return (
    <>
      <div
        className="flex border border-slate-200 rounded-xl overflow-hidden bg-white"
        style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
      >
        {/* ── Left Panel: Surgeon List ── */}
        <div className="w-[280px] min-w-[280px] border-r border-slate-200 bg-white flex flex-col">
          {/* Search */}
          <div className="p-2.5 pb-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-[5px] border border-slate-200">
              <Search className="w-[13px] h-[13px] text-slate-400" />
              <input
                value={surgeonSearch}
                onChange={(e) => setSurgeonSearch(e.target.value)}
                placeholder="Search surgeons..."
                className="border-none outline-none bg-transparent text-xs text-slate-800 w-full"
              />
            </div>
          </div>

          {/* Surgeon list */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
            {filteredSurgeons.map((s) => {
              const overrideCount = surgeonOverrideCounts.get(s.id) || 0
              const isSel = s.id === selectedSurgeon

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedSurgeon(s.id)
                    setSelectedSurgeonProc(null)
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-[5px] cursor-pointer mb-px ${
                    isSel
                      ? 'bg-blue-50 border border-blue-200'
                      : 'border border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      overrideCount > 0
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {getInitials(s)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis ${
                        isSel ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {s.last_name}, {s.first_name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {overrideCount > 0 ? (
                        <span className="text-purple-600 font-medium">
                          {overrideCount} procedure{overrideCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        'No overrides'
                      )}
                    </div>
                  </div>
                  {overrideCount > 0 && (
                    <div className="w-[5px] h-[5px] rounded-full bg-purple-500 shrink-0" />
                  )}
                </div>
              )
            })}

            {filteredSurgeons.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                {surgeonSearch ? 'No matching surgeons' : 'No surgeons'}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Surgeon Detail ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {selectedSurgeonObj ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-[30px] h-[30px] rounded-md bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                    {getInitials(selectedSurgeonObj)}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 m-0">
                      {selectedSurgeonObj.last_name}, {selectedSurgeonObj.first_name}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 max-w-[520px]">
                {/* Procedure override chips */}
                {surgeonProcs.length > 0 && (
                  <div className="mb-2.5">
                    <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                      Procedure Overrides ({surgeonProcs.length})
                    </div>
                    <div className="flex gap-1 flex-wrap mb-2">
                      {surgeonProcs.map((p) => {
                        const isActive = p.id === selectedSurgeonProc
                        const hasDiff = hasDiffForProc(p.id)

                        return (
                          <div
                            key={p.id}
                            className={`flex items-center rounded-md overflow-hidden ${
                              isActive
                                ? 'border-[1.5px] border-blue-500 bg-blue-50'
                                : 'border-[1.5px] border-slate-200 bg-white'
                            }`}
                          >
                            <button
                              onClick={() => setSelectedSurgeonProc(p.id)}
                              className={`px-2 py-[5px] border-none bg-transparent text-xs cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? 'font-semibold text-blue-700'
                                  : 'font-normal text-slate-600'
                              }`}
                            >
                              {p.name}
                              {hasDiff && (
                                <div className="w-[5px] h-[5px] rounded-full bg-purple-500" />
                              )}
                              {!hasDiff && (
                                <span className="text-xs text-slate-400">
                                  no diff
                                </span>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveProcedure(p.id)
                              }}
                              className="px-1.5 py-[5px] border-none border-l border-l-slate-200 bg-transparent cursor-pointer text-slate-400 hover:text-red-500 flex items-center"
                            >
                              <X className="w-[11px] h-[11px]" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add Procedure Override */}
                <div className="mb-3.5">
                  <AddProcedureDropdown
                    onAdd={handleAddProcedure}
                    existingProcIds={surgeonProcIds}
                    allProcedures={safeProcs}
                  />
                </div>

                {/* Loading state for configs */}
                {surgeonConfigsLoading && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Loading milestone configuration...
                  </div>
                )}

                {/* Selected procedure content */}
                {selectedSurgeonProc && !surgeonConfigsLoading ? (
                  <>
                    {/* Inheritance breadcrumb */}
                    <InheritanceBreadcrumb
                      levels={[
                        {
                          label: 'Facility Default',
                          active: !isProcCustomized && !surgeonIsCustomized,
                        },
                        {
                          label:
                            safeProcs.find((p) => p.id === selectedSurgeonProc)?.name ||
                            '',
                          active: isProcCustomized && !surgeonIsCustomized,
                        },
                        {
                          label: selectedSurgeonObj.last_name,
                          active: surgeonIsCustomized,
                        },
                      ]}
                    />

                    {/* Active count + reset */}
                    <div className="flex justify-between items-center mb-2.5">
                      <div className="text-xs text-slate-500">
                        {enabledCount}/{safeMilestones.length} active
                        {surgeonIsCustomized &&
                          ` · ${overriddenIds.size} override${
                            overriddenIds.size !== 1 ? 's' : ''
                          }`}
                      </div>
                      {surgeonIsCustomized && (
                        <button
                          onClick={() => setShowResetConfirm(true)}
                          disabled={resetting}
                          className="flex items-center gap-1 px-2 py-1 border border-slate-200 rounded bg-white cursor-pointer text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="w-3 h-3" /> Reset
                        </button>
                      )}
                    </div>

                    {/* Green info banner when matching parent */}
                    {!surgeonIsCustomized && (
                      <div className="flex items-center gap-1.5 px-3 py-2 mb-2.5 bg-green-50 border border-green-200 rounded-[5px] text-xs text-green-800">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Matching {isProcCustomized ? 'procedure' : 'facility default'}{' '}
                        config. Toggle any milestone to create a surgeon override.
                      </div>
                    )}

                    {/* Phase blocks */}
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
                            parentConfig={parentConfig}
                            overriddenIds={overriddenIds}
                            overrideLabel="SURGEON"
                            pairIssueCount={phase.issueCount}
                            onToggle={handleToggle}
                            onReorder={handleReorder}
                            draggable={true}
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
                          parentConfig={parentConfig}
                          overriddenIds={overriddenIds}
                          overrideLabel="SURGEON"
                          onToggle={handleToggle}
                        />
                      )}
                    </div>
                  </>
                ) : !surgeonConfigsLoading && !selectedSurgeonProc ? (
                  /* Empty state when no procedure selected */
                  <div className="py-10 text-center text-slate-400">
                    <div className="text-sm font-medium text-slate-500 mb-1">
                      No procedure overrides yet
                    </div>
                    <div className="text-xs">
                      Use &ldquo;Add Procedure Override&rdquo; to configure
                      surgeon-specific milestones.
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            /* Empty state when no surgeon selected */
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Search className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500 mb-1">
                Select a surgeon
              </p>
              <p className="text-xs">
                Choose a surgeon from the list to manage their milestone overrides.
              </p>
            </div>
          )}
        </div>
      </div>

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
              This will delete {overriddenIds.size} override
              {overriddenIds.size !== 1 ? 's' : ''} and revert to the
              procedure&apos;s default milestone configuration.
            </p>
          </div>
        }
        confirmText="Reset to Defaults"
        loading={resetting}
      />
    </>
  )
}
