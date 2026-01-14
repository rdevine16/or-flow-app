// components/dashboard/EnhancedRoomCard.tsx
// Enhanced room card showing all scheduled cases for the room
// UPDATED: Added operative side badge display

'use client'

import Link from 'next/link'
import { RoomWithCase, CasePhase, EnhancedCase, getJoinedValue } from '../../types/pace'
import { useElapsedTime } from '../../hooks/useElapsedTime'
import { getRoomStatus } from '../../lib/pace-utils'
import SurgeonAvatar from '../ui/SurgeonAvatar'
import PhaseBadge from '../ui/PhaseBadge'
import StatusIndicator from '../ui/StatusIndicator'
import PaceProgressBar from './PaceProgressBar'

interface EnhancedRoomCardProps {
  roomWithCase: RoomWithCase
}

// Helper to format time for display
function formatTime(time: string | null): string {
  if (!time) return '--:--'
  try {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  } catch {
    return time
  }
}

// Helper to get surgeon display name
function getSurgeonName(surgeon: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null): string {
  const s = getJoinedValue(surgeon)
  if (!s) return 'Unassigned'
  return `Dr. ${s.last_name}`
}

// Helper to get full surgeon name for avatar
function getSurgeonFullName(surgeon: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null): string {
  const s = getJoinedValue(surgeon)
  if (!s) return 'Unassigned'
  return `${s.first_name} ${s.last_name}`
}

// Helper to get procedure name
function getProcedureName(procedureTypes: { name: string } | { name: string }[] | null): string {
  const p = getJoinedValue(procedureTypes)
  return p?.name || 'No procedure'
}

// Helper to get status name
function getStatusName(caseStatuses: { name: string } | { name: string }[] | null): string | null {
  const s = getJoinedValue(caseStatuses)
  return s?.name || null
}

// NEW: Operative Side Badge Component
function OperativeSideBadge({ side }: { side: string | null | undefined }) {
  if (!side || side === 'n/a') return null
  
  const config: Record<string, { label: string; color: string }> = {
    left: { label: 'L', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    right: { label: 'R', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    bilateral: { label: 'B', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  }
  
  const cfg = config[side]
  if (!cfg) return null
  
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// Elapsed Time Display Component
function ElapsedTimeDisplay({ startTime, isActive }: { startTime: Date | null; isActive: boolean }) {
  const { formattedTime } = useElapsedTime(startTime, isActive)
  
  if (!startTime) {
    return (
      <div className="text-right">
        <div className="text-lg font-bold font-mono text-slate-900">0:00</div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Starting</div>
      </div>
    )
  }
  
  return (
    <div className="text-right">
      <div className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
        {formattedTime}
      </div>
      <div className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">
        Elapsed
      </div>
    </div>
  )
}

// Scheduled Time Display Component
function ScheduledTimeDisplay({ time }: { time: string | null }) {
  return (
    <div className="text-right">
      <div className="text-lg font-semibold font-mono text-blue-600">
        {formatTime(time)}
      </div>
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
        Scheduled
      </div>
    </div>
  )
}

// Case row for the schedule list - matches primary case format
function CompactCaseRow({ caseItem }: { caseItem: EnhancedCase }) {
  const statusName = getStatusName(caseItem.case_statuses)
  const isCompleted = statusName === 'completed'
  
  return (
    <Link 
      href={`/cases/${caseItem.id}`}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors group ${
        isCompleted ? 'opacity-60' : ''
      }`}
    >
      {/* Surgeon Avatar */}
      <SurgeonAvatar name={getSurgeonFullName(caseItem.surgeon)} size="sm" />
      
      {/* Case Info */}
      <div className="flex-1 min-w-0">
        {/* UPDATED: Added operative side badge */}
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-semibold truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {getProcedureName(caseItem.procedure_types)}
          </h4>
          <OperativeSideBadge side={(caseItem as any).operative_side} />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">{getSurgeonName(caseItem.surgeon)}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-400">{caseItem.case_number}</span>
        </div>
      </div>
      
      {/* Time */}
      <div className="flex-shrink-0 text-right">
        <div className={`text-sm font-semibold font-mono ${isCompleted ? 'text-slate-400' : 'text-blue-600'}`}>
          {formatTime(caseItem.start_time)}
        </div>
        {isCompleted ? (
          <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-500 font-medium">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Done
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Scheduled</div>
        )}
      </div>
      
      {/* Chevron */}
      <svg 
        className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export default function EnhancedRoomCard({ roomWithCase }: EnhancedRoomCardProps) {
  const { room, currentCase, nextCase, upcomingCases, caseStartTime, currentPhase, paceData } = roomWithCase
  const status = getRoomStatus(currentCase, nextCase)
  const primaryCase = currentCase || nextCase
  const isActive = status === 'active'
  
  // Get other cases (exclude the primary case from the upcoming list)
  const otherCases = upcomingCases.filter(c => c.id !== primaryCase?.id)
  
  // Calculate total cases for the day
  const totalCases = upcomingCases.length + (currentCase ? 1 : 0)
  const completedCases = upcomingCases.filter(c => getStatusName(c.case_statuses) === 'completed').length + 
    (currentCase && getStatusName(currentCase.case_statuses) === 'completed' ? 1 : 0)
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
          {isActive && currentPhase && (
            <PhaseBadge phase={currentPhase} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalCases > 0 && (
            <span className="text-xs font-medium text-slate-400">
              {completedCases}/{totalCases} done
            </span>
          )}
          <StatusIndicator status={status} />
        </div>
      </div>
      
      {/* Primary Case Content */}
      <div className="p-4">
        {primaryCase ? (
          <Link href={`/cases/${primaryCase.id}`} className="block">
            {/* Primary case info row */}
            <div className="flex items-center gap-3">
              <SurgeonAvatar name={getSurgeonFullName(primaryCase.surgeon)} size="md" />
              
              <div className="flex-1 min-w-0">
                {/* UPDATED: Added operative side badge */}
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-slate-900 truncate">
                    {getProcedureName(primaryCase.procedure_types)}
                  </h4>
                  <OperativeSideBadge side={(primaryCase as any).operative_side} />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-medium">{getSurgeonName(primaryCase.surgeon)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">{primaryCase.case_number}</span>
                </div>
              </div>
              
              {/* Time display */}
              <div className="flex-shrink-0">
                {isActive ? (
                  <ElapsedTimeDisplay startTime={caseStartTime} isActive={true} />
                ) : (
                  <ScheduledTimeDisplay time={primaryCase.start_time} />
                )}
              </div>
              
              {/* Chevron */}
              <svg 
                className="w-5 h-5 text-slate-300 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            
            {/* Progress bar for active cases */}
            {isActive && paceData && (
              <div className="mt-4">
                <PaceProgressBar paceData={paceData} />
              </div>
            )}
          </Link>
        ) : (
          /* Empty state */
          <div className="flex items-center gap-3 py-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </div>
            <span className="text-sm text-slate-400 font-medium">No cases scheduled</span>
          </div>
        )}
      </div>
      
      {/* Upcoming Cases Section */}
      {otherCases.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-2 bg-slate-50/50">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {isActive ? 'Up Next' : 'Schedule'} ({otherCases.length})
            </p>
          </div>
          <div className="px-2 pb-2 max-h-72 overflow-y-auto">
            {otherCases.map((caseItem) => (
              <CompactCaseRow key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
