// components/dashboard/EnhancedRoomGridView.tsx
// Grid view for displaying room cards with case information
// Supports drag-and-drop staff assignment and hide completed filter

'use client'

import { RoomWithCase } from '../../types/pace'
import { CaseStaffAssignment } from '../../types/staff-assignment'
import EnhancedRoomCard from './EnhancedRoomCard'

interface EnhancedRoomGridViewProps {
  roomsWithCases: RoomWithCase[]
  loading: boolean
  // Staff assignment props
  assignmentsByCaseId?: Record<string, CaseStaffAssignment[]>
  onRemoveStaff?: (assignmentId: string, caseId: string, isFaded: boolean, isInProgress: boolean) => void
  canManageStaff?: boolean
  dropZonesEnabled?: boolean
  // NEW: Hide completed cases
  hideCompleted?: boolean
}

export default function EnhancedRoomGridView({ 
  roomsWithCases, 
  loading,
  assignmentsByCaseId = {},
  onRemoveStaff,
  canManageStaff = false,
  dropZonesEnabled = false,
  hideCompleted = false
}: EnhancedRoomGridViewProps) {
  if (loading) {
    return <RoomGridSkeleton />
  }
  
  if (roomsWithCases.length === 0) {
    return <EmptyRoomsState />
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {roomsWithCases.map((roomWithCase) => (
        <EnhancedRoomCard 
          key={roomWithCase.room.id} 
          roomWithCase={roomWithCase}
          // Pass through staff assignment props
          assignmentsByCaseId={assignmentsByCaseId}
          onRemoveStaff={onRemoveStaff}
          canManageStaff={canManageStaff}
          dropZonesEnabled={dropZonesEnabled}
          // Pass through hide completed prop
          hideCompleted={hideCompleted}
        />
      ))}
    </div>
  )
}

// Skeleton loading state
function RoomGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div 
          key={i}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"
        >
          {/* Header skeleton */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="h-6 w-24 bg-slate-200 rounded" />
            <div className="h-6 w-20 bg-slate-200 rounded-full" />
          </div>
          
          {/* Content skeleton */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>
              <div className="text-right space-y-1">
                <div className="h-5 w-16 bg-slate-200 rounded ml-auto" />
                <div className="h-3 w-12 bg-slate-100 rounded ml-auto" />
              </div>
            </div>
            
            {/* Progress bar skeleton */}
            <div className="mt-4 space-y-2">
              <div className="h-1.5 bg-slate-100 rounded-full" />
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Empty state
function EmptyRoomsState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">No Operating Rooms</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        No operating rooms have been set up for this facility yet. Add rooms in Settings to get started.
      </p>
    </div>
  )
}