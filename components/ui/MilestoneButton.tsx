'use client'

import { useState, useEffect } from 'react'

interface MilestoneButtonProps {
  name: string
  displayName: string
  recordedAt?: string | null
  onRecord: () => void
  onUndo: () => void
  disabled?: boolean
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
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
  name,
  displayName,
  recordedAt,
  onRecord,
  onUndo,
  disabled = false,
}: MilestoneButtonProps) {
  const isRecorded = !!recordedAt

  if (isRecorded) {
    return (
      <div className="group relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90 truncate">{displayName}</p>
            <p className="text-sm font-bold tabular-nums">{formatTime(recordedAt)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200"
        >
          <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onRecord}
      disabled={disabled}
      className={`w-full px-3 py-3 rounded-lg border-2 border-dashed transition-all text-left ${
        disabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600'
      }`}
    >
      <p className="text-xs font-medium opacity-70">{displayName}</p>
      <p className="text-sm font-semibold">Tap to record</p>
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
}: {
  displayName: string
  startRecordedAt?: string | null
  endRecordedAt?: string | null
  onRecordStart: () => void
  onRecordEnd: () => void
  onUndoStart: () => void
  onUndoEnd: () => void
  disabled?: boolean
}) {
  const hasStarted = !!startRecordedAt
  const hasEnded = !!endRecordedAt
  const isRunning = hasStarted && !hasEnded
  const isComplete = hasStarted && hasEnded

  // Complete state
  if (isComplete) {
    return (
      <div className="group relative">
        <div className="px-3 py-2 bg-emerald-500 text-white rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs font-medium opacity-90">{displayName}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold tabular-nums">{formatTime(startRecordedAt!)}</span>
            <span className="text-emerald-200 text-xs">→</span>
            <span className="font-bold tabular-nums">{formatTime(endRecordedAt!)}</span>
          </div>
          <p className="text-xs text-emerald-100 mt-1 tabular-nums">{formatDuration(startRecordedAt!, endRecordedAt!)}</p>
        </div>
        <button
          type="button"
          onClick={onUndoEnd}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200"
        >
          <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
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
            <span className="text-sm font-bold tabular-nums">{formatTime(startRecordedAt!)}</span>
            <span className="text-sm font-bold tabular-nums text-amber-100">
              <RunningTimer startTime={startRecordedAt!} />
            </span>
          </div>
          <button
            type="button"
            onClick={onRecordEnd}
            className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors"
          >
            Stop
          </button>
        </div>
        <button
          type="button"
          onClick={onUndoStart}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-200"
        >
          <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  // Pending state
  return (
    <button
      type="button"
      onClick={onRecordStart}
      disabled={disabled}
      className={`w-full px-3 py-3 rounded-lg border-2 border-dashed transition-all text-left ${
        disabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600'
      }`}
    >
      <p className="text-xs font-medium opacity-70">{displayName}</p>
      <p className="text-sm font-semibold">Tap to start</p>
    </button>
  )
}
