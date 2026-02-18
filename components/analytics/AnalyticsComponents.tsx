// components/analytics/AnalyticsComponents.tsx
// Shared enterprise-grade analytics components for ORbit
// Used by Surgeon Overview, Surgeon Performance, and other analytics pages

'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { InfoTooltip } from '@/components/ui/Tooltip'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock, Phone, X, Zap } from 'lucide-react'
import { chartHex } from '@/lib/design-tokens'
import type { CaseFlag } from '@/lib/flag-detection'
import type { PhaseTreeNode, PhaseDefLike } from '@/lib/milestone-phase-config'

// ============================================
// SECTION HEADER — Accented section dividers
// ============================================

interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  accentColor?: string // tailwind color like 'blue' | 'green' | 'amber' | 'red'
  action?: React.ReactNode
}

export function SectionHeader({ title, subtitle, icon, accentColor = 'blue', action }: SectionHeaderProps) {
  const borderColors: Record<string, string> = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500',
    slate: 'border-l-slate-400',
    violet: 'border-l-violet-500',
  }
  const iconBgColors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-500',
    violet: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className={`flex items-center justify-between border-l-[3px] ${borderColors[accentColor] || borderColors.blue} pl-4 py-1`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBgColors[accentColor] || iconBgColors.blue}`}>
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}


// InfoTooltip imported from @/components/ui/Tooltip


// ============================================
// ENHANCED METRIC CARD — With accent, sparkline, trend pill
// ============================================

interface EnhancedMetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    improved: boolean
    label?: string // e.g. "vs prev period"
  }
  icon?: React.ReactNode
  accentColor?: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet'
  format?: 'number' | 'time' | 'percentage'
  // Optional radial progress for percentage values
  progress?: number // 0-100
  // Optional info tooltip — shows (i) icon next to title with hover popover
  tooltip?: string
}

export function EnhancedMetricCard({ 
  title, value, subtitle, trend, icon, 
  accentColor = 'blue', progress, tooltip 
}: EnhancedMetricCardProps) {
  const accentStyles: Record<string, { bar: string; icon: string; value: string }> = {
    blue: { bar: 'bg-blue-500', icon: 'bg-blue-50 text-blue-600', value: 'text-blue-600' },
    green: { bar: 'bg-green-500', icon: 'bg-green-50 text-green-600', value: 'text-green-600' },
    amber: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
    red: { bar: 'bg-red-500', icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
    slate: { bar: 'bg-slate-400', icon: 'bg-slate-100 text-slate-500', value: 'text-slate-700' },
    violet: { bar: 'bg-violet-500', icon: 'bg-violet-50 text-violet-600', value: 'text-violet-600' },
  }

  const style = accentStyles[accentColor] || accentStyles.blue

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Top accent bar */}
      <div className={`h-1 ${style.bar}`} />
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-medium text-slate-500 leading-tight">{title}</p>
            {tooltip && <InfoTooltip text={tooltip} />}
          </div>
          {icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.icon}`}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3">
          {/* Value with optional radial progress */}
          {progress !== undefined ? (
            <div className="flex items-center gap-3">
              <RadialProgress value={progress} size={48} color={accentColor} />
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            </div>
          ) : (
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          )}

          {/* Trend pill */}
          {trend && (
            <TrendPill value={trend.value} improved={trend.improved} />
          )}
        </div>

        {/* Subtitle or trend label */}
        {(subtitle || trend?.label) && (
          <p className="text-xs text-slate-400 mt-2">{subtitle || trend?.label}</p>
        )}
      </div>
    </div>
  )
}


// ============================================
// TREND PILL — Colored background trend indicator
// ============================================

interface TrendPillProps {
  value: number
  improved: boolean
  size?: 'sm' | 'md'
}

