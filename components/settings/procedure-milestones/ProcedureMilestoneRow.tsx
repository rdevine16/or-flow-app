// components/settings/procedure-milestones/ProcedureMilestoneRow.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, Link2, Loader2 } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface ProcedureMilestoneRowProps {
  id: string
  milestoneId: string
  displayName: string
  isEnabled: boolean
  isBoundary: boolean
  isPaired: boolean
  isSaving: boolean
  onToggle: () => void
}

export function ProcedureMilestoneRow({
  id,
  displayName,
  isEnabled,
  isBoundary,
  isPaired,
  isSaving,
  onToggle,
}: ProcedureMilestoneRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEnabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isLocked = isBoundary

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
        ${isDragging ? 'shadow-md ring-2 ring-indigo-200 z-50 bg-white' : ''}
        ${isEnabled ? 'bg-white border-slate-200' : 'bg-white/50 border-slate-100'}
        ${isLocked ? 'bg-slate-50 border-slate-200' : ''}
      `}
    >
      {/* Drag handle — only visible for enabled, non-boundary milestones */}
      {isEnabled && !isLocked ? (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-slate-300 hover:text-slate-500"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-4" /> // spacer
      )}

      {/* Checkbox */}
      {isLocked ? (
        <Tooltip content="Required for phase tracking">
          <span className="inline-flex">
            <input
              type="checkbox"
              checked
              disabled
              className="w-4 h-4 text-slate-400 rounded border-slate-300 cursor-not-allowed"
            />
          </span>
        </Tooltip>
      ) : (
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={onToggle}
          disabled={isSaving}
          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
        />
      )}

      {/* Milestone name */}
      <span className={`text-sm flex-1 ${isEnabled ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
        {displayName}
      </span>

      {/* Role indicators */}
      {isLocked && (
        <Tooltip content="Boundary — defines a phase start/end">
          <span className="inline-flex text-slate-400">
            <Lock className="w-3.5 h-3.5" />
          </span>
        </Tooltip>
      )}

      {isPaired && (
        <Tooltip content="Paired — start/end toggle together">
          <span className="inline-flex text-blue-400">
            <Link2 className="w-3.5 h-3.5" />
          </span>
        </Tooltip>
      )}

      {/* Saving spinner */}
      {isSaving && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
      )}
    </div>
  )
}
