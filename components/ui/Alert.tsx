// components/ui/Alert.tsx
'use client'

import { ReactNode, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<AlertVariant, {
  container: string
  icon: string
  title: string
  text: string
}> = {
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    text: 'text-blue-700',
  },
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-600',
    title: 'text-green-900',
    text: 'text-green-700',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    text: 'text-amber-700',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900',
    text: 'text-red-600',
  },
}

const icons: Record<AlertVariant, ReactNode> = {
  info: (
    <Info className="w-5 h-5" />
  ),
  success: (
    <CheckCircle2 className="w-5 h-5" />
  ),
  warning: (
    <AlertTriangle className="w-5 h-5" />
  ),
  error: (
    <XCircle className="w-5 h-5" />
  ),
}

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true)
  
  const styles = variantStyles[variant]

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  return (
    <div
      className={`
        ${styles.container}
        border rounded-lg p-4
        ${className}
      `}
      role="alert"
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {icons[variant]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`text-sm font-semibold ${styles.title} mb-1`}>
              {title}
            </h3>
          )}
          <div className={`text-sm ${styles.text}`}>
            {children}
          </div>
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 ${styles.icon} hover:opacity-75 transition-opacity`}
            aria-label="Dismiss alert"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic alerts
<Alert variant="info">
  This is an informational message
</Alert>

<Alert variant="success" title="Success!">
  Your changes have been saved
</Alert>

<Alert variant="warning" title="Warning">
  Please review before proceeding
</Alert>

<Alert variant="error" title="Error">
  Something went wrong. Please try again.
</Alert>

// Dismissible alert
<Alert 
  variant="info" 
  dismissible 
  onDismiss={() => log.info('Dismissed')}
>
  You can dismiss this message
</Alert>
*/
