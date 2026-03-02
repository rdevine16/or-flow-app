'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Loading'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import type { EhrTestSurgeon, EhrTestSurgeonInsert, EhrTestSurgeonUpdate } from '@/lib/integrations/shared/integration-types'

const SPECIALTIES = [
  'Orthopedics', 'Ophthalmology', 'GI', 'Spine', 'General Surgery',
  'Urology', 'ENT', 'Cardiothoracic', 'Neurosurgery', 'Plastics', 'Vascular',
]

interface SurgeonPoolProps {
  facilityId: string
}

export default function SurgeonPool({ facilityId }: SurgeonPoolProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSurgeon, setEditingSurgeon] = useState<EhrTestSurgeon | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<EhrTestSurgeon | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formNpi, setFormNpi] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')
  const [formExternalId, setFormExternalId] = useState('')

  // Fetch surgeons
  const { data: surgeons, loading, refetch } = useSupabaseQuery<EhrTestSurgeon[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listSurgeons(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  const filteredSurgeons = (surgeons || []).filter((s) =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.npi?.includes(searchTerm) ||
    s.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Open add form
  const handleAdd = () => {
    setEditingSurgeon(null)
    setFormName('')
    setFormNpi('')
    setFormSpecialty('')
    setFormExternalId('')
    setShowForm(true)
  }

  // Open edit form
  const handleEdit = (surgeon: EhrTestSurgeon) => {
    setEditingSurgeon(surgeon)
    setFormName(surgeon.name)
    setFormNpi(surgeon.npi || '')
    setFormSpecialty(surgeon.specialty || '')
    setFormExternalId(surgeon.external_provider_id || '')
    setShowForm(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)

    try {
      if (editingSurgeon) {
        const updates: EhrTestSurgeonUpdate = {
          name: formName.trim(),
          npi: formNpi.trim() || null,
          specialty: formSpecialty || null,
          external_provider_id: formExternalId.trim() || null,
        }
        const { error } = await ehrTestDataDAL.updateSurgeon(supabase, editingSurgeon.id, updates)
        if (error) throw error
        showToast({ type: 'success', title: 'Surgeon updated' })
      } else {
        const insert: EhrTestSurgeonInsert = {
          facility_id: facilityId,
          name: formName.trim(),
          npi: formNpi.trim() || undefined,
          specialty: formSpecialty || undefined,
          external_provider_id: formExternalId.trim() || undefined,
        }
        const { error } = await ehrTestDataDAL.createSurgeon(supabase, insert)
        if (error) throw error
        showToast({ type: 'success', title: 'Surgeon added' })
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save surgeon' })
    } finally {
      setSaving(false)
    }
  }

  // Confirm delete
  const handleDeleteClick = async (surgeon: EhrTestSurgeon) => {
    const { data: count } = await ehrTestDataDAL.countSurgeonScheduleRefs(supabase, surgeon.id)
    setDeleteRefCount(count ?? 0)
    setDeleteTarget(surgeon)
  }

  // Execute delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deleteSurgeon(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Surgeon deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete surgeon' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Surgeons</h3>
              <Badge variant="default" size="sm">{surgeons?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Surgeon
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, NPI, or specialty..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredSurgeons.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm ? 'No surgeons match your search' : 'No surgeons yet. Click "Add Surgeon" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">NPI</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Specialty</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">External ID</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSurgeons.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{s.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{s.npi || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{s.specialty || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-xs">{s.external_provider_id || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(s)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingSurgeon ? 'Edit Surgeon' : 'Add Surgeon'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="SMITH, JOHN A"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NPI</label>
            <input
              type="text"
              value={formNpi}
              onChange={(e) => setFormNpi(e.target.value)}
              placeholder="1234567890"
              maxLength={10}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
            <select
              value={formSpecialty}
              onChange={(e) => setFormSpecialty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select specialty...</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">External Provider ID</label>
            <input
              type="text"
              value={formExternalId}
              onChange={(e) => setFormExternalId(e.target.value)}
              placeholder="Epic provider ID"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowForm(false)} />
          <Modal.Action onClick={handleSave} loading={saving} disabled={!formName.trim()}>
            {editingSurgeon ? 'Save Changes' : 'Add Surgeon'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete surgeon?"
        message={
          deleteRefCount > 0
            ? `This will also delete ${deleteRefCount} schedule ${deleteRefCount === 1 ? 'entry' : 'entries'} that reference "${deleteTarget?.name}".`
            : `Are you sure you want to delete "${deleteTarget?.name}"?`
        }
        loading={deleting}
      />
    </>
  )
}
