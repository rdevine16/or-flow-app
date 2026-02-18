'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronLeft, ChevronRight, Circle, CornerDownLeft, X } from 'lucide-react'
import { formatTimestamp } from '@/lib/formatters'

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
  timeZone?: string
}

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

export default function PiPMilestonePanel({
  caseNumber,
  procedureName,
  roomName,
  surgeonName,
  milestones,
  recordedMilestones,
  onRecordMilestone,
  onUndoMilestone,
  onClose,
  timeZone,
}: PiPMilestonePanelProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getRecorded = useCallback((milestoneId: string) => {
    return recordedMilestones.find(rm => rm.facility_milestone_id === milestoneId)
  }, [recordedMilestones])

  const getPartner = useCallback((milestone: Milestone) => {
    if (!milestone.pair_with_id) return null
    return milestones.find(m => m.id === milestone.pair_with_id)
  }, [milestones])

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

  useEffect(() => {
    const firstIncomplete = displayItems.findIndex(item => !item.isComplete)
    if (firstIncomplete !== -1) {
      setActiveIndex(firstIncomplete)
    } else if (displayItems.length > 0) {
      setActiveIndex(displayItems.length - 1)
    }
  }, [recordedMilestones.length, displayItems])

  const activeItem = displayItems[activeIndex]
  const completedCount = displayItems.filter(i => i.isComplete).length
  const totalCount = displayItems.length

  // Total case time (patient_in → now or patient_out)
  const patientInMilestone = milestones.find(m => m.name === 'patient_in')
  const patientInRecorded = patientInMilestone ? getRecorded(patientInMilestone.id) : null
  const patientOutMilestone = milestones.find(m => m.name === 'patient_out')
  const patientOutRecorded = patientOutMilestone ? getRecorded(patientOutMilestone.id) : null
  const totalCaseMs = patientInRecorded 
    ? (patientOutRecorded 
        ? new Date(patientOutRecorded.recorded_at).getTime() - new Date(patientInRecorded.recorded_at).getTime()
        : currentTime - new Date(patientInRecorded.recorded_at).getTime())
    : 0

  // Surgical time (incision → closing or now)
  const incisionMilestone = milestones.find(m => m.name === 'incision')
  const incisionRecorded = incisionMilestone ? getRecorded(incisionMilestone.id) : null
  // Handle both 'closing' and 'closing_complete' for the end of surgical time
  const closingMilestone = milestones.find(m => m.name === 'closing_complete' || m.name === 'closing')
  const closingRecorded = closingMilestone ? getRecorded(closingMilestone.id) : null
  const surgicalTimeMs = incisionRecorded
    ? (closingRecorded
        ? new Date(closingRecorded.recorded_at).getTime() - new Date(incisionRecorded.recorded_at).getTime()
        : currentTime - new Date(incisionRecorded.recorded_at).getTime())
    : 0
  const isSurgicalActive = incisionRecorded && !closingRecorded

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

  const goNext = () => setActiveIndex(Math.min(activeIndex + 1, displayItems.length - 1))
  const goPrev = () => setActiveIndex(Math.max(activeIndex - 1, 0))

  if (!activeItem) return null

  const accentColor = activeItem.isComplete 
    ? '#10b981' 
    : activeItem.isInProgress 
      ? '#f59e0b' 
      : '#3b82f6'

  const progressPercent = (completedCount / totalCount) * 100
  const circumference = 2 * Math.PI * 38

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#fff',
      userSelect: 'none',
    }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        button:active { transform: scale(0.98); }
      `}</style>

      {/* Header - Compact */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Circle size={12} stroke="white" strokeWidth={2} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>{roomName} - {procedureName}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{caseNumber} - {surgeonName}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={14} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
        </button>
      </div>

      {/* Timer Cards - Two columns */}
      {(patientInRecorded || incisionRecorded) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          margin: '8px 12px',
        }}>
          {/* Total Case Time */}
          {patientInRecorded && (
            <div style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <div style={{ 
                  width: '5px', 
                  height: '5px', 
                  backgroundColor: '#34d399', 
                  borderRadius: '50%', 
                  animation: patientOutRecorded ? 'none' : 'pulse 2s infinite' 
                }} />
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#34d399', textTransform: 'uppercase' }}>Total</span>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', margin: 0 }}>
                {formatElapsed(totalCaseMs)}
              </p>
            </div>
          )}

          {/* Surgical Time */}
          {incisionRecorded && (
            <div style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '8px',
              background: isSurgicalActive 
                ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))'
                : 'linear-gradient(135deg, rgba(148,163,184,0.2), rgba(148,163,184,0.05))',
              border: isSurgicalActive 
                ? '1px solid rgba(59,130,246,0.2)'
                : '1px solid rgba(148,163,184,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <div style={{ 
                  width: '5px', 
                  height: '5px', 
                  backgroundColor: isSurgicalActive ? '#60a5fa' : '#94a3b8', 
                  borderRadius: '50%', 
                  animation: isSurgicalActive ? 'pulse 2s infinite' : 'none' 
                }} />
                <span style={{ 
                  fontSize: '9px', 
                  fontWeight: 600, 
                  color: isSurgicalActive ? '#60a5fa' : '#94a3b8', 
                  textTransform: 'uppercase' 
                }}>Surgical</span>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', margin: 0 }}>
                {formatElapsed(surgicalTimeMs)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Content - Condensed */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 16px',
      }}>
        {/* Smaller Progress Ring */}
        <div style={{ position: 'relative', width: '72px', height: '72px', marginBottom: '12px' }}>
          <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle
              cx="50" cy="50" r="38"
              fill="none"
              stroke={accentColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progressPercent / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeItem.isComplete ? (
              <Check size={28} stroke={accentColor} strokeWidth={2.5} />
            ) : activeItem.isInProgress ? (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: accentColor, animation: 'pulse 2s infinite' }} />
            ) : (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${accentColor}` }} />
            )}
          </div>
        </div>

        {/* Milestone Name */}
        <h2 style={{ fontSize: '16px', fontWeight: 600, textAlign: 'center', margin: '0 0 4px 0' }}>
          {activeItem.displayName}
        </h2>

        {/* Timer */}
        {activeItem.isInProgress && (
          <p style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: accentColor, margin: '8px 0 16px 0' }}>
            {formatElapsed(activeItem.elapsedMs)}
          </p>
        )}

        {activeItem.isComplete && activeItem.recorded && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 16px 0' }}>
            {activeItem.isPaired && activeItem.partnerRecorded
              ? `${formatTimestamp(activeItem.recorded.recorded_at, { timeZone })} → ${formatTimestamp(activeItem.partnerRecorded.recorded_at, { timeZone })}`
              : formatTimestamp(activeItem.recorded.recorded_at, { timeZone })
            }
          </p>
        )}

        {activeItem.isNotStarted && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 16px 0' }}>Not started</p>
        )}

        {/* Action Buttons - Slightly smaller */}
        {activeItem.isNotStarted && (
          <button
            onClick={() => handleRecord(activeItem.milestone.id)}
            disabled={loading === activeItem.milestone.id}
            style={{
              width: '100%',
              maxWidth: '220px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
            }}
          >
            {loading === activeItem.milestone.id ? 'Recording...' : 'Record'}
          </button>
        )}

        {activeItem.isInProgress && activeItem.isPaired && activeItem.partner && (
          <button
            onClick={() => handleRecord(activeItem.partner!.id)}
            disabled={loading === activeItem.partner.id}
            style={{
              width: '100%',
              maxWidth: '220px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(239,68,68,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: '10px', height: '10px', backgroundColor: '#fff', borderRadius: '2px' }} />
            {loading === activeItem.partner.id ? 'Stopping...' : 'Stop'}
          </button>
        )}

        {/* Undo - Smaller */}
        {(activeItem.isInProgress || activeItem.isComplete) && (
          <button 
            onClick={() => handleUndo(
              activeItem.isComplete && activeItem.isPaired && activeItem.partnerRecorded 
                ? activeItem.partnerRecorded.id 
                : activeItem.recorded!.id
            )}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CornerDownLeft size={12} strokeWidth={2} />
            {activeItem.isInProgress ? 'Undo Start' : 'Undo'}
          </button>
        )}
      </div>

      {/* Navigation Dots - Compact */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>
        {displayItems.map((item, idx) => (
          <button
            key={item.milestone.id}
            onClick={() => setActiveIndex(idx)}
            style={{
              width: idx === activeIndex ? '18px' : '6px',
              height: '6px',
              borderRadius: '3px',
              backgroundColor: idx === activeIndex 
                ? '#fff' 
                : item.isComplete 
                  ? '#10b981' 
                  : item.isInProgress 
                    ? '#f59e0b' 
                    : 'rgba(255,255,255,0.25)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Footer - Compact */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          style={{
            padding: '6px',
            background: 'transparent',
            border: 'none',
            cursor: activeIndex === 0 ? 'default' : 'pointer',
            opacity: activeIndex === 0 ? 0.3 : 1,
          }}
        >
          <ChevronLeft size={16} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
        </button>
        
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          {completedCount} of {totalCount}
        </span>
        
        <button
          onClick={goNext}
          disabled={activeIndex === displayItems.length - 1}
          style={{
            padding: '6px',
            background: 'transparent',
            border: 'none',
            cursor: activeIndex === displayItems.length - 1 ? 'default' : 'pointer',
            opacity: activeIndex === displayItems.length - 1 ? 0.3 : 1,
          }}
        >
          <ChevronRight size={16} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}