'use client'

// ============================================================================
// TIMER CHIP — Light-themed timer with progress bar vs median
// Used on the case detail page (/cases/[id]) to display Total Time,
// Surgical Time, and milestone completion Progress.
// ============================================================================

import { type PaceStatus } from '@/types/pace'
import { getPaceStatusColors, formatDuration, formatDurationRange } from '@/lib/pace-utils'

export interface PaceInfo {
  /** 0-1, milestone position within the case arc (medianMinutesToMilestone / medianTotal) */
  progress: number
  /** Positive = ahead of schedule, negative = behind */
  paceMinutes: number
  status: PaceStatus
  expectedTotalMinutes: number
  p25Total: number | null
  p75Total: number | null
}

interface TimerChipProps {
  label: string
  formattedTime: string
  medianFormatted: string | null
  isRunning: boolean
  color: 'indigo' | 'cyan'
  /** Ratio of actual time to median (0.5 = 50% through). Null if no median available. */
  ratio: number | null
  /** When provided, renders pace-style progress bar (milestone position + ahead/behind) instead of ratio bar */
  paceInfo?: PaceInfo | null
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

export function TimerChip({ label, formattedTime, medianFormatted, isRunning, color, ratio, paceInfo }: TimerChipProps) {
  const cfg = COLOR_CONFIG[color]
  const isOver = ratio !== null && !paceInfo && ratio > 1
  const isWarning = ratio !== null && !paceInfo && ratio > 0.85 && ratio <= 1

  const barColorClass = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : cfg.barClass
  const barWidth = ratio !== null ? Math.min(ratio * 100, 100) : 0

  const ariaLabel = medianFormatted
    ? `${label}: ${formattedTime}, median ${medianFormatted}`
    : `${label}: ${formattedTime}`

  // Pace bar rendering
  const renderPaceBar = () => {
    if (!paceInfo) return null
    const colors = getPaceStatusColors(paceInfo.status)
    const progressPct = Math.max(paceInfo.progress * 100, 2)
    const absMinutes = Math.abs(Math.round(paceInfo.paceMinutes))
    const expectedStr = formatDuration(paceInfo.expectedTotalMinutes)
    const rangeStr = formatDurationRange(paceInfo.p25Total, paceInfo.p75Total, true)

    let paceText: string
    let paceIcon: React.ReactNode
    switch (paceInfo.status) {
      case 'ahead':
        paceText = `${absMinutes}m ahead`
        paceIcon = (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
        break
      case 'onPace':
        paceText = 'On pace'
        paceIcon = (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )
        break
      case 'slightlyBehind':
      case 'behind':
        paceText = `${absMinutes}m behind`
        paceIcon = (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
        break
    }

    return (
      <div className="space-y-1.5 mt-0.5">
        <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-slate-400 font-medium">
            Expected {expectedStr}
            {rangeStr && <span className="text-slate-300 ml-1">{rangeStr}</span>}
          </span>
          <div className={`flex items-center gap-0.5 ${colors.text} font-semibold`}>
            {paceIcon}
            <span>{paceText}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-1.5 px-6 py-4 ${cfg.bg} border ${cfg.border} rounded-2xl flex-1 min-w-[170px]`}
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" aria-label="Timer running" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[28px] font-bold tracking-tight font-mono tabular-nums leading-none ${
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
      {paceInfo ? renderPaceBar() : ratio !== null && (
        <div
          className="w-full h-[3px] rounded-sm bg-slate-500/[0.08] overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(barWidth)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} progress: ${Math.round(barWidth)}%`}
        >
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
    <div
      className="flex flex-col justify-center px-6 py-4 bg-emerald-500/[0.04] border border-emerald-500/[0.08] rounded-2xl min-w-[120px]"
      role="progressbar"
      aria-valuenow={completedCount}
      aria-valuemin={0}
      aria-valuemax={totalCount}
      aria-label={`Progress: ${completedCount} of ${totalCount} milestones completed (${progress}%)`}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-0.5">
        Progress
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] font-bold font-mono leading-none text-emerald-500">
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
