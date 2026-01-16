'use client'

// ============================================================================
// COMPLETED CASE VIEW - Enhanced with Insights & Analytics
// ============================================================================
// Professional read-only view for completed surgical cases
// Shows metrics, timeline visualization, phase breakdown, delays, and insights

import { useState } from 'react'
import SurgeonAvatar from '../ui/SurgeonAvatar'

// ============================================================================
// TYPES
// ============================================================================

interface MilestoneData {
  id: string
  name: string
  displayName: string
  recordedAt: string | null
}

interface StaffMember {
  id: string
  name: string
  role: string
}

interface DelayData {
  id: string
  typeName: string
  durationMinutes: number | null
  notes: string | null
  recordedAt: string
}

interface MilestoneAverage {
  milestoneName: string
  avgMinutesFromStart: number
}

interface CompletedCaseViewProps {
  caseData: {
    id: string
    caseNumber: string
    scheduledDate: string
    startTime: string | null
    operativeSide: string | null
    notes: string | null
    room: string | null
    procedure: string | null
  }
  surgeon: { firstName: string; lastName: string } | null
  anesthesiologist: { firstName: string; lastName: string } | null
  milestones: MilestoneData[]
  staff: StaffMember[]
  delays: DelayData[]
  patientCallTime: string | null
  // Averages from surgeon_procedure_averages
  surgeonAverage: {
    avgTotalMinutes: number | null
    sampleSize: number
  } | null
  // Averages from surgeon_milestone_averages (keyed by milestone name)
  milestoneAverages: MilestoneAverage[]
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format time from ISO string (7:42:15 AM)
function formatTime(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

// Format time without seconds (7:42 AM)
function formatTimeShort(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Format scheduled time (HH:MM:SS string) to display time
function formatScheduledTime(timeStr: string | null): string {
  if (!timeStr) return '—'
  const [hours, minutes] = timeStr.split(':').map(Number)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

// Format duration in minutes to HH:MM:SS
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  const s = Math.round((minutes % 1) * 60)
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Format duration for display (e.g., "1h 23m" or "45m")
function formatDurationReadable(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${m}m`
}

// Calculate minutes between two ISO timestamps
function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return diff / (1000 * 60)
}

// Get variance indicator color and icon
function getVarianceIndicator(actualMinutes: number, avgMinutes: number, thresholds = { good: 5, warning: 15 }) {
  const diff = actualMinutes - avgMinutes
  const absDiff = Math.abs(diff)
  
  if (absDiff <= thresholds.good) {
    return { color: 'emerald', icon: '✓', label: 'On target', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' }
  } else if (absDiff <= thresholds.warning) {
    return { color: 'amber', icon: '~', label: diff > 0 ? 'Slightly over' : 'Slightly under', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' }
  } else {
    return { color: 'red', icon: '!', label: diff > 0 ? 'Over average' : 'Under average', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200' }
  }
}

// Get start variance (scheduled vs actual patient in)
function getStartVariance(scheduledTime: string | null, patientInTime: string | null, scheduledDate: string): { minutes: number; isLate: boolean } | null {
  if (!scheduledTime || !patientInTime) return null
  
  // Parse scheduled time (HH:MM:SS) - e.g., "13:26:00"
  const [hours, minutes, seconds] = scheduledTime.split(':').map(Number)
  
  // Parse the actual patient-in time (ISO string)
  const actualDateTime = new Date(patientInTime)
  
  // Extract the local time components from the actual patient-in time
  // and compare just the time portions (hours + minutes) from the same day
  const actualHours = actualDateTime.getHours()
  const actualMinutes = actualDateTime.getMinutes()
  
  // Convert both to minutes since midnight for comparison
  const scheduledTotalMinutes = hours * 60 + minutes
  const actualTotalMinutes = actualHours * 60 + actualMinutes
  
  const diffMinutes = actualTotalMinutes - scheduledTotalMinutes
  
  return {
    minutes: Math.abs(diffMinutes),
    isLate: diffMinutes > 0
  }
}

// Get role badge styling
function getRoleBadgeClass(role: string): string {
  const colors: Record<string, string> = {
    surgeon: 'bg-blue-100 text-blue-700',
    anesthesiologist: 'bg-amber-100 text-amber-700',
    nurse: 'bg-emerald-100 text-emerald-700',
    tech: 'bg-purple-100 text-purple-700',
  }
  return colors[role] || 'bg-slate-100 text-slate-600'
}

// Delay type icons
function getDelayIcon(typeName: string): string {
  const icons: Record<string, string> = {
    'Equipment Issue': '🔧',
    'Patient Prep': '👤',
    'Staff Availability': '👥',
    'Anesthesia Delay': '💉',
    'Room Turnover': '🚪',
    'Surgeon Delayed': '⏰',
    'Previous Case Ran Over': '📋',
    'Patient Transport': '🚶',
    'Lab Results Pending': '🔬',
    'Consent Issues': '📝',
  }
  return icons[typeName] || '⚠️'
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Help Tooltip Component
function HelpTooltip({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 
                   flex items-center justify-center text-xs font-medium transition-colors"
        aria-label="Help"
      >
        ?
      </button>
      {isOpen && (
        <div className="absolute right-0 top-7 z-50 w-72 p-4 bg-white rounded-xl shadow-xl border border-slate-200 text-left">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">{title}</h4>
          <div className="text-xs text-slate-600 space-y-2">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// Operative Side Badge
function OperativeSideBadge({ side }: { side: string | null }) {
  if (!side || side === 'n/a') return null
  const labels: Record<string, string> = { left: 'Left', right: 'Right', bilateral: 'Bilateral' }
  const colors: Record<string, string> = {
    left: 'bg-purple-100 text-purple-700',
    right: 'bg-indigo-100 text-indigo-700',
    bilateral: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${colors[side] || 'bg-slate-100'}`}>
      {labels[side] || side}
    </span>
  )
}

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  subtitle, 
  comparison,
  variant = 'default',
  icon
}: { 
  label: string
  value: string
  subtitle?: string
  comparison?: { value: string; isPositive: boolean; neutral?: boolean }
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'info'
  icon?: React.ReactNode
}) {
  const variants = {
    default: 'bg-white border-slate-200',
    success: 'bg-gradient-to-br from-emerald-600 to-teal-500 text-white border-transparent shadow-lg shadow-emerald-600/20',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent shadow-lg shadow-amber-500/20',
    danger: 'bg-gradient-to-br from-red-500 to-rose-500 text-white border-transparent shadow-lg shadow-red-500/20',
    primary: 'bg-gradient-to-br from-blue-600 to-sky-500 text-white border-transparent shadow-lg shadow-blue-600/20',
    info: 'bg-gradient-to-br from-slate-600 to-slate-500 text-white border-transparent shadow-lg shadow-slate-600/20',
  }
  
  const isGradient = variant !== 'default'
  
  return (
    <div className={`rounded-xl p-4 border ${variants[variant]} relative overflow-hidden`}>
      {isGradient && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent)]" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <p className={`text-[10px] font-semibold tracking-wider uppercase ${isGradient ? 'opacity-80' : 'text-slate-400'}`}>
            {label}
          </p>
          {icon}
        </div>
        <p className={`text-2xl font-bold font-mono tabular-nums ${isGradient ? '' : 'text-slate-900'}`}>
          {value}
        </p>
        {subtitle && (
          <p className={`text-[10px] mt-1 ${isGradient ? 'opacity-70' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        )}
        {comparison && (
          <div className={`mt-2 pt-2 ${isGradient ? 'border-t border-white/20' : 'border-t border-slate-100'}`}>
            <p className={`text-[10px] ${isGradient ? 'opacity-80' : 'text-slate-500'}`}>
              vs avg:{' '}
              <span className={`font-semibold ${
                comparison.neutral 
                  ? (isGradient ? 'text-white' : 'text-slate-700')
                  : comparison.isPositive 
                    ? (isGradient ? 'text-emerald-200' : 'text-emerald-600')
                    : (isGradient ? 'text-red-200' : 'text-red-600')
              }`}>
                {comparison.value}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CompletedCaseView({
  caseData,
  surgeon,
  anesthesiologist,
  milestones,
  staff,
  delays,
  patientCallTime,
  surgeonAverage,
  milestoneAverages,
}: CompletedCaseViewProps) {
  
  // Sort milestones by recorded time
  const recordedMilestones = milestones
    .filter(m => m.recordedAt)
    .sort((a, b) => new Date(a.recordedAt!).getTime() - new Date(b.recordedAt!).getTime())

  // Find key milestones (use ?? null to convert undefined to null for TypeScript)
  const patientIn = milestones.find(m => m.name === 'patient_in')?.recordedAt ?? null
  const patientOut = milestones.find(m => m.name === 'patient_out')?.recordedAt ?? null
  const incision = milestones.find(m => m.name === 'incision')?.recordedAt ?? null
  const closing = milestones.find(m => m.name === 'closing' || m.name === 'closing_complete')?.recordedAt ?? null
  const anesStart = milestones.find(m => m.name === 'anes_start')?.recordedAt ?? null
  const anesEnd = milestones.find(m => m.name === 'anes_end')?.recordedAt ?? null

  // Calculate times
  const totalMinutes = minutesBetween(patientIn, patientOut)
  const surgicalMinutes = minutesBetween(incision, closing)
  const anesthesiaMinutes = minutesBetween(anesStart, anesEnd)
  const startVariance = getStartVariance(caseData.startTime, patientIn, caseData.scheduledDate)
  
  // Total delays
  const totalDelayMinutes = delays.reduce((sum, d) => sum + (d.durationMinutes || 0), 0)

  // Calculate comparisons
  const totalComparison = surgeonAverage?.avgTotalMinutes && totalMinutes
    ? {
        diff: totalMinutes - surgeonAverage.avgTotalMinutes,
        value: `${totalMinutes > surgeonAverage.avgTotalMinutes ? '+' : ''}${Math.round(totalMinutes - surgeonAverage.avgTotalMinutes)}m`,
        isPositive: totalMinutes <= surgeonAverage.avgTotalMinutes
      }
    : null

  // Generate insights
  const insights: { icon: string; text: string; type: 'success' | 'warning' | 'danger' | 'info' }[] = []
  
  if (startVariance) {
    if (startVariance.minutes <= 5) {
      insights.push({ icon: '✓', text: 'Started on time', type: 'success' })
    } else if (startVariance.isLate) {
      insights.push({ icon: '!', text: `Started ${Math.round(startVariance.minutes)} minutes late`, type: startVariance.minutes > 15 ? 'danger' : 'warning' })
    } else {
      insights.push({ icon: '✓', text: `Started ${Math.round(startVariance.minutes)} minutes early`, type: 'success' })
    }
  }

  if (totalComparison) {
    if (Math.abs(totalComparison.diff) <= 5) {
      insights.push({ icon: '✓', text: `Total time on par with ${surgeon?.lastName ? `Dr. ${surgeon.lastName}'s` : "surgeon's"} average`, type: 'success' })
    } else if (totalComparison.diff < 0) {
      insights.push({ icon: '✓', text: `${Math.abs(Math.round(totalComparison.diff))} min faster than ${surgeon?.lastName ? `Dr. ${surgeon.lastName}'s` : "surgeon's"} average`, type: 'success' })
    } else {
      insights.push({ icon: '~', text: `${Math.round(totalComparison.diff)} min longer than ${surgeon?.lastName ? `Dr. ${surgeon.lastName}'s` : "surgeon's"} average`, type: 'warning' })
    }
  }

  if (delays.length > 0) {
    insights.push({ 
      icon: '⚠', 
      text: `${delays.length} delay${delays.length > 1 ? 's' : ''} recorded (${totalDelayMinutes} min total)`, 
      type: 'warning' 
    })
  }

  if (recordedMilestones.length === milestones.length && milestones.length > 0) {
    insights.push({ icon: '✓', text: `All ${milestones.length} milestones recorded`, type: 'success' })
  } else if (milestones.length > 0) {
    insights.push({ icon: '~', text: `${recordedMilestones.length} of ${milestones.length} milestones recorded`, type: 'info' })
  }

  // Build timeline phases
  const phases: { name: string; startTime: string | null; endTime: string | null; durationMin: number | null }[] = []
  
  if (patientIn && anesStart) {
    phases.push({ name: 'Pre-Anesthesia', startTime: patientIn, endTime: anesStart, durationMin: minutesBetween(patientIn, anesStart) })
  }
  if (anesStart && anesEnd) {
    phases.push({ name: 'Anesthesia', startTime: anesStart, endTime: anesEnd, durationMin: anesthesiaMinutes })
  }
  if (anesEnd && incision) {
    phases.push({ name: 'Prep', startTime: anesEnd, endTime: incision, durationMin: minutesBetween(anesEnd, incision) })
  }
  if (incision && closing) {
    phases.push({ name: 'Surgery', startTime: incision, endTime: closing, durationMin: surgicalMinutes })
  }
  if (closing && patientOut) {
    phases.push({ name: 'Recovery', startTime: closing, endTime: patientOut, durationMin: minutesBetween(closing, patientOut) })
  }

  return (
    <div className="space-y-6">
      
      {/* ================================================================== */}
      {/* ROW 1: Key Metrics */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Start Variance Card */}
        <MetricCard
          label="Start Time"
          value={startVariance 
            ? `${startVariance.isLate ? '+' : '-'}${Math.round(startVariance.minutes)}m`
            : '—'
          }
          subtitle={startVariance 
            ? (startVariance.isLate ? 'Late start' : 'Early start')
            : 'No data'
          }
          variant={
            !startVariance ? 'default' :
            startVariance.minutes <= 5 ? 'success' :
            startVariance.minutes <= 15 ? 'warning' : 'danger'
          }
          icon={
            startVariance && startVariance.minutes <= 5 ? (
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : null
          }
        />

        {/* Total Time Card */}
        <MetricCard
          label="Total Time"
          value={totalMinutes ? formatDuration(totalMinutes) : '—'}
          subtitle="Patient In → Out"
          variant="success"
          comparison={totalComparison ? {
            value: totalComparison.value,
            isPositive: totalComparison.isPositive,
            neutral: Math.abs(totalComparison.diff) <= 5
          } : undefined}
        />

        {/* Surgical Time Card */}
        <MetricCard
          label="Surgical Time"
          value={surgicalMinutes ? formatDuration(surgicalMinutes) : '—'}
          subtitle="Incision → Closing"
          variant="primary"
        />

        {/* Delays Card */}
        <MetricCard
          label="Delays"
          value={delays.length > 0 ? `${delays.length}` : '0'}
          subtitle={delays.length > 0 ? `${totalDelayMinutes} min total` : 'No delays recorded'}
          variant={delays.length === 0 ? 'default' : delays.length > 2 ? 'danger' : 'warning'}
        />
      </div>

      {/* ================================================================== */}
      {/* ROW 2: Case Info + Timeline */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Case Details Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Case Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Procedure</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-semibold text-slate-900">{caseData.procedure || '—'}</p>
                <OperativeSideBadge side={caseData.operativeSide} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Room</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseData.room || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Scheduled</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono">{formatScheduledTime(caseData.startTime)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Called</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono">{formatTimeShort(patientCallTime)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Started</p>
                <p className="text-sm font-semibold text-emerald-600 mt-0.5 font-mono">{formatTimeShort(patientIn)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {surgeon ? `Dr. ${surgeon.lastName}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Anesthesiologist</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {anesthesiologist ? `Dr. ${anesthesiologist.lastName}` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Case Timeline</h3>
            <span className="text-xs text-slate-500">{recordedMilestones.length} milestones</span>
          </div>
          
          {/* Horizontal Timeline Visualization */}
          {phases.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-center gap-1">
                {phases.map((phase, idx) => {
                  const totalPhaseDuration = phases.reduce((sum, p) => sum + (p.durationMin || 0), 0)
                  const widthPercent = phase.durationMin && totalPhaseDuration > 0 
                    ? Math.max((phase.durationMin / totalPhaseDuration) * 100, 8)
                    : 10
                  
                  const colors = {
                    'Pre-Anesthesia': 'bg-slate-300',
                    'Anesthesia': 'bg-amber-400',
                    'Prep': 'bg-purple-400',
                    'Surgery': 'bg-blue-500',
                    'Recovery': 'bg-emerald-400',
                  }
                  
                  return (
                    <div 
                      key={phase.name}
                      className="relative group"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <div className={`h-8 ${colors[phase.name as keyof typeof colors] || 'bg-slate-300'} ${idx === 0 ? 'rounded-l-lg' : ''} ${idx === phases.length - 1 ? 'rounded-r-lg' : ''}`} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-semibold text-white drop-shadow-sm truncate px-1">
                          {phase.durationMin ? `${Math.round(phase.durationMin)}m` : ''}
                        </span>
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                          {phase.name}: {phase.durationMin ? formatDurationReadable(phase.durationMin) : '—'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Phase Labels */}
              <div className="flex items-center gap-1 mt-1">
                {phases.map((phase, idx) => {
                  const totalPhaseDuration = phases.reduce((sum, p) => sum + (p.durationMin || 0), 0)
                  const widthPercent = phase.durationMin && totalPhaseDuration > 0 
                    ? Math.max((phase.durationMin / totalPhaseDuration) * 100, 8)
                    : 10
                  return (
                    <div key={`label-${phase.name}`} style={{ width: `${widthPercent}%` }} className="text-center">
                      <span className="text-[9px] text-slate-500 truncate block">{phase.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Milestone List */}
          {recordedMilestones.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No milestones recorded</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
              {recordedMilestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-600 truncate pr-2">{m.displayName}</span>
                  <span className="text-xs font-mono text-slate-900 tabular-nums whitespace-nowrap">
                    {formatTime(m.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 3: Insights + Delays + Staff */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Case Insights Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Case Insights</h3>
            <HelpTooltip title="Understanding Insights">
              <p><strong>Color Indicators:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><span className="text-emerald-600">Green</span> = On target (within 5 min)</li>
                <li><span className="text-amber-600">Yellow</span> = Slight variance (5-15 min)</li>
                <li><span className="text-red-600">Red</span> = Significant variance (&gt;15 min)</li>
              </ul>
              <p className="mt-2"><strong>Averages</strong> are calculated from the surgeon&apos;s last 30 days of completed cases for this procedure type.</p>
              {surgeonAverage?.sampleSize && (
                <p className="mt-1">Sample size: {surgeonAverage.sampleSize} cases</p>
              )}
            </HelpTooltip>
          </div>
          
          {insights.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No insights available</p>
          ) : (
            <div className="space-y-2">
              {insights.map((insight, idx) => {
                const bgColors = {
                  success: 'bg-emerald-50 border-emerald-200',
                  warning: 'bg-amber-50 border-amber-200',
                  danger: 'bg-red-50 border-red-200',
                  info: 'bg-slate-50 border-slate-200',
                }
                const textColors = {
                  success: 'text-emerald-700',
                  warning: 'text-amber-700',
                  danger: 'text-red-700',
                  info: 'text-slate-600',
                }
                const iconColors = {
                  success: 'text-emerald-500',
                  warning: 'text-amber-500',
                  danger: 'text-red-500',
                  info: 'text-slate-400',
                }
                return (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${bgColors[insight.type]}`}
                  >
                    <span className={`text-sm ${iconColors[insight.type]}`}>{insight.icon}</span>
                    <span className={`text-xs ${textColors[insight.type]}`}>{insight.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delays Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Delays</h3>
          
          {delays.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No delays recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {delays.map((delay) => (
                <div 
                  key={delay.id} 
                  className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{getDelayIcon(delay.typeName)}</span>
                      <span className="text-xs font-medium text-amber-800">{delay.typeName}</span>
                    </div>
                    {delay.durationMinutes && (
                      <span className="text-xs font-semibold text-amber-700">{delay.durationMinutes} min</span>
                    )}
                  </div>
                  {delay.notes && (
                    <p className="text-[10px] text-amber-700 mt-1 pl-6">{delay.notes}</p>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 mt-2">
                <p className="text-xs text-slate-500">
                  Total delay: <span className="font-semibold text-slate-700">{totalDelayMinutes} minutes</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Surgical Team Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Surgical Team</h3>
          <div className="space-y-2">
            {/* Surgeon */}
            {surgeon && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <SurgeonAvatar name={`${surgeon.firstName} ${surgeon.lastName}`} size="sm" />
                  <span className="text-sm text-slate-700">Dr. {surgeon.lastName}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${getRoleBadgeClass('surgeon')}`}>
                  Surgeon
                </span>
              </div>
            )}
            
            {/* Anesthesiologist */}
            {anesthesiologist && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <SurgeonAvatar name={`${anesthesiologist.firstName} ${anesthesiologist.lastName}`} size="sm" />
                  <span className="text-sm text-slate-700">Dr. {anesthesiologist.lastName}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${getRoleBadgeClass('anesthesiologist')}`}>
                  Anesthesia
                </span>
              </div>
            )}
            
            {/* Other Staff */}
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <SurgeonAvatar name={s.name} size="sm" />
                  <span className="text-sm text-slate-700">{s.name}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${getRoleBadgeClass(s.role)}`}>
                  {s.role}
                </span>
              </div>
            ))}
            
            {!surgeon && !anesthesiologist && staff.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-2">No staff assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ROW 4: Notes */}
      {/* ================================================================== */}
      {caseData.notes && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
          <p className="text-sm text-slate-600">{caseData.notes}</p>
        </div>
      )}
    </div>
  )
}
