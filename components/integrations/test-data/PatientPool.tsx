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
import type { EhrTestPatient, EhrTestPatientInsert, EhrTestPatientUpdate, EhrTestGender } from '@/lib/integrations/shared/integration-types'

const GENDERS: { value: EhrTestGender; label: string }[] = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
  { value: 'U', label: 'Unknown' },
]

interface PatientPoolProps {
  facilityId: string
}

export default function PatientPool({ facilityId }: PatientPoolProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPatient, setEditingPatient] = useState<EhrTestPatient | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EhrTestPatient | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formMrn, setFormMrn] = useState('')
  const [formDob, setFormDob] = useState('')
  const [formGender, setFormGender] = useState<EhrTestGender | ''>('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('')
  const [formZip, setFormZip] = useState('')
  const [formPhone, setFormPhone] = useState('')

  const { data: patients, loading, refetch } = useSupabaseQuery<EhrTestPatient[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listPatients(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  const filteredPatients = (patients || []).filter((p) =>
    !searchTerm ||
    p.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.mrn?.includes(searchTerm)
  )

  const resetForm = () => {
    setFormFirstName('')
    setFormLastName('')
    setFormMrn('')
    setFormDob('')
    setFormGender('')
    setFormAddress('')
    setFormCity('')
    setFormState('')
    setFormZip('')
    setFormPhone('')
  }

  const handleAdd = () => {
    setEditingPatient(null)
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (patient: EhrTestPatient) => {
    setEditingPatient(patient)
    setFormFirstName(patient.first_name)
    setFormLastName(patient.last_name)
    setFormMrn(patient.mrn || '')
    setFormDob(patient.date_of_birth || '')
    setFormGender(patient.gender || '')
    setFormAddress(patient.address_line || '')
    setFormCity(patient.city || '')
    setFormState(patient.state || '')
    setFormZip(patient.zip || '')
    setFormPhone(patient.phone || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formFirstName.trim() || !formLastName.trim()) return
    setSaving(true)

    try {
      if (editingPatient) {
        const updates: EhrTestPatientUpdate = {
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          mrn: formMrn.trim() || null,
          date_of_birth: formDob || null,
          gender: (formGender as EhrTestGender) || null,
          address_line: formAddress.trim() || null,
          city: formCity.trim() || null,
          state: formState.trim() || null,
          zip: formZip.trim() || null,
          phone: formPhone.trim() || null,
        }
        const { error } = await ehrTestDataDAL.updatePatient(supabase, editingPatient.id, updates)
        if (error) throw error
        showToast({ type: 'success', title: 'Patient updated' })
      } else {
        const insert: EhrTestPatientInsert = {
          facility_id: facilityId,
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          mrn: formMrn.trim() || undefined,
          date_of_birth: formDob || undefined,
          gender: (formGender as EhrTestGender) || undefined,
          address_line: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          state: formState.trim() || undefined,
          zip: formZip.trim() || undefined,
          phone: formPhone.trim() || undefined,
        }
        const { error } = await ehrTestDataDAL.createPatient(supabase, insert)
        if (error) throw error
        showToast({ type: 'success', title: 'Patient added' })
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save patient' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (patient: EhrTestPatient) => {
    const { data: count } = await ehrTestDataDAL.countPatientScheduleRefs(supabase, patient.id)
    setDeleteRefCount(count ?? 0)
    setDeleteTarget(patient)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deletePatient(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Patient deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete patient' })
    } finally {
      setDeleting(false)
    }
  }

  const getPatientName = (p: EhrTestPatient) => `${p.last_name}, ${p.first_name}`

  return (
    <>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Patients</h3>
              <Badge variant="default" size="sm">{patients?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Patient
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm ? 'No patients match your search' : 'No patients yet. Click "Add Patient" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">MRN</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">DOB</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Gender</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Phone</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{getPatientName(p)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.mrn || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.date_of_birth || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {GENDERS.find((g) => g.value === p.gender)?.label || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.phone || '—'}</td>
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
        title={editingPatient ? 'Edit Patient' : 'Add Patient'}
        size="lg"
        scrollable
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
              <input
                type="text"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                placeholder="Smith"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MRN</label>
              <input
                type="text"
                value={formMrn}
                onChange={(e) => setFormMrn(e.target.value)}
                placeholder="MRN12345"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={formDob}
                onChange={(e) => setFormDob(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={formGender}
                onChange={(e) => setFormGender(e.target.value as EhrTestGender | '')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Springfield"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
                placeholder="IL"
                maxLength={2}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
              <input
                type="text"
                value={formZip}
                onChange={(e) => setFormZip(e.target.value)}
                placeholder="62704"
                maxLength={10}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowForm(false)} />
          <Modal.Action
            onClick={handleSave}
            loading={saving}
            disabled={!formFirstName.trim() || !formLastName.trim()}
          >
            {editingPatient ? 'Save Changes' : 'Add Patient'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete patient?"
        message={
          deleteRefCount > 0
            ? `This will also delete ${deleteRefCount} schedule ${deleteRefCount === 1 ? 'entry' : 'entries'} that reference "${deleteTarget ? getPatientName(deleteTarget) : ''}".`
            : `Are you sure you want to delete "${deleteTarget ? getPatientName(deleteTarget) : ''}"?`
        }
        loading={deleting}
      />
    </>
  )
}
