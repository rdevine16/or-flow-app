// components/settings/milestones/ProcedureTemplateAssignment.tsx
// Tab 4: Procedure → Template assignment.
// 2-column layout: searchable procedure list (left) + template picker + timeline preview (right).
'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { TemplateTimelinePreview } from './TemplateTimelinePreview'
import { SearchInput } from '@/components/ui/SearchInput'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronDown, Check, LayoutTemplate, FileText } from 'lucide-react'
import type { MilestoneTemplate } from '@/hooks/useTemplateBuilder'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'

// ─── Types ───────────────────────────────────────────────

interface ProcedureWithTemplate {
  id: string
  name: string
  category_name: string | null
  milestone_template_id: string | null
}

// ─── Main Component ─────────────────────────────────────

export function ProcedureTemplateAssignment() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  // ── Fetch procedures ──────────────────────────────────

  const {
    data: procedures,
    loading: proceduresLoading,
    error: proceduresError,
    setData: setProcedures,
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
        .select('id, facility_id, name, description, is_default, is_active, deleted_at, deleted_by, block_order, sub_phase_map')
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

  // ── Fetch template items ──────────────────────────────

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

  // ── Fetch milestones ──────────────────────────────────

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

  // ── Fetch phases ──────────────────────────────────────

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

  // Template name lookup
  const templateNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of templates || []) {
      map.set(t.id, t.name)
    }
    return map
  }, [templates])

  const filteredProcedures = useMemo(() => {
    if (!search.trim()) return procedures || []
    const q = search.toLowerCase()
    return (procedures || []).filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    )
  }, [procedures, search])

  const selectedProcedure = useMemo(
    () => (procedures || []).find(p => p.id === selectedProcedureId) ?? null,
    [procedures, selectedProcedureId],
  )

  // ── Assign template to procedure ──────────────────────

  const handleAssign = useCallback(async (procedureId: string, templateId: string | null) => {
    setSaving(procedureId)
    try {
      const { error } = await supabase
        .from('procedure_types')
        .update({ milestone_template_id: templateId })
        .eq('id', procedureId)

      if (error) throw error

      setProcedures((procedures || []).map(p =>
        p.id === procedureId ? { ...p, milestone_template_id: templateId } : p,
      ))

      const templateName = templateId
        ? (templates || []).find(t => t.id === templateId)?.name ?? 'Unknown'
        : 'facility default'
      showToast({ type: 'success', title: `Template updated to "${templateName}"` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to update template' })
    } finally {
      setSaving(null)
    }
  }, [supabase, procedures, setProcedures, templates, showToast])

  // ── Helper: get effective template ────────────────────

  const getEffectiveTemplate = useCallback((proc: ProcedureWithTemplate) => {
    if (proc.milestone_template_id) {
      return (templates || []).find(t => t.id === proc.milestone_template_id) ?? null
    }
    return defaultTemplate
  }, [templates, defaultTemplate])

  // ── Loading / Error ───────────────────────────────────

  const loading = proceduresLoading || templatesLoading
  const error = proceduresError || templatesError

  if (error) return <ErrorBanner message={error} />

  if (loading) {
    return (
      <div className="grid grid-cols-[300px_1fr] gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </div>
    )
  }

  // ── Render: selected procedure detail ─────────────────

  const effectiveTemplate = selectedProcedure ? getEffectiveTemplate(selectedProcedure) : null
  const isExplicit = !!selectedProcedure?.milestone_template_id
  const templateItems = effectiveTemplate
    ? templateItemsMap.get(effectiveTemplate.id) || []
    : []

  return (
    <div
      className="grid grid-cols-[300px_1fr] gap-4"
      style={{ height: 'calc(100vh - 220px)' }}
    >
      {/* Left column: Procedure list */}
      <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search procedures..."
            className="w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredProcedures.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              {search ? 'No procedures match your search.' : 'No procedures configured yet.'}
            </div>
          ) : (
            filteredProcedures.map(proc => {
              const isSelected = selectedProcedureId === proc.id
              const assignedTemplateName = proc.milestone_template_id
                ? templateNameMap.get(proc.milestone_template_id)
                : null

              return (
                <button
                  key={proc.id}
                  onClick={() => setSelectedProcedureId(proc.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-slate-100 last:border-b-0 transition-colors
                    ${isSelected
                      ? 'bg-blue-50 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }
                  `}
                >
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm font-medium truncate block ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                      {proc.name}
                    </span>
                    {/* Template name badge */}
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                      {assignedTemplateName ?? (defaultTemplate ? `${defaultTemplate.name} (default)` : 'No template')}
                    </span>
                  </div>
                  {assignedTemplateName && (
                    <span className="ml-2 flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      <LayoutTemplate className="w-2.5 h-2.5 mr-0.5" />
                      {assignedTemplateName.length > 12
                        ? assignedTemplateName.slice(0, 12) + '...'
                        : assignedTemplateName}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400 flex items-center justify-between">
          <span>{filteredProcedures.length} procedure{filteredProcedures.length !== 1 ? 's' : ''}</span>
          <span>
            {(procedures || []).filter(p => p.milestone_template_id).length} assigned
          </span>
        </div>
      </div>

      {/* Right column: Template detail */}
      <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        {selectedProcedure ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                {selectedProcedure.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isExplicit ? 'Explicit template assignment' : 'Using facility default'}
              </p>
            </div>

            {/* Template picker */}
            <div className="px-4 py-3 border-b border-slate-100">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">
                Milestone Template
              </label>
              <TemplatePicker
                templates={templates || []}
                value={selectedProcedure.milestone_template_id}
                defaultTemplate={defaultTemplate}
                saving={saving === selectedProcedure.id}
                onChange={(templateId) => handleAssign(selectedProcedure.id, templateId)}
              />
            </div>

            {/* Timeline preview */}
            <div className="flex-1 overflow-y-auto p-4">
              {effectiveTemplate && templateItems.length > 0 ? (
                <div className={!isExplicit ? 'opacity-60' : ''}>
                  <TemplateTimelinePreview
                    items={templateItems}
                    phases={phases || []}
                    milestones={milestones || []}
                    subPhaseMap={effectiveTemplate.sub_phase_map}
                    blockOrder={effectiveTemplate.block_order}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LayoutTemplate className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No template assigned</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a procedure to view its template</p>
              <p className="text-xs text-slate-400 mt-1">Choose from the list on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Template Picker Dropdown ──────────────────────────────

interface TemplatePickerProps {
  templates: MilestoneTemplate[]
  value: string | null
  defaultTemplate: MilestoneTemplate | null
  saving: boolean
  onChange: (templateId: string | null) => void
}

function TemplatePicker({ templates, value, defaultTemplate, saving, onChange }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedTemplate = value ? templates.find(t => t.id === value) : null
  const displayName = selectedTemplate
    ? selectedTemplate.name
    : defaultTemplate
      ? `${defaultTemplate.name} (facility default)`
      : 'No template'
  const isInherited = !value

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors
          ${isInherited
            ? 'border-slate-200 bg-slate-50 text-slate-500'
            : 'border-blue-200 bg-blue-50/50 text-slate-900'
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {/* Use facility default option */}
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className={`w-4 h-4 flex items-center justify-center ${!value ? 'text-blue-600' : 'text-transparent'}`}>
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-500 italic">Use facility default</span>
              {defaultTemplate && (
                <span className="ml-auto text-xs text-slate-400 truncate max-w-[120px]">
                  ({defaultTemplate.name})
                </span>
              )}
            </button>

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
