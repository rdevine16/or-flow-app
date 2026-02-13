'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  FinancialsMetrics, 
  SurgeonStats, 
  CaseCompletionStats
} from './types'
import { formatCurrency } from './utils'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { ArrowDown, BarChart3, CalendarDays, ChartBar, ChartBarIcon, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, DollarSign, DollarSignIcon, Info, TrendingDown, TrendingUp, UserIcon } from 'lucide-react'

interface SurgeonTabProps {
  metrics: FinancialsMetrics
  caseStats: CaseCompletionStats[]
  selectedSurgeon: string | null
  onSurgeonSelect: (surgeonId: string | null) => void
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}%`
}

function formatTime(timeStr: string | null, dateStr?: string | null): string {
  if (!timeStr) return '—'
  
  if (dateStr) {
    try {
      const utcDate = new Date(`${dateStr}T${timeStr}Z`)
      if (!isNaN(utcDate.getTime())) {
        return utcDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      }
    } catch {
      // Fall through to basic parsing
    }
  }
  
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return '—'
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours)
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function formatTimestampLocal(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  } catch {
    return '—'
  }
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

type SortDir = 'asc' | 'desc'

function sortByKey<T>(arr: T[], key: (item: T) => number | null, dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    const aVal = key(a) ?? -Infinity
    const bVal = key(b) ?? -Infinity
    return dir === 'desc' ? bVal - aVal : aVal - bVal
  })
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SurgeonTab({ 
  metrics, 
  caseStats,
  selectedSurgeon, 
  onSurgeonSelect 
}: SurgeonTabProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const currentView = selectedDate ? 'day' : selectedSurgeon ? 'detail' : 'list'
  
  const selectedSurgeonData = metrics.surgeonStats.find(s => s.surgeonId === selectedSurgeon)
  
  const surgeonCases = useMemo(() => {
    if (!selectedSurgeon) return []
    return caseStats.filter(c => c.surgeon_id === selectedSurgeon)
  }, [caseStats, selectedSurgeon])

  return (
    <div className="space-y-6">
      <Breadcrumb 
        surgeonName={selectedSurgeonData?.surgeonName}
        selectedDate={selectedDate}
        onNavigate={(view) => {
          if (view === 'list') {
            onSurgeonSelect(null)
            setSelectedDate(null)
          } else if (view === 'detail') {
            setSelectedDate(null)
          }
        }}
      />
      
      {currentView === 'list' && (
        <AllSurgeonsOverview 
          metrics={metrics} 
          onSurgeonSelect={onSurgeonSelect} 
        />
      )}
      
      {currentView === 'detail' && selectedSurgeonData && (
        <SurgeonDetail 
          surgeon={selectedSurgeonData}
          surgeonCases={surgeonCases}
          metrics={metrics}
          onDateSelect={setSelectedDate}
        />
      )}
      
      {currentView === 'day' && selectedSurgeonData && selectedDate && (
        <SurgeonDayView
          surgeon={selectedSurgeonData}
          surgeonCases={surgeonCases}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      )}
    </div>
  )
}

// ============================================
// BREADCRUMB
// ============================================

function Breadcrumb({ 
  surgeonName, 
  selectedDate,
  onNavigate 
}: { 
  surgeonName?: string
  selectedDate: string | null
  onNavigate: (view: 'list' | 'detail' | 'day') => void
}) {
  return (
    <nav className="flex items-center gap-2 text-sm">
      <button 
        onClick={() => onNavigate('list')}
        className={`font-medium transition-colors ${
          !surgeonName 
            ? 'text-slate-900' 
            : 'text-slate-500 hover:text-blue-600'
        }`}
      >
        All Surgeons
      </button>
      
      {surgeonName && (
        <>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <button 
            onClick={() => onNavigate('detail')}
            className={`font-medium transition-colors ${
              !selectedDate 
                ? 'text-slate-900' 
                : 'text-slate-500 hover:text-blue-600'
            }`}
          >
            {surgeonName}
          </button>
        </>
      )}
      
      {selectedDate && (
        <>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900">
            {formatShortDate(selectedDate)}
          </span>
        </>
      )}
    </nav>
  )
}

// ============================================
// ALL SURGEONS OVERVIEW — Sortable Leaderboard
// ============================================

type LeaderboardSortKey = 'totalProfit' | 'caseCount' | 'profitPerORHour' | 'avgMarginPercent' | 'medianProfit'

function AllSurgeonsOverview({ 
  metrics, 
  onSurgeonSelect 
}: { 
  metrics: FinancialsMetrics
  onSurgeonSelect: (surgeonId: string) => void 
}) {
  const { showToast } = useToast()
  const [sortKey, setSortKey] = useState<LeaderboardSortKey>('totalProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedSurgeons = useMemo(() => {
    return sortByKey(metrics.surgeonStats, s => {
      switch (sortKey) {
        case 'totalProfit': return s.totalProfit
        case 'caseCount': return s.caseCount
        case 'profitPerORHour': return s.profitPerORHour
        case 'avgMarginPercent': return s.avgMarginPercent
        case 'medianProfit': return s.medianProfit ?? s.avgProfit
      }
    }, sortDir)
  }, [metrics.surgeonStats, sortKey, sortDir])

  const toggleSort = (key: LeaderboardSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Summary totals
  const totalProfit = metrics.surgeonStats.reduce((sum, s) => sum + s.totalProfit, 0)
  const totalCases = metrics.surgeonStats.reduce((sum, s) => sum + s.caseCount, 0)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total Surgeons"
          value={metrics.surgeonStats.length}
          icon={UserIcon}
        />
        <SummaryCard 
          title="Total Profit"
          value={formatCurrency(totalProfit)}
          icon={DollarSignIcon}
          variant="success"
        />
        <SummaryCard 
          title="Total Cases"
          value={totalCases}
          icon={ChartBarIcon}
        />
        <SummaryCard 
          title="Avg $/OR Hour"
          value={metrics.profitPerORHour !== null ? formatCurrency(metrics.profitPerORHour) : '—'}
          icon={ArrowDown}
        />
      </div>

      {/* Sortable Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Surgeon Leaderboard</h3>
              <p className="text-sm text-slate-500 mt-0.5">Click a surgeon to view detailed performance</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Surgeon</th>
                <SortTH label="Cases" sortKey="caseCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="center" />
                <SortTH label="Total Profit" sortKey="totalProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="Typical/Case" sortKey="medianProfit" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="$/OR Hr" sortKey="profitPerORHour" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortTH label="Margin" sortKey="avgMarginPercent" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th className="px-6 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSurgeons.map((surgeon, idx) => (
                <tr 
                  key={surgeon.surgeonId}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  onClick={() => onSurgeonSelect(surgeon.surgeonId)}
                >
                  <td className="px-6 py-4">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{surgeon.surgeonName}</span>
                      {surgeon.caseCount < 10 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                          Low volume
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-500">
                      <span>{surgeon.procedureBreakdown?.length || 0} procedures</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-green-600 tabular-nums">
                      {formatCurrency(surgeon.totalProfit)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-900 tabular-nums">
                    {formatCurrency(surgeon.medianProfit || surgeon.avgProfit)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-blue-700 tabular-nums">
                    {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <MarginBadge value={surgeon.avgMarginPercent} />
                  </td>
                  <td className="px-6 py-4">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ============================================
// SURGEON DETAIL VIEW
// ============================================

function SurgeonDetail({ 
  surgeon,
  surgeonCases,
  metrics,
  onDateSelect
}: { 
  surgeon: SurgeonStats
  surgeonCases: CaseCompletionStats[]
  metrics: FinancialsMetrics
  onDateSelect: (date: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'procedures'>('overview')
  
  const dailyStats = useMemo(() => {
    const byDate: Record<string, CaseCompletionStats[]> = {}
    surgeonCases.forEach(c => {
      const date = c.case_date
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(c)
    })
    
    return Object.entries(byDate)
      .map(([date, cases]) => ({
        date,
        dayOfWeek: getDayOfWeek(date),
        cases,
        caseCount: cases.length,
        totalProfit: cases.reduce((sum, c) => sum + (c.profit || 0), 0),
        totalDuration: cases.reduce((sum, c) => sum + (c.total_duration_minutes || 0), 0),
        avgProfit: cases.length > 0 
          ? cases.reduce((sum, c) => sum + (c.profit || 0), 0) / cases.length 
          : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [surgeonCases])

  const efficiencyMetrics = useMemo(() => {
    const durations = surgeonCases
      .map(c => c.total_duration_minutes)
      .filter((d): d is number => d !== null && d > 0)
    
    const profits = surgeonCases
      .map(c => c.profit)
      .filter((p): p is number => p !== null)
    
    const surgicalTimes = surgeonCases
      .map(c => c.surgical_duration_minutes)
      .filter((t): t is number => t !== null && t > 0)
    
    const medianDuration = calculateMedian(durations)
    const medianProfit = calculateMedian(profits)
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : null
    const stdDev = avgDuration && durations.length > 1
      ? Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length)
      : null
    const cv = avgDuration && stdDev ? (stdDev / avgDuration) * 100 : null
    
    let consistencyRating: 'high' | 'medium' | 'low' = 'medium'
    if (cv !== null) {
      if (cv < 15) consistencyRating = 'high'
      else if (cv > 30) consistencyRating = 'low'
    }
    
    return {
      medianDuration,
      medianProfit,
      consistencyRating,
      avgSurgicalTime: surgicalTimes.length > 0 
        ? surgicalTimes.reduce((a, b) => a + b, 0) / surgicalTimes.length 
        : null,
    }
  }, [surgeonCases])

  return (
    <div className="space-y-6">
      {/* Header Card — Enhanced with financial metrics */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">
                {surgeon.surgeonName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{surgeon.surgeonName}</h2>
              <p className="text-slate-400 mt-0.5">{surgeon.caseCount} cases in period</p>
            </div>
          </div>
        </div>
        
        {/* Quick Stats — Now 6 columns with financial metrics */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-6 mt-6 pt-6 border-t border-white/10">
          <div>
            <div className="text-slate-400 text-sm">Total Profit</div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(surgeon.totalProfit)}</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Typical/Case</div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(efficiencyMetrics.medianProfit || surgeon.avgProfit)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">$/OR Hour</div>
            <div className="text-2xl font-bold mt-1 text-blue-300">
              {surgeon.profitPerORHour !== null ? formatCurrency(surgeon.profitPerORHour) : '—'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Margin</div>
            <div className="text-2xl font-bold mt-1">
              {formatPercent(surgeon.avgMarginPercent)}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Cases</div>
            <div className="text-2xl font-bold mt-1">{surgeon.caseCount}</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Typical Duration</div>
            <div className="text-2xl font-bold mt-1">
              {formatDuration(efficiencyMetrics.medianDuration)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'daily', label: 'Daily Activity' },
          { id: 'procedures', label: 'By Procedure' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <SurgeonOverviewTab surgeon={surgeon} efficiencyMetrics={efficiencyMetrics} metrics={metrics} surgeonCases={surgeonCases} />
      )}
      
      {activeTab === 'daily' && (
        <DailyActivityTab dailyStats={dailyStats} onDateSelect={onDateSelect} />
      )}
      
      {activeTab === 'procedures' && (
        <ProceduresTab surgeon={surgeon} metrics={metrics} />
      )}
    </div>
  )
}

// ============================================
// SURGEON OVERVIEW TAB — Enhanced with cost breakdown
// ============================================

function SurgeonOverviewTab({ 
  surgeon,
  efficiencyMetrics,
  metrics,
  surgeonCases,
}: { 
  surgeon: SurgeonStats
  efficiencyMetrics: {
    medianDuration: number | null
    medianProfit: number | null
    consistencyRating: 'high' | 'medium' | 'low'
    avgSurgicalTime: number | null
  }
  metrics: FinancialsMetrics
  surgeonCases: CaseCompletionStats[]
}) {
  // Compute revenue/cost breakdown from case data
  const costBreakdown = useMemo(() => {
    const totalReimbursement = surgeonCases.reduce((sum, c) => sum + (c.reimbursement || 0), 0)
    const totalDebits = surgeonCases.reduce((sum, c) => {
      return sum + (c.total_debits ?? c.soft_goods_cost ?? 0)
    }, 0)
    const totalCredits = surgeonCases.reduce((sum, c) => {
      return sum + (c.total_credits ?? c.hard_goods_cost ?? 0)
    }, 0)
    const totalORCost = surgeonCases.reduce((sum, c) => sum + (c.or_cost ?? c.or_time_cost ?? 0), 0)
    const count = surgeonCases.length

    return {
      totalReimbursement,
      totalDebits,
      totalCredits,
      totalORCost,
      avgReimbursement: count > 0 ? totalReimbursement / count : 0,
      avgDebits: count > 0 ? totalDebits / count : 0,
      avgCredits: count > 0 ? totalCredits / count : 0,
      avgORCost: count > 0 ? totalORCost / count : 0,
      avgProfit: count > 0 ? surgeon.totalProfit / count : 0,
    }
  }, [surgeonCases, surgeon.totalProfit])

  return (
    <div className="space-y-6">
      {/* Performance Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Time vs Facility"
          tooltip="Weighted average comparing this surgeon's duration to facility median for each procedure type"
        >
          <div className={`text-2xl font-bold ${
            surgeon.durationVsFacilityMinutes < 0 ? 'text-green-600' : 
            surgeon.durationVsFacilityMinutes > 10 ? 'text-red-500' : 'text-slate-900'
          }`}>
            {surgeon.durationVsFacilityMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsFacilityMinutes)} min
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {surgeon.durationVsFacilityMinutes < 0 ? 'Faster' : 'Slower'} than facility typical
          </div>
        </MetricCard>

        <MetricCard
          title="Profit Impact"
          tooltip="Estimated profit impact per case based on time efficiency"
        >
          <div className={`text-2xl font-bold ${
            surgeon.profitImpact >= 0 ? 'text-green-600' : 'text-red-500'
          }`}>
            {surgeon.profitImpact >= 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}/case
          </div>
          <div className="text-sm text-slate-500 mt-1">
            From time efficiency
          </div>
        </MetricCard>

        <MetricCard
          title="Typical Surgical Time"
          tooltip="Median incision-to-closing time across all cases"
        >
          <div className="text-2xl font-bold text-slate-900">
            {formatDuration(efficiencyMetrics.avgSurgicalTime)}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Incision to closing
          </div>
        </MetricCard>

        <MetricCard
          title="Consistency"
          tooltip="Based on variation in case durations (lower variation = higher consistency)"
        >
          <ConsistencyBadge rating={efficiencyMetrics.consistencyRating} size="large" />
          <div className="text-sm text-slate-500 mt-2">
            Case duration variance
          </div>
        </MetricCard>
      </div>

      {/* Average Case Economics */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Case Economics</h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-slate-500">Reimbursement</span>
            <span className="text-sm font-medium text-slate-900 tabular-nums">
              {formatCurrency(costBreakdown.avgReimbursement)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 pl-4">
            <span className="text-sm text-slate-500">Debits (implants, supplies)</span>
            <span className="text-sm font-medium text-red-500 tabular-nums">
              ({formatCurrency(costBreakdown.avgDebits)})
            </span>
          </div>
          {costBreakdown.avgCredits > 0 && (
            <div className="flex items-center justify-between py-1.5 pl-4">
              <span className="text-sm text-slate-500">Credits (rebates, fees)</span>
              <span className="text-sm font-medium text-green-600 tabular-nums">
                +{formatCurrency(costBreakdown.avgCredits)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5 pl-4">
            <span className="text-sm text-slate-500">OR Time Cost</span>
            <span className="text-sm font-medium text-red-500 tabular-nums">
              ({formatCurrency(costBreakdown.avgORCost)})
            </span>
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200">
            <span className="text-sm font-semibold text-slate-900">Avg Profit/Case</span>
            <span className={`text-sm font-bold tabular-nums ${costBreakdown.avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(costBreakdown.avgProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// DAILY ACTIVITY TAB
// ============================================

interface DailyStatsRow {
  date: string
  dayOfWeek: string
  cases: CaseCompletionStats[]
  caseCount: number
  totalProfit: number
  totalDuration: number
  avgProfit: number
}

function DailyActivityTab({ 
  dailyStats,
  onDateSelect
}: { 
  dailyStats: DailyStatsRow[]
  onDateSelect: (date: string) => void
}) {
  if (dailyStats.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">No activity in this period</h3>
        <p className="text-slate-500 mt-1">Try selecting a different date range</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <h3 className="text-lg font-semibold text-slate-900">Daily Activity</h3>
        <p className="text-sm text-slate-500 mt-0.5">Click a day to view detailed breakdown</p>
      </div>
      
      <div className="divide-y divide-slate-100">
        {dailyStats.map(day => (
          <div 
            key={day.date}
            onClick={() => onDateSelect(day.date)}
            className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50/50 cursor-pointer transition-all group"
          >
            <div className="w-20">
              <div className="text-lg font-bold text-slate-900">{formatShortDate(day.date)}</div>
              <div className="text-sm text-slate-500">{day.dayOfWeek}</div>
            </div>
            
            <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">
              {day.caseCount} {day.caseCount === 1 ? 'case' : 'cases'}
            </div>
            
            <div className="flex-1 flex items-center gap-8 justify-end">
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Duration</div>
                <div className="text-sm font-semibold text-slate-900">{formatDuration(day.totalDuration)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Total Profit</div>
                <div className="text-sm font-bold text-green-600">{formatCurrency(day.totalProfit)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Avg/Case</div>
                <div className="text-sm font-semibold text-slate-900">{formatCurrency(day.avgProfit)}</div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// PROCEDURES TAB (within surgeon detail)
// ============================================

function ProceduresTab({ 
  surgeon,
  metrics 
}: { 
  surgeon: SurgeonStats
  metrics: FinancialsMetrics
}) {
  if (!surgeon.procedureBreakdown || surgeon.procedureBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-900">No procedure data</h3>
        <p className="text-slate-500 mt-1">Complete cases to see procedure breakdown</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <h3 className="text-lg font-semibold text-slate-900">Performance by Procedure</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Comparing surgeon median to facility median for each procedure
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Procedure</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Cases</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Profit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Surgeon Median</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Facility Median</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {surgeon.procedureBreakdown.map(proc => {
              const facilityProc = metrics.procedureStats.find(p => p.procedureId === proc.procedureId)
              const facilityMedian = facilityProc?.medianDurationMinutes || null
              const diff = proc.medianDuration !== null && facilityMedian !== null
                ? proc.medianDuration - facilityMedian
                : null
              
              return (
                <tr key={proc.procedureId} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{proc.procedureName}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-slate-600">{proc.caseCount}</span>
                    {proc.caseCount < 5 && (
                      <span className="ml-1.5 text-amber-500 text-xs">*</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-green-600 tabular-nums">
                    {formatCurrency(proc.totalProfit)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-900 tabular-nums">
                    {formatDuration(proc.medianDuration)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500 tabular-nums">
                    {formatDuration(facilityMedian)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {diff !== null ? (
                      <ComparisonPill value={diff} unit="min" invertColors />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {surgeon.procedureBreakdown.some(p => p.caseCount < 5) && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500">* Low sample size — interpret with caution</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// SURGEON DAY VIEW
// ============================================

interface CasePhases {
  preOp: number | null
  surgical: number | null
  closing: number | null
  emergence: number | null
}

function SurgeonDayView({
  surgeon,
  surgeonCases,
  selectedDate,
  onDateChange
}: {
  surgeon: SurgeonStats
  surgeonCases: CaseCompletionStats[]
  selectedDate: string
  onDateChange: (date: string) => void
}) {
  const [milestoneMap, setMilestoneMap] = useState<Record<string, CasePhases>>({})
  const [loadingMilestones, setLoadingMilestones] = useState(false)

  const dayCases = useMemo(() => {
    return surgeonCases
      .filter(c => c.case_date === selectedDate)
      .sort((a, b) => (a.actual_start_time || '').localeCompare(b.actual_start_time || ''))
  }, [surgeonCases, selectedDate])
const { showToast } = useToast()
  const fetchMilestones = useCallback(async (caseIds: string[]) => {
    if (caseIds.length === 0) {
      setMilestoneMap({})
      return
    }

    setLoadingMilestones(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('case_milestones')
        .select(`
          case_id,
          recorded_at,
          facility_milestone_id,
          facility_milestones (name)
        `)
        .in('case_id', caseIds)
        .order('recorded_at', { ascending: true })

if (error) {
  showToast({
    type: 'error',
    title: 'Failed to Fetch Milestones',
    message: error.message || 'An unexpected error occurred'
  })
  setMilestoneMap({})
  return
}

      const phaseMap: Record<string, CasePhases> = {}
      const byCaseId: Record<string, Array<{ name: string; recorded_at: string }>> = {}
      for (const m of data || []) {
        const fm = Array.isArray(m.facility_milestones) 
          ? m.facility_milestones[0] 
          : m.facility_milestones
        if (!fm?.name || !m.recorded_at) continue
        
        if (!byCaseId[m.case_id]) byCaseId[m.case_id] = []
        byCaseId[m.case_id].push({ name: fm.name, recorded_at: m.recorded_at })
      }

      for (const [caseId, milestones] of Object.entries(byCaseId)) {
        const timeMap: Record<string, number> = {}
        for (const m of milestones) {
          timeMap[m.name] = new Date(m.recorded_at).getTime()
        }

        const diffMin = (endKey: string, startKey: string): number | null => {
          const s = timeMap[startKey]
          const e = timeMap[endKey]
          if (!s || !e) return null
          const minutes = (e - s) / 60000
          return minutes >= 0 ? Math.round(minutes) : null
        }

        phaseMap[caseId] = {
          preOp: diffMin('incision', 'patient_in'),
          surgical: diffMin('closing', 'incision'),
          closing: diffMin('closing_complete', 'closing'),
          emergence: diffMin('patient_out', 'closing_complete'),
        }
      }

      setMilestoneMap(phaseMap)
    } catch (err) {
showToast({
  type: 'error',
  title: 'Error fetching milestones:',
  message: err instanceof Error ? err.message : 'Error fetching milestones:'
})    } finally {
      setLoadingMilestones(false)
    }
  }, [])

  useEffect(() => {
    const caseIds = dayCases.map(c => c.case_id)
    fetchMilestones(caseIds)
  }, [dayCases, fetchMilestones])

  const surgeonMedians = useMemo(() => {
    const byProcedure: Record<string, { durations: number[], profits: number[] }> = {}
    
    surgeonCases.forEach(c => {
      if (!c.procedure_type_id) return
      if (!byProcedure[c.procedure_type_id]) {
        byProcedure[c.procedure_type_id] = { durations: [], profits: [] }
      }
      if (c.total_duration_minutes) byProcedure[c.procedure_type_id].durations.push(c.total_duration_minutes)
      if (c.profit) byProcedure[c.procedure_type_id].profits.push(c.profit)
    })
    
    const result: Record<string, { medianDuration: number | null, medianProfit: number | null }> = {}
    Object.entries(byProcedure).forEach(([procId, data]) => {
      result[procId] = {
        medianDuration: calculateMedian(data.durations),
        medianProfit: calculateMedian(data.profits),
      }
    })
    return result
  }, [surgeonCases])

  const dayMetrics = useMemo(() => {
    const totalProfit = dayCases.reduce((sum, c) => sum + (c.profit || 0), 0)
    const totalDuration = dayCases.reduce((sum, c) => sum + (c.total_duration_minutes || 0), 0)
    const totalSurgicalTime = dayCases.reduce((sum, c) => sum + (c.surgical_duration_minutes || 0), 0)
    const firstCase = dayCases[0]
    
    return {
      caseCount: dayCases.length,
      totalProfit,
      totalDuration,
      totalSurgicalTime,
      avgProfit: dayCases.length > 0 ? totalProfit / dayCases.length : 0,
      avgDuration: dayCases.length > 0 ? totalDuration / dayCases.length : 0,
      firstCaseTime: firstCase?.actual_start_time || null,
      uptimePercent: totalDuration > 0 ? Math.round((totalSurgicalTime / totalDuration) * 100) : 0,
    }
  }, [dayCases])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{formatDateDisplay(selectedDate)}</h2>
          <p className="text-slate-500 mt-0.5">Daily performance breakdown for {surgeon.surgeonName}</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Day Overview</h3>
            <p className="text-sm text-slate-500">Key metrics at a glance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DayMetricCard 
            icon={Clock}
            label="First Case Start"
            value={formatTime(dayMetrics.firstCaseTime, selectedDate)}
          />
          <DayMetricCard 
            icon={ChartBar}
            label="Total Cases"
            value={dayMetrics.caseCount.toString()}
          />
          <DayMetricCard 
            icon={Clock}
            label="Total OR Time"
            value={formatDuration(dayMetrics.totalDuration)}
          />
          <DayMetricCard 
            icon={DollarSignIcon}
            label="Total Profit"
            value={formatCurrency(dayMetrics.totalProfit)}
            highlight
          />
        </div>

        {dayMetrics.totalDuration > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Surgical Uptime</span>
              <span className="text-sm font-bold text-slate-900">{dayMetrics.uptimePercent}%</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" 
                style={{ width: `${dayMetrics.uptimePercent}%` }} 
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Surgical Time ({formatDuration(dayMetrics.totalSurgicalTime)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <span>Non-Surgical ({formatDuration(dayMetrics.totalDuration - dayMetrics.totalSurgicalTime)})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cases List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Cases</h3>
              <p className="text-sm text-slate-500 mt-0.5">{dayCases.length} cases completed</p>
            </div>
            {dayCases.length > 0 && !loadingMilestones && Object.keys(milestoneMap).length > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Pre-Op</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Surgical</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Closing</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500" /> Emergence</div>
              </div>
            )}
          </div>
        </div>

        {dayCases.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="w-8 h-8 text-slate-400" />}
            title="No cases on this day"
            description="Select a different date to view cases"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {dayCases.map((caseData, idx) => {
              const procMedians = caseData.procedure_type_id 
                ? surgeonMedians[caseData.procedure_type_id] 
                : null
              
              const durationDiff = caseData.total_duration_minutes && procMedians?.medianDuration
                ? caseData.total_duration_minutes - procMedians.medianDuration
                : null
              
              const profitDiff = caseData.profit && procMedians?.medianProfit
                ? caseData.profit - procMedians.medianProfit
                : null
              
              const phases = milestoneMap[caseData.case_id]

              return (
                <div key={caseData.case_id} className="px-6 py-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                        ${idx === 0 
                          ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/20' 
                          : 'bg-slate-100 text-slate-600'
                        }
                      `}>
                        {idx + 1}
                      </div>
                      {idx === 0 && (
                        <span className="text-xs font-medium text-amber-600">First</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">
                          {(Array.isArray(caseData.procedure_types) ? caseData.procedure_types[0]?.name : caseData.procedure_types?.name) || 'Unknown Procedure'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-sm text-slate-500">{(Array.isArray(caseData.or_rooms) ? caseData.or_rooms[0]?.name : caseData.or_rooms?.name) || 'No Room'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className="font-mono">{caseData.case_number}</span>
                        <span className="text-slate-300">•</span>
                        <span>{formatTime(caseData.actual_start_time, caseData.case_date)}</span>
                      </div>

                      {phases && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <PhasePill label="Pre-Op" minutes={phases.preOp} color="blue" />
                          <PhasePill label="Surgical" minutes={phases.surgical} color="green" />
                          <PhasePill label="Closing" minutes={phases.closing} color="amber" />
                          <PhasePill label="Emergence" minutes={phases.emergence} color="violet" />
                        </div>
                      )}
                      {loadingMilestones && !phases && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="h-6 w-16 bg-slate-100 rounded-md animate-pulse" />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Duration</div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatDuration(caseData.total_duration_minutes)}
                          </span>
                          {durationDiff !== null && (
                            <ComparisonPill value={durationDiff} unit="min" invertColors />
                          )}
                        </div>
                      </div>

                      <div className="text-right min-w-[140px]">
                        <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Profit</div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-bold text-green-600">
                            {formatCurrency(caseData.profit || 0)}
                          </span>
                          {profitDiff !== null && (
                            <ComparisonPill value={profitDiff} format="currency" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

function SummaryCard({ 
  title, 
  value, 
  icon: Icon,
  variant 
}: { 
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  variant?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${variant === 'success' ? 'bg-green-50' : 'bg-slate-50'}
        `}>
          <Icon className={`w-5 h-5 ${variant === 'success' ? 'text-green-600' : 'text-slate-600'}`} />
        </div>
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-xl font-bold ${variant === 'success' ? 'text-green-600' : 'text-slate-900'}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ 
  title, 
  tooltip, 
  children 
}: { 
  title: string
  tooltip?: string
  children: React.ReactNode 
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function DayMetricCard({ 
  icon: Icon, 
  label, 
  value,
  highlight 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`
      rounded-xl p-4 
      ${highlight ? 'bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200' : 'bg-slate-50'}
    `}>
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-green-600' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  )
}

// ============================================
// SORT TABLE HEADER
// ============================================

function SortTH<T extends string>({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = 'right',
}: {
  label: string
  sortKey: T
  current: T
  dir: SortDir
  onClick: (key: T) => void
  align?: 'left' | 'center' | 'right'
}) {
  const isActive = current === sortKey
  const alignClass = align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right'

  return (
    <th
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors ${alignClass} ${
        isActive ? 'text-slate-700' : 'text-slate-500'
      }`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          dir === 'desc'
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronUp className="w-3 h-3" />
        )}
      </span>
    </th>
  )
}

// ============================================
// RANK BADGE
// ============================================

function RankBadge({ rank }: { rank: number }) {
  const styles = rank <= 3
    ? [
        'bg-gradient-to-br from-amber-400 to-amber-500 text-white',
        'bg-gradient-to-br from-slate-300 to-slate-400 text-white',
        'bg-gradient-to-br from-amber-600 to-amber-700 text-white',
      ][rank - 1]
    : 'bg-slate-100 text-slate-600'

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${styles}`}>
      {rank}
    </div>
  )
}

// ============================================
// MARGIN BADGE
// ============================================

function MarginBadge({ value }: { value: number }) {
  const color =
    value >= 30 ? 'bg-green-50 text-green-600' :
    value >= 15 ? 'bg-amber-50 text-amber-700' :
    value >= 0 ? 'bg-red-50 text-red-700' :
    'bg-red-100 text-red-800'

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${color}`}>
      {formatPercent(value)}
    </span>
  )
}

// ============================================
// COMPARISON PILL
// ============================================

function ComparisonPill({ 
  value, 
  unit,
  format,
  invertColors = false
}: { 
  value: number
  unit?: string
  format?: 'currency' | 'percent'
  invertColors?: boolean
}) {
  const isPositive = value > 0
  const isNeutral = Math.abs(value) < 0.5
  const isGood = invertColors ? !isPositive : isPositive
  
  let displayValue: string
  if (format === 'currency') {
    displayValue = `${isPositive ? '+' : ''}${formatCurrency(value)}`
  } else if (format === 'percent') {
    displayValue = `${isPositive ? '+' : ''}${Math.round(value)}%`
  } else {
    displayValue = `${isPositive ? '+' : ''}${Math.round(value)}${unit ? ` ${unit}` : ''}`
  }

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
        {displayValue}
      </span>
    )
  }

  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
      transition-all duration-200
      ${isGood 
        ? 'bg-gradient-to-r from-green-50 to-green-100 text-green-600 ring-1 ring-green-200/50' 
        : 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 ring-1 ring-red-200/50'
      }
    `}>
      {isGood ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {displayValue}
    </span>
  )
}

// ============================================
// CONSISTENCY BADGE
// ============================================

function ConsistencyBadge({ 
  rating, 
  size = 'medium' 
}: { 
  rating: 'high' | 'medium' | 'low'
  size?: 'small' | 'medium' | 'large'
}) {
  const config = {
    high: {
      label: 'High Consistency',
      icon: '⚡',
      bg: 'bg-gradient-to-r from-green-50 to-green-100',
      text: 'text-green-600',
      ring: 'ring-green-200/50',
    },
    medium: {
      label: 'Moderate',
      icon: '◐',
      bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
      text: 'text-amber-700',
      ring: 'ring-amber-200/50',
    },
    low: {
      label: 'Variable',
      icon: '◯',
      bg: 'bg-gradient-to-r from-red-50 to-red-100',
      text: 'text-red-700',
      ring: 'ring-red-200/50',
    },
  }

  const c = config[rating]
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-2.5 py-1 text-sm',
    large: 'px-3 py-1.5 text-base',
  }

  return (
    <span className={`
      inline-flex items-center gap-1.5 font-semibold rounded-lg ring-1
      ${c.bg} ${c.text} ${c.ring} ${sizeClasses[size]}
    `}>
      <span>{c.icon}</span>
      {c.label}
    </span>
  )
}

// ============================================
// PHASE DURATION PILL
// ============================================

const phaseColorMap = {
  blue: {
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    ring: 'ring-blue-200/60',
  },
  green: {
    bg: 'bg-green-50',
    dot: 'bg-green-500',
    text: 'text-green-600',
    ring: 'ring-green-200/60',
  },
  amber: {
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    ring: 'ring-amber-200/60',
  },
  violet: {
    bg: 'bg-violet-50',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    ring: 'ring-violet-200/60',
  },
} as const

function PhasePill({ 
  label, 
  minutes, 
  color 
}: { 
  label: string
  minutes: number | null
  color: keyof typeof phaseColorMap
}) {
  if (minutes === null) return null
  
  const c = phaseColorMap[color]
  
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
      ${c.bg} ${c.text} ring-1 ${c.ring}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label} {minutes}m
    </span>
  )
}