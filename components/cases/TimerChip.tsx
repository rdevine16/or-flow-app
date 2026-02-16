'use client'

// ============================================================================
// TIMER CHIP — Light-themed timer with progress bar vs median
// Used on the case detail page (/cases/[id]) to display Total Time,
// Surgical Time, and milestone completion Progress.
// ============================================================================

interface TimerChipProps {
  label: string
  formattedTime: string
  medianFormatted: string | null
  isRunning: boolean
  color: 'indigo' | 'cyan'
  /** Ratio of actual time to median (0.5 = 50% through). Null if no median available. */
  ratio: number | null
}

const COLOR_CONFIG = {
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500/[0.03] to-indigo-500/[0.01]',
    border: 'border-indigo-500/[0.06]',
    barClass: 'bg-indigo-500',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500/[0.03] to-cyan-500/[0.01]',
    border: 'border-cyan-500/[0.06]',
    barClass: 'bg-cyan-500',
  },
} as const

export function TimerChip({ label, formattedTime, medianFormatted, isRunning, color, ratio }: TimerChipProps) {
  const cfg = COLOR_CONFIG[color]
  const isOver = ratio !== null && ratio > 1
  const isWarning = ratio !== null && ratio > 0.85 && ratio <= 1

  const barColorClass = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : cfg.barClass
  const barWidth = ratio !== null ? Math.min(ratio * 100, 100) : 0

  return (
    <div className={`flex flex-col gap-1.5 px-5 py-3.5 ${cfg.bg} border ${cfg.border} rounded-xl flex-1 min-w-[170px]`}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[26px] font-bold tracking-tight font-mono tabular-nums leading-none ${
            isOver ? 'text-red-500' : 'text-slate-900'
          }`}
        >
          {formattedTime}
        </span>
        {medianFormatted && (
          <span className="text-[11.5px] text-slate-400 font-medium">
            / {medianFormatted}
          </span>
        )}
      </div>
      {ratio !== null && (
        <div className="w-full h-[3px] rounded-sm bg-slate-500/[0.08] overflow-hidden">
          <div
            className={`h-full rounded-sm ${barColorClass} transition-[width] duration-1000 ease-linear`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface ProgressChipProps {
  completedCount: number
  totalCount: number
}

export function ProgressChip({ completedCount, totalCount }: ProgressChipProps) {
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-col justify-center px-5 py-3.5 bg-emerald-500/[0.04] border border-emerald-500/[0.08] rounded-xl min-w-[120px]">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-0.5">
        Progress
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-bold font-mono leading-none text-emerald-500">
          {progress}
        </span>
        <span className="text-[13px] text-slate-400 font-semibold">%</span>
      </div>
      <span className="text-[11.5px] text-slate-500 mt-0.5">
        {completedCount}/{totalCount} milestones
      </span>
    </div>
  )
}
