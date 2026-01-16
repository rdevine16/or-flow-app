'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useUser } from '@/lib/UserContext'
import { genericAuditLog } from '@/lib/audit-logger'

interface BodyRegion {
  id: string
  name: string
  display_name: string
  display_order: number
  created_at: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  bodyRegion: BodyRegion | null
}

export default function AdminBodyRegionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [bodyRegions, setBodyRegions] = useState<BodyRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', bodyRegion: null })
  const [formData, setFormData] = useState({ name: '', display_name: '', display_order: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
  }, [isGlobalAdmin])

  const fetchData = async () => {
    const { data } = await supabase
      .from('body_regions')
      .select('*')
      .order('display_order')

    setBodyRegions(data || [])
    setLoading(false)
  }

  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const openAddModal = () => {
    const maxOrder = Math.max(...bodyRegions.map(br => br.display_order), 0)
    setFormData({ name: '', display_name: '', display_order: maxOrder + 1 })
    setModal({ isOpen: true, mode: 'add', bodyRegion: null })
  }

  const openEditModal = (bodyRegion: BodyRegion) => {
    setFormData({ 
      name: bodyRegion.name, 
      display_name: bodyRegion.display_name,
      display_order: bodyRegion.display_order 
    })
    setModal({ isOpen: true, mode: 'edit', bodyRegion })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', bodyRegion: null })
    setFormData({ name: '', display_name: '', display_order: 0 })
  }

  const handleSave = async () => {
    if (!formData.display_name.trim()) return
    
    setSaving(true)
    const nameValue = formData.name.trim() || generateName(formData.display_name)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('body_regions')
        .insert({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
        })
        .select()
        .single()

      if (!error && data) {
        setBodyRegions([...bodyRegions, data].sort((a, b) => a.display_order - b.display_order))
        closeModal()
        await genericAuditLog(supabase, 'admin.body_region_created', {
          targetType: 'body_region',
          targetId: data.id,
          targetLabel: data.display_name,
          newValues: { name: data.name, display_name: data.display_name },
        })
      }
    } else if (modal.mode === 'edit' && modal.bodyRegion) {
      const oldName = modal.bodyRegion.display_name
      
      const { data, error } = await supabase
        .from('body_regions')
        .update({
          name: nameValue,
          display_name: formData.display_name.trim(),
          display_order: formData.display_order,
        })
        .eq('id', modal.bodyRegion.id)
        .select()
        .single()

      if (!error && data) {
        setBodyRegions(bodyRegions.map(br => br.id === data.id ? data : br).sort((a, b) => a.display_order - b.display_order))
        closeModal()
        await genericAuditLog(supabase, 'admin.body_region_updated', {
          targetType: 'body_region',
          targetId: data.id,
          targetLabel: data.display_name,
          oldValues: { display_name: oldName },
          newValues: { display_name: data.display_name },
        })
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const bodyRegion = bodyRegions.find(br => br.id === id)
    if (!bodyRegion) return

    const { error } = await supabase
      .from('body_regions')
      .delete()
      .eq('id', id)

    if (!error) {
      setBodyRegions(bodyRegions.filter(br => br.id !== id))
      setDeleteConfirm(null)
      await genericAuditLog(supabase, 'admin.body_region_deleted', {
        targetType: 'body_region',
        targetId: id,
        targetLabel: bodyRegion.display_name,
      })
    }
  }

  if (userLoading || loading) {
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

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Body Regions</h1>
              <p className="text-slate-500 mt-1">
                Anatomical regions used to categorize procedures and analytics.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Body Region
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {bodyRegions.length} body region{bodyRegions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {bodyRegions.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
                <p>No body regions defined</p>
                <button
                  onClick={openAddModal}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add your first body region
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Display Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Internal Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bodyRegions.map((bodyRegion) => (
                    <tr key={bodyRegion.id} className="group hover:bg-slate-50 transition-colors">
                      {/* Order */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400 font-medium">{bodyRegion.display_order}</span>
                      </td>

                      {/* Display Name */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{bodyRegion.display_name}</span>
                      </td>

                      {/* Internal Name */}
                      <td className="px-4 py-3">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {bodyRegion.name}
                        </code>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {deleteConfirm === bodyRegion.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDelete(bodyRegion.id)}
                              className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(bodyRegion)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(bodyRegion.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700 mb-1">About body regions</p>
                <p>
                  Body regions are used to group procedure categories and types for filtering and analytics. 
                  For example, "Hip" and "Knee" are common body regions for orthopedic procedures.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {modal.mode === 'add' ? 'Add Body Region' : 'Edit Body Region'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    display_name: e.target.value,
                    name: generateName(e.target.value)
                  })}
                  placeholder="e.g., Shoulder"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={formData.name || generateName(formData.display_name)}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1}
                />
                <p className="text-xs text-slate-500 mt-1">Lower numbers appear first in lists</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.display_name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Body Region' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}