// components/dashboard/EnhancedRoomCard.tsx
// Enhanced room card with progress bar, elapsed time, and professional styling

'use client'

import Link from 'next/link'
import { RoomWithCase, CasePhase, EnhancedCase } from '../../types/pace'
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
function getSurgeonName(surgeon: { first_name: string; last_name: string } | null): string {
  if (!surgeon) return 'Unassigned'
  return `Dr. ${surgeon.last_name}`
}

// Helper to get procedure name
function getProcedureName(procedureTypes: { name: string } | null): string {
  return procedureTypes?.name || 'No procedure'
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

export default function EnhancedRoomCard({ roomWithCase }: EnhancedRoomCardProps) {
  const { room, currentCase, nextCase, caseStartTime, currentPhase, paceData } = roomWithCase
  const status = getRoomStatus(currentCase, nextCase)
  const displayCase = currentCase || nextCase
  const isActive = status === 'active'
  
  // Card content
  const cardContent = (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
          {isActive && currentPhase && (
            <PhaseBadge phase={currentPhase} />
          )}
        </div>
        <StatusIndicator status={status} />
      </div>
      
      {/* Content */}
      <div className="p-4">
        {displayCase ? (
          <>
            {/* Case info row */}
            <div className="flex items-center gap-3">
              <SurgeonAvatar name={getSurgeonName(displayCase.surgeon)} size="md" />
              
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-slate-900 truncate">
                  {getProcedureName(displayCase.procedure_types)}
                </h4>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-medium">{getSurgeonName(displayCase.surgeon)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">{displayCase.case_number}</span>
                </div>
              </div>
              
              {/* Time display */}
              <div className="flex-shrink-0">
                {isActive ? (
                  <ElapsedTimeDisplay startTime={caseStartTime} isActive={true} />
                ) : (
                  <ScheduledTimeDisplay time={displayCase.start_time} />
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
          </>
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
    </div>
  )
  
  // Wrap in link if there's a case
  if (displayCase) {
    return (
      <Link href={`/cases/${displayCase.id}`} className="block">
        {cardContent}
      </Link>
    )
  }
  
  return cardContent
}
