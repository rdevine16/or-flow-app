// app/block-schedule/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
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
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ChevronLeft, ChevronRight, Undo2, X } from 'lucide-react'

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
  const { loading: userLoading, effectiveFacilityId: facilityId, can } = useUser()
  const { showToast } = useToast()

  // Calendar state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [error, setError] = useState<string | null>(null)

  // Surgeons
  const [selectedSurgeonIds, setSelectedSurgeonIds] = useState<Set<string>>(new Set())
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

  const { holidays, closures, fetchHolidays, fetchClosures, isDateClosed } = useFacilityClosures({ facilityId })
  const { fetchColors, getColorMap, setColor } = useSurgeonColors({ facilityId })
  const { data: surgeons, loading: surgeonsLoading } = useSurgeons(facilityId)

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
  }, [popoverOpen])

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

  // Handle "Create" button
  const handleAddBlockButton = () => {
    if (!can('scheduling.create')) return
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
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex"
          style={{ height: 'calc(100vh - 140px)' }}
        >
          {/* Error Banner */}
          {error && (
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
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
                onDragSelect={handleDragSelect}
                onBlockClick={handleBlockClick}
                activeSelection={popoverOpen && dragSelection ? dragSelection : null}
              />
            </div>
          </div>
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

      {/* Undo Toast */}
      {undoAction && <UndoToast action={undoAction} onDismiss={dismissUndo} />}
    </DashboardLayout>
  )
}