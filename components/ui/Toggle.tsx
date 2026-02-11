// components/ui/Toggle.tsx
// Standardized toggle/switch component
//
// Usage:
//   <Toggle checked={isActive} onChange={handleToggle} />
//   <Toggle checked={isActive} onChange={handleToggle} disabled />
//   <Toggle checked={isActive} onChange={handleToggle} size="sm" />

'use client'

type ToggleSize = 'sm' | 'md'

interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  size?: ToggleSize
  className?: string
  'aria-label'?: string
}

const trackSizes: Record<ToggleSize, string> = {
  sm: 'w-9 h-5',
  md: 'w-11 h-6',
}

const thumbSizes: Record<ToggleSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
}

const thumbTranslate: Record<ToggleSize, string> = {
  sm: 'translate-x-4',
  md: 'translate-x-5',
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      disabled={disabled}
      className={`
        relative ${trackSizes[size]} rounded-full transition-colors
        ${checked ? 'bg-blue-600' : 'bg-slate-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span
        className={`
          absolute top-1 left-1 ${thumbSizes[size]} bg-white rounded-full shadow transition-transform
          ${checked ? thumbTranslate[size] : ''}
        `}
      />
    </button>
  )
}
