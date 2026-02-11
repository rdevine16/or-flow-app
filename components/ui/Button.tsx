// components/ui/Button.tsx
// Standardized button component with variants
//
// Usage:
//   <Button>Primary</Button>
//   <Button variant="secondary">Secondary</Button>
//   <Button variant="danger" size="sm">Delete</Button>
//   <Button variant="dangerGhost">Remove</Button>
//   <Button variant="warning">Restore</Button>
//   <Button loading={saving}>Save</Button>

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Spinner } from '@/components/ui/Loading'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerGhost' | 'warning' | 'ghost' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/20 shadow-sm',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-slate-500/20',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/20 shadow-sm',
  dangerGhost: 'text-red-600 hover:bg-red-50 focus:ring-red-500/20',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500/20 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500/20',
  outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500/20',
}

// Map variant to spinner color for proper contrast
const spinnerColors: Record<ButtonVariant, 'white' | 'blue' | 'red' | 'slate'> = {
  primary: 'white',
  secondary: 'slate',
  danger: 'white',
  dangerGhost: 'red',
  warning: 'white',
  ghost: 'slate',
  outline: 'blue',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      children,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${sizes[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <Spinner size="sm" color={spinnerColors[variant]} />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// Icon Button variant
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  'aria-label': string
}

const iconSizes = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`
          inline-flex items-center justify-center rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]}
          ${iconSizes[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'
