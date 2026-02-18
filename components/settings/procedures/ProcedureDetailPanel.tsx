// components/settings/procedures/ProcedureDetailPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { procedureAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Input, Select, Label } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Loading'
import { Archive, Undo2, Clock, Search } from 'lucide-react'
import { SurgeonOverrideList } from './SurgeonOverrideList'
import type { SurgeonOverride } from './SurgeonOverrideList'

// =====================================================
// TYPES
// =====================================================

interface BodyRegion {
  id: string
  name: string
  display_name: string
}

interface ProcedureTechnique {
  id: string
  name: string
  display_name: string
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
  body_region_id: string | null
}

export interface ProcedureType {
  id: string
  name: string
  body_region_id: string | null
  technique_id: string | null
  procedure_category_id: string | null
  implant_category: string | null
  expected_duration_minutes: number | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  body_regions: BodyRegion | BodyRegion[] | null
  procedure_techniques: ProcedureTechnique | ProcedureTechnique[] | null
  procedure_categories: ProcedureCategory | ProcedureCategory[] | null
}

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface ProcedureFormData {
  name: string
  body_region_id: string
  technique_id: string
  procedure_category_id: string
  implant_category: string
  expected_duration_minutes: string
}

const IMPLANT_CATEGORIES = [
  { value: '', label: 'None' },
  { value: 'total_hip', label: 'Total Hip' },
  { value: 'total_knee', label: 'Total Knee' },
]

const EMPTY_FORM: ProcedureFormData = {
  name: '',
  body_region_id: '',
  technique_id: '',
  procedure_category_id: '',
  implant_category: '',
  expected_duration_minutes: '',
}

interface ProcedureDetailPanelProps {
  procedure: ProcedureType | null
  mode: 'view' | 'add'
  facilityId: string
  canManage: boolean
  bodyRegions: BodyRegion[]
  techniques: ProcedureTechnique[]
  procedureCategories: ProcedureCategory[]
  surgeons: Surgeon[]
  overrides: SurgeonOverride[]
  currentUserId: string | null
  onSaved: (procedure: ProcedureType, isNew: boolean) => void
  onArchived: (procedureId: string) => void
  onRestored: (procedure: ProcedureType) => void
  onCancelAdd: () => void
  onOverrideAdded: (override: SurgeonOverride) => void
  onOverrideUpdated: (override: SurgeonOverride) => void
  onOverrideRemoved: (overrideId: string) => void
}

// =====================================================
// COMPONENT
// =====================================================

