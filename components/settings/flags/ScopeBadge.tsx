// components/settings/flags/ScopeBadge.tsx
// Scope selector dropdown for flag rule table rows.

'use client'

import type { ComparisonScope } from '@/types/flag-settings'

interface ScopeBadgeProps {
  value: ComparisonScope
  onChange: (scope: ComparisonScope) => void
  disabled?: boolean
}

const SCOPES: { id: ComparisonScope; label: string }[] = [
  { id: 'facility', label: 'Facility' },
  { id: 'personal', label: 'Personal' },
]

export function ScopeBadge({ value, onChange, disabled = false }: ScopeBadgeProps) {
  const isPersonal = value === 'personal'

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ComparisonScope)}
      disabled={disabled}
      className={`text-[11px] font-semibold px-2 py-1 rounded-md text-center appearance-none transition-all ${
        isPersonal
          ? 'bg-violet-50 text-violet-600 border border-violet-200'
          : 'bg-slate-50 text-slate-500 border border-slate-200'
      } ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
    >
      {SCOPES.map((scope) => (
        <option key={scope.id} value={scope.id}>
          {scope.label}
        </option>
      ))}
    </select>
  )
}
