// components/settings/flags/SeverityPills.tsx
// Clickable severity badge that cycles through info → warning → critical.

'use client'

import { severityColors } from '@/lib/design-tokens'
import type { Severity } from '@/types/flag-settings'

interface SeverityPillsProps {
  value: Severity
  onChange: (severity: Severity) => void
  disabled?: boolean
}

const CYCLE: Severity[] = ['info', 'warning', 'critical']

export function SeverityPills({ value, onChange, disabled = false }: SeverityPillsProps) {
  const config = severityColors[value]
  const next = CYCLE[(CYCLE.indexOf(value) + 1) % CYCLE.length]

  return (
    <button
      onClick={() => onChange(next)}
      disabled={disabled}
      className={`px-2 py-1 rounded-md text-[11px] font-semibold text-center transition-all ${config.bg} ${config.color} ring-1 ${config.ring} ${
        disabled ? 'opacity-40 cursor-default' : 'cursor-pointer hover:opacity-80'
      }`}
    >
      {config.label}
    </button>
  )
}
