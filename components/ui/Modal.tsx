// components/ui/Modal.tsx
// Shared modal shell — overlay, header, body, footer
// Replaces repeated inline modal markup across all pages
//
// USAGE:
//
//   Simple form:
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
//   Rich header (analytics drilldowns):
//   <Modal open={show} onClose={close} title="Idle Time Analysis"
//     subtitle="All idle gaps between consecutive cases"
//     icon={<SparklesIcon className="w-5 h-5 text-blue-600" />}
//     size="full" scrollable
//   >
//     ...content...
//   </Modal>
//
//   Progress modal (no footer, no close):
//   <Modal open={running} onClose={() => {}} title="Processing" hideCloseButton>
//     <ProgressBar ... />
//   </Modal>
//
//   Size variants: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'

'use client'

import { ReactNode, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { Spinner } from '@/components/ui/Loading'
import { tokens, buttonVariants } from '@/lib/design-tokens'

// ============================================
// TYPES
// ============================================

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional subtitle below the title */
  subtitle?: ReactNode
  /** Optional icon displayed left of the title */
  icon?: ReactNode
  size?: ModalSize
  children: ReactNode
  /** Hide the X close button in the header */
  hideCloseButton?: boolean
  /** Enable scrollable body with max-height (useful for large content modals) */
  scrollable?: boolean
}

// ============================================
// SIZE MAP
// ============================================

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-4xl',
}

// ============================================
// MODAL COMPONENT
// ============================================

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  hideCloseButton = false,
  scrollable = false,
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
          className={`
            bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]}
            animate-in zoom-in-95 duration-200
            ${scrollable ? 'max-h-[85vh] overflow-hidden flex flex-col' : ''}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 ${(icon || subtitle) ? 'bg-slate-50' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h3
                  id="modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-sm text-slate-500 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors -mr-2 flex-shrink-0"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className={`p-6 space-y-4 ${scrollable ? 'overflow-y-auto flex-1' : ''}`}>
            {body}
          </div>

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
    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
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
  variant?: 'primary' | 'danger' | 'warning'
  children: ReactNode
}

function ModalAction({
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  children,
}: ModalActionProps) {
  const variantMap = {
    primary: buttonVariants.primary,
    danger: buttonVariants.danger,
    warning: buttonVariants.warning,
  } as const

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${variantMap[variant]}`}
    >
      {loading && <Spinner size="sm" color="white" />}
      {children}
    </button>
  )
}

Modal.Action = ModalAction
