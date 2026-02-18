// components/dashboard/FacilityScoreMini.tsx
// Compact facility score card for the dashboard KPI row.
// Shows ScoreRing at 52px + grade badge + trend.

'use client'

import { ScoreRing } from '@/components/ui/ScoreRing'
import type { FacilityScoreResult } from '@/lib/facilityScoreStub'

interface FacilityScoreMiniProps {
  score: FacilityScoreResult | null
  loading?: boolean
  trendLabel?: string
}

export function FacilityScoreMini({
  score,
  loading = false,
  trendLabel = 'vs prior period',
}: FacilityScoreMiniProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-[52px] w-[52px] bg-slate-200 rounded-full" />
          <div className="flex-1">
            <div className="h-3.5 w-24 bg-slate-200 rounded mb-2" />
            <div className="h-5 w-12 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!score) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="h-[52px] w-[52px] rounded-full bg-slate-100 flex items-center justify-center">
            <span className="text-lg font-bold text-slate-300">&mdash;</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">ORbit Score</p>
            <p className="text-sm text-slate-400 mt-1">No data</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <ScoreRing score={score.score} size={52} ringWidth={4} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">ORbit Score</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
              style={{ color: score.grade.text, backgroundColor: score.grade.bg }}
            >
              {score.grade.letter}
            </span>
            <span className="text-xs text-slate-400">{score.grade.label}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{trendLabel}</p>
        </div>
      </div>
    </div>
  )
}
