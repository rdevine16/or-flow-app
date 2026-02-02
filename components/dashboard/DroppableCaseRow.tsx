// components/dashboard/DroppableCaseRow.tsx
// Simple wrapper component that makes a case row a valid drop target
// Avatars are displayed inline in the case row content, not here
// OPTIMIZED: Wrapped with React.memo to prevent unnecessary re-renders

'use client'

import { memo, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { DropData } from '@/types/staff-assignment'

interface DroppableCaseRowProps {
  caseId: string
  caseNumber: string
  isActive: boolean  // Whether case is in_progress
  isCompleted: boolean
  children: ReactNode
}

function DroppableCaseRow({
  caseId,
  caseNumber,
  isActive,
  isCompleted,
  children
}: DroppableCaseRowProps) {
  const dropData: DropData = {
    type: 'case-row',
    caseId,
    caseNumber
  }
  
  const { isOver, setNodeRef, active } = useDroppable({
    id: `case-${caseId}`,
    data: dropData,
    disabled: isCompleted
  })
  
  // Determine if this is a valid drop target
  const isDragActive = active !== null
  const isValidDrop = !isCompleted && isDragActive
  
  return (
    <div
      ref={setNodeRef}
      className={`
        relative
        transition-all duration-200
        ${isOver && isValidDrop
          ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50 scale-[1.02] rounded-xl' 
          : ''
        }
        ${isValidDrop && !isOver
          ? 'ring-1 ring-blue-200 ring-offset-1 rounded-xl'
          : ''
        }
        ${isCompleted && isDragActive
          ? 'opacity-50 cursor-not-allowed'
          : ''
        }
      `}
    >
      {/* Original case row content (includes inline staff avatars) */}
      {children}
      
      {/* Drop indicator */}
      {isOver && isValidDrop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-blue-500/10">
          <div className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-lg">
            Drop to assign
          </div>
        </div>
      )}
    </div>
  )
}

// Export memoized component
// Note: The useDroppable hook handles drag state internally,
// so memo will prevent re-renders when case data doesn't change
export default memo(DroppableCaseRow)
