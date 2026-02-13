// components/dashboard/FacilityScoreCard.tsx
// Displays the facility ORbit Score with letter grade badge.
// Uses the stubbed composite calculation — will be replaced by real engine later.

'use client'

import type { FacilityScoreResult } from '@/lib/facilityScoreStub'

interface FacilityScoreCardProps {
  score: FacilityScoreResult | null
  loading?: boolean
  trendValue?: number
  trendLabel?: string
}

export function FacilityScoreCard({
  score,
  loading = false,
  trendValue,
  trendLabel = 'vs prior period',
}: FacilityScoreCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="animate-pulse">
          <div className="h-4 w-28 bg-slate-200 rounded mb-3" />
          <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    )
  }

  if (!score) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm font-medium text-slate-500 mb-1">Facility ORbit Score</p>
        <p className="text-3xl font-bold text-slate-300">&mdash;</p>
        <p className="text-xs text-slate-400 mt-2">No data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md hover:border-slate-200 transition-all duration-300 group">
      <p className="text-sm font-medium text-slate-500 mb-1">Facility ORbit Score</p>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-slate-900">{score.score}</span>
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold"
          style={{ color: score.grade.text, backgroundColor: score.grade.bg }}
        >
          {score.grade.letter}
        </span>
        <span className="text-xs text-slate-400">{score.grade.label}</span>
      </div>
      {trendValue !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-sm font-medium ${
              trendValue >= 0
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {trendValue >= 0 ? '+' : ''}{trendValue} pts
          </span>
          <span className="text-xs text-slate-400">{trendLabel}</span>
        </div>
      )}
    </div>
  )
}
