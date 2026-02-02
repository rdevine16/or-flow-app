// components/modals/DeleteFacilityModal.tsx
// Type-to-confirm deletion modal for facilities

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { adminAudit } from '@/lib/audit-logger'

interface DeleteFacilityModalProps {
  facility: {
    id: string
    name: string
  }
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteFacilityModal({ 
  facility, 
  onClose, 
  onDeleted 
}: DeleteFacilityModalProps) {
  const supabase = createClient()
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmed = confirmText === facility.name

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      // Step 1: Clear any admin sessions viewing this facility
      // (This prevents NO ACTION constraint failure)
      const { error: sessionError } = await supabase
        .from('admin_sessions')
        .delete()
        .eq('viewing_facility_id', facility.id)

      if (sessionError) {
        console.warn('Could not clear admin sessions:', sessionError)
        // Continue anyway - might not have any sessions
      }

      // Step 2: Delete the facility (CASCADE handles the rest)
      const { error: deleteError } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facility.id)

      if (deleteError) {
        throw deleteError
      }

      // Step 3: Log the deletion
      await adminAudit.facilityDeleted(supabase, facility.name, facility.id)

      // Success - notify parent
      onDeleted()
    } catch (err: any) {
      console.error('Error deleting facility:', err)
      setError(err.message || 'Failed to delete facility. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header with warning icon */}
        <div className="bg-red-50 px-6 py-5 border-b border-red-100">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Facility
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            You are about to permanently delete:
          </p>

          {/* Facility name highlight */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
            <p className="font-semibold text-slate-900 text-lg">
              {facility.name}
            </p>
          </div>

          {/* Warning list */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm font-medium text-amber-800 mb-2">
              This will permanently delete:
            </p>
            <ul className="text-sm text-amber-700 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                All surgical cases and milestones
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                All users and their access
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                All OR rooms and procedure types
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                All analytics and historical data
              </li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600">{facility.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type facility name here"
              disabled={isDeleting}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              autoFocus
            />
            {confirmText.length > 0 && !isConfirmed && (
              <p className="text-xs text-red-500 mt-1.5">
                Text doesn't match facility name
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${
              isConfirmed && !isDeleting
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isDeleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Facility
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}