export function ProcedureDetailPanel({
  procedure,
  mode,
  facilityId,
  canManage,
  bodyRegions,
  techniques,
  procedureCategories,
  surgeons,
  overrides,
  currentUserId,
  onSaved,
  onArchived,
  onRestored,
  onCancelAdd,
  onOverrideAdded,
  onOverrideUpdated,
  onOverrideRemoved,
}: ProcedureDetailPanelProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [formData, setFormData] = useState<ProcedureFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync form data when procedure changes
  useEffect(() => {
    if (mode === 'add') {
      setFormData(EMPTY_FORM)
      setDirty(false)
      return
    }
    if (procedure) {
      setFormData({
        name: procedure.name,
        body_region_id: procedure.body_region_id || '',
        technique_id: procedure.technique_id || '',
        procedure_category_id: procedure.procedure_category_id || '',
        implant_category: procedure.implant_category || '',
        expected_duration_minutes: procedure.expected_duration_minutes != null
          ? String(procedure.expected_duration_minutes)
          : '',
      })
      setDirty(false)
    }
  }, [procedure?.id, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = <K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // Filter categories by selected body region
  const filteredCategories = formData.body_region_id
    ? procedureCategories.filter(c => !c.body_region_id || c.body_region_id === formData.body_region_id)
    : procedureCategories

  // =====================================================
  // PROCEDURE SELECT QUERY
  // =====================================================

  const PROCEDURE_SELECT = `
    id, name, body_region_id, technique_id, procedure_category_id,
    implant_category, expected_duration_minutes, is_active, deleted_at, deleted_by,
    body_regions (id, name, display_name),
    procedure_techniques (id, name, display_name),
    procedure_categories (id, name, display_name, body_region_id)
  `

  // =====================================================
  // SAVE HANDLER
  // =====================================================

  const handleSave = async () => {
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      const durationVal = formData.expected_duration_minutes
        ? parseInt(formData.expected_duration_minutes, 10)
        : null
      const durationClean = durationVal && !isNaN(durationVal) && durationVal > 0 ? durationVal : null

      if (mode === 'add') {
        const { data, error } = await supabase
          .from('procedure_types')
          .insert({
            name: formData.name.trim(),
            facility_id: facilityId,
            body_region_id: formData.body_region_id || null,
            technique_id: formData.technique_id || null,
            procedure_category_id: formData.procedure_category_id || null,
            implant_category: formData.implant_category || null,
            expected_duration_minutes: durationClean,
            is_active: true,
          })
          .select(PROCEDURE_SELECT)
          .single()

        if (error) throw error

        onSaved(data as ProcedureType, true)
        showToast({ type: 'success', title: 'Procedure created successfully' })
        await procedureAudit.created(supabase, formData.name.trim(), data.id)
      } else if (procedure) {
        const oldName = procedure.name
        const { data, error } = await supabase
          .from('procedure_types')
          .update({
            name: formData.name.trim(),
            body_region_id: formData.body_region_id || null,
            technique_id: formData.technique_id || null,
            procedure_category_id: formData.procedure_category_id || null,
            implant_category: formData.implant_category || null,
            expected_duration_minutes: durationClean,
          })
          .eq('id', procedure.id)
          .select(PROCEDURE_SELECT)
          .single()

        if (error) throw error

        onSaved(data as ProcedureType, false)
        setDirty(false)
        showToast({ type: 'success', title: 'Procedure updated successfully' })

        if (oldName !== formData.name.trim()) {
          await procedureAudit.updated(supabase, procedure.id, oldName, formData.name.trim())
        }
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: mode === 'add' ? 'Failed to create procedure' : 'Failed to update procedure',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // ARCHIVE / RESTORE
  // =====================================================

  const handleArchive = async () => {
    if (!procedure || !currentUserId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('procedure_types')
        .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
        .eq('id', procedure.id)

      if (error) throw error

      onArchived(procedure.id)
      showToast({ type: 'success', title: `"${procedure.name}" moved to archive` })
      await procedureAudit.deleted(supabase, procedure.name, procedure.id)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to archive procedure',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async () => {
    if (!procedure) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('procedure_types')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', procedure.id)

      if (error) throw error

      onRestored(procedure as ProcedureType)
      showToast({ type: 'success', title: `"${procedure.name}" restored successfully` })
      await procedureAudit.restored(supabase, procedure.name, procedure.id)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to restore procedure',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // EMPTY STATE
  // =====================================================

  if (!procedure && mode !== 'add') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
        <Search className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">Select a procedure</p>
        <p className="text-xs text-slate-400 mt-1">
          Choose a procedure from the list to view and edit its settings.
        </p>
      </div>
    )
  }

  const isArchived = procedure?.deleted_at != null

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {mode === 'add' ? 'New Procedure' : procedure?.name}
          </h2>
          {mode !== 'add' && isArchived && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-[3px] bg-amber-100 text-amber-700">
              ARCHIVED
            </span>
          )}
          {mode !== 'add' && !isArchived && procedure?.expected_duration_minutes && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-[3px] bg-blue-100 text-blue-700">
              {procedure.expected_duration_minutes} min
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'add' && (
            <button
              onClick={onCancelAdd}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          )}
          {canManage && mode !== 'add' && isArchived && (
            <button
              onClick={handleRestore}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Restore
            </button>
          )}
          {canManage && mode !== 'add' && !isArchived && (
            <button
              onClick={handleArchive}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-[520px] space-y-5">
          {/* Procedure Details Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Procedure Details
            </h3>

            <div>
              <Label htmlFor="procName">Procedure Name *</Label>
              <Input
                id="procName"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="e.g., Total Hip Replacement"
                disabled={!canManage || isArchived}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bodyRegion">Body Region</Label>
                <Select
                  id="bodyRegion"
                  value={formData.body_region_id}
                  onChange={e => updateField('body_region_id', e.target.value)}
                  disabled={!canManage || isArchived}
                >
                  <option value="">Select region...</option>
                  {bodyRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="procCategory">Category</Label>
                <Select
                  id="procCategory"
                  value={formData.procedure_category_id}
                  onChange={e => updateField('procedure_category_id', e.target.value)}
                  disabled={!canManage || isArchived}
                >
                  <option value="">Select category...</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="technique">Technique</Label>
                <Select
                  id="technique"
                  value={formData.technique_id}
                  onChange={e => updateField('technique_id', e.target.value)}
                  disabled={!canManage || isArchived}
                >
                  <option value="">Select technique...</option>
                  {techniques.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="implant">Implant Tracking</Label>
                <Select
                  id="implant"
                  value={formData.implant_category}
                  onChange={e => updateField('implant_category', e.target.value)}
                  disabled={!canManage || isArchived}
                >
                  {IMPLANT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Expected Duration Section */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Expected Duration
            </h3>
            <div>
              <Label htmlFor="duration">Base Duration (minutes)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="duration"
                  type="number"
                  value={formData.expected_duration_minutes}
                  onChange={e => updateField('expected_duration_minutes', e.target.value)}
                  placeholder="e.g., 90"
                  min={1}
                  disabled={!canManage || isArchived}
                  className="w-32"
                />
                <span className="text-sm text-slate-400">minutes</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Used for schedule timeline. Surgeon-specific overrides take priority.
              </p>
            </div>
          </div>

          {/* Surgeon Overrides Section (only for existing procedures, not archived) */}
          {mode !== 'add' && procedure && !isArchived && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <SurgeonOverrideList
                overrides={overrides}
                procedureId={procedure.id}
                facilityId={facilityId}
                surgeons={surgeons}
                canManage={canManage}
                onAdded={onOverrideAdded}
                onUpdated={onOverrideUpdated}
                onRemoved={onOverrideRemoved}
              />
            </div>
          )}

          {/* Save Button */}
          {canManage && !isArchived && (
            <div className="pt-3 border-t border-slate-200">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || (!dirty && mode !== 'add')}
              >
                {saving && <Spinner size="sm" color="white" />}
                {mode === 'add' ? 'Create Procedure' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
