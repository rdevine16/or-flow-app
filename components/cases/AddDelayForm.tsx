'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

export interface DelayTypeOption {
  id: string
  name: string
  display_name: string | null
}

interface AddDelayFormProps {
  delayTypes: DelayTypeOption[]
  milestoneId: string
  milestoneName: string
  onSubmit: (data: {
    delayTypeId: string
    durationMinutes: number | null
    note: string | null
    facilityMilestoneId: string
  }) => Promise<void>
  onClose: () => void
}

export default function AddDelayForm({
  delayTypes,
  milestoneId,
  milestoneName,
  onSubmit,
  onClose,
}: AddDelayFormProps) {
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [duration, setDuration] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    if (!selectedTypeId) return
    setSaving(true)
    try {
      await onSubmit({
        delayTypeId: selectedTypeId,
        durationMinutes: duration ? parseInt(duration, 10) : null,
        note: note.trim() || null,
        facilityMilestoneId: milestoneId,
      })
      onClose()
    } catch {
      // Error handling done by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Log delay at ${milestoneName}`}
      className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-[14px] border border-slate-200/50 shadow-[0_12px_40px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.04)] p-3.5 space-y-3 w-[280px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          Log Delay — {milestoneName}
        </span>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Delay type grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {delayTypes.map(dt => (
          <button
            key={dt.id}
            onClick={() => setSelectedTypeId(dt.id)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors text-left truncate ${
              selectedTypeId === dt.id
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50/50'
            }`}
          >
            {dt.display_name || dt.name}
          </button>
        ))}
      </div>

      {/* Duration + Note */}
      <div className="flex gap-2">
        <input
          type="number"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          placeholder="Min"
          min={0}
          aria-label="Delay duration in minutes"
          className="w-[60px] text-sm font-mono border border-slate-200/50 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
        />
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Delay note"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          onKeyDown={e => {
            if (e.key === 'Enter' && selectedTypeId) handleSubmit()
          }}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!selectedTypeId || saving}
        className="w-full py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Log Delay'}
      </button>
    </div>
  )
}
