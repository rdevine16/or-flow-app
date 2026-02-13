// app/dashboard/page.tsx
// Facility admin dashboard — home base for operational overview
// Phase 2: KPI cards with time context toggle and real data.

'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { MetricCard } from '@/components/ui/MetricCard'
import { FacilityScoreCard } from '@/components/dashboard/FacilityScoreCard'
import { useDashboardKPIs, type TimeRange } from '@/lib/hooks/useDashboardKPIs'

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]

function getTrendLabel(timeRange: TimeRange): string {
  switch (timeRange) {
    case 'today': return 'vs yesterday'
    case 'week': return 'vs last week'
    case 'month': return 'vs last month'
  }
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('today')
  const { data: kpis, loading, error } = useDashboardKPIs(timeRange)

  const trendLabel = getTrendLabel(timeRange)

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header + Time toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Facility operations overview</p>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                  timeRange === option.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            Failed to load dashboard data: {error}
          </div>
        )}

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard
            title="OR Utilization"
            value={kpis?.utilization.value ?? 0}
            suffix="%"
            decimals={1}
            trend={kpis?.utilization.delta ?? undefined}
            trendLabel={trendLabel}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Cases"
            value={kpis?.casesCompleted ?? 0}
            suffix={kpis ? ` / ${kpis.casesScheduled}` : ''}
            trend={undefined}
            trendLabel={trendLabel}
            color="green"
            loading={loading}
          />
          <MetricCard
            title="Median Turnover"
            value={kpis?.medianTurnover.value ?? 0}
            suffix=" min"
            decimals={0}
            trend={kpis?.medianTurnover.delta ?? undefined}
            trendLabel={trendLabel}
            color="amber"
            loading={loading}
          />
          <MetricCard
            title="On-Time Starts"
            value={kpis?.onTimeStartPct.value ?? 0}
            suffix="%"
            decimals={1}
            trend={kpis?.onTimeStartPct.delta ?? undefined}
            trendLabel={trendLabel}
            color="green"
            loading={loading}
          />
          <FacilityScoreCard
            score={kpis?.facilityScore ?? null}
            loading={loading}
            trendLabel={trendLabel}
          />
        </div>

        {/* Placeholder for upcoming phases */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-slate-400">Needs Attention list coming in Phase 3</p>
          </div>
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-slate-400">Room Status coming in Phase 4</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
