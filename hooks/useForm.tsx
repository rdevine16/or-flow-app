// hooks/useForm.tsx
// NOTE: This file must be .tsx because it contains JSX (FormField component)
//
// Lightweight form handling hook - no external dependencies

import { useState, useCallback, useMemo, ChangeEvent, FormEvent, ReactNode } from 'react'

// ============================================
// Types
// ============================================

type FormValues = Record<string, string | number | boolean | null | undefined>
type FormErrors<T> = Partial<Record<keyof T, string | undefined>>
type ValidateFn<T> = (values: T) => FormErrors<T>

interface UseFormOptions<T extends FormValues> {
  initialValues: T
  validate?: ValidateFn<T>
  onSubmit?: (values: T) => void | Promise<void>
}

interface UseFormReturn<T extends FormValues> {
  values: T
  errors: FormErrors<T>
  touched: Partial<Record<keyof T, boolean>>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  setValue: <K extends keyof T>(field: K, value: T[K]) => void
  setValues: (values: Partial<T>) => void
  getFieldProps: (name: keyof T) => {
    name: string
    value: T[keyof T]
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onBlur: () => void
  }
  handleSubmit: (e?: FormEvent) => Promise<void>
  reset: () => void
  resetField: (field: keyof T) => void
  validateField: (field: keyof T) => string | undefined
  validateForm: () => boolean
}

// ============================================
// Hook Implementation
// ============================================

export function useForm<T extends FormValues>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors<T>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some(
      key => values[key as keyof T] !== initialValues[key as keyof T]
    )
  }, [values, initialValues])

  const isValid = useMemo(() => {
    if (!validate) return true
    const validationErrors = validate(values)
    return Object.values(validationErrors).every(error => !error)
  }, [values, validate])

  const validateField = useCallback(
    (field: keyof T): string | undefined => {
      if (!validate) return undefined
      const validationErrors = validate(values)
      return validationErrors[field]
    },
    [values, validate]
  )

  const validateForm = useCallback((): boolean => {
    if (!validate) return true
    const validationErrors = validate(values)
    setErrors(validationErrors)
    
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Partial<Record<keyof T, boolean>>
    )
    setTouched(allTouched)
    
    return Object.values(validationErrors).every(error => !error)
  }, [values, validate])

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target
      const newValue = type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value

      setValuesState(prev => ({ ...prev, [name]: newValue }))
      
      if (errors[name as keyof T]) {
        setErrors(prev => ({ ...prev, [name]: undefined }))
      }
    },
    [errors]
  )

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState(prev => ({ ...prev, [field]: value }))
  }, [])

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }))
  }, [])

  const getFieldProps = useCallback(
    (name: keyof T) => ({
      name: name as string,
      value: values[name] as T[keyof T],
      onChange: handleChange,
      onBlur: () => {
        setTouched(prev => ({ ...prev, [name]: true }))
        if (validate) {
          const fieldError = validateField(name)
          setErrors(prev => ({ ...prev, [name]: fieldError }))
        }
      },
    }),
    [values, handleChange, validate, validateField]
  )

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      
      if (!validateForm()) return
      
      setIsSubmitting(true)
      try {
        await onSubmit?.(values)
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validateForm, onSubmit]
  )

  const reset = useCallback(() => {
    setValuesState(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const resetField = useCallback(
    (field: keyof T) => {
      setValuesState(prev => ({ ...prev, [field]: initialValues[field] }))
      setErrors(prev => ({ ...prev, [field]: undefined }))
      setTouched(prev => ({ ...prev, [field]: false }))
    },
    [initialValues]
  )

  return {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    isSubmitting,
    handleChange,
    setValue,
    setValues,
    getFieldProps,
    handleSubmit,
    reset,
    resetField,
    validateField,
    validateForm,
  }
}

// ============================================
// Validation Helpers
// ============================================

export const validators = {
  required(value: unknown, message = 'This field is required'): string | undefined {
    if (value === null || value === undefined) return message
    if (typeof value === 'string' && !value.trim()) return message
    return undefined
  },

  minLength(min: number, message?: string) {
    return function(value: unknown): string | undefined {
      if (typeof value !== 'string') return undefined
      if (!value || value.length < min) {
        return message || `Must be at least ${min} characters`
      }
      return undefined
    }
  },

  maxLength(max: number, message?: string) {
    return function(value: unknown): string | undefined {
      if (typeof value !== 'string') return undefined
      if (value && value.length > max) {
        return message || `Must be at most ${max} characters`
      }
      return undefined
    }
  },

  email(value: unknown, message = 'Invalid email address'): string | undefined {
    if (typeof value !== 'string' || !value) return undefined
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? undefined : message
  },

  number(value: unknown, message = 'Must be a number'): string | undefined {
    if (value === '' || value === null || value === undefined) return undefined
    return isNaN(Number(value)) ? message : undefined
  },

  min(minVal: number, message?: string) {
    return function(value: unknown): string | undefined {
      const num = Number(value)
      if (isNaN(num)) return undefined
      return num < minVal ? (message || `Must be at least ${minVal}`) : undefined
    }
  },

  max(maxVal: number, message?: string) {
    return function(value: unknown): string | undefined {
      const num = Number(value)
      if (isNaN(num)) return undefined
      return num > maxVal ? (message || `Must be at most ${maxVal}`) : undefined
    }
  },

  pattern(regex: RegExp, message: string) {
    return function(value: unknown): string | undefined {
      if (typeof value !== 'string' || !value) return undefined
      return regex.test(value) ? undefined : message
    }
  },

  compose(...fns: Array<(value: unknown) => string | undefined>) {
    return function(value: unknown): string | undefined {
      for (const fn of fns) {
        const error = fn(value)
        if (error) return error
      }
      return undefined
    }
  },
}

// ============================================
// Form Field Component
// ============================================

interface FormFieldProps {
  label: string
  error?: string
  touched?: boolean
  required?: boolean
  children: ReactNode
}

export function FormField({ label, error, touched, required, children }: FormFieldProps) {
  const showError = touched && error

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
      {showError && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
