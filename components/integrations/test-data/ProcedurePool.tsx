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
import type { EhrTestProcedure, EhrTestProcedureInsert, EhrTestProcedureUpdate } from '@/lib/integrations/shared/integration-types'

const SPECIALTIES = [
  'Orthopedics', 'Ophthalmology', 'GI', 'Spine', 'General Surgery',
  'Urology', 'ENT', 'Cardiothoracic', 'Neurosurgery', 'Plastics', 'Vascular',
]

interface ProcedurePoolProps {
  facilityId: string
}

export default function ProcedurePool({ facilityId }: ProcedurePoolProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProcedure, setEditingProcedure] = useState<EhrTestProcedure | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EhrTestProcedure | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const [formName, setFormName] = useState('')
  const [formCpt, setFormCpt] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')

  const { data: procedures, loading, refetch } = useSupabaseQuery<EhrTestProcedure[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listProcedures(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  const filteredProcedures = (procedures || []).filter((p) =>
    !searchTerm ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpt_code?.includes(searchTerm) ||
    p.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdd = () => {
    setEditingProcedure(null)
    setFormName('')
    setFormCpt('')
    setFormDuration('')
    setFormSpecialty('')
    setShowForm(true)
  }

  const handleEdit = (proc: EhrTestProcedure) => {
    setEditingProcedure(proc)
    setFormName(proc.name)
    setFormCpt(proc.cpt_code || '')
    setFormDuration(proc.typical_duration_min?.toString() || '')
    setFormSpecialty(proc.specialty || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)

    try {
      if (editingProcedure) {
        const updates: EhrTestProcedureUpdate = {
          name: formName.trim(),
          cpt_code: formCpt.trim() || null,
          typical_duration_min: formDuration ? parseInt(formDuration, 10) : null,
          specialty: formSpecialty || null,
        }
        const { error } = await ehrTestDataDAL.updateProcedure(supabase, editingProcedure.id, updates)
        if (error) throw error
        showToast({ type: 'success', title: 'Procedure updated' })
      } else {
        const insert: EhrTestProcedureInsert = {
          facility_id: facilityId,
          name: formName.trim(),
          cpt_code: formCpt.trim() || undefined,
          typical_duration_min: formDuration ? parseInt(formDuration, 10) : undefined,
          specialty: formSpecialty || undefined,
        }
        const { error } = await ehrTestDataDAL.createProcedure(supabase, insert)
        if (error) throw error
        showToast({ type: 'success', title: 'Procedure added' })
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save procedure' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (proc: EhrTestProcedure) => {
    const { data: count } = await ehrTestDataDAL.countProcedureScheduleRefs(supabase, proc.id)
    setDeleteRefCount(count ?? 0)
    setDeleteTarget(proc)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deleteProcedure(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Procedure deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete procedure' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Procedures</h3>
              <Badge variant="default" size="sm">{procedures?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Procedure
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, CPT, or specialty..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredProcedures.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm ? 'No procedures match your search' : 'No procedures yet. Click "Add Procedure" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">CPT</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Duration</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Specialty</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProcedures.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.cpt_code || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.typical_duration_min ? `${p.typical_duration_min} min` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.specialty || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(p)}
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingProcedure ? 'Edit Procedure' : 'Add Procedure'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Total knee arthroplasty"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CPT Code</label>
              <input
                type="text"
                value={formCpt}
                onChange={(e) => setFormCpt(e.target.value)}
                placeholder="27447"
                maxLength={5}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Typical Duration (min)</label>
              <input
                type="number"
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                placeholder="120"
                min={1}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
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
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowForm(false)} />
          <Modal.Action onClick={handleSave} loading={saving} disabled={!formName.trim()}>
            {editingProcedure ? 'Save Changes' : 'Add Procedure'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete procedure?"
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
