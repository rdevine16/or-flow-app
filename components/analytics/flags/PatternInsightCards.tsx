// components/analytics/flags/PatternInsightCards.tsx
// Displays detected flag patterns as insight cards.
// 2-column grid with left color border, icon, title, metric badge, description.

'use client'

import type { DetectedPattern, PatternSeverity, PatternType } from '@/types/flag-analytics'

// ============================================
// Pattern icons by type
// ============================================

const PATTERN_ICONS: Record<PatternType, string> = {
  day_spike: '📈',
  equipment_cascade: '🔗',
  trend_improvement: '✅',
  trend_deterioration: '📉',
  room_concentration: '🔄',
  recurring_surgeon: '👤',
}

// ============================================
// Severity color config
// ============================================

const SEVERITY_CONFIG: Record<PatternSeverity, { border: string; badge: string; badgeText: string }> = {
  critical: {
    border: 'border-l-rose-500',
    badge: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
  warning: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  good: {
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
}

// ============================================
// Component
// ============================================

interface PatternInsightCardsProps {
  patterns: DetectedPattern[]
}

export default function PatternInsightCards({ patterns }: PatternInsightCardsProps) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        No significant patterns detected for this period.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {patterns.map((pattern, i) => (
        <PatternCard key={`${pattern.type}-${i}`} pattern={pattern} />
      ))}
    </div>
  )
}

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  const config = SEVERITY_CONFIG[pattern.severity]
  const icon = PATTERN_ICONS[pattern.type] ?? '📊'

  return (
    <div
      className={`bg-white border border-slate-200 ${config.border} border-l-[3px] rounded-lg px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]`}
    >
      <span className="text-xl leading-none flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[13px] font-bold text-slate-900 truncate">{pattern.title}</span>
          <span
            className={`text-xs font-bold font-mono ${config.badge} ${config.badgeText} px-2 py-0.5 rounded flex-shrink-0`}
          >
            {pattern.metric}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed m-0">{pattern.desc}</p>
      </div>
    </div>
  )
}
