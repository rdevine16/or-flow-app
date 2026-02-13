// components/ui/Input.tsx
// Standardized input component
//
// Usage:
//   <Input placeholder="Enter name" />
//   <Input error={!!errors.email} />
//   <Textarea rows={4} />

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { inputColors } from '@/lib/design-tokens'

// ============================================
// Input
// ============================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full px-4 py-2.5 
          border rounded-lg
          text-slate-900 placeholder:text-slate-400
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error
            ? `${inputColors.error.border} ${inputColors.error.focus}`
            : `${inputColors.normal.border} ${inputColors.normal.focus}`
          }
          ${className}
        `}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

// ============================================
// Textarea
// ============================================

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`
          w-full px-4 py-2.5 
          border rounded-lg
          text-slate-900 placeholder:text-slate-400
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          resize-none
          ${error
            ? `${inputColors.error.border} ${inputColors.error.focus}`
            : `${inputColors.normal.border} ${inputColors.normal.focus}`
          }
          ${className}
        `}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

// ============================================
// Select
// ============================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          w-full px-4 py-2.5 
          border rounded-lg
          text-slate-900 bg-white
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error
            ? `${inputColors.error.border} ${inputColors.error.focus}`
            : `${inputColors.normal.border} ${inputColors.normal.focus}`
          }
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

// ============================================
// Label
// ============================================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ required, children, className = '', ...props }: LabelProps) {
  return (
    <label 
      className={`block text-sm font-medium text-slate-700 mb-1.5 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-red-600 ml-1">*</span>}
    </label>
  )
}

// ============================================
// FormField (combines Label + Input + Error)
// ============================================

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
