// app/block-schedule/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useBlockSchedules } from '@/hooks/useBlockSchedules'
import { useSurgeons } from '@/hooks'
import { useFacilityClosures } from '@/hooks/useFacilityClosures'
import { useSurgeonColors } from '@/hooks/useSurgeonColors'
import { useRoomDateAssignments } from '@/hooks/useRoomDateAssignments'
import { useRoomSchedules, type RoomDaySchedule } from '@/hooks/useRoomSchedules'
import { ExpandedBlock, BlockSchedule } from '@/types/block-scheduling'
import type { SurgeonDragData, StaffDragData, RoomDayDropData } from '@/types/room-scheduling'
import type { StaffMember } from '@/types/staff-assignment'
import { WeekCalendar } from '@/components/block-schedule/WeekCalendar'
import { BlockSidebar } from '@/components/block-schedule/BlockSidebar'
import { BlockPopover } from '@/components/block-schedule/BlockPopover'
import { DeleteBlockModal } from '@/components/block-schedule/DeleteBlockModal'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ChevronLeft, ChevronRight, Undo2, X } from 'lucide-react'
import { BlockScheduleTabs, type BlockScheduleTab } from '@/components/block-schedule/BlockScheduleTabs'
import { RoomScheduleGrid } from '@/components/block-schedule/RoomScheduleGrid'
import { RoomScheduleSidebar } from '@/components/block-schedule/RoomScheduleSidebar'
import { RoomScheduleDragOverlay } from '@/components/block-schedule/RoomScheduleDragOverlay'
import { AssignPersonDialog } from '@/components/block-schedule/AssignPersonDialog'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { logger } from '@/lib/logger'

const _log = logger('BlockSchedulePage')

// =====================================================
// UNDO TOAST COMPONENT
// =====================================================
interface UndoAction {
  label: string
  onUndo: () => Promise<void>
  timer: ReturnType<typeof setTimeout>
}

