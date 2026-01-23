// app/block-schedule/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import { useBlockSchedules } from '@/hooks/useBlockSchedules'
import { useFacilityClosures } from '@/hooks/useFacilityClosures'
import { useSurgeonColors } from '@/hooks/useSurgeonColors'
import { ExpandedBlock, BlockSchedule } from '@/types/block-scheduling'
import { WeekCalendar } from '@/components/block-schedule/WeekCalendar'
import { BlockSidebar } from '@/components/block-schedule/BlockSidebar'
import { BlockPopover } from '@/components/block-schedule/BlockPopover'
import { ChevronLeft, ChevronRight, Calendar, Plus, Loader2 } from 'lucide-react'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

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
    const diff = today.getDate() - day // Start on Sunday
    return new Date(today.setDate(diff))
  })

  // Surgeons
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [selectedSurgeonIds, setSelectedSurgeonIds] = useState<Set<string>>(new Set())

  // Popover state
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<BlockSchedule | null>(null)
  const [dragSelection, setDragSelection] = useState<{
    dayOfWeek: number
    startTime: string
    endTime: string
  } | null>(null)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | undefined>()

  // Hooks
  const { blocks, fetchBlocksForRange, createBlock, updateBlock, deleteBlock } = 
    useBlockSchedules({ facilityId })
  const { holidays, closures, fetchHolidays, fetchClosures, isDateClosed } = 
    useFacilityClosures({ facilityId })
  const { colors, fetchColors, getColorForSurgeon, getColorMap } = 
    useSurgeonColors({ facilityId })

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

  // Load surgeons
  useEffect(() => {
    async function loadSurgeons() {
      if (!facilityId) return

      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('facility_id', facilityId)
        .eq('role_id', (
          await supabase
            .from('user_roles')
            .select('id')
            .eq('name', 'surgeon')
            .single()
        ).data?.id)
        .order('last_name')

      if (data) {
        setSurgeons(data)
        // Select all surgeons by default
        setSelectedSurgeonIds(new Set(data.map(s => s.id)))
      }
    }
    loadSurgeons()
  }, [facilityId, supabase])

  // Load data when facility or week changes
  useEffect(() => {
    if (!facilityId) return

    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))

    fetchBlocksForRange(startDate, endDate)
    fetchHolidays()
    fetchClosures(startDate, endDate)
    fetchColors()
  }, [facilityId, currentWeekStart, fetchBlocksForRange, fetchHolidays, fetchClosures, fetchColors])

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
  const filteredBlocks = blocks.filter(block => 
    selectedSurgeonIds.has(block.surgeon_id)
  )

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
    // Fetch full block data for editing
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

  // Handle "Add Block" button (no position, will center)
  const handleAddBlockButton = () => {
    setEditingBlock(null)
    setDragSelection(null)
    // Position near the button (top right area)
    setClickPosition({ x: window.innerWidth - 400, y: 200 })
    setPopoverOpen(true)
  }

  // Handle popover save
  const handleSave = async () => {
    setPopoverOpen(false)
    setEditingBlock(null)
    setDragSelection(null)
    setClickPosition(undefined)

    // Refresh blocks
    const startDate = formatDate(currentWeekStart)
    const endDate = formatDate(addDays(currentWeekStart, 6))
    await fetchBlocksForRange(startDate, endDate)
  }

  // Handle delete
  const handleDelete = async (blockId: string) => {
    const block = blocks.find(b => b.block_id === blockId)
    if (!block) return

    const surgeon = surgeons.find(s => s.id === block.surgeon_id)
    if (!surgeon) return

    const dayOfWeek = new Date(block.block_date).getDay()
    await deleteBlock(blockId, surgeon, dayOfWeek)

    // Refresh
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

  const colorMap = getColorMap()

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Page Header - inside the card */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex-shrink-0">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Block Schedule</h1>
              <p className="text-sm text-slate-500">Manage surgeon block time allocations</p>
            </div>

            <button
              onClick={handleAddBlockButton}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Block
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
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
            />

            {/* Calendar Section */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousWeek}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 text-slate-600" />
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={goToNextWeek}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  </button>
                  <span className="ml-2 text-base font-medium text-slate-700">
                    {formatWeekRange(currentWeekStart)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4" />
                  <span>Week View</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 overflow-hidden">
                <WeekCalendar
                  weekStart={currentWeekStart}
                  blocks={filteredBlocks}
                  colorMap={colorMap}
                  isDateClosed={isDateClosed}
                  onDragSelect={handleDragSelect}
                  onBlockClick={handleBlockClick}
                  activeSelection={popoverOpen && dragSelection ? dragSelection : null}
                />
              </div>
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
            onDelete={handleDelete}
            facilityId={facilityId}
            surgeons={surgeons}
            colorMap={colorMap}
            editingBlock={editingBlock}
            initialDayOfWeek={dragSelection?.dayOfWeek}
            initialStartTime={dragSelection?.startTime}
            initialEndTime={dragSelection?.endTime}
            clickPosition={clickPosition}
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

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const year = weekEnd.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
}