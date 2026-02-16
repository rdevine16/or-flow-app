// app/admin/settings/procedure-milestones/page.tsx
// Admin page for configuring which milestones are assigned to each default procedure type
// Phase-grouped layout with drag-to-reorder, mirroring the facility-level design
// These configurations are copied to new facilities when they are created

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { ChevronDown, ClipboardList, Info } from 'lucide-react'
import {
  ProcedureMilestoneList,
  type FacilityMilestoneWithPhase,
  type PhaseInfo,
  type ProcedureMilestoneConfigItem,
} from '@/components/settings/procedure-milestones/ProcedureMilestoneList'

// ── Types ────────────────────────────────────────────

interface ProcedureTypeTemplate {
  id: string
  name: string
  body_region_id: string | null
  implant_category: string | null
  is_active: boolean
  display_order: number | null
  body_region?: { name: string } | null
}

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
  pair_with_id: string | null
  is_active: boolean
}

interface ProcedureMilestoneTemplate {
  id: string
  procedure_type_template_id: string
  milestone_type_id: string
  display_order: number
}

interface PhaseDefinitionTemplate {
  id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_type_id: string
  end_milestone_type_id: string
  color_key: string | null
  is_active: boolean
}

// ── Helpers ────────────────────────────────────────────

/**
 * Derive phase_group for each milestone_type based on its display_order
 * relative to phase_definition_templates boundaries.
 *
 * Rule: milestone belongs to the phase whose start_milestone display_order
 * is <= its display_order AND whose end_milestone display_order is > its display_order.
 * Boundary milestones: the start milestone is included in the phase it starts.
 */
function derivePhaseGroup(
  milestoneTypes: MilestoneType[],
  phaseTemplates: PhaseDefinitionTemplate[]
): Map<string, string> {
  const phaseGroupMap = new Map<string, string>()

  const activePhases = phaseTemplates
    .filter(p => p.is_active)
    .sort((a, b) => a.display_order - b.display_order)

  const milestoneOrderMap = new Map<string, number>()
  for (const mt of milestoneTypes) {
    milestoneOrderMap.set(mt.id, mt.display_order)
  }

  // Build phase ranges: [startOrder, endOrder) for each phase
  const phaseRanges: { name: string; startOrder: number; endOrder: number }[] = []
  for (const phase of activePhases) {
    const startOrder = milestoneOrderMap.get(phase.start_milestone_type_id)
    const endOrder = milestoneOrderMap.get(phase.end_milestone_type_id)
    if (startOrder != null && endOrder != null) {
      phaseRanges.push({ name: phase.name, startOrder, endOrder })
    }
  }

  for (const mt of milestoneTypes) {
    const order = mt.display_order
    // Find the phase this milestone belongs to
    for (const range of phaseRanges) {
      if (order >= range.startOrder && order < range.endOrder) {
        phaseGroupMap.set(mt.id, range.name)
        break
      }
    }

    // If not assigned and it matches the end of the last phase, assign to last phase
    if (!phaseGroupMap.has(mt.id) && phaseRanges.length > 0) {
      const lastPhase = phaseRanges[phaseRanges.length - 1]
      if (order >= lastPhase.startOrder && order <= lastPhase.endOrder) {
        phaseGroupMap.set(mt.id, lastPhase.name)
      }
    }
  }

  return phaseGroupMap
}

// ── Page ────────────────────────────────────────────

