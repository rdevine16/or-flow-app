// app/admin/checklist-templates/page.tsx
// Global Admin - Manage Pre-Op Checklist Field Templates
// These templates are copied to facilities when they are created

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Ban, CheckCircle2, ChevronRight, ClipboardCheck, Info, PenLine, Plus, Trash2, X } from 'lucide-react'


// =====================================================
// TYPES
// =====================================================

interface ChecklistFieldTemplate {
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
  created_at: string
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
  field: ChecklistFieldTemplate
  onEdit: (field: ChecklistFieldTemplate) => void
  onDelete: (field: ChecklistFieldTemplate) => void
  onToggleActive: (field: ChecklistFieldTemplate) => void
}

function FieldRow({ field, onEdit, onDelete, onToggleActive }: FieldRowProps) {
  const fieldTypeConfig = FIELD_TYPES.find(t => t.value === field.field_type)

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${
      field.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Field Type Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
            field.is_active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
          }`}>
            {fieldTypeConfig?.icon || '?'}
          </div>

          {/* Field Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900 truncate">{field.display_label}</h3>
              {field.is_required && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                  Required
                </span>
              )}
              {field.show_on_escort_page && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                  Escort Visible
                </span>
              )}
              {!field.is_active && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {fieldTypeConfig?.label || field.field_type}
              {field.field_type === 'dropdown' && field.options && (
                <span className="ml-2 text-slate-400">
                  ({field.options.length} options)
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">{field.field_key}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleActive(field)}
            className={`p-2 rounded-lg transition-colors ${
              field.is_active
                ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title={field.is_active ? 'Deactivate' : 'Activate'}
          >
            {field.is_active ? (
              <Ban className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(field)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PenLine className="w-4 h-4" />
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
  field: ChecklistFieldTemplate | null
  isNew: boolean
  onClose: () => void
  onSave: (field: Partial<ChecklistFieldTemplate>) => void
}

function FieldEditorModal({ field, isNew, onClose, onSave }: FieldEditorModalProps) {
  const [formData, setFormData] = useState({
    field_key: '',
    display_label: '',
    field_type: 'toggle' as ChecklistFieldTemplate['field_type'],
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
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
      options: prev.options.filter((_, i) => i !== index),
    }))
  }

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'Add Template Field' : 'Edit Template Field'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isNew 
              ? 'This field will be available to copy when creating new facilities'
              : 'Changes only affect new facilities, not existing ones'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Display Label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Display Label <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.display_label}
              onChange={(e) => setFormData(prev => ({ ...prev, display_label: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., ID Verified"
              required
            />
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Field Type <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.field_type}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                field_type: e.target.value as ChecklistFieldTemplate['field_type'] 
              }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {FIELD_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Options (conditional) */}
          {formData.field_type === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dropdown Options
              </label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Option ${index + 1}`}
                    />
                    {formData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
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

          {/* Placeholder (for text/number fields) */}
          {['text', 'number', 'contact'].includes(formData.field_type) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Placeholder Text
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Enter phone number..."
              />
            </div>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Required Field</span>
                <p className="text-xs text-slate-500">Must be completed before patient can proceed</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_on_escort_page}
                onChange={(e) => setFormData(prev => ({ ...prev, show_on_escort_page: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Show on Escort Page</span>
                <p className="text-xs text-slate-500">Visible to family/escorts on the public status page</p>
              </div>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isNew ? 'Add Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ChecklistTemplatesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const [editingField, setEditingField] = useState<ChecklistFieldTemplate | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Redirect non-global admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: fields, loading, error, refetch: refetchData } = useSupabaseQuery<ChecklistFieldTemplate[]>(
    async (sb) => {
      let query = sb
        .from('preop_checklist_field_templates')
        .select('*')
        .is('deleted_at', null)
        .order('display_order')

      if (!showInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    { deps: [showInactive], enabled: !userLoading && isGlobalAdmin }
  )

  // Save field (create or update)
  const handleSaveField = async (fieldData: Partial<ChecklistFieldTemplate>) => {
    if (isAddingNew) {
      // Create new template
      const newField = {
        ...fieldData,
        display_order: (fields || []).length + 1,
        is_active: true,
      }

      const { data, error } = await supabase
        .from('preop_checklist_field_templates')
        .insert(newField)
        .select()
        .single()

if (error) {
  showToast({
    type: 'error',
    title: 'Create Failed',
    message: error.message || 'Failed to create template'
  })
} else {
  refetchData()
  showToast({ type: 'success', title: 'Template created' })
}
    } else if (editingField) {
      // Update existing template
      const { error } = await supabase
        .from('preop_checklist_field_templates')
        .update({
          display_label: fieldData.display_label,
          field_type: fieldData.field_type,
          options: fieldData.options,
          placeholder: fieldData.placeholder,
          is_required: fieldData.is_required,
          show_on_escort_page: fieldData.show_on_escort_page,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingField.id)

      if (error) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: error.message || 'Failed to update template'
        })
      } else {
        refetchData()
        showToast({ type: 'success', title: 'Template updated' })
      }
    }

    setEditingField(null)
    setIsAddingNew(false)
  }

  // Delete template (soft delete)
  const handleDeleteField = async (field: ChecklistFieldTemplate) => {
    if (!confirm(`Delete "${field.display_label}"? This will not affect existing facilities.`)) return

    const { error } = await supabase
      .from('preop_checklist_field_templates')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId 
      })
      .eq('id', field.id)

    if (error) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Failed to delete template'
      })
    } else {
      refetchData()
      showToast({ type: 'success', title: 'Template deleted' })
    }
  }

  // Toggle active state
  const handleToggleActive = async (field: ChecklistFieldTemplate) => {
    const newActiveState = !field.is_active

    const { error } = await supabase
      .from('preop_checklist_field_templates')
      .update({ 
        is_active: newActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', field.id)

    if (error) {
      showToast({
        type: 'error',
        title: 'Toggle Failed',
        message: error.message || 'Failed to update template status'
      })
    } else {
      refetchData()
      showToast({ type: 'success', title: newActiveState ? 'Template activated' : 'Template deactivated' })
    }
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Not authorized
  if (!isGlobalAdmin) {
    return null
  }

  const activeCount = (fields || []).filter(f => f.is_active).length
  const inactiveCount = (fields || []).filter(f => !f.is_active).length

  return (
    <DashboardLayout>
      <ErrorBanner message={error} />
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <button 
              onClick={() => router.push('/admin')}
              className="hover:text-blue-600 transition-colors"
            >
              Admin
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900">Checklist Templates</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Pre-Op Checklist Templates</h1>
              <p className="text-slate-500 mt-1">
                Default checklist fields that are copied to new facilities during setup
              </p>
            </div>
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Template
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">How templates work</p>
              <p className="mt-1 text-blue-700">
                These templates are copied to facilities when they are created via the facility wizard.
                Changes here do not affect existing facilities — each facility has their own independent copy
                that they can customize.
              </p>
            </div>
          </div>
        </div>

        {/* Stats & Filter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              <span className="font-semibold text-slate-900">{activeCount}</span> active templates
            </span>
            {inactiveCount > 0 && (
              <span className="text-slate-500">
                <span className="font-medium">{inactiveCount}</span> inactive
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-slate-600">Show inactive</span>
          </label>
        </div>

        {/* Fields List */}
        {(fields || []).length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No templates found</h3>
            <p className="text-slate-500 mt-1">
              {showInactive 
                ? 'No checklist templates have been created yet.'
                : 'No active templates. Enable "Show inactive" to see all templates.'
              }
            </p>
            <button
              onClick={() => setIsAddingNew(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Template
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(fields || []).map(field => (
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

        {/* Usage Info */}
        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Template Usage</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span><strong>Toggle</strong> — Simple yes/no checkbox (most common for pre-op items)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span><strong>Dropdown</strong> — Select from predefined options</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span><strong>Text</strong> — Free-form text entry</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span><strong>Contact</strong> — Phone number or contact info</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
              <span><strong>Escort Visible</strong> — Fields marked as "Show on Escort Page" are visible to family members</span>
            </li>
          </ul>
        </div>

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
      </div>
    </DashboardLayout>
  )
}