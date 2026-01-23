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

// Format elapsed time as MM:SS or HHH:MM
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
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
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [activeIndex, setActiveIndex] = useState(0)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
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

  // Build display items (only show "start" position for pairs)
  const displayItems = milestones
    .filter(m => m.pair_position !== 'end')
    .sort((a, b) => a.display_order - b.display_order)
    .map(milestone => {
      const recorded = getRecorded(milestone.id)
      const isPaired = milestone.pair_position === 'start'
      const partner = isPaired ? getPartner(milestone) : null
      const partnerRecorded = partner ? getRecorded(partner.id) : null

      const isComplete = isPaired ? !!partnerRecorded : !!recorded
      const isInProgress = isPaired ? (!!recorded && !partnerRecorded) : false
      const isNotStarted = !recorded

      // Calculate elapsed time for in-progress milestones
      let elapsedMs = 0
      if (isInProgress && recorded) {
        elapsedMs = currentTime - new Date(recorded.recorded_at).getTime()
      }

      return {
        milestone,
        recorded,
        isPaired,
        partner,
        partnerRecorded,
        isComplete,
        isInProgress,
        isNotStarted,
        elapsedMs,
        displayName: milestone.display_name.replace(/ Start$/i, ''),
      }
    })

  // Find the current active milestone (first not completed, or last if all done)
  useEffect(() => {
    const firstIncomplete = displayItems.findIndex(item => !item.isComplete)
    if (firstIncomplete !== -1) {
      setActiveIndex(firstIncomplete)
    } else {
      setActiveIndex(displayItems.length - 1)
    }
  }, [recordedMilestones.length])

  const activeItem = displayItems[activeIndex]
  const completedCount = displayItems.filter(i => i.isComplete).length
  const totalCount = displayItems.length

  // Calculate total case time (from patient_in)
  const patientInMilestone = milestones.find(m => m.name === 'patient_in')
  const patientInRecorded = patientInMilestone ? getRecorded(patientInMilestone.id) : null
  const totalCaseMs = patientInRecorded 
    ? currentTime - new Date(patientInRecorded.recorded_at).getTime()
    : 0

  // Handle actions
  const handleRecord = async (milestoneId: string) => {
    setLoading(milestoneId)
    try {
      await onRecordMilestone(milestoneId)
    } finally {
      setLoading(null)
    }
  }

  const handleUndo = async (recordedId: string) => {
    setLoading('undo')
    try {
      await onUndoMilestone(recordedId)
    } finally {
      setLoading(null)
    }
  }

  // Navigate between milestones
  const goNext = () => setActiveIndex(Math.min(activeIndex + 1, displayItems.length - 1))
  const goPrev = () => setActiveIndex(Math.max(activeIndex - 1, 0))

  if (!activeItem) return null

  // Determine colors based on state
  const getAccentColor = () => {
    if (activeItem.isComplete) return { ring: '#10b981', text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' } // green
    if (activeItem.isInProgress) return { ring: '#f59e0b', text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' } // amber
    return { ring: '#3b82f6', text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' } // blue
  }
  const accent = getAccentColor()

  return (
    <div className="min-h-screen bg-black flex flex-col text-white select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" strokeWidth={2} />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/90">{roomName}</p>
            <p className="text-[10px] text-white/50">{caseNumber}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Total Time Card */}
      {patientInRecorded && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Total Case</span>
            </div>
            <span className="text-xs text-white/50">Started {formatTime(patientInRecorded.recorded_at)}</span>
          </div>
          <p className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {formatElapsed(totalCaseMs)}
          </p>
        </div>
      )}

      {/* Main Content - Current Milestone */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        
        {/* Circular Progress Indicator */}
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={accent.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(completedCount / totalCount) * 264} 264`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {activeItem.isComplete ? (
              <svg className="w-10 h-10" fill="none" stroke={accent.ring} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : activeItem.isInProgress ? (
              <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: accent.ring }} />
            ) : (
              <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: accent.ring }} />
            )}
          </div>
        </div>

        {/* Milestone Name */}
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          {activeItem.displayName}
        </h2>

        {/* Timer / Status */}
        {activeItem.isInProgress && (
          <p className="text-5xl font-bold font-mono tabular-nums mb-6" style={{ color: accent.text }}>
            {formatElapsed(activeItem.elapsedMs)}
          </p>
        )}

        {activeItem.isComplete && activeItem.recorded && (
          <p className="text-lg text-white/60 mb-6">
            {activeItem.isPaired && activeItem.partnerRecorded ? (
              <>
                {formatTime(activeItem.recorded.recorded_at)} → {formatTime(activeItem.partnerRecorded.recorded_at)}
              </>
            ) : (
              formatTime(activeItem.recorded.recorded_at)
            )}
          </p>
        )}

        {activeItem.isNotStarted && (
          <p className="text-lg text-white/40 mb-6">Not started</p>
        )}

        {/* Action Button */}
        {activeItem.isNotStarted && (
          <button
            onClick={() => handleRecord(activeItem.milestone.id)}
            disabled={loading === activeItem.milestone.id}
            className="w-full max-w-xs py-4 px-6 text-lg font-semibold text-white rounded-2xl transition-all active:scale-[0.98]"
            style={{ 
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
            }}
          >
            {loading === activeItem.milestone.id ? 'Recording...' : 'Record'}
          </button>
        )}

        {activeItem.isInProgress && activeItem.isPaired && activeItem.partner && (
          <button
            onClick={() => handleRecord(activeItem.partner!.id)}
            disabled={loading === activeItem.partner.id}
            className="w-full max-w-xs py-4 px-6 text-lg font-semibold text-white rounded-2xl transition-all active:scale-[0.98]"
            style={{ 
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-white rounded-sm" />
              {loading === activeItem.partner.id ? 'Stopping...' : 'Stop'}
            </span>
          </button>
        )}

        {/* Secondary Actions */}
        {(activeItem.isInProgress || activeItem.isComplete) && (
          <div className="flex items-center gap-6 mt-4">
            {activeItem.isInProgress && activeItem.recorded && (
              <button
                onClick={() => handleUndo(activeItem.recorded!.id)}
                disabled={loading === 'undo'}
                className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo Start
              </button>
            )}
            {activeItem.isComplete && activeItem.isPaired && activeItem.partnerRecorded && (
              <button
                onClick={() => handleUndo(activeItem.partnerRecorded!.id)}
                disabled={loading === 'undo'}
                className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
              </button>
            )}
            {activeItem.isComplete && !activeItem.isPaired && activeItem.recorded && (
              <button
                onClick={() => handleUndo(activeItem.recorded!.id)}
                disabled={loading === 'undo'}
                className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Dots */}
      <div className="flex items-center justify-center gap-2 py-3">
        {displayItems.map((item, idx) => (
          <button
            key={item.milestone.id}
            onClick={() => setActiveIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === activeIndex 
                ? 'w-6 bg-white' 
                : item.isComplete 
                  ? 'bg-emerald-500' 
                  : item.isInProgress
                    ? 'bg-amber-500'
                    : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <p className="text-sm text-white/50">
          {completedCount} of {totalCount} completed
        </p>
        
        <button
          onClick={goNext}
          disabled={activeIndex === displayItems.length - 1}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}