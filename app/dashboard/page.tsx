// app/dashboard/page.tsx
// Enhanced dashboard with pace tracking, polished room cards, Call Next Patient FAB,
// and drag-and-drop staff assignment
// UPDATED: Now uses median-based statistics from surgeon_procedure_stats and surgeon_milestone_stats

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useUser } from '../../lib/UserContext'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import CaseListView from '../../components/dashboard/CaseListView'
import EnhancedRoomGridView from '../../components/dashboard/EnhancedRoomGridView'
import FloatingActionButton from '../../components/ui/FloatingActionButton'
import CallNextPatientModal from '../../components/CallNextPatientModal'
import { getLocalDateString, formatDateWithWeekday } from '../../lib/date-utils'
import { getImpersonationState } from '../../lib/impersonation'
import RoomOrderModal from '../../components/dashboard/RoomOrderModal'
import { 
  RoomWithCase, 
  EnhancedCase, 
  CasePaceData, 
  CasePhase,
  MilestoneWithType,
  getJoinedValue
} from '../../types/pace'
import { determinePhase, parseISODate, parseScheduledStartTime } from '../../lib/pace-utils'

// DnD Kit imports for drag-and-drop staff assignment
import { 
  DndContext, 
  DragStartEvent, 
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin
} from '@dnd-kit/core'

// Staff assignment imports
import StaffAssignmentPanel from '../../components/dashboard/StaffAssignmentPanel'
import StaffDragOverlay from '../../components/dashboard/StaffDragOverlay'
import { useStaffAssignment } from '../../hooks/useStaffAssignment'
import { DragData, DropData } from '../../types/staff-assignment'

interface Room {
  id: string
  name: string
}

// Helper to get name from joined data
const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  const joined = getJoinedValue(data)
  return joined?.name || null
}

