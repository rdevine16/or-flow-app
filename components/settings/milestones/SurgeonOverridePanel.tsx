// components/settings/milestones/SurgeonOverridePanel.tsx
// Tab 5: Surgeon template overrides.
// Left panel: searchable surgeon list with override count badges.
// Right panel: procedure list for selected surgeon with template pickers.
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { TemplateTimelinePreview } from './TemplateTimelinePreview'
import { SearchInput } from '@/components/ui/SearchInput'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronDown, Check, LayoutTemplate, User, ArrowRight } from 'lucide-react'
import type { MilestoneTemplate } from '@/hooks/useTemplateBuilder'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'

// ─── Types ───────────────────────────────────────────────

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureWithTemplate {
  id: string
  name: string
  category_name: string | null
  milestone_template_id: string | null
}

interface SurgeonOverride {
  id: string
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  milestone_template_id: string
}

// ─── Main Component ─────────────────────────────────────

export function SurgeonOverridePanel() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const [surgeonSearch, setSurgeonSearch] = useState('')
  const [procedureSearch, setProcedureSearch] = useState('')
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // procedure_type_id being saved

  // ── Fetch surgeons ────────────────────────────────────

  const {
    data: surgeons,
    loading: surgeonsLoading,
    error: surgeonsError,
  } = useSupabaseQuery<Surgeon[]>(
    async (sb) => {
      // Get surgeon role ID
      const { data: role } = await sb
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      if (!role) return []

      const { data, error } = await sb
        .from('users')
        .select('id, first_name, last_name')
        .eq('facility_id', effectiveFacilityId!)
        .eq('role_id', role.id)
        .eq('is_active', true)
        .order('last_name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch procedures ──────────────────────────────────

  const {
    data: procedures,
    loading: proceduresLoading,
    error: proceduresError,
  } = useSupabaseQuery<ProcedureWithTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_types')
        .select('id, name, procedure_categories(display_name), milestone_template_id')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        category_name: ((d.procedure_categories as unknown) as { display_name: string } | null)?.display_name ?? null,
        milestone_template_id: d.milestone_template_id,
      }))
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch templates ───────────────────────────────────

  const {
    data: templates,
    loading: templatesLoading,
    error: templatesError,
  } = useSupabaseQuery<MilestoneTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_templates')
        .select('id, facility_id, name, description, is_default, is_active, deleted_at, deleted_by')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch all surgeon overrides for this facility ─────

  const {
    data: overrides,
    loading: overridesLoading,
    error: overridesError,
    setData: setOverrides,
  } = useSupabaseQuery<SurgeonOverride[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('surgeon_template_overrides')
        .select('id, facility_id, surgeon_id, procedure_type_id, milestone_template_id')
        .eq('facility_id', effectiveFacilityId!)
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch template items for chip previews ────────────

  const {
    data: allTemplateItems,
  } = useSupabaseQuery<TemplateItemData[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_items')
        .select('id, template_id, facility_milestone_id, facility_phase_id, display_order')
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId },
  )

  // ── Fetch milestones for chip labels ──────────────────

  const {
    data: milestones,
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

  // ── Fetch phases for chip colors ──────────────────────

  const {
    data: phases,
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

  // ── Derived data ──────────────────────────────────────

  const defaultTemplate = useMemo(
    () => (templates || []).find(t => t.is_default) ?? null,
    [templates],
  )

  const templateItemsMap = useMemo(() => {
    const map = new Map<string, TemplateItemData[]>()
    for (const item of allTemplateItems || []) {
      const existing = map.get(item.template_id) || []
      existing.push(item)
      map.set(item.template_id, existing)
    }
    return map
  }, [allTemplateItems])

  // Override count per surgeon
  const overrideCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of overrides || []) {
      map.set(o.surgeon_id, (map.get(o.surgeon_id) || 0) + 1)
    }
    return map
  }, [overrides])

  // Overrides for the selected surgeon
  const selectedSurgeonOverrides = useMemo(() => {
    if (!selectedSurgeonId) return []
    return (overrides || []).filter(o => o.surgeon_id === selectedSurgeonId)
  }, [overrides, selectedSurgeonId])

  // Override lookup: procedure_type_id → override
  const overrideLookup = useMemo(() => {
    const map = new Map<string, SurgeonOverride>()
    for (const o of selectedSurgeonOverrides) {
      map.set(o.procedure_type_id, o)
    }
    return map
  }, [selectedSurgeonOverrides])

  // Filtered surgeon list
  const filteredSurgeons = useMemo(() => {
    if (!surgeonSearch.trim()) return surgeons || []
    const q = surgeonSearch.toLowerCase()
    return (surgeons || []).filter(s =>
      `${s.last_name} ${s.first_name}`.toLowerCase().includes(q) ||
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    )
  }, [surgeons, surgeonSearch])

  // Filtered procedure list
  const filteredProcedures = useMemo(() => {
    if (!procedureSearch.trim()) return procedures || []
    const q = procedureSearch.toLowerCase()
    return (procedures || []).filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    )
  }, [procedures, procedureSearch])

  // Auto-select first surgeon
  useEffect(() => {
    if (surgeons && surgeons.length > 0 && !selectedSurgeonId) {
      setSelectedSurgeonId(surgeons[0].id)
    }
  }, [surgeons, selectedSurgeonId])

  const selectedSurgeon = useMemo(
    () => (surgeons || []).find(s => s.id === selectedSurgeonId) ?? null,
    [surgeons, selectedSurgeonId],
  )

  // ── Override mutations ────────────────────────────────

  const handleOverrideChange = useCallback(async (procedureTypeId: string, templateId: string | null) => {
    if (!selectedSurgeonId || !effectiveFacilityId) return

    setSaving(procedureTypeId)
    const existingOverride = overrideLookup.get(procedureTypeId)

    try {
      if (templateId === null) {
        // Remove override → use procedure default
        if (existingOverride) {
          const { error } = await supabase
            .from('surgeon_template_overrides')
            .delete()
            .eq('id', existingOverride.id)

          if (error) throw error

          setOverrides((overrides || []).filter(o => o.id !== existingOverride.id))
          showToast({ type: 'success', title: 'Override removed — using procedure default' })
        }
      } else if (existingOverride) {
        // Update existing override
        const { error } = await supabase
          .from('surgeon_template_overrides')
          .update({ milestone_template_id: templateId })
          .eq('id', existingOverride.id)

        if (error) throw error

        setOverrides((overrides || []).map(o =>
          o.id === existingOverride.id ? { ...o, milestone_template_id: templateId } : o,
        ))
        const name = (templates || []).find(t => t.id === templateId)?.name ?? 'Unknown'
        showToast({ type: 'success', title: `Override updated to "${name}"` })
      } else {
        // Create new override
        const { data: inserted, error } = await supabase
          .from('surgeon_template_overrides')
          .insert({
            facility_id: effectiveFacilityId,
            surgeon_id: selectedSurgeonId,
            procedure_type_id: procedureTypeId,
            milestone_template_id: templateId,
          })
          .select()
          .single()

        if (error) throw error

        setOverrides([...(overrides || []), inserted as SurgeonOverride])
        const name = (templates || []).find(t => t.id === templateId)?.name ?? 'Unknown'
        showToast({ type: 'success', title: `Override set to "${name}"` })
      }
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to update override' })
    } finally {
      setSaving(null)
    }
  }, [selectedSurgeonId, effectiveFacilityId, supabase, overrideLookup, overrides, setOverrides, templates, showToast])

  // ── Loading / Error ───────────────────────────────────

  const loading = surgeonsLoading || proceduresLoading || templatesLoading || overridesLoading
  const error = surgeonsError || proceduresError || templatesError || overridesError

  if (error) return <ErrorBanner message={error} />

  if (loading) {
    return (
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  if (!surgeons || surgeons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <User className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-1">No Surgeons</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          No surgeons found for this facility. Add surgeons in the Users settings to configure template overrides.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[500px]">
      {/* Left panel: Surgeon list */}
      <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <SearchInput
            value={surgeonSearch}
            onChange={setSurgeonSearch}
            placeholder="Search surgeons..."
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSurgeons.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              {surgeonSearch ? 'No surgeons match your search.' : 'No surgeons found.'}
            </div>
          ) : (
            filteredSurgeons.map(surgeon => {
              const overrideCount = overrideCountMap.get(surgeon.id) || 0
              const isSelected = selectedSurgeonId === surgeon.id

              return (
                <button
                  key={surgeon.id}
                  onClick={() => { setSelectedSurgeonId(surgeon.id); setProcedureSearch('') }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-slate-100 last:border-b-0 transition-colors
                    ${isSelected
                      ? 'bg-blue-50 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }
                  `}
                >
                  <div className="min-w-0">
                    <span className={`text-sm font-medium truncate block ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                      {surgeon.last_name}, {surgeon.first_name}
                    </span>
                  </div>
                  {overrideCount > 0 && (
                    <span className={`
                      ml-2 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold
                      ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'}
                    `}>
                      {overrideCount}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400">
          {filteredSurgeons.length} surgeon{filteredSurgeons.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Right panel: Procedure list for selected surgeon */}
      <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        {selectedSurgeon ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedSurgeon.first_name} {selectedSurgeon.last_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedSurgeonOverrides.length} override{selectedSurgeonOverrides.length !== 1 ? 's' : ''} configured
                </p>
              </div>
              <SearchInput
                value={procedureSearch}
                onChange={setProcedureSearch}
                placeholder="Filter procedures..."
                className="w-48"
              />
            </div>

            {/* Procedure list */}
            <div className="flex-1 overflow-y-auto">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_260px] gap-2 px-4 py-2 bg-white border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider sticky top-0">
                <span>Procedure</span>
                <span>Status</span>
                <span>Template</span>
              </div>

              {filteredProcedures.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  {procedureSearch ? 'No procedures match your filter.' : 'No procedures found.'}
                </div>
              ) : (
                filteredProcedures.map(proc => {
                  const override = overrideLookup.get(proc.id)
                  const hasOverride = !!override
                  const isSaving = saving === proc.id

                  // Effective template: override → procedure assignment → facility default
                  const effectiveTemplateId = hasOverride
                    ? override.milestone_template_id
                    : proc.milestone_template_id ?? defaultTemplate?.id ?? null

                  const effectiveTemplate = effectiveTemplateId
                    ? (templates || []).find(t => t.id === effectiveTemplateId) ?? null
                    : null

                  // Procedure-level template (for "Use procedure default" label)
                  const procedureTemplate = proc.milestone_template_id
                    ? (templates || []).find(t => t.id === proc.milestone_template_id) ?? null
                    : defaultTemplate

                  const templateItems = effectiveTemplate
                    ? templateItemsMap.get(effectiveTemplate.id) || []
                    : []

                  return (
                    <div
                      key={proc.id}
                      className={`px-4 py-3 border-b border-slate-100 last:border-b-0 ${hasOverride ? 'bg-amber-50/30' : ''}`}
                    >
                      {/* Main row */}
                      <div className="grid grid-cols-[1fr_80px_260px] gap-2 items-center">
                        {/* Procedure name */}
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-900 truncate block">
                            {proc.name}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div>
                          {hasOverride ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              Override
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                              Inherited
                            </span>
                          )}
                        </div>

                        {/* Template picker */}
                        <SurgeonTemplatePicker
                          templates={templates || []}
                          value={hasOverride ? override.milestone_template_id : null}
                          procedureTemplate={procedureTemplate}
                          saving={isSaving}
                          onChange={(templateId) => handleOverrideChange(proc.id, templateId)}
                        />
                      </div>

                      {/* Timeline preview */}
                      {effectiveTemplate && templateItems.length > 0 && (
                        <div className={`mt-2 ${!hasOverride ? 'opacity-60' : ''}`}>
                          <TemplateTimelinePreview
                            items={templateItems}
                            phases={phases || []}
                            milestones={milestones || []}
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ArrowRight className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Select a surgeon to view procedure overrides</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Surgeon Template Picker ────────────────────────────────

interface SurgeonTemplatePickerProps {
  templates: MilestoneTemplate[]
  value: string | null // null = no override (use procedure default)
  procedureTemplate: MilestoneTemplate | null
  saving: boolean
  onChange: (templateId: string | null) => void
}

function SurgeonTemplatePicker({ templates, value, procedureTemplate, saving, onChange }: SurgeonTemplatePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedTemplate = value ? templates.find(t => t.id === value) : null
  const hasOverride = !!value
  const displayName = hasOverride
    ? selectedTemplate?.name ?? 'Unknown'
    : procedureTemplate
      ? `${procedureTemplate.name} (procedure default)`
      : 'No template'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border text-sm text-left transition-colors
          ${hasOverride
            ? 'border-amber-200 bg-amber-50/50 text-slate-900'
            : 'border-slate-200 bg-slate-50 text-slate-500'
          }
          ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 cursor-pointer'}
        `}
      >
        <span className="truncate flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          {displayName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {/* Use procedure default */}
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className={`w-4 h-4 flex items-center justify-center ${!value ? 'text-blue-600' : 'text-transparent'}`}>
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-500 italic">Use procedure default</span>
              {procedureTemplate && (
                <span className="ml-auto text-xs text-slate-400 truncate max-w-[120px]">
                  ({procedureTemplate.name})
                </span>
              )}
            </button>

            {/* Template options */}
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`w-4 h-4 flex items-center justify-center ${value === t.id ? 'text-blue-600' : 'text-transparent'}`}>
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{t.name}</span>
                {t.is_default && (
                  <span className="ml-auto text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    DEFAULT
                  </span>
                )}
              </button>
            ))}

            {templates.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-400">
                No templates available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

