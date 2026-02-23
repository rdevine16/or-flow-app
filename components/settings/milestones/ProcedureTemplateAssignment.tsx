// components/settings/milestones/ProcedureTemplateAssignment.tsx
// Tab 4: Procedure → Template assignment.
// Searchable procedure list with template picker per procedure.
// Shows full visual timeline preview when a template is selected.
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
import { ChevronDown, Check, LayoutTemplate } from 'lucide-react'
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
  const [saving, setSaving] = useState<string | null>(null) // procedure id being saved

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

  // Group template items by template_id for quick lookup
  const templateItemsMap = useMemo(() => {
    const map = new Map<string, TemplateItemData[]>()
    for (const item of allTemplateItems || []) {
      const existing = map.get(item.template_id) || []
      existing.push(item)
      map.set(item.template_id, existing)
    }
    return map
  }, [allTemplateItems])

  // Filtered procedures
  const filteredProcedures = useMemo(() => {
    if (!search.trim()) return procedures || []
    const q = search.toLowerCase()
    return (procedures || []).filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    )
  }, [procedures, search])

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

  // ── Helper: get effective template for a procedure ────

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
      <div className="space-y-2">
        <Skeleton className="h-10 w-64 rounded-md mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search procedures..."
          className="flex-1 max-w-sm"
        />
        <span className="text-xs text-slate-400">
          {filteredProcedures.length} procedure{filteredProcedures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Procedure table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_280px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Procedure</span>
          <span>Category</span>
          <span>Milestone Template</span>
        </div>

        {/* Rows */}
        {filteredProcedures.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            {search ? 'No procedures match your search.' : 'No procedures configured yet.'}
          </div>
        ) : (
          filteredProcedures.map(proc => {
            const effectiveTemplate = getEffectiveTemplate(proc)
            const isExplicit = !!proc.milestone_template_id
            const isSaving = saving === proc.id
            const templateItems = effectiveTemplate
              ? templateItemsMap.get(effectiveTemplate.id) || []
              : []

            return (
              <div
                key={proc.id}
                className="px-4 py-3 border-b border-slate-100 last:border-b-0"
              >
                {/* Main row */}
                <div className="grid grid-cols-[1fr_100px_280px] gap-2 items-center">
                  {/* Procedure name */}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900 truncate block">
                      {proc.name}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="text-xs text-slate-500 truncate">
                    {proc.category_name || <span className="text-slate-300">&mdash;</span>}
                  </div>

                  {/* Template picker */}
                  <TemplatePicker
                    templates={templates || []}
                    value={proc.milestone_template_id}
                    defaultTemplate={defaultTemplate}
                    saving={isSaving}
                    onChange={(templateId) => handleAssign(proc.id, templateId)}
                  />
                </div>

                {/* Timeline preview */}
                {effectiveTemplate && templateItems.length > 0 && (
                  <div className={`mt-2 ${!isExplicit ? 'opacity-60' : ''}`}>
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

      {/* Summary */}
      <div className="mt-3 px-3.5 py-2 bg-white rounded-md border border-slate-100 text-xs text-slate-400 flex items-center justify-between">
        <span>
          {(procedures || []).filter(p => p.milestone_template_id).length} of {(procedures || []).length} procedures have explicit template assignments
        </span>
      </div>
    </>
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
          w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border text-sm text-left transition-colors
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
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
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