export default function DashboardPage() {
  const router = useRouter()
  const { isGlobalAdmin, isImpersonating, loading: userLoading, isAdmin } = useUser()
  
  // Redirect global admins (not impersonating) to admin page
  useEffect(() => {
    if (!userLoading && isGlobalAdmin && !isImpersonating) {
      router.replace('/admin')
    }
  }, [userLoading, isGlobalAdmin, isImpersonating, router])

  const [cases, setCases] = useState<EnhancedCase[]>([])
  const [roomsWithCases, setRoomsWithCases] = useState<RoomWithCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [todayDate, setTodayDate] = useState('')
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)
  const [roomsCollapsed, setRoomsCollapsed] = useState(false)
  
  // User info for Call Next Patient modal
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Call Next Patient modal state
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)
  
  // NEW: Hide completed cases toggle (default: checked = hide completed)
  const [hideCompleted, setHideCompleted] = useState(true)
  
  // Room reorder modal state
  const [showRoomOrderModal, setShowRoomOrderModal] = useState(false)
  
  const supabase = createClient()

  // Staff Assignment State
  const [showStaffPanel, setShowStaffPanel] = useState(false)
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null)
  
  // Check if user can manage staff
  const canManageStaff = isAdmin
  
  // Get all case IDs for the staff assignment hook
  const allCaseIds = useMemo(() => {
    return cases.map(c => c.id)
  }, [cases])
  
  // Staff assignment hook
  const {
    facilityStaff,
    staffLoading,
    assignmentsByCaseId,
    assignStaffToCase,
    removeStaffFromCase,
    permanentlyRemoveStaff,
    moveStaffBetweenCases
  } = useStaffAssignment({
    facilityId: userFacilityId,
    caseIds: allCaseIds
  })
  
  // DnD Kit Sensors Configuration
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  })
  
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 8,
    },
  })
  
  const sensors = useSensors(mouseSensor, touchSensor)
  
  // Drag Event Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData
    if (data?.type === 'staff-avatar') {
      setActiveDragData(data)
    }
  }, [])
  
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragData(null)
    
    if (!over) return
    
    const dragData = active.data.current as DragData
    const dropData = over.data.current as DropData
    
    if (dragData?.type !== 'staff-avatar' || dropData?.type !== 'case-row') {
      return
    }
    
    const { staffId, staff, sourceType, sourceCaseId } = dragData
    const { caseId: targetCaseId } = dropData
    
    if (sourceType === 'case' && sourceCaseId === targetCaseId) {
      return
    }
    
    try {
      if (sourceType === 'case' && sourceCaseId) {
        await moveStaffBetweenCases(staffId, sourceCaseId, targetCaseId, staff.role_id)
      } else {
        await assignStaffToCase(staffId, targetCaseId, staff.role_id)
      }
    } catch (error) {
      console.error('Error handling drop:', error)
    }
  }, [assignStaffToCase, moveStaffBetweenCases])
  
  // Staff Removal Handler
  const handleRemoveStaff = useCallback(async (
    assignmentId: string, 
    caseId: string,
    isFaded: boolean,
    isInProgress: boolean
  ) => {
    if (isFaded) {
      await permanentlyRemoveStaff(assignmentId, caseId)
    } else {
      await removeStaffFromCase(assignmentId, caseId, isInProgress)
    }
  }, [permanentlyRemoveStaff, removeStaffFromCase])

  // Initialize with today's date and fetch user's facility
  useEffect(() => {
    const today = getLocalDateString()
    setTodayDate(today)
    setSelectedDate(today)
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const impersonation = getImpersonationState()
    if (impersonation) {
      setUserFacilityId(impersonation.facilityId)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email || null)
      }
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      setUserEmail(user.email || null)
      
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userData?.facility_id) {
        setUserFacilityId(userData.facility_id)
      }
    }
  }

  // Fetch pace data for a specific case
  // UPDATED: Now uses median-based statistics from surgeon_procedure_stats and surgeon_milestone_stats
  const fetchPaceData = useCallback(async (
    surgeonId: string,
    procedureTypeId: string,
    currentMilestoneName: string,
    scheduledStart: Date,
    facilityId: string
  ): Promise<CasePaceData | null> => {
    try {
      // Query median-based procedure stats (always needed for total duration)
      const { data: procStats } = await supabase
        .from('surgeon_procedure_stats')
        .select('median_duration, p25_duration, p75_duration, sample_size')
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureTypeId)
        .eq('facility_id', facilityId)
        .single()
      
      if (!procStats) return null
      
      // Special case: patient_in is the START of the case
      // Progress = 0%, but we still show expected total duration
      if (currentMilestoneName === 'patient_in') {
        return {
          scheduledStart,
          expectedMinutesToMilestone: 0,
          milestoneRangeLow: 0,
          milestoneRangeHigh: 0,
          expectedTotalMinutes: procStats.median_duration,
          totalRangeLow: procStats.p25_duration,
          totalRangeHigh: procStats.p75_duration,
          sampleSize: procStats.sample_size,
          currentMilestoneName
        }
      }
      
// For all other milestones, get the milestone stats
      // Get the milestone type ID via facility_milestones
      const { data: facilityMilestone } = await supabase
        .from('facility_milestones')
        .select('id, name, source_milestone_type_id')
        .eq('facility_id', facilityId)
        .eq('name', currentMilestoneName)
        .single()
      
      // If no source_milestone_type_id, this is a custom milestone without stats
      if (!facilityMilestone?.source_milestone_type_id) return null
      
      // Query median-based milestone stats using the source milestone type
      const { data: msStats } = await supabase
        .from('surgeon_milestone_stats')
        .select('median_minutes_from_start, p25_minutes_from_start, p75_minutes_from_start, sample_size')
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureTypeId)
        .eq('milestone_type_id', facilityMilestone.source_milestone_type_id)
        .eq('facility_id', facilityId)
        .single()
      
      if (!msStats) return null
      
      return {
        scheduledStart,
        expectedMinutesToMilestone: msStats.median_minutes_from_start,
        milestoneRangeLow: msStats.p25_minutes_from_start,
        milestoneRangeHigh: msStats.p75_minutes_from_start,
        expectedTotalMinutes: procStats.median_duration,
        totalRangeLow: procStats.p25_duration,
        totalRangeHigh: procStats.p75_duration,
        sampleSize: Math.min(procStats.sample_size, msStats.sample_size),
        currentMilestoneName
      }
    } catch (error) {
      console.error('Error fetching pace data:', error)
      return null
    }
  }, [supabase])

  // Main data fetch
  useEffect(() => {
    async function fetchData() {
      if (!selectedDate || !userFacilityId) return

      setLoading(true)

      try {
        const { data: casesData } = await supabase
          .from('cases')
          .select(`
            id,
            case_number,
            scheduled_date,
            start_time,
            operative_side,
            facility_id,
            or_room_id,
            procedure_type_id,
            surgeon_id,
            called_back_at,
            or_rooms (name),
            procedure_types (name),
            case_statuses (name),
            surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
          `)
          .eq('facility_id', userFacilityId)
          .eq('scheduled_date', selectedDate)
          .order('start_time', { ascending: true, nullsFirst: false })

        const { data: roomsData } = await supabase
          .from('or_rooms')
          .select('id, name, display_order')
          .eq('facility_id', userFacilityId)
          .is('deleted_at', null)
          .order('display_order', { ascending: true })

        const fetchedCases = (casesData as unknown as EnhancedCase[]) || []
        const rooms = (roomsData as unknown as Room[]) || []

        setCases(fetchedCases)

        const allCaseIds = fetchedCases.map(c => c.id)
        
        const caseStartTimes: Record<string, Date> = {}
        const casePhases: Record<string, CasePhase> = {}
        const caseMilestoneNames: Record<string, string[]> = {}
        const caseCurrentMilestone: Record<string, string> = {}

        if (allCaseIds.length > 0) {
          const { data: milestones } = await supabase
            .from('case_milestones')
            .select('case_id, recorded_at, facility_milestones(name, source_milestone_type_id)')
            .in('case_id', allCaseIds)
            .order('recorded_at', { ascending: true })
console.log('Milestones query result:', milestones)

          if (milestones) {
            for (const milestone of milestones as unknown as MilestoneWithType[]) {
              const caseId = milestone.case_id
              
              if (!caseStartTimes[caseId]) {
                const date = parseISODate(milestone.recorded_at)
                if (date) {
                  caseStartTimes[caseId] = date
                }
              }
              
const facilityMilestone = getJoinedValue(milestone.facility_milestones)
              if (facilityMilestone?.name) {
                const name = facilityMilestone.name.toLowerCase()
                if (!caseMilestoneNames[caseId]) {
                  caseMilestoneNames[caseId] = []
                }
                caseMilestoneNames[caseId].push(name)
                caseCurrentMilestone[caseId] = name
              }
            }
            
            for (const [caseId, names] of Object.entries(caseMilestoneNames)) {
              casePhases[caseId] = determinePhase(names)
            }
          }
        }

        const roomsWithCasesPromises = rooms.map(async (room) => {
          const roomCases = fetchedCases.filter(c => {
            const orRoom = getJoinedValue(c.or_rooms)
            return orRoom?.name === room.name
          }).sort((a, b) => {
            if (!a.start_time) return 1
            if (!b.start_time) return -1
            return a.start_time.localeCompare(b.start_time)
          })

          const currentCase = roomCases.find(c => getValue(c.case_statuses) === 'in_progress') || null
          const nextCase = roomCases.find(c => getValue(c.case_statuses) === 'scheduled') || null
          const upcomingCases = roomCases.filter(c => c.id !== currentCase?.id)

          const startTime = currentCase ? caseStartTimes[currentCase.id] || null : null
          const phase = currentCase ? casePhases[currentCase.id] || null : null

          let paceData: CasePaceData | null = null
          if (currentCase && currentCase.surgeon_id && currentCase.procedure_type_id) {
            const currentMilestone = caseCurrentMilestone[currentCase.id]
            const scheduledStart = parseScheduledStartTime(
              currentCase.scheduled_date,
              currentCase.start_time
            )
            
            if (currentMilestone && scheduledStart) {
              // UPDATED: Now passing facilityId to fetchPaceData
              paceData = await fetchPaceData(
                currentCase.surgeon_id,
                currentCase.procedure_type_id,
                currentMilestone,
                scheduledStart,
                userFacilityId
              )
            }
          }

          return {
            room,
            currentCase,
            nextCase: currentCase ? null : nextCase,
            upcomingCases,
            caseStartTime: startTime,
            currentPhase: phase,
            paceData
          } as RoomWithCase
        })

        const roomsWithCasesData = await Promise.all(roomsWithCasesPromises)
        setRoomsWithCases(roomsWithCasesData)

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedDate, userFacilityId, supabase, fetchPaceData])

  const activeCount = roomsWithCases.filter(r => r.currentCase !== null).length

  const goToPreviousDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() - 1)
    setSelectedDate(getLocalDateString(date))
  }

  const goToNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + 1)
    setSelectedDate(getLocalDateString(date))
  }

  const goToToday = () => {
    setSelectedDate(todayDate)
  }

  const isToday = selectedDate === todayDate

  if (userLoading || (isGlobalAdmin && !isImpersonating)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Page Header - Date navigation and toggles */}
        <div className="flex items-center justify-between mb-6">
          {/* Left side - Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Previous day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-900">
                    {selectedDate ? formatDateWithWeekday(selectedDate) : 'Select date'}
                  </span>
                </div>
              </div>

              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Today
                </button>
              )}

              {isToday && (
                <span className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                  Today
                </span>
              )}
            </div>

            <button
              onClick={goToNextDay}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Next day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Right side - Toggles */}
          <div className="flex items-center gap-4">
            {/* Hide Completed Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={() => setHideCompleted(!hideCompleted)}
                  className="sr-only peer"
                />
                <div className={`
                  w-5 h-5 rounded border-2 
                  flex items-center justify-center
                  transition-all duration-200
                  ${hideCompleted 
                    ? 'bg-slate-600 border-slate-600' 
                    : 'bg-white border-slate-300 hover:border-slate-400'
                  }
                `}>
                  {hideCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-slate-600">Hide Completed</span>
            </label>

            {/* Staff Toggle (only for admins) */}
            {canManageStaff && (
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showStaffPanel}
                    onChange={() => setShowStaffPanel(!showStaffPanel)}
                    className="sr-only peer"
                  />
                  <div className={`
                    w-5 h-5 rounded border-2 
                    flex items-center justify-center
                    transition-all duration-200
                    ${showStaffPanel 
                      ? 'bg-blue-600 border-blue-600' 
                      : 'bg-white border-slate-300 hover:border-slate-400'
                    }
                  `}>
                    {showStaffPanel && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-600">Staff</span>
              </label>
            )}
          </div>
        </div>

        {/* Staff Assignment Panel - Shows when enabled */}
        {canManageStaff && showStaffPanel && (
          <StaffAssignmentPanel
            staff={facilityStaff}
            isVisible={showStaffPanel}
            onToggle={() => setShowStaffPanel(!showStaffPanel)}
            loading={staffLoading}
          />
        )}

        {/* Content */}
        <div className="space-y-6">
          {/* Room Grid Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setRoomsCollapsed(!roomsCollapsed)}
              >
                <h2 className="text-lg font-semibold text-slate-900">OR Rooms</h2>
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    {activeCount} Active
                  </span>
                )}
                <button 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title={roomsCollapsed ? 'Expand rooms' : 'Collapse rooms'}
                >
                  <svg 
                    className={`w-5 h-5 transition-transform ${roomsCollapsed ? '' : 'rotate-180'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {/* Reorder Button - Admin Only */}
              {isAdmin && !roomsCollapsed && (
                <button
                  onClick={() => setShowRoomOrderModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Reorder rooms"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Reorder
                </button>
              )}
            </div>
            
            {!roomsCollapsed && (
              <EnhancedRoomGridView 
                roomsWithCases={roomsWithCases} 
                loading={loading}
                assignmentsByCaseId={assignmentsByCaseId}
                onRemoveStaff={handleRemoveStaff}
                canManageStaff={canManageStaff}
                dropZonesEnabled={showStaffPanel}
                hideCompleted={hideCompleted}
              />
            )}
          </div>

          {/* Case List Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">All Cases</h2>
                <span className="text-sm text-slate-500">
                  {cases.length} case{cases.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <CaseListView cases={cases as any} />
          </div>
        </div>

        {/* Drag Overlay */}
        <StaffDragOverlay activeData={activeDragData} />

      </DndContext>

      {/* Floating Action Button */}
      {userFacilityId && (
        <FloatingActionButton 
          actions={[
            {
              id: 'call-next-patient',
              label: 'Call Next Patient',
              icon: 'megaphone',
              onClick: () => setShowCallNextPatient(true)
            }
          ]}
        />
      )}

{/* Call Next Patient Modal */}
      {userFacilityId && userId && userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={userFacilityId}
          userId={userId}
          userEmail={userEmail}
        />
      )}

      {/* Room Order Modal */}
      <RoomOrderModal
        isOpen={showRoomOrderModal}
        onClose={() => setShowRoomOrderModal(false)}
        facilityId={userFacilityId}
        onSaved={() => window.location.reload()}
      />
    </DashboardLayout>
  )
}