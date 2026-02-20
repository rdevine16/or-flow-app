// components/settings/flags/SeverityPills.tsx
// Inline 3-pill severity selector for flag rules.

'use client'

import { severityColors } from '@/lib/design-tokens'
import type { Severity } from '@/types/flag-settings'

interface SeverityPillsProps {
  value: Severity
  onChange: (severity: Severity) => void
  disabled?: boolean
}

const SEVERITIES: Severity[] = ['info', 'warning', 'critical']

export function SeverityPills({ value, onChange, disabled = false }: SeverityPillsProps) {
  return (
    <div className="flex gap-1">
      {SEVERITIES.map((sev) => {
        const config = severityColors[sev]
        const isSelected = value === sev
        return (
          <button
            key={sev}
            onClick={() => onChange(sev)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
              isSelected
                ? `${config.bg} ${config.color} ring-1 ${config.ring}`
                : 'text-slate-400 hover:text-slate-500'
            } ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSelected ? 'bg-current' : 'bg-slate-300'
              }`}
            />
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