export default function AdminProcedureMilestonesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Redirect non-global-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // ── Data fetching ──────────────────────────────────

  const { data: queryData, loading, error } = useSupabaseQuery<{
    procedures: ProcedureTypeTemplate[]
    milestoneTypes: MilestoneType[]
    configs: ProcedureMilestoneTemplate[]
    phaseTemplates: PhaseDefinitionTemplate[]
  }>(
    async (sb) => {
      const [proceduresRes, milestonesRes, configsRes, phasesRes] = await Promise.all([
        sb.from('procedure_type_templates')
          .select('id, name, body_region_id, implant_category, is_active, display_order, body_regions(name)')
          .eq('is_active', true)
          .order('name'),
        sb.from('milestone_types')
          .select('id, name, display_name, display_order, pair_position, pair_with_id, is_active')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order'),
        sb.from('procedure_milestone_templates')
          .select('id, procedure_type_template_id, milestone_type_id, display_order'),
        sb.from('phase_definition_templates')
          .select('id, name, display_name, display_order, start_milestone_type_id, end_milestone_type_id, color_key, is_active')
          .order('display_order'),
      ])

      const processedProcedures = (proceduresRes.data || []).map(p => ({
        ...p,
        body_region: Array.isArray(p.body_regions) ? p.body_regions[0] : p.body_regions
      }))

      return {
        procedures: processedProcedures,
        milestoneTypes: milestonesRes.data || [],
        configs: configsRes.data || [],
        phaseTemplates: phasesRes.data || [],
      }
    },
    { enabled: !userLoading && isGlobalAdmin }
  )

  const procedures = queryData?.procedures || []

  const milestoneTypes = useMemo(() => queryData?.milestoneTypes || [], [queryData?.milestoneTypes])
  const rawConfigs = useMemo(() => queryData?.configs || [], [queryData?.configs])
  const phaseTemplates = useMemo(() => queryData?.phaseTemplates || [], [queryData?.phaseTemplates])

  // ── Derived phase group mapping ──────────────────────────────────

  const phaseGroupMap = useMemo(
    () => derivePhaseGroup(milestoneTypes, phaseTemplates),
    [milestoneTypes, phaseTemplates]
  )

  // Boundary milestone type IDs (start or end of any active phase template)
  const boundaryMilestoneIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pt of phaseTemplates) {
      if (pt.is_active) {
        ids.add(pt.start_milestone_type_id)
        ids.add(pt.end_milestone_type_id)
      }
    }
    return ids
  }, [phaseTemplates])

  // Map phase_definition_templates → PhaseInfo (same shape as facility-level)
  const phases: PhaseInfo[] = useMemo(
    () => phaseTemplates
      .filter(pt => pt.is_active)
      .map(pt => ({
        name: pt.name,
        display_name: pt.display_name,
        display_order: pt.display_order,
        color_key: pt.color_key,
        start_milestone_id: pt.start_milestone_type_id,
        end_milestone_id: pt.end_milestone_type_id,
      })),
    [phaseTemplates]
  )

  // Map milestone_types → FacilityMilestoneWithPhase shape
  const mappedMilestones: FacilityMilestoneWithPhase[] = useMemo(
    () => milestoneTypes.map(mt => ({
      id: mt.id,
      name: mt.name,
      display_name: mt.display_name,
      display_order: mt.display_order,
      pair_position: mt.pair_position,
      pair_with_id: mt.pair_with_id,
      phase_group: phaseGroupMap.get(mt.id) || null,
    })),
    [milestoneTypes, phaseGroupMap]
  )

  // ── Configs state (optimistic updates) ────────────

  const [configs, setConfigs] = useState<ProcedureMilestoneConfigItem[]>([])

  // Map procedure_milestone_templates → ProcedureMilestoneConfigItem shape
  const initialMappedConfigs = useMemo(
    () => rawConfigs.map(c => ({
      id: c.id,
      procedure_type_id: c.procedure_type_template_id,
      facility_milestone_id: c.milestone_type_id,
      display_order: c.display_order,
      is_enabled: true, // templates use presence = enabled
    })),
    [rawConfigs]
  )

  useEffect(() => {
    setConfigs(initialMappedConfigs)
  }, [initialMappedConfigs])

  // ── UI state ──────────────────────────────────────

  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null)
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

  const isMilestoneEnabled = useCallback((procedureId: string, milestoneId: string): boolean => {
    return configs.some(
      c => c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId && c.is_enabled
    )
  }, [configs])

  // ── Refetch configs from DB ────────────────────────

  const refetchConfigs = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('procedure_milestone_templates')
      .select('id, procedure_type_template_id, milestone_type_id, display_order')

    if (!fetchError && data) {
      setConfigs(data.map(c => ({
        id: c.id,
        procedure_type_id: c.procedure_type_template_id,
        facility_milestone_id: c.milestone_type_id,
        display_order: c.display_order,
        is_enabled: true,
      })))
    }
  }, [supabase])

  // ── Core toggle: handles single or multiple milestone IDs ──

  const toggleMilestoneIds = useCallback(async (procedureId: string, milestoneIds: string[]) => {
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

      // Templates use DELETE (no is_enabled toggle)
      const deletePromises = milestoneIds.map(mid =>
        supabase
          .from('procedure_milestone_templates')
          .delete()
          .eq('procedure_type_template_id', procedureId)
          .eq('milestone_type_id', mid)
      )
      const results = await Promise.all(deletePromises)

      if (results.some(r => r.error)) {
        showToast({ type: 'error', title: 'Failed to remove milestone. Reverting change.' })
        await refetchConfigs()
      }
    } else {
      // Optimistically add placeholders
      const optimisticConfigs: ProcedureMilestoneConfigItem[] = milestoneIds.map(mid => {
        const m = milestoneTypes.find(mt => mt.id === mid)
        return {
          id: `optimistic-${mid}`,
          procedure_type_id: procedureId,
          facility_milestone_id: mid,
          display_order: m?.display_order || 0,
          is_enabled: true,
        }
      })
      setConfigs(prev => [...prev, ...optimisticConfigs])

      // For paired milestones, delete first to avoid unique constraint violation
      if (milestoneIds.length > 1) {
        await Promise.all(milestoneIds.map(mid =>
          supabase
            .from('procedure_milestone_templates')
            .delete()
            .eq('procedure_type_template_id', procedureId)
            .eq('milestone_type_id', mid)
        ))
      }

      const rows = milestoneIds.map(mid => {
        const m = milestoneTypes.find(mt => mt.id === mid)
        return {
          procedure_type_template_id: procedureId,
          milestone_type_id: mid,
          display_order: m?.display_order || 0,
        }
      })

      const { data, error: insertError } = await supabase
        .from('procedure_milestone_templates')
        .insert(rows)
        .select()

      if (insertError || !data) {
        showToast({ type: 'error', title: 'Failed to add milestone. Reverting change.' })
        await refetchConfigs()
      } else {
        // Replace optimistic entries with real DB rows
        setConfigs(prev => {
          const cleaned = prev.filter(
            c => !c.id.startsWith('optimistic-') &&
              !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
          )
          const mapped = data.map(d => ({
            id: d.id,
            procedure_type_id: d.procedure_type_template_id,
            facility_milestone_id: d.milestone_type_id,
            display_order: d.display_order,
            is_enabled: true,
          }))
          return [...cleaned, ...mapped]
        })
      }
    }

    clearSaving(procedureId, milestoneIds)
    opKeys.forEach(k => pendingOps.current.delete(k))
  }, [milestoneTypes, isMilestoneEnabled, markSaving, clearSaving, showToast, supabase, refetchConfigs])

  // ── Toggle handlers ───────────────────────────────

  const toggleMilestone = useCallback((procedureId: string, milestoneId: string) => {
    toggleMilestoneIds(procedureId, [milestoneId])
  }, [toggleMilestoneIds])

  const togglePairedMilestone = useCallback((procedureId: string, startMilestoneId: string) => {
    const startMilestone = milestoneTypes.find(m => m.id === startMilestoneId)
    if (!startMilestone) return

    const milestoneIds = startMilestone.pair_with_id
      ? [startMilestoneId, startMilestone.pair_with_id]
      : [startMilestoneId]

    toggleMilestoneIds(procedureId, milestoneIds)
  }, [milestoneTypes, toggleMilestoneIds])

  // ── Reorder handler ───────────────────────────────

  const handleReorder = useCallback(async (procedureId: string, _phaseGroup: string, orderedMilestoneIds: string[]) => {
    // Optimistic update
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
        const { error: updateError } = await supabase
          .from('procedure_milestone_templates')
          .update({ display_order: idx + 1 })
          .eq('procedure_type_template_id', procedureId)
          .eq('milestone_type_id', milestoneId)
        if (updateError) throw updateError
      }
    } catch {
      showToast({ type: 'error', title: 'Failed to save new order' })
      await refetchConfigs()
    }
  }, [supabase, showToast, refetchConfigs])

  // ── Bulk actions ──────────────────────────────────

  const enableAllMilestones = useCallback(async (procedureId: string) => {
    // Skip boundary milestones (already locked on) and already enabled
    const toEnable = milestoneTypes.filter(m =>
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
      procedure_type_template_id: procedureId,
      milestone_type_id: m.id,
      display_order: m.display_order,
    }))

    const { data, error: insertError } = await supabase
      .from('procedure_milestone_templates')
      .insert(rows)
      .select()

    if (insertError || !data) {
      showToast({ type: 'error', title: 'Failed to enable all milestones. Reverting.' })
      await refetchConfigs()
    } else {
      setConfigs(prev => {
        const cleaned = prev.filter(
          c => !c.id.startsWith('optimistic-') &&
            !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
        )
        const mapped = data.map(d => ({
          id: d.id,
          procedure_type_id: d.procedure_type_template_id,
          facility_milestone_id: d.milestone_type_id,
          display_order: d.display_order,
          is_enabled: true,
        }))
        return [...cleaned, ...mapped]
      })
    }

    clearSaving(procedureId, milestoneIds)
  }, [milestoneTypes, isMilestoneEnabled, boundaryMilestoneIds, markSaving, clearSaving, showToast, supabase, refetchConfigs])

  const disableAllMilestones = useCallback(async (procedureId: string) => {
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
        .from('procedure_milestone_templates')
        .delete()
        .eq('procedure_type_template_id', procedureId)
        .eq('milestone_type_id', mid)
    )
    const results = await Promise.all(deletePromises)

    if (results.some(r => r.error)) {
      showToast({ type: 'error', title: 'Failed to clear milestones. Reverting.' })
      await refetchConfigs()
    }

    clearSaving(procedureId, milestoneIds)
  }, [configs, boundaryMilestoneIds, markSaving, clearSaving, showToast, supabase, refetchConfigs])

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
  const totalVisibleMilestones = mappedMilestones.filter(m => m.pair_position !== 'end').length

  // ── Render ───────────────────────────────────────

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <PageLoader message="Loading procedure milestone templates..." />
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <button
                onClick={() => router.push('/admin/settings')}
                className="hover:text-slate-700 transition-colors"
              >
                Admin Settings
              </button>
              <span>/</span>
              <span className="text-slate-900">Procedure Milestones</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Default Procedure Milestones</h1>
            <p className="text-slate-500 mt-1">
              Configure which milestones are assigned to each procedure type by default.
              Milestones are grouped by phase with drag-to-reorder support.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Template configurations only apply during facility creation.</p>
                <p className="mt-1">
                  When you create a new facility with &ldquo;Create default procedures&rdquo; enabled,
                  these milestone configurations will be automatically applied. Existing facilities are NOT affected.
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Procedures</p>
              <p className="text-2xl font-bold text-slate-900">{procedures.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Milestone Types</p>
              <p className="text-2xl font-bold text-slate-900">{totalVisibleMilestones}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Total Configurations</p>
              <p className="text-2xl font-bold text-slate-900">{configs.length}</p>
            </div>
          </div>

          {/* Procedure List */}
          <div className="space-y-3">
            {procedures.map(procedure => {
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
                          {procedure.body_region?.name && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {procedure.body_region.name}
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
                      {/* Progress indicator */}
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
                      milestones={mappedMilestones}
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
                      milestonesSettingsUrl="/admin/settings/milestones"
                      milestonesSettingsLabel="Need a new milestone type? Create one in Milestone Types settings"
                    />
                  )}
                </div>
              )
            })}

            {procedures.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white border border-slate-200 rounded-xl">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No default procedure types configured.</p>
                <button
                  onClick={() => router.push('/admin/settings/procedure-types')}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  Add procedure types first
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </DashboardLayout>
  )
}
