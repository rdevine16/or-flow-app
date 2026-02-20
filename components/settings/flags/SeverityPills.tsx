// components/settings/flags/SeverityPills.tsx
// Severity selector — dropdown for inline table use, or 3-badge display for drawer forms.

'use client'

import { severityColors } from '@/lib/design-tokens'
import type { Severity } from '@/types/flag-settings'

interface SeverityPillsProps {
  value: Severity
  onChange: (severity: Severity) => void
  disabled?: boolean
  /** 'dropdown' for compact table cells, 'badges' for drawer/form display */
  variant?: 'dropdown' | 'badges'
}

const SEVERITIES: Severity[] = ['info', 'warning', 'critical']

export function SeverityPills({ value, onChange, disabled = false, variant = 'dropdown' }: SeverityPillsProps) {
  if (variant === 'badges') {
    return (
      <div className="flex gap-2">
        {SEVERITIES.map((sev) => {
          const config = severityColors[sev]
          const isSelected = value === sev
          return (
            <button
              key={sev}
              type="button"
              onClick={() => onChange(sev)}
              disabled={disabled}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                isSelected
                  ? `${config.bg} ${config.color} border-current ring-1 ${config.ring}`
                  : 'text-slate-400 border-slate-200 hover:text-slate-500'
              } ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    )
  }

  // Default: dropdown for table cells
  const config = severityColors[value]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Severity)}
      disabled={disabled}
      className={`px-2 py-1 rounded-md text-[11px] font-semibold text-center transition-all appearance-none cursor-pointer ${config.bg} ${config.color} ring-1 ${config.ring} ${
        disabled ? 'opacity-40 cursor-default' : ''
      }`}
    >
      {SEVERITIES.map((sev) => (
        <option key={sev} value={sev}>
          {severityColors[sev].label}
        </option>
      ))}
    </select>
  )
}
