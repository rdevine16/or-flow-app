// app/admin/settings/epic-field-mapping/PageClient.tsx
// Global admin page for managing FHIR-to-ORbit field mapping rules.
// All rows editable at once with a single "Save Changes" button (batch update).

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { epicAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, RotateCcw, Save } from 'lucide-react'
import type { EpicFieldMapping } from '@/lib/epic/types'
import { epicDAL } from '@/lib/dal'

// =====================================================
// TYPES
// =====================================================

/** Local editable copy of a field mapping row */
interface EditableMapping extends EpicFieldMapping {
  _dirty: boolean
}

// =====================================================
// COMPONENT
// =====================================================

export default function EpicFieldMappingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const [editableMappings, setEditableMappings] = useState<EditableMapping[]>([])
  const [saving, setSaving] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch field mappings
  const { data: mappings, loading, error, refetch: refetchData } = useSupabaseQuery<EpicFieldMapping[]>(
    async (sb) => {
      const { data, error: dalError } = await epicDAL.listFieldMappings(sb)
      if (dalError) throw dalError
      return data
    },
    { enabled: isGlobalAdmin }
  )

  // Sync fetched data into editable state
  useEffect(() => {
    if (mappings) {
      setEditableMappings(mappings.map(m => ({ ...m, _dirty: false })))
    }
  }, [mappings])

  // Track whether any rows have been edited
  const hasChanges = editableMappings.some(m => m._dirty)
  const changedCount = editableMappings.filter(m => m._dirty).length

  // Update a single field in a mapping row
  const updateField = useCallback(
    (id: string, field: keyof Pick<EpicFieldMapping, 'orbit_table' | 'orbit_column' | 'label' | 'description' | 'is_active'>, value: string | boolean) => {
      setEditableMappings(prev =>
        prev.map(m =>
          m.id === id ? { ...m, [field]: value, _dirty: true } : m
        )
      )
    },
    []
  )

  // Save all changed mappings
  const handleSave = async () => {
    const changed = editableMappings.filter(m => m._dirty)
    if (changed.length === 0) return

    setSaving(true)
    try {
      const { success, error: saveError } = await epicDAL.batchUpdateFieldMappings(
        supabase,
        changed.map(m => ({
          id: m.id,
          orbit_table: m.orbit_table,
          orbit_column: m.orbit_column,
          label: m.label,
          description: m.description ?? undefined,
          is_active: m.is_active,
        }))
      )

      if (!success) {
        showToast({ type: 'error', title: 'Save failed', message: saveError ?? undefined })
        return
      }

      await epicAudit.fieldMappingUpdated(supabase, changed.length)
      showToast({ type: 'success', title: `${changed.length} field mapping(s) saved` })
      refetchData()
    } catch {
      showToast({ type: 'error', title: 'Failed to save field mappings' })
    } finally {
      setSaving(false)
    }
  }

  // Reset to defaults
  const handleReset = async () => {
    setResetting(true)
    try {
      const { success, error: resetError } = await epicDAL.resetFieldMappingsToDefaults(supabase)
      if (!success) {
        showToast({ type: 'error', title: 'Reset failed', message: resetError ?? undefined })
        return
      }

      await epicAudit.fieldMappingReset(supabase)
      showToast({ type: 'success', title: 'Field mappings reset to defaults' })
      setShowResetModal(false)
      refetchData()
    } catch {
      showToast({ type: 'error', title: 'Failed to reset field mappings' })
    } finally {
      setResetting(false)
    }
  }

  // Group mappings by FHIR resource type for visual grouping
  const groupedMappings = editableMappings.reduce<Record<string, EditableMapping[]>>((acc, m) => {
    if (!acc[m.fhir_resource_type]) acc[m.fhir_resource_type] = []
    acc[m.fhir_resource_type].push(m)
    return acc
  }, {})

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} />
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Epic Field Mapping</h1>
              <p className="text-slate-500 mt-1">
                Configure how FHIR fields map to ORbit data. Changes apply to all future Epic imports.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : `Save Changes${changedCount > 0 ? ` (${changedCount})` : ''}`}
              </button>
            </div>
          </div>

          <ErrorBanner message={error} />

          {/* Unsaved changes banner */}
          {hasChanges && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              You have {changedCount} unsaved change{changedCount !== 1 ? 's' : ''}.
            </div>
          )}

          {/* Field Mapping Table */}
          {editableMappings.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-lg font-medium">No field mappings found</p>
              <p className="mt-1">Click &quot;Reset to Defaults&quot; to restore the default mappings.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">FHIR Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ORbit Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Label</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedMappings).map(([resourceType, rows]) => (
                    <GroupSection
                      key={resourceType}
                      resourceType={resourceType}
                      rows={rows}
                      onUpdateField={updateField}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reset Confirmation Modal */}
        <Modal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Reset Field Mappings"
        >
          <p className="text-sm text-slate-600 mb-4">
            This will delete all current field mappings and restore the default configuration.
            Any custom changes will be permanently lost.
          </p>
          <p className="text-sm font-medium text-red-600 mb-6">
            This action cannot be undone.
          </p>
          <Modal.Footer>
            <Modal.Cancel onClick={() => setShowResetModal(false)}>Cancel</Modal.Cancel>
            <Modal.Action
              onClick={handleReset}
              loading={resetting}
              variant="danger"
            >
              Reset to Defaults
            </Modal.Action>
          </Modal.Footer>
        </Modal>
      </Container>
    </DashboardLayout>
  )
}

