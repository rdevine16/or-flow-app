'use client'

// ============================================================================
// COMPLETED CASE VIEW - Compact Inline Component
// ============================================================================
// This renders INSIDE your existing page layout (DashboardLayout stays)
// Use it like: {isCompleted ? <CompletedCaseView ... /> : <EditableView />}

import SurgeonAvatar from '../ui/SurgeonAvatar'

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
  totalTime: string
  surgicalTime: string
  surgeonAverages?: {
    avgTotalTime: number | null
    avgSurgicalTime: number | null
  }
}

// Format milestone time with seconds
function formatMilestoneTime(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`
}

// Get role badge color
function getRoleBadgeClass(role: string): string {
  const colors: Record<string, string> = {
    surgeon: 'bg-blue-100 text-blue-700',
    anesthesiologist: 'bg-amber-100 text-amber-700',
    nurse: 'bg-emerald-100 text-emerald-700',
    tech: 'bg-purple-100 text-purple-700',
  }
  return colors[role] || 'bg-slate-100 text-slate-600'
}

// Operative side badge
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

export default function CompletedCaseView({
  caseData,
  surgeon,
  anesthesiologist,
  milestones,
  staff,
  totalTime,
  surgicalTime,
  surgeonAverages,
}: CompletedCaseViewProps) {
  
  // Sort milestones by recorded time
  const recordedMilestones = milestones
    .filter(m => m.recordedAt)
    .sort((a, b) => new Date(a.recordedAt!).getTime() - new Date(b.recordedAt!).getTime())

  // Format average time
  const formatAvg = (mins: number | null) => {
    if (!mins) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}:${m.toString().padStart(2, '0')}:00`
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Time Cards + Case Info */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Total Time */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 rounded-xl p-4 text-white shadow-lg shadow-emerald-600/20">
          <p className="text-emerald-100 text-[10px] font-semibold tracking-wider uppercase">Total Time</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">{totalTime}</p>
          <p className="text-emerald-200 text-[10px] mt-1">Patient In → Out</p>
          {surgeonAverages?.avgTotalTime && (
            <p className="text-emerald-200 text-[10px] mt-2 pt-2 border-t border-emerald-400/30">
              Avg: <span className="text-white font-mono">{formatAvg(surgeonAverages.avgTotalTime)}</span>
            </p>
          )}
        </div>

        {/* Surgical Time */}
        <div className="bg-gradient-to-br from-blue-600 to-sky-500 rounded-xl p-4 text-white shadow-lg shadow-blue-600/20">
          <p className="text-blue-100 text-[10px] font-semibold tracking-wider uppercase">Surgical Time</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">{surgicalTime}</p>
          <p className="text-blue-200 text-[10px] mt-1">Incision → Closing</p>
          {surgeonAverages?.avgSurgicalTime && (
            <p className="text-blue-200 text-[10px] mt-2 pt-2 border-t border-blue-400/30">
              Avg: <span className="text-white font-mono">{formatAvg(surgeonAverages.avgSurgicalTime)}</span>
            </p>
          )}
        </div>

        {/* Case Details */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Procedure</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-semibold text-slate-900">{caseData.procedure || '—'}</p>
                <OperativeSideBadge side={caseData.operativeSide} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Room</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{caseData.room || '—'}</p>
            </div>
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

      {/* Middle Row: Timeline + Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Milestone Timeline - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Case Timeline</h3>
            <span className="text-xs text-slate-500">{recordedMilestones.length} milestones</span>
          </div>
          
          {recordedMilestones.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No milestones recorded</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {recordedMilestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-xs text-slate-600 truncate pr-2">{m.displayName}</span>
                  <span className="text-xs font-mono text-slate-900 tabular-nums whitespace-nowrap">
                    {formatMilestoneTime(m.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff List */}
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

      {/* Notes (only if present) */}
      {caseData.notes && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
          <p className="text-sm text-slate-600">{caseData.notes}</p>
        </div>
      )}
    </div>
  )
}
