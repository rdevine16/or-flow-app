// app/settings/procedure-milestones/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ChevronDown, ClipboardList } from 'lucide-react'
import {
  ProcedureMilestoneList,
  type FacilityMilestoneWithPhase,
  type PhaseInfo,
  type ProcedureMilestoneConfigItem,
} from '@/components/settings/procedure-milestones/ProcedureMilestoneList'

// ── Types ────────────────────────────────────────────

interface ProcedureType {
  id: string
  name: string
  implant_category: string | null
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

// ── Page ────────────────────────────────────────────

export default function ProcedureMilestonesSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // ── Data fetching ──────────────────────────────────

  const { data: procedures, loading: proceduresLoading } = useSupabaseQuery<ProcedureType[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_types')
        .select('id, name, implant_category')
        .eq('facility_id', effectiveFacilityId!)
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

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

  const { data: initialConfigs, loading: configsLoading, refetch: refetchConfigs } = useSupabaseQuery<ProcedureMilestoneConfigItem[]>(
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

  // ── Derived data ──────────────────────────────────

  // Boundary milestone IDs (start or end of any active phase)
  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pd of phaseDefinitions || []) {
      ids.add(pd.start_milestone_id)
      ids.add(pd.end_milestone_id)
    }
    return ids
  }, [phaseDefinitions])

  // Phase info for the list component
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

  // ── Configs state (optimistic updates) ────────────

  const [configs, setConfigs] = useState<ProcedureMilestoneConfigItem[]>([])
  useEffect(() => {
    if (initialConfigs) setConfigs(initialConfigs)
  }, [initialConfigs])

  const loading = proceduresLoading || milestonesLoading || configsLoading || phasesLoading
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null)

  // Track which individual milestones are currently saving
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const pendingOps = useRef<Set<string>>(new Set())

  // ── Saving key helpers ────────────────────────────

  const markSaving = useCallback((procedureId: string, milestoneIds: string[]) => {
    setSavingKeys(prev => {
      const next = new Set(prev)
      milestoneIds.forEach(mid => next.add(`${procedureId}:${mid}`))
      return next
    })
  }, [])

  const clearSaving = useCallback((procedureId: string, milestoneIds: string[]) => {
    setSavingKeys(prev => {
      const next = new Set(prev)
      milestoneIds.forEach(mid => next.delete(`${procedureId}:${mid}`))
      return next
    })
  }, [])

  // Check if milestone is enabled for procedure
  const isMilestoneEnabled = useCallback((procedureId: string, milestoneId: string): boolean => {
    return configs.some(
      c => c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId && c.is_enabled
    )
  }, [configs])

  // ── Core toggle: handles single or multiple milestone IDs ──

  const toggleMilestoneIds = useCallback(async (procedureId: string, milestoneIds: string[]) => {
    if (!effectiveFacilityId) return

    const opKeys = milestoneIds.map(mid => `${procedureId}:${mid}`)
    if (opKeys.some(k => pendingOps.current.has(k))) return
    opKeys.forEach(k => pendingOps.current.add(k))

    const isEnabled = isMilestoneEnabled(procedureId, milestoneIds[0])
    markSaving(procedureId, milestoneIds)

    if (isEnabled) {
      // Optimistically remove
      setConfigs(prev => prev.filter(
        c => !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
      ))

      const deletePromises = milestoneIds.map(mid =>
        supabase
          .from('procedure_milestone_config')
          .delete()
          .eq('procedure_type_id', procedureId)
          .eq('facility_milestone_id', mid)
      )
      const results = await Promise.all(deletePromises)

      if (results.some(r => r.error)) {
        showToast({ type: 'error', title: 'Failed to remove milestone. Reverting change.' })
        await refetchConfigs()
      }
    } else {
      // Optimistically add placeholders
      const optimisticConfigs: ProcedureMilestoneConfigItem[] = milestoneIds.map(mid => {
        const m = (milestones || []).find(ms => ms.id === mid)
        return {
          id: `optimistic-${mid}`,
          procedure_type_id: procedureId,
          facility_milestone_id: mid,
          display_order: m?.display_order || 0,
          is_enabled: true,
        }
      })
      setConfigs(prev => [...prev, ...optimisticConfigs])

      // For paired milestones, delete first to avoid 409
      if (milestoneIds.length > 1) {
        await Promise.all(milestoneIds.map(mid =>
          supabase
            .from('procedure_milestone_config')
            .delete()
            .eq('procedure_type_id', procedureId)
            .eq('facility_milestone_id', mid)
        ))
      }

      const rows = milestoneIds.map(mid => {
        const m = (milestones || []).find(ms => ms.id === mid)
        return {
          facility_id: effectiveFacilityId,
          procedure_type_id: procedureId,
          facility_milestone_id: mid,
          display_order: m?.display_order || 0,
          is_enabled: true,
        }
      })

      const { data, error } = await supabase
        .from('procedure_milestone_config')
        .insert(rows)
        .select()

      if (error || !data) {
        showToast({ type: 'error', title: 'Failed to add milestone. Reverting change.' })
        await refetchConfigs()
      } else {
        setConfigs(prev => {
          const cleaned = prev.filter(
            c => !c.id.startsWith('optimistic-') &&
              !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
          )
          return [...cleaned, ...data]
        })
      }
    }

    clearSaving(procedureId, milestoneIds)
    opKeys.forEach(k => pendingOps.current.delete(k))
  }, [effectiveFacilityId, milestones, isMilestoneEnabled, markSaving, clearSaving, showToast, supabase, refetchConfigs])

  // ── Toggle handlers ───────────────────────────────

  const toggleMilestone = useCallback((procedureId: string, milestoneId: string) => {
    toggleMilestoneIds(procedureId, [milestoneId])
  }, [toggleMilestoneIds])

  const togglePairedMilestone = useCallback((procedureId: string, startMilestoneId: string) => {
    const startMilestone = (milestones || []).find(m => m.id === startMilestoneId)
    if (!startMilestone) return

    const milestoneIds = startMilestone.pair_with_id
      ? [startMilestoneId, startMilestone.pair_with_id]
      : [startMilestoneId]

    toggleMilestoneIds(procedureId, milestoneIds)
  }, [milestones, toggleMilestoneIds])

  // ── Reorder handler ───────────────────────────────

  const handleReorder = useCallback(async (procedureId: string, _phaseGroup: string, orderedMilestoneIds: string[]) => {
    if (!effectiveFacilityId) return

    // Optimistic update: assign display_order based on position
    setConfigs(prev => {
      const updated = [...prev]
      for (const [idx, milestoneId] of orderedMilestoneIds.entries()) {
        const config = updated.find(c => c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId)
        if (config) {
          config.display_order = idx + 1
        }
      }
      return updated
    })

    // Persist to DB
    try {
      for (const [idx, milestoneId] of orderedMilestoneIds.entries()) {
        const { error } = await supabase
          .from('procedure_milestone_config')
          .update({ display_order: idx + 1 })
          .eq('facility_id', effectiveFacilityId)
          .eq('procedure_type_id', procedureId)
          .eq('facility_milestone_id', milestoneId)
        if (error) throw error
      }
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
      await refetchConfigs()
    }
  }, [effectiveFacilityId, supabase, showToast, refetchConfigs])

  // ── Bulk actions ──────────────────────────────────

  const enableAllMilestones = useCallback(async (procedureId: string) => {
    if (!effectiveFacilityId) return

    // Skip boundary milestones (already locked on) and already enabled
    const toEnable = (milestones || []).filter(m =>
      !isMilestoneEnabled(procedureId, m.id) && !boundaryMilestoneIds.has(m.id)
    )
    if (toEnable.length === 0) return

    const milestoneIds = toEnable.map(m => m.id)
    markSaving(procedureId, milestoneIds)

    const optimisticConfigs: ProcedureMilestoneConfigItem[] = toEnable.map(m => ({
      id: `optimistic-${m.id}`,
      procedure_type_id: procedureId,
      facility_milestone_id: m.id,
      display_order: m.display_order,
      is_enabled: true,
    }))
    setConfigs(prev => [...prev, ...optimisticConfigs])

    const rows = toEnable.map(m => ({
      facility_id: effectiveFacilityId,
      procedure_type_id: procedureId,
      facility_milestone_id: m.id,
      display_order: m.display_order,
      is_enabled: true,
    }))

    const { data, error } = await supabase
      .from('procedure_milestone_config')
      .insert(rows)
      .select()

    if (error || !data) {
      showToast({ type: 'error', title: 'Failed to enable all milestones. Reverting.' })
      await refetchConfigs()
    } else {
      setConfigs(prev => {
        const cleaned = prev.filter(
          c => !c.id.startsWith('optimistic-') &&
            !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
        )
        return [...cleaned, ...data]
      })
    }

    clearSaving(procedureId, milestoneIds)
  }, [effectiveFacilityId, milestones, isMilestoneEnabled, boundaryMilestoneIds, markSaving, clearSaving, showToast, supabase, refetchConfigs])

  const disableAllMilestones = useCallback(async (procedureId: string) => {
    if (!effectiveFacilityId) return

    // Only disable non-boundary milestones
    const toDisable = configs.filter(c =>
      c.procedure_type_id === procedureId && !boundaryMilestoneIds.has(c.facility_milestone_id)
    )
    if (toDisable.length === 0) return

    const milestoneIds = toDisable.map(c => c.facility_milestone_id)
    markSaving(procedureId, milestoneIds)

    // Optimistic: keep boundary configs, remove the rest
    setConfigs(prev => prev.filter(c =>
      c.procedure_type_id !== procedureId || boundaryMilestoneIds.has(c.facility_milestone_id)
    ))

    // Delete non-boundary configs from DB
    const deletePromises = milestoneIds.map(mid =>
      supabase
        .from('procedure_milestone_config')
        .delete()
        .eq('facility_id', effectiveFacilityId)
        .eq('procedure_type_id', procedureId)
        .eq('facility_milestone_id', mid)
    )
    const results = await Promise.all(deletePromises)

    if (results.some(r => r.error)) {
      showToast({ type: 'error', title: 'Failed to clear milestones. Reverting.' })
      await refetchConfigs()
    }

    clearSaving(procedureId, milestoneIds)
  }, [effectiveFacilityId, configs, boundaryMilestoneIds, markSaving, clearSaving, showToast, supabase, refetchConfigs])

  // ── Utility ───────────────────────────────────────

  const getMilestoneCount = (procedureId: string): number => {
    const configCount = configs.filter(c => c.procedure_type_id === procedureId && c.is_enabled).length
    // Add boundary milestones that might not have explicit configs
    const boundaryCount = Array.from(boundaryMilestoneIds).filter(bmId =>
      !configs.some(c => c.procedure_type_id === procedureId && c.facility_milestone_id === bmId)
    ).length
    return configCount + boundaryCount
  }

  const getCategoryLabel = (category: string | null): string => {
    const labels: Record<string, string> = {
      total_hip: 'Total Hip',
      total_knee: 'Total Knee',
      partial_knee: 'Partial Knee',
      shoulder: 'Shoulder',
      spine: 'Spine',
      other: 'Other',
    }
    return category ? labels[category] || category : ''
  }

  const isAnySaving = savingKeys.size > 0
  const totalVisibleMilestones = (milestones || []).filter(m => m.pair_position !== 'end').length

  if (userLoading || loading) {
    return <PageLoader message="Loading procedure milestones..." />
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Procedure Milestones</h1>
      <p className="text-slate-500 mb-6">
        Configure which milestones are tracked for each procedure type. Milestones are grouped by phase.
      </p>

      {!effectiveFacilityId ? (
        <div className="text-center py-12 text-slate-500">
          No facility found. Please contact support.
        </div>
      ) : (
        <div className="space-y-3">
          {(procedures || []).map(procedure => {
            const isExpanded = expandedProcedure === procedure.id
            const milestoneCount = getMilestoneCount(procedure.id)

            return (
              <div
                key={procedure.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                {/* Procedure Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedProcedure(isExpanded ? null : procedure.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      procedure.implant_category
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{procedure.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {procedure.implant_category && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            {getCategoryLabel(procedure.implant_category)}
                          </span>
                        )}
                        <span className={`text-xs ${
                          milestoneCount === 0
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-500'
                        }`}>
                          {milestoneCount === 0
                            ? 'No milestones configured'
                            : `${milestoneCount} of ${totalVisibleMilestones} milestones`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${totalVisibleMilestones > 0 ? (milestoneCount / totalVisibleMilestones) * 100 : 0}%` }}
                      />
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Phase-grouped milestone list */}
                {isExpanded && (
                  <ProcedureMilestoneList
                    procedureId={procedure.id}
                    milestones={milestones || []}
                    configs={configs}
                    phases={phases}
                    boundaryMilestoneIds={boundaryMilestoneIds}
                    savingKeys={savingKeys}
                    isAnySaving={isAnySaving}
                    onToggle={toggleMilestone}
                    onTogglePaired={togglePairedMilestone}
                    onReorder={handleReorder}
                    onEnableAll={enableAllMilestones}
                    onDisableAll={disableAllMilestones}
                  />
                )}
              </div>
            )
          })}

          {(procedures || []).length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No procedure types configured for this facility.</p>
              <p className="text-sm mt-1">Add procedures in the Procedure Types settings first.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
