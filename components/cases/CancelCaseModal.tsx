// components/cases/CancelCaseModal.tsx
// Modal for cancelling a case with reason selection.
// Extracted from app/cases/[id]/cancel/page.tsx into a reusable modal.

'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase'
import { casesDAL } from '@/lib/dal'
import { caseAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CancellationReason {
  id: string
  display_name: string
  category: string
}

interface CancelCaseModalProps {
  caseId: string | null
  caseNumber: string | null
  facilityId: string | null
  cancelledStatusId: string | null
  onClose: () => void
  onCancelled: () => void
}

// ============================================
// CONSTANTS
// ============================================

const CATEGORIES = [
  { value: 'patient', label: 'Patient', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'clinical', label: 'Clinical', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'external', label: 'External', color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

// ============================================
// COMPONENT
// ============================================

export default function CancelCaseModal({
  caseId,
  caseNumber,
  facilityId,
  cancelledStatusId,
  onClose,
  onCancelled,
}: CancelCaseModalProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [reasons, setReasons] = useState<CancellationReason[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch cancellation reasons when modal opens
  useEffect(() => {
    if (!facilityId || !caseId) return
    setLoading(true)
    setSelectedReasonId('')
    setNotes('')

    supabase
      .from('cancellation_reasons')
      .select('id, display_name, category')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('category')
      .order('display_order')
      .then(({ data }) => {
        setReasons((data as CancellationReason[]) || [])
        setLoading(false)
      })
  }, [facilityId, caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupedReasons = reasons.reduce<Record<string, CancellationReason[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {})

  const handleCancel = async () => {
    if (!caseId || !selectedReasonId || !cancelledStatusId) return
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await casesDAL.cancelCase(
        supabase,
        caseId,
        cancelledStatusId,
        selectedReasonId,
        user?.id ?? null,
        notes.trim() || undefined,
      )

      if (error) throw error

      const selectedReason = reasons.find(r => r.id === selectedReasonId)

      // Audit log
      await caseAudit.cancelled(
        supabase,
        { id: caseId, case_number: caseNumber || '' },
        selectedReason?.display_name || 'Unknown',
        selectedReason?.category || 'unknown',
        false,
        0,
        facilityId ?? undefined,
        notes.trim() || undefined,
      )

      showToast({
        type: 'success',
        title: 'Case Cancelled',
        message: `Case ${caseNumber} has been cancelled.`,
      })
      onCancelled()
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to Cancel',
        message: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] max-h-[85vh] bg-white rounded-xl shadow-2xl z-50 flex flex-col"
          aria-describedby={undefined}
        >
          <Dialog.Title className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-lg font-semibold text-slate-900">Cancel Case</span>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </Dialog.Title>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {caseNumber && (
              <p className="text-sm text-slate-600">
                You are about to cancel <span className="font-medium text-slate-900">Case #{caseNumber}</span>.
                All milestone data will be preserved.
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin w-6 h-6 text-slate-400" />
              </div>
            ) : reasons.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p>No cancellation reasons configured for this facility.</p>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-2">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </h4>
                  <div className="space-y-3">
                    {CATEGORIES.map(cat => {
                      const catReasons = groupedReasons[cat.value] || []
                      if (catReasons.length === 0) return null
                      return (
                        <div key={cat.value}>
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border mb-1.5 ${cat.color}`}>
                            {cat.label}
                          </span>
                          <div className="space-y-1.5">
                            {catReasons.map(reason => (
                              <label
                                key={reason.id}
                                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                                  selectedReasonId === reason.id
                                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="cancel-reason"
                                  value={reason.id}
                                  checked={selectedReasonId === reason.id}
                                  onChange={(e) => setSelectedReasonId(e.target.value)}
                                  className="w-4 h-4 text-blue-600 border-slate-300"
                                />
                                <span className="font-medium text-slate-900">{reason.display_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-2">
                    Notes <span className="text-slate-400 font-normal">(optional)</span>
                  </h4>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add context about this cancellation..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Keep Case
            </button>
            <button
              onClick={handleCancel}
              disabled={!selectedReasonId || submitting}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Cancelling...
                </>
              ) : (
                'Cancel Case'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
