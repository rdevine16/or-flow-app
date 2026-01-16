'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useUser } from '@/lib/UserContext'
import { genericAuditLog } from '@/lib/audit-logger'

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
  created_at: string
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  company: ImplantCompany | null
}

export default function AdminImplantCompaniesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', company: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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
      .from('implant_companies')
      .select('*')
      .is('facility_id', null)
      .order('name')

    setCompanies(data || [])
    setLoading(false)
  }

  const openAddModal = () => {
    setFormData({ name: '' })
    setModal({ isOpen: true, mode: 'add', company: null })
  }

  const openEditModal = (company: ImplantCompany) => {
    setFormData({ name: company.name })
    setModal({ isOpen: true, mode: 'edit', company })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', company: null })
    setFormData({ name: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    
    setSaving(true)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('implant_companies')
        .insert({
          name: formData.name.trim(),
          facility_id: null,
        })
        .select()
        .single()

      if (!error && data) {
        setCompanies([...companies, data].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        await genericAuditLog(supabase, 'admin.implant_company_created', {
          targetType: 'implant_company',
          targetId: data.id,
          targetLabel: data.name,
          newValues: { name: data.name },
        })
      }
    } else if (modal.mode === 'edit' && modal.company) {
      const oldName = modal.company.name
      
      const { data, error } = await supabase
        .from('implant_companies')
        .update({
          name: formData.name.trim(),
        })
        .eq('id', modal.company.id)
        .select()
        .single()

      if (!error && data) {
        setCompanies(companies.map(c => c.id === data.id ? data : c).sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        await genericAuditLog(supabase, 'admin.implant_company_updated', {
          targetType: 'implant_company',
          targetId: data.id,
          targetLabel: data.name,
          oldValues: { name: oldName },
          newValues: { name: data.name },
        })
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company) return

    const { error } = await supabase
      .from('implant_companies')
      .delete()
      .eq('id', id)

    if (!error) {
      setCompanies(companies.filter(c => c.id !== id))
      setDeleteConfirm(null)
      await genericAuditLog(supabase, 'admin.implant_company_deleted', {
        targetType: 'implant_company',
        targetId: id,
        targetLabel: company.name,
      })
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
              <h1 className="text-2xl font-semibold text-slate-900">Global Implant Companies</h1>
              <p className="text-slate-500 mt-1">
                Standard implant manufacturers available to all facilities.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Company
            </button>
          </div>

          {/* Stats & Search Bar */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
            </span>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {companies.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p>No implant companies defined</p>
                <button
                  onClick={openAddModal}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Add your first company
                </button>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>No companies match "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} className="group hover:bg-slate-50 transition-colors">
                      {/* Company Name */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{company.name}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {deleteConfirm === company.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDelete(company.id)}
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
                              onClick={() => openEditModal(company)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(company.id)}
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
                <p className="font-medium text-slate-700 mb-1">About implant companies</p>
                <p>
                  These are global implant manufacturers available to all facilities. Facilities can also 
                  create their own custom companies. Common examples include Stryker, Zimmer Biomet, 
                  Smith & Nephew, and DePuy Synthes.
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
              {modal.mode === 'add' ? 'Add Implant Company' : 'Edit Implant Company'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Stryker"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
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
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Company' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
