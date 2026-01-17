// components/dashboard/DroppableCaseRow.tsx
// Wrapper component that makes a case row a valid drop target

'use client'

import { ReactNode } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { CaseStaffAssignment, DragData, DropData } from '../../types/staff-assignment'
import { AssignedStaffAvatar } from '../ui/StaffAvatar'

interface DroppableCaseRowProps {
  caseId: string
  caseNumber: string
  isActive: boolean  // Whether case is in_progress
  isCompleted: boolean
  children: ReactNode
  assignments: CaseStaffAssignment[]
  onRemoveStaff: (assignmentId: string, isFaded: boolean) => void
  canManageStaff: boolean
  dropZonesEnabled: boolean
}

export default function DroppableCaseRow({
  caseId,
  caseNumber,
  isActive,
  isCompleted,
  children,
  assignments,
  onRemoveStaff,
  canManageStaff,
  dropZonesEnabled
}: DroppableCaseRowProps) {
  const dropData: DropData = {
    type: 'case-row',
    caseId,
    caseNumber
  }
  
  const { isOver, setNodeRef, active } = useDroppable({
    id: `case-${caseId}`,
    data: dropData,
    disabled: !dropZonesEnabled || isCompleted
  })
  
  // Determine if this is a valid drop target
  const isDragActive = active !== null
  const isValidDrop = dropZonesEnabled && !isCompleted && isDragActive
  
  // Separate active and faded (removed) assignments
  const activeAssignments = assignments.filter(a => a.removed_at === null)
  const fadedAssignments = assignments.filter(a => a.removed_at !== null)
  
  return (
    <div
      ref={setNodeRef}
      className={`
        relative
        transition-all duration-200
        ${isOver && isValidDrop
          ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50 scale-[1.02] rounded-xl' 
          : ''
        }
        ${isValidDrop && !isOver
          ? 'ring-1 ring-blue-200 ring-offset-1 rounded-xl'
          : ''
        }
        ${isCompleted && isDragActive
          ? 'opacity-50 cursor-not-allowed'
          : ''
        }
      `}
    >
      {/* Original case row content */}
      {children}
      
      {/* Assigned Staff Avatars - shown below or inline with the case info */}
      {(activeAssignments.length > 0 || fadedAssignments.length > 0) && (
        <AssignedStaffRow
          activeAssignments={activeAssignments}
          fadedAssignments={fadedAssignments}
          caseId={caseId}
          isInProgress={isActive}
          onRemove={onRemoveStaff}
          canManageStaff={canManageStaff}
          dropZonesEnabled={dropZonesEnabled}
        />
      )}
      
      {/* Drop indicator */}
      {isOver && isValidDrop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-lg">
            Drop to assign
          </div>
        </div>
      )}
    </div>
  )
}

// Row of assigned staff avatars
function AssignedStaffRow({
  activeAssignments,
  fadedAssignments,
  caseId,
  isInProgress,
  onRemove,
  canManageStaff,
  dropZonesEnabled
}: {
  activeAssignments: CaseStaffAssignment[]
  fadedAssignments: CaseStaffAssignment[]
  caseId: string
  isInProgress: boolean
  onRemove: (assignmentId: string, isFaded: boolean) => void
  canManageStaff: boolean
  dropZonesEnabled: boolean
}) {
  if (activeAssignments.length === 0 && fadedAssignments.length === 0) {
    return null
  }
  
  return (
    <div className="flex items-center gap-1 mt-2 ml-14 flex-wrap">
      {/* Active assignments */}
      {activeAssignments.map((assignment) => (
        <DraggableAssignedAvatar
          key={assignment.id}
          assignment={assignment}
          caseId={caseId}
          isFaded={false}
          isInProgress={isInProgress}
          onRemove={() => onRemove(assignment.id, false)}
          canManageStaff={canManageStaff}
          dropZonesEnabled={dropZonesEnabled}
        />
      ))}
      
      {/* Faded (removed) assignments */}
      {fadedAssignments.map((assignment) => (
        <AssignedStaffAvatar
          key={assignment.id}
          firstName={assignment.user?.first_name || '?'}
          lastName={assignment.user?.last_name || '?'}
          profileImageUrl={assignment.user?.profile_image_url}
          roleName={assignment.user_roles?.name}
          isFaded={true}
          onRemove={() => onRemove(assignment.id, true)}
          canRemove={canManageStaff}
        />
      ))}
    </div>
  )
}

// Draggable avatar for assigned staff (can be moved to another case)
function DraggableAssignedAvatar({
  assignment,
  caseId,
  isFaded,
  isInProgress,
  onRemove,
  canManageStaff,
  dropZonesEnabled
}: {
  assignment: CaseStaffAssignment
  caseId: string
  isFaded: boolean
  isInProgress: boolean
  onRemove: () => void
  canManageStaff: boolean
  dropZonesEnabled: boolean
}) {
  const staffMember = assignment.user
  if (!staffMember) return null
  
  // Create drag data for moving between cases
  const dragData: DragData = {
    type: 'staff-avatar',
    staffId: assignment.user_id,
    staff: {
      id: staffMember.id,
      first_name: staffMember.first_name,
      last_name: staffMember.last_name,
      profile_image_url: staffMember.profile_image_url,
      email: '',
      role_id: assignment.role_id,
      facility_id: '',
      user_roles: assignment.user_roles
    },
    sourceType: 'case',
    sourceCaseId: caseId
  }
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `case-${caseId}-staff-${assignment.user_id}`,
    data: dragData,
    disabled: !dropZonesEnabled || !canManageStaff || isFaded
  })
  
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : undefined
  } : undefined
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        ${isDragging ? 'opacity-50' : ''}
        ${dropZonesEnabled && canManageStaff && !isFaded ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      <AssignedStaffAvatar
        firstName={staffMember.first_name}
        lastName={staffMember.last_name}
        profileImageUrl={staffMember.profile_image_url}
        roleName={assignment.user_roles?.name}
        isFaded={isFaded}
        onRemove={onRemove}
        canRemove={canManageStaff}
      />
    </div>
  )
}

// Inline assigned avatars for compact display (used in room cards)
export function InlineAssignedStaff({
  assignments,
  maxVisible = 4,
  onRemove,
  canManageStaff
}: {
  assignments: CaseStaffAssignment[]
  maxVisible?: number
  onRemove?: (assignmentId: string, isFaded: boolean) => void
  canManageStaff?: boolean
}) {
  const activeAssignments = assignments.filter(a => a.removed_at === null)
  const visibleAssignments = activeAssignments.slice(0, maxVisible)
  const overflowCount = activeAssignments.length - maxVisible
  
  if (activeAssignments.length === 0) return null
  
  return (
    <div className="flex items-center -space-x-2">
      {visibleAssignments.map((assignment) => (
        <AssignedStaffAvatar
          key={assignment.id}
          firstName={assignment.user?.first_name || '?'}
          lastName={assignment.user?.last_name || '?'}
          profileImageUrl={assignment.user?.profile_image_url}
          roleName={assignment.user_roles?.name}
          isFaded={assignment.removed_at !== null}
          onRemove={onRemove ? () => onRemove(assignment.id, assignment.removed_at !== null) : undefined}
          canRemove={canManageStaff}
        />
      ))}
      
      {overflowCount > 0 && (
        <div className="
          w-9 h-9 rounded-full 
          bg-slate-200 border-2 border-white
          flex items-center justify-center
          text-xs font-semibold text-slate-600
        ">
          +{overflowCount}
        </div>
      )}
    </div>
  )
}