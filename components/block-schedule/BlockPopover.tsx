// components/block-schedule/BlockPopover.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Loader2, Clock, User, Calendar, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { blockScheduleAudit } from '@/lib/audit-logger'
import {
  BlockSchedule,
  RecurrenceType,
  CreateBlockInput,
  DAY_OF_WEEK_LABELS,
  RECURRENCE_LABELS,
  formatTime12Hour,
} from '@/types/block-scheduling'

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
  editingBlock: BlockSchedule | null
  initialDayOfWeek?: number
  initialStartTime?: string
  initialEndTime?: string
  // Position for popover
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
  const [position, setPosition] = useState({ top: 0, left: 0 })

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

  // Calculate popover position
  useEffect(() => {
    if (open && clickPosition && popoverRef.current) {
      const popover = popoverRef.current
      const rect = popover.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      let left = clickPosition.x + 16 // Offset from click
      let top = clickPosition.y - 100 // Center vertically around click

      // Keep within viewport horizontally
      if (left + rect.width > viewportWidth - 20) {
        left = clickPosition.x - rect.width - 16 // Flip to left side
      }
      if (left < 20) {
        left = 20
      }

      // Keep within viewport vertically
      if (top + rect.height > viewportHeight - 20) {
        top = viewportHeight - rect.height - 20
      }
      if (top < 80) { // Account for header
        top = 80
      }

      setPosition({ top, left })
    }
  }, [open, clickPosition])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingBlock) {
        // Editing mode
        setSurgeonId(editingBlock.surgeon_id)
        setDayOfWeek(editingBlock.day_of_week)
        setStartTime(editingBlock.start_time)
        setEndTime(editingBlock.end_time)
        setRecurrenceType(editingBlock.recurrence_type as RecurrenceType)
        setEffectiveStart(editingBlock.effective_start)
        setEffectiveEnd(editingBlock.effective_end || '')
        setHasEndDate(!!editingBlock.effective_end)
        setShowMoreOptions(true) // Show all options when editing
      } else {
        // Create mode
        setSurgeonId(surgeons[0]?.id || '')
        setDayOfWeek(initialDayOfWeek ?? 1)
        setStartTime(initialStartTime || '07:00:00')
        setEndTime(initialEndTime || '15:00:00')
        setRecurrenceType('weekly')
        setEffectiveStart(new Date().toISOString().split('T')[0])
        setEffectiveEnd('')
        setHasEndDate(false)
        setShowMoreOptions(false)
      }
      setShowDeleteConfirm(false)
    }
  }, [open, editingBlock, surgeons, initialDayOfWeek, initialStartTime, initialEndTime])

  // Close on click outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

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
        // Update existing block
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

        // Audit log
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
        // Create new block
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

        // Audit log
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
  const selectedDayLabel = DAY_OF_WEEK_LABELS[dayOfWeek]
  const selectedSurgeon = surgeons.find(s => s.id === surgeonId)

  return (
    <>
      {/* Backdrop - semi-transparent to indicate popover is open */}
      <div className="fixed inset-0 bg-black/20 z-40" />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-80 overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">
            {isEditing ? 'Edit Block' : 'New Block'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Surgeon Select */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
              <User className="h-3.5 w-3.5" />
              Surgeon
            </label>
            <select
              value={surgeonId}
              onChange={e => setSurgeonId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {surgeons.map(s => (
                <option key={s.id} value={s.id}>
                  Dr. {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Day
            </label>
            <select
              value={dayOfWeek}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {(Object.entries(DAY_OF_WEEK_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
              <Clock className="h-3.5 w-3.5" />
              Time
            </label>
            <div className="flex items-center gap-2">
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {TIME_OPTIONS.map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
              <span className="text-slate-400">–</span>
              <select
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {TIME_OPTIONS.filter(t => t > startTime).map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence - Compact */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Repeats
            </label>
            <select
              value={recurrenceType}
              onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label.replace('week', selectedDayLabel)}
                </option>
              ))}
            </select>
          </div>

          {/* More Options Toggle */}
          {!showMoreOptions && (
            <button
              onClick={() => setShowMoreOptions(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              More options...
            </button>
          )}

          {/* Effective Dates (expanded) */}
          {showMoreOptions && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Starts
                </label>
                <input
                  type="date"
                  value={effectiveStart}
                  onChange={e => setEffectiveStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasEndDate}
                    onChange={e => setHasEndDate(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                  />
                  <span className="text-sm text-slate-700">Set end date</span>
                </label>
                {hasEndDate && (
                  <input
                    type="date"
                    value={effectiveEnd}
                    onChange={e => setEffectiveEnd(e.target.value)}
                    min={effectiveStart}
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          {isEditing ? (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !surgeonId}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}