// app/admin/settings/notifications/page.tsx
// Manage the global notification type catalog — templates seeded to new facilities

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { genericAuditLog } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import {
  Archive,
  Bell,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  Info,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface NotificationTemplate {
  id: string
  notification_type: string
  category: string
  display_label: string
  description: string | null
  default_enabled: boolean
  default_channels: string[]
  display_order: number
  is_active: boolean
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// =====================================================
// CONSTANTS
// =====================================================

const CATEGORIES = [
  { key: 'case_alerts', label: 'Case Alerts', icon: ClipboardList },
  { key: 'schedule_alerts', label: 'Schedule Alerts', icon: CalendarDays },
  { key: 'tray_management', label: 'Tray Management', icon: FlaskConical },
  { key: 'reports', label: 'Reports & Summaries', icon: FileBarChart },
] as const

const CHANNEL_OPTIONS = [
  { key: 'push', label: 'Push' },
  { key: 'in_app', label: 'In-App' },
  { key: 'email', label: 'Email' },
] as const

// =====================================================
// COMPONENT
// =====================================================

export default function AdminNotificationTemplatesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const [saving, setSaving] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)

  // Form fields
  const [formType, setFormType] = useState('')
  const [formCategory, setFormCategory] = useState('case_alerts')
  const [formLabel, setFormLabel] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEnabled, setFormEnabled] = useState(false)
  const [formChannels, setFormChannels] = useState<string[]>([])

  // Archive view toggle
  const [showArchived, setShowArchived] = useState(false)

  // Archive confirmation
  const [archiveTarget, setArchiveTarget] = useState<NotificationTemplate | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch } = useSupabaseQuery<{
    templates: NotificationTemplate[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb.from('notification_settings_template').select('*')

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      query = query.order('display_order').order('display_label')
      const { data, error } = await query
      if (error) throw error

      const { count } = await sb
        .from('notification_settings_template')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)

      return { templates: data || [], archivedCount: count || 0 }
    },
    { deps: [showArchived], enabled: isGlobalAdmin }
  )

  const templates = queryData?.templates || []
  const archivedCount = queryData?.archivedCount || 0

  // Group templates by category
  const groupedTemplates = CATEGORIES.map((cat) => ({
    ...cat,
    items: templates.filter((t) => t.category === cat.key),
  })).filter((g) => g.items.length > 0)

  const resetForm = useCallback(() => {
    setFormType('')
    setFormCategory('case_alerts')
    setFormLabel('')
    setFormDescription('')
    setFormEnabled(false)
    setFormChannels([])
    setSelectedTemplate(null)
  }, [])

  const openAddModal = () => {
    setModalMode('add')
    resetForm()
    setModalOpen(true)
  }

  const openEditModal = (tmpl: NotificationTemplate) => {
    setModalMode('edit')
    setFormType(tmpl.notification_type)
    setFormCategory(tmpl.category)
    setFormLabel(tmpl.display_label)
    setFormDescription(tmpl.description || '')
    setFormEnabled(tmpl.default_enabled)
    setFormChannels([...tmpl.default_channels])
    setSelectedTemplate(tmpl)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    resetForm()
  }

  const toggleChannel = (channel: string) => {
    setFormChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  const handleSave = async () => {
    if (!formType.trim() || !formLabel.trim()) return
    setSaving(true)

    try {
      if (modalMode === 'add') {
        const maxOrder = templates.reduce((max, t) => Math.max(max, t.display_order), 0)

        const { data, error } = await supabase
          .from('notification_settings_template')
          .insert({
            notification_type: formType.trim(),
            category: formCategory,
            display_label: formLabel.trim(),
            description: formDescription.trim() || null,
            default_enabled: formEnabled,
            default_channels: formChannels,
            display_order: maxOrder + 1,
          })
          .select()
          .single()

        if (error) throw error

        await genericAuditLog(supabase, 'notification_template.created', {
          targetType: 'notification_template',
          targetId: data.id,
          targetLabel: formLabel.trim(),
          newValues: { notification_type: formType.trim(), category: formCategory },
        })

        showToast({ type: 'success', title: `"${formLabel.trim()}" created` })
        refetch()
      } else if (selectedTemplate) {
        const { error } = await supabase
          .from('notification_settings_template')
          .update({
            notification_type: formType.trim(),
            category: formCategory,
            display_label: formLabel.trim(),
            description: formDescription.trim() || null,
            default_enabled: formEnabled,
            default_channels: formChannels,
          })
          .eq('id', selectedTemplate.id)

        if (error) throw error

        await genericAuditLog(supabase, 'notification_template.updated', {
          targetType: 'notification_template',
          targetId: selectedTemplate.id,
          targetLabel: formLabel.trim(),
          oldValues: {
            notification_type: selectedTemplate.notification_type,
            default_enabled: selectedTemplate.default_enabled,
          },
          newValues: {
            notification_type: formType.trim(),
            default_enabled: formEnabled,
          },
        })

        showToast({ type: 'success', title: `"${formLabel.trim()}" updated` })
        refetch()
      }

      closeModal()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error saving notification template',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget || !currentUserId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('notification_settings_template')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUserId,
        })
        .eq('id', archiveTarget.id)

      if (error) throw error

      await genericAuditLog(supabase, 'notification_template.archived', {
        targetType: 'notification_template',
        targetId: archiveTarget.id,
        targetLabel: archiveTarget.display_label,
      })

      refetch()
      showToast({ type: 'success', title: `"${archiveTarget.display_label}" moved to archive` })
      setArchiveTarget(null)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error archiving notification template',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (tmpl: NotificationTemplate) => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('notification_settings_template')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', tmpl.id)

      if (error) throw error

      await genericAuditLog(supabase, 'notification_template.restored', {
        targetType: 'notification_template',
        targetId: tmpl.id,
        targetLabel: tmpl.display_label,
      })

      refetch()
      showToast({ type: 'success', title: `"${tmpl.display_label}" restored successfully` })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error restoring notification template',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  if (userLoading || !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container>
          <ErrorBanner message={error} />
          <div className="py-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">Notification Templates</h1>
            <p className="text-slate-500 mb-6">
              Default notification types seeded to new facilities
            </p>
            <PageLoader message="Loading notification templates..." />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <div className="py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Notification Templates</h1>
              <p className="text-slate-600 mt-1">
                Default notification types seeded to new facilities
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Archive Toggle */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  showArchived
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'View Active' : `Archive (${archivedCount})`}
              </button>

              {/* Add Notification Template - hide when viewing archived */}
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Notification
                </button>
              )}
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Template System</p>
                <p>
                  Changes apply to new facilities only. Existing facilities manage their own
                  notification preferences independently.
                </p>
              </div>
            </div>
          </div>

          <ErrorBanner message={error} />

          {loading ? (
            <PageLoader message="Loading notification templates..." />
          ) : templates.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {showArchived ? 'No Archived Notifications' : 'No Notification Templates'}
              </h3>
              <p className="text-slate-600 mb-4">
                {showArchived
                  ? 'No notification templates have been archived.'
                  : 'Add notification types that will be seeded to new facilities.'}
              </p>
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Notification
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedTemplates.map((group) => {
                const Icon = group.icon
                return (
                  <div
                    key={group.key}
                    className={`border rounded-xl overflow-hidden ${
                      showArchived
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Category Header */}
                    <div
                      className={`px-4 py-3 border-b flex items-center gap-3 ${
                        showArchived
                          ? 'bg-amber-100 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{group.label}</h3>
                        <span className="text-xs text-slate-500">
                          {group.items.length}{' '}
                          {group.items.length === 1 ? 'notification' : 'notifications'}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-200">
                      {group.items.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className={`px-4 py-3 flex items-center justify-between ${
                            showArchived ? '' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <p
                              className={
                                showArchived
                                  ? 'text-slate-500'
                                  : 'font-medium text-slate-900'
                              }
                            >
                              {tmpl.display_label}
                            </p>
                            {tmpl.description && (
                              <p className="text-sm text-slate-500 mt-0.5">{tmpl.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                                  tmpl.default_enabled
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {tmpl.default_enabled ? 'On by default' : 'Off by default'}
                              </span>
                              {tmpl.default_channels.length > 0 && (
                                <span className="text-xs text-slate-400">
                                  {tmpl.default_channels.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {showArchived ? (
                              <button
                                onClick={() => handleRestore(tmpl)}
                                disabled={saving}
                                className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditModal(tmpl)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setArchiveTarget(tmpl)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Container>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          modalMode === 'add' ? 'Add Notification Template' : 'Edit Notification Template'
        }
        size="md"
      >
        <div className="space-y-4">
          {/* Notification Type (slug) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notification Type <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g., case_started, delay_recorded"
              disabled={modalMode === 'edit'}
            />
            <p className="text-xs text-slate-400 mt-1">
              Unique key (snake_case). Cannot be changed after creation.
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Display Label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Display Label <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g., Call Next Patient"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g., Notify when a room is ready for the next patient"
            />
          </div>

          {/* Default Enabled */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Default Enabled</p>
              <p className="text-xs text-slate-400">
                Whether this notification is on by default for new facilities
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormEnabled(!formEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                formEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  formEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Default Channels */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Default Channels</p>
            <div className="flex items-center gap-3">
              {CHANNEL_OPTIONS.map((ch) => (
                <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formChannels.includes(ch.key)}
                    onChange={() => toggleChannel(ch.key)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{ch.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={closeModal} />
          <Modal.Action
            onClick={handleSave}
            loading={saving}
            disabled={!formType.trim() || !formLabel.trim()}
          >
            {modalMode === 'add' ? 'Add Notification' : 'Save Changes'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Archive Confirmation */}
      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        itemName={archiveTarget?.display_label || ''}
        itemType="notification template"
      />
    </DashboardLayout>
  )
}
