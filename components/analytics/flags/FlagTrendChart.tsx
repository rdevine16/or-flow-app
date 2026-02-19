'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklyTrendPoint } from '@/types/flag-analytics'
import { flagChartColors } from '@/lib/design-tokens'

// ============================================
// Types
// ============================================

interface FlagTrendChartProps {
  data: WeeklyTrendPoint[]
}

// ============================================
// Custom tooltip
// ============================================

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
        Week of {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-slate-700">
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Chart component
// ============================================

export default function FlagTrendChart({ data }: FlagTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
        No trend data available
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradAutoDetected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={flagChartColors.autoDetected} stopOpacity={0.2} />
              <stop offset="100%" stopColor={flagChartColors.autoDetected} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradDelays" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={flagChartColors.delays} stopOpacity={0.2} />
              <stop offset="100%" stopColor={flagChartColors.delays} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="threshold"
            name="Auto-detected"
            stackId="1"
            stroke={flagChartColors.autoDetected}
            fill="url(#gradAutoDetected)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="delay"
            name="User-reported"
            stackId="1"
            stroke={flagChartColors.delays}
            fill="url(#gradDelays)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className="w-2.5 h-[3px] rounded-sm"
            style={{ backgroundColor: flagChartColors.autoDetected }}
          />
          Auto-detected
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className="w-2.5 h-[3px] rounded-sm"
            style={{ backgroundColor: flagChartColors.delays }}
          />
          User-reported
        </span>
      </div>
    </div>
  )
}
