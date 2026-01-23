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

// Format elapsed time as MM:SS or H:MM:SS
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

  // Find the current active milestone
  useEffect(() => {
    const firstIncomplete = displayItems.findIndex(item => !item.isComplete)
    if (firstIncomplete !== -1) {
      setActiveIndex(firstIncomplete)
    } else if (displayItems.length > 0) {
      setActiveIndex(displayItems.length - 1)
    }
  }, [recordedMilestones.length])

  const activeItem = displayItems[activeIndex]
  const completedCount = displayItems.filter(i => i.isComplete).length
  const totalCount = displayItems.length

  // Calculate total case time
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

  const goNext = () => setActiveIndex(Math.min(activeIndex + 1, displayItems.length - 1))
  const goPrev = () => setActiveIndex(Math.max(activeIndex - 1, 0))

  if (!activeItem) return null

  // Colors
  const colors = {
    complete: '#10b981',
    inProgress: '#f59e0b', 
    notStarted: '#3b82f6',
    bg: '#000000',
    cardBg: '#18181b',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  }

  const accentColor = activeItem.isComplete 
    ? colors.complete 
    : activeItem.isInProgress 
      ? colors.inProgress 
      : colors.notStarted

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: colors.bg,
      display: 'flex',
      flexDirection: 'column' as const,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: colors.textPrimary,
      userSelect: 'none' as const,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.border}`,
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    logo: {
      width: '24px',
      height: '24px',
      borderRadius: '6px',
      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    roomName: {
      fontSize: '13px',
      fontWeight: 600,
      color: colors.textPrimary,
      margin: 0,
    },
    caseNumber: {
      fontSize: '11px',
      color: colors.textMuted,
      margin: 0,
    },
    closeBtn: {
      padding: '8px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      borderRadius: '8px',
    },
    totalCard: {
      margin: '12px 16px',
      padding: '12px 16px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
      border: '1px solid rgba(16,185,129,0.2)',
    },
    totalCardHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    totalCardLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    pulseDot: {
      width: '8px',
      height: '8px',
      backgroundColor: '#34d399',
      borderRadius: '50%',
      animation: 'pulse 2s infinite',
    },
    totalLabel: {
      fontSize: '10px',
      fontWeight: 600,
      color: '#34d399',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    totalStarted: {
      fontSize: '11px',
      color: colors.textMuted,
    },
    totalTime: {
      fontSize: '24px',
      fontWeight: 700,
      color: colors.textPrimary,
      fontFamily: 'ui-monospace, monospace',
      marginTop: '4px',
    },
    main: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    },
    ringContainer: {
      position: 'relative' as const,
      width: '96px',
      height: '96px',
      marginBottom: '16px',
    },
    ringSvg: {
      width: '100%',
      height: '100%',
      transform: 'rotate(-90deg)',
    },
    ringCenter: {
      position: 'absolute' as const,
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    milestoneName: {
      fontSize: '20px',
      fontWeight: 600,
      color: colors.textPrimary,
      textAlign: 'center' as const,
      marginBottom: '8px',
    },
    timer: {
      fontSize: '48px',
      fontWeight: 700,
      fontFamily: 'ui-monospace, monospace',
      color: accentColor,
      marginBottom: '24px',
    },
    statusText: {
      fontSize: '16px',
      color: colors.textSecondary,
      marginBottom: '24px',
    },
    recordBtn: {
      width: '100%',
      maxWidth: '280px',
      padding: '16px 24px',
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff',
      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
    },
    stopBtn: {
      width: '100%',
      maxWidth: '280px',
      padding: '16px 24px',
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff',
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    },
    stopIcon: {
      width: '12px',
      height: '12px',
      backgroundColor: '#ffffff',
      borderRadius: '2px',
    },
    undoBtn: {
      marginTop: '16px',
      padding: '8px 16px',
      fontSize: '14px',
      color: colors.textMuted,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    dots: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '12px',
    },
    dot: (isActive: boolean, isComplete: boolean, isInProgress: boolean) => ({
      width: isActive ? '24px' : '8px',
      height: '8px',
      borderRadius: '4px',
      backgroundColor: isActive 
        ? '#ffffff' 
        : isComplete 
          ? '#10b981' 
          : isInProgress 
            ? '#f59e0b' 
            : 'rgba(255,255,255,0.3)',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }),
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: `1px solid ${colors.border}`,
    },
    navBtn: {
      padding: '8px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      borderRadius: '8px',
      opacity: 1,
    },
    navBtnDisabled: {
      opacity: 0.3,
      cursor: 'default',
    },
    footerText: {
      fontSize: '14px',
      color: colors.textMuted,
    },
  }

  const progressPercent = (completedCount / totalCount) * 100
  const circumference = 2 * Math.PI * 42

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>
          <div>
            <p style={styles.roomName}>{roomName}</p>
            <p style={styles.caseNumber}>{caseNumber}</p>
          </div>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Total Case Time */}
      {patientInRecorded && (
        <div style={styles.totalCard}>
          <div style={styles.totalCardHeader}>
            <div style={styles.totalCardLabel}>
              <div style={styles.pulseDot} />
              <span style={styles.totalLabel}>Total Case</span>
            </div>
            <span style={styles.totalStarted}>Started {formatTime(patientInRecorded.recorded_at)}</span>
          </div>
          <p style={styles.totalTime}>{formatElapsed(totalCaseMs)}</p>
        </div>
      )}

      {/* Main Content */}
      <div style={styles.main}>
        {/* Progress Ring */}
        <div style={styles.ringContainer}>
          <svg style={styles.ringSvg} viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={accentColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progressPercent / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={styles.ringCenter}>
            {activeItem.isComplete ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : activeItem.isInProgress ? (
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: accentColor, animation: 'pulse 2s infinite' }} />
            ) : (
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${accentColor}` }} />
            )}
          </div>
        </div>

        {/* Milestone Name */}
        <h2 style={styles.milestoneName}>{activeItem.displayName}</h2>

        {/* Timer / Status */}
        {activeItem.isInProgress && (
          <p style={styles.timer}>{formatElapsed(activeItem.elapsedMs)}</p>
        )}

        {activeItem.isComplete && activeItem.recorded && (
          <p style={styles.statusText}>
            {activeItem.isPaired && activeItem.partnerRecorded 
              ? `${formatTime(activeItem.recorded.recorded_at)} → ${formatTime(activeItem.partnerRecorded.recorded_at)}`
              : formatTime(activeItem.recorded.recorded_at)
            }
          </p>
        )}

        {activeItem.isNotStarted && (
          <p style={styles.statusText}>Not started</p>
        )}

        {/* Action Buttons */}
        {activeItem.isNotStarted && (
          <button
            style={styles.recordBtn}
            onClick={() => handleRecord(activeItem.milestone.id)}
            disabled={loading === activeItem.milestone.id}
          >
            {loading === activeItem.milestone.id ? 'Recording...' : 'Record'}
          </button>
        )}

        {activeItem.isInProgress && activeItem.isPaired && activeItem.partner && (
          <button
            style={styles.stopBtn}
            onClick={() => handleRecord(activeItem.partner!.id)}
            disabled={loading === activeItem.partner.id}
          >
            <div style={styles.stopIcon} />
            {loading === activeItem.partner.id ? 'Stopping...' : 'Stop'}
          </button>
        )}

        {/* Undo Button */}
        {activeItem.isInProgress && activeItem.recorded && (
          <button style={styles.undoBtn} onClick={() => handleUndo(activeItem.recorded!.id)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Undo Start
          </button>
        )}

        {activeItem.isComplete && (
          <button 
            style={styles.undoBtn} 
            onClick={() => handleUndo(
              activeItem.isPaired && activeItem.partnerRecorded 
                ? activeItem.partnerRecorded.id 
                : activeItem.recorded!.id
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Undo
          </button>
        )}
      </div>

      {/* Navigation Dots */}
      <div style={styles.dots}>
        {displayItems.map((item, idx) => (
          <button
            key={item.milestone.id}
            style={styles.dot(idx === activeIndex, item.isComplete, item.isInProgress)}
            onClick={() => setActiveIndex(idx)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button
          style={{ ...styles.navBtn, ...(activeIndex === 0 ? styles.navBtnDisabled : {}) }}
          onClick={goPrev}
          disabled={activeIndex === 0}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        
        <span style={styles.footerText}>{completedCount} of {totalCount} completed</span>
        
        <button
          style={{ ...styles.navBtn, ...(activeIndex === displayItems.length - 1 ? styles.navBtnDisabled : {}) }}
          onClick={goNext}
          disabled={activeIndex === displayItems.length - 1}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}