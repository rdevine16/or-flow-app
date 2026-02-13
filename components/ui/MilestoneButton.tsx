'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatters'

interface MilestoneButtonProps {
  displayName: string
  recordedAt?: string | null
  onRecord: () => void
  onUndo: () => void
  disabled?: boolean
  loading?: boolean
  timeZone?: string
}

function formatDuration(startTime: string, endTime: string): string {
  const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function RunningTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('0:00')

  useEffect(() => {
    const updateTimer = () => {
      const diffMs = Date.now() - new Date(startTime).getTime()
      const minutes = Math.floor(diffMs / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
      setElapsed(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return <span>{elapsed}</span>
}

// Single milestone button - clean compact design
export default function MilestoneButton({
  displayName,
  recordedAt,
  onRecord,
  onUndo,
  disabled = false,
  loading = false,
  timeZone,
}: MilestoneButtonProps) {
  const isRecorded = !!recordedAt
  const isDisabled = disabled || loading

  if (isRecorded) {
    return (
      <div className="group relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg">
          <Check className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90 truncate">{displayName}</p>
            <p className="text-sm font-bold tabular-nums">{formatTimestamp(recordedAt, { timeZone })}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          disabled={loading}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
        >
          <X className="w-3 h-3 text-slate-400 hover:text-red-600" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onRecord}
      disabled={isDisabled}
      className={`w-full px-3 py-3 rounded-lg border-2 border-dashed transition-all text-left ${
        isDisabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600'
      }`}
    >
      <p className="text-xs font-medium opacity-70">{displayName}</p>
      <p className="text-sm font-semibold">{loading ? 'Recording...' : 'Tap to record'}</p>
    </button>
  )
}

// Paired milestone button (start/stop) - clean compact design
export function PairedMilestoneButton({
  displayName,
  startRecordedAt,
  endRecordedAt,
  onRecordStart,
  onRecordEnd,
  onUndoStart,
  onUndoEnd,
  disabled = false,
  loading = false,
  timeZone,
}: {
  displayName: string
  startRecordedAt?: string | null
  endRecordedAt?: string | null
  onRecordStart: () => void
  onRecordEnd: () => void
  onUndoStart: () => void
  onUndoEnd: () => void
  disabled?: boolean
  loading?: boolean
  timeZone?: string
}) {
  const hasStarted = !!startRecordedAt
  const hasEnded = !!endRecordedAt
  const isRunning = hasStarted && !hasEnded
  const isComplete = hasStarted && hasEnded
  const isDisabled = disabled || loading

  // Complete state
  if (isComplete) {
    return (
      <div className="group relative">
        <div className="px-3 py-2 bg-green-500 text-white rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs font-medium opacity-90">{displayName}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold tabular-nums">{formatTimestamp(startRecordedAt!, { timeZone })}</span>
            <span className="text-green-200 text-xs">&rarr;</span>
            <span className="font-bold tabular-nums">{formatTimestamp(endRecordedAt!, { timeZone })}</span>
          </div>
          <p className="text-xs text-green-100 mt-1 tabular-nums">{formatDuration(startRecordedAt!, endRecordedAt!)}</p>
        </div>
        <button
          type="button"
          onClick={onUndoEnd}
          disabled={loading}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
        >
          <X className="w-3 h-3 text-slate-400 hover:text-red-600" />
        </button>
      </div>
    )
  }

  // Running state
  if (isRunning) {
    return (
      <div className="group relative">
        <div className="px-3 py-2 bg-amber-500 text-white rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <p className="text-xs font-medium opacity-90">{displayName}</p>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold tabular-nums">{formatTimestamp(startRecordedAt!, { timeZone })}</span>
            <span className="text-sm font-bold tabular-nums text-amber-100">
              <RunningTimer startTime={startRecordedAt!} />
            </span>
          </div>
          <button
            type="button"
            onClick={onRecordEnd}
            disabled={loading}
            className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Stopping...' : 'Stop'}
          </button>
        </div>
        <button
          type="button"
          onClick={onUndoStart}
          disabled={loading}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
        >
          <X className="w-3 h-3 text-slate-400 hover:text-red-600" />
        </button>
      </div>
    )
  }

  // Pending state
  return (
    <button
      type="button"
      onClick={onRecordStart}
      disabled={isDisabled}
      className={`w-full px-3 py-3 rounded-lg border-2 border-dashed transition-all text-left ${
        isDisabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600'
      }`}
    >
      <p className="text-xs font-medium opacity-70">{displayName}</p>
      <p className="text-sm font-semibold">{loading ? 'Recording...' : 'Tap to start'}</p>
    </button>
  )
}
