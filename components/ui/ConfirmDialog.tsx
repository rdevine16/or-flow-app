// components/ui/ConfirmDialog.tsx
// components/ui/ConfirmDialog.tsx
// Standardized confirmation dialog for destructive actions
// Replaces inline delete confirmations with professional modals

'use client'

import { ReactNode, useEffect } from 'react'
import { tokens } from '@/lib/design-tokens'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Spinner } from '@/components/ui/Loading'

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
      <Trash2 className="w-6 h-6" />
    ),
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    confirmBg: 'bg-red-600',
    confirmHover: 'hover:bg-red-700',
    defaultConfirmText: 'Delete',
  },
  warning: {
    icon: (
      <AlertTriangle className="w-6 h-6" />
    ),
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    confirmBg: 'bg-amber-600',
    confirmHover: 'hover:bg-amber-700',
    defaultConfirmText: 'Continue',
  },
  info: {
    icon: (
      <Info className="w-6 h-6" />
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
                  <Spinner size="sm" color="white" />
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
import { AlertTriangle, Archive, Info, Trash2 } from 'lucide-react'

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
const { showToast } = useToast()
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
      showToast({
        type: 'error',
        title: 'Confirm Dialog Error',
        message: error instanceof Error ? error.message : 'An error occurred in the confirm dialog'
      })
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

/**
 * Pre-configured archive confirmation
 * For soft-delete / archive actions (recoverable)
 * 
 * @example
 * <ArchiveConfirm
 *   open={showArchiveConfirm}
 *   onClose={() => setShowArchiveConfirm(false)}
 *   onConfirm={() => archiveItem(id)}
 *   itemName="Knee Replacement"
 *   itemType="procedure"
 * />
 */
interface ArchiveConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  itemName: string
  itemType?: string
  loading?: boolean
}

export function ArchiveConfirm({
  open,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  loading,
}: ArchiveConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      variant="warning"
      title={`Archive ${itemType}?`}
      message={
        <>
          <strong>{itemName}</strong> will be moved to the archive and hidden from active views.
          You can restore it at any time from the archived items list.
        </>
      }
      confirmText="Archive"
      cancelText="Keep Active"
      loading={loading}
      icon={
        <Archive className="w-6 h-6" />
      }
    />
  )
}