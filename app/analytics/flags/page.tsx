'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateFilter from '@/components/ui/DateFilter'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// Tremor components
import {
  Card,
  Metric,
  Text,
  Title,
  Subtitle,
  Flex,
  Grid,
  BadgeDelta,
  ProgressBar,
  Tracker,
  BarChart,
  DonutChart,
  Legend,
  type Color,
} from '@tremor/react'

// Analytics functions
import {
  calculateAnalyticsOverview,
  formatMinutes,
  filterActiveCases,
  type CaseWithMilestones,
  type CaseWithMilestonesAndSurgeon,
  type FlipRoomAnalysis,
  type FCOTSConfig,
  type RoomHoursMap,
  type ORUtilizationResult,
  type RoomUtilizationDetail,
  type SurgeonIdleSummary,
} from '@/lib/analyticsV2'

import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock, Info, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface KPIData {
  value: number
  displayValue: string
  subtitle: string
  target?: number
  targetMet?: boolean
  delta?: number
  deltaType?: 'increase' | 'decrease' | 'unchanged'
  dailyData?: Array<{ color: Color; tooltip: string }>
}

// ============================================
// ENTERPRISE KPI CARD
// ============================================

function KPICard({ 
  title, 
  kpi, 
  icon: Icon,
  accentColor = 'blue',
  showTracker = true,
  onClick,
  invertDelta = false,
  tooltip,
}: { 
  title: string
  kpi: KPIData
  icon?: React.ComponentType<{ className?: string }>
  accentColor?: 'blue' | 'green' | 'amber' | 'rose' | 'violet'
  showTracker?: boolean
  onClick?: () => void
  invertDelta?: boolean
  tooltip?: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  const getDeltaType = () => {
    if (!kpi.deltaType || kpi.deltaType === 'unchanged') return 'unchanged'
    if (invertDelta) {
      return kpi.deltaType === 'decrease' ? 'increase' : 'decrease'
    }
    return kpi.deltaType
  }

  const accentColors = {
    blue: {
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      ring: 'ring-blue-500/20',
      metricColor: 'text-slate-900',
    },
    green: {
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      ring: 'ring-green-500/20',
      metricColor: 'text-slate-900',
    },
    amber: {
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      ring: 'ring-amber-500/20',
      metricColor: 'text-slate-900',
    },
    rose: {
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      ring: 'ring-rose-500/20',
      metricColor: 'text-slate-900',
    },
    violet: {
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      ring: 'ring-violet-500/20',
      metricColor: 'text-slate-900',
    },
  }

  const colors = accentColors[accentColor]

  return (
    <div 
      className={`
        relative bg-white rounded-xl border border-slate-200/60 
        shadow-sm hover:shadow-md transition-all duration-200
        ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}
      `}
      onClick={onClick}
    >
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-${accentColor}-500/40 to-transparent`} />
      
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                <Icon className={`w-4 h-4 ${colors.iconColor}`} />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Text className="font-medium text-slate-600">{title}</Text>
              {tooltip && (
                <div className="relative">
                  <Info 
                    className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help transition-colors" 
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  />
                  {showTooltip && (
                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-slate-800 text-white text-xs leading-relaxed rounded-lg shadow-lg pointer-events-none">
                      {tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="w-2 h-2 bg-slate-800 rotate-45" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {kpi.delta !== undefined && kpi.deltaType && kpi.deltaType !== 'unchanged' && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${getDeltaType() === 'increase' 
                ? 'bg-green-50 text-green-600' 
                : 'bg-rose-50 text-rose-700'
              }
            `}>
              {getDeltaType() === 'increase' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(kpi.delta)}%
            </div>
          )}
        </div>

        {/* Metric */}
        <div className="mb-2">
          <span className={`text-3xl font-semibold tracking-tight ${colors.metricColor}`}>
            {kpi.displayValue}
          </span>
        </div>

        {/* Target indicator */}
        {kpi.target !== undefined && (
          <div className="flex items-center gap-2 mb-3">
            <div className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
              ${kpi.targetMet 
                ? 'bg-green-50 text-green-600 border border-green-200/60' 
                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              }
            `}>
              {kpi.targetMet ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              Target: {title.includes('Cancellation') ? `<${kpi.target}%` : 
                       title.includes('Same-Room') || title.includes('Flip Room') ? `≤${kpi.target} min` :
                       `${kpi.target}%`}
            </div>
          </div>
        )}

        {/* Subtitle */}
        {kpi.subtitle && (
          <Text className="text-slate-500 text-sm">{kpi.subtitle}</Text>
        )}

        {/* Tracker */}
        {showTracker && kpi.dailyData && kpi.dailyData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <Text className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Daily Trend
              </Text>
              <Text className="text-xs text-slate-400">
                {kpi.dailyData.length} days
              </Text>
            </div>
            <Tracker data={kpi.dailyData} className="h-8" />
          </div>
        )}

        {/* Click indicator */}
        {onClick && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600 hover:text-blue-700">
            View details
            <ArrowRight className="w-3 h-3 ml-1" />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// SURGEON IDLE TIME CARD (Per-Surgeon Summary)
// ============================================

function SurgeonIdleTimeCard({ 
  combined, 
  flipKpi,
  sameRoomKpi,
  summaries,
  onClick 
}: { 
  combined: KPIData
  flipKpi: KPIData
  sameRoomKpi: KPIData
  summaries: SurgeonIdleSummary[]
  onClick?: () => void 
}) {
  const statusConfig = {
    on_track: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: 'bg-green-500' },
    call_sooner: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    call_later: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    turnover_only: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  }

  // Separate surgeons with flip data (callback-relevant) from same-room only
  const flipSurgeons = summaries.filter(s => s.hasFlipData)
  const turnoverOnlySurgeons = summaries.filter(s => !s.hasFlipData)

  return (
    <div 
      className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden col-span-1 md:col-span-3"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative p-4">
        {/* Header with badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <Text className="font-medium text-slate-700">Surgeon Callback Optimization</Text>
              <Text className="text-xs text-slate-500">Flip room callback timing &amp; idle analysis</Text>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full shadow-sm">
            AI Insight
          </span>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200/40">
            <Text className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overall Median</Text>
            <div className="text-2xl font-semibold text-blue-900">{combined.displayValue}</div>
            <Text className="text-xs text-slate-500 mt-0.5">{summaries.length} surgeons analyzed</Text>
          </div>
          <div className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200/40">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowRight className="w-3 h-3 text-violet-500" />
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wide">Flip Room Idle</Text>
            </div>
            <div className="text-2xl font-semibold text-violet-700">{flipKpi.displayValue}</div>
            <Text className="text-xs text-slate-500 mt-0.5">{flipSurgeons.length} surgeons w/ flips</Text>
          </div>
          <div className="p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200/40">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wide">Same Room Idle</Text>
            </div>
            <div className="text-2xl font-semibold text-amber-700">{sameRoomKpi.displayValue}</div>
            <Text className="text-xs text-slate-500 mt-0.5">{turnoverOnlySurgeons.length} same-room only</Text>
          </div>
        </div>

        {/* Per-surgeon table — Flip room surgeons (callback-relevant) */}
        {flipSurgeons.length > 0 && (
          <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-blue-200/40 overflow-hidden mb-3">
            {/* Section label */}
            <div className="px-4 py-2 bg-violet-50/50 border-b border-blue-100/60">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
                <Text className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  Flip Room Surgeons — Callback Optimization
                </Text>
              </div>
            </div>
            
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-white/50 border-b border-blue-100/60 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <div className="col-span-3">Surgeon</div>
              <div className="col-span-1 text-center">Cases</div>
              <div className="col-span-2 text-center">Flip Idle</div>
              <div className="col-span-2 text-center">Callback Δ</div>
              <div className="col-span-2 text-center">Same Rm Idle</div>
              <div className="col-span-2 text-center">Callback</div>
            </div>

            {/* Surgeon rows */}
            <div className="divide-y divide-blue-100/40 max-h-[240px] overflow-y-auto">
              {flipSurgeons.map((surgeon) => {
                const sc = statusConfig[surgeon.status]
                return (
                  <div key={surgeon.surgeonId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/40 transition-colors">
                    <div className="col-span-3">
                      <p className="font-medium text-slate-900 text-sm truncate">{surgeon.surgeonName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-violet-600 bg-violet-50 px-1 py-0.5 rounded">
                          {surgeon.flipGapCount} flip{surgeon.flipGapCount !== 1 ? 's' : ''}
                        </span>
                        {surgeon.sameRoomGapCount > 0 && (
                          <span className="text-xs text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                            {surgeon.sameRoomGapCount} same
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-sm font-medium text-slate-700">{surgeon.caseCount}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`text-sm font-semibold ${
                        surgeon.medianFlipIdle > 15 ? 'text-rose-600' : 
                        surgeon.medianFlipIdle > 10 ? 'text-amber-700' : 
                        'text-slate-700'
                      }`}>
                        {Math.round(surgeon.medianFlipIdle)} min
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`text-sm font-medium ${
                        surgeon.medianCallbackDelta > 5 ? 'text-blue-700' : 'text-slate-500'
                      }`}>
                        {surgeon.medianCallbackDelta > 0 ? `${Math.round(surgeon.medianCallbackDelta)} min` : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-sm text-slate-500">
                        {surgeon.sameRoomGapCount > 0 ? `${Math.round(surgeon.medianSameRoomIdle)} min` : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text} border ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {surgeon.statusLabel}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Same-room only surgeons (no callback optimization possible) */}
        {turnoverOnlySurgeons.length > 0 && (
          <div className="bg-white/50 backdrop-blur-sm rounded-lg border border-slate-200/40 overflow-hidden">
            {/* Section label */}
            <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100/60">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Same-Room Only — Callback N/A (turnover-driven)
                </Text>
              </div>
            </div>

            {/* Compact list */}
            <div className="divide-y divide-slate-100/40 max-h-[160px] overflow-y-auto">
              {turnoverOnlySurgeons.map((surgeon) => (
                <div key={surgeon.surgeonId} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-slate-700 text-sm">{surgeon.surgeonName}</p>
                    <span className="text-xs text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                      {surgeon.sameRoomGapCount} gap{surgeon.sameRoomGapCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-600">{Math.round(surgeon.medianSameRoomIdle)} min</span>
                      <span className="text-xs text-slate-400 ml-1">idle</span>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {surgeon.caseCount} cases
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {summaries.length === 0 && (
          <div className="p-4 bg-white/50 rounded-lg border border-blue-200/40 text-center">
            <Text className="text-sm text-slate-500">No multi-case surgeon days in this period</Text>
          </div>
        )}

        {/* Insight box */}
        {summaries.length > 0 && (() => {
          const callSoonerCount = flipSurgeons.filter(s => s.status === 'call_sooner').length
          const onTrackCount = flipSurgeons.filter(s => s.status === 'on_track').length
          const callLaterCount = flipSurgeons.filter(s => s.status === 'call_later').length
          
          if (callSoonerCount > 0) {
            return (
              <div className="mt-4 p-3 bg-amber-50/80 backdrop-blur-sm rounded-lg border border-amber-200/40">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <Text className="text-amber-800 text-sm font-medium">
                    {callSoonerCount} surgeon{callSoonerCount > 1 ? 's' : ''} with flip rooms could benefit from earlier patient callbacks — potential to recover {
                      Math.round(flipSurgeons.filter(s => s.status === 'call_sooner').reduce((sum, s) => sum + s.medianCallbackDelta, 0))
                    } min of idle time per day
                  </Text>
                </div>
              </div>
            )
          } else if (callLaterCount > 0) {
            return (
              <div className="mt-4 p-3 bg-blue-50/80 backdrop-blur-sm rounded-lg border border-blue-200/40">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <Text className="text-blue-800 text-sm font-medium">
                    {callLaterCount} surgeon{callLaterCount > 1 ? 's' : ''} arriving before flip rooms are ready — consider delaying callbacks slightly
                  </Text>
                </div>
              </div>
            )
          } else if (flipSurgeons.length > 0) {
            return (
              <div className="mt-4 p-3 bg-green-50/80 backdrop-blur-sm rounded-lg border border-green-200/40">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <Text className="text-green-800 text-sm font-medium">
                    All {onTrackCount} flip room surgeon{onTrackCount !== 1 ? 's have' : ' has'} well-timed callbacks
                  </Text>
                </div>
              </div>
            )
          } else {
            return (
              <div className="mt-4 p-3 bg-slate-50/80 backdrop-blur-sm rounded-lg border border-slate-200/40">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                  <Text className="text-slate-700 text-sm font-medium">
                    No flip room transitions this period — all idle time is turnover-driven (same room)
                  </Text>
                </div>
              </div>
            )
          }
        })()}
      </div>
    </div>
  )
}

// ============================================
// TIME METRIC CARD (Compact)
// ============================================

function TimeMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string
  subtitle: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div className="p-1.5 rounded-md bg-slate-100">
            <Icon className="w-3.5 h-3.5 text-slate-600" />
          </div>
        )}
        <Text className="text-slate-600 font-medium text-sm">{title}</Text>
      </div>
      <div className="text-2xl font-semibold text-slate-900 mb-1">{value}</div>
      <Text className="text-slate-400 text-xs">{subtitle}</Text>
    </div>
  )
}

// ============================================
// CHART CARD WRAPPER
// ============================================

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  )
}

// ============================================
// FLIP ROOM MODAL
// ============================================

function FlipRoomModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean
  onClose: () => void
  data: FlipRoomAnalysis[]
}) {
  const [filter, setFilter] = useState<'all' | 'flip' | 'same_room'>('all')
  
  if (!isOpen) return null
  
  const filteredData = filter === 'all' 
    ? data 
    : filter === 'flip'
    ? data.filter(d => d.idleGaps.some(g => g.gapType === 'flip'))
    : data.filter(d => d.idleGaps.some(g => g.gapType === 'same_room'))
  
  const totalFlipGaps = data.reduce((sum, d) => sum + d.idleGaps.filter(g => g.gapType === 'flip').length, 0)
  const totalSameGaps = data.reduce((sum, d) => sum + d.idleGaps.filter(g => g.gapType === 'same_room').length, 0)
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Surgeon Idle Time Analysis</h2>
                <p className="text-sm text-slate-500">All idle gaps between consecutive surgeon cases</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Filter tabs */}
          <div className="px-6 pt-4 pb-2 flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'all' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              All Gaps ({totalFlipGaps + totalSameGaps})
            </button>
            <button
              onClick={() => setFilter('flip')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'flip' 
                  ? 'bg-violet-100 text-violet-700' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Flip Room ({totalFlipGaps})
            </button>
            <button
              onClick={() => setFilter('same_room')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'same_room' 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Same Room ({totalSameGaps})
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
            {filteredData.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No idle gaps found</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  {filter === 'flip'
                    ? 'No flip room transitions detected in this period.'
                    : filter === 'same_room'
                    ? 'No same-room idle gaps detected in this period.'
                    : 'Surgeon idle gaps occur when a surgeon waits between consecutive cases.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredData.map((analysis, idx) => {
                  const visibleGaps = filter === 'all' 
                    ? analysis.idleGaps 
                    : analysis.idleGaps.filter(g => g.gapType === filter)
                  
                  if (visibleGaps.length === 0) return null
                  
                  return (
                    <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                            {analysis.surgeonName.replace('Dr. ', '').charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{analysis.surgeonName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-sm text-slate-500">{analysis.date}</p>
                              {analysis.isFlipRoom && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded">
                                  Multi-room
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Idle</p>
                          <p className="text-2xl font-semibold text-amber-700">{Math.round(analysis.totalIdleTime)} min</p>
                        </div>
                      </div>
                      
                      {/* Room sequence */}
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Case Sequence</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {analysis.cases.map((c, i) => (
                            <div key={c.caseId} className="flex items-center">
                              <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <span className="font-semibold text-slate-900">{c.roomName}</span>
                                <span className="text-slate-400 ml-2 text-sm">{c.scheduledStart}</span>
                              </div>
                              {i < analysis.cases.length - 1 && (
                                <ArrowRight className="w-4 h-4 mx-2 text-slate-300" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Gaps */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Idle Gaps</p>
                        <div className="space-y-2">
                          {visibleGaps.map((gap, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                              gap.gapType === 'flip' ? 'border-violet-200' : 'border-amber-200'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                  gap.gapType === 'flip' 
                                    ? 'bg-violet-100 text-violet-700' 
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {gap.gapType === 'flip' ? 'Flip' : 'Same'}
                                </span>
                                <span className="font-medium text-slate-700">{gap.fromCase}</span>
                                {gap.fromRoom && gap.toRoom && gap.fromRoom !== gap.toRoom && (
                                  <span className="text-xs text-slate-400">({gap.fromRoom})</span>
                                )}
                                <ArrowRight className="w-4 h-4 text-slate-300" />
                                <span className="font-medium text-slate-700">{gap.toCase}</span>
                                {gap.fromRoom && gap.toRoom && gap.fromRoom !== gap.toRoom && (
                                  <span className="text-xs text-slate-400">({gap.toRoom})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">Idle</p>
                                  <p className={`font-semibold ${gap.idleMinutes > 15 ? 'text-rose-600' : gap.idleMinutes > 10 ? 'text-amber-700' : 'text-slate-700'}`}>
                                    {Math.round(gap.idleMinutes)} min
                                  </p>
                                </div>
                                {gap.optimalCallDelta > 0 && (
                                  <div className="text-right pl-4 border-l border-slate-200">
                                    <p className="text-xs text-blue-600">
                                      {gap.gapType === 'flip' ? 'Call earlier' : 'Speed up'}
                                    </p>
                                    <p className="font-semibold text-blue-600">
                                      {Math.round(gap.optimalCallDelta)} min
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// OR UTILIZATION MODAL (Room Breakdown)
// ============================================

function ORUtilizationModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean
  onClose: () => void
  data: ORUtilizationResult
}) {
  if (!isOpen) return null
  
  const { roomBreakdown, roomsWithRealHours, roomsWithDefaultHours } = data
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">OR Utilization by Room</h2>
                <p className="text-sm text-slate-500">
                  {roomsWithRealHours > 0 && roomsWithDefaultHours > 0
                    ? `${roomsWithRealHours} rooms configured · ${roomsWithDefaultHours} using default (10h)`
                    : roomsWithDefaultHours === roomBreakdown.length
                    ? 'All rooms using default 10h availability — configure in Settings'
                    : `All ${roomsWithRealHours} rooms have configured hours`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {roomBreakdown.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No utilization data</h3>
                <p className="text-sm text-slate-500">No rooms with case data found in this period.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200/60 text-center">
                    <div className="text-2xl font-semibold text-green-600">
                      {roomBreakdown.filter(r => r.utilization >= 75).length}
                    </div>
                    <div className="text-xs text-green-600 font-medium">Above Target</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200/60 text-center">
                    <div className="text-2xl font-semibold text-amber-700">
                      {roomBreakdown.filter(r => r.utilization >= 60 && r.utilization < 75).length}
                    </div>
                    <div className="text-xs text-amber-700 font-medium">Near Target</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-center">
                    <div className="text-2xl font-semibold text-slate-600">
                      {roomBreakdown.filter(r => r.utilization < 60).length}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">Below 60%</div>
                  </div>
                </div>
                
                {/* Room rows */}
                {roomBreakdown.map((room) => {
                  const barColor = room.utilization >= 75 
                    ? 'bg-green-500' 
                    : room.utilization >= 60 
                    ? 'bg-amber-500' 
                    : 'bg-slate-400'
                  const textColor = room.utilization >= 75 
                    ? 'text-green-600' 
                    : room.utilization >= 60 
                    ? 'text-amber-700' 
                    : 'text-slate-600'
                  
                  return (
                    <div key={room.roomId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{room.roomName}</span>
                          {!room.usingRealHours && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              Default hours
                            </span>
                          )}
                        </div>
                        <span className={`text-xl font-semibold ${textColor}`}>
                          {room.utilization}%
                        </span>
                      </div>
                      
                      {/* Utilization bar */}
                      <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                        <div 
                          className={`${barColor} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(room.utilization, 100)}%` }}
                        />
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{room.caseCount} cases</span>
                        <span className="text-slate-300">·</span>
                        <span>{room.daysActive} days active</span>
                        <span className="text-slate-300">·</span>
                        <span>~{Math.round(room.usedMinutes / room.daysActive / 60 * 10) / 10}h avg/day of {room.availableHours}h</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsOverviewPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin, effectiveFacilityId } = useUser()
  const { showToast } = useToast()
  
  const [cases, setCases] = useState<CaseWithMilestonesAndSurgeon[]>([])
  const [previousPeriodCases, setPreviousPeriodCases] = useState<CaseWithMilestonesAndSurgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('month')
  
  const [showORUtilModal, setShowORUtilModal] = useState(false)
  const [roomHoursMap, setRoomHoursMap] = useState<RoomHoursMap>({})
  const [fcotsConfig, setFcotsConfig] = useState<FCOTSConfig>({ milestone: 'patient_in', graceMinutes: 2, targetPercent: 85 })

  // Fetch room available hours and analytics settings when facility changes
  useEffect(() => {
    if (!effectiveFacilityId) return
    
    // Room hours
    const fetchRoomHours = async () => {
      const { data } = await supabase
        .from('or_rooms')
        .select('id, available_hours')
        .eq('facility_id', effectiveFacilityId)
        .is('deleted_at', null)
      if (data) {
        const map: RoomHoursMap = {}
        data.forEach((r: any) => {
          if (r.available_hours) map[r.id] = r.available_hours
        })
        setRoomHoursMap(map)
      }
    }
    
    // Facility analytics settings (FCOTS config, targets)
    const fetchAnalyticsSettings = async () => {
      const { data } = await supabase
        .from('facility_analytics_settings')
        .select('fcots_milestone, fcots_grace_minutes, fcots_target_percent')
        .eq('facility_id', effectiveFacilityId)
        .single()
      if (data) {
        setFcotsConfig({
          milestone: (data.fcots_milestone as 'patient_in' | 'incision') || 'patient_in',
          graceMinutes: data.fcots_grace_minutes ?? 2,
          targetPercent: data.fcots_target_percent ?? 85,
        })
      }
    }
    
    fetchRoomHours()
    fetchAnalyticsSettings()
  }, [effectiveFacilityId])

  // Fetch data
  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)
    setError(null)

    try {
    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        facility_id,
        scheduled_date,
        start_time,
        surgeon_id,
        or_room_id,
        status_id,
        surgeon_left_at,
        cancelled_at,
        is_excluded_from_metrics,
        surgeon:users!cases_surgeon_id_fkey (
          id,
          first_name,
          last_name,
          closing_workflow,
          closing_handoff_minutes
        ),
        procedure_types (id, name),
        or_rooms (id, name),
        case_statuses (name),
        case_milestones (
          facility_milestone_id,
          recorded_at,
          facility_milestones (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query
    
    // Transform: Extract surgeon_profile from the joined surgeon data
    const transformedCases = ((casesData || []) as any[]).map(c => ({
      ...c,
      surgeon_profile: c.surgeon ? {
        id: c.surgeon.id,
        closing_workflow: c.surgeon.closing_workflow || 'surgeon_closes',
        closing_handoff_minutes: c.surgeon.closing_handoff_minutes || 0,
      } : null,
    }))
    setCases(transformedCases as unknown as CaseWithMilestonesAndSurgeon[])
    
    // Fetch previous period for comparison
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodLength = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodLength)
      
      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          facility_id,
          scheduled_date,
          start_time,
          surgeon_id,
          or_room_id,
          status_id,
          surgeon_left_at,
          cancelled_at,
          is_excluded_from_metrics,
          surgeon:users!cases_surgeon_id_fkey (
            id,
            first_name,
            last_name,
            closing_workflow,
            closing_handoff_minutes
          ),
          procedure_types (id, name),
          or_rooms (id, name),
          case_statuses (name),
          case_milestones (
            facility_milestone_id,
            recorded_at,
            facility_milestones (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', prevStart.toISOString().split('T')[0])
        .lte('scheduled_date', prevEnd.toISOString().split('T')[0])
      
      const transformedPrev = ((prevData || []) as any[]).map(c => ({
        ...c,
        surgeon_profile: c.surgeon ? {
          id: c.surgeon.id,
          closing_workflow: c.surgeon.closing_workflow || 'surgeon_closes',
          closing_handoff_minutes: c.surgeon.closing_handoff_minutes || 0,
        } : null,
      }))
      setPreviousPeriodCases(transformedPrev as unknown as CaseWithMilestonesAndSurgeon[])
    }
    } catch (err) {
      setError('Failed to load KPI data. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load analytics',
        message: err instanceof Error ? err.message : 'Please try again'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [effectiveFacilityId])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // Calculate all analytics
  const analytics = useMemo(() => {
    return calculateAnalyticsOverview(cases, previousPeriodCases, fcotsConfig, roomHoursMap)
  }, [cases, previousPeriodCases, fcotsConfig, roomHoursMap])

  // Chart data
  const phaseChartData = [
    { name: 'Pre-Op', minutes: Math.round(analytics.avgPreOpTime) },
    { name: 'Surgical', minutes: Math.round(analytics.avgSurgicalTime) },
    { name: 'Closing', minutes: Math.round(analytics.avgClosingTime) },
    { name: 'Emergence', minutes: Math.round(analytics.avgEmergenceTime) },
  ].filter(d => d.minutes > 0)

  const totalPhaseTime = phaseChartData.reduce((sum, d) => sum + d.minutes, 0)

  // Chart colors - professional blue palette
  const chartColors: Color[] = ['blue', 'cyan', 'indigo', 'violet']

  // Loading state
  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading analytics..." />
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (!effectiveFacilityId && isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view analytics and performance metrics.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Error Banner */}
          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Analytics Overview</h1>
              <p className="text-slate-500 mt-1">
                {analytics.completedCases} completed cases analyzed
                {analytics.totalCases > analytics.completedCases && (
                  <span className="text-slate-400"> · {analytics.totalCases} total</span>
                )}
              </p>
            </div>
            <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          </div>

          {loading ? (
            <PageLoader message="Calculating metrics..." />
          ) : (
            <div className="space-y-8">
              {/* ROW 1: KEY PERFORMANCE INDICATORS */}
              <section>
                <SectionHeader
                  title="Key Performance Indicators"
                  subtitle="Primary metrics for OR efficiency"
                  badge="Core KPIs"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard 
                    title="First Case On-Time" 
                    kpi={analytics.fcots}
                    icon={Clock}
                    accentColor="blue"
                    tooltip="Percentage of first cases per room per day that started on time within the configured grace period."
                  />
                  <KPICard 
                    title="OR Utilization" 
                    kpi={analytics.orUtilization}
                    icon={BarChart3}
                    accentColor="violet"
                    onClick={() => setShowORUtilModal(true)}
                    tooltip="Percentage of available OR hours used for patient care (Patient In to Patient Out). Click to view per-room breakdown."
                  />
                  <KPICard 
                    title="Case Volume" 
                    kpi={analytics.caseVolume}
                    icon={CalendarDays}
                    accentColor="amber"
                    showTracker={false}
                    tooltip="Total number of cases in the selected date range, compared to the equivalent previous period."
                  />
                  <KPICard 
                    title="Same-Day Cancellation" 
                    kpi={analytics.cancellationRate}
                    icon={AlertTriangle}
                    accentColor="rose"
                    tooltip="Percentage of cases cancelled on the same day they were scheduled. Lower is better."
                  />
                </div>
              </section>

              {/* ROW 2: TURNOVER METRICS (4 cards including Non-Operative) */}
              <section>
                <SectionHeader
                  title="Turnover Metrics"
                  subtitle="Room and surgeon transition efficiency"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard 
                    title="Median Same Room Turnover" 
                    kpi={analytics.turnoverTime}
                    icon={Clock}
                    accentColor="green"
                    tooltip="Time from Patient Out (Case A) to Patient In (Case B) in the same room. Measures room cleaning and prep efficiency."
                  />
                  <KPICard 
                    title="Median Same-Room Surgical Turnover" 
                    kpi={analytics.standardSurgicalTurnover}
                    icon={Clock}
                    accentColor="blue"
                    tooltip="Time from Surgeon Done (Case A) to Incision (Case B) for the same surgeon in the same room. Measures how long the surgeon waits between cuts."
                  />
                  <KPICard 
                    title="Median Flip-Room Surgical Turnover" 
                    kpi={analytics.flipRoomTime}
                    icon={ArrowRight}
                    accentColor="violet"
                    tooltip="Time from Surgeon Done (Case A) to Incision (Case B) when the surgeon moves to a different room. Measures flip room transition efficiency."
                  />
                  <KPICard 
                    title="Non-Operative Time" 
                    kpi={analytics.nonOperativeTime}
                    icon={Clock}
                    accentColor="amber"
                    showTracker={false}
                    invertDelta={true}
                    tooltip="Average time the patient is in the OR but not being operated on. Includes Pre-Op (Patient In → Incision) and Post-Op (Closing Complete → Patient Out)."
                  />
                </div>
              </section>

              {/* ROW 3: SURGEON CALLBACK OPTIMIZATION */}
              <section>
                <SectionHeader
                  title="Surgeon Callback Optimization"
                  subtitle="Per-surgeon idle time analysis and callback timing recommendations"
                />
                <div className="grid grid-cols-1 gap-4">
                  <SurgeonIdleTimeCard 
                    combined={analytics.surgeonIdleTime}
                    flipKpi={analytics.surgeonIdleFlip}
                    sameRoomKpi={analytics.surgeonIdleSameRoom}
                    summaries={analytics.surgeonIdleSummaries}
                  />
                </div>
              </section>

              {/* ROW 4: TIME BREAKDOWN */}
              <section>
                <SectionHeader
                  title="Time Breakdown"
                  subtitle="Average durations across all completed cases"
                />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <TimeMetricCard
                    title="Total Case Time"
                    value={formatMinutes(analytics.avgTotalCaseTime)}
                    subtitle="Patient In → Out"
                    icon={Clock}
                  />
                  <TimeMetricCard
                    title="Surgical Time"
                    value={formatMinutes(analytics.avgSurgicalTime)}
                    subtitle="Incision → Closing"
                    icon={Clock}
                  />
                  <TimeMetricCard
                    title="Pre-Op Time"
                    value={formatMinutes(analytics.avgPreOpTime)}
                    subtitle="Patient In → Incision"
                    icon={Clock}
                  />
                  <TimeMetricCard
                    title="Anesthesia Time"
                    value={formatMinutes(analytics.avgAnesthesiaTime)}
                    subtitle="Anes Start → End"
                    icon={Clock}
                  />
                  <TimeMetricCard
                    title="Closing Time"
                    value={formatMinutes(analytics.avgClosingTime)}
                    subtitle="Closing → Complete"
                    icon={Clock}
                  />
                  <TimeMetricCard
                    title="Emergence"
                    value={formatMinutes(analytics.avgEmergenceTime)}
                    subtitle="Close → Patient Out"
                    icon={Clock}
                  />
                </div>
              </section>

              {/* ROW 5: CHARTS */}
              <section>
                <SectionHeader
                  title="Visual Analytics"
                  subtitle="Time distribution and phase analysis"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <ChartCard
                    title="Average Time by Phase"
                    subtitle="Minutes spent in each surgical phase"
                  >
                    {phaseChartData.length > 0 ? (
                      <BarChart
                        className="h-72"
                        data={phaseChartData}
                        index="name"
                        categories={['minutes']}
                        colors={['blue']}
                        valueFormatter={(v) => `${v} min`}
                        yAxisWidth={48}
                        showAnimation={true}
                        showGridLines={true}
                        showLegend={false}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-72 text-slate-400">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <p>No data available</p>
                        </div>
                      </div>
                    )}
                  </ChartCard>

                  {/* Donut Chart */}
                  <ChartCard
                    title="Time Distribution"
                    subtitle="Proportion of case time by phase"
                  >
                    {phaseChartData.length > 0 ? (
                      <div className="flex flex-col items-center">
                        <DonutChart
                          className="h-60"
                          data={phaseChartData}
                          index="name"
                          category="minutes"
                          colors={chartColors}
                          valueFormatter={(v) => `${v} min`}
                          showAnimation={true}
                          showTooltip={true}
                          label={`${totalPhaseTime} min`}
                        />
                        <Legend
                          className="mt-4"
                          categories={phaseChartData.map(d => d.name)}
                          colors={chartColors}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-72 text-slate-400">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <p>No data available</p>
                        </div>
                      </div>
                    )}
                  </ChartCard>
                </div>
              </section>

              {/* OR UTILIZATION MODAL */}
              <ORUtilizationModal
                isOpen={showORUtilModal}
                onClose={() => setShowORUtilModal(false)}
                data={analytics.orUtilization}
              />
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}