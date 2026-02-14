// components/cases/CaseDrawerFlags.tsx
// Flags tab content for the Case Drawer.
// Renders case_flags with severity badges, type, notes.
// Empty state when no flags exist.

'use client'

import type { CaseFlag } from '@/lib/dal/cases'
import { severityColors } from '@/lib/design-tokens'
import { AlertTriangle, Info, AlertOctagon, ShieldCheck } from 'lucide-react'

interface CaseDrawerFlagsProps {
  flags: CaseFlag[]
}

const SEVERITY_ICONS = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
} as const

function getSeverityKey(flagType: string): keyof typeof severityColors {
  const normalized = flagType.toLowerCase()
  if (normalized === 'critical') return 'critical'
  if (normalized === 'warning') return 'warning'
  return 'info'
}

export default function CaseDrawerFlags({ flags }: CaseDrawerFlagsProps) {
  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm font-medium text-slate-900">No flags</p>
        <p className="text-xs text-slate-500 mt-1">This case is clean</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => {
        const severityKey = getSeverityKey(flag.flag_type)
        const colors = severityColors[severityKey]
        const Icon = SEVERITY_ICONS[severityKey] ?? Info

        return (
          <div
            key={flag.id}
            className={`rounded-lg border p-3 ${colors.bg} ${colors.ring}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase ${colors.color}`}>
                    {severityKey}
                  </span>
                  {flag.delay_type?.name && (
                    <span className="text-xs text-slate-500">
                      {flag.delay_type.name}
                    </span>
                  )}
                </div>
                {flag.notes && (
                  <p className="text-sm text-slate-700 mt-1">{flag.notes}</p>
                )}
                {flag.minutes != null && flag.minutes > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {flag.minutes} min delay
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
