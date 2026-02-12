'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import PiPMilestonePanel from './PiPMilestonePanel'
import { useToast } from '@/components/ui/Toast/ToastProvider'

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

interface PiPMilestoneWrapperProps {
  caseId: string
  caseNumber: string
  procedureName: string
  roomName: string
  surgeonName: string
  milestones: Milestone[]
  recordedMilestones: RecordedMilestone[]
  onRecordMilestone: (milestoneId: string) => Promise<void>
  onUndoMilestone: (recordedId: string) => Promise<void>
  onRefresh: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  timeZone?: string
}

export default function PiPMilestoneWrapper({
  caseId,
  caseNumber,
  procedureName,
  roomName,
  surgeonName,
  milestones,
  recordedMilestones,
  onRecordMilestone,
  onUndoMilestone,
  onRefresh,
  isOpen,
  onOpenChange,
  timeZone,
}: PiPMilestoneWrapperProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null)
  const openingRef = useRef(false)
const { showToast } = useToast()
  const isSupported = typeof window !== 'undefined' && 
    'documentPictureInPicture' in window

  const openPiP = useCallback(async () => {
    if (!isSupported || openingRef.current) return
    
    openingRef.current = true

    try {
      // @ts-ignore
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 280,
        height: 400,
      })

      // Minimal styles for the PiP window
      const customStyles = pip.document.createElement('style')
      customStyles.textContent = `
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow-x: hidden; }
      `
      pip.document.head.appendChild(customStyles)

      pip.document.title = `${roomName} - ORbit`

      const container = pip.document.createElement('div')
      container.id = 'pip-root'
      pip.document.body.appendChild(container)

      pip.addEventListener('pagehide', () => {
        setPipWindow(null)
        setPipContainer(null)
        onOpenChange(false)
        openingRef.current = false
      })

      setPipWindow(pip)
      setPipContainer(container)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to open Picture-in-Picture',
        message: error instanceof Error ? error.message : 'Failed to open Picture-in-Picture window'
      })
      onOpenChange(false)
      openingRef.current = false
    }
  }, [isSupported, roomName, onOpenChange])

  const closePiP = useCallback(() => {
    if (pipWindow) {
      pipWindow.close()
    }
    setPipWindow(null)
    setPipContainer(null)
    onOpenChange(false)
    openingRef.current = false
  }, [pipWindow, onOpenChange])

  useEffect(() => {
    if (isOpen && !pipWindow && isSupported) {
      openPiP()
    } else if (!isOpen && pipWindow) {
      closePiP()
    }
  }, [isOpen, pipWindow, isSupported, openPiP, closePiP])

  useEffect(() => {
    return () => {
      if (pipWindow) {
        pipWindow.close()
      }
    }
  }, [pipWindow])

  if (!isSupported) {
    return null
  }

  if (pipContainer) {
    return createPortal(
      <PiPMilestonePanel
        caseId={caseId}
        caseNumber={caseNumber}
        procedureName={procedureName}
        roomName={roomName}
        surgeonName={surgeonName}
        milestones={milestones}
        recordedMilestones={recordedMilestones}
        onRecordMilestone={onRecordMilestone}
        onUndoMilestone={onUndoMilestone}
        onClose={closePiP}
        onRefresh={onRefresh}
        timeZone={timeZone}
      />,
      pipContainer
    )
  }

  return null
}

export function PiPButton({ 
  onClick, 
  disabled = false,
  className = '',
}: { 
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  const isSupported = typeof window !== 'undefined' && 
    'documentPictureInPicture' in window

  if (!isSupported) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed ${className}`}
        title="Picture-in-Picture requires Chrome 116 or later"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        Pop Out (Chrome only)
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Open milestone tracker in floating window"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
      Pop Out
    </button>
  )
}