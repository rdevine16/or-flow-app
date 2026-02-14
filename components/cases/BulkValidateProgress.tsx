// components/cases/BulkValidateProgress.tsx
// Sequential bulk validation with progress indicator.
// Processes cases one at a time to avoid overwhelming DB triggers.

'use client'

import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase'
import { casesDAL } from '@/lib/dal'
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface BulkValidateProgressProps {
  caseIds: string[]
  open: boolean
  onClose: () => void
  onComplete: () => void
}

interface ValidationResult {
  caseId: string
  success: boolean
  error?: string
}

// ============================================
// COMPONENT
// ============================================

export default function BulkValidateProgress({
  caseIds,
  open,
  onClose,
  onComplete,
}: BulkValidateProgressProps) {
  const supabase = createClient()
  const [current, setCurrent] = useState(0)
  const [results, setResults] = useState<ValidationResult[]>([])
  const [done, setDone] = useState(false)
  const abortRef = useRef(false)

  useEffect(() => {
    if (!open || caseIds.length === 0) return

    // Reset state
    setCurrent(0)
    setResults([])
    setDone(false)
    abortRef.current = false

    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? null

      for (let i = 0; i < caseIds.length; i++) {
        if (abortRef.current) break

        setCurrent(i + 1)

        const { error } = await casesDAL.validateCase(supabase, caseIds[i], userId)

        setResults(prev => [
          ...prev,
          { caseId: caseIds[i], success: !error, error: error?.message },
        ])
      }

      setDone(true)
    }

    run()

    return () => {
      abortRef.current = true
    }
  }, [open, caseIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  const progress = caseIds.length > 0 ? (current / caseIds.length) * 100 : 0

  const handleClose = () => {
    abortRef.current = true
    if (results.length > 0) {
      onComplete()
    }
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] bg-white rounded-xl shadow-2xl z-50"
          aria-describedby={undefined}
        >
          <Dialog.Title className="flex items-center justify-between p-4 border-b border-slate-200">
            <span className="text-lg font-semibold text-slate-900">
              {done ? 'Validation Complete' : 'Validating Cases'}
            </span>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </Dialog.Title>

          <div className="p-4 space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600">
                  {done
                    ? `${successCount} of ${caseIds.length} validated`
                    : `Validating ${current} of ${caseIds.length}...`
                  }
                </span>
                <span className="text-slate-500 tabular-nums">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    done && failCount > 0 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status indicator */}
            {!done && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin w-4 h-4" />
                <span>Processing sequentially to avoid trigger conflicts...</span>
              </div>
            )}

            {/* Summary when done */}
            {done && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{successCount} case{successCount !== 1 ? 's' : ''} validated successfully</span>
                </div>
                {failCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span>{failCount} case{failCount !== 1 ? 's' : ''} failed</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {done && (
            <div className="flex justify-end p-4 border-t border-slate-200">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
