// app/settings/financials/payers/page.tsx
// Manage insurance companies and payer contracts

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { genericAuditLog } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ArchiveConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Archive, Building2, ExternalLink, Info, Pencil, Plus } from 'lucide-react'

interface Payer {
  id: string
  name: string
  facility_id: string
  deleted_at: string | null
  deleted_by: string | null
}
export default function PayersPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const [payers, setPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Show inactive payers toggle
  const [showInactivePayers, setShowInactivePayers] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
  const [payerName, setPayerName] = useState('')

  // Delete confirmation
  const [archiveTarget, setArchiveTarget] = useState<Payer | null>(null)
// Toast

  // Current user for deleted_by tracking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  // Fetch data
  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchErr } = await supabase
        .from('payers')
        .select('id, name, facility_id, deleted_at, deleted_by')
        .eq('facility_id', effectiveFacilityId)
        .order('name')

      if (fetchErr) throw fetchErr
      if (data) setPayers(data)
    } catch (err) {
      setError('Failed to load payers. Please try again.')
      showToast({ type: 'error', title: 'Failed to load payers', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setModalMode('add')
    setPayerName('')
    setSelectedPayer(null)
    setModalOpen(true)
  }

  const openEditModal = (payer: Payer) => {
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
    if (!payerName.trim() || !effectiveFacilityId) return
    setSaving(true)

    try {
      if (modalMode === 'add') {
        const { data, error } = await supabase
          .from('payers')
          .insert({
            name: payerName.trim(),
            facility_id: effectiveFacilityId,
          })
          .select()
          .single()

        if (error) throw error

        setPayers([...payers, data].sort((a, b) => a.name.localeCompare(b.name)))

        await genericAuditLog(supabase, 'payer.created', {
          targetType: 'payer',
          targetId: data.id,
          targetLabel: payerName.trim(),
          newValues: { name: payerName.trim() },
          facilityId: effectiveFacilityId,
        })
      } else if (selectedPayer) {
        const { error } = await supabase
          .from('payers')
          .update({ name: payerName.trim() })
          .eq('id', selectedPayer.id)

        if (error) throw error

        setPayers(payers.map(p =>
          p.id === selectedPayer.id ? { ...p, name: payerName.trim() } : p
        ).sort((a, b) => a.name.localeCompare(b.name)))

        await genericAuditLog(supabase, 'payer.updated', {
          targetType: 'payer',
          targetId: selectedPayer.id,
          targetLabel: payerName.trim(),
          oldValues: { name: selectedPayer.name },
          newValues: { name: payerName.trim() },
          facilityId: effectiveFacilityId,
        })
      }

      closeModal()
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Error saving payer:',
  message: error instanceof Error ? error.message : 'Error saving payer:'
})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (payerId: string) => {
    const payer = payers.find(p => p.id === payerId)
    if (!payer || !effectiveFacilityId) return

    setSaving(true)

    try {
// Soft delete
      const { error } = await supabase
        .from('payers')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: currentUserId
        })
        .eq('id', payerId)

      if (error) throw error

setPayers(payers.map(p =>
  p.id === payerId ? { ...p, deleted_at: new Date().toISOString(), deleted_by: currentUserId } : p
))

showToast({
  type: 'success',
  title: 'Payer Archived',
  message: `"${payer.name}" has been moved to archive`
})

      await genericAuditLog(supabase, 'payer.deleted', {
        targetType: 'payer',
        targetId: payerId,
        targetLabel: payer.name,
        facilityId: effectiveFacilityId,
      })

setArchiveTarget(null)
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error Archiving Payer',
    message: error instanceof Error ? error.message : 'Failed to archive payer'
  })
} finally {
      setSaving(false)
    }
  }

  const handleRestore = async (payerId: string) => {
    const payer = payers.find(p => p.id === payerId)
    if (!payer || !effectiveFacilityId) return

    setSaving(true)

    try {
const { error } = await supabase
        .from('payers')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', payerId)

      if (error) throw error

setPayers(payers.map(p =>
  p.id === payerId ? { ...p, deleted_at: null, deleted_by: null } : p
))

showToast({
  type: 'success',
  title: 'Payer Restored',
  message: `"${payer.name}" has been restored successfully`
})
await genericAuditLog(supabase, 'payer.restored', {
  targetType: 'payer',
  targetId: payerId,
  targetLabel: payer.name,
  facilityId: effectiveFacilityId,
})
} catch (error) {
  showToast({
    type: 'error',
    title: 'Error Restoring Payer',
    message: error instanceof Error ? error.message : 'Failed to restore payer'
  })
} finally {
      setSaving(false)
    }
  }

  const activePayers = payers.filter(p => !p.deleted_at)
  const inactivePayers = payers.filter(p => p.deleted_at)

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <SettingsLayout title="Payers" description="Manage insurance companies and payer contracts">
            <PageLoader message="Loading payers..." />
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Payers" description="Manage insurance companies and payer contracts">
            <div className="text-center py-12 text-slate-500">
              No facility selected
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }
  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Payers" description="Manage insurance companies and payer contracts">
          {/* Action Button */}
          <div className="flex justify-end gap-3 mb-6">
            {/* Archive Toggle */}
