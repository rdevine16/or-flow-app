'use client'

// ============================================================================
// COMPLETED CASE VIEW - Enhanced with Insights & Analytics
// ============================================================================
// Professional read-only view for completed surgical cases
// Shows metrics, timeline visualization, phase breakdown, flags, and insights

import { useState } from 'react'
import SurgeonAvatar from '../ui/SurgeonAvatar'
import CaseFlagsSection from './CaseFlagsSection'

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

interface MilestoneAverage {
  milestoneName: string
  avgMinutesFromStart: number
}

interface ImplantData {
  fixation_type: string | null
  // Hip
  cup_brand: string | null
  cup_size_templated: string | null
  cup_size_final: string | null
  stem_brand: string | null
  stem_size_templated: string | null
  stem_size_final: string | null
  head_size_templated: string | null
  head_size_final: string | null
  liner_size_templated: string | null
  liner_size_final: string | null
  // Knee
  femur_brand: string | null
  femur_type: string | null
  femur_size_templated: string | null
  femur_size_final: string | null
  tibia_brand: string | null
  tibia_size_templated: string | null
  tibia_size_final: string | null
  poly_brand: string | null
  poly_size_templated: string | null
  poly_size_final: string | null
  patella_brand: string | null
  patella_type: string | null
  patella_size_templated: string | null
  patella_size_final: string | null
}

interface DeviceCompanyData {
  id: string
  companyName: string
  trayStatus: 'pending' | 'consignment' | 'loaners_confirmed' | 'delivered'
  loanerTrayCount: number | null
  deliveredTrayCount: number | null
  repNotes: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  deliveredAt: string | null
  deliveredByName: string | null
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
  facilityId: string
  userId: string | null
  supabase: any
  patientCallTime: string | null
  // Averages from surgeon_procedure_averages
  surgeonAverage: {
    avgTotalMinutes: number | null
    sampleSize: number
  } | null
  // Averages from surgeon_milestone_averages (keyed by milestone name)
  milestoneAverages: MilestoneAverage[]
  // Implant data
  implants: ImplantData | null
  implantCategory: 'hip' | 'knee' | 'total_hip' | 'total_knee' | null
  // Device Rep / Trays data
  deviceCompanies: DeviceCompanyData[]
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
    return { color: 'green', icon: '✓', label: 'On target', bgClass: 'bg-green-50', textClass: 'text-green-600', borderClass: 'border-green-200' }
  } else if (absDiff <= thresholds.warning) {
    return { color: 'amber', icon: '~', label: diff > 0 ? 'Slightly over' : 'Slightly under', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' }
  } else {
    return { color: 'red', icon: '!', label: diff > 0 ? 'Over average' : 'Under average', bgClass: 'bg-red-50', textClass: 'text-red-600', borderClass: 'border-red-200' }
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
    nurse: 'bg-green-100 text-green-600',
    tech: 'bg-purple-100 text-purple-700',
  }
  return colors[role] || 'bg-slate-100 text-slate-600'
}

// Tray status configuration
function getTrayStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        icon: '⏳',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
      }
    case 'consignment':
      return {
        label: 'Consignment',
        icon: '✓',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
      }
    case 'loaners_confirmed':
      return {
        label: 'Loaners Confirmed',
        icon: '📦',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
      }
    case 'delivered':
      return {
        label: 'Delivered',
        icon: '✓',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
      }
    default:
      return {
        label: status,
        icon: '•',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200',
      }
  }
}

