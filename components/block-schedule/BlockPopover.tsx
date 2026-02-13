// components/block-schedule/BlockPopover.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Trash2, Loader2, Clock, User, Calendar, Repeat, GripHorizontal, ChevronDown, Copy, FileText, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'

import {
  BlockSchedule,
  ExpandedBlock,
  CreateBlockInput,
  UpdateBlockInput,
  RecurrenceType,
  DAY_OF_WEEK_LABELS,
  RECURRENCE_LABELS,
  formatTime12Hour,
} from '@/types/block-scheduling'
import { surgeonPalette } from '@/lib/design-tokens'
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
  onDuplicate?: (block: BlockSchedule) => void
  facilityId: string | null
  surgeons: Surgeon[]
  colorMap: Record<string, string>
  editingBlock: BlockSchedule | null
  allBlocks: ExpandedBlock[]
  initialDayOfWeek?: number
  initialStartTime?: string
  initialEndTime?: string
  clickPosition?: { x: number; y: number }
  currentWeekStart?: Date
  // Delegated DB operations from hook
  onCreateBlock: (input: CreateBlockInput, surgeon: Surgeon) => Promise<BlockSchedule | null>
  onUpdateBlock: (
    blockId: string,
    input: UpdateBlockInput & { surgeon_id?: string; effective_start?: string },
    surgeon: Surgeon,
    oldValues: Partial<BlockSchedule>
  ) => Promise<boolean>
  loading?: boolean
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
})

function getDateForDayInWeek(weekStart: Date, dayOfWeek: number): string {
  const weekStartDay = weekStart.getDay()
  const offset = dayOfWeek - weekStartDay
  const target = new Date(weekStart)
  target.setDate(weekStart.getDate() + offset)
  return target.toISOString().split('T')[0]
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA
}

function getSurgeonBlockLoad(
  surgeonId: string,
  allBlocks: ExpandedBlock[]
): { totalHours: number; summary: string } {
  const surgeonBlocks = allBlocks.filter(b => b.surgeon_id === surgeonId)
  const uniqueByBlockId = new Map<string, ExpandedBlock>()
  for (const b of surgeonBlocks) {
    if (!uniqueByBlockId.has(b.block_id)) uniqueByBlockId.set(b.block_id, b)
  }

  const unique = Array.from(uniqueByBlockId.values())
  if (unique.length === 0) return { totalHours: 0, summary: '' }

  let totalMinutes = 0
  const parts: string[] = []

  for (const b of unique) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    totalMinutes += (eh * 60 + em) - (sh * 60 + sm)
    const dayAbbr = DAY_OF_WEEK_LABELS[new Date(b.block_date + 'T00:00:00').getDay()]?.slice(0, 3)
    const startFmt = formatTimeShort(b.start_time)
    const endFmt = formatTimeShort(b.end_time)
    parts.push(`${dayAbbr} ${startFmt}-${endFmt}`)
  }

  const totalHours = Math.round(totalMinutes / 60 * 10) / 10
  return { totalHours, summary: `${parts.join(', ')}  (${totalHours}h/wk)` }
}

function formatTimeShort(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'p' : 'a'
  const hour12 = hours % 12 || 12
  if (minutes === 0) return `${hour12}${period}`
  return `${hour12}:${minutes.toString().padStart(2, '0')}${period}`
}

