// app/admin/settings/implant-companies/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { useUser } from '@/lib/UserContext'
import { genericAuditLog } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Archive, Building2, Info, Pencil, Plus, Search } from 'lucide-react'

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
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
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', company: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ImplantCompany | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch: refetchData } = useSupabaseQuery<{
    companies: ImplantCompany[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb.from('implant_companies').select('*').is('facility_id', null)

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data, error } = await query.order('name')
      if (error) throw error

      const { count } = await sb
        .from('implant_companies')
        .select('id', { count: 'exact', head: true })
        .is('facility_id', null)
        .not('deleted_at', 'is', null)

      return { companies: data || [], archivedCount: count || 0 }
    },
    { deps: [showArchived], enabled: isGlobalAdmin }
  )

  const companies = queryData?.companies || []
  const archivedCount = queryData?.archivedCount || 0

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
        refetchData()
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
        refetchData()
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
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId
      })
      .eq('id', id)

    if (!error) {
      refetchData()
      setArchiveTarget(null)
      showToast({ type: 'success', title: `"${company.name}" moved to archive` })
      await genericAuditLog(supabase, 'admin.implant_company_deleted', {
        targetType: 'implant_company',
        targetId: id,
        targetLabel: company.name,
      })
    }
  }

  const handleRestore = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company) return

    const { error } = await supabase
      .from('implant_companies')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', id)

    if (!error) {
      refetchData()
      showToast({ type: 'success', title: `"${company.name}" restored successfully` })
      await genericAuditLog(supabase, 'admin.implant_company_restored', {
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
          <ErrorBanner message={error} />
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
              <h1 className="text-2xl font-semibold text-slate-900">
                {showArchived ? 'Archived Implant Companies' : 'Global Implant Companies'}
              </h1>
              <p className="text-slate-500 mt-1">
                {showArchived 
                  ? 'Archived global implant manufacturers'
                  : 'Standard implant manufacturers available to all facilities.'
                }
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

              {/* Add Company - hide when viewing archived */}
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Company
                </button>
              )}
            </div>
          </div>

          {/* Stats & Search Bar */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <span className="text-sm text-slate-500">
              {filteredCompanies.length} of {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
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
                        {showArchived ? (
                          <button
                            onClick={() => handleRestore(company.id)}
                            className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            Restore
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(company)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setArchiveTarget(company)}
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
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
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
                  Company Name <span className="text-red-600">*</span>
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

      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) await handleDelete(archiveTarget.id)
        }}
        itemName={archiveTarget?.name || ''}
        itemType="implant company"
      />
    </DashboardLayout>
  )
}