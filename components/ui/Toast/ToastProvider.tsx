// components/ui/Toast/ToastProvider.tsx
// Toast notification system for ORbit
// Provides non-blocking feedback for user actions

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { tokens, alertColors } from '@/lib/design-tokens'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

/**
 * USAGE:
 * 
 * 1. Wrap your app in ToastProvider (in layout.tsx):
 *    <ToastProvider>
 *      {children}
 *    </ToastProvider>
 * 
 * 2. Use the hook in components:
 *    const { showToast } = useToast()
 *    
 *    showToast({
 *      type: 'success',
 *      title: 'Case saved',
 *      message: 'Your changes have been saved successfully'
 *    })
 * 
 * 3. With actions:
 *    showToast({
 *      type: 'info',
 *      title: 'Surgery scheduled',
 *      action: {
 *        label: 'View',
 *        onClick: () => router.push('/cases/123')
 *      }
 *    })
 */

// ============================================
// TYPES
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: ToastAction
  dismissible?: boolean
}

export interface ToastOptions {
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: ToastAction
  dismissible?: boolean
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (options: ToastOptions) => string
  dismissToast: (id: string) => void
  dismissAll: () => void
}

// ============================================
// CONTEXT
// ============================================

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    // Safe fallback for SSR/build
    console.warn('useToast called outside ToastProvider, using fallback')
    return {
      toasts: [],
      showToast: () => '',
      dismissToast: () => {},
      dismissAll: () => {}
    }
  }
  return context
}

// ============================================
// PROVIDER
// ============================================

interface ToastProviderProps {
  children: ReactNode
  position?: ToastPosition
  maxToasts?: number
}

export function ToastProvider({ 
  children, 
  position = 'top-right',
  maxToasts = 5 
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9)
    const defaultDuration = options.type === 'error' ? 6000 : 4000
    
    const newToast: Toast = {
      id,
      dismissible: options.dismissible ?? true,
      duration: options.duration ?? defaultDuration,
      ...options,
    }

    setToasts((prev) => {
      const updated = [...prev, newToast]
      // Keep only maxToasts
      return updated.slice(-maxToasts)
    })

    // Auto dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }

    return id
  }, [maxToasts])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} position={position} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

// ============================================
// TOAST CONTAINER
// ============================================

interface ToastContainerProps {
  toasts: Toast[]
  position: ToastPosition
  onDismiss: (id: string) => void
}

function ToastContainer({ toasts, position, onDismiss }: ToastContainerProps) {
  const positionClasses: Record<ToastPosition, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  if (toasts.length === 0) return null

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-[${tokens.zIndex.toast}] flex flex-col gap-3 pointer-events-none`}
      style={{ zIndex: tokens.zIndex.toast }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  )
}

// ============================================
// TOAST ITEM
// ============================================

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const colors = alertColors[toast.type]

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto
        min-w-[320px] max-w-md
        rounded-xl border ${colors.border}
        ${colors.bg}
        shadow-lg
        animate-in slide-in-from-right-full duration-300
        backdrop-blur-sm bg-white/95
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${colors.icon}`}>
            <ToastIcon type={toast.type} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${colors.text} mb-0.5`}>
              {toast.title}
            </h4>
            {toast.message && (
              <p className={`text-sm ${colors.text} opacity-90`}>
                {toast.message}
              </p>
            )}
            
            {/* Action button */}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick()
                  onDismiss()
                }}
                className={`mt-2 text-sm font-medium ${colors.button} transition-colors`}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={onDismiss}
              className={`flex-shrink-0 p-1 rounded-lg ${colors.icon} opacity-60 hover:opacity-100 transition-opacity`}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (only if auto-dismissing) */}
      {toast.duration && toast.duration > 0 && (
        <div className={`h-1 ${colors.border} overflow-hidden rounded-b-xl`}>
          <div
            className={`h-full ${colors.icon} opacity-50`}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================
// TOAST ICONS
// ============================================

function ToastIcon({ type }: { type: ToastType }) {
  const icons: Record<ToastType, ReactNode> = {
    success: (
      <CheckCircle2 className="w-5 h-5" />
    ),
    error: (
      <XCircle className="w-5 h-5" />
    ),
    warning: (
      <AlertTriangle className="w-5 h-5" />
    ),
    info: (
      <Info className="w-5 h-5" />
    ),
  }

  return icons[type]
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Convenience hooks for common toast patterns
 */
export function useToastHelpers() {
  const { showToast } = useToast()

  return {
    success: (title: string, message?: string) =>
      showToast({ type: 'success', title, message }),
    
    error: (title: string, message?: string) =>
      showToast({ type: 'error', title, message }),
    
    warning: (title: string, message?: string) =>
      showToast({ type: 'warning', title, message }),
    
    info: (title: string, message?: string) =>
      showToast({ type: 'info', title, message }),

    // For async operations
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string
        error: string
      }
    ): Promise<T> => {
      const loadingId = showToast({
        type: 'info',
        title: messages.loading,
        duration: 0, // Don't auto-dismiss
        dismissible: false,
      })

      try {
        const result = await promise
        showToast({
          type: 'success',
          title: messages.success,
        })
        return result
      } catch (error) {
        showToast({
          type: 'error',
          title: messages.error,
          message: error instanceof Error ? error.message : 'An error occurred',
        })
        throw error
      }
    },
  }
}

// Add to globals.css:
// @keyframes shrink {
//   from { width: 100%; }
//   to { width: 0%; }
// }
