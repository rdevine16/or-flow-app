// components/dashboard/EnhancedRoomCard.tsx
// Enhanced room card showing all scheduled cases for the room
// WITH drag-and-drop staff assignment support

'use client'

import Link from 'next/link'
import { RoomWithCase, CasePhase, EnhancedCase, getJoinedValue } from '../../types/pace'
import { CaseStaffAssignment } from '../../types/staff-assignment'
import { useElapsedTime } from '../../hooks/useElapsedTime'
import { getRoomStatus } from '../../lib/pace-utils'
import SurgeonAvatar from '../ui/SurgeonAvatar'
import PhaseBadge from '../ui/PhaseBadge'
import StatusIndicator from '../ui/StatusIndicator'
import PaceProgressBar from './PaceProgressBar'
import DroppableCaseRow from './DroppableCaseRow'
import { AssignedStaffAvatar, GroupedStaffTooltip } from '../ui/StaffAvatar'

interface EnhancedRoomCardProps {
  roomWithCase: RoomWithCase
  // Staff assignment props
  assignmentsByCaseId?: Record<string, CaseStaffAssignment[]>
  onRemoveStaff?: (assignmentId: string, caseId: string, isFaded: boolean, isInProgress: boolean) => void
  canManageStaff?: boolean
  dropZonesEnabled?: boolean
  // NEW: Hide completed cases
  hideCompleted?: boolean
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

// Operative Side Badge Component
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

// Called Back Badge
function CalledBackBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
      Go Back
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

// Inline assigned staff avatars - for "Up Next" / active cases (individual tooltips)
function InlineAssignedStaff({
  assignments,
  maxVisible = 4,
  onRemove,
  canManageStaff = false,
  dropZonesEnabled = false
}: {
  assignments: CaseStaffAssignment[]
  maxVisible?: number
  onRemove?: (assignmentId: string, isFaded: boolean) => void
  canManageStaff?: boolean
  dropZonesEnabled?: boolean
}) {
  // Show active assignments first, then faded ones
  const activeAssignments = assignments.filter(a => a.removed_at === null)
  const fadedAssignments = assignments.filter(a => a.removed_at !== null)
  const allAssignments = [...activeAssignments, ...fadedAssignments]
  const visibleAssignments = allAssignments.slice(0, maxVisible)
  const overflowCount = allAssignments.length - maxVisible
  
  if (allAssignments.length === 0) return null
  
  return (
    <div className="flex items-center -space-x-1.5">
      {visibleAssignments.map((assignment) => (
        <AssignedStaffAvatar
          key={assignment.id}
          firstName={assignment.user?.first_name || '?'}
          lastName={assignment.user?.last_name || '?'}
          profileImageUrl={assignment.user?.profile_image_url}
          roleName={assignment.user_roles?.name}
          isFaded={assignment.removed_at !== null}
          onRemove={dropZonesEnabled && canManageStaff && onRemove ? () => onRemove(assignment.id, assignment.removed_at !== null) : undefined}
          canRemove={dropZonesEnabled && canManageStaff}
          showTooltip={true} // Individual tooltips for "Up Next" case
        />
      ))}
      
      {overflowCount > 0 && (
        <div className="
          w-9 h-9 rounded-full 
          bg-slate-200 border-2 border-white
          flex items-center justify-center
          text-xs font-semibold text-slate-600
          z-10
        ">
          +{overflowCount}
        </div>
      )}
    </div>
  )
}

// NEW: Inline assigned staff with GROUPED tooltip - for scheduled cases
function InlineAssignedStaffGrouped({
  assignments,
  maxVisible = 4,
  onRemove,
  canManageStaff = false,
  dropZonesEnabled = false
}: {
  assignments: CaseStaffAssignment[]
  maxVisible?: number
  onRemove?: (assignmentId: string, isFaded: boolean) => void
  canManageStaff?: boolean
  dropZonesEnabled?: boolean
}) {
  // Show active assignments first, then faded ones
  const activeAssignments = assignments.filter(a => a.removed_at === null)
  const fadedAssignments = assignments.filter(a => a.removed_at !== null)
  const allAssignments = [...activeAssignments, ...fadedAssignments]
  const visibleAssignments = allAssignments.slice(0, maxVisible)
  const overflowCount = allAssignments.length - maxVisible
  
  if (allAssignments.length === 0) return null
  
  // Build staff list for grouped tooltip
  const staffList = allAssignments.map(a => ({
    firstName: a.user?.first_name || '?',
    lastName: a.user?.last_name || '?',
    roleName: a.user_roles?.name,
    isFaded: a.removed_at !== null
  }))
  
  return (
    <GroupedStaffTooltip staffList={staffList}>
      <div className="flex items-center -space-x-1.5">
        {visibleAssignments.map((assignment) => (
          <AssignedStaffAvatar
            key={assignment.id}
            firstName={assignment.user?.first_name || '?'}
            lastName={assignment.user?.last_name || '?'}
            profileImageUrl={assignment.user?.profile_image_url}
            roleName={assignment.user_roles?.name}
            isFaded={assignment.removed_at !== null}
            onRemove={dropZonesEnabled && canManageStaff && onRemove ? () => onRemove(assignment.id, assignment.removed_at !== null) : undefined}
            canRemove={dropZonesEnabled && canManageStaff}
            showTooltip={false} // NO individual tooltips - use grouped
          />
        ))}
        
        {overflowCount > 0 && (
          <div className="
            w-9 h-9 rounded-full 
            bg-slate-200 border-2 border-white
            flex items-center justify-center
            text-xs font-semibold text-slate-600
            z-10
          ">
            +{overflowCount}
          </div>
        )}
      </div>
    </GroupedStaffTooltip>
  )
}

// Case row for the schedule list - uses GROUPED tooltip
function CompactCaseRow({ 
  caseItem,
  assignments,
  onRemoveStaff,
  canManageStaff,
  dropZonesEnabled
}: { 
  caseItem: EnhancedCase
  assignments: CaseStaffAssignment[]
  onRemoveStaff?: (assignmentId: string, caseId: string, isFaded: boolean, isInProgress: boolean) => void
  canManageStaff?: boolean
  dropZonesEnabled?: boolean
}) {
  const statusName = getStatusName(caseItem.case_statuses)
  const isCompleted = statusName === 'completed'
  const isInProgress = statusName === 'in_progress'
  
  const content = (
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
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {getProcedureName(caseItem.procedure_types)}
          </span>
          <OperativeSideBadge side={(caseItem as any).operative_side} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium truncate">{getSurgeonName(caseItem.surgeon)}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-400 truncate">{caseItem.case_number}</span>
        </div>
      </div>
      
      {/* Assigned Staff with GROUPED tooltip */}
      {assignments.length > 0 && (
        <InlineAssignedStaffGrouped 
          assignments={assignments}
          maxVisible={3}
          onRemove={(assignmentId, isFaded) => {
            onRemoveStaff?.(assignmentId, caseItem.id, isFaded, isInProgress)
          }}
          canManageStaff={canManageStaff}
          dropZonesEnabled={dropZonesEnabled}
        />
      )}
      
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
  
  // Wrap in droppable if enabled
  if (dropZonesEnabled && canManageStaff) {
    return (
      <DroppableCaseRow
        caseId={caseItem.id}
        caseNumber={caseItem.case_number}
        isActive={isInProgress}
        isCompleted={isCompleted}
      >
        {content}
      </DroppableCaseRow>
    )
  }
  
  return content
}

export default function EnhancedRoomCard({ 
  roomWithCase,
  assignmentsByCaseId = {},
  onRemoveStaff,
  canManageStaff = false,
  dropZonesEnabled = false,
  hideCompleted = false // NEW prop
}: EnhancedRoomCardProps) {
  const { room, currentCase, nextCase, upcomingCases, caseStartTime, currentPhase, paceData } = roomWithCase
  const status = getRoomStatus(currentCase, nextCase)
  const primaryCase = currentCase || nextCase
  const isActive = status === 'active'
  
  // Check if the next case has been called back
  const nextCaseCalledBack = !currentCase && nextCase && (nextCase as any).called_back_at
  
  // Get other cases (exclude the primary case from the upcoming list)
  // NEW: Filter out completed cases if hideCompleted is true
  const otherCases = upcomingCases
    .filter(c => c.id !== primaryCase?.id)
    .filter(c => {
      if (!hideCompleted) return true
      const statusName = getStatusName(c.case_statuses)
      return statusName !== 'completed'
    })
  
  // Calculate total cases for the day (respect hideCompleted for display)
  const allCasesForCount = hideCompleted 
    ? upcomingCases.filter(c => getStatusName(c.case_statuses) !== 'completed')
    : upcomingCases
  const totalCases = allCasesForCount.length + (currentCase ? 1 : 0)
  const completedCases = upcomingCases.filter(c => getStatusName(c.case_statuses) === 'completed').length + 
    (currentCase && getStatusName(currentCase.case_statuses) === 'completed' ? 1 : 0)
  
  // Get assignments for primary case
  const primaryCaseAssignments = primaryCase ? (assignmentsByCaseId[primaryCase.id] || []) : []
  const primaryStatusName = primaryCase ? getStatusName(primaryCase.case_statuses) : null
  const isPrimaryInProgress = primaryStatusName === 'in_progress'
  const isPrimaryCompleted = primaryStatusName === 'completed'
  
  // If primary case is completed and hideCompleted, don't show it prominently
  // Instead, show the next non-completed case
  const shouldShowPrimary = !hideCompleted || !isPrimaryCompleted
  
  // Primary case content (the main case displayed prominently) - uses INDIVIDUAL tooltips
  const primaryCaseContent = primaryCase && shouldShowPrimary ? (
    <Link href={`/cases/${primaryCase.id}`} className="block">
      {/* Primary case info row */}
      <div className="flex items-center gap-3">
        <SurgeonAvatar name={getSurgeonFullName(primaryCase.surgeon)} size="md" />
        
        <div className="flex-1 min-w-0">
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
        
        {/* Assigned Staff Avatars - Individual tooltips for primary/up-next case */}
        {primaryCaseAssignments.length > 0 && (
          <InlineAssignedStaff 
            assignments={primaryCaseAssignments}
            maxVisible={4}
            onRemove={(assignmentId, isFaded) => {
              onRemoveStaff?.(assignmentId, primaryCase.id, isFaded, isPrimaryInProgress)
            }}
            canManageStaff={canManageStaff}
            dropZonesEnabled={dropZonesEnabled}
          />
        )}
        
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
    /* Empty state or completed state */
    <div className="flex items-center gap-3 py-2">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </div>
      <span className="text-sm text-slate-400 font-medium">
        {hideCompleted && isPrimaryCompleted ? 'All cases completed' : 'No cases scheduled'}
      </span>
    </div>
  )
  
  return (
    <div 
      className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
        nextCaseCalledBack 
          ? 'border-2 border-amber-400 animate-pulse-border' 
          : 'border border-slate-200/80'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        nextCaseCalledBack 
          ? 'bg-amber-50/80 border-amber-200' 
          : 'bg-slate-50/80 border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
          {isActive && currentPhase && (
            <PhaseBadge phase={currentPhase} />
          )}
          {nextCaseCalledBack && (
            <CalledBackBadge />
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalCases > 0 && (
            <span className="text-xs font-medium text-slate-400">
              {completedCases}/{totalCases + (hideCompleted ? completedCases : 0)} done
            </span>
          )}
          <StatusIndicator status={status} />
        </div>
      </div>
      
      {/* Primary Case Content - with drop zone support */}
      <div className="p-4">
        {dropZonesEnabled && canManageStaff && primaryCase && shouldShowPrimary ? (
          <DroppableCaseRow
            caseId={primaryCase.id}
            caseNumber={primaryCase.case_number}
            isActive={isPrimaryInProgress}
            isCompleted={isPrimaryCompleted}
          >
            {primaryCaseContent}
          </DroppableCaseRow>
        ) : (
          primaryCaseContent
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
          {/* Added pt-2 for tooltip space, changed overflow to clip only horizontally */}
          <div className="px-2 pb-2 pt-2 max-h-80 overflow-y-auto overflow-x-visible">
            {otherCases.map((caseItem) => (
              <CompactCaseRow 
                key={caseItem.id} 
                caseItem={caseItem}
                assignments={assignmentsByCaseId[caseItem.id] || []}
                onRemoveStaff={onRemoveStaff}
                canManageStaff={canManageStaff}
                dropZonesEnabled={dropZonesEnabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}