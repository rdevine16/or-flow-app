// components/ui/Modal.tsx
// Shared modal shell — overlay, header, body, footer
// Replaces repeated inline modal markup across ~18 pages
//
// USAGE:
//
//   <Modal open={showModal} onClose={close} title="Add Item" size="md">
//     <div className="space-y-4">
//       <input ... />
//       <select ... />
//     </div>
//     <Modal.Footer>
//       <Modal.Cancel onClick={close} />
//       <Modal.Action onClick={save} loading={saving} disabled={!valid}>
//         Save
//       </Modal.Action>
//     </Modal.Footer>
//   </Modal>
//
//   Size variants: 'sm' | 'md' | 'lg' | 'xl' | 'full'
//   - sm:   max-w-sm  (simple confirms, short forms)
//   - md:   max-w-md  (standard forms — default)
//   - lg:   max-w-lg  (wider forms)
//   - xl:   max-w-xl  (multi-column)
//   - full: max-w-4xl (large tables/editors)
//
//   The close X button appears in the header by default.
//   Escape key and backdrop click also close the modal.

'use client'

import { ReactNode, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'

// ============================================
// TYPES
// ============================================

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: ModalSize
  children: ReactNode
  /** Hide the X close button in the header */
  hideCloseButton?: boolean
}

// ============================================
// SIZE MAP
// ============================================

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
}

// ============================================
// MODAL COMPONENT
// ============================================

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  hideCloseButton = false,
}: ModalProps) {
  // Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  // Lock body scroll
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

  // Separate Footer from body children
  const childArray = Array.isArray(children) ? children : [children]
  const footer = childArray.find(
    (child: any) => child?.type === ModalFooter
  )
  const body = childArray.filter(
    (child: any) => child?.type !== ModalFooter
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 animate-in fade-in duration-200"
        style={{ zIndex: tokens.zIndex.modalBackdrop }}
        onClick={onClose}
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
          aria-labelledby="modal-title"
          className={`bg-white rounded-2xl shadow-xl w-full ${sizeClasses[size]} animate-in zoom-in-95 duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3
              id="modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {title}
            </h3>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors -mr-2"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">{body}</div>

          {/* Footer */}
          {footer}
        </div>
      </div>
    </>
  )
}

// ============================================
// MODAL.FOOTER
// ============================================

interface ModalFooterProps {
  children: ReactNode
}

function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
      {children}
    </div>
  )
}

Modal.Footer = ModalFooter

// ============================================
// MODAL.CANCEL — standard cancel button
// ============================================

interface ModalCancelProps {
  onClick: () => void
  children?: ReactNode
}

function ModalCancel({ onClick, children = 'Cancel' }: ModalCancelProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
    >
      {children}
    </button>
  )
}

Modal.Cancel = ModalCancel

// ============================================
// MODAL.ACTION — primary action button
// ============================================

interface ModalActionProps {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'danger'
  children: ReactNode
}

function ModalAction({
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  children,
}: ModalActionProps) {
  const colorClasses =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-blue-600 hover:bg-blue-700'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-4 py-2 text-sm font-medium text-white ${colorClasses} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
    >
      {loading && (
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

Modal.Action = ModalAction