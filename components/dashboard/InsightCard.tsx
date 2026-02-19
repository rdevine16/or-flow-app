// components/dashboard/InsightCard.tsx
// Expandable insight card for the "What should we fix?" section.
// Collapsed: priority rank badge, title, category tag, one-line summary.
// Expanded: full analysis text + financial impact.

'use client'

import { ChevronDown } from 'lucide-react'
import type { Insight, InsightCategory, InsightSeverity } from '@/lib/insightsEngine'

// ============================================
// Config
// ============================================

const PILLAR_MAP: Record<InsightCategory, { label: string; color: string }> = {
  first_case_delays: { label: 'Schedule Adherence', color: 'bg-amber-100 text-amber-700' },
  turnover_efficiency: { label: 'Turnover Efficiency', color: 'bg-rose-100 text-rose-700' },
  callback_optimization: { label: 'Callback Timing', color: 'bg-violet-100 text-violet-700' },
  utilization_gap: { label: 'Utilization', color: 'bg-blue-100 text-blue-700' },
  cancellation_trend: { label: 'Cancellations', color: 'bg-orange-100 text-orange-700' },
  non_operative_time: { label: 'Non-Op Time', color: 'bg-teal-100 text-teal-700' },
  scheduling_pattern: { label: 'Scheduling', color: 'bg-indigo-100 text-indigo-700' },
}

const SEVERITY_COLORS: Record<InsightSeverity, string> = {
  critical: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  positive: 'bg-emerald-500 text-white',
  info: 'bg-slate-400 text-white',
}

// ============================================
// Component
// ============================================

interface InsightCardProps {
  insight: Insight
  rank: number
  expanded: boolean
  onToggle: () => void
}

export function InsightCard({ insight, rank, expanded, onToggle }: InsightCardProps) {
  const pillar = PILLAR_MAP[insight.category]
  const severityColor = SEVERITY_COLORS[insight.severity]

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left py-3 px-3 -mx-3 rounded-lg transition-colors hover:bg-slate-50 ${
        expanded ? 'bg-slate-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Priority rank badge */}
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5 ${severityColor}`}
        >
          {rank}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-900 leading-snug">
              {insight.title}
            </span>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${pillar.color}`}
            >
              {pillar.label}
            </span>
          </div>

          {/* Collapsed: one-line summary */}
          {!expanded && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
              {insight.body}
            </p>
          )}

          {/* Expanded: full analysis + financial impact */}
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                {insight.body}
              </p>
              {insight.financialImpact && (
                <p className="text-xs font-medium text-slate-700">
                  {insight.financialImpact}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>
    </button>
  )
}