function UndoToast({ action, onDismiss }: { action: UndoAction; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
      <span className="text-sm">{action.label}</span>
      <button
        onClick={async () => { await action.onUndo(); onDismiss() }}
        className="flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-blue-300 hover:text-blue-200 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>
      <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-white rounded transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// =====================================================
// HELPERS — FIX #2: No Date mutation
// =====================================================
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getWeekStart(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - result.getDay())
  return result
}

// =====================================================
// PAGE COMPONENT
// =====================================================
export default function BlockSchedulePage() {
  const supabase = createClient()
  const { loading: userLoading, effectiveFacilityId: facilityId, userData, can } = useUser()
  const facilityName = userData.facilityName
  const { showToast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<BlockScheduleTab>('surgeon-blocks')

  // Calendar state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [error, setError] = useState<string | null>(null)

  // Surgeons
  const [selectedSurgeonIds, setSelectedSurgeonIds] = useState<Set<string>>(new Set())
  const [showHolidays, setShowHolidays] = useState(true)
  const [showWeekends, setShowWeekends] = useState(false)

  // Popover state
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<BlockSchedule | null>(null)
  const [dragSelection, setDragSelection] = useState<{
    dayOfWeek: number
    startTime: string
    endTime: string
  } | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | undefined>()

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<ExpandedBlock | null>(null)

  // Undo state
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)

  // Hooks
  const {
    blocks,
    fetchBlocksForRange,
    createBlock,
    updateBlock,
    deleteBlock,
    addExceptionDate,
    removeExceptionDate,
    restoreBlock,
    loading: hookLoading,
  } = useBlockSchedules({ facilityId })

  const { fetchHolidays, fetchClosures, isDateClosed, getDateClosureInfo } = useFacilityClosures({ facilityId })
  const { fetchColors, getColorMap, setColor } = useSurgeonColors({ facilityId })
  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(facilityId)

  // Room date assignments (lifted from RoomScheduleGrid for DnD access)
  const {
    assignments: roomAssignments,
    staffAssignments: roomStaffAssignments,
    loading: roomAssignmentsLoading,
    error: roomAssignmentsError,
    fetchWeek: fetchRoomWeek,
    assignSurgeon,
    removeSurgeon,
    assignStaff,
    removeStaff,
    cloneDay,
    cloneWeek,
  } = useRoomDateAssignments({ facilityId })

  // DnD state
  const [activeDrag, setActiveDrag] = useState<DragStartEvent['active'] | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Room open/close schedules (for closed-room detection)
  const { fetchAllRoomSchedules } = useRoomSchedules({ facilityId })
  const [allRoomSchedules, setAllRoomSchedules] = useState<Map<string, RoomDaySchedule[]>>(new Map())

  // Staff for assign dialog
  const [facilityStaff, setFacilityStaff] = useState<StaffMember[]>([])

  // Assign dialog state (click-to-assign fallback)
  const [assignDialogTarget, setAssignDialogTarget] = useState<{
    roomId: string
    date: string
    roomName: string
  } | null>(null)

  // Clone confirm dialog
  const { confirmDialog: cloneConfirmDialog, showConfirm: showCloneConfirm } = useConfirmDialog()

  // Fetch room assignments when week or facility changes (only for room schedule tab)
  useEffect(() => {
    if (!facilityId || activeTab !== 'room-schedule') return
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    fetchRoomWeek(startDate, endDate)
  }, [facilityId, currentWeekStart, activeTab, fetchRoomWeek])

  // Fetch room open/close schedules (for closed-room detection)
  useEffect(() => {
    if (!facilityId || activeTab !== 'room-schedule') return
    fetchAllRoomSchedules().then(setAllRoomSchedules)
  }, [facilityId, activeTab, fetchAllRoomSchedules])

  // Fetch facility staff (for assign dialog)
  useEffect(() => {
    if (!facilityId || activeTab !== 'room-schedule') return
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, profile_image_url, role_id, facility_id, user_roles (name)')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('last_name')
      setFacilityStaff((data as unknown as StaffMember[]) || [])
    }
    fetchStaff()
  }, [facilityId, activeTab, supabase])

  // Refresh helper
  const refreshBlocks = useCallback(async () => {
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    await fetchBlocksForRange(startDate, endDate)
  }, [currentWeekStart, fetchBlocksForRange])

  // Undo helpers
  const showUndo = useCallback((label: string, onUndo: () => Promise<void>) => {
    if (undoAction?.timer) clearTimeout(undoAction.timer)
    const timer = setTimeout(() => setUndoAction(null), 6000)
    setUndoAction({ label, onUndo, timer })
  }, [undoAction])

  const dismissUndo = useCallback(() => {
    if (undoAction?.timer) clearTimeout(undoAction.timer)
    setUndoAction(null)
  }, [undoAction])

  // Initialize selected surgeons and colors
  useEffect(() => {
    if (surgeons.length > 0) {
      setSelectedSurgeonIds(new Set(surgeons.map(s => s.id)))
      fetchColors(surgeons.map(s => s.id))
    }
  }, [surgeons, fetchColors])

  // Load data when facility or week changes
  useEffect(() => {
    if (!facilityId) return
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    fetchBlocksForRange(startDate, endDate)
    fetchHolidays()
    fetchClosures(startDate, endDate)
  }, [facilityId, currentWeekStart, fetchBlocksForRange, fetchHolidays, fetchClosures])

  // Handle "Create" button
  const handleAddBlockButton = useCallback(() => {
    if (!can('scheduling.create')) return
    setEditingBlock(null)
    setDragSelection(null)
    setClickPosition({ x: 300, y: 150 })
    setPopoverOpen(true)
  }, [can])

  // FIX #9: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault()
          setCurrentWeekStart(getWeekStart(new Date()))
          break
        case 'arrowleft':
          e.preventDefault()
          setCurrentWeekStart(prev => addDays(prev, -7))
          break
        case 'arrowright':
          e.preventDefault()
          setCurrentWeekStart(prev => addDays(prev, 7))
          break
        case 'n':
          if (!popoverOpen && can('scheduling.create')) { e.preventDefault(); handleAddBlockButton() }
          break
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [popoverOpen, can, handleAddBlockButton])

  // Navigation
  const goToPreviousWeek = () => setCurrentWeekStart(prev => addDays(prev, -7))
  const goToNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7))
  const goToToday = () => setCurrentWeekStart(getWeekStart(new Date()))

  // Filter blocks by selected surgeons
  const filteredBlocks = blocks.filter(b => selectedSurgeonIds.has(b.surgeon_id))
  const colorMap = getColorMap()

  const checkDateClosed = useCallback((date: Date) => {
    if (!showHolidays) return false
    return isDateClosed(date)
  }, [showHolidays, isDateClosed])

  const checkDateClosureInfo = useCallback((date: Date) => {
    if (!showHolidays) {
      return { isClosed: false, isPartialHoliday: false, holidayName: null, closureReason: null, partialCloseTime: null }
    }
    return getDateClosureInfo(date)
  }, [showHolidays, getDateClosureInfo])

  // =====================================================
  // EVENT HANDLERS (continued from page_part1.tsx)
  // =====================================================

  // Handle drag selection from calendar
  const handleDragSelect = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    position?: { x: number; y: number }
  ) => {
    if (!can('scheduling.create')) return
    setDragSelection({ dayOfWeek, startTime, endTime })
    setEditingBlock(null)
    setClickPosition(position)
    setPopoverOpen(true)
  }

  // Handle block click (edit)
  const handleBlockClick = async (block: ExpandedBlock, position?: { x: number; y: number }) => {
    if (!can('scheduling.edit')) return
    try {
      const { data, error: fetchError } = await supabase
        .from('block_schedules')
        .select('*')
        .eq('id', block.block_id)
        .single()

      if (fetchError) throw fetchError

      if (data) {
        setEditingBlock(data)
        setDragSelection(null)
        setClickPosition(position)
        setPopoverOpen(true)
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to load block details',
        message: err instanceof Error ? err.message : 'Please try again'
      })
    }
  }

  // Handle popover save
  const handleSave = async () => {
    setPopoverOpen(false)
    setEditingBlock(null)
    setDragSelection(null)
    setClickPosition(undefined)
    await refreshBlocks()
  }

  // Handle delete request from popover
  const handleDeleteRequest = (blockId: string) => {
    const block = blocks.find(b => b.block_id === blockId)
    if (!block) return

    if (block.recurrence_type) {
      setBlockToDelete(block)
      setDeleteModalOpen(true)
    } else {
      handleDeleteAll(block)
    }
  }

  // FIX #10: Delete single occurrence with undo
  const handleDeleteSingle = async () => {
    if (!blockToDelete) return
    const surgeon = surgeons.find(s => s.id === blockToDelete.surgeon_id)
    if (!surgeon) return

    const blockId = blockToDelete.block_id
    const blockDate = blockToDelete.block_date

    await addExceptionDate(blockId, blockDate, surgeon)
    setPopoverOpen(false)
    setDeleteModalOpen(false)
    setBlockToDelete(null)
    await refreshBlocks()

    showUndo(`Block removed for ${blockDate}`, async () => {
      await removeExceptionDate(blockId, blockDate, surgeon)
      await refreshBlocks()
    })
  }

  // FIX #10: Delete all occurrences with undo
  const handleDeleteAll = async (block?: ExpandedBlock) => {
    const targetBlock = block || blockToDelete
    if (!targetBlock) return
    const surgeon = surgeons.find(s => s.id === targetBlock.surgeon_id)
    if (!surgeon) return

    const dayOfWeek = new Date(targetBlock.block_date).getDay()
    await deleteBlock(targetBlock.block_id, surgeon, dayOfWeek)
    setPopoverOpen(false)
    setDeleteModalOpen(false)
    setBlockToDelete(null)
    await refreshBlocks()

    showUndo(`Block schedule for Dr. ${surgeon.last_name} deleted`, async () => {
      await restoreBlock(targetBlock.block_id, surgeon, dayOfWeek)
      await refreshBlocks()
    })
  }

  // FIX #14: Handle duplicate — close popover, reopen as new with pre-filled values
  const handleDuplicate = (block: BlockSchedule) => {
    setPopoverOpen(false)
    setTimeout(() => {
      setEditingBlock(null)
      setDragSelection({
        dayOfWeek: block.day_of_week,
        startTime: block.start_time,
        endTime: block.end_time,
      })
      setClickPosition({ x: 400, y: 200 })
      setPopoverOpen(true)
    }, 100)
  }

  // Surgeon filter toggles
  const toggleSurgeon = (surgeonId: string) => {
    setSelectedSurgeonIds(prev => {
      const next = new Set(prev)
      if (next.has(surgeonId)) next.delete(surgeonId)
      else next.add(surgeonId)
      return next
    })
  }
  const selectAllSurgeons = () => setSelectedSurgeonIds(new Set(surgeons.map(s => s.id)))
  const deselectAllSurgeons = () => setSelectedSurgeonIds(new Set())

  const handleColorChange = async (surgeonId: string, color: string) => {
    if (setColor) await setColor(surgeonId, color)
  }

  // Format week range for header
  const formatWeekHeader = () => {
    const weekEnd = addDays(currentWeekStart, 6)
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'long' })
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'long' })
    const year = weekEnd.getFullYear()
    if (startMonth === endMonth) return `${startMonth} ${year}`
    return `${startMonth} – ${endMonth} ${year}`
  }

  // =====================================================
  // DND HANDLERS (room schedule)
  // =====================================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(event.active)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null)

      const { active, over } = event
      if (!over) return

      const dropData = over.data.current as RoomDayDropData | undefined
      if (!dropData || dropData.type !== 'room-day') return

      const dragData = active.data.current as SurgeonDragData | StaffDragData | undefined
      if (!dragData) return

      if (dragData.type === 'surgeon') {
        // Check if surgeon is already assigned to THIS specific room on this date
        const existingInSameRoom = roomAssignments.find(
          (a) => a.surgeon_id === dragData.surgeonId
            && a.assignment_date === dropData.date
            && a.or_room_id === dropData.roomId
        )
        if (existingInSameRoom) {
          showToast({
            type: 'warning',
            title: 'Already assigned',
            message: `Dr. ${dragData.surgeon.last_name} is already assigned to ${dropData.roomName} on this date`,
          })
          return
        }

        const result = await assignSurgeon({
          or_room_id: dropData.roomId,
          assignment_date: dropData.date,
          surgeon_id: dragData.surgeonId,
        })

        if (result) {
          showToast({
            type: 'success',
            title: 'Surgeon assigned',
            message: `Dr. ${dragData.surgeon.last_name} assigned to ${dropData.roomName}`,
          })
        } else {
          showToast({
            type: 'error',
            title: 'Assignment failed',
            message: 'Could not assign surgeon. Please try again.',
          })
        }
      } else if (dragData.type === 'staff') {
        // Check for existing staff assignment on same date
        const existingStaff = roomStaffAssignments.find(
          (s) => s.user_id === dragData.userId && s.assignment_date === dropData.date
        )
        if (existingStaff) {
          const staffName = `${dragData.user.first_name} ${dragData.user.last_name}`
          if (existingStaff.or_room_id === dropData.roomId) {
            showToast({
              type: 'warning',
              title: 'Already assigned',
              message: `${staffName} is already assigned to ${dropData.roomName} on this date`,
            })
          } else {
            showToast({
              type: 'warning',
              title: 'Already assigned elsewhere',
              message: `${staffName} is already assigned to another room on this date`,
            })
          }
          return
        }

        const result = await assignStaff({
          or_room_id: dropData.roomId,
          assignment_date: dropData.date,
          user_id: dragData.userId,
          role_id: dragData.roleId,
        })

        if (result) {
          showToast({
            type: 'success',
            title: 'Staff assigned',
            message: `${dragData.user.first_name} ${dragData.user.last_name} assigned to ${dropData.roomName}`,
          })
        } else {
          showToast({
            type: 'error',
            title: 'Assignment failed',
            message: 'Could not assign staff. Please try again.',
          })
        }
      }
    },
    [assignSurgeon, assignStaff, showToast, roomAssignments, roomStaffAssignments]
  )

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null)
  }, [])

  // Remove surgeon from room-day cell
  const handleRemoveSurgeon = useCallback(
    async (assignmentId: string) => {
      const assignment = roomAssignments.find((a) => a.id === assignmentId)
      const success = await removeSurgeon(assignmentId)
      if (success) {
        showToast({
          type: 'success',
          title: 'Surgeon removed',
          message: `Dr. ${assignment?.surgeon?.last_name ?? 'Unknown'} removed`,
        })
      }
    },
    [removeSurgeon, roomAssignments, showToast]
  )

  // Remove staff from room-day cell
  const handleRemoveStaff = useCallback(
    async (staffId: string) => {
      const staff = roomStaffAssignments.find((s) => s.id === staffId)
      const success = await removeStaff(staffId)
      if (success) {
        const name = staff?.user
          ? `${staff.user.first_name ?? ''} ${staff.user.last_name ?? ''}`.trim()
          : 'Staff member'
        showToast({
          type: 'success',
          title: 'Staff removed',
          message: `${name} removed`,
        })
      }
    },
    [removeStaff, roomStaffAssignments, showToast]
  )

  // =====================================================
  // CLONE HANDLERS (room schedule)
  // =====================================================

  const refreshRoomWeek = useCallback(() => {
    if (!facilityId) return
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    fetchRoomWeek(startDate, endDate)
  }, [facilityId, currentWeekStart, fetchRoomWeek])

  const handleCloneWeek = useCallback(
    (sourceWeekStart: string, targetWeekStart: string) => {
      showCloneConfirm({
        variant: 'warning',
        title: 'Clone previous week?',
        message: 'This will replace all assignments for the current week with assignments from the previous week.',
        confirmText: 'Clone week',
        onConfirm: async () => {
          const success = await cloneWeek(sourceWeekStart, targetWeekStart)
          if (success) {
            refreshRoomWeek()
            showToast({ type: 'success', title: 'Week cloned', message: 'Assignments copied from previous week' })
          }
        },
      })
    },
    [showCloneConfirm, cloneWeek, refreshRoomWeek, showToast]
  )

  const handleCloneDay = useCallback(
    (sourceDate: string, targetDate: string) => {
      const dayName = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
      showCloneConfirm({
        variant: 'warning',
        title: `Clone previous ${dayName}?`,
        message: `This will replace all assignments for ${dayName} with assignments from the previous ${dayName}.`,
        confirmText: 'Clone day',
        onConfirm: async () => {
          const success = await cloneDay(sourceDate, targetDate)
          if (success) {
            refreshRoomWeek()
            showToast({ type: 'success', title: 'Day cloned', message: `Assignments copied from previous ${dayName}` })
          }
        },
      })
    },
    [showCloneConfirm, cloneDay, refreshRoomWeek, showToast]
  )

  // =====================================================
  // CLICK-TO-ASSIGN (keyboard accessible fallback)
  // =====================================================

  const handleRequestAssign = useCallback(
    (roomId: string, date: string, roomName: string) => {
      setAssignDialogTarget({ roomId, date, roomName })
    },
    []
  )

  const handleDialogAssignSurgeon = useCallback(
    async (surgeonId: string) => {
      if (!assignDialogTarget) return
      const surgeon = surgeons.find((s) => s.id === surgeonId)
      const result = await assignSurgeon({
        or_room_id: assignDialogTarget.roomId,
        assignment_date: assignDialogTarget.date,
        surgeon_id: surgeonId,
      })
      if (result) {
        showToast({
          type: 'success',
          title: 'Surgeon assigned',
          message: `Dr. ${surgeon?.last_name ?? 'Unknown'} assigned to ${assignDialogTarget.roomName}`,
        })
      } else {
        showToast({
          type: 'error',
          title: 'Assignment failed',
          message: 'Could not assign surgeon. They may already be assigned on this date.',
        })
      }
    },
    [assignDialogTarget, assignSurgeon, surgeons, showToast]
  )

  const handleDialogAssignStaff = useCallback(
    async (userId: string, roleId: string) => {
      if (!assignDialogTarget) return
      const staff = facilityStaff.find((s) => s.id === userId)
      const result = await assignStaff({
        or_room_id: assignDialogTarget.roomId,
        assignment_date: assignDialogTarget.date,
        user_id: userId,
        role_id: roleId,
      })
      if (result) {
        showToast({
          type: 'success',
          title: 'Staff assigned',
          message: `${staff?.first_name ?? ''} ${staff?.last_name ?? 'Staff'} assigned to ${assignDialogTarget.roomName}`,
        })
      } else {
        showToast({
          type: 'error',
          title: 'Assignment failed',
          message: 'Could not assign staff. They may already be assigned on this date.',
        })
      }
    },
    [assignDialogTarget, assignStaff, facilityStaff, showToast]
  )

  // Computed: which surgeons are already assigned to THIS room on the target date
  const assignedSurgeonIdsForDate = useMemo(() => {
    if (!assignDialogTarget) return new Set<string>()
    return new Set(
      roomAssignments
        .filter((a) => a.assignment_date === assignDialogTarget.date
          && a.or_room_id === assignDialogTarget.roomId)
        .map((a) => a.surgeon_id)
    )
  }, [roomAssignments, assignDialogTarget])

  const assignedStaffIdsForDate = useMemo(() => {
    if (!assignDialogTarget) return new Set<string>()
    return new Set(
      roomStaffAssignments
        .filter((s) => s.assignment_date === assignDialogTarget.date)
        .map((s) => s.user_id)
    )
  }, [roomStaffAssignments, assignDialogTarget])

  // =====================================================
  // RENDER
  // =====================================================
  if (!userLoading && !can('scheduling.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {userLoading || surgeonsLoading ? (
        <PageLoader message="Loading block schedule..." />
      ) : (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          style={{ height: 'calc(100vh - 140px)' }}
        >
          {/* Tab Navigation */}
          <BlockScheduleTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Error Banner */}
          {error && (
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          {activeTab === 'surgeon-blocks' ? (
            /* Surgeon Blocks Tab */
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Sidebar */}
              <BlockSidebar
                surgeons={surgeons}
                selectedSurgeonIds={selectedSurgeonIds}
                colorMap={colorMap}
                onToggleSurgeon={toggleSurgeon}
                onSelectAll={selectAllSurgeons}
                onDeselectAll={deselectAllSurgeons}
                currentWeekStart={currentWeekStart}
                onDateSelect={(date) => setCurrentWeekStart(getWeekStart(date))}
                onAddBlock={can('scheduling.create') ? handleAddBlockButton : undefined}
                showHolidays={showHolidays}
                onToggleHolidays={() => setShowHolidays(!showHolidays)}
                onColorChange={handleColorChange}
              />

              {/* Main Calendar */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Navigation Header */}
                <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0">
                  <button
                    onClick={goToToday}
                    className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                    title="Go to today (T)"
                  >
                    Today
                  </button>
                  <div className="flex items-center">
                    <button
                      onClick={goToPreviousWeek}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title="Previous week (←)"
                    >
                      <ChevronLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <button
                      onClick={goToNextWeek}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title="Next week (→)"
                    >
                      <ChevronRight className="h-5 w-5 text-slate-600" />
                    </button>
                  </div>
                  <h1 className="text-xl font-normal text-slate-800">
                    {formatWeekHeader()}
                  </h1>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-hidden min-h-0">
                  <WeekCalendar
                    weekStart={currentWeekStart}
                    blocks={filteredBlocks}
                    colorMap={colorMap}
                    isDateClosed={checkDateClosed}
                    getDateClosureInfo={checkDateClosureInfo}
                    onDragSelect={handleDragSelect}
                    onBlockClick={handleBlockClick}
                    activeSelection={popoverOpen && dragSelection ? dragSelection : null}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Room Schedule Tab — wrapped in DndContext for drag-and-drop */
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="flex flex-1 overflow-hidden min-h-0">
                <RoomScheduleSidebar
                  facilityId={facilityId}
                  surgeons={surgeons}
                  surgeonsLoading={surgeonsLoading}
                  currentWeekStart={currentWeekStart}
                  onDateSelect={(date) => setCurrentWeekStart(getWeekStart(date))}
                  blocks={blocks}
                />
                <RoomScheduleGrid
                  facilityId={facilityId}
                  currentWeekStart={currentWeekStart}
                  onWeekChange={setCurrentWeekStart}
                  assignments={roomAssignments}
                  staffAssignments={roomStaffAssignments}
                  assignmentsLoading={roomAssignmentsLoading}
                  assignmentsError={roomAssignmentsError}
                  onRemoveSurgeon={handleRemoveSurgeon}
                  onRemoveStaff={handleRemoveStaff}
                  onCloneWeek={handleCloneWeek}
                  onCloneDay={handleCloneDay}
                  allRoomSchedules={allRoomSchedules}
                  onRequestAssign={handleRequestAssign}
                  showWeekends={showWeekends}
                  onToggleWeekends={() => setShowWeekends(prev => !prev)}
                  facilityName={facilityName ?? ''}
                  isFacilityDateClosed={isDateClosed}
                  getDateClosureInfo={getDateClosureInfo}
                />
              </div>
              <DragOverlay dropAnimation={null}>
                <RoomScheduleDragOverlay active={activeDrag} />
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* Block Popover — FIX #5: delegates DB to hook */}
      <BlockPopover
        open={popoverOpen}
        onClose={() => {
          setPopoverOpen(false)
          setEditingBlock(null)
          setDragSelection(null)
          setClickPosition(undefined)
        }}
        onSave={handleSave}
        onDelete={handleDeleteRequest}
        onDuplicate={handleDuplicate}
        facilityId={facilityId}
        surgeons={surgeons}
        colorMap={colorMap}
        editingBlock={editingBlock}
        allBlocks={blocks}
        initialDayOfWeek={dragSelection?.dayOfWeek}
        initialStartTime={dragSelection?.startTime}
        initialEndTime={dragSelection?.endTime}
        clickPosition={clickPosition}
        currentWeekStart={currentWeekStart}
        onCreateBlock={createBlock}
        onUpdateBlock={updateBlock}
        loading={hookLoading}
      />

      {/* Delete Modal */}
      <DeleteBlockModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setBlockToDelete(null) }}
        onDeleteSingle={handleDeleteSingle}
        onDeleteAll={() => handleDeleteAll()}
        surgeonName={blockToDelete ? `Dr. ${blockToDelete.surgeon_last_name}` : ''}
        isRecurring={!!blockToDelete?.recurrence_type}
      />

      {/* Clone Confirm Dialog */}
      {cloneConfirmDialog}

      {/* Undo Toast */}
      {undoAction && <UndoToast action={undoAction} onDismiss={dismissUndo} />}

      {/* Click-to-Assign Dialog (keyboard accessible fallback for DnD) */}
      <AssignPersonDialog
        isOpen={!!assignDialogTarget}
        onClose={() => setAssignDialogTarget(null)}
        roomName={assignDialogTarget?.roomName ?? ''}
        date={assignDialogTarget?.date ?? ''}
        surgeons={surgeons}
        staff={facilityStaff}
        onAssignSurgeon={handleDialogAssignSurgeon}
        onAssignStaff={handleDialogAssignStaff}
        assignedSurgeonIds={assignedSurgeonIdsForDate}
        assignedStaffIds={assignedStaffIdsForDate}
      />
    </DashboardLayout>
  )
}