'use client'

import { flagChartColors } from '@/lib/design-tokens'

// ============================================
// Types
// ============================================

interface SeverityStripProps {
  criticalCount: number
  warningCount: number
  infoCount: number
  totalFlags: number
}

// ============================================
// Severity config
// ============================================

const SEVERITIES = [
  {
    key: 'critical' as const,
    label: 'CRITICAL',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: flagChartColors.critical,
    labelColor: 'text-red-700',
    countColor: 'text-red-700',
    pctColor: 'text-red-600/60',
  },
  {
    key: 'warning' as const,
    label: 'WARNING',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: flagChartColors.warning,
    labelColor: 'text-amber-700',
    countColor: 'text-amber-700',
    pctColor: 'text-amber-600/60',
  },
  {
    key: 'info' as const,
    label: 'INFO',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: flagChartColors.info,
    labelColor: 'text-blue-700',
    countColor: 'text-blue-700',
    pctColor: 'text-blue-600/60',
  },
] as const

// ============================================
// SeverityStrip
// ============================================

export default function SeverityStrip({
  criticalCount,
  warningCount,
  infoCount,
  totalFlags,
}: SeverityStripProps) {
  const counts: Record<'critical' | 'warning' | 'info', number> = {
    critical: criticalCount,
    warning: warningCount,
    info: infoCount,
  }

  if (totalFlags === 0) return null

  return (
    <div className="flex gap-2">
      {SEVERITIES.map((sev) => {
        const count = counts[sev.key]
        const pct = totalFlags > 0 ? Math.round((count / totalFlags) * 100) : 0

        return (
          <div
            key={sev.key}
            className={`${sev.bg} border ${sev.border} rounded-lg px-3.5 py-2.5 flex justify-between items-center`}
            style={{ flex: `${count || 1} 0 0`, minWidth: 100 }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: sev.dot }}
              />
              <span
                className={`text-[11px] font-bold ${sev.labelColor} uppercase tracking-[0.04em]`}
              >
                {sev.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-lg font-bold ${sev.countColor} font-mono`}
              >
                {count}
              </span>
              <span className={`text-[11px] ${sev.pctColor}`}>{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
