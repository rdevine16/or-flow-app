'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import SurgeonAvatar from '../../components/ui/SurgeonAvatar'

// ============================================================================
// TYPES
// ============================================================================

interface MilestoneRecord {
  id: string
  name: string
  displayName: string
  recordedAt: string | null
  displayOrder: number
}

interface StaffMember {
  id: string
  name: string
  role: string
}

interface ImplantRecord {
  id: string
  component: string
  size: string
  lot?: string
}

interface CaseSummaryProps {
  caseData: {
    id: string
    caseNumber: string
    scheduledDate: string
    startTime: string | null
    operativeSide: string | null
    notes: string | null
    room: string | null
    procedure: string | null
    status: string
    surgeon: { firstName: string; lastName: string } | null
    anesthesiologist: { firstName: string; lastName: string } | null
  }
  milestones: MilestoneRecord[]
  staff: StaffMember[]
  implants?: ImplantRecord[]
  totalTime: string
  surgicalTime: string
  surgeonAverages?: {
    avgTotalTime: number | null
    avgSurgicalTime: number | null
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDateLong(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatScheduledTime(time: string | null): string {
  if (!time) return '—'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatMilestoneTime(isoString: string | null): { time: string; date: string } {
  if (!isoString) return { time: '—', date: '' }
  
  const date = new Date(isoString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  
  return {
    time: `${displayHour}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`,
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function formatDuration(timeString: string): string {
  // Input format: "HH:MM:SS"
  const parts = timeString.split(':')
  if (parts.length !== 3) return timeString
  
  const hours = parseInt(parts[0])
  const minutes = parseInt(parts[1])
  const seconds = parseInt(parts[2])
  
  if (hours === 0 && minutes === 0 && seconds === 0) return '—'
  
  const hourStr = hours > 0 ? `${hours}h ` : ''
  const minStr = `${minutes}m`
  const secStr = ` ${seconds}s`
  
  return `${hourStr}${minStr}${secStr}`
}

function getOperativeSideLabel(side: string | null): string | null {
  if (!side || side === 'n/a') return null
  const labels: Record<string, string> = {
    left: 'Left',
    right: 'Right',
    bilateral: 'Bilateral'
  }
  return labels[side] || null
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    surgeon: 'bg-blue-100 text-blue-700 border-blue-200',
    anesthesiologist: 'bg-amber-100 text-amber-700 border-amber-200',
    nurse: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    tech: 'bg-purple-100 text-purple-700 border-purple-200',
  }
  return colors[role] || 'bg-slate-100 text-slate-700 border-slate-200'
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function DataRow({ label, value, mono = false }: { label: string; value: string | React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function TimelineItem({ 
  time, 
  label, 
  isFirst, 
  isLast,
  isPaired,
  pairType
}: { 
  time: string
  label: string
  isFirst?: boolean
  isLast?: boolean
  isPaired?: boolean
  pairType?: 'start' | 'end'
}) {
  return (
    <div className="flex items-start gap-4 group">
      {/* Timeline track */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
          isPaired 
            ? pairType === 'start' 
              ? 'border-blue-500 bg-blue-100' 
              : 'border-blue-500 bg-blue-500'
            : 'border-emerald-500 bg-emerald-500'
        }`} />
        {!isLast && (
          <div className={`w-0.5 h-8 ${isPaired ? 'bg-blue-200' : 'bg-slate-200'}`} />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-900">{label}</span>
          <span className="text-sm font-mono text-slate-600 tabular-nums">{time}</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  subtitle,
  average,
  colorClass 
}: { 
  label: string
  value: string
  subtitle: string
  average?: string
  colorClass: string 
}) {
  const isPlaceholder = value === '— : — : —' || value === '-- : -- : --'
  
  return (
    <div className={`relative overflow-hidden rounded-xl p-5 ${colorClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent)]" />
      <p className="text-xs font-semibold tracking-wider uppercase opacity-80 mb-1">{label}</p>
      <p className={`text-3xl font-bold tracking-tight font-mono tabular-nums ${isPlaceholder ? 'opacity-40' : ''}`}>
        {value}
      </p>
      <p className="text-xs opacity-70 mt-1">{subtitle}</p>
      {average && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-xs opacity-70">
            Surgeon Avg: <span className="font-semibold font-mono">{average}</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CaseSummary({
  caseData,
  milestones,
  staff,
  implants = [],
  totalTime,
  surgicalTime,
  surgeonAverages
}: CaseSummaryProps) {
  
  // Sort milestones by display order, filter to only recorded ones
  const recordedMilestones = useMemo(() => {
    return milestones
      .filter(m => m.recordedAt)
      .sort((a, b) => {
        // Sort by actual recorded time
        const timeA = new Date(a.recordedAt!).getTime()
        const timeB = new Date(b.recordedAt!).getTime()
        return timeA - timeB
      })
  }, [milestones])

  const operativeSide = getOperativeSideLabel(caseData.operativeSide)
  
  // Format surgeon averages
  const formatAverage = (minutes: number | null): string | undefined => {
    if (!minutes) return undefined
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/cases" 
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{caseData.caseNumber}</h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Completed
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{formatDateLong(caseData.scheduledDate)}</p>
              </div>
            </div>
            
            {/* Print / Export buttons could go here */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Case Info & Team */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Case Information Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <SectionHeader 
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  title="Case Information"
                />
              </div>
              <div className="p-5">
                <DataRow label="Procedure" value={
                  <div className="text-right">
                    <span className="block">{caseData.procedure || '—'}</span>
                    {operativeSide && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-700">
                        {operativeSide}
                      </span>
                    )}
                  </div>
                } />
                <DataRow label="Room" value={caseData.room || '—'} />
                <DataRow label="Scheduled" value={formatScheduledTime(caseData.startTime)} mono />
              </div>
            </div>

            {/* Surgical Team Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <SectionHeader 
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  title="Surgical Team"
                />
              </div>
              <div className="p-5 space-y-4">
                {/* Surgeon */}
                <div className="flex items-center gap-3">
                  <SurgeonAvatar 
                    name={caseData.surgeon ? `${caseData.surgeon.firstName} ${caseData.surgeon.lastName}` : 'Unassigned'} 
                    size="md" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {caseData.surgeon ? `Dr. ${caseData.surgeon.lastName}` : 'Unassigned'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {caseData.surgeon?.firstName} {caseData.surgeon?.lastName}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
                    Surgeon
                  </span>
                </div>

                {/* Anesthesiologist */}
                {caseData.anesthesiologist && (
                  <div className="flex items-center gap-3">
                    <SurgeonAvatar 
                      name={`${caseData.anesthesiologist.firstName} ${caseData.anesthesiologist.lastName}`} 
                      size="md" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        Dr. {caseData.anesthesiologist.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {caseData.anesthesiologist.firstName} {caseData.anesthesiologist.lastName}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
                      Anesthesia
                    </span>
                  </div>
                )}

                {/* Other Staff */}
                {staff.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Additional Staff</p>
                    <div className="space-y-2">
                      {staff.map(member => (
                        <div key={member.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-slate-700">{member.name}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getRoleColor(member.role)}`}>
                            {member.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Card */}
            {caseData.notes && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <SectionHeader 
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    }
                    title="Case Notes"
                  />
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">{caseData.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Times & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Time Stats */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard 
                label="Total Case Time"
                value={totalTime}
                subtitle="Patient In → Patient Out"
                average={formatAverage(surgeonAverages?.avgTotalTime ?? null)}
                colorClass="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-600/20"
              />
              <StatCard 
                label="Surgical Time"
                value={surgicalTime}
                subtitle="Incision → Closing"
                average={formatAverage(surgeonAverages?.avgSurgicalTime ?? null)}
                colorClass="bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500 text-white shadow-lg shadow-blue-600/20"
              />
            </div>

            {/* Timeline Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <SectionHeader 
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="Case Timeline"
                  subtitle={`${recordedMilestones.length} milestones recorded`}
                />
              </div>
              <div className="p-5">
                {recordedMilestones.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-slate-500">No milestones were recorded for this case.</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {recordedMilestones.map((milestone, index) => {
                      const formatted = formatMilestoneTime(milestone.recordedAt)
                      return (
                        <TimelineItem 
                          key={milestone.id}
                          time={formatted.time}
                          label={milestone.displayName}
                          isFirst={index === 0}
                          isLast={index === recordedMilestones.length - 1}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Milestone Summary Table */}
            {recordedMilestones.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <SectionHeader 
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    }
                    title="Milestone Details"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Milestone</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recordedMilestones.map((milestone) => {
                        const formatted = formatMilestoneTime(milestone.recordedAt)
                        return (
                          <tr key={milestone.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className="text-sm font-medium text-slate-900">{milestone.displayName}</span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="text-sm font-mono text-slate-600 tabular-nums">{formatted.time}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Implants Card */}
            {implants.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <SectionHeader 
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    }
                    title="Implants Used"
                  />
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {implants.map(implant => (
                      <div key={implant.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{implant.component}</p>
                        <p className="text-lg font-bold text-slate-900">{implant.size}</p>
                        {implant.lot && (
                          <p className="text-xs text-slate-400 mt-1">Lot: {implant.lot}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Case ID: {caseData.id}</span>
            <span>Generated by ORbit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