export function BlockPopover({
  open,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  facilityId,
  surgeons,
  colorMap,
  editingBlock,
  allBlocks,
  initialDayOfWeek,
  initialStartTime,
  initialEndTime,
  clickPosition,
  currentWeekStart,
  onCreateBlock,
  onUpdateBlock,
  loading: externalLoading,
}: BlockPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [position, setPosition] = useState({ top: 100, left: 100 })

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Form state
  const [surgeonId, setSurgeonId] = useState<string>('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [startTime, setStartTime] = useState<string>('07:00:00')
  const [endTime, setEndTime] = useState<string>('15:00:00')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly')
  const [effectiveStart, setEffectiveStart] = useState<string>(new Date().toISOString().split('T')[0])
  const [effectiveEnd, setEffectiveEnd] = useState<string>('')
  const [hasEndDate, setHasEndDate] = useState(false)
  const [notes, setNotes] = useState<string>('')

  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customRecurrence, setCustomRecurrence] = useState<CustomRecurrenceConfig | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)

  const loading = saving || externalLoading

  // Position: clamp to viewport
  const calculatePosition = useCallback((click?: { x: number; y: number }) => {
    if (!click) return
    const popoverWidth = 360
    const popoverHeight = showMoreOptions ? 600 : 480
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 16

    let left = click.x + 16
    let top = click.y - 60

    if (left + popoverWidth > vw - pad) left = click.x - popoverWidth - 16
    left = Math.max(pad, Math.min(left, vw - popoverWidth - pad))
    if (top + popoverHeight > vh - pad) top = vh - popoverHeight - pad
    top = Math.max(80, top)

    setPosition({ top, left })
  }, [showMoreOptions])

  useEffect(() => {
    if (open && clickPosition) calculatePosition(clickPosition)
  }, [open, clickPosition, calculatePosition])

  useEffect(() => {
    if (open && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      if (rect.bottom > vh - 16) {
        setPosition(prev => ({ ...prev, top: Math.max(80, vh - rect.height - 16) }))
      }
    }
  }, [showMoreOptions, open])

  const hasInitialized = useRef(false)

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
        setShowMoreOptions(!!editingBlock.effective_end || !!editingBlock.notes)
        setNotes(editingBlock.notes || '')
        setIsCustom(false)
        setCustomRecurrence(null)
      } else {
        setSurgeonId(surgeons[0]?.id || '')
        setDayOfWeek(initialDayOfWeek ?? 1)
        setStartTime(initialStartTime || '07:00:00')
        setEndTime(initialEndTime || '15:00:00')
        setRecurrenceType('weekly')
        if (currentWeekStart && initialDayOfWeek !== undefined) {
          setEffectiveStart(getDateForDayInWeek(currentWeekStart, initialDayOfWeek))
        } else {
          setEffectiveStart(new Date().toISOString().split('T')[0])
        }
        setEffectiveEnd('')
        setHasEndDate(false)
        setShowMoreOptions(false)
        setNotes('')
        setIsCustom(false)
        setCustomRecurrence(null)
      }
      setShowDelete(false)
      setOverlapWarning(null)
    }
    if (!open) hasInitialized.current = false
  }, [open, editingBlock, surgeons, initialDayOfWeek, initialStartTime, initialEndTime, currentWeekStart])

  const handleDayOfWeekChange = (newDay: number) => {
    setDayOfWeek(newDay)
    if (!editingBlock && currentWeekStart) {
      setEffectiveStart(getDateForDayInWeek(currentWeekStart, newDay))
    }
  }

  // Overlap detection
  useEffect(() => {
    if (!open) { setOverlapWarning(null); return }
    const conflicting = allBlocks.filter(b => {
      if (editingBlock && b.block_id === editingBlock.id) return false
      if (new Date(b.block_date + 'T00:00:00').getDay() !== dayOfWeek) return false
      return timesOverlap(startTime, endTime, b.start_time, b.end_time)
    })
    if (conflicting.length > 0) {
      const names = [...new Set(conflicting.map(b => `Dr. ${b.surgeon_last_name}`))]
      setOverlapWarning(`Overlaps with ${names.join(', ')} on ${DAY_OF_WEEK_LABELS[dayOfWeek]}`)
    } else {
      setOverlapWarning(null)
    }
  }, [open, dayOfWeek, startTime, endTime, allBlocks, editingBlock])

  // Popover drag
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, textarea')) return
    e.preventDefault()
    setIsDragging(true)
    setDragOffset({ x: e.clientX - position.left, y: e.clientY - position.top })
  }, [position])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      setPosition({
        left: Math.max(20, Math.min(e.clientX - dragOffset.x, window.innerWidth - 380)),
        top: Math.max(80, Math.min(e.clientY - dragOffset.y, window.innerHeight - 200)),
      })
    }
    const onUp = () => setIsDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [isDragging, dragOffset])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Save delegates to hook
  const { showToast } = useToast()
  const handleSave = async () => {
    if (!facilityId || !surgeonId) return
    setSaving(true)
    try {
      const surgeon = surgeons.find(s => s.id === surgeonId)
      if (!surgeon) throw new Error('Surgeon not found')

      if (editingBlock) {
        const success = await onUpdateBlock(
          editingBlock.id,
          {
            surgeon_id: surgeonId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            recurrence_type: recurrenceType,
            effective_start: effectiveStart,
            effective_end: hasEndDate && effectiveEnd ? effectiveEnd : null,
            notes: notes.trim() || null,
          },
          surgeon,
          editingBlock
        )
        if (!success) throw new Error('Update failed')
      } else {
        const result = await onCreateBlock(
          {
            surgeon_id: surgeonId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            recurrence_type: recurrenceType,
            effective_start: effectiveStart,
            effective_end: hasEndDate && effectiveEnd ? effectiveEnd : null,
            notes: notes.trim() || null,
          },
          surgeon
        )
        if (!result) throw new Error('Create failed')
      }
      onSave()
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to Save Block',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingBlock) return
    setSaving(true)
    try { await onDelete(editingBlock.id); onClose() } finally { setSaving(false) }
  }

  const handleDuplicate = () => {
    if (!editingBlock || !onDuplicate) return
    onDuplicate(editingBlock)
  }

  if (!open) return null

  const isEditing = !!editingBlock
  const surgeonColor = surgeonId ? (colorMap[surgeonId] || surgeonPalette.hex[0]) : surgeonPalette.hex[0]
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const durationHours = (endH + endM / 60) - (startH + startM / 60)
  const durationText = durationHours === 1 ? '1 hour' : `${durationHours} hours`
  const surgeonLoad = surgeonId ? getSurgeonBlockLoad(surgeonId, allBlocks) : null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={popoverRef}
        className="fixed z-50 w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          maxHeight: 'calc(100vh - 100px)',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Color Bar + Drag Handle */}
        <div
          className="h-2 cursor-move relative group flex-shrink-0"
          style={{ backgroundColor: surgeonColor }}
          onMouseDown={handleDragStart}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripHorizontal className="h-4 w-4 text-white/70" />
          </div>
        </div>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 cursor-move flex-shrink-0" onMouseDown={handleDragStart}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Block' : 'New Block Time'}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {DAY_OF_WEEK_LABELS[dayOfWeek]} • {durationText}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 -mr-1.5 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 pb-4 space-y-4">
            {/* Surgeon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${surgeonColor}15` }}>
                <User className="h-5 w-5" style={{ color: surgeonColor }} />
              </div>
              <div className="flex-1">
                <div className="relative">
                  <select
                    value={surgeonId}
                    onChange={e => setSurgeonId(e.target.value)}
                    className="w-full px-0 py-2 text-base font-medium text-gray-900 bg-transparent border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:ring-0 cursor-pointer appearance-none pr-6"
                  >
                    {surgeons.map(s => (
                      <option key={s.id} value={s.id}>Dr. {s.first_name} {s.last_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {surgeonLoad && surgeonLoad.totalHours > 0 && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{surgeonLoad.summary}</p>
                )}
              </div>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex-1 flex items-center gap-2">
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors">
                  {TIME_OPTIONS.map(time => (<option key={time} value={time}>{formatTime12Hour(time)}</option>))}
                </select>
                <span className="text-gray-400 font-medium">–</span>
                <select value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors">
                  {TIME_OPTIONS.filter(t => t > startTime).map(time => (<option key={time} value={time}>{formatTime12Hour(time)}</option>))}
                </select>
              </div>
            </div>

            {/* Day */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-gray-500" />
              </div>
              <select value={dayOfWeek} onChange={e => handleDayOfWeekChange(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors">
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
                  <button onClick={() => setShowCustomModal(true)}
                    className="w-full px-3 py-2 text-sm text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="text-gray-900">{getCustomRecurrenceDescription(customRecurrence)}</span>
                  </button>
                ) : (
                  <select
                    value={isCustom ? 'custom' : recurrenceType}
                    onChange={e => {
                      if (e.target.value === 'custom') { setShowCustomModal(true) }
                      else { setIsCustom(false); setCustomRecurrence(null); setRecurrenceType(e.target.value as RecurrenceType) }
                    }}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-100 transition-colors">
                    {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                    <option value="custom">Custom...</option>
                  </select>
                )}
              </div>
            </div>

            {/* Overlap Warning */}
            {overlapWarning && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">{overlapWarning}</p>
              </div>
            )}

            {/* More Options */}
            {!showMoreOptions ? (
              <button onClick={() => setShowMoreOptions(true)}
                className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                More options
              </button>
            ) : (
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Effective Dates</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Starts</label>
                    <input type="date" value={effectiveStart} onChange={e => setEffectiveStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={hasEndDate} onChange={e => setHasEndDate(e.target.checked)} className="h-3.5 w-3.5 text-blue-600 rounded" />
                        Ends
                      </label>
                    </label>
                    <input type="date" value={effectiveEnd} onChange={e => setEffectiveEnd(e.target.value)} min={effectiveStart} disabled={!hasEndDate}
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                </div>
                {/* Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</label>
                  </div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g., Knee cases only, alternates with Dr. Smith..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder:text-gray-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — always visible */}
        <div className="px-4 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
                  <button onClick={() => setShowDelete(true)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete block">
                    <Trash2 className="h-5 w-5" />
                  </button>
                  {onDuplicate && (
                    <button onClick={handleDuplicate}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicate to another day">
                      <Copy className="h-5 w-5" />
                    </button>
                  )}
            </div>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={loading || !surgeonId}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      <CustomRecurrenceModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={(config) => {
          setCustomRecurrence(config); setIsCustom(true); setShowCustomModal(false)
          if (config.endType === 'on' && config.endDate) { setHasEndDate(true); setEffectiveEnd(config.endDate) }
          else if (config.endType === 'never') { setHasEndDate(false); setEffectiveEnd('') }
          setRecurrenceType('weekly')
        }}
        initialConfig={customRecurrence || undefined}
        initialDayOfWeek={dayOfWeek}
      />

      <DeleteConfirm
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        itemName={editingBlock ? `${DAY_OF_WEEK_LABELS[editingBlock.day_of_week]} block` : ''}
        itemType="block"
      />
    </>
  )
}