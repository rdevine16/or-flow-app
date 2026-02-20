// components/settings/flags/ScopeBadge.tsx
// Clickable facility/personal scope badge for flag rules.

'use client'

import type { ComparisonScope } from '@/types/flag-settings'

interface ScopeBadgeProps {
  value: ComparisonScope
  onChange: (scope: ComparisonScope) => void
  disabled?: boolean
}

export function ScopeBadge({ value, onChange, disabled = false }: ScopeBadgeProps) {
  const isPersonal = value === 'personal'

  return (
    <button
      onClick={() => onChange(isPersonal ? 'facility' : 'personal')}
      disabled={disabled}
      className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-all ${
        isPersonal
          ? 'bg-violet-50 text-violet-600 border border-violet-200'
          : 'bg-slate-50 text-slate-500 border border-slate-200'
      } ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer hover:opacity-80'}`}
    >
      {isPersonal ? 'Personal' : 'Facility'}
    </button>
  )
}
