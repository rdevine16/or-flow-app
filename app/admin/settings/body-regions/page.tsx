// app/admin/settings/body-regions/page.tsx
// Manage body regions for procedure categorization

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { adminAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface BodyRegion {
  id: string
  name: string
  display_name: string
  display_order: number
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <div className="text-sm text-slate-600 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminBodyRegionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRegion, setEditingRegion] = useState<BodyRegion | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1)

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
  })
// Archive toggle
  const [showArchived, setShowArchived] = useState(false)
  const [archivedCount, setArchivedCount] = useState(0)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Current user for deleted_by tracking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

useEffect(() => {
    if (isGlobalAdmin) {
      fetchData()
    }
  }, [isGlobalAdmin, showArchived])

const fetchData = async () => {
    setLoading(true)

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    let query = supabase
      .from('body_regions')
      .select('*')

    if (showArchived) {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.order('display_order')

    if (!error && data) {
      setBodyRegions(data)
    }

    // Get archived count
    const { count } = await supabase
      .from('body_regions')
      .select('id', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)

    setArchivedCount(count || 0)
    setLoading(false)
  }

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // Generate internal name from display name
  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const resetForm = () => {
    setFormName('')
    setFormDisplayName('')
    setFormDisplayOrder(bodyRegions.length > 0 ? Math.max(...bodyRegions.map(r => r.display_order)) + 1 : 1)
  }

  const openAddModal = () => {
    resetForm()
    setFormDisplayOrder(bodyRegions.length > 0 ? Math.max(...bodyRegions.map(r => r.display_order)) + 1 : 1)
    setShowAddModal(true)
  }

  const openEditModal = (region: BodyRegion) => {
    setEditingRegion(region)
    setFormName(region.name)
    setFormDisplayName(region.display_name)
    setFormDisplayOrder(region.display_order)
    setShowEditModal(true)
  }

  const handleAdd = async () => {
    if (!formDisplayName.trim()) return

    setSaving(true)
    const name = formName.trim() || generateName(formDisplayName)

    const { data, error } = await supabase
      .from('body_regions')
      .insert({
        name,
        display_name: formDisplayName.trim(),
        display_order: formDisplayOrder,
      })
      .select()
      .single()

if (!error && data) {
  // Audit log
  await adminAudit.bodyRegionCreated(supabase, formDisplayName.trim(), data.id)

  setBodyRegions([...bodyRegions, data].sort((a, b) => a.display_order - b.display_order))
  resetForm()
  setShowAddModal(false)
} else if (error) {
  showToast(error.message || 'The name might already exist', 'error')
}
setSaving(false)
  }

  const handleEdit = async () => {
    if (!editingRegion || !formDisplayName.trim()) return

    setSaving(true)
    const oldDisplayName = editingRegion.display_name

    const { data, error } = await supabase
      .from('body_regions')
      .update({
        display_name: formDisplayName.trim(),
        display_order: formDisplayOrder,
      })
      .eq('id', editingRegion.id)
      .select()
      .single()

    if (!error && data) {
      // Audit log if name changed
      if (oldDisplayName !== formDisplayName.trim()) {
        await adminAudit.bodyRegionUpdated(supabase, editingRegion.id, oldDisplayName, formDisplayName.trim())
      }

      setBodyRegions(
        bodyRegions
          .map(r => r.id === editingRegion.id ? data : r)
          .sort((a, b) => a.display_order - b.display_order)
      )
      setShowEditModal(false)
      setEditingRegion(null)
      resetForm()
} else if (error) {
  showToast(error instanceof Error ? error.message : 'Error updating body region:', 'error')
}
    setSaving(false)
  }

const handleDelete = (region: BodyRegion) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Body Region',
      message: (
        <>
          Are you sure you want to archive <strong>{region.display_name}</strong>?
          <br /><br />
          <span className="text-slate-500">
            This body region will be hidden but can be restored later.
          </span>
        </>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        const { error } = await supabase
          .from('body_regions')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId
          })
          .eq('id', region.id)

        if (!error) {
  await adminAudit.bodyRegionDeleted(supabase, region.display_name, region.id)
  setBodyRegions(bodyRegions.filter(r => r.id !== region.id))
  setArchivedCount(prev => prev + 1)
  closeConfirmModal()
  showToast(`"${region.display_name}" moved to archive`, 'success')
} else {
  showToast(error.message || 'Error archiving body region', 'error')
}
        setSaving(false)
      },
    })
  }

  const handleRestore = async (region: BodyRegion) => {
    setSaving(true)
    const { error } = await supabase
      .from('body_regions')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', region.id)

    if (!error) {
      setBodyRegions(bodyRegions.filter(r => r.id !== region.id))
      setArchivedCount(prev => prev - 1)
      showToast(`"${region.display_name}" restored successfully`, 'success')
    } else {
      showToast('Failed to restore body region', 'error')
    }
    setSaving(false)
  }

  if (userLoading || !isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Body Regions</h1>
            <p className="text-slate-500 mt-1">
              Manage body regions used to categorize procedures across facilities.
            </p>
          </div>

          {/* Content Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Card Header */}
<div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">
                  {showArchived ? 'Archived Body Regions' : 'All Body Regions'}
                </h3>
                <p className="text-sm text-slate-500">{bodyRegions.length} regions {showArchived ? 'archived' : 'defined'}</p>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {showArchived ? 'View Active' : `Archive (${archivedCount})`}
                </button>

                {/* Add Region - hide when viewing archived */}
                {!showArchived && (
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Region
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bodyRegions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-slate-500 mb-2">No body regions defined yet</p>
                <button
                  onClick={openAddModal}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  Add your first body region
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Display Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Internal Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bodyRegions.map((region) => (
                      <tr key={region.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg">
                            {region.display_order}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900">{region.display_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {region.name}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {showArchived ? (
                            <button
                              onClick={() => handleRestore(region)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(region)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(region)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">How body regions work</p>
                <p>
                  Body regions are used to categorize procedures (e.g., Hip, Knee, Shoulder). 
                  They help organize procedure types and enable body-region-specific analytics. 
                  The display order controls how they appear in dropdowns throughout the app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Body Region</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g., Hip"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={formDisplayName ? generateName(formDisplayName) : 'e.g., hip'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lower numbers appear first in dropdowns
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!formDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Adding...' : 'Add Region'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Body Region</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={editingRegion.name}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lower numbers appear first in dropdowns
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingRegion(null)
                  resetForm()
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!formDisplayName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
{/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
        isLoading={saving}
      />
    </DashboardLayout>
  )
}