// components/settings/procedures/SurgeonOverrideList.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Spinner } from '@/components/ui/Loading'
import { Plus, Pencil, Trash2, Check, X, User } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

export interface SurgeonOverride {
  id: string
  surgeon_id: string
  procedure_type_id: string
  expected_duration_minutes: number
}

interface SurgeonOverrideListProps {
  overrides: SurgeonOverride[]
  procedureId: string
  facilityId: string
  surgeons: Surgeon[]
  canManage: boolean
  onAdded: (override: SurgeonOverride) => void
  onUpdated: (override: SurgeonOverride) => void
  onRemoved: (overrideId: string) => void
}

// =====================================================
// COMPONENT
// =====================================================

export function SurgeonOverrideList({
  overrides,
  procedureId,
  facilityId,
  surgeons,
  canManage,
  onAdded,
  onUpdated,
  onRemoved,
}: SurgeonOverrideListProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  // UI state
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formSurgeonId, setFormSurgeonId] = useState('')
  const [formDuration, setFormDuration] = useState('')

  // Surgeons not yet overridden
  const availableSurgeons = surgeons.filter(
    s => !overrides.some(o => o.surgeon_id === s.id)
  )

  const getSurgeonName = (surgeonId: string) => {
    const surgeon = surgeons.find(s => s.id === surgeonId)
    return surgeon ? `${surgeon.last_name}, ${surgeon.first_name}` : 'Unknown'
  }

  // =====================================================
  // FORM HANDLERS
  // =====================================================

  const startAdd = () => {
    setFormSurgeonId(availableSurgeons[0]?.id || '')
    setFormDuration('')
    setAdding(true)
    setEditingId(null)
  }

  const startEdit = (override: SurgeonOverride) => {
    setFormSurgeonId(override.surgeon_id)
    setFormDuration(String(override.expected_duration_minutes))
    setEditingId(override.id)
    setAdding(false)
  }

  const cancelForm = () => {
    setAdding(false)
    setEditingId(null)
    setFormSurgeonId('')
    setFormDuration('')
  }

  const handleAdd = async () => {
    if (!formSurgeonId || !formDuration) return
    const duration = parseInt(formDuration, 10)
    if (isNaN(duration) || duration <= 0) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('surgeon_procedure_duration')
        .insert({
          facility_id: facilityId,
          surgeon_id: formSurgeonId,
          procedure_type_id: procedureId,
          expected_duration_minutes: duration,
        })
        .select('id, surgeon_id, procedure_type_id, expected_duration_minutes')
        .single()

      if (error) throw error

      onAdded(data as SurgeonOverride)
      cancelForm()
      showToast({ type: 'success', title: 'Surgeon override added' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to add override',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (overrideId: string) => {
    if (!formDuration) return
    const duration = parseInt(formDuration, 10)
    if (isNaN(duration) || duration <= 0) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('surgeon_procedure_duration')
        .update({ expected_duration_minutes: duration })
        .eq('id', overrideId)

      if (error) throw error

      const updated = overrides.find(o => o.id === overrideId)
      if (updated) {
        onUpdated({ ...updated, expected_duration_minutes: duration })
      }
      cancelForm()
      showToast({ type: 'success', title: 'Override updated' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to update override',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (overrideId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('surgeon_procedure_duration')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', overrideId)

      if (error) throw error

      onRemoved(overrideId)
      showToast({ type: 'success', title: 'Override removed' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to remove override',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-slate-700">Surgeon Overrides</h4>
          {overrides.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
              {overrides.length}
            </span>
          )}
        </div>
        {canManage && !adding && availableSurgeons.length > 0 && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Override
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Surgeon-specific expected durations override the base procedure duration.
      </p>

      {/* Override list */}
      <div className="space-y-1.5">
        {overrides.map(override => (
          <div key={override.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
            {editingId === override.id ? (
              <>
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1">
                  {getSurgeonName(override.surgeon_id)}
                </span>
                <input
                  type="number"
                  value={formDuration}
                  onChange={e => setFormDuration(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  min={1}
                  placeholder="min"
                />
                <span className="text-xs text-slate-400">min</span>
                <button
                  onClick={() => handleUpdate(override.id)}
                  disabled={saving || !formDuration}
                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                >
                  {saving ? <Spinner size="sm" color="blue" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={cancelForm}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1">
                  {getSurgeonName(override.surgeon_id)}
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {override.expected_duration_minutes} min
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => startEdit(override)}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(override.id)}
                      disabled={saving}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add form */}
        {adding && (
          <div className="flex items-center gap-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
            <User className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <select
              value={formSurgeonId}
              onChange={e => setFormSurgeonId(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {availableSurgeons.map(s => (
                <option key={s.id} value={s.id}>
                  {s.last_name}, {s.first_name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={formDuration}
              onChange={e => setFormDuration(e.target.value)}
              className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              min={1}
              placeholder="min"
              autoFocus
            />
            <span className="text-xs text-slate-400">min</span>
            <button
              onClick={handleAdd}
              disabled={saving || !formSurgeonId || !formDuration}
              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
            >
              {saving ? <Spinner size="sm" color="blue" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={cancelForm}
              className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Empty state */}
        {overrides.length === 0 && !adding && (
          <div className="py-3 text-center text-xs text-slate-400">
            No surgeon-specific overrides. All surgeons use the base duration.
          </div>
        )}
      </div>
    </div>
  )
}