// =====================================================
// GROUP SECTION — renders rows under a resource type header
// =====================================================

interface GroupSectionProps {
  resourceType: string
  rows: EditableMapping[]
  onUpdateField: (id: string, field: keyof Pick<EpicFieldMapping, 'orbit_table' | 'orbit_column' | 'label' | 'description' | 'is_active'>, value: string | boolean) => void
}

function GroupSection({ resourceType, rows, onUpdateField }: GroupSectionProps) {
  return (
    <>
      {/* Group header row */}
      <tr className="bg-slate-50/50">
        <td colSpan={5} className="px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {resourceType}
          </span>
        </td>
      </tr>

      {/* Mapping rows */}
      {rows.map(mapping => (
        <MappingRow
          key={mapping.id}
          mapping={mapping}
          onUpdateField={onUpdateField}
        />
      ))}
    </>
  )
}

// =====================================================
// MAPPING ROW — single editable row
// =====================================================

interface MappingRowProps {
  mapping: EditableMapping
  onUpdateField: (id: string, field: keyof Pick<EpicFieldMapping, 'orbit_table' | 'orbit_column' | 'label' | 'description' | 'is_active'>, value: string | boolean) => void
}

function MappingRow({ mapping, onUpdateField }: MappingRowProps) {
  const rowClass = mapping._dirty
    ? 'border-b border-slate-100 bg-amber-50/40'
    : 'border-b border-slate-100 hover:bg-slate-50/50'

  return (
    <tr className={rowClass}>
      {/* Active toggle */}
      <td className="px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={mapping.is_active}
          onClick={() => onUpdateField(mapping.id, 'is_active', !mapping.is_active)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            mapping.is_active ? 'bg-blue-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              mapping.is_active ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </td>

      {/* FHIR Source (read-only) */}
      <td className="px-4 py-3">
        <div className="text-sm text-slate-900 font-medium">{mapping.fhir_resource_type}</div>
        <div className="text-xs text-slate-500 font-mono">{mapping.fhir_field_path}</div>
      </td>

      {/* ORbit Target (editable) */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={mapping.orbit_table}
            onChange={e => onUpdateField(mapping.id, 'orbit_table', e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            placeholder="table"
          />
          <span className="text-slate-300 self-center">.</span>
          <input
            type="text"
            value={mapping.orbit_column}
            onChange={e => onUpdateField(mapping.id, 'orbit_column', e.target.value)}
            className="w-32 px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            placeholder="column"
          />
        </div>
      </td>

      {/* Label (editable) */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={mapping.label}
          onChange={e => onUpdateField(mapping.id, 'label', e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Label"
        />
      </td>

      {/* Description (editable) */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={mapping.description ?? ''}
          onChange={e => onUpdateField(mapping.id, 'description', e.target.value)}
          className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-600"
          placeholder="Description"
        />
      </td>
    </tr>
  )
}
