'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import PiPMilestonePanel from '../pip/PiPMilestonePanel'

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
  // Trigger to open PiP from parent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * PiPMilestoneWrapper
 * 
 * This component manages the Picture-in-Picture window for milestone tracking.
 * It creates a portal to render React content into the PiP window.
 * 
 * Usage:
 * 1. Pass isOpen={true} to open the PiP window
 * 2. The component handles rendering and syncing
 * 3. When the PiP closes, onOpenChange(false) is called
 */
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
}: PiPMilestoneWrapperProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null)
  const openingRef = useRef(false)

  // Check if Document PiP is supported
  const isSupported = typeof window !== 'undefined' && 
    'documentPictureInPicture' in window

  // Open PiP window
  const openPiP = useCallback(async () => {
    if (!isSupported || openingRef.current) return
    
    openingRef.current = true

    try {
      // @ts-ignore - TypeScript doesn't know about documentPictureInPicture yet
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 520,
      })

      // Add Tailwind CDN for styling
      const tailwindScript = pip.document.createElement('script')
      tailwindScript.src = 'https://cdn.tailwindcss.com'
      pip.document.head.appendChild(tailwindScript)

      // Add custom styles
      const customStyles = pip.document.createElement('style')
      customStyles.textContent = `
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          background: #f8fafc;
          overflow-x: hidden;
        }
        
        /* Smooth scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Smooth transitions */
        * {
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        
        /* Button press effect */
        button:active:not(:disabled) {
          transform: scale(0.98);
        }
        
        /* Pulse animation for running indicator */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        /* Tabular numbers for timestamps */
        .tabular-nums {
          font-variant-numeric: tabular-nums;
        }
      `
      pip.document.head.appendChild(customStyles)

      // Set page title
      pip.document.title = `${roomName} - ORbit`

      // Create container for React portal
      const container = pip.document.createElement('div')
      container.id = 'pip-root'
      pip.document.body.appendChild(container)

      // Handle window close
      pip.addEventListener('pagehide', () => {
        setPipWindow(null)
        setPipContainer(null)
        onOpenChange(false)
        openingRef.current = false
      })

      setPipWindow(pip)
      setPipContainer(container)
    } catch (error) {
      console.error('Failed to open Picture-in-Picture:', error)
      onOpenChange(false)
      openingRef.current = false
    }
  }, [isSupported, roomName, onOpenChange])

  // Close PiP window
  const closePiP = useCallback(() => {
    if (pipWindow) {
      pipWindow.close()
    }
    setPipWindow(null)
    setPipContainer(null)
    onOpenChange(false)
    openingRef.current = false
  }, [pipWindow, onOpenChange])

  // Handle isOpen changes from parent
  useEffect(() => {
    if (isOpen && !pipWindow && isSupported) {
      openPiP()
    } else if (!isOpen && pipWindow) {
      closePiP()
    }
  }, [isOpen, pipWindow, isSupported, openPiP, closePiP])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipWindow) {
        pipWindow.close()
      }
    }
  }, [pipWindow])

  // Don't render anything if not supported or no container
  if (!isSupported) {
    return null
  }

  // Render panel into PiP window via portal
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
      />,
      pipContainer
    )
  }

  return null
}

/**
 * Button component to trigger PiP mode
 * Shows a helpful message if PiP is not supported
 */
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