export function TrendPill({ value, improved, size = 'sm' }: TrendPillProps) {
  const sizeClass = size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'
  
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${sizeClass} ${
      improved
        ? 'bg-green-50 text-green-600'
        : 'bg-red-50 text-red-600'
    }`}>
      {improved ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      )}
      {Math.abs(value)}%
    </span>
  )
}


// ============================================
// RADIAL PROGRESS — Circular progress indicator
// ============================================

interface RadialProgressProps {
  value: number // 0–100
  size?: number
  strokeWidth?: number
  color?: string
}

export function RadialProgress({ value, size = 48, strokeWidth = 4, color = 'blue' }: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  const strokeColors: Record<string, string> = chartHex.stroke

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={chartHex.track}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColors[color] || strokeColors.blue}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}


// ============================================
// PERIOD SELECTOR — Segmented toggle buttons
// ============================================

interface PeriodSelectorProps {
  options: { value: string; label: string }[]
  selected: string
  onChange: (value: string) => void
}

export function PeriodSelector({ options, selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            selected === option.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}


// ============================================
// SURGEON SELECTOR — Custom dropdown with initials avatar
// ============================================

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface SurgeonSelectorProps {
  surgeons: Surgeon[]
  selectedId: string | null
  onChange: (id: string) => void
  placeholder?: string
}

export function SurgeonSelector({ surgeons, selectedId, onChange, placeholder = 'Choose surgeon...' }: SurgeonSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = surgeons.find(s => s.id === selectedId)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors min-w-[200px]"
      >
        {selected ? (
          <>
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {selected.first_name.charAt(0)}{selected.last_name.charAt(0)}
              </span>
            </div>
            <span className="font-medium text-slate-700 truncate">
              Dr. {selected.last_name}, {selected.first_name}
            </span>
          </>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {surgeons.map((surgeon) => (
            <button
              key={surgeon.id}
              onClick={() => {
                onChange(surgeon.id)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                surgeon.id === selectedId ? 'bg-blue-50' : ''
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                surgeon.id === selectedId
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : 'bg-slate-200'
              }`}>
                <span className={`text-xs font-bold ${surgeon.id === selectedId ? 'text-white' : 'text-slate-500'}`}>
                  {surgeon.first_name.charAt(0)}{surgeon.last_name.charAt(0)}
                </span>
              </div>
              <span className={`font-medium truncate ${surgeon.id === selectedId ? 'text-blue-700' : 'text-slate-700'}`}>
                Dr. {surgeon.last_name}, {surgeon.first_name}
              </span>
              {surgeon.id === selectedId && (
                <Check className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


// ============================================
// CONSISTENCY DOT — Visual indicator for consistency labels
// ============================================

interface ConsistencyBadgeProps {
  label: string
  level: 'very_consistent' | 'consistent' | 'variable' | 'na'
}

export function ConsistencyBadge({ label, level }: ConsistencyBadgeProps) {
  const styles: Record<string, { dot: string; text: string; bg: string }> = {
    very_consistent: { dot: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50' },
    consistent: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
    variable: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
    na: { dot: 'bg-slate-300', text: 'text-slate-400', bg: 'bg-transparent' },
  }
  const style = styles[level] || styles.na

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.text} ${style.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  )
}


// ============================================
// INLINE BAR — Subtle bar behind time values in tables
// ============================================

interface InlineBarProps {
  value: number
  max: number
  color?: string
  label: string
}

export function InlineBar({ value, max, color = 'blue', label }: InlineBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  
  const barColors: Record<string, string> = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    amber: 'bg-amber-100',
    slate: 'bg-slate-100',
  }

  return (
    <div className="relative flex items-center">
      <div className={`absolute inset-y-0 left-0 ${barColors[color] || barColors.blue} rounded-sm`} style={{ width: `${pct}%` }} />
      <span className="relative text-sm text-slate-700 font-mono tabular-nums z-10 px-2 py-0.5">
        {label}
      </span>
    </div>
  )
}


// ============================================
// CALL TIMING TIMELINE — Visual flow diagram
// ============================================

interface CallTimingTimelineProps {
  callEarliness: number
  prepDuration: number
  waitForSurgeon: number | null
  casesAnalyzed: number
}

export function CallTimingTimeline({ callEarliness, prepDuration, waitForSurgeon, casesAnalyzed }: CallTimingTimelineProps) {
  // const totalSpan = callEarliness || 1
  // const prepPct = Math.min((prepDuration / totalSpan) * 100, 90)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Phone className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Patient Call Timing</h3>
          <p className="text-xs text-slate-400">Based on {casesAnalyzed} cases with call data</p>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Timeline bar */}
        <div className="flex items-center gap-0 mb-2">
          {/* Call segment */}
          <div className="flex-1 relative">
            <div className="h-2.5 bg-blue-500 rounded-l-full" />
          </div>
        </div>

        {/* Flow steps */}
        <div className="flex items-start justify-between mt-4">
          {/* Step 1: Call */}
          <div className="flex flex-col items-center text-center" style={{ width: '22%' }}>
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Phone className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-slate-900">Call Sent</span>
            <span className="text-xs text-slate-400 mt-0.5">{callEarliness} min before</span>
          </div>

          {/* Arrow */}
          <div className="flex items-center pt-4 text-slate-300">
            <div className="w-8 h-px bg-slate-200" />
            <ChevronRight className="w-3 h-3 -ml-px" />
          </div>

          {/* Step 2: Prep */}
          <div className="flex flex-col items-center text-center" style={{ width: '22%' }}>
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-slate-900">Team Prep</span>
            <span className="text-xs text-slate-400 mt-0.5">{prepDuration} min</span>
          </div>

          {/* Arrow */}
          <div className="flex items-center pt-4 text-slate-300">
            <div className="w-8 h-px bg-slate-200" />
            <ChevronRight className="w-3 h-3 -ml-px" />
          </div>

          {/* Step 3: Ready */}
          <div className="flex flex-col items-center text-center" style={{ width: '22%' }}>
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-slate-900">Room Ready</span>
            {waitForSurgeon !== null && (
              <span className="text-xs text-slate-400 mt-0.5">{waitForSurgeon} min wait</span>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center pt-4 text-slate-300">
            <div className="w-8 h-px bg-slate-200" />
            <ChevronRight className="w-3 h-3 -ml-px" />
          </div>

          {/* Step 4: Incision */}
          <div className="flex flex-col items-center text-center" style={{ width: '22%' }}>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-900">Incision</span>
          </div>
        </div>
      </div>
    </div>
  )
}


// ============================================
// DELAY DONUT — Small donut chart for delay distribution
// ============================================

interface DelayDonutProps {
  delays: { name: string; count: number; color: string }[]
  totalDelays: number
  totalMinutes: number
}

export function DelayDonut({ delays, totalDelays, totalMinutes }: DelayDonutProps) {
  const size = 120
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate offsets for each segment
  const segments = delays.map((delay, idx) => {
    const pct = totalDelays > 0 ? delay.count / totalDelays : 0
    const dashLength = pct * circumference
    const offset = delays.slice(0, idx).reduce((sum, d) => {
      const prevPct = totalDelays > 0 ? d.count / totalDelays : 0
      return sum + prevPct * circumference
    }, 0)
    return { delay, dashLength, offset }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={chartHex.track}
            strokeWidth={strokeWidth}
          />
          {segments.map(({ delay, dashLength, offset }, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={delay.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-900">{totalDelays}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wide">delays</span>
        </div>
      </div>
      {totalMinutes > 0 && (
        <p className="text-xs text-slate-500">{totalMinutes} min total</p>
      )}
    </div>
  )
}


// ============================================
// INSIGHT CARD — Upgraded with better visual hierarchy
// ============================================

interface InsightCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  type?: 'info' | 'success' | 'warning'
}

export function InsightCard({ icon, title, children, type = 'info' }: InsightCardProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 [&_.insight-icon]:text-blue-600',
    success: 'bg-green-50 border-green-200 [&_.insight-icon]:text-green-600',
    warning: 'bg-amber-50 border-amber-200 [&_.insight-icon]:text-amber-600',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <div className="insight-icon flex-shrink-0 mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold text-slate-900 text-sm mb-1">{title}</p>
          <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}


// ============================================
// SLIDE-OUT PANEL — With smoother animation
// ============================================

interface SlideOutPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function SlideOutPanel({ isOpen, onClose, title, subtitle, children }: SlideOutPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 max-w-xl w-full animate-in slide-in-from-right duration-300">
        <div className="h-full bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}


// ============================================
// SKELETON LOADERS — Layout-matching pulse animations
// ============================================

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-slate-200 rounded-md animate-pulse ${className || ''}`} style={style} />
}

export function SkeletonMetricCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="h-1 bg-slate-100" />
          <div className="p-4">
            <SkeletonPulse className="h-3 w-24 mb-4" />
            <SkeletonPulse className="h-8 w-16 mb-2" />
            <SkeletonPulse className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-3 flex gap-6">
        {[120, 50, 80, 80, 80, 60].map((w, i) => (
          <SkeletonPulse key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 border-t border-slate-100 flex gap-6">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-4 w-12" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-20" />
          <SkeletonPulse className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <SkeletonPulse className="h-4 w-32 mb-6" />
      <SkeletonPulse className="w-full rounded-lg" style={{ height }} />
    </div>
  )
}

export function SkeletonDayAnalysis() {
  return (
    <div className="space-y-6">
      {/* Summary strip skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <SkeletonPulse className="h-2.5 w-16 mb-2" />
                <SkeletonPulse className="h-6 w-14" />
              </div>
            ))}
          </div>
          <SkeletonPulse className="w-16 h-16 rounded-full" />
        </div>
      </div>
      {/* Timeline skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <SkeletonPulse className="h-4 w-24" />
          <SkeletonPulse className="h-3 w-48" />
        </div>
        <SkeletonPulse className="h-12 w-full rounded mb-2" />
        <SkeletonPulse className="h-12 w-full rounded" />
      </div>
      {/* Bottom split skeleton */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3">
              <SkeletonPulse className="h-3 w-40 mb-1.5" />
              <SkeletonPulse className="h-7 w-full rounded" />
            </div>
          ))}
        </div>
        <div className="lg:w-[280px] w-full space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <SkeletonPulse className="h-3 w-24 mb-3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-2">
                <SkeletonPulse className="h-3 w-20 mb-1" />
                <SkeletonPulse className="h-3 w-full rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <SkeletonPulse className="h-3 w-20 mb-3" />
            <SkeletonPulse className="h-20 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}


// ============================================
// STACKED CASE BAR — Enhanced phase bars for day analysis
// ============================================

/** Subphase rendered as 60%-height inset band within a parent phase segment. */
export interface CasePhaseBarSubphase {
  label: string
  value: number   // duration in seconds
  color: string   // lighter shade hex from resolveSubphaseHex()
}

export interface CasePhaseBarPhase {
  label: string
  value: number   // duration in seconds (use 0 for missing phases)
  color: string   // hex color for parent
  isMissing?: boolean  // true → show hatched pattern instead of solid color
  subphases?: CasePhaseBarSubphase[]
}

interface CasePhaseBarProps {
  caseNumber: string
  procedureName: string
  phases: CasePhaseBarPhase[]
  totalValue: number
  maxValue: number
  caseId: string
  onCaseClick?: (caseId: string) => void
  formatValue?: (val: number) => string
}

/** CSS background for the hatched/striped missing-data indicator. */
const HATCHED_BG = `repeating-linear-gradient(
  45deg,
  transparent,
  transparent 3px,
  rgba(0,0,0,0.08) 3px,
  rgba(0,0,0,0.08) 6px
)`

export function CasePhaseBar({ caseNumber, procedureName, phases, totalValue, maxValue, caseId, onCaseClick, formatValue }: CasePhaseBarProps) {
  const barWidthPct = maxValue > 0 ? (totalValue / maxValue) * 100 : 0

  // Default formatter: treat as seconds → mm:ss
  const fmt = formatValue || ((sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  })

  return (
    <div
      className="group py-2.5 px-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
      onClick={() => onCaseClick?.(caseId)}
    >
      {/* Case info row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-blue-600 font-semibold group-hover:underline">{caseNumber}</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-600 truncate max-w-[200px]">{procedureName}</span>
        </div>
        <span className="text-xs font-mono text-slate-900 font-semibold tabular-nums">{fmt(totalValue)}</span>
      </div>

      {/* Stacked bar */}
      <div className="relative" style={{ width: `${Math.max(barWidthPct, 8)}%` }}>
        <div className="h-7 rounded-md overflow-hidden flex">
          {phases.map((phase, idx) => {
            const phasePct = totalValue > 0 ? (phase.value / totalValue) * 100 : 0
            if (phasePct < 1 && !phase.isMissing) return null
            return (
              <div
                key={idx}
                className="h-full relative group/phase"
                style={{
                  width: phase.isMissing ? '4%' : `${phasePct}%`,
                  minWidth: phase.isMissing ? '6px' : undefined,
                  backgroundColor: phase.color,
                  backgroundImage: phase.isMissing ? HATCHED_BG : undefined,
                }}
                title={
                  phase.isMissing
                    ? `${phase.label}: missing milestone data`
                    : `${phase.label}: ${fmt(phase.value)}`
                }
              >
                {/* Show label if wide enough and not missing */}
                {!phase.isMissing && phasePct > 18 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90 truncate px-1">
                    {fmt(phase.value)}
                  </span>
                )}

                {/* Subphase inset bands — 60% height, centered vertically */}
                {phase.subphases && phase.subphases.length > 0 && phase.value > 0 && (
                  <div className="absolute inset-x-0 top-[20%] h-[60%] flex pointer-events-none">
                    {phase.subphases.map((sub, subIdx) => {
                      const subPct = phase.value > 0 ? (sub.value / phase.value) * 100 : 0
                      if (subPct < 1) return null
                      return (
                        <div
                          key={subIdx}
                          className="h-full rounded-sm pointer-events-auto"
                          style={{
                            width: `${subPct}%`,
                            backgroundColor: sub.color,
                          }}
                          title={`${sub.label}: ${fmt(sub.value)}`}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ============================================
// PHASE LEGEND — Color legend for stacked bars
// ============================================

export interface PhaseLegendItem {
  label: string
  color: string
  isSubphase?: boolean  // renders indented with smaller swatch
}

export function PhaseLegend({ items }: { items: PhaseLegendItem[] }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map((item, idx) => (
        <div key={idx} className={`flex items-center gap-1.5 ${item.isSubphase ? 'ml-2' : ''}`}>
          <div
            className={`rounded-sm flex-shrink-0 ${item.isSubphase ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
            style={{ backgroundColor: item.color }}
          />
          <span className={`text-xs ${item.isSubphase ? 'text-slate-400' : 'text-slate-500'}`}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}


// EmptyState — re-exported from canonical location
export { EmptyState } from '@/components/ui/EmptyState'


// =====================================================
// PROCEDURE COMPARISON CHART (Bullet/Overlay Pattern)
// =====================================================

export interface ProcedureComparisonData {
  procedureName: string
  procedureId: string
  caseCount: number
  todayORTime: number          // seconds
  avgORTime: number            // seconds (30-day avg)
  todaySurgicalTime: number    // seconds  
  avgSurgicalTime: number      // seconds (30-day avg)
}

interface ProcedureComparisonChartProps {
  data: ProcedureComparisonData[]
  formatValue?: (seconds: number) => string
}

function BulletBar({ 
  label, 
  todayValue, 
  avgValue, 
  maxValue, 
  color, 
  formatValue 
}: { 
  label: string
  todayValue: number
  avgValue: number
  maxValue: number
  color: 'blue' | 'violet'
  formatValue: (v: number) => string
}) {
  const todayPct = maxValue > 0 ? Math.min((todayValue / maxValue) * 100, 100) : 0
  const avgPct = maxValue > 0 ? Math.min((avgValue / maxValue) * 100, 100) : 0
  
  const delta = avgValue > 0 ? ((todayValue - avgValue) / avgValue) * 100 : 0
  const isFaster = delta < 0
  const deltaAbs = Math.abs(Math.round(delta))

  const colorMap = {
    blue: {
      today: 'bg-blue-600',
      avg: 'bg-blue-200',
    },
    violet: {
      today: 'bg-violet-600',
      avg: 'bg-violet-200',
    },
  }

  const c = colorMap[color]

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-900 tabular-nums">{formatValue(todayValue)}</span>
          {avgValue > 0 && deltaAbs > 0 && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              isFaster 
                ? 'text-green-600 bg-green-50' 
                : 'text-red-600 bg-red-50'
            }`}>
              {isFaster ? '↓' : '↑'} {deltaAbs}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-5 bg-slate-100 rounded-md overflow-hidden">
        {/* 30-day average bar (background, lighter) */}
        {avgValue > 0 && (
          <div 
            className={`absolute inset-y-0 left-0 ${c.avg} rounded-md transition-all duration-500`}
            style={{ width: `${avgPct}%` }}
          />
        )}
        {/* Today's actual bar (foreground, solid) */}
        <div 
          className={`absolute inset-y-0 left-0 ${c.today} rounded-md transition-all duration-500`}
          style={{ width: `${todayPct}%`, opacity: 0.9 }}
        />
        {/* Average marker line */}
        {avgValue > 0 && avgPct > 2 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900/40 z-10"
            style={{ left: `${avgPct}%` }}
            title={`30-day avg: ${formatValue(avgValue)}`}
          >
            <div className="absolute -top-1 -translate-x-[3px] w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-900/40" />
          </div>
        )}
      </div>
      {avgValue > 0 && (
        <div className="flex justify-end">
          <span className="text-xs text-slate-400">avg: {formatValue(avgValue)}</span>
        </div>
      )}
    </div>
  )
}

// ============================================
// SHARED TYPES — Day Analysis Components
// ============================================

/** Data shape for a single case in the DayTimeline and CasePhaseBarNested components. */
export interface TimelineCaseData {
  id: string
  caseNumber: string
  procedure: string
  room: string
  startTime: Date
  endTime: Date
  phases: TimelineCasePhase[]
}

export interface TimelineCasePhase {
  phaseId: string
  label: string
  color: string
  durationSeconds: number
  subphases: TimelineCaseSubphase[]
}

export interface TimelineCaseSubphase {
  label: string
  color: string
  durationSeconds: number
  offsetSeconds: number
}


// ============================================
// FLAG BADGE — Reusable flag badge (compact or full)
// ============================================

interface FlagBadgeProps {
  flag: CaseFlag
  compact?: boolean
}

export function FlagBadge({ flag, compact = false }: FlagBadgeProps) {
  const severityStyles: Record<string, string> = {
    warning: 'bg-orange-50 text-orange-700 border-orange-200',
    caution: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    positive: 'bg-green-50 text-green-700 border-green-200',
  }
  const style = severityStyles[flag.severity] || severityStyles.info

  if (compact) {
    return (
      <span className={`inline-flex items-center text-xs rounded border px-1 py-0.5 ${style}`} title={`${flag.label}: ${flag.detail}`}>
        {flag.icon}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded border px-1.5 py-0.5 ${style}`}>
      {flag.icon} {flag.label}
    </span>
  )
}


// ============================================
// FLAG COUNT PILLS — Inline summary pills
// ============================================

interface FlagCountPillsProps {
  warningCount: number
  positiveCount: number
}

export function FlagCountPills({ warningCount, positiveCount }: FlagCountPillsProps) {
  if (warningCount === 0 && positiveCount === 0) return null
  return (
    <div className="flex items-center gap-2">
      {warningCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-orange-50 text-orange-700">
          ● {warningCount} flag{warningCount !== 1 ? 's' : ''}
        </span>
      )}
      {positiveCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-green-50 text-green-700">
          ⚡ {positiveCount} fast
        </span>
      )}
    </div>
  )
}


// ============================================
// METRIC PILL STRIP — Horizontal flex row of metric pills
// ============================================

export interface MetricPillItem {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

interface MetricPillStripProps {
  items: MetricPillItem[]
}

export function MetricPillStrip({ items }: MetricPillStripProps) {
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center">
          {idx > 0 && <div className="w-px h-10 bg-slate-100 mx-4 hidden md:block" />}
          <div className="py-1 px-1">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${item.accent ? 'text-blue-600' : 'text-slate-900'}`}>
              {item.value}
            </p>
            {item.sub && <p className="text-xs text-slate-400">{item.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}


// ============================================
// UPTIME RING — SVG donut chart (64×64)
// ============================================

interface UptimeRingProps {
  percent: number
}

export function UptimeRing({ percent }: UptimeRingProps) {
  const size = 64
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 100)
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-800 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-slate-900">{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-slate-500">Surgical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-200" />
          <span className="text-[10px] text-slate-500">Other</span>
        </div>
      </div>
    </div>
  )
}


// ============================================
// PHASE TREE LEGEND — Legend showing parent + sub-phases
// ============================================

interface PhaseTreeLegendProps {
  phaseTree: PhaseTreeNode[]
  resolveHex: (colorKey: string | null) => string
  resolveSubHex: (colorKey: string | null) => string
}

export function PhaseTreeLegend({ phaseTree, resolveHex, resolveSubHex }: PhaseTreeLegendProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {phaseTree.map(node => {
        const phase = node.phase as PhaseDefLike & { color_key?: string | null }
        const colorKey = phase.color_key ?? null
        return (
          <div key={phase.id} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: resolveHex(colorKey) }} />
              <span className="text-xs text-slate-600">{phase.display_name}</span>
            </div>
            {node.children.map(child => {
              const childPhase = child.phase as PhaseDefLike & { color_key?: string | null }
              const childColorKey = childPhase.color_key ?? null
              return (
                <div key={childPhase.id} className="flex items-center gap-1 ml-0.5">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: resolveSubHex(childColorKey) }} />
                  <span className="text-[10px] text-slate-400">{childPhase.display_name}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}


// ============================================
// DAY TIMELINE — Gantt-style OR timeline
// ============================================

interface DayTimelineProps {
  cases: TimelineCaseData[]
  caseFlags: Record<string, CaseFlag[]>
  onHoverCase?: (id: string | null) => void
}

export function DayTimeline({ cases, caseFlags, onHoverCase }: DayTimelineProps) {
  const [hoveredCaseId, setHoveredCaseId] = useState<string | null>(null)

  // Group cases by room
  const roomGroups = useMemo(() => {
    const groups = new Map<string, TimelineCaseData[]>()
    for (const c of cases) {
      const existing = groups.get(c.room) || []
      existing.push(c)
      groups.set(c.room, existing)
    }
    // Sort cases within each room by start time
    for (const [, roomCases] of groups) {
      roomCases.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    }
    return groups
  }, [cases])

  // Compute time axis bounds
  const { minTime, totalMs, hourMarkers, halfHourMarkers } = useMemo(() => {
    if (cases.length === 0) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0)
      return { minTime: start, maxTime: end, totalMs: end.getTime() - start.getTime(), hourMarkers: [] as Date[], halfHourMarkers: [] as Date[] }
    }

    const allStarts = cases.map(c => c.startTime.getTime())
    const allEnds = cases.map(c => c.endTime.getTime())
    const earliestMs = Math.min(...allStarts)
    const latestMs = Math.max(...allEnds)

    // Round down to hour for min, round up for max
    const min = new Date(earliestMs)
    min.setMinutes(0, 0, 0)
    const max = new Date(latestMs)
    max.setMinutes(0, 0, 0)
    max.setHours(max.getHours() + 1)

    const total = max.getTime() - min.getTime()

    // Hour markers
    const markers: Date[] = []
    const cursor = new Date(min)
    while (cursor.getTime() <= max.getTime()) {
      markers.push(new Date(cursor))
      cursor.setHours(cursor.getHours() + 1)
    }

    // Half-hour markers (between hour marks)
    const halfMarkers: Date[] = []
    for (let t = min.getTime() + 30 * 60 * 1000; t < max.getTime(); t += 60 * 60 * 1000) {
      halfMarkers.push(new Date(t))
    }

    return { minTime: min, maxTime: max, totalMs: total, hourMarkers: markers, halfHourMarkers: halfMarkers }
  }, [cases])

  const getPositionPct = (time: Date) => {
    if (totalMs === 0) return 0
    return ((time.getTime() - minTime.getTime()) / totalMs) * 100
  }

  const getDurationPct = (durationMs: number) => {
    if (totalMs === 0) return 0
    return (durationMs / totalMs) * 100
  }

  // Compute all turnovers for the footer legend
  const turnovers = useMemo(() => {
    const result: { gapMs: number }[] = []
    for (const [, roomCases] of roomGroups) {
      for (let i = 1; i < roomCases.length; i++) {
        const gapMs = roomCases[i].startTime.getTime() - roomCases[i - 1].endTime.getTime()
        if (gapMs > 0) result.push({ gapMs })
      }
    }
    return result
  }, [roomGroups])

  if (cases.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No cases to display on timeline
      </div>
    )
  }

  const roomEntries = Array.from(roomGroups.entries())

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 600 }}>
        {/* Time axis */}
        <div className="relative h-6 mb-2" style={{ marginLeft: 80 }}>
          {hourMarkers.map((marker, idx) => (
            <div
              key={idx}
              className="absolute text-[10px] text-slate-400 font-medium -translate-x-1/2"
              style={{ left: `${getPositionPct(marker)}%` }}
            >
              {marker.getHours().toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Room rows */}
        {roomEntries.map(([room, roomCases]) => (
          <div key={room} className="flex items-stretch mb-2">
            {/* Room label — badge pill */}
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 72, marginRight: 8 }}>
              <div className="flex items-center justify-center text-xs font-semibold text-slate-500 bg-slate-100 rounded-md" style={{ width: 64, height: 32 }}>{room}</div>
            </div>

            {/* Timeline track */}
            <div className="flex-1 relative h-10 rounded-lg" style={{ background: '#f8fafc' }}>
              {/* Hour grid lines */}
              {hourMarkers.map((marker, idx) => (
                <div
                  key={`h-${idx}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${getPositionPct(marker)}%`, width: 1, background: '#e2e8f0' }}
                />
              ))}
              {/* Half-hour grid lines (lighter) */}
              {halfHourMarkers.map((marker, idx) => (
                <div
                  key={`hh-${idx}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${getPositionPct(marker)}%`, width: 1, background: '#f1f5f9' }}
                />
              ))}

              {/* Turnover gaps between consecutive cases */}
              {roomCases.map((c, idx) => {
                if (idx === 0) return null
                const prevCase = roomCases[idx - 1]
                const gapMs = c.startTime.getTime() - prevCase.endTime.getTime()
                if (gapMs <= 0) return null
                const gapMinutes = Math.round(gapMs / 60000)
                const leftPct = getPositionPct(prevCase.endTime)
                const widthPct = getDurationPct(gapMs)
                return (
                  <div
                    key={`gap-${idx}`}
                    className="absolute top-1 bottom-1 rounded flex items-center justify-center"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(251,146,60,0.08) 3px, rgba(251,146,60,0.08) 6px)',
                      border: '1px dashed rgba(251,146,60,0.3)',
                      minWidth: 20,
                    }}
                  >
                    {widthPct > 3 && (
                      <span className="text-[10px] font-semibold text-amber-600/70 whitespace-nowrap">{gapMinutes}m</span>
                    )}
                  </div>
                )
              })}

              {/* Case blocks */}
              {roomCases.map(c => {
                const leftPct = getPositionPct(c.startTime)
                const widthPct = getDurationPct(c.endTime.getTime() - c.startTime.getTime())
                const flags = caseFlags[c.id] || []
                const hasWarningFlags = flags.some(f => f.severity === 'warning' || f.severity === 'caution')
                const hasPositiveFlags = flags.some(f => f.severity === 'positive')
                const totalPhaseSeconds = c.phases.reduce((sum, p) => sum + p.durationSeconds, 0)

                return (
                  <div
                    key={c.id}
                    className="absolute overflow-visible cursor-pointer"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 0.5)}%`,
                      top: 2,
                      bottom: 2,
                      minWidth: 30,
                      zIndex: hoveredCaseId === c.id ? 10 : 1,
                    }}
                    onMouseEnter={() => { setHoveredCaseId(c.id); onHoverCase?.(c.id) }}
                    onMouseLeave={() => { setHoveredCaseId(null); onHoverCase?.(null) }}
                  >
                    {/* Phase segments */}
                    <div
                      className="absolute inset-0 rounded-md overflow-hidden flex"
                      style={{
                        boxShadow: hoveredCaseId === c.id
                          ? '0 2px 8px rgba(0,0,0,0.15)'
                          : '0 1px 2px rgba(0,0,0,0.06)',
                        transform: hoveredCaseId === c.id ? 'translateY(-1px)' : 'none',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      {c.phases.map((phase, pIdx) => {
                        const phasePct = totalPhaseSeconds > 0 ? (phase.durationSeconds / totalPhaseSeconds) * 100 : 0
                        if (phasePct < 0.5) return null
                        return (
                          <div
                            key={pIdx}
                            className="h-full relative"
                            style={{
                              width: `${phasePct}%`,
                              backgroundColor: phase.color,
                              opacity: hoveredCaseId === c.id ? 1 : 0.85,
                            }}
                          >
                            {/* Sub-phase overlays — full height, own color */}
                            {phase.subphases.length > 0 && phase.durationSeconds > 0 && (
                              <div className="absolute inset-0">
                                {phase.subphases.map((sub, sIdx) => {
                                  const subLeftPct = phase.durationSeconds > 0
                                    ? (sub.offsetSeconds / phase.durationSeconds) * 100
                                    : 0
                                  const subWidthPct = phase.durationSeconds > 0
                                    ? (sub.durationSeconds / phase.durationSeconds) * 100
                                    : 0
                                  if (subWidthPct < 1) return null
                                  return (
                                    <div
                                      key={sIdx}
                                      className="absolute"
                                      style={{
                                        top: 2,
                                        bottom: 2,
                                        left: `${subLeftPct}%`,
                                        width: `${subWidthPct}%`,
                                        backgroundColor: sub.color,
                                        opacity: 0.6,
                                        borderRadius: 2,
                                        minWidth: 3,
                                      }}
                                      title={`${sub.label}: ${Math.round(sub.durationSeconds / 60)}m`}
                                    />
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Procedure label overlay — z-10 to sit above sub-phase overlays */}
                    <div className="absolute inset-0 z-10 flex items-center px-1.5" style={{ pointerEvents: 'none' }}>
                      <span className="text-[10px] font-bold text-white truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {c.procedure}
                      </span>
                    </div>

                    {/* Flag indicator dots */}
                    {(hasWarningFlags || hasPositiveFlags) && (
                      <div className="absolute -top-1.5 -right-1 flex gap-0.5" style={{ pointerEvents: 'none' }}>
                        {hasWarningFlags && <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: '#f97316', boxShadow: '0 1px 3px rgba(249,115,22,0.4)' }} />}
                        {hasPositiveFlags && <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: '#22c55e', boxShadow: '0 1px 3px rgba(34,197,94,0.4)' }} />}
                      </div>
                    )}

                    {/* Hover tooltip */}
                    {hoveredCaseId === c.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 pointer-events-none">
                        <div className="bg-slate-900 text-white text-[10px] leading-tight rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          <p className="font-semibold">{c.caseNumber} · {c.procedure}</p>
                          <p className="text-slate-300 mt-0.5">
                            {Math.round(totalPhaseSeconds / 60)}m total
                            {flags.length > 0 && ` · ${flags.map(f => f.icon).join(' ')}`}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Footer legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500" style={{ marginLeft: 80 }}>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(251,146,60,0.15) 2px, rgba(251,146,60,0.15) 4px)',
                border: '1px dashed rgba(251,146,60,0.4)',
              }}
            /> Turnover
          </span>
          <span className="text-slate-400">
            Avg: {turnovers.length > 0 ? Math.round(turnovers.reduce((sum, t) => sum + t.gapMs, 0) / turnovers.length / 60000) : 0}m
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#ef4444', opacity: 0.6 }} /> Sub-phase
          </span>
        </div>
      </div>
    </div>
  )
}


// ============================================
// CASE PHASE BAR NESTED — Single case row with nested sub-phases
// ============================================

interface CasePhaseBarNestedProps {
  caseNumber: string
  procedureName: string
  phases: TimelineCasePhase[]
  totalSeconds: number
  maxTotalSeconds: number
  isSelected: boolean
  onSelect: () => void
  flags: CaseFlag[]
}

export function CasePhaseBarNested({
  caseNumber,
  procedureName,
  phases,
  totalSeconds,
  maxTotalSeconds,
  isSelected,
  onSelect,
  flags,
}: CasePhaseBarNestedProps) {
  const barWidthPct = maxTotalSeconds > 0 ? (totalSeconds / maxTotalSeconds) * 100 : 0

  const fmtSec = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={`group py-2.5 px-3 -mx-3 rounded-lg transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-50 ring-2 ring-blue-400'
          : 'hover:bg-slate-50'
      }`}
      onClick={onSelect}
    >
      {/* Case info row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-blue-600 font-semibold">{caseNumber}</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-600 truncate max-w-[200px]">{procedureName}</span>
          {flags.length > 0 && (
            <div className="flex items-center gap-1">
              {flags.map((f, i) => (
                <FlagBadge key={i} flag={f} compact />
              ))}
            </div>
          )}
        </div>
        <span className="text-xs font-mono text-slate-900 font-semibold tabular-nums">{fmtSec(totalSeconds)}</span>
      </div>

      {/* Stacked bar */}
      <div className="relative transition-all duration-300" style={{ width: `${Math.max(barWidthPct, 8)}%` }}>
        <div className="h-7 rounded-md overflow-hidden flex">
          {phases.map((phase, idx) => {
            const phasePct = totalSeconds > 0 ? (phase.durationSeconds / totalSeconds) * 100 : 0
            if (phasePct < 1) return null
            const phaseMinutes = Math.round(phase.durationSeconds / 60)
            return (
              <div
                key={idx}
                className="h-full relative"
                style={{ width: `${phasePct}%`, backgroundColor: phase.color }}
                title={`${phase.label}: ${fmtSec(phase.durationSeconds)}`}
              >
                {/* Sub-phase overlays — full height, own color */}
                {phase.subphases.length > 0 && phase.durationSeconds > 0 && (
                  <div className="absolute inset-0">
                    {phase.subphases.map((sub, sIdx) => {
                      const subLeftPct = phase.durationSeconds > 0
                        ? (sub.offsetSeconds / phase.durationSeconds) * 100
                        : 0
                      const subWidthPct = phase.durationSeconds > 0
                        ? (sub.durationSeconds / phase.durationSeconds) * 100
                        : 0
                      if (subWidthPct < 1) return null
                      return (
                        <div
                          key={sIdx}
                          className="absolute"
                          style={{
                            top: 2,
                            bottom: 2,
                            left: `${subLeftPct}%`,
                            width: `${subWidthPct}%`,
                            backgroundColor: sub.color,
                            opacity: 0.6,
                            borderRadius: 2,
                            minWidth: 3,
                          }}
                          title={`${sub.label}: ${fmtSec(sub.durationSeconds)}`}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Phase duration label (≥8 minutes) — z-10 to sit above sub-phase overlays */}
                {phaseMinutes >= 8 && phasePct > 12 && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center text-xs font-bold text-white truncate px-1" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {fmtSec(phase.durationSeconds)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ============================================
// PHASE MEDIAN COMPARISON — Today vs historical bars
// ============================================

interface PhaseMedianComparisonProps {
  dayMedians: Record<string, number>
  historicalMedians: Record<string, number>
  phaseTree: PhaseTreeNode[]
  resolveHex: (colorKey: string | null) => string
}

export function PhaseMedianComparison({
  dayMedians,
  historicalMedians,
  phaseTree,
  resolveHex,
}: PhaseMedianComparisonProps) {
  // Find max value for scaling bars
  const allValues = [
    ...Object.values(dayMedians),
    ...Object.values(historicalMedians),
  ]
  const maxVal = Math.max(...allValues, 1)

  const fmtMin = (seconds: number) => `${Math.round(seconds / 60)}m`

  return (
    <div>
      {phaseTree.map(node => {
        const phase = node.phase as PhaseDefLike & { color_key?: string | null }
        const hasChildren = node.children.length > 0
        const hex = resolveHex(phase.color_key ?? null)
        const today = dayMedians[phase.id] ?? 0
        const historical = historicalMedians[phase.id] ?? 0
        const todayPct = maxVal > 0 ? (today / maxVal) * 100 : 0
        const histPct = maxVal > 0 ? (historical / maxVal) * 100 : 0

        let delta: number | null = null
        if (historical > 0 && today > 0) {
          delta = Math.round(((today - historical) / historical) * 100)
        }

        return (
          <div key={phase.id} className={`mb-2 ${hasChildren ? 'bg-slate-50/80 rounded-lg p-2' : ''}`}>
            {/* Parent label row */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-sm flex-shrink-0"
                  style={{ width: 8, height: 8, background: hex }}
                />
                <span className="font-medium text-slate-700" style={{ fontSize: 12 }}>
                  {phase.display_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-900 tabular-nums">{today > 0 ? fmtMin(today) : '—'}</span>
                {delta !== null && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    delta <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                  }`}>
                    {delta <= 0 ? '↓' : '↑'} {Math.abs(delta)}%
                  </span>
                )}
              </div>
            </div>

            {/* Parent bar with sub-phase insets */}
            <div className="relative rounded overflow-hidden bg-slate-100" style={{ height: 14 }}>
              {/* Historical (top half, faded) */}
              <div
                className="absolute top-0 rounded-t"
                style={{ width: `${histPct}%`, height: '50%', background: hex, opacity: 0.2 }}
              />
              {/* Today (bottom half, solid) */}
              <div
                className="absolute bottom-0 rounded-b"
                style={{ width: `${todayPct}%`, height: '50%', background: hex, opacity: 0.85, transition: 'width 0.4s ease' }}
              />

              {/* Sub-phase overlays — full height, own color */}
              {node.children.map(child => {
                const childPhase = child.phase as PhaseDefLike & { color_key?: string | null }
                const childToday = dayMedians[childPhase.id] ?? 0
                const childHex = resolveHex(childPhase.color_key ?? null)
                // Sub-phase width as proportion of parent's today bar
                const subBarPct = today > 0 ? (childToday / maxVal) * 100 : 0
                if (subBarPct < 0.5) return null
                return (
                  <div
                    key={childPhase.id}
                    className="absolute"
                    style={{
                      top: 2,
                      bottom: 2,
                      width: `${subBarPct}%`,
                      background: childHex,
                      opacity: 0.6,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }}
                    title={`${childPhase.display_name}: ${childToday > 0 ? fmtMin(childToday) : '—'}`}
                  />
                )
              })}

              {/* Historical median tick */}
              {histPct > 2 && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: `${histPct}%`, width: 1.5, background: '#64748b', opacity: 0.35 }}
                />
              )}
            </div>

            {/* Historical reference text */}
            {historical > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">hist: {fmtMin(historical)}</div>
            )}

            {/* Sub-phase info rows (text details, no separate bars) */}
            {node.children.map(child => {
              const childPhase = child.phase as PhaseDefLike & { color_key?: string | null }
              const childHex = resolveHex(childPhase.color_key ?? null)
              const childToday = dayMedians[childPhase.id] ?? 0
              const childHist = historicalMedians[childPhase.id] ?? 0
              let childDelta: number | null = null
              if (childHist > 0 && childToday > 0) {
                childDelta = Math.round(((childToday - childHist) / childHist) * 100)
              }
              return (
                <div key={childPhase.id} className="flex items-center justify-between mt-1.5 ml-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="rounded-sm flex-shrink-0"
                      style={{ width: 7, height: 7, background: childHex }}
                    />
                    <span className="font-medium text-slate-500" style={{ fontSize: 11 }}>
                      {childPhase.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-700 tabular-nums">{childToday > 0 ? fmtMin(childToday) : '—'}</span>
                    {childDelta !== null && (
                      <span className={`text-[10px] font-semibold px-1 py-0.5 rounded-full ${
                        childDelta <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                      }`}>
                        {childDelta <= 0 ? '↓' : '↑'} {Math.abs(childDelta)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-blue-500 rounded-sm" />
          <span className="text-[10px] text-slate-500 font-medium">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-blue-500/25 rounded-sm" />
          <span className="text-[10px] text-slate-500 font-medium">30-Day Med</span>
        </div>
      </div>
    </div>
  )
}


// ============================================
// CASE DETAIL PANEL — Expanded detail for a selected case
// ============================================

interface CaseDetailPanelProps {
  caseData: TimelineCaseData
  flags: CaseFlag[]
  procedureMedians: Record<string, number>
}

export function CaseDetailPanel({
  caseData,
  flags,
  procedureMedians,
}: CaseDetailPanelProps) {
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const totalSeconds = caseData.phases.reduce((sum, p) => sum + p.durationSeconds, 0)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-blue-600">{caseData.caseNumber}</span>
          <span className="text-xs text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{caseData.room}</span>
        </div>
        <p className="text-xs text-slate-600">{caseData.procedure}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {fmtTime(caseData.startTime)} – {fmtTime(caseData.endTime)}
        </p>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flags.map((f, i) => (
            <FlagBadge key={i} flag={f} />
          ))}
        </div>
      )}

      {/* Phase rows */}
      <div className="space-y-1.5">
        {caseData.phases.map(phase => {
          const median = procedureMedians[phase.phaseId]
          const delta = median && median > 0
            ? Math.round(((phase.durationSeconds - median) / median) * 100)
            : null

          const hasSubphases = phase.subphases.length > 0

          return (
            <div key={phase.phaseId} className={hasSubphases ? 'bg-slate-50/80 rounded-lg p-2' : ''}>
              {/* Parent phase row */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: phase.color }} />
                  <span className="text-xs font-medium text-slate-700">{phase.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-900 tabular-nums">{fmtDuration(phase.durationSeconds)}</span>
                  {delta !== null && (
                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
                      delta <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}>
                      {delta <= 0 ? '↓' : '↑'}{Math.abs(delta)}%
                    </span>
                  )}
                </div>
              </div>
              {median != null && median > 0 && (
                <div className="ml-[14px] text-[10px] text-slate-400 -mt-0.5 mb-0.5">med: {fmtDuration(median)}</div>
              )}

              {/* Sub-phase rows */}
              {phase.subphases.map((sub, sIdx) => {
                const subMedian = procedureMedians[`${phase.phaseId}:sub:${sIdx}`]
                const subDelta = subMedian && subMedian > 0
                  ? Math.round(((sub.durationSeconds - subMedian) / subMedian) * 100)
                  : null

                return (
                  <div
                    key={sIdx}
                    className="py-0.5 ml-4"
                    style={{ borderLeft: `2px solid ${sub.color}` }}
                  >
                    <div className="flex items-center justify-between pl-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">{sub.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-700 tabular-nums">{fmtDuration(sub.durationSeconds)}</span>
                        {subDelta !== null && (
                          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                            subDelta <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                          }`}>
                            {subDelta <= 0 ? '↓' : '↑'}{Math.abs(subDelta)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {subMedian != null && subMedian > 0 && (
                      <div className="ml-[17px] text-[10px] text-slate-400 -mt-0.5">med: {fmtDuration(subMedian)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-700">Total</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">{fmtDuration(totalSeconds)}</span>
          {procedureMedians['total'] != null && procedureMedians['total'] > 0 && (() => {
            const totalMedian = procedureMedians['total']
            const totalDelta = Math.round(((totalSeconds - totalMedian) / totalMedian) * 100)
            return (
              <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
                totalDelta <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
              }`}>
                {totalDelta <= 0 ? '↓' : '↑'}{Math.abs(totalDelta)}%
              </span>
            )
          })()}
        </div>
      </div>
      {procedureMedians['total'] != null && procedureMedians['total'] > 0 && (
        <div className="text-[10px] text-slate-400 text-right -mt-2">med: {fmtDuration(procedureMedians['total'])}</div>
      )}
    </div>
  )
}


// ============================================
// SIDEBAR FLAG LIST — Day flags list (no case selected)
// ============================================

interface SidebarFlagListProps {
  flags: { caseNumber: string; flag: CaseFlag }[]
}

export function SidebarFlagList({ flags }: SidebarFlagListProps) {
  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mb-2">
          <Check className="w-4 h-4 text-green-600" />
        </div>
        <p className="text-sm font-medium text-slate-600">No flags</p>
        <p className="text-xs text-slate-400 mt-0.5">All cases running normally</p>
      </div>
    )
  }

  const severityBgStyles: Record<string, string> = {
    warning: 'bg-orange-50',
    caution: 'bg-amber-50',
    info: 'bg-blue-50',
    positive: 'bg-green-50',
  }

  return (
    <div className="space-y-1.5">
      {flags.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${severityBgStyles[item.flag.severity] || 'bg-slate-50'}`}
        >
          <span className="text-sm flex-shrink-0 mt-0.5">{item.flag.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-700">{item.flag.label}</span>
              <span className="text-xs text-slate-400">Case {item.caseNumber}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{item.flag.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}


export function ProcedureComparisonChart({ data, formatValue: formatValueProp }: ProcedureComparisonChartProps) {
  const fmt = formatValueProp || ((sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  })

  const maxValue = Math.max(
    ...data.flatMap(d => [d.todayORTime, d.avgORTime, d.todaySurgicalTime, d.avgSurgicalTime]),
    1
  )

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No procedures performed today
      </div>
    )
  }

  return (
    <div className="space-y-0 divide-y divide-slate-100">
      {data.map((proc, idx) => (
        <div key={proc.procedureId} className={`${idx > 0 ? 'pt-4' : ''} pb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span className="text-sm font-semibold text-slate-900">{proc.procedureName}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {proc.caseCount} case{proc.caseCount !== 1 ? 's' : ''} today
            </span>
          </div>
          
          <div className="space-y-3 pl-3.5">
            <BulletBar
              label="OR Time"
              todayValue={proc.todayORTime}
              avgValue={proc.avgORTime}
              maxValue={maxValue}
              color="blue"
              formatValue={fmt}
            />
            <BulletBar
              label="Surgical Time"
              todayValue={proc.todaySurgicalTime}
              avgValue={proc.avgSurgicalTime}
              maxValue={maxValue}
              color="violet"
              formatValue={fmt}
            />
          </div>
        </div>
      ))}

      <div className="pt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 bg-blue-600 rounded-sm opacity-90" />
          <span className="text-slate-600 font-medium">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 bg-blue-200 rounded-sm" />
          <span className="text-slate-600 font-medium">30-Day Avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-slate-900/40" />
          <span className="text-slate-600 font-medium">Avg Marker</span>
        </div>
      </div>
    </div>
  )
}