// Format datetime for display
function formatDateTimeShort(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
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

// Implant Row Component
function ImplantRow({ 
  component, 
  brand, 
  type,
  templated, 
  final 
}: { 
  component: string
  brand: string | null
  type?: string | null
  templated: string | null
  final: string | null
}) {
  // Check if templated and final match
  const sizesMatch = templated && final && templated === final
  const sizesDiffer = templated && final && templated !== final
  
  return (
    <div className="grid grid-cols-4 gap-2 py-1.5 border-b border-slate-50 last:border-0 items-center">
      <div className="text-xs font-medium text-slate-700">{component}</div>
      <div className="text-xs text-slate-600">
        {brand || '—'}
        {type && <span className="ml-1 text-slate-400">({type})</span>}
      </div>
      <div className="text-center">
        <span className={`text-xs font-mono ${templated ? 'text-slate-700' : 'text-slate-400'}`}>
          {templated || '—'}
        </span>
      </div>
      <div className="text-center">
        <span className={`text-xs font-mono font-semibold ${
          sizesDiffer ? 'text-amber-700' : 
          sizesMatch ? 'text-green-600' : 
          final ? 'text-slate-700' : 'text-slate-400'
        }`}>
          {final || '—'}
          {sizesDiffer && (
            <span className="ml-1 text-[10px] text-amber-500">↑</span>
          )}
          {sizesMatch && (
            <span className="ml-1 text-[10px] text-green-500">✓</span>
          )}
        </span>
      </div>
    </div>
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
    success: 'bg-gradient-to-br from-green-600 to-teal-500 text-white border-transparent shadow-lg shadow-green-600/20',
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
                    ? (isGradient ? 'text-green-200' : 'text-green-600')
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
  facilityId,
  userId,
  supabase,
  patientCallTime,
  surgeonAverage,
  milestoneAverages,
  implants,
  implantCategory,
  deviceCompanies,
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

  // Calculate actual times
  const totalMinutes = minutesBetween(patientIn, patientOut)
  const surgicalMinutes = minutesBetween(incision, closing)
  const anesthesiaMinutes = minutesBetween(anesStart, anesEnd)
  const startVariance = getStartVariance(caseData.startTime, patientIn, caseData.scheduledDate)
  
  // ========================================
  // MILESTONE AVERAGES COMPARISON
  // ========================================
  
  // Helper to get average for a milestone
  const getAvgForMilestone = (milestoneName: string): number | null => {
    const avg = milestoneAverages.find(ma => ma.milestoneName === milestoneName)
    return avg ? avg.avgMinutesFromStart : null
  }

  // Calculate surgical time average from milestone averages
  // Surgical avg = avg time to closing - avg time to incision
  const avgIncisionFromStart = getAvgForMilestone('incision')
  const avgClosingFromStart = getAvgForMilestone('closing') ?? getAvgForMilestone('closing_complete')
  const avgSurgicalMinutes = (avgIncisionFromStart !== null && avgClosingFromStart !== null)
    ? avgClosingFromStart - avgIncisionFromStart
    : null

  // Calculate anesthesia time average
  const avgAnesStart = getAvgForMilestone('anes_start')
  const avgAnesEnd = getAvgForMilestone('anes_end')
  const avgAnesthesiaMinutes = (avgAnesStart !== null && avgAnesEnd !== null)
    ? avgAnesEnd - avgAnesStart
    : null

  // ========================================
  // COMPARISONS
  // ========================================

  // Total time comparison (from surgeon_procedure_averages)
  const totalComparison = surgeonAverage?.avgTotalMinutes && totalMinutes
    ? {
        diff: totalMinutes - surgeonAverage.avgTotalMinutes,
        value: `${totalMinutes > surgeonAverage.avgTotalMinutes ? '+' : ''}${Math.round(totalMinutes - surgeonAverage.avgTotalMinutes)}m`,
        isPositive: totalMinutes <= surgeonAverage.avgTotalMinutes
      }
    : null

  // Surgical time comparison (from milestone averages)
  const surgicalComparison = avgSurgicalMinutes && surgicalMinutes
    ? {
        diff: surgicalMinutes - avgSurgicalMinutes,
        value: `${surgicalMinutes > avgSurgicalMinutes ? '+' : ''}${Math.round(surgicalMinutes - avgSurgicalMinutes)}m`,
        isPositive: surgicalMinutes <= avgSurgicalMinutes
      }
    : null

  // Anesthesia time comparison (from milestone averages)
  const anesthesiaComparison = avgAnesthesiaMinutes && anesthesiaMinutes
    ? {
        diff: anesthesiaMinutes - avgAnesthesiaMinutes,
        value: `${anesthesiaMinutes > avgAnesthesiaMinutes ? '+' : ''}${Math.round(anesthesiaMinutes - avgAnesthesiaMinutes)}m`,
        isPositive: anesthesiaMinutes <= avgAnesthesiaMinutes
      }
    : null

  // ========================================
  // GENERATE INSIGHTS
  // ========================================
  const insights: { icon: string; text: string; type: 'success' | 'warning' | 'danger' | 'info' }[] = []
  
  // Start time insight
  if (startVariance) {
    if (startVariance.minutes <= 5) {
      insights.push({ icon: '✓', text: 'Started on time', type: 'success' })
    } else if (startVariance.isLate) {
      insights.push({ icon: '!', text: `Started ${Math.round(startVariance.minutes)} minutes late`, type: startVariance.minutes > 15 ? 'danger' : 'warning' })
    } else {
      insights.push({ icon: '✓', text: `Started ${Math.round(startVariance.minutes)} minutes early`, type: 'success' })
    }
  }

  // Total time insight
  if (totalComparison) {
    if (Math.abs(totalComparison.diff) <= 5) {
      insights.push({ icon: '✓', text: `Total time on par with ${surgeon?.lastName ? `Dr. ${surgeon.lastName}'s` : "surgeon's"} average`, type: 'success' })
    } else if (totalComparison.diff < 0) {
      insights.push({ icon: '✓', text: `Total time ${Math.abs(Math.round(totalComparison.diff))} min faster than average`, type: 'success' })
    } else {
      insights.push({ icon: '~', text: `Total time ${Math.round(totalComparison.diff)} min longer than average`, type: totalComparison.diff > 15 ? 'danger' : 'warning' })
    }
  }

  // Surgical time insight (from milestone averages)
  if (surgicalComparison) {
    if (Math.abs(surgicalComparison.diff) <= 5) {
      insights.push({ icon: '✓', text: `Surgical time on par with ${surgeon?.lastName ? `Dr. ${surgeon.lastName}'s` : "surgeon's"} average`, type: 'success' })
    } else if (surgicalComparison.diff < 0) {
      insights.push({ icon: '✓', text: `Surgical time ${Math.abs(Math.round(surgicalComparison.diff))} min faster than average`, type: 'success' })
    } else {
      insights.push({ icon: '!', text: `Surgical time ${Math.round(surgicalComparison.diff)} min longer than average`, type: surgicalComparison.diff > 15 ? 'danger' : 'warning' })
    }
  }

  // Anesthesia time insight (from milestone averages)
  if (anesthesiaComparison && Math.abs(anesthesiaComparison.diff) > 5) {
    if (anesthesiaComparison.diff < 0) {
      insights.push({ icon: '✓', text: `Anesthesia ${Math.abs(Math.round(anesthesiaComparison.diff))} min faster than average`, type: 'success' })
    } else {
      insights.push({ icon: '~', text: `Anesthesia ${Math.round(anesthesiaComparison.diff)} min longer than average`, type: 'warning' })
    }
  }

  // Milestones recorded insight
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
            ? (startVariance.minutes <= 5 ? 'On time' : startVariance.isLate ? 'Late start' : 'Early start')
            : 'No data'
          }
          variant={
            !startVariance ? 'default' :
            startVariance.minutes <= 5 ? 'success' :           // Green: on time (within 5 min either way)
            !startVariance.isLate ? 'success' :                // Green: early (any amount)
            startVariance.minutes <= 15 ? 'warning' : 'danger' // Yellow: 5-15 min late, Red: >15 min late
          }
          icon={
            startVariance && (startVariance.minutes <= 5 || !startVariance.isLate) ? (
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
          variant={
            !totalComparison ? 'success' :
            Math.abs(totalComparison.diff) <= 5 ? 'success' :
            totalComparison.diff > 15 ? 'danger' :
            totalComparison.diff > 0 ? 'warning' : 'success'
          }
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
          variant={
            !surgicalComparison ? 'primary' :
            Math.abs(surgicalComparison.diff) <= 5 ? 'primary' :
            surgicalComparison.diff > 15 ? 'danger' :
            surgicalComparison.diff > 0 ? 'warning' : 'primary'
          }
          comparison={surgicalComparison ? {
            value: surgicalComparison.value,
            isPositive: surgicalComparison.isPositive,
            neutral: Math.abs(surgicalComparison.diff) <= 5
          } : undefined}
        />

        {/* Flags Card — count is shown in the CaseFlagsSection below */}
        <MetricCard
          label="Flags"
          value="—"
          subtitle="See details below"
          variant="default"
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
                <p className={`text-sm font-semibold mt-0.5 font-mono ${
                  startVariance 
                    ? (startVariance.isLate && startVariance.minutes > 5 ? 'text-red-600' : 'text-green-600')
                    : 'text-slate-900'
                }`}>{formatTimeShort(patientIn)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Surgeon</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {surgeon ? `Dr. ${surgeon.firstName} ${surgeon.lastName}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Anesthesiologist</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {anesthesiologist ? `Dr. ${anesthesiologist.firstName} ${anesthesiologist.lastName}` : '—'}
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
                    'Recovery': 'bg-green-400',
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
      {/* ROW 3: Insights + Flags + Staff */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Case Insights Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Case Insights</h3>
            <HelpTooltip title="Understanding Insights">
              <p><strong>Color Indicators:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><span className="text-green-600">Green</span> = On target (within 5 min)</li>
                <li><span className="text-amber-700">Yellow</span> = Slight variance (5-15 min)</li>
                <li><span className="text-red-600">Red</span> = Significant variance (&gt;15 min)</li>
              </ul>
              <p className="mt-2"><strong>How we calculate averages:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Total Time</strong> — Surgeon&apos;s average case duration for this procedure</li>
                <li><strong>Surgical Time</strong> — Calculated from surgeon&apos;s average milestone timing (Incision to Closing)</li>
                <li><strong>Anesthesia</strong> — Calculated from surgeon&apos;s average milestone timing</li>
              </ul>
              {surgeonAverage?.sampleSize && (
                <p className="mt-2 text-slate-500">Based on {surgeonAverage.sampleSize} completed cases</p>
              )}
            </HelpTooltip>
          </div>
          
          {insights.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No insights available</p>
          ) : (
            <div className="space-y-2">
              {insights.map((insight, idx) => {
                const bgColors = {
                  success: 'bg-green-50 border-green-200',
                  warning: 'bg-amber-50 border-amber-200',
                  danger: 'bg-red-50 border-red-200',
                  info: 'bg-slate-50 border-slate-200',
                }
                const textColors = {
                  success: 'text-green-600',
                  warning: 'text-amber-700',
                  danger: 'text-red-600',
                  info: 'text-slate-600',
                }
                const iconColors = {
                  success: 'text-green-500',
                  warning: 'text-amber-500',
                  danger: 'text-red-600',
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

        {/* Case Flags */}
        <CaseFlagsSection
          caseId={caseData.id}
          facilityId={facilityId}
          isCompleted={true}
          userId={userId}
          supabase={supabase}
        />

        {/* Surgical Team Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Surgical Team</h3>
          <div className="space-y-2">
            {/* Surgeon */}
            {surgeon && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <SurgeonAvatar name={`${surgeon.firstName} ${surgeon.lastName}`} size="sm" />
                  <span className="text-sm text-slate-700">Dr. {surgeon.firstName} {surgeon.lastName}</span>
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
                  <span className="text-sm text-slate-700">Dr. {anesthesiologist.firstName} {anesthesiologist.lastName}</span>
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
      {/* ROW 4: Device Rep / Trays */}
      {/* ================================================================== */}
      {deviceCompanies && deviceCompanies.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Device Rep / Trays</h3>
          
          <div className="space-y-3">
            {deviceCompanies.map((company, index) => {
              const status = getTrayStatusConfig(company.trayStatus)

              return (
                <div key={company.id}>
                  {/* Company Row */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{company.companyName}</span>
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${status.bgColor} ${status.borderColor}`}>
                      <span className="text-xs">{status.icon}</span>
                      <span className={`text-xs font-semibold ${status.textColor}`}>
                        {status.label}
                        {company.trayStatus === 'loaners_confirmed' && company.loanerTrayCount && (
                          <span className="ml-1">({company.loanerTrayCount})</span>
                        )}
                        {company.trayStatus === 'delivered' && company.deliveredTrayCount && (
                          <span className="ml-1">({company.deliveredTrayCount})</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  {(company.confirmedAt || company.deliveredAt) && (
                    <div className="text-xs text-slate-500 mb-2 space-y-0.5">
                      {company.confirmedAt && (
                        <p>
                          Confirmed: {formatDateTimeShort(company.confirmedAt)}
                          {company.confirmedByName && <span className="text-slate-400"> by {company.confirmedByName}</span>}
                        </p>
                      )}
                      {company.deliveredAt && (
                        <p>
                          Delivered: {formatDateTimeShort(company.deliveredAt)}
                          {company.deliveredByName && <span className="text-slate-400"> by {company.deliveredByName}</span>}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Rep Notes */}
                  {company.repNotes && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500">💬</span>
                        <div>
                          <p className="text-xs font-medium text-blue-700 mb-0.5">Rep Notes</p>
                          <p className="text-xs text-blue-800">{company.repNotes}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  {index < deviceCompanies.length - 1 && (
                    <div className="border-b border-slate-100 mt-3"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 5: Implants (if applicable) */}
      {/* ================================================================== */}
      {implants && implantCategory && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Implants</h3>
          
          {/* Fixation Type */}
          {implants.fixation_type && (
            <div className="mb-3 pb-3 border-b border-slate-100">
              <span className="text-xs text-slate-500">Fixation: </span>
              <span className="text-xs font-semibold text-slate-700 capitalize">{implants.fixation_type}</span>
            </div>
          )}

          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <div>Component</div>
            <div>Brand/Type</div>
            <div className="text-center">Templated</div>
            <div className="text-center">Final</div>
          </div>

          <div className="space-y-1">
            {/* Hip Components */}
            {(implantCategory === 'hip' || implantCategory === 'total_hip') && (
              <>
                {(implants.cup_brand || implants.cup_size_templated || implants.cup_size_final) && (
                  <ImplantRow 
                    component="Cup" 
                    brand={implants.cup_brand} 
                    templated={implants.cup_size_templated} 
                    final={implants.cup_size_final} 
                  />
                )}
                {(implants.stem_brand || implants.stem_size_templated || implants.stem_size_final) && (
                  <ImplantRow 
                    component="Stem" 
                    brand={implants.stem_brand} 
                    templated={implants.stem_size_templated} 
                    final={implants.stem_size_final} 
                  />
                )}
                {(implants.head_size_templated || implants.head_size_final) && (
                  <ImplantRow 
                    component="Head" 
                    brand={null} 
                    templated={implants.head_size_templated} 
                    final={implants.head_size_final} 
                  />
                )}
                {(implants.liner_size_templated || implants.liner_size_final) && (
                  <ImplantRow 
                    component="Liner" 
                    brand={null} 
                    templated={implants.liner_size_templated} 
                    final={implants.liner_size_final} 
                  />
                )}
              </>
            )}

            {/* Knee Components */}
            {(implantCategory === 'knee' || implantCategory === 'total_knee') && (
              <>
                {(implants.femur_brand || implants.femur_size_templated || implants.femur_size_final) && (
                  <ImplantRow 
                    component="Femur" 
                    brand={implants.femur_brand} 
                    type={implants.femur_type}
                    templated={implants.femur_size_templated} 
                    final={implants.femur_size_final} 
                  />
                )}
                {(implants.tibia_brand || implants.tibia_size_templated || implants.tibia_size_final) && (
                  <ImplantRow 
                    component="Tibia" 
                    brand={implants.tibia_brand} 
                    templated={implants.tibia_size_templated} 
                    final={implants.tibia_size_final} 
                  />
                )}
                {(implants.poly_brand || implants.poly_size_templated || implants.poly_size_final) && (
                  <ImplantRow 
                    component="Poly" 
                    brand={implants.poly_brand} 
                    templated={implants.poly_size_templated} 
                    final={implants.poly_size_final} 
                  />
                )}
                {(implants.patella_brand || implants.patella_size_templated || implants.patella_size_final) && (
                  <ImplantRow 
                    component="Patella" 
                    brand={implants.patella_brand} 
                    type={implants.patella_type}
                    templated={implants.patella_size_templated} 
                    final={implants.patella_size_final} 
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ROW 6: Notes */}
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