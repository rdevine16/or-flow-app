// components/block-schedule/BlockDialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { blockScheduleAudit } from '@/lib/audit-logger'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import {
  BlockSchedule,
  RecurrenceType,
  DAY_OF_WEEK_LABELS,
  RECURRENCE_LABELS,
  formatTime12Hour,
} from "@/types/block-scheduling"
import { logger } from "@/lib/logger"

const log = logger("BlockDialog")

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface BlockDialogProps {
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
}

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 5 // 5 AM to 6 PM
  const minutes = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
})

export function BlockDialog({
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
}: BlockDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

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
      }
      setShowDelete(false)
    }
  }, [open, editingBlock, surgeons, initialDayOfWeek, initialStartTime, initialEndTime])

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
      log.error('Error saving block:', error)
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Block' : 'New Block Time'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* Surgeon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Surgeon
            </label>
            <select
              value={surgeonId}
              onChange={e => setSurgeonId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {surgeons.map(s => (
                <option key={s.id} value={s.id}>
                  Dr. {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day
            </label>
            <select
              value={dayOfWeek}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIME_OPTIONS.map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <select
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIME_OPTIONS.filter(t => t > startTime).map(time => (
                  <option key={time} value={time}>
                    {formatTime12Hour(time)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequency
            </label>
            <div className="space-y-2">
              {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrence"
                    value={value}
                    checked={recurrenceType === value}
                    onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {label.replace('week', selectedDayLabel)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Effective Dates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starts
            </label>
            <input
              type="date"
              value={effectiveStart}
              onChange={e => setEffectiveStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <span className="text-sm text-gray-700">Set end date</span>
            </label>
            {hasEndDate && (
              <input
                type="date"
                value={effectiveEnd}
                onChange={e => setEffectiveEnd(e.target.value)}
                min={effectiveStart}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {isEditing ? (
            <div>
                <button
                  onClick={() => setShowDelete(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !surgeonId}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Block'}
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirm
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        itemName={editingBlock ? `${DAY_OF_WEEK_LABELS[editingBlock.day_of_week]} block` : ''}
        itemType="block"
      />
    </div>
  )
}