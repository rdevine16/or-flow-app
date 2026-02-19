'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import Sparkline from '@/components/ui/Sparkline'

// ============================================
// Types
// ============================================

type KPIStatus = 'good' | 'bad' | 'neutral'

interface FlagKPICardProps {
  label: string
  value: string | number
  unit?: string
  trend?: number
  /** When true, a negative trend is good (e.g. flag rate going down) */
  trendInverse?: boolean
  sparkData?: number[]
  sparkColor?: string
  status?: KPIStatus
  detail?: string
}

// ============================================
// Sub-components
// ============================================

function TrendBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  if (value === 0) {
    return <span className="text-[11px] text-slate-400">&mdash;</span>
  }

  const isPositive = value > 0
  const isGood = inverse ? !isPositive : isPositive

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[11px] font-semibold ${
        isGood
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-rose-50 text-rose-600'
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ============================================
// FlagKPICard
// ============================================

const STATUS_DOT_COLORS: Record<KPIStatus, string> = {
  good: 'bg-emerald-500',
  bad: 'bg-rose-500',
  neutral: 'bg-amber-500',
}

export default function FlagKPICard({
  label,
  value,
  unit,
  trend,
  trendInverse,
  sparkData,
  sparkColor,
  status,
  detail,
}: FlagKPICardProps) {
  const dotColor = status ? STATUS_DOT_COLORS[status] : 'bg-slate-300'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative">
      {/* Header: status dot + label */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.05em]">
              {label}
            </span>
          </div>

          {/* Value + unit */}
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-slate-900 leading-none font-mono tracking-tight">
              {value}
            </span>
            {unit && (
              <span className="text-sm text-slate-500 font-medium">{unit}</span>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {sparkData && sparkData.length >= 2 && (
          <Sparkline
            data={sparkData}
            color={sparkColor ?? '#0ea5e9'}
            width={64}
            height={24}
            showArea
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Trend + detail row */}
      <div className="flex items-center gap-2 mt-2">
        {trend !== undefined && (
          <TrendBadge value={trend} inverse={trendInverse} />
        )}
        {detail && (
          <span className="text-[11px] text-slate-400">{detail}</span>
        )}
      </div>
    </div>
  )
}
