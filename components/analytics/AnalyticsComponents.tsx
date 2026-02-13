// components/analytics/AnalyticsComponents.tsx
// Shared enterprise-grade analytics components for ORbit
// Used by Surgeon Overview, Surgeon Performance, and other analytics pages

'use client'

import { useState, useRef, useEffect } from 'react'
import { InfoTooltip } from '@/components/ui/Tooltip'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock, Phone, X, Zap } from 'lucide-react'
import { chartHex } from '@/lib/design-tokens'

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
  const totalSpan = callEarliness || 1
  const prepPct = Math.min((prepDuration / totalSpan) * 100, 90)
  const waitPct = waitForSurgeon !== null ? Math.min((waitForSurgeon / totalSpan) * 100, 90 - prepPct) : 0

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

  let currentOffset = 0

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
          {delays.map((delay, idx) => {
            const pct = totalDelays > 0 ? delay.count / totalDelays : 0
            const dashLength = pct * circumference
            const segment = (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={delay.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-currentOffset}
                className="transition-all duration-500"
              />
            )
            currentOffset += dashLength
            return segment
          })}
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
      {/* Day overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <SkeletonPulse className="h-3 w-24 mb-2" />
              <SkeletonPulse className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
      {/* Cases */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SkeletonPulse className="h-4 w-24 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3">
              <SkeletonPulse className="h-3 w-32 mb-1" />
              <SkeletonPulse className="h-6 w-full rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          <SkeletonPulse className="h-40 w-full rounded" />
        </div>
      </div>
    </div>
  )
}


// ============================================
// STACKED CASE BAR — Enhanced phase bars for day analysis
// ============================================

interface CasePhaseBarProps {
  caseNumber: string
  procedureName: string
  phases: {
    label: string
    value: number
    color: string
  }[]
  totalValue: number
  maxValue: number
  caseId: string
  onCaseClick?: (caseId: string) => void
  formatValue?: (val: number) => string
}

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
            if (phasePct < 1) return null
            return (
              <div
                key={idx}
                className="h-full relative group/phase"
                style={{ width: `${phasePct}%`, backgroundColor: phase.color }}
                title={`${phase.label}: ${fmt(phase.value)}`}
              >
                {/* Show label if wide enough */}
                {phasePct > 18 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90 truncate px-1">
                    {fmt(phase.value)}
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
// PHASE LEGEND — Color legend for stacked bars
// ============================================

interface PhaseLegendItem {
  label: string
  color: string
}

export function PhaseLegend({ items }: { items: PhaseLegendItem[] }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-slate-500">{item.label}</span>
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