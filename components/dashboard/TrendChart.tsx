// components/dashboard/TrendChart.tsx
// 30-day trend line chart with metric selector dropdown.
// Uses recharts for rendering. Fetches data independently via useTrendData.

'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChevronDown } from 'lucide-react'
import {
  useTrendData,
  TREND_METRIC_OPTIONS,
  type TrendMetric,
  type TrendDataPoint,
} from '@/lib/hooks/useTrendData'

// ============================================
// Helpers
// ============================================

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}`
}

function getMetricColor(metric: TrendMetric): string {
  switch (metric) {
    case 'utilization': return '#3b82f6'  // blue-500
    case 'turnover': return '#f59e0b'     // amber-500
    case 'caseVolume': return '#10b981'   // emerald-500
    case 'facilityScore': return '#6366f1' // indigo-500
  }
}

function getMetricUnit(metric: TrendMetric): string {
  const option = TREND_METRIC_OPTIONS.find((o) => o.value === metric)
  return option?.unit ?? ''
}

// ============================================
// Custom Tooltip
// ============================================

interface TooltipPayloadItem {
  value: number
  payload: TrendDataPoint
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  metric: TrendMetric
}

function CustomChartTooltip({ active, payload, metric }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0]
  const unit = getMetricUnit(metric)
  const formattedDate = new Date(data.payload.date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{formattedDate}</p>
      <p className="text-sm font-semibold text-slate-900">
        {metric === 'caseVolume'
          ? `${Math.round(data.value)} ${unit}`
          : `${data.value.toFixed(1)} ${unit}`}
      </p>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================

function TrendChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-8 w-36 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-[280px] bg-slate-50 rounded-lg animate-pulse" />
    </div>
  )
}

// ============================================
// Component
// ============================================

export function TrendChart() {
  const [metric, setMetric] = useState<TrendMetric>('utilization')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { data: trendData, loading } = useTrendData(metric)

  const selectedOption = TREND_METRIC_OPTIONS.find((o) => o.value === metric)!
  const color = getMetricColor(metric)

  if (loading) return <TrendChartSkeleton />

  const chartData = (trendData ?? []).map((d) => ({
    ...d,
    dateLabel: formatDateLabel(d.date),
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-slate-900">30-Day Trend</h2>

        {/* Metric selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {selectedOption.label}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]">
                {TREND_METRIC_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setMetric(option.value)
                      setDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      option.value === metric
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip content={<CustomChartTooltip metric={metric} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[280px] text-sm text-slate-400">
          No data available for the last 30 days
        </div>
      )}
    </div>
  )
}
