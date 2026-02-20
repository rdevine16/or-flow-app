// components/settings/flags/FlagRuleTable.tsx
// CSS Grid table container with header row for flag rules.

'use client'

import { RULE_GRID_COLUMNS } from './FlagRuleRow'

interface FlagRuleTableProps {
  children: React.ReactNode
}

export function FlagRuleTable({ children }: FlagRuleTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header Row */}
      <div
        className="grid px-4 py-2 bg-slate-50/80 border-b border-slate-200 gap-x-2.5"
        style={{ gridTemplateColumns: RULE_GRID_COLUMNS }}
      >
        <span />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          Rule
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          Threshold
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          Severity
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">
          Scope
        </span>
      </div>
      {children}
    </div>
  )
}
