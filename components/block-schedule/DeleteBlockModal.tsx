// components/block-schedule/DeleteBlockModal.tsx
'use client'

import { X, AlertTriangle } from 'lucide-react'

interface DeleteBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleteSingle: () => void
  onDeleteAll: () => void
  surgeonName: string
  isRecurring: boolean
}

export function DeleteBlockModal({
  isOpen,
  onClose,
  onDeleteSingle,
  onDeleteAll,
  surgeonName,
  isRecurring,
}: DeleteBlockModalProps) {
  if (!isOpen) return null

  // For non-recurring blocks, just confirm deletion
  if (!isRecurring) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50" 
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Delete Block</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-slate-700">
                  Are you sure you want to delete this block for <span className="font-medium">{surgeonName}</span>?
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDeleteAll()
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  // For recurring blocks, offer choice
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Delete Recurring Block</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-slate-700 mb-4">
            This is a recurring block for <span className="font-medium">{surgeonName}</span>. 
            What would you like to delete?
          </p>

          <div className="space-y-2">
            {/* Delete this occurrence only */}
            <button
              onClick={() => {
                onDeleteSingle()
                onClose()
              }}
              className="w-full flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors text-left group"
            >
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-slate-800">This occurrence only</div>
                <div className="text-sm text-slate-500">
                  Remove only this date from the schedule. Future occurrences will remain.
                </div>
              </div>
            </button>

            {/* Delete all occurrences */}
            <button
              onClick={() => {
                onDeleteAll()
                onClose()
              }}
              className="w-full flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors text-left group"
            >
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-slate-800 group-hover:text-red-700">All occurrences</div>
                <div className="text-sm text-slate-500 group-hover:text-red-600">
                  Delete the entire recurring block schedule.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Cancel button */}
        <div className="flex justify-end px-6 py-4 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}