// app/settings/financials/payers/page.tsx
// Manage insurance companies and payer contracts

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import Container from '../../../../components/ui/Container'
import SettingsLayout from '../../../../components/settings/SettingsLayout'
import { genericAuditLog } from '../../../../lib/audit-logger'

interface Payer {
  id: string
  name: string
  facility_id: string
  deleted_at: string | null
}

export default function PayersPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [payers, setPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Show inactive payers toggle
  const [showInactivePayers, setShowInactivePayers] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
  const [payerName, setPayerName] = useState('')

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

    const { data, error } = await supabase
      .from('payers')
      .select('id, name, facility_id, deleted_at')
      .eq('facility_id', effectiveFacilityId)
      .order('name')

    if (data) setPayers(data)
    if (error) console.error('Error fetching payers:', error)
    setLoading(false)
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
      console.error('Error saving payer:', error)
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
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', payerId)

      if (error) throw error

      setPayers(payers.map(p =>
        p.id === payerId ? { ...p, deleted_at: new Date().toISOString() } : p
      ))

      await genericAuditLog(supabase, 'payer.deleted', {
        targetType: 'payer',
        targetId: payerId,
        targetLabel: payer.name,
        facilityId: effectiveFacilityId,
      })

      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting payer:', error)
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
        .update({ deleted_at: null })
        .eq('id', payerId)

      if (error) throw error

      setPayers(payers.map(p =>
        p.id === payerId ? { ...p, deleted_at: null } : p
      ))

      await genericAuditLog(supabase, 'payer.restored', {
        targetType: 'payer',
        targetId: payerId,
        targetLabel: payer.name,
        facilityId: effectiveFacilityId,
      })
    } catch (error) {
      console.error('Error restoring payer:', error)
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
          <SettingsLayout title="Payers" description="Manage insurance companies and payer contracts">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
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
          <div className="flex justify-end mb-6">
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Payer
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : activePayers.length === 0 && inactivePayers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Payers</h3>
              <p className="text-slate-600 mb-4">Add insurance companies and payers to configure procedure-specific reimbursement rates.</p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Payer
              </button>
            </div>
          ) : (
            <>
              {/* Active Payers */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">Active Payers</h3>
                  <span className="text-sm text-slate-500">{activePayers.length} payers</span>
                </div>

                {activePayers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500">
                    No active payers
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {activePayers.map((payer) => (
                      <div key={payer.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <span className="font-medium text-slate-900">{payer.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(payer)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === payer.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(payer.id)}
                                disabled={saving}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(payer.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inactive Payers */}
              {inactivePayers.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowInactivePayers(!showInactivePayers)}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showInactivePayers ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Inactive Payers ({inactivePayers.length})
                  </button>

                  {showInactivePayers && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="divide-y divide-slate-200">
                        {inactivePayers.map((payer) => (
                          <div key={payer.id} className="px-4 py-3 flex items-center justify-between">
                            <span className="text-slate-500">{payer.name}</span>
                            <button
                              onClick={() => handleRestore(payer.id)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SettingsLayout>
      </Container>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalMode === 'add' ? 'Add Payer' : 'Edit Payer'}
              </h3>
            </div>
            <div className="p-6">
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
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !payerName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : modalMode === 'add' ? 'Add Payer' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}