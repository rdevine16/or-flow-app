// components/block-schedule/BlockPopover.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Trash2, Loader2, Clock, User, Calendar, Repeat, GripHorizontal, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { blockScheduleAudit } from '@/lib/audit-logger'
import {
  BlockSchedule,
  RecurrenceType,
  DAY_OF_WEEK_LABELS,
  RECURRENCE_LABELS,
  formatTime12Hour,
  SURGEON_COLOR_PALETTE,
} from '@/types/block-scheduling'
import { CustomRecurrenceModal, CustomRecurrenceConfig, getCustomRecurrenceDescription } from './CustomRecurrenceModal'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface BlockPopoverProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  onDelete: (blockId: string) => void
  facilityId: string | null
  surgeons: Surgeon[]
  colorMap: Record<string, string>
  editingBlock: BlockSchedule | null
  initialDayOfWeek?: number
  initialStartTime?: string
  initialEndTime?: string
  clickPosition?: { x: number; y: number }
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
})

export function BlockPopover({
  open,
  onClose,
  onSave,
  onDelete,
  facilityId,
  surgeons,
  colorMap,
  editingBlock,
  initialDayOfWeek,
  initialStartTime,
  initialEndTime,
  clickPosition,
}: BlockPopoverProps) {
  const supabase = createClient()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [position, setPosition] = useState({ top: 100, left: 100 })

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Form state
  const [surgeonId, setSurgeonId] = useState<string>('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [startTime, setStartTime] = useState<string>('07:00:00')
  const [endTime, setEndTime] = useState<string>('15:00:00')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly')
  const [effectiveStart, setEffectiveStart] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [effectiveEnd, setEffectiveEnd] = useState<string>('')
  const [hasEndDate, setHasEndDate] = useState(false)

  // Custom recurrence state
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customRecurrence, setCustomRecurrence] = useState<CustomRecurrenceConfig | null>(null)
  const [isCustom, setIsCustom] = useState(false)

  // Calculate initial position - ensure popover stays on screen
  useEffect(() => {
    if (open && clickPosition) {
      const popoverWidth = 360
      const popoverHeight = showMoreOptions ? 520 : 420
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const padding = 20

      let left = clickPosition.x + 16
      let top = clickPosition.y - 60

      // Prefer right side, but flip to left if needed
      if (left + popoverWidth > viewportWidth - padding) {
        left = clickPosition.x - popoverWidth - 16
      }
      
      // Keep within horizontal bounds
      left = Math.max(padding, Math.min(left, viewportWidth - popoverWidth - padding))

      // Keep within vertical bounds - prioritize showing at top of click
      if (top + popoverHeight > viewportHeight - padding) {
        top = viewportHeight - popoverHeight - padding
      }
      top = Math.max(100, top) // Don't go above header

      setPosition({ top, left })
    }
  }, [open, clickPosition, showMoreOptions])

  // Recalculate position when more options toggled
  useEffect(() => {
    if (open && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const padding = 20

      if (rect.bottom > viewportHeight - padding) {
        const newTop = Math.max(100, viewportHeight - rect.height - padding)
        setPosition(prev => ({ ...prev, top: newTop }))
      }
    }
  }, [showMoreOptions, open])

  // Track whether we've initialized this session
  const hasInitialized = useRef(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open && !hasInitialized.current) {
      hasInitialized.current = true
      
      if (editingBlock) {
        setSurgeonId(editingBlock.surgeon_id)
        setDayOfWeek(editingBlock.day_of_week)
        setStartTime(editingBlock.start_time)
        setEndTime(editingBlock.end_time)
        setRecurrenceType(editingBlock.recurrence_type as RecurrenceType)
        setEffectiveStart(editingBlock.effective_start)
        setEffectiveEnd(editingBlock.effective_end || '')
        setHasEndDate(!!editingBlock.effective_end)
        setShowMoreOptions(!!editingBlock.effective_end)
        setIsCustom(false)
        setCustomRecurrence(null)
      } else {
        // New block - use drag selection values
        setSurgeonId(surgeons[0]?.id || '')
        setDayOfWeek(initialDayOfWeek ?? 1)
        // Use the times from drag selection
        setStartTime(initialStartTime || '07:00:00')
        setEndTime(initialEndTime || '15:00:00')
        setRecurrenceType('weekly')
        setEffectiveStart(new Date().toISOString().split('T')[0])
        setEffectiveEnd('')
        setHasEndDate(false)
        setShowMoreOptions(false)
        setIsCustom(false)
        setCustomRecurrence(null)
      }
      setShowDeleteConfirm(false)
    }
    
    if (!open) {
      hasInitialized.current = false
    }
  }, [open, editingBlock, surgeons, initialDayOfWeek, initialStartTime, initialEndTime])

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return
    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    })
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newLeft = e.clientX - dragOffset.x
      const newTop = e.clientY - dragOffset.y
      
      // Keep within viewport
      const maxLeft = window.innerWidth - 380
      const maxTop = window.innerHeight - 200
      
      setPosition({
        left: Math.max(20, Math.min(newLeft, maxLeft)),
        top: Math.max(80, Math.min(newTop, maxTop)),
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // Close on escape
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  const handleSave = async () => {
    if (!facilityId || !surgeonId) return
    setLoading(true)

    try {
      const surgeon = surgeons.find(s => s.id === surgeonId)
      if (!surgeon) throw new Error('Surgeon not found')

      if (editingBlock) {
        const { error } = await supabase
          .from('block_schedules')
          .update({
            surgeon_id: surgeonId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            recurrence_type: recurrenceType,
            effective_start: effectiveStart,
            effective_end: hasEndDate && effectiveEnd ? effectiveEnd : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBlock.id)

        if (error) throw error

        const surgeonName = `Dr. ${surgeon.last_name}`
        await blockScheduleAudit.updated(
          supabase,
          editingBlock.id,
          surgeonName,
          {
            day_of_week: DAY_OF_WEEK_LABELS[editingBlock.day_of_week],
            start_time: editingBlock.start_time,
            end_time: editingBlock.end_time,
            recurrence: RECURRENCE_LABELS[editingBlock.recurrence_type as RecurrenceType],
          },
          {
            day_of_week: DAY_OF_WEEK_LABELS[dayOfWeek],
            start_time: startTime,
            end_time: endTime,
            recurrence: RECURRENCE_LABELS[recurrenceType],
          },
          facilityId
        )
      } else {
        const { data, error } = await supabase
          .from('block_schedules')
          .insert({
            facility_id: facilityId,
            surgeon_id: surgeonId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            recurrence_type: recurrenceType,
            effective_start: effectiveStart,
            effective_end: hasEndDate && effectiveEnd ? effectiveEnd : null,
          })
          .select()
          .single()

        if (error) throw error

        const surgeonName = `Dr. ${surgeon.last_name}`
        await blockScheduleAudit.created(
          supabase,
          data.id,
          surgeonName,
          DAY_OF_WEEK_LABELS[dayOfWeek],
          startTime,
          endTime,
          RECURRENCE_LABELS[recurrenceType],
          facilityId
        )
      }

      onSave()
    } catch (error) {
      console.error('Error saving block:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!editingBlock) return
    setLoading(true)
    try {
      await onDelete(editingBlock.id)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const isEditing = !!editingBlock
  const selectedSurgeon = surgeons.find(s => s.id === surgeonId)
  const surgeonColor = surgeonId ? (colorMap[surgeonId] || SURGEON_COLOR_PALETTE[0]) : SURGEON_COLOR_PALETTE[0]

  // Calculate duration
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const durationHours = (endH + endM/60) - (startH + startM/60)
  const durationText = durationHours === 1 ? '1 hour' : `${durationHours} hours`

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed z-50 w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Color Bar + Drag Handle */}
        <div 
          className="h-2 cursor-move relative group"
          style={{ backgroundColor: surgeonColor }}
          onMouseDown={handleDragStart}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripHorizontal className="h-4 w-4 text-white/70" />
          </div>
        </div>

        {/* Header */}
        <div 
          className="px-5 pt-4 pb-3 cursor-move"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Block' : 'New Block Time'}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {DAY_OF_WEEK_LABELS[dayOfWeek]} • {durationText}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1.5 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 pb-4 space-y-4">
          {/* Surgeon */}
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${surgeonColor}15` }}
            >
              <User className="h-5 w-5" style={{ color: surgeonColor }} />
            </div>
            <div className="flex-1 relative">
              <select
                value={surgeonId}
                onChange={e => setSurgeonId(e.target.value)}
                className="w-full px-0 py-2 text-base font-medium text-gray-900 bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:ring-0 cursor-pointer appearance-none pr-6"
              >
                {surgeons.map(s => (
                  <option key={s.id} value={s.id}>
                    Dr. {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors"
              >
                {TIME_OPTIONS.map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
              <span className="text-gray-400 font-medium">–</span>
              <select
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors"
              >
                {TIME_OPTIONS.filter(t => t > startTime).map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Day */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5 text-gray-500" />
            </div>
            <select
              value={dayOfWeek}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors"
            >
              {(Object.entries(DAY_OF_WEEK_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Recurrence */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Repeat className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1">
              {isCustom && customRecurrence ? (
                // Custom recurrence display
                <button
                  onClick={() => setShowCustomModal(true)}
                  className="w-full px-3 py-2 text-sm text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-gray-900">{getCustomRecurrenceDescription(customRecurrence)}</span>
                </button>
              ) : (
                <select
                  value={isCustom ? 'custom' : recurrenceType}
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setShowCustomModal(true)
                    } else {
                      setIsCustom(false)
                      setCustomRecurrence(null)
                      setRecurrenceType(e.target.value as RecurrenceType)
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors"
                >
                  {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              )}
            </div>
          </div>

          {/* More Options */}
          {!showMoreOptions ? (
            <button
              onClick={() => setShowMoreOptions(true)}
              className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              More options
            </button>
          ) : (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effective Dates
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Starts</label>
                  <input
                    type="date"
                    value={effectiveStart}
                    onChange={e => setEffectiveStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasEndDate}
                        onChange={e => setHasEndDate(e.target.checked)}
                        className="h-3.5 w-3.5 text-blue-600 rounded"
                      />
                      Ends
                    </label>
                  </label>
                  <input
                    type="date"
                    value={effectiveEnd}
                    onChange={e => setEffectiveEnd(e.target.value)}
                    min={effectiveStart}
                    disabled={!hasEndDate}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          {isEditing ? (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium">Delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete block"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !surgeonId}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Recurrence Modal */}
      <CustomRecurrenceModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={(config) => {
          setCustomRecurrence(config)
          setIsCustom(true)
          setShowCustomModal(false)
          
          // Also update effective dates based on custom config
          if (config.endType === 'on' && config.endDate) {
            setHasEndDate(true)
            setEffectiveEnd(config.endDate)
          } else if (config.endType === 'never') {
            setHasEndDate(false)
            setEffectiveEnd('')
          }
          
          // Set recurrence type to 'weekly' as base (custom config has more detail)
          setRecurrenceType('weekly')
        }}
        initialConfig={customRecurrence || undefined}
        initialDayOfWeek={dayOfWeek}
      />
    </>
  )
}