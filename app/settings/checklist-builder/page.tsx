// app/settings/checklist-builder/page.tsx
// Checklist Builder - Manage pre-op checklist fields

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useFeature, FEATURES } from '@/lib/features/useFeature'
import { TrialBanner } from '@/components/FeatureGate'
import { checkinAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Check, ClipboardCheck, Eye, EyeOff, GripHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface ChecklistField {
  id: string
  field_key: string
  display_label: string
  field_type: 'toggle' | 'dropdown' | 'text' | 'contact' | 'time' | 'number' | 'date'
  options: string[] | null
  default_value: string | null
  placeholder: string | null
  is_required: boolean
  show_on_escort_page: boolean
  display_order: number
  is_active: boolean
}

const FIELD_TYPES = [
  { value: 'toggle', label: 'Toggle (Yes/No)', icon: '✓' },
  { value: 'dropdown', label: 'Dropdown', icon: '▼' },
  { value: 'text', label: 'Text Input', icon: 'T' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'time', label: 'Time', icon: '⏱' },
  { value: 'contact', label: 'Contact Info', icon: '📞' },
]

// =====================================================
// FIELD ROW COMPONENT
// =====================================================

interface FieldRowProps {
  field: ChecklistField
  onEdit: (field: ChecklistField) => void
  onDelete: (field: ChecklistField) => void
  onToggleActive: (field: ChecklistField) => void
  isDragging?: boolean
}

function FieldRow({ field, onEdit, onDelete, onToggleActive }: FieldRowProps) {
  const typeInfo = FIELD_TYPES.find(t => t.value === field.field_type)

  return (
    <div className={`group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all ${
      !field.is_active ? 'opacity-50' : ''
    }`}>
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div className="cursor-grab text-slate-300 hover:text-slate-400">
          <GripHorizontal className="w-5 h-5" />
        </div>

        {/* Field Type Icon */}
        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-medium">
          {typeInfo?.icon || '?'}
        </div>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{field.display_label}</span>
            {field.is_required && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-600 rounded">
                Required
              </span>
            )}
            {field.show_on_escort_page && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-600 rounded">
                Escort
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span>{typeInfo?.label}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs">{field.field_key}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleActive(field)}
            className={`p-2 rounded-lg transition-colors ${
              field.is_active 
                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={field.is_active ? 'Disable' : 'Enable'}
          >
            {field.is_active ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => onEdit(field)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(field)}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// FIELD EDITOR MODAL
// =====================================================

interface FieldEditorModalProps {
  field: ChecklistField | null
  isNew: boolean
  onClose: () => void
  onSave: (field: Partial<ChecklistField>) => void
}

function FieldEditorModal({ field, isNew, onClose, onSave }: FieldEditorModalProps) {
  const [formData, setFormData] = useState({
    field_key: '',
    display_label: '',
    field_type: 'toggle' as ChecklistField['field_type'],
    options: [''],
    is_required: false,
    show_on_escort_page: false,
    placeholder: '',
  })

  useEffect(() => {
    if (field) {
      setFormData({
        field_key: field.field_key,
        display_label: field.display_label,
        field_type: field.field_type,
        options: field.options || [''],
        is_required: field.is_required,
        show_on_escort_page: field.show_on_escort_page,
        placeholder: field.placeholder || '',
      })
    }
  }, [field])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    // Generate field_key from label if new
    const fieldKey = isNew 
      ? formData.display_label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      : formData.field_key

    onSave({
      ...formData,
      field_key: fieldKey,
      options: formData.field_type === 'dropdown' ? formData.options.filter(o => o.trim()) : null,
    })
  }

  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ''] }))
  }

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((o, i) => i === index ? value : o)
    }))
  }

  if (!field && !isNew) return null

  return (
    <Modal open={true} onClose={onClose} title={isNew ? 'Add Checklist Field' : 'Edit Field'} scrollable>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Field Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.display_label}
              onChange={(e) => setFormData(prev => ({ ...prev, display_label: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Insurance Verified"
              required
            />
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Field Type
            </label>
            <select
              value={formData.field_type}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                field_type: e.target.value as ChecklistField['field_type'] 
              }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Options */}
          {formData.field_type === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Options
              </label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Option
                </button>
              </div>
            </div>
          )}

          {/* Placeholder */}
          {['text', 'number', 'contact'].includes(formData.field_type) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Placeholder text..."
              />
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-slate-900">Required Field</span>
                <p className="text-sm text-slate-500">Must be completed before check-in is finalized</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_on_escort_page}
                onChange={(e) => setFormData(prev => ({ ...prev, show_on_escort_page: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-slate-900">Show to Escort</span>
                <p className="text-sm text-slate-500">Visible on the public escort status page</p>
              </div>
            </label>
          </div>
        </form>

        <Modal.Footer>
          <Modal.Cancel onClick={onClose} />
          <Modal.Action onClick={() => handleSubmit()}>
            {isNew ? 'Add Field' : 'Save Changes'}
          </Modal.Action>
        </Modal.Footer>
    </Modal>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ChecklistBuilderPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userData, isAdmin, loading: userLoading } = useUser()
  const { isEnabled, isLoading: featureLoading } = useFeature(FEATURES.PATIENT_CHECKIN)
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const { data: fields, loading, error, setData: setFields } = useSupabaseQuery<ChecklistField[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('preop_checklist_fields')
        .select('*')
        .eq('facility_id', userData!.facilityId)
        .is('deleted_at', null)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [userData?.facilityId], enabled: !userLoading && !!userData?.facilityId }
  )

  const [editingField, setEditingField] = useState<ChecklistField | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Save field (create or update)
  const handleSaveField = async (fieldData: Partial<ChecklistField>) => {
    if (!userData?.facilityId) return

    if (isAddingNew) {
      // Create new field
      const newField = {
        ...fieldData,
        facility_id: userData.facilityId,
        display_order: (fields || []).length * 10,
        is_active: true,
      }

      const { data, error } = await supabase
        .from('preop_checklist_fields')
        .insert(newField)
        .select()
        .single()

      if (error) {
        showToast({
  type: 'error',
  title: 'Error creating field:',
  message: error instanceof Error ? error.message : 'Error creating field:'
})
      } else {
        setFields(prev => [...prev, data])
        setSuccessMessage('Field added')
        setTimeout(() => setSuccessMessage(null), 3000)

        // Audit
        await checkinAudit.checklistFieldCreated(
          supabase,
          data.display_label,
          data.id,
          userData.facilityId
        )
      }
    } else if (editingField) {
      // Update existing field
      const { error } = await supabase
        .from('preop_checklist_fields')
        .update(fieldData)
        .eq('id', editingField.id)

      if (error) {
        showToast({
  type: 'error',
  title: 'Error updating field:',
  message: error instanceof Error ? error.message : 'Error updating field:'
})
      } else {
        setFields(prev => prev.map(f => 
          f.id === editingField.id ? { ...f, ...fieldData } as ChecklistField : f
        ))
        setSuccessMessage('Field updated')
        setTimeout(() => setSuccessMessage(null), 3000)

        // Audit
        await checkinAudit.checklistFieldUpdated(
          supabase,
          editingField.id,
          editingField.display_label,
          fieldData.display_label || editingField.display_label,
          userData.facilityId
        )
      }
    }

    setEditingField(null)
    setIsAddingNew(false)
  }

  // Delete field (soft delete)
  const handleDeleteField = async (field: ChecklistField) => {
    if (!confirm(`Delete "${field.display_label}"? This cannot be undone.`)) return

    const { error } = await supabase
      .from('preop_checklist_fields')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId 
      })
      .eq('id', field.id)

    if (error) {
      showToast({
        type: 'error',
        title: 'Error deleting field',
        message: error.message
      })
    } else {
      setFields(prev => prev.filter(f => f.id !== field.id))
      setSuccessMessage('Field deleted')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Audit
      if (userData?.facilityId) {
        await checkinAudit.checklistFieldDeleted(
          supabase,
          field.display_label,
          field.id,
          userData.facilityId
        )
      }
    }
  }

  // Toggle field active state
  const handleToggleActive = async (field: ChecklistField) => {
    const newIsActive = !field.is_active

    const { error } = await supabase
      .from('preop_checklist_fields')
      .update({ is_active: newIsActive })
      .eq('id', field.id)

    if (error) {
      showToast({
        type: 'error',
        title: 'Error toggling field',
        message: error.message
      })
    } else {
      setFields(prev => prev.map(f => 
        f.id === field.id ? { ...f, is_active: newIsActive } : f
      ))
    }
  }

  // Feature not enabled
  if (!featureLoading && !isEnabled) {
    router.push('/settings/checkin')
    return null
  }

  return (
    <DashboardLayout>
      <ErrorBanner message={error} />
      <SettingsLayout 
        title="Checklist Builder" 
        description="Customize pre-op checklist fields"
      >
        {/* Trial Banner */}
        <TrialBanner feature={FEATURES.PATIENT_CHECKIN} />

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">{successMessage}</span>
          </div>
        )}

        {/* Header with Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-500">
              Drag fields to reorder. Toggle visibility for each field.
            </p>
          </div>
          <Button onClick={() => setIsAddingNew(true)}>
            <Plus className="w-4 h-4" />
            Add Field
          </Button>
        </div>

        {/* Fields List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (fields || []).length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No checklist fields</h3>
            <p className="text-slate-500 mb-4">Add your first field to start building your checklist</p>
            <button
              onClick={() => setIsAddingNew(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Field
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(fields || []).map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onEdit={setEditingField}
                onDelete={handleDeleteField}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}

        {/* Editor Modal */}
        {(editingField || isAddingNew) && (
          <FieldEditorModal
            field={editingField}
            isNew={isAddingNew}
            onClose={() => {
              setEditingField(null)
              setIsAddingNew(false)
            }}
            onSave={handleSaveField}
          />
        )}
      </SettingsLayout>
    </DashboardLayout>
  )
}