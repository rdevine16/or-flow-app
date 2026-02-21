// app/admin/settings/payers/page.tsx
// Manage default payer templates that get copied to new facilities

'use client'

import { useState, useEffect } from 'react'
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
import { Archive, CreditCard, Info, Pencil, Plus } from 'lucide-react'

interface PayerTemplate {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export default function AdminPayerTemplatesPage() {
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
  const [selectedPayer, setSelectedPayer] = useState<PayerTemplate | null>(null)
  const [payerName, setPayerName] = useState('')

  // Archive view toggle
  const [showArchived, setShowArchived] = useState(false)

  // Archive confirmation
  const [archiveTarget, setArchiveTarget] = useState<PayerTemplate | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const { data: queryData, loading, error, refetch } = useSupabaseQuery<{
    payers: PayerTemplate[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb.from('payer_templates').select('*')

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      query = query.order('display_order').order('name')
      const { data, error } = await query
      if (error) throw error

      const { count } = await sb
        .from('payer_templates')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)

      return { payers: data || [], archivedCount: count || 0 }
    },
    { deps: [showArchived], enabled: isGlobalAdmin }
  )

  const payers = queryData?.payers || []
  const archivedCount = queryData?.archivedCount || 0

  const openAddModal = () => {
    setModalMode('add')
    setPayerName('')
    setSelectedPayer(null)
    setModalOpen(true)
  }

  const openEditModal = (payer: PayerTemplate) => {
    setModalMode('edit')
    setPayerName(payer.name)
    setSelectedPayer(payer)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setPayerName('')
    setSelectedPayer(null)
  }

  const handleSave = async () => {
    if (!payerName.trim()) return
    setSaving(true)

    try {
      if (modalMode === 'add') {
        const maxOrder = payers.reduce((max, p) => Math.max(max, p.display_order), 0)

        const { data, error } = await supabase
          .from('payer_templates')
          .insert({
            name: payerName.trim(),
            display_order: maxOrder + 1,
          })
          .select()
          .single()

        if (error) throw error

        await genericAuditLog(supabase, 'payer_template.created', {
          targetType: 'payer_template',
          targetId: data.id,
          targetLabel: payerName.trim(),
          newValues: { name: payerName.trim() },
        })

        refetch()
      } else if (selectedPayer) {
        const { error } = await supabase
          .from('payer_templates')
          .update({ name: payerName.trim() })
          .eq('id', selectedPayer.id)

        if (error) throw error

        await genericAuditLog(supabase, 'payer_template.updated', {
          targetType: 'payer_template',
          targetId: selectedPayer.id,
          targetLabel: payerName.trim(),
          oldValues: { name: selectedPayer.name },
          newValues: { name: payerName.trim() },
        })

        refetch()
      }

      closeModal()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error saving payer template',
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
        .from('payer_templates')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUserId,
        })
        .eq('id', archiveTarget.id)

      if (error) throw error

      await genericAuditLog(supabase, 'payer_template.archived', {
        targetType: 'payer_template',
        targetId: archiveTarget.id,
        targetLabel: archiveTarget.name,
      })

      refetch()
      showToast({ type: 'success', title: `"${archiveTarget.name}" moved to archive` })
      setArchiveTarget(null)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error archiving payer template',
        message: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (payer: PayerTemplate) => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('payer_templates')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', payer.id)

      if (error) throw error

      await genericAuditLog(supabase, 'payer_template.restored', {
        targetType: 'payer_template',
        targetId: payer.id,
        targetLabel: payer.name,
      })

      refetch()
      showToast({ type: 'success', title: `"${payer.name}" restored successfully` })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error restoring payer template',
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
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">Payer Templates</h1>
            <p className="text-slate-500 mb-6">
              Default payers copied to new facilities during onboarding
            </p>
            <PageLoader message="Loading payer templates..." />
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
              <h1 className="text-2xl font-semibold text-slate-900">Payer Templates</h1>
              <p className="text-slate-600 mt-1">
                Default payers copied to new facilities during onboarding
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

              {/* Add Payer Template - hide when viewing archived */}
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Payer
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
                  payers independently.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <PageLoader message="Loading payer templates..." />
          ) : payers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {showArchived ? 'No Archived Payers' : 'No Payer Templates'}
              </h3>
              <p className="text-slate-600 mb-4">
                {showArchived
                  ? 'No payer templates have been archived.'
                  : 'Add payer templates that will be automatically copied to new facilities.'}
              </p>
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Payer
                </button>
              )}
            </div>
          ) : (
            <div className={`border rounded-xl overflow-hidden ${showArchived ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${showArchived ? 'bg-amber-100 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className="font-medium text-slate-900">
                  {showArchived ? 'Archived Payer Templates' : 'Active Payer Templates'}
                </h3>
                <span className="text-sm text-slate-500">
                  {payers.length} {payers.length === 1 ? 'payer' : 'payers'}
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {payers.map((payer) => (
                  <div
                    key={payer.id}
                    className={`px-4 py-3 flex items-center justify-between ${showArchived ? '' : 'hover:bg-slate-50'}`}
                  >
                    <span className={showArchived ? 'text-slate-500' : 'font-medium text-slate-900'}>
                      {payer.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {showArchived ? (
                        <button
                          onClick={() => handleRestore(payer)}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openEditModal(payer)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setArchiveTarget(payer)}
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
          )}
        </div>
      </Container>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === 'add' ? 'Add Payer Template' : 'Edit Payer Template'}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Payer Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g., Medicare, BCBS, Aetna"
            autoFocus
          />
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={closeModal} />
          <Modal.Action onClick={handleSave} loading={saving} disabled={!payerName.trim()}>
            {modalMode === 'add' ? 'Add Payer' : 'Save Changes'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Archive Confirmation */}
      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        itemName={archiveTarget?.name || ''}
        itemType="payer template"
      />
    </DashboardLayout>
  )
}
