'use client'

import { useState, useCallback, useMemo } from 'react'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import AccessDenied from '@/components/ui/AccessDenied'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import DateRangeSelector, { getPresetDates } from '@/components/ui/DateRangeSelector'
import { useFlagAnalytics } from '@/lib/hooks/useFlagAnalytics'
import { flagChartColors } from '@/lib/design-tokens'
import FlagKPICard from '@/components/analytics/flags/FlagKPICard'
import SeverityStrip from '@/components/analytics/flags/SeverityStrip'
import FlagTrendChart from '@/components/analytics/flags/FlagTrendChart'
import DayHeatmap from '@/components/analytics/flags/DayHeatmap'
import { SectionHeader } from '@/components/analytics/AnalyticsComponents'
import { Card } from '@/components/ui/CardEnhanced'
import HorizontalBarList from '@/components/analytics/flags/HorizontalBarList'
import SurgeonFlagTable from '@/components/analytics/flags/SurgeonFlagTable'
import RoomAnalysisCards from '@/components/analytics/flags/RoomAnalysisCards'
import PatternInsightCards from '@/components/analytics/flags/PatternInsightCards'
import RecentFlaggedCases from '@/components/analytics/flags/RecentFlaggedCases'
import FlagDrillThrough from '@/components/analytics/flags/FlagDrillThrough'
import type { DrillThroughTarget } from '@/components/analytics/flags/FlagDrillThrough'
import CaseDrawer from '@/components/cases/CaseDrawer'
import { useProcedureCategories } from '@/hooks/useLookups'
import { Flag, BarChart3, TrendingUp, Grid3x3, Shield, Clock, Users, DoorOpen } from 'lucide-react'

// Delay type color palette (cycles for dynamic delay types from DB)
const DELAY_TYPE_COLORS = [
  '#e11d48', // rose-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0284c7', // sky-600
  '#059669', // emerald-600
  '#ea580c', // orange-600
  '#94a3b8', // slate-400 (fallback)
]

// ============================================
// Loading skeleton (page-specific)
// ============================================

function FlagsPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-[120px]">
            <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
            <div className="h-8 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Severity strip skeleton */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-100 rounded-lg h-12"
          />
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 h-72" />
        <div className="bg-white rounded-xl border border-slate-200 h-72" />
      </div>

      {/* Table placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 h-64" />
    </div>
  )
}

// ============================================
// Empty state
// ============================================

function FlagsEmptyState() {
  return (
    <div className="space-y-6">
      {/* KPI cards with zeroed values */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <FlagKPICard label="Flagged Cases" value="0" unit="%" detail="0 of 0 cases" />
        <FlagKPICard label="Delay Rate" value="0" unit="%" detail="0 user-reported delays" />
        <FlagKPICard label="Critical Flags" value={0} detail="0 warnings · 0 info" />
        <FlagKPICard label="Total Flags" value={0} detail="0 avg per flagged case" />
      </div>

      {/* Centered empty state message */}
      <EmptyState
        icon={<Flag className="w-10 h-10 text-slate-400" />}
        title="No flags detected for this period"
        description="Try expanding the date range or check that cases have been completed and validated."
      />
    </div>
  )
}

// ============================================
// Main page component
// ============================================

