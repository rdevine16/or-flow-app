// components/settings/milestones/PhaseGroupHeader.tsx
'use client'

import type { PhaseConfig } from '@/lib/milestone-phase-config'

interface PhaseGroupHeaderProps {
  phase: PhaseConfig
  count: number
  /** Total columns in the table — used for colSpan */
  colSpan: number
}

export function PhaseGroupHeader({ phase, count, colSpan }: PhaseGroupHeaderProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className={`flex items-center gap-3 px-4 py-2.5 ${phase.headerBg} border-l-[3px] ${phase.borderColor}`}>
          <span className={`text-sm font-semibold ${phase.accentText}`}>
            {phase.label}
          </span>
          <span className="text-xs text-slate-500">
            {count} milestone{count !== 1 ? 's' : ''}
          </span>
        </div>
      </td>
    </tr>
  )
}
