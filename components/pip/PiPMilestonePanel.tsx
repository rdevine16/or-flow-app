'use client'

import { useState, useEffect, useCallback } from 'react'

interface Milestone {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id?: string | null
  pair_position?: 'start' | 'end' | null
}

interface RecordedMilestone {
  id: string
  facility_milestone_id: string
  recorded_at: string
}

interface PiPMilestonePanelProps {
  caseId: string
  caseNumber: string
  procedureName: string
  roomName: string
  surgeonName: string
  milestones: Milestone[]
  recordedMilestones: RecordedMilestone[]
  onRecordMilestone: (milestoneId: string) => Promise<void>
  onUndoMilestone: (recordedId: string) => Promise<void>
  onClose: () => void
  onRefresh: () => void
}

// Format timestamp to readable time
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Calculate elapsed time between two timestamps
function getElapsedTime(start: string, end?: string): string {
  const startTime = new Date(start).getTime()
  const endTime = end ? new Date(end).getTime() : Date.now()
  const diffMs = endTime - startTime
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export default function PiPMilestonePanel({
  caseId,
  caseNumber,
  procedureName,
  roomName,
  surgeonName,
  milestones,
  recordedMilestones,
  onRecordMilestone,
  onUndoMilestone,
  onClose,
  onRefresh,
}: PiPMilestonePanelProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for elapsed timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Get recorded milestone by facility_milestone_id
  const getRecorded = useCallback((milestoneId: string) => {
    return recordedMilestones.find(rm => rm.facility_milestone_id === milestoneId)
  }, [recordedMilestones])

  // Get partner milestone for paired milestones
  const getPartner = useCallback((milestone: Milestone) => {
    if (!milestone.pair_with_id) return null
    return milestones.find(m => m.id === milestone.pair_with_id)
  }, [milestones])

  // Handle recording a milestone
  const handleRecord = async (milestoneId: string) => {
    setLoading(milestoneId)
    try {
      await onRecordMilestone(milestoneId)
    } finally {
      setLoading(null)
    }
  }

  // Handle undoing a milestone
  const handleUndo = async (recordedId: string, milestoneId: string) => {
    setLoading(milestoneId)
    try {
      await onUndoMilestone(recordedId)
    } finally {
      setLoading(null)
    }
  }

  // Calculate progress
  const recordedCount = recordedMilestones.length
  const totalCount = milestones.length
  const progress = totalCount > 0 ? (recordedCount / totalCount) * 100 : 0

  // Get patient_in time for total elapsed
  const patientInMilestone = milestones.find(m => m.name === 'patient_in')
  const patientInRecorded = patientInMilestone ? getRecorded(patientInMilestone.id) : null
  const totalElapsed = patientInRecorded ? getElapsedTime(patientInRecorded.recorded_at) : null

  // Filter milestones - only show "start" position for pairs, all singles
  const displayMilestones = milestones.filter(m => 
    m.pair_position !== 'end'
  ).sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* ORbit Logo */}
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">{roomName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Case Info */}
        <div className="mt-1">
          <div className="text-xs text-slate-500">{caseNumber}</div>
          <div className="text-sm font-medium text-slate-700 truncate">{procedureName}</div>
          <div className="text-xs text-slate-500">{surgeonName}</div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{recordedCount}/{totalCount}</span>
        </div>

        {/* Total Elapsed */}
        {totalElapsed && (
          <div className="mt-1 text-xs text-slate-500">
            Total: <span className="font-medium text-slate-700">{totalElapsed}</span>
          </div>
        )}
      </div>

      {/* Milestones List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {displayMilestones.map((milestone) => {
          const recorded = getRecorded(milestone.id)
          const isPaired = milestone.pair_position === 'start'
          const partner = isPaired ? getPartner(milestone) : null
          const partnerRecorded = partner ? getRecorded(partner.id) : null

          // Paired milestone (Start/Stop)
          if (isPaired && partner) {
            const isStarted = !!recorded
            const isCompleted = isStarted && !!partnerRecorded
            const isRunning = isStarted && !isCompleted

            return (
              <div
                key={milestone.id}
                className={`
                  rounded-lg border p-2 transition-colors
                  ${isCompleted 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : isRunning 
                      ? 'bg-amber-50 border-amber-200' 
                      : 'bg-white border-slate-200'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isRunning ? (
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    ) : (
                      <span className="w-4 h-4 border-2 border-slate-300 rounded-full" />
                    )}
                    <span className={`text-sm font-medium ${isCompleted ? 'text-emerald-700' : isRunning ? 'text-amber-700' : 'text-slate-700'}`}>
                      {milestone.display_name.replace(' Start', '').replace(' End', '')}
                    </span>
                  </div>

                  {/* Times */}
                  {isRunning && recorded && (
                    <span className="text-xs font-medium text-amber-600 tabular-nums">
                      {getElapsedTime(recorded.recorded_at)}
                    </span>
                  )}
                  {isCompleted && recorded && partnerRecorded && (
                    <span className="text-xs text-emerald-600 tabular-nums">
                      {getElapsedTime(recorded.recorded_at, partnerRecorded.recorded_at)}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-1.5 flex gap-1.5">
                  {!isStarted ? (
                    <button
                      onClick={() => handleRecord(milestone.id)}
                      disabled={loading === milestone.id}
                      className="flex-1 py-1.5 px-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-xs font-medium rounded transition-colors"
                    >
                      {loading === milestone.id ? '...' : '▶ Start'}
                    </button>
                  ) : !isCompleted ? (
                    <>
                      <button
                        onClick={() => handleUndo(recorded!.id, milestone.id)}
                        disabled={loading === milestone.id}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded transition-colors"
                      >
                        Undo
                      </button>
                      <button
                        onClick={() => handleRecord(partner.id)}
                        disabled={loading === partner.id}
                        className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-medium rounded transition-colors"
                      >
                        {loading === partner.id ? '...' : '■ Stop'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUndo(partnerRecorded!.id, partner.id)}
                      disabled={loading === partner.id}
                      className="flex-1 py-1 px-2 text-slate-500 hover:text-slate-700 text-xs transition-colors"
                    >
                      Undo Stop
                    </button>
                  )}
                </div>

                {/* Timestamps */}
                {(recorded || partnerRecorded) && (
                  <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
                    {recorded && <span>Start: {formatTime(recorded.recorded_at)}</span>}
                    {partnerRecorded && <span>Stop: {formatTime(partnerRecorded.recorded_at)}</span>}
                  </div>
                )}
              </div>
            )
          }

          // Single milestone
          const isRecorded = !!recorded
          const isPatientIn = milestone.name === 'patient_in'
          const isPatientOut = milestone.name === 'patient_out'

          return (
            <div
              key={milestone.id}
              className={`
                rounded-lg border p-2 transition-colors
                ${isRecorded 
                  ? isPatientOut
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-emerald-50 border-emerald-200' 
                  : isPatientIn
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-slate-200'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isRecorded ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`w-4 h-4 border-2 rounded-full ${isPatientIn ? 'border-blue-400' : 'border-slate-300'}`} />
                  )}
                  <span className={`text-sm font-medium ${isRecorded ? 'text-emerald-700' : isPatientIn ? 'text-blue-700' : 'text-slate-700'}`}>
                    {milestone.display_name}
                  </span>
                </div>

                {isRecorded && recorded && (
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatTime(recorded.recorded_at)}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-1.5">
                {!isRecorded ? (
                  <button
                    onClick={() => handleRecord(milestone.id)}
                    disabled={loading === milestone.id}
                    className={`
                      w-full py-1.5 px-2 text-white text-xs font-medium rounded transition-colors
                      ${isPatientIn 
                        ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300' 
                        : 'bg-slate-500 hover:bg-slate-600 disabled:bg-slate-300'
                      }
                    `}
                  >
                    {loading === milestone.id ? 'Recording...' : 'Record'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUndo(recorded!.id, milestone.id)}
                    disabled={loading === milestone.id}
                    className="w-full py-1 px-2 text-slate-500 hover:text-slate-700 text-xs transition-colors"
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-between">
        <button
          onClick={onRefresh}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <span className="text-[10px] text-slate-400">
          ORbit • Picture-in-Picture
        </span>
      </div>
    </div>
  )
}