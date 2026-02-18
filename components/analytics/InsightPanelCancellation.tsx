// components/analytics/InsightPanelCancellation.tsx
// Cancellation drill-through panel.
// Displays cancellation summary and per-case cancellation detail table.

'use client'

import { useMemo } from 'react'
import type { CancellationResult, CancellationDetail, FacilityAnalyticsConfig } from '@/lib/analyticsV2'

// ============================================
// TYPES
// ============================================

interface InsightPanelCancellationProps {
  cancellationRate: CancellationResult
  config: FacilityAnalyticsConfig
}

// ============================================
// HELPERS
// ============================================

/** Format date string: "2024-02-03" → "Feb 3" */
function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = dateStr.split('-')
  const month = months[parseInt(parts[1], 10) - 1] ?? parts[1]
  const day = parseInt(parts[2], 10)
  return `${month} ${day}`
}

/** Count consecutive zero-cancellation days from dailyData */
function computeZeroCancellationStreak(dailyData: Array<{ numericValue: number }>): number {
  let streak = 0
  // Walk backwards from most recent day
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].numericValue === 0) {
      streak++
    } else {
      break
    }
  }
  return streak
}

const TYPE_LABELS: Record<CancellationDetail['cancellationType'], string> = {
  same_day: 'Same-Day',
  prior_day: 'Prior Day',
  other: 'Other',
}

const TYPE_STYLES: Record<CancellationDetail['cancellationType'], string> = {
  same_day: 'bg-red-50 text-red-700',
  prior_day: 'bg-amber-50 text-amber-700',
  other: 'bg-slate-50 text-slate-600',
}

// ============================================
// COMPONENT
// ============================================

export default function InsightPanelCancellation({
  cancellationRate,
  config,
}: InsightPanelCancellationProps) {
  const { sameDayCount, sameDayRate, totalCancelledCount, details, dailyData } = cancellationRate
  const target = config.cancellationTargetPercent

  const zeroDayStreak = useMemo(
    () => computeZeroCancellationStreak(dailyData ?? []),
    [dailyData]
  )

  // Same-day cancellations first, then by date
  const sameDayDetails = useMemo(
    () => details.filter(d => d.cancellationType === 'same_day'),
    [details]
  )

  const otherDetails = useMemo(
    () => details.filter(d => d.cancellationType !== 'same_day'),
    [details]
  )

  // ============================================
  // EMPTY STATE
  // ============================================

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
          <span className="text-2xl text-emerald-400">&#x2713;</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No Cancellations</h3>
        <p className="text-sm text-slate-400">No cancelled cases in this period.</p>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      {/* Cancellation Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Same-Day"
          value={String(sameDayCount)}
          color={sameDayCount > 0 ? 'text-red-500' : 'text-emerald-500'}
        />
        <SummaryCard
          label="Rate"
          value={`${sameDayRate}%`}
          color={sameDayRate <= target ? 'text-emerald-500' : 'text-red-500'}
        />
        <SummaryCard
          label={`Target`}
          value={`<${target}%`}
          color="text-slate-900"
        />
        <SummaryCard
          label="Zero-Day Streak"
          value={`${zeroDayStreak}d`}
          color={zeroDayStreak > 0 ? 'text-emerald-500' : 'text-slate-500'}
        />
      </div>

      {/* Same-Day Cancellation Detail */}
      {sameDayDetails.length > 0 && (
        <>
          <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5">Same-Day Cancellations</h3>
          <CancellationTable details={sameDayDetails} />
        </>
      )}

      {/* Other Cancellations */}
      {otherDetails.length > 0 && (
        <>
          <h3 className="text-[13px] font-semibold text-slate-900 mb-2.5 mt-5">Other Cancellations</h3>
          <CancellationTable details={otherDetails} />
        </>
      )}

      {/* Zero-day streak callout */}
      {zeroDayStreak >= 5 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-[10px] p-3.5 mt-5">
          <div className="flex items-start gap-2.5">
            <span className="text-sm leading-none mt-0.5" aria-hidden="true">&#x1F4C8;</span>
            <div>
              <div className="text-[13px] font-semibold text-emerald-900 mb-1">Positive Trend</div>
              <p className="text-xs leading-relaxed m-0 text-emerald-800">
                {zeroDayStreak} consecutive days with zero same-day cancellations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================

function CancellationTable({ details }: { details: CancellationDetail[] }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[10px] overflow-hidden mb-1">
      {/* Table header */}
      <div className="grid grid-cols-[56px_64px_100px_56px_56px_72px] px-3.5 py-2 bg-slate-50/80 border-b border-slate-100">
        {['Date', 'Case', 'Surgeon', 'Room', 'Sched', 'Type'].map(h => (
          <span key={h} className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{h}</span>
        ))}
      </div>

      {/* Table rows */}
      {details.map((d, i) => (
        <div
          key={d.caseId}
          className={`grid grid-cols-[56px_64px_100px_56px_56px_72px] px-3.5 py-2.5 items-center ${
            i < details.length - 1 ? 'border-b border-slate-50' : ''
          }`}
        >
          <span className="text-xs text-slate-500">{formatDate(d.date)}</span>
          <span className="text-xs font-medium text-slate-800">#{d.caseNumber}</span>
          <span className="text-xs text-slate-800 truncate">{d.surgeonName}</span>
          <span className="text-xs text-slate-500">{d.roomName}</span>
          <span className="text-xs text-slate-500 font-mono">{d.scheduledStart}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLES[d.cancellationType]}`}>
            {TYPE_LABELS[d.cancellationType]}
          </span>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  )
}
