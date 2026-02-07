// app/block-schedule/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useBlockSchedules } from '@/hooks/useBlockSchedules'
import { useSurgeons } from '@/hooks'
import { useFacilityClosures } from '@/hooks/useFacilityClosures'
import { useSurgeonColors } from '@/hooks/useSurgeonColors'
import { ExpandedBlock, BlockSchedule } from '@/types/block-scheduling'
import { WeekCalendar } from '@/components/block-schedule/WeekCalendar'
import { BlockSidebar } from '@/components/block-schedule/BlockSidebar'
import { BlockPopover } from '@/components/block-schedule/BlockPopover'
import { DeleteBlockModal } from '@/components/block-schedule/DeleteBlockModal'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'


export default function BlockSchedulePage() {
  const router = useRouter()
  const supabase = createClient()

  // Auth & facility
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Calendar state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    return new Date(today.setDate(diff))
  })

  // Surgeons
  const [selectedSurgeonIds, setSelectedSurgeonIds] = useState<Set<string>>(new Set())

  // Show holidays toggle
  const [showHolidays, setShowHolidays] = useState(true)

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

  // Hooks
  const { blocks, fetchBlocksForRange, deleteBlock, addExceptionDate } = useBlockSchedules({ facilityId })
  const { holidays, closures, fetchHolidays, fetchClosures, isDateClosed } = useFacilityClosures({ facilityId })
  const { fetchColors, getColorMap, setColor } = useSurgeonColors({ facilityId })
  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(facilityId)

  // Load user and facility
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userData?.facility_id) {
        setFacilityId(userData.facility_id)
      }
      setLoading(false)
    }
    loadUser()
  }, [supabase, router])

  // Initialize selected surgeons and colors when surgeons load
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

  // Navigation
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7))
  }

  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    setCurrentWeekStart(new Date(today.setDate(diff)))
  }

  // Filter blocks by selected surgeons
  const filteredBlocks = blocks.filter(block => selectedSurgeonIds.has(block.surgeon_id))

  // Closure check - only if holidays are shown
  const checkDateClosed = useCallback((date: Date) => {
    if (!showHolidays) return false
    return isDateClosed(date)
  }, [showHolidays, isDateClosed])

  // Handle drag selection from calendar
  const handleDragSelect = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    position?: { x: number; y: number }
  ) => {
    setDragSelection({ dayOfWeek, startTime, endTime })
    setEditingBlock(null)
    setClickPosition(position)
    setPopoverOpen(true)
  }

  // Handle block click (edit)
  const handleBlockClick = async (block: ExpandedBlock, position?: { x: number; y: number }) => {
    const { data } = await supabase
      .from('block_schedules')
      .select('*')
      .eq('id', block.block_id)
      .single()

    if (data) {
      setEditingBlock(data)
      setDragSelection(null)
      setClickPosition(position)
      setPopoverOpen(true)
    }
  }

  // Handle "Create" button
  const handleAddBlockButton = () => {
    setEditingBlock(null)
    setDragSelection(null)
    setClickPosition({ x: 300, y: 150 })
    setPopoverOpen(true)
  }

  // Handle popover save
  const handleSave = async () => {
    setPopoverOpen(false)
    setEditingBlock(null)
    setDragSelection(null)
    setClickPosition(undefined)

    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    await fetchBlocksForRange(startDate, endDate)
  }

  // Handle delete request - show modal for recurring, delete directly for single
  const handleDeleteRequest = (blockId: string) => {
    const block = blocks.find(b => b.block_id === blockId)
    if (!block) return

    // All blocks with a recurrence_type are recurring (weekly, biweekly, monthly, etc.)
    // Show modal for all recurring blocks
    const isRecurring = !!block.recurrence_type

    if (isRecurring) {
      // Show delete modal for recurring blocks
      setBlockToDelete(block)
      setDeleteModalOpen(true)
    } else {
      // Delete single block directly (shouldn't happen with current schema)
      handleDeleteAll(block)
    }
  }

  // Delete single occurrence (add exception date)
  const handleDeleteSingle = async () => {
    if (!blockToDelete) return

    const surgeon = surgeons.find(s => s.id === blockToDelete.surgeon_id)
    if (!surgeon) return

    // Add the block_date as an exception
    await addExceptionDate(blockToDelete.block_id, blockToDelete.block_date, surgeon)

    // Close popover and refresh
    setPopoverOpen(false)
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    await fetchBlocksForRange(startDate, endDate)
  }

  // Delete all occurrences (soft delete the block)
  const handleDeleteAll = async (block?: ExpandedBlock) => {
    const targetBlock = block || blockToDelete
    if (!targetBlock) return

    const surgeon = surgeons.find(s => s.id === targetBlock.surgeon_id)
    if (!surgeon) return

    const dayOfWeek = new Date(targetBlock.block_date).getDay()
    await deleteBlock(targetBlock.block_id, surgeon, dayOfWeek)

    // Close popover and refresh
    setPopoverOpen(false)
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    await fetchBlocksForRange(startDate, endDate)
  }

  // Toggle surgeon filter
  const toggleSurgeon = (surgeonId: string) => {
    setSelectedSurgeonIds(prev => {
      const next = new Set(prev)
      if (next.has(surgeonId)) {
        next.delete(surgeonId)
      } else {
        next.add(surgeonId)
      }
      return next
    })
  }

  const selectAllSurgeons = () => {
    setSelectedSurgeonIds(new Set(surgeons.map(s => s.id)))
  }

  const deselectAllSurgeons = () => {
    setSelectedSurgeonIds(new Set())
  }

  // Handle surgeon color change
  const handleColorChange = async (surgeonId: string, color: string) => {
    if (setColor) {
      await setColor(surgeonId, color)
    }
  }

  const colorMap = getColorMap()

  // Format week range for header - Google style
  const formatWeekHeader = () => {
    const weekEnd = addDays(currentWeekStart, 6)
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'long' })
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'long' })
    const year = weekEnd.getFullYear()

    if (startMonth === endMonth) {
      return `${startMonth} ${year}`
    }
    return `${startMonth} – ${endMonth} ${year}`
  }

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div 
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex"
          style={{ height: 'calc(100vh - 140px)' }}
        >
          {/* Sidebar */}
          <BlockSidebar
            surgeons={surgeons}
            selectedSurgeonIds={selectedSurgeonIds}
            colorMap={colorMap}
            onToggleSurgeon={toggleSurgeon}
            onSelectAll={selectAllSurgeons}
            onDeselectAll={deselectAllSurgeons}
            currentWeekStart={currentWeekStart}
            onDateSelect={(date) => {
              const day = date.getDay()
              const diff = date.getDate() - day
              setCurrentWeekStart(new Date(new Date(date).setDate(diff)))
            }}
            onAddBlock={handleAddBlockButton}
            showHolidays={showHolidays}
            onToggleHolidays={() => setShowHolidays(!showHolidays)}
            onColorChange={handleColorChange}
          />

          {/* Main Calendar Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation Header - Google Style */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0">
              <button
                onClick={goToToday}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Today
              </button>
              <div className="flex items-center">
                <button
                  onClick={goToPreviousWeek}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
                <button
                  onClick={goToNextWeek}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-slate-600" />
                </button>
              </div>
              <h1 className="text-xl font-normal text-slate-800">
                {formatWeekHeader()}
              </h1>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-hidden">
              <WeekCalendar
                weekStart={currentWeekStart}
                blocks={filteredBlocks}
                colorMap={colorMap}
                isDateClosed={checkDateClosed}
                onDragSelect={handleDragSelect}
                onBlockClick={handleBlockClick}
                activeSelection={popoverOpen && dragSelection ? dragSelection : null}
              />
            </div>
          </div>

          {/* Popover */}
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
            facilityId={facilityId}
            surgeons={surgeons}
            colorMap={colorMap}
            editingBlock={editingBlock}
            initialDayOfWeek={dragSelection?.dayOfWeek}
            initialStartTime={dragSelection?.startTime}
            initialEndTime={dragSelection?.endTime}
            clickPosition={clickPosition}
            currentWeekStart={currentWeekStart} 
          />

          {/* Delete Confirmation Modal */}
          <DeleteBlockModal
            isOpen={deleteModalOpen}
            onClose={() => {
              setDeleteModalOpen(false)
              setBlockToDelete(null)
            }}
            onDeleteSingle={handleDeleteSingle}
            onDeleteAll={() => handleDeleteAll()}
            surgeonName={blockToDelete ? `Dr. ${blockToDelete.surgeon_last_name}` : ''}
            isRecurring={!!blockToDelete?.recurrence_type}
          />
        </div>
      )}
    </DashboardLayout>
  )
}

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}