export default function CaseFlagsAnalyticsPage() {
  const { loading: userLoading, isGlobalAdmin, effectiveFacilityId, can } = useUser()

  // Date range state — default to last 30 days per Q15
  const [dateRange, setDateRange] = useState('last_30')
  const [startDate, setStartDate] = useState(() => getPresetDates('last_30').start)
  const [endDate, setEndDate] = useState(() => getPresetDates('last_30').end)

  const handleDateRangeChange = useCallback((range: string, start: string, end: string) => {
    setDateRange(range)
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Drill-through state
  const [drillTarget, setDrillTarget] = useState<DrillThroughTarget>(null)

  const handleSurgeonClick = useCallback((surgeonId: string) => {
    setDrillTarget({ mode: 'surgeon', surgeonId })
  }, [])

  const handleRoomClick = useCallback((roomId: string) => {
    setDrillTarget({ mode: 'room', roomId })
  }, [])

  // Case drawer state
  const [drawerCaseId, setDrawerCaseId] = useState<string | null>(null)
  const { data: procedureCategories } = useProcedureCategories()
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    if (procedureCategories) {
      for (const cat of procedureCategories) {
        map.set(cat.id, cat.name)
      }
    }
    return map
  }, [procedureCategories])

  const handleCaseClick = useCallback((caseId: string) => {
    setDrawerCaseId(caseId)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setDrawerCaseId(null)
  }, [])

  const handleDrillClose = useCallback(() => {
    setDrillTarget(null)
  }, [])

  // Data fetching
  const { data, loading, error } = useFlagAnalytics({
    facilityId: effectiveFacilityId,
    startDate,
    endDate,
    enabled: !!effectiveFacilityId,
  })

  const summary = data?.summary

  // ========== Render guards ==========

  // Permission guard
  if (!userLoading && !can('analytics.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  // Loading (user auth)
  if (userLoading) {
    return (
      <DashboardLayout>
        <FlagsPageSkeleton />
      </DashboardLayout>
    )
  }

  // No facility selected (global admin without impersonation)
  if (!effectiveFacilityId && isGlobalAdmin) {
    return (
      <DashboardLayout>
        <AnalyticsPageHeader
          title="Case & Flag Analytics"
          description="Auto-detected anomalies and reported delays"
        />
        <EmptyState
          icon={<BarChart3 className="w-10 h-10 text-slate-400" />}
          title="No Facility Selected"
          description="Select a facility from the sidebar to view flag analytics."
        />
      </DashboardLayout>
    )
  }

  // ========== Determine KPI status colors ==========

  function getFlagRateStatus(rate: number): 'good' | 'neutral' | 'bad' {
    if (rate > 30) return 'bad'
    if (rate > 20) return 'neutral'
    return 'good'
  }

  function getDelayRateStatus(rate: number): 'good' | 'neutral' | 'bad' {
    if (rate > 20) return 'bad'
    if (rate > 15) return 'neutral'
    return 'good'
  }

  // ========== Main render ==========

  const hasFlags = summary && summary.totalFlags > 0
  const caseCountLabel = summary
    ? `${summary.totalCases} cases · ${summary.flaggedCases} flagged`
    : undefined

  return (
    <DashboardLayout>
      {/* Page header with date selector */}
      <AnalyticsPageHeader
        title="Case & Flag Analytics"
        description={
          caseCountLabel
            ? `Auto-detected anomalies and reported delays · ${caseCountLabel}`
            : 'Auto-detected anomalies and reported delays'
        }
        actions={
          <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
        }
      />

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && <FlagsPageSkeleton />}

      {/* Empty state — data loaded but no flags */}
      {!loading && !error && summary && !hasFlags && <FlagsEmptyState />}

      {/* Main content — data loaded with flags */}
      {!loading && !error && summary && hasFlags && (
        <div className="space-y-6">
          {/* KPI Strip — 4 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <FlagKPICard
              label="Flagged Cases"
              value={summary.flagRate.toFixed(1)}
              unit="%"
              trend={summary.flagRateTrend}
              trendInverse
              sparkData={data.sparklineData.flagRate}
              sparkColor={flagChartColors.critical}
              status={getFlagRateStatus(summary.flagRate)}
              detail={`${summary.flaggedCases} of ${summary.totalCases} cases`}
            />
            <FlagKPICard
              label="Delay Rate"
              value={summary.delayRate.toFixed(1)}
              unit="%"
              trend={summary.delayRateTrend}
              trendInverse
              sparkData={data.sparklineData.delayRate}
              sparkColor={flagChartColors.warning}
              status={getDelayRateStatus(summary.delayRate)}
              detail={`${summary.delayedCases} user-reported delays`}
            />
            <FlagKPICard
              label="Critical Flags"
              value={summary.criticalCount}
              status="bad"
              detail={`${summary.warningCount} warnings · ${summary.infoCount} info`}
            />
            <FlagKPICard
              label="Total Flags"
              value={summary.totalFlags}
              detail={`${summary.avgFlagsPerCase.toFixed(1)} avg per flagged case`}
            />
          </div>

          {/* Severity strip */}
          <SeverityStrip
            criticalCount={summary.criticalCount}
            warningCount={summary.warningCount}
            infoCount={summary.infoCount}
            totalFlags={summary.totalFlags}
          />

          {/* Two-column: Trend chart + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card padding="none">
              <Card.Content>
                <SectionHeader
                  title="Flag Trend"
                  subtitle="Weekly auto-detected vs. user-reported"
                  icon={<TrendingUp className="w-4 h-4" />}
                  accentColor="violet"
                />
                <div className="mt-4">
                  <FlagTrendChart data={data.weeklyTrend} />
                </div>
              </Card.Content>
            </Card>

            <Card padding="none">
              <Card.Content>
                <SectionHeader
                  title="Day of Week Heatmap"
                  subtitle="Flag distribution by day and category"
                  icon={<Grid3x3 className="w-4 h-4" />}
                  accentColor="amber"
                />
                <div className="mt-4">
                  <DayHeatmap data={data.dayOfWeekHeatmap} />
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* Two-column: Auto-detected flags + Reported delays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card padding="none">
              <Card.Content>
                <SectionHeader
                  title="Auto-Detected Flags"
                  subtitle={`${data.flagRuleBreakdown.reduce((a, b) => a + b.count, 0)} threshold flags by rule`}
                  icon={<Shield className="w-4 h-4" />}
                  accentColor="red"
                />
                <div className="mt-4">
                  <HorizontalBarList items={data.flagRuleBreakdown} />
                </div>
              </Card.Content>
            </Card>

            <Card padding="none">
              <Card.Content>
                <SectionHeader
                  title="Reported Delays"
                  subtitle={`${data.delayTypeBreakdown.reduce((a, b) => a + b.count, 0)} delays by category`}
                  icon={<Clock className="w-4 h-4" />}
                  accentColor="amber"
                />
                <div className="mt-4">
                  <HorizontalBarList
                    items={data.delayTypeBreakdown.map((d, i) => ({
                      ...d,
                      color: DELAY_TYPE_COLORS[i % DELAY_TYPE_COLORS.length],
                    }))}
                  />
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* Surgeon flag distribution */}
          <Card padding="none">
            <div className="px-6 pt-5 pb-3">
              <SectionHeader
                title="Surgeon Flag Distribution"
                subtitle="Flag rate by surgeon with top flag category"
                icon={<Users className="w-4 h-4" />}
                accentColor="violet"
              />
            </div>
            <SurgeonFlagTable data={data.surgeonFlags} onSurgeonClick={handleSurgeonClick} />
          </Card>

          {/* Room analysis */}
          <div>
            <div className="mb-3">
              <SectionHeader
                title="Room Analysis"
                subtitle="Flag and delay concentration by operating room"
                icon={<DoorOpen className="w-4 h-4" />}
                accentColor="blue"
              />
            </div>
            <RoomAnalysisCards data={data.roomFlags} onRoomClick={handleRoomClick} />
          </div>

          {/* Detected patterns */}
          {data.patterns.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[15px] font-bold text-slate-900">Detected Patterns</h3>
                <p className="text-xs text-slate-500 mt-0.5">Auto-analyzed trends and correlations from your flag data</p>
              </div>
              <div className="p-4">
                <PatternInsightCards patterns={data.patterns} />
              </div>
            </div>
          )}

          {/* Recent flagged cases */}
          <Card padding="none">
            <Card.Content className="!p-0">
              <RecentFlaggedCases
                cases={data.recentFlaggedCases}
                onCaseClick={handleCaseClick}
              />
            </Card.Content>
          </Card>
        </div>
      )}

      {/* Drill-through slide-over */}
      {data && (
        <FlagDrillThrough
          target={drillTarget}
          onClose={handleDrillClose}
          surgeonFlags={data.surgeonFlags}
          roomFlags={data.roomFlags}
          recentFlaggedCases={data.recentFlaggedCases}
          onCaseClick={handleCaseClick}
        />
      )}

      {/* Case detail drawer */}
      <CaseDrawer
        caseId={drawerCaseId}
        onClose={handleDrawerClose}
        categoryNameById={categoryNameById}
      />
    </DashboardLayout>
  )
}
