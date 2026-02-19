// components/dashboard/DashboardKpiCard.tsx
// KPI card with recharts sparkline and target progress bar.
// Replaces MetricCard usage on the dashboard page — MetricCard stays for analytics pages.

'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { AreaChart, Area } from 'recharts'

interface SparkPoint {
  v: number
}

interface TargetInfo {
  /** Current value as percentage of target (0-100) */
  pct: number
  /** Target label (e.g., "80% target") */
  label: string
}

interface DashboardKpiCardProps {
  title: string
  value: string
  trendPct?: number
  trendDir?: 'up' | 'down' | 'increase' | 'decrease' | 'unchanged'
  /** Whether an increase is good (true) or bad (false, e.g. turnover time) */
  increaseIsGood?: boolean
  /** Secondary value shown below the primary value (e.g., "Actual: 42%") */
  secondaryValue?: string
  subtitle?: string
  sparkData?: SparkPoint[]
  sparkColor?: string
  target?: TargetInfo
  loading?: boolean
}

function getTargetColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

function getStatusDotColor(target?: TargetInfo): string {
  if (!target) return 'bg-slate-300'
  if (target.pct >= 80) return 'bg-emerald-500'
  if (target.pct >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function DashboardKpiCard({
  title,
  value,
  trendPct,
  trendDir,
  increaseIsGood = true,
  secondaryValue,
  subtitle,
  sparkData,
  sparkColor = '#3b82f6',
  target,
  loading = false,
}: DashboardKpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3.5 w-24 bg-slate-200 rounded" />
            <div className="h-7 w-16 bg-slate-100 rounded" />
          </div>
          <div className="h-7 w-20 bg-slate-200 rounded mb-1" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    )
  }

  // Normalize deltaType from KPIResult ('increase'/'decrease') to 'up'/'down'
  const normalizedDir = trendDir === 'increase' ? 'up' : trendDir === 'decrease' ? 'down' : trendDir
  const trendIsPositive = normalizedDir === 'up' ? increaseIsGood : normalizedDir === 'down' ? !increaseIsGood : undefined

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all duration-200">
      {/* Top row: status dot + title + sparkline */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${getStatusDotColor(target)}`} />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</span>
        </div>
        {sparkData && sparkData.length > 1 && (
          <AreaChart
            width={72}
            height={28}
            data={sparkData}
            margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
          >
            <defs>
              <linearGradient id={`spark-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={1.5}
              fill={`url(#spark-${title.replace(/\s+/g, '')})`}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </div>

      {/* Value + trend */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trendPct !== undefined && normalizedDir && normalizedDir !== 'unchanged' && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
            trendIsPositive ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {normalizedDir === 'up' ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
            {Math.abs(trendPct)}%
          </span>
        )}
      </div>

      {/* Secondary value */}
      {secondaryValue && (
        <p className="text-sm font-medium text-slate-500 mb-1">{secondaryValue}</p>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-slate-400 mb-2">{subtitle}</p>
      )}

      {/* Target progress bar */}
      {target && (
        <div className="mt-auto pt-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getTargetColor(target.pct)}`}
                style={{ width: `${Math.min(100, target.pct)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">{target.label}</p>
        </div>
      )}
    </div>
  )
}
