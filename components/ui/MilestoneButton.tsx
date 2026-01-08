'use client'

import { useState, useEffect } from 'react'

interface MilestoneButtonProps {
  name: string
  displayName: string
  recordedAt?: string | null
  onRecord: () => void
  onUndo: () => void
  disabled?: boolean
  // For paired milestones (start/stop)
  isPaired?: boolean
  pairType?: 'start' | 'end'
  pairedRecordedAt?: string | null // The other milestone's time
  onRecordPaired?: () => void // Record the paired milestone
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
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
  const [elapsed, setElapsed] = useState('00:00')

  useEffect(() => {
    const updateTimer = () => {
      const diffMs = Date.now() - new Date(startTime).getTime()
      const minutes = Math.floor(diffMs / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
      setElapsed(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return <span className="font-mono text-amber-600">{elapsed}</span>
}

// Single milestone (non-paired)
export default function MilestoneButton({
  name,
  displayName,
  recordedAt,
  onRecord,
  onUndo,
  disabled = false,
}: MilestoneButtonProps) {
  const isRecorded = !!recordedAt

  return (
    <div
      className={`relative rounded-xl border h-full flex flex-col transition-all duration-200 ${
        isRecorded
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-2 border-b ${isRecorded ? 'border-emerald-200 bg-emerald-100/50' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${isRecorded ? 'text-emerald-800' : 'text-slate-700'}`}>
            {displayName}
          </span>
          {isRecorded && (
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col items-center justify-center">
        {isRecorded ? (
          <>
            <div className="text-xl font-bold text-emerald-700 font-mono">
              {formatTime(recordedAt)}
            </div>
            <button
              type="button"
              onClick={onUndo}
              className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Undo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRecord}
            disabled={disabled}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              disabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm'
            }`}
          >
            Record
          </button>
        )}
      </div>
    </div>
  )
}

// Paired milestone (start/stop like Anesthesia, Draping)
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

  // Determine state
  let state: 'pending' | 'running' | 'complete' = 'pending'
  if (isComplete) state = 'complete'
  else if (isRunning) state = 'running'

  const bgColors = {
    pending: 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md',
    running: 'bg-amber-50 border-amber-300',
    complete: 'bg-emerald-50 border-emerald-200',
  }

  const headerColors = {
    pending: 'border-slate-100 bg-slate-50',
    running: 'border-amber-200 bg-amber-100/50',
    complete: 'border-emerald-200 bg-emerald-100/50',
  }

  const textColors = {
    pending: 'text-slate-700',
    running: 'text-amber-800',
    complete: 'text-emerald-800',
  }

  return (
    <div className={`relative rounded-xl border h-full flex flex-col transition-all duration-200 ${bgColors[state]}`}>
      {/* Header */}
      <div className={`px-4 py-2 border-b ${headerColors[state]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${textColors[state]}`}>
            {displayName}
          </span>
          {isComplete && (
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isRunning && (
            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-[120px]">
        {state === 'pending' && (
          <button
            type="button"
            onClick={onRecordStart}
            disabled={disabled}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              disabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start
          </button>
        )}

        {state === 'running' && (
          <>
            <div className="text-xs text-amber-600 mb-1">Started</div>
            <div className="text-lg font-bold text-amber-700 font-mono mb-2">
              {formatTime(startRecordedAt!)}
            </div>
            <div className="text-xs text-amber-600 mb-1">Elapsed</div>
            <div className="text-lg font-bold mb-3">
              <RunningTimer startTime={startRecordedAt!} />
            </div>
            <button
              type="button"
              onClick={onRecordEnd}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
            <button
              type="button"
              onClick={onUndoStart}
              className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Undo Start
            </button>
          </>
        )}

        {state === 'complete' && (
          <>
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <span className="text-lg font-bold font-mono">{formatTime(startRecordedAt!)}</span>
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span className="text-lg font-bold font-mono">{formatTime(endRecordedAt!)}</span>
            </div>
            <div className="text-sm text-emerald-600 font-medium">
              {formatDuration(startRecordedAt!, endRecordedAt!)} duration
            </div>
            <button
              type="button"
              onClick={onUndoEnd}
              className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  )
}
