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
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Info, Pencil, Plus, User } from 'lucide-react'

interface BodyRegion {
  id: string
  name: string
  display_name: string
  display_order: number
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export default function AdminBodyRegionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

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
  const [showArchived, setShowArchived] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch: refetchData } = useSupabaseQuery<{
    regions: BodyRegion[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb.from('body_regions').select('*')

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data, error } = await query.order('display_order')
      if (error) throw error

      const { count } = await sb
        .from('body_regions')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)

      return { regions: data || [], archivedCount: count || 0 }
    },
    { deps: [showArchived], enabled: isGlobalAdmin }
  )

  const bodyRegions = queryData?.regions || []
  const archivedCount = queryData?.archivedCount || 0

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

  refetchData()
  resetForm()
  setShowAddModal(false)
} else if (error) {
  showToast({ type: 'error', title: error.message || 'The name might already exist' })
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

      refetchData()
      setShowEditModal(false)
      setEditingRegion(null)
      resetForm()
} else if (error) {
  showToast({ type: 'error', title: error instanceof Error ? error.message : 'Error updating body region' })
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
  refetchData()
  closeConfirmModal()
  showToast({ type: 'success', title: `"${region.display_name}" moved to archive` })
} else {
  showToast({ type: 'error', title: error.message || 'Error archiving body region' })
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
      refetchData()
      showToast({ type: 'success', title: `"${region.display_name}" restored successfully` })
    } else {
      showToast({ type: 'error', title: 'Failed to restore body region' })
    }
    setSaving(false)
  }

  if (userLoading || !isGlobalAdmin) {
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

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Body Regions</h1>
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
                  <Archive className="w-4 h-4" />
                  {showArchived ? 'View Active' : `Archive (${archivedCount})`}
                </button>

                {/* Add Region - hide when viewing archived */}
                {!showArchived && (
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
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
                  <User className="w-6 h-6 text-slate-400" />
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
                              className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
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
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(region)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
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
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
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
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm() }}
        title="Add Body Region"
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-600">*</span>
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

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowAddModal(false); resetForm() }} />
          <Modal.Action onClick={handleAdd} loading={saving} disabled={!formDisplayName.trim()}>
            Add Region
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && !!editingRegion}
        onClose={() => { setShowEditModal(false); setEditingRegion(null); resetForm() }}
        title="Edit Body Region"
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={editingRegion?.name ?? ''}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-600">*</span>
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

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowEditModal(false); setEditingRegion(null); resetForm() }} />
          <Modal.Action onClick={handleEdit} loading={saving} disabled={!formDisplayName.trim()}>
            Save Changes
          </Modal.Action>
        </Modal.Footer>
      </Modal>
      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'primary' ? 'info' : 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </DashboardLayout>
  )
}