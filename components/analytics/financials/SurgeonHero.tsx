// components/analytics/financials/SurgeonHero.tsx
// Dark gradient hero header for surgeon detail page
// Shows initials avatar, low-volume badge, facility comparison badges,
// 6-stat grid with SparklineLight and trend indicators

'use client'

import { SparklineLight } from './shared'
import { formatCurrency } from './utils'

// ============================================
// TYPES
// ============================================

export interface HeroStat {
  label: string
  value: string
  trend: string | null
  trendUp: boolean | null
  spark: number[]
  accent?: string
}

interface SurgeonHeroProps {
  name: string
  caseCount: number
  procedureCount: number
  isLowVolume: boolean
  stats: HeroStat[]
  facilityComparison: {
    profitPerHrDiff: number | null
    marginDiff: number
  }
}

// ============================================
// COMPONENT
// ============================================

export function SurgeonHero({
  name,
  caseCount,
  procedureCount,
  isLowVolume,
  stats,
  facilityComparison,
}: SurgeonHeroProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <span className="text-lg font-bold">{initials}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{name}</h2>
            {isLowVolume && (
              <span className="text-[10px] font-medium text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Low volume
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-0.5">
            {caseCount} cases in period · {procedureCount} procedures
          </p>
        </div>
        {/* Facility comparison badges */}
        <div className="flex items-center gap-2">
          {facilityComparison.profitPerHrDiff !== null && (
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center">
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">vs Facility $/Hr</p>
              <p
                className={`text-sm font-bold mt-0.5 ${
                  facilityComparison.profitPerHrDiff >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {facilityComparison.profitPerHrDiff >= 0 ? '+' : ''}
                {formatCurrency(facilityComparison.profitPerHrDiff)}
              </p>
            </div>
          )}
          <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">vs Facility Margin</p>
            <p
              className={`text-sm font-bold mt-0.5 ${
                facilityComparison.marginDiff >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {facilityComparison.marginDiff >= 0 ? '+' : ''}
              {facilityComparison.marginDiff.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* 6-stat grid with sparklines */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10">
        {stats.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">{s.label}</span>
              {s.spark.length >= 2 && <SparklineLight data={s.spark} />}
            </div>
            <div className={`text-2xl font-bold mt-1 ${s.accent || 'text-white'}`}>{s.value}</div>
            {s.trendUp !== null && s.trend && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 ${
                  s.trendUp ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <TrendArrow up={s.trendUp} />
                {s.trend} <span className="text-slate-500 ml-0.5">6mo</span>
              </span>
            )}
            {s.trendUp === null && <span className="text-[10px] text-slate-500 mt-1">Stable</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// TREND ARROW
// ============================================

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      className={`w-2.5 h-2.5 ${up ? '' : 'rotate-180'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
      />
    </svg>
  )
}
