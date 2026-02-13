// ============================================
// components/analytics/KPICard.tsx
// ============================================
// Custom KPI card components for the analytics dashboard
// ============================================

'use client'

import { Tracker, TrackerDataPoint } from './Tracker'

// ============================================
// TYPES
// ============================================

export interface KPIData {
  value: number
  displayValue: string
  subtitle: string
  target?: number
  targetMet?: boolean
  delta?: number
  deltaType?: 'increase' | 'decrease' | 'unchanged'
  dailyData?: TrackerDataPoint[]
}

interface KPICardProps {
  title: string
  kpi: KPIData
  highlighted?: boolean
  showTracker?: boolean
  onClick?: () => void
  invertDelta?: boolean // For metrics where decrease is good (like cancellation rate)
}

// ============================================
// DELTA BADGE
// ============================================

function DeltaBadge({ 
  delta, 
  deltaType, 
  invert = false 
}: { 
  delta: number
  deltaType: 'increase' | 'decrease' | 'unchanged'
  invert?: boolean 
}) {
  // Determine if this delta is "good" or "bad"
  const isPositive = invert 
    ? deltaType === 'decrease' 
    : deltaType === 'increase'
  
  const colorClasses = isPositive
    ? 'bg-green-50 text-green-600 ring-green-600/20'
    : deltaType === 'unchanged'
    ? 'bg-slate-50 text-slate-600 ring-slate-500/20'
    : 'bg-red-50 text-red-700 ring-red-600/20'

  const arrow = deltaType === 'increase' ? '↑' : deltaType === 'decrease' ? '↓' : '→'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md ring-1 ring-inset ${colorClasses}`}>
      {arrow} {delta}%
    </span>
  )
}

// ============================================
// TARGET INDICATOR
// ============================================

function TargetIndicator({ target, met, isMaxTarget = false }: { target: number; met: boolean; isMaxTarget?: boolean }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${met ? 'bg-green-500' : 'bg-amber-500'}`} />
      <span className="text-xs text-slate-500">
        Target: {isMaxTarget ? `<${target}%` : `${target}%`}
      </span>
      {met && (
        <span className="text-xs text-green-600 font-medium">✓ Met</span>
      )}
    </div>
  )
}

// ============================================
// MAIN KPI CARD
// ============================================

export function KPICard({ 
  title, 
  kpi, 
  highlighted = false, 
  showTracker = true,
  onClick,
  invertDelta = false
}: KPICardProps) {
  const isClickable = !!onClick
  
  return (
    <div 
      className={`
        rounded-xl border p-5 transition-all duration-200
        ${highlighted 
          ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm' 
          : 'bg-white border-slate-200'
        }
        ${isClickable 
          ? 'cursor-pointer hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5' 
          : ''
        }
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {kpi.delta !== undefined && kpi.deltaType && (
          <DeltaBadge delta={kpi.delta} deltaType={kpi.deltaType} invert={invertDelta} />
        )}
      </div>
      
      {/* Metric Value */}
      <p className={`text-3xl font-bold mt-2 ${highlighted ? 'text-blue-600' : 'text-slate-900'}`}>
        {kpi.displayValue}
      </p>
      
      {/* Target Indicator */}
      {kpi.target !== undefined && (
        <TargetIndicator 
          target={kpi.target} 
          met={kpi.targetMet || false} 
          isMaxTarget={title.includes('Cancellation')}
        />
      )}
      
      {/* Subtitle */}
      {kpi.subtitle && (
        <p className="text-sm text-slate-500 mt-2">{kpi.subtitle}</p>
      )}
      
      {/* Tracker */}
      {showTracker && kpi.dailyData && kpi.dailyData.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Daily performance</span>
            <span>Last {kpi.dailyData.length} days</span>
          </div>
          <Tracker data={kpi.dailyData} />
        </div>
      )}
      
      {/* Drill-down indicator */}
      {isClickable && (
        <div className="mt-4 flex items-center text-xs font-medium text-blue-600">
          View details
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ============================================
// SIMPLE METRIC CARD (for time breakdown)
// ============================================

interface SimpleMetricCardProps {
  title: string
  value: string
  subtitle: string
  highlighted?: boolean
}

export function SimpleMetricCard({ title, value, subtitle, highlighted = false }: SimpleMetricCardProps) {
  return (
    <div className={`
      rounded-xl border p-4 
      ${highlighted ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}
    `}>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className={`text-xl font-bold mt-1 ${highlighted ? 'text-blue-600' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

// ============================================
// SURGEON IDLE TIME CARD (Special highlight)
// ============================================

interface SurgeonIdleTimeCardProps {
  kpi: KPIData
  onClick?: () => void
}

export function SurgeonIdleTimeCard({ kpi, onClick }: SurgeonIdleTimeCardProps) {
  return (
    <div 
      className="rounded-xl border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white p-5 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 ring-4 ring-blue-100"
      onClick={onClick}
    >
      {/* Header with badge */}
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-slate-600">Surgeon Idle Time</p>
        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
          Insight
        </span>
      </div>
      
      {/* Metric */}
      <p className="text-3xl font-bold text-blue-600 mt-2">
        {kpi.displayValue}
      </p>
      
      <p className="text-sm text-slate-500 mt-1">
        Avg wait between rooms
      </p>
      
      {/* Insight Box */}
      {kpi.subtitle && kpi.subtitle !== 'No optimization needed' && kpi.value > 0 && (
        <div className="mt-4 p-3 bg-blue-100/50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800 font-medium">
            💡 {kpi.subtitle}
          </p>
        </div>
      )}
      
      {/* Success state */}
      {(kpi.targetMet || kpi.value <= 5) && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-600 font-medium">
            ✓ Excellent! Minimal surgeon wait time
          </p>
        </div>
      )}
      
      {/* Drill-down indicator */}
      <div className="mt-4 flex items-center text-xs font-medium text-blue-600">
        View flip room details
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}

export default KPICard