<button
              onClick={() => setShowInactivePayers(!showInactivePayers)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                showInactivePayers
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showInactivePayers ? 'View Active' : `Archive (${inactivePayers.length})`}
            </button>

            {/* Add Payer - hide when viewing archived */}
{!showInactivePayers && (
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4" />
                Add Payer
              </Button>
            )}
          </div>

          {loading ? (
            <PageLoader message="Loading payer data..." />
          ) : activePayers.length === 0 && inactivePayers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Payers</h3>
              <p className="text-slate-600 mb-4">Add insurance companies and payers to configure procedure-specific reimbursement rates.</p>
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4" />
                Add Payer
              </Button>
            </div>
          ) : (
            <>
 {/* Payers List - Active or Archived based on toggle */}
              <div className={`border rounded-xl overflow-hidden ${showInactivePayers ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between ${showInactivePayers ? 'bg-amber-100 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <h3 className="font-medium text-slate-900">
                    {showInactivePayers ? 'Archived Payers' : 'Active Payers'}
                  </h3>
                  <span className="text-sm text-slate-500">
                    {showInactivePayers ? inactivePayers.length : activePayers.length} payers
                  </span>
                </div>

                {(showInactivePayers ? inactivePayers : activePayers).length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500">
                    {showInactivePayers ? 'No archived payers' : 'No active payers'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {(showInactivePayers ? inactivePayers : activePayers).map((payer) => (
                      <div key={payer.id} className={`px-4 py-3 flex items-center justify-between ${showInactivePayers ? '' : 'hover:bg-slate-50'}`}>
                        <span className={showInactivePayers ? 'text-slate-500' : 'font-medium text-slate-900'}>{payer.name}</span>
                        <div className="flex items-center gap-1">
                          {showInactivePayers ? (
                            <button
                              onClick={() => handleRestore(payer.id)}
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
                )}
              </div>
            </>
          )}

          {/* Info Box with Cross-Links */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How payers work</p>
                <p className="mb-3">
                  Payers represent insurance companies and payment sources. Define payers here, then set payer-specific reimbursement rates for each procedure.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-700">
                  <span className="font-medium text-blue-800">Next step:</span>
                  <a href="/settings/financials/procedure-pricing" className="underline hover:no-underline inline-flex items-center gap-1">
                    Set Reimbursement Rates in Procedure Pricing
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </SettingsLayout>
      </Container>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={modalMode === 'add' ? 'Add Payer' : 'Edit Payer'}>
            <div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Payer Name <span className="text-red-500">*</span>
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
            </div>
            <Modal.Footer>
              <Modal.Cancel onClick={closeModal} />
              <Modal.Action onClick={handleSave} loading={saving} disabled={!payerName.trim()}>
                {modalMode === 'add' ? 'Add Payer' : 'Save Changes'}
              </Modal.Action>
            </Modal.Footer>
      </Modal>

      <ArchiveConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) await handleDelete(archiveTarget.id)
        }}
        itemName={archiveTarget?.name || ''}
        itemType="payer"
      />
    </DashboardLayout>
  )
}