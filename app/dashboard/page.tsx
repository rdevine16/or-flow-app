// app/dashboard/page.tsx
// Facility admin dashboard — operational command center.
// Phase 3: LivePulseBanner, DashboardKpiCard with sparklines, FacilityScoreMini.

'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { LivePulseBanner } from '@/components/dashboard/LivePulseBanner'
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard'
import { FacilityScoreMini } from '@/components/dashboard/FacilityScoreMini'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import { RoomStatusCard, RoomStatusCardSkeleton } from '@/components/dashboard/RoomStatusCard'
import { TodaysSurgeons } from '@/components/dashboard/TodaysSurgeons'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { QuickAccessCards } from '@/components/dashboard/QuickAccessCards'
import { useDashboardKPIs, type TimeRange } from '@/lib/hooks/useDashboardKPIs'
import { useDashboardAlerts } from '@/lib/hooks/useDashboardAlerts'
import { useTodayStatus } from '@/lib/hooks/useTodayStatus'

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

/** Compute target achievement percentage for a KPI */
function targetPct(value: number, target: number | undefined, lowerIsBetter = false): number {
  if (!target || target === 0) return 0
  if (lowerIsBetter) {
    // For turnover: being under target is good. 25min actual / 30min target = 120% achievement
    if (value <= 0) return 100
    return Math.round((target / value) * 100)
  }
  return Math.round((value / target) * 100)
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('today')
  const { data: kpis, loading, error } = useDashboardKPIs(timeRange)
  const { data: alerts, loading: alertsLoading } = useDashboardAlerts()
  const { data: todayStatus, loading: todayStatusLoading } = useTodayStatus()

  const trendLabel = getTrendLabel(timeRange)

  return (
    <DashboardLayout>
      <div>
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

        {/* Live Pulse Banner */}
        <LivePulseBanner data={todayStatus ?? null} loading={todayStatusLoading} />

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <DashboardKpiCard
            title="OR Utilization"
            value={kpis ? `${kpis.utilization.value.toFixed(1)}%` : '—'}
            trendPct={kpis?.utilization.delta !== undefined ? Math.abs(kpis.utilization.delta) : undefined}
            trendDir={kpis?.utilization.deltaType}
            sparkData={kpis?.utilization.dailyData?.map(d => ({ v: d.numericValue }))}
            sparkColor="#3b82f6"
            target={kpis?.utilization.target ? {
              pct: targetPct(kpis.utilization.value, kpis.utilization.target),
              label: `${kpis.utilization.target}% target`,
            } : undefined}
            loading={loading}
          />
          <DashboardKpiCard
            title="Cases"
            value={kpis ? `${kpis.casesCompleted} / ${kpis.casesScheduled}` : '—'}
            subtitle={trendLabel}
            sparkColor="#10b981"
            loading={loading}
          />
          <DashboardKpiCard
            title="Median Turnover"
            value={kpis ? `${Math.round(kpis.medianTurnover.value)} min` : '—'}
            trendPct={kpis?.medianTurnover.delta !== undefined ? Math.abs(kpis.medianTurnover.delta) : undefined}
            trendDir={kpis?.medianTurnover.deltaType}
            increaseIsGood={false}
            sparkData={kpis?.medianTurnover.dailyData?.map(d => ({ v: d.numericValue }))}
            sparkColor="#f59e0b"
            target={kpis?.medianTurnover.target ? {
              pct: targetPct(kpis.medianTurnover.value, kpis.medianTurnover.target, true),
              label: `${kpis.medianTurnover.target} min target`,
            } : undefined}
            loading={loading}
          />
          <DashboardKpiCard
            title="On-Time Starts"
            value={kpis ? `${kpis.onTimeStartPct.value.toFixed(1)}%` : '—'}
            trendPct={kpis?.onTimeStartPct.delta !== undefined ? Math.abs(kpis.onTimeStartPct.delta) : undefined}
            trendDir={kpis?.onTimeStartPct.deltaType}
            sparkData={kpis?.onTimeStartPct.dailyData?.map(d => ({ v: d.numericValue }))}
            sparkColor="#10b981"
            target={kpis?.onTimeStartPct.target ? {
              pct: targetPct(kpis.onTimeStartPct.value, kpis.onTimeStartPct.target),
              label: `${kpis.onTimeStartPct.target}% target`,
            } : undefined}
            loading={loading}
          />
          <FacilityScoreMini
            score={kpis?.facilityScore ?? null}
            loading={loading}
            trendLabel={trendLabel}
          />
        </div>

        {/* Two-column layout: Needs Attention (left) + Room Status & Surgeons (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <NeedsAttention
              alerts={alerts ?? []}
              loading={alertsLoading}
            />
          </div>
          <div className="lg:col-span-2 space-y-6">
            {/* Room Status Cards */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Room Status</h2>
              {todayStatusLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <RoomStatusCardSkeleton key={i} />
                  ))}
                </div>
              ) : todayStatus && todayStatus.rooms.length > 0 ? (
                <div className="space-y-3">
                  {todayStatus.rooms.map((room) => (
                    <RoomStatusCard key={room.roomId} room={room} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-slate-400">No rooms with cases today</p>
                </div>
              )}
            </div>

            {/* Today's Surgeons */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <TodaysSurgeons
                surgeons={todayStatus?.surgeons ?? []}
                loading={todayStatusLoading}
              />
            </div>
          </div>
        </div>

        {/* Trend Chart — full width, fetches independently */}
        <div className="mt-6">
          <TrendChart />
        </div>

        {/* Quick Access Navigation Cards */}
        <div className="mt-6">
          <QuickAccessCards />
        </div>
      </div>
    </DashboardLayout>
  )
}
