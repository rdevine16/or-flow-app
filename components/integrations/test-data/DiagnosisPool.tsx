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
import type { EhrTestDiagnosis, EhrTestDiagnosisInsert, EhrTestDiagnosisUpdate } from '@/lib/integrations/shared/integration-types'

const SPECIALTIES = [
  'Orthopedics', 'Ophthalmology', 'GI', 'Spine', 'General Surgery',
  'Urology', 'ENT', 'Cardiothoracic', 'Neurosurgery', 'Plastics', 'Vascular',
]

interface DiagnosisPoolProps {
  facilityId: string
}

export default function DiagnosisPool({ facilityId }: DiagnosisPoolProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDiagnosis, setEditingDiagnosis] = useState<EhrTestDiagnosis | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EhrTestDiagnosis | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const [formIcd10, setFormIcd10] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')

  const { data: diagnoses, loading, refetch } = useSupabaseQuery<EhrTestDiagnosis[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listDiagnoses(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  const filteredDiagnoses = (diagnoses || []).filter((d) =>
    !searchTerm ||
    d.icd10_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdd = () => {
    setEditingDiagnosis(null)
    setFormIcd10('')
    setFormDescription('')
    setFormSpecialty('')
    setShowForm(true)
  }

  const handleEdit = (diagnosis: EhrTestDiagnosis) => {
    setEditingDiagnosis(diagnosis)
    setFormIcd10(diagnosis.icd10_code)
    setFormDescription(diagnosis.description)
    setFormSpecialty(diagnosis.specialty || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formIcd10.trim() || !formDescription.trim()) return
    setSaving(true)

    try {
      if (editingDiagnosis) {
        const updates: EhrTestDiagnosisUpdate = {
          icd10_code: formIcd10.trim(),
          description: formDescription.trim(),
          specialty: formSpecialty || null,
        }
        const { error } = await ehrTestDataDAL.updateDiagnosis(supabase, editingDiagnosis.id, updates)
        if (error) throw error
        showToast({ type: 'success', title: 'Diagnosis updated' })
      } else {
        const insert: EhrTestDiagnosisInsert = {
          facility_id: facilityId,
          icd10_code: formIcd10.trim(),
          description: formDescription.trim(),
          specialty: formSpecialty || undefined,
        }
        const { error } = await ehrTestDataDAL.createDiagnosis(supabase, insert)
        if (error) throw error
        showToast({ type: 'success', title: 'Diagnosis added' })
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save diagnosis' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (diagnosis: EhrTestDiagnosis) => {
    const { data: count } = await ehrTestDataDAL.countDiagnosisScheduleRefs(supabase, diagnosis.id)
    setDeleteRefCount(count ?? 0)
    setDeleteTarget(diagnosis)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deleteDiagnosis(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Diagnosis deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete diagnosis' })
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
              <h3 className="text-base font-semibold text-slate-900">Diagnoses</h3>
              <Badge variant="default" size="sm">{diagnoses?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Diagnosis
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ICD-10 code, description, or specialty..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredDiagnoses.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm ? 'No diagnoses match your search' : 'No diagnoses yet. Click "Add Diagnosis" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">ICD-10</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Description</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Specialty</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDiagnoses.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{d.icd10_code}</td>
                      <td className="py-2.5 px-3 text-slate-700">{d.description}</td>
                      <td className="py-2.5 px-3 text-slate-600">{d.specialty || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(d)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(d)}
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
        title={editingDiagnosis ? 'Edit Diagnosis' : 'Add Diagnosis'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ICD-10 Code *</label>
            <input
              type="text"
              value={formIcd10}
              onChange={(e) => setFormIcd10(e.target.value)}
              placeholder="M17.11"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-400">Format: letter + digits + optional decimal (e.g., M17.11, S72.001A)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Primary osteoarthritis, right knee"
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
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowForm(false)} />
          <Modal.Action
            onClick={handleSave}
            loading={saving}
            disabled={!formIcd10.trim() || !formDescription.trim()}
          >
            {editingDiagnosis ? 'Save Changes' : 'Add Diagnosis'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete diagnosis?"
        message={
          deleteRefCount > 0
            ? `This will also delete ${deleteRefCount} schedule ${deleteRefCount === 1 ? 'entry' : 'entries'} that reference "${deleteTarget?.icd10_code} — ${deleteTarget?.description}".`
            : `Are you sure you want to delete "${deleteTarget?.icd10_code} — ${deleteTarget?.description}"?`
        }
        loading={deleting}
      />
    </>
  )
}
