// components/ui/ConfirmDialog.tsx
// Standardized confirmation dialog for destructive actions
// Replaces inline delete confirmations with professional modals

'use client'

import { ReactNode, useEffect } from 'react'
import { tokens } from '@/lib/design-tokens'

/**
 * USAGE:
 * 
 * Delete confirmation:
 *   const [showConfirm, setShowConfirm] = useState(false)
 *   
 *   <ConfirmDialog
 *     open={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={async () => {
 *       await deleteCase()
 *       setShowConfirm(false)
 *     }}
 *     variant="danger"
 *     title="Delete case?"
 *     message="This action cannot be undone. The case and all related data will be permanently deleted."
 *   />
 * 
 * With loading state:
 *   const [deleting, setDeleting] = useState(false)
 *   
 *   <ConfirmDialog
 *     loading={deleting}
 *     onConfirm={async () => {
 *       setDeleting(true)
 *       await deleteCase()
 *       setDeleting(false)
 *     }}
 *     ...
 *   />
 * 
 * Custom buttons:
 *   <ConfirmDialog
 *     confirmText="Yes, archive it"
 *     cancelText="Keep it"
 *     ...
 *   />
 */

// ============================================
// TYPES
// ============================================

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  variant?: ConfirmDialogVariant
  title: string
  message: string | ReactNode
  confirmText?: string
  cancelText?: string
  loading?: boolean
  icon?: ReactNode
}

// ============================================
// VARIANT CONFIGS
// ============================================

const variantConfig: Record<ConfirmDialogVariant, {
  icon: ReactNode
  iconBg: string
  iconText: string
  confirmBg: string
  confirmHover: string
  defaultConfirmText: string
}> = {
  danger: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    confirmBg: 'bg-red-600',
    confirmHover: 'hover:bg-red-700',
    defaultConfirmText: 'Delete',
  },
  warning: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    confirmBg: 'bg-amber-600',
    confirmHover: 'hover:bg-amber-700',
    defaultConfirmText: 'Continue',
  },
  info: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    confirmBg: 'bg-blue-600',
    confirmHover: 'hover:bg-blue-700',
    defaultConfirmText: 'Confirm',
  },
}

// ============================================
// CONFIRM DIALOG COMPONENT
// ============================================

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  variant = 'danger',
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]

  // Keyboard handling
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
      if (e.key === 'Enter' && !loading) {
        onConfirm()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onClose, onConfirm])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        style={{ zIndex: tokens.zIndex.modalBackdrop }}
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: tokens.zIndex.modal }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
        >
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
            <div className={config.iconText}>
              {icon || config.icon}
            </div>
          </div>

          {/* Content */}
          <h3
            id="confirm-dialog-title"
            className="text-lg font-semibold text-slate-900 mb-2"
          >
            {title}
          </h3>
          <p
            id="confirm-dialog-description"
            className="text-sm text-slate-600 mb-6"
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`
                flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
                ${config.confirmBg} ${config.confirmHover}
                shadow-sm hover:shadow-md active:scale-[0.98]
              `}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                confirmText || config.defaultConfirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Hook to manage confirm dialog state
 * 
 * @example
 * const { confirmDialog, showConfirm } = useConfirmDialog()
 * 
 * <button onClick={() => showConfirm({
 *   title: 'Delete case?',
 *   message: 'This cannot be undone',
 *   onConfirm: () => deleteCase()
 * })}>
 *   Delete
 * </button>
 * 
 * {confirmDialog}
 */

import { useState, useCallback } from 'react'

interface UseConfirmDialogOptions {
  variant?: ConfirmDialogVariant
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<UseConfirmDialogOptions | null>(null)

  const showConfirm = useCallback((opts: UseConfirmDialogOptions) => {
    setOptions(opts)
    setIsOpen(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!options) return

    try {
      setLoading(true)
      await options.onConfirm()
      setIsOpen(false)
    } catch (error) {
      console.error('Confirm dialog error:', error)
    } finally {
      setLoading(false)
    }
  }, [options])

  const handleClose = useCallback(() => {
    if (loading) return
    setIsOpen(false)
  }, [loading])

  const confirmDialog = options ? (
    <ConfirmDialog
      open={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      variant={options.variant}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      loading={loading}
    />
  ) : null

  return {
    confirmDialog,
    showConfirm,
    isOpen,
    loading,
  }
}

// ============================================
// SPECIALIZED DIALOGS
// ============================================

/**
 * Pre-configured delete confirmation
 * Most common use case
 */
interface DeleteConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  itemName: string
  itemType?: string
  loading?: boolean
}

export function DeleteConfirm({
  open,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  loading,
}: DeleteConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      variant="danger"
      title={`Delete ${itemType}?`}
      message={
        <>
          Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be
          undone and all related data will be permanently removed.
        </>
      }
      confirmText="Delete"
      loading={loading}
    />
  )
}

/**
 * Pre-configured leave confirmation
 * For unsaved changes warnings
 */
interface LeaveConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function LeaveConfirm({ open, onClose, onConfirm }: LeaveConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      variant="warning"
      title="Unsaved changes"
      message="You have unsaved changes. Are you sure you want to leave? All changes will be lost."
      confirmText="Leave"
      cancelText="Stay"
    />
  )
}
