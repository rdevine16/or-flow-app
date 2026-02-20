// components/cases/CaseActivitySummary.tsx
// Summary card with tabs: Activity (milestone/implant/delay/flag counts) and Flags (flag details)

'use client'

import { useState } from 'react'
import { severityColors } from '@/lib/design-tokens'
import { AlertTriangle, Info, AlertOctagon, ShieldCheck, Clock } from 'lucide-react'

interface CaseFlag {
  id: string
  flag_type: 'threshold' | 'delay'
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail: string | null
  duration_minutes: number | null
  note: string | null
}

interface CaseActivitySummaryProps {
  completedMilestones: number
  totalMilestones: number
  implantsFilled: number
  implantTotal: number
  delayCount: number
  flagCount: number
  flags?: CaseFlag[]
}

const SEVERITY_ICONS = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
} as const

export default function CaseActivitySummary({
  completedMilestones,
  totalMilestones,
  implantsFilled,
  implantTotal,
  delayCount,
  flagCount,
  flags = [],
}: CaseActivitySummaryProps) {
  const [activeTab, setActiveTab] = useState<'activity' | 'flags'>('activity')

  const totalFlagCount = flagCount + delayCount

  const rows = [
    {
      label: 'Milestones',
      value: `${completedMilestones}/${totalMilestones}`,
      colorClass: null,
    },
    {
      label: 'Implants',
      value: `${implantsFilled}/${implantTotal}`,
      colorClass: null,
    },
    {
      label: 'Delays',
      value: String(delayCount),
      colorClass: delayCount > 0 ? 'text-amber-600' : null,
    },
    {
      label: 'Flags',
      value: String(flagCount),
      colorClass: flagCount > 0 ? 'text-red-600' : null,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'activity'
              ? 'text-slate-900 border-b-2 border-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Case Activity
        </button>
        <button
          onClick={() => setActiveTab('flags')}
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'flags'
              ? 'text-slate-900 border-b-2 border-blue-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Flags
          {totalFlagCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-100 text-red-600">
              {totalFlagCount}
            </span>
          )}
        </button>
      </div>

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="p-3 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-1">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span
                className={`text-sm font-bold font-mono tabular-nums ${
                  row.colorClass || 'text-slate-800'
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Flags tab */}
      {activeTab === 'flags' && (
        <div className="p-3">
          {flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-xs font-medium text-slate-900">No flags</p>
              <p className="text-[11px] text-slate-500 mt-0.5">This case is clean</p>
            </div>
          ) : (
            <div className="space-y-2">
              {flags.map((flag) => {
                const colors = severityColors[flag.severity] || severityColors.info
                const Icon = flag.flag_type === 'delay'
                  ? Clock
                  : (SEVERITY_ICONS[flag.severity] ?? Info)

                return (
                  <div
                    key={flag.id}
                    className={`rounded-lg border p-2.5 ${colors.bg} ${colors.ring}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                        flag.flag_type === 'delay' ? 'text-amber-600' : colors.color
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold uppercase ${
                            flag.flag_type === 'delay' ? 'text-amber-600' : colors.color
                          }`}>
                            {flag.flag_type === 'delay' ? 'delay' : flag.severity}
                          </span>
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {flag.label}
                          </span>
                        </div>
                        {flag.detail && (
                          <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                            {flag.detail}
                          </p>
                        )}
                        {flag.note && (
                          <p className="text-[11px] text-slate-500 mt-0.5 italic">
                            {flag.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
