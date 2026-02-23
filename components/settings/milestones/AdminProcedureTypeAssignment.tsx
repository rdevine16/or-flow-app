// components/settings/milestones/AdminProcedureTypeAssignment.tsx
// Admin Tab 4: Global procedure type → template type assignment.
// Mirrors ProcedureTemplateAssignment but queries global admin tables
// (procedure_type_templates, milestone_template_types, etc.) without facility scoping.
'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import { SearchInput } from '@/components/ui/SearchInput'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronDown, Check, LayoutTemplate, Info } from 'lucide-react'
import type { MilestoneTemplate } from '@/hooks/useTemplateBuilder'
import type { TemplateItemData, PhaseLookup, MilestoneLookup } from '@/lib/utils/buildTemplateRenderList'

// ─── Types ───────────────────────────────────────────────

interface ProcedureTypeTemplate {
  id: string
  name: string
  category: string | null
  milestone_template_type_id: string | null
}

// ─── Main Component ─────────────────────────────────────

export function AdminProcedureTypeAssignment() {
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const enabled = !userLoading && !!isGlobalAdmin

  // ── Fetch procedure type templates ───────────────────

  const {
    data: procedures,
    loading: proceduresLoading,
    error: proceduresError,
    setData: setProcedures,
  } = useSupabaseQuery<ProcedureTypeTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_type_templates')
        .select('id, name, category, milestone_template_type_id')
        .order('name')
      if (error) throw error
      return (data || []).map(d => ({
        id: d.id as string,
        name: d.name as string,
        category: (d.category as string | null) ?? null,
        milestone_template_type_id: (d.milestone_template_type_id as string | null) ?? null,
      }))
    },
    { deps: [], enabled },
  )

  // ── Fetch template types ────────────────────────────

  const {
    data: templates,
    loading: templatesLoading,
    error: templatesError,
  } = useSupabaseQuery<MilestoneTemplate[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_types')
        .select('id, name, description, is_default, is_active')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return (data || []).map(t => ({
        id: t.id as string,
        facility_id: '',
        name: t.name as string,
        description: (t.description as string | null) ?? null,
        is_default: t.is_default as boolean,
        is_active: t.is_active as boolean,
        deleted_at: null,
        deleted_by: null,
      }))
    },
    { deps: [], enabled },
  )

  // ── Fetch template items for chip previews ──────────

  const {
    data: allTemplateItems,
  } = useSupabaseQuery<TemplateItemData[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_template_type_items')
        .select('id, template_type_id, milestone_type_id, phase_template_id, display_order')
        .order('display_order')
      if (error) throw error
      return (data || []).map(i => ({
        id: i.id as string,
        template_id: i.template_type_id as string,
        facility_milestone_id: i.milestone_type_id as string,
        facility_phase_id: (i.phase_template_id as string | null) ?? null,
        display_order: i.display_order as number,
      }))
    },
    { deps: [], enabled },
  )

  // ── Fetch milestone types for chip labels ───────────

  const {
    data: milestones,
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

  // ── Fetch phase templates for chip colors ───────────

  const {
    data: phases,
  } = useSupabaseQuery<PhaseLookup[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('phase_templates')
        .select('id, name, display_name, color_key, display_order, parent_phase_template_id')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
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

  // ── Derived data ────────────────────────────────────

  const defaultTemplate = useMemo(
    () => (templates || []).find(t => t.is_default) ?? null,
    [templates],
  )

  const milestoneMap = useMemo(
    () => new Map((milestones || []).map(m => [m.id, m])),
    [milestones],
  )

  const phaseMap = useMemo(
    () => new Map((phases || []).map(p => [p.id, p])),
    [phases],
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

  const filteredProcedures = useMemo(() => {
    if (!search.trim()) return procedures || []
    const q = search.toLowerCase()
    return (procedures || []).filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    )
  }, [procedures, search])

  // ── Assign template type to procedure template ──────

  const handleAssign = useCallback(async (procedureId: string, templateTypeId: string | null) => {
    setSaving(procedureId)
    try {
      const { error } = await supabase
        .from('procedure_type_templates')
        .update({ milestone_template_type_id: templateTypeId })
        .eq('id', procedureId)

      if (error) throw error

      setProcedures((procedures || []).map(p =>
        p.id === procedureId ? { ...p, milestone_template_type_id: templateTypeId } : p,
      ))

      const templateName = templateTypeId
        ? (templates || []).find(t => t.id === templateTypeId)?.name ?? 'Unknown'
        : 'global default'
      showToast({ type: 'success', title: `Template updated to "${templateName}"` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to update template' })
    } finally {
      setSaving(null)
    }
  }, [supabase, procedures, setProcedures, templates, showToast])

  // ── Helper: get effective template for a procedure ──

  const getEffectiveTemplate = useCallback((proc: ProcedureTypeTemplate) => {
    if (proc.milestone_template_type_id) {
      return (templates || []).find(t => t.id === proc.milestone_template_type_id) ?? null
    }
    return defaultTemplate
  }, [templates, defaultTemplate])

  // ── Loading / Error ─────────────────────────────────

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
      {/* Info banner */}
      <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Assign milestone templates to global procedure types. These assignments seed new facilities via provisioning.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search procedure types..."
          className="flex-1 max-w-sm"
        />
        <span className="text-xs text-slate-400">
          {filteredProcedures.length} procedure type{filteredProcedures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Procedure table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_280px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Procedure Type</span>
          <span>Category</span>
          <span>Milestone Template</span>
        </div>

        {/* Rows */}
        {filteredProcedures.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            {search ? 'No procedure types match your search.' : 'No procedure types configured yet.'}
          </div>
        ) : (
          filteredProcedures.map(proc => {
            const effectiveTemplate = getEffectiveTemplate(proc)
            const isExplicit = !!proc.milestone_template_type_id
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
                    {proc.category || <span className="text-slate-300">&mdash;</span>}
                  </div>

                  {/* Template picker */}
                  <AdminTemplatePicker
                    templates={templates || []}
                    value={proc.milestone_template_type_id}
                    defaultTemplate={defaultTemplate}
                    saving={isSaving}
                    onChange={(templateId) => handleAssign(proc.id, templateId)}
                  />
                </div>

                {/* Milestone chips preview */}
                {effectiveTemplate && templateItems.length > 0 && (
                  <AdminMilestoneChips
                    items={templateItems}
                    milestoneMap={milestoneMap}
                    phaseMap={phaseMap}
                    isInherited={!isExplicit}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 px-3.5 py-2 bg-white rounded-md border border-slate-100 text-xs text-slate-400 flex items-center justify-between">
        <span>
          {(procedures || []).filter(p => p.milestone_template_type_id).length} of {(procedures || []).length} procedure types have explicit template assignments
        </span>
      </div>
    </>
  )
}

// ─── Template Picker Dropdown ──────────────────────────────

interface AdminTemplatePickerProps {
  templates: MilestoneTemplate[]
  value: string | null
  defaultTemplate: MilestoneTemplate | null
  saving: boolean
  onChange: (templateId: string | null) => void
}

function AdminTemplatePicker({ templates, value, defaultTemplate, saving, onChange }: AdminTemplatePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedTemplate = value ? templates.find(t => t.id === value) : null
  const displayName = selectedTemplate
    ? selectedTemplate.name
    : defaultTemplate
      ? `${defaultTemplate.name} (global default)`
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
            {/* Use global default option */}
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className={`w-4 h-4 flex items-center justify-center ${!value ? 'text-blue-600' : 'text-transparent'}`}>
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-500 italic">Use global default</span>
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

// ─── Milestone Chips ────────────────────────────────────────

interface AdminMilestoneChipsProps {
  items: TemplateItemData[]
  milestoneMap: Map<string, MilestoneLookup>
  phaseMap: Map<string, PhaseLookup>
  isInherited: boolean
}

function AdminMilestoneChips({ items, milestoneMap, phaseMap, isInherited }: AdminMilestoneChipsProps) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.display_order - b.display_order),
    [items],
  )

  return (
    <div className={`mt-2 flex flex-wrap gap-1 ${isInherited ? 'opacity-60' : ''}`}>
      {sorted.map(item => {
        const milestone = milestoneMap.get(item.facility_milestone_id)
        const phase = item.facility_phase_id ? phaseMap.get(item.facility_phase_id) : null
        const color = phase ? resolveColorKey(phase.color_key) : null

        return (
          <span
            key={item.id}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight"
            style={color ? {
              backgroundColor: `${color.hex}15`,
              color: color.hex,
              border: `1px solid ${color.hex}30`,
            } : {
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
            }}
          >
            {milestone?.display_name ?? 'Unknown'}
          </span>
        )
      })}
    </div>
  )
}
