// components/settings/surgeon-milestones/SurgeonMilestoneRow.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, Link2, Loader2 } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface SurgeonMilestoneRowProps {
  id: string
  displayName: string
  /** Whether this milestone is enabled (after surgeon override resolution) */
  isEnabled: boolean
  /** Whether the procedure default has this milestone enabled */
  procedureDefault: boolean
  /** Whether this is a boundary milestone (locked on, not toggleable) */
  isBoundary: boolean
  /** Whether this is a paired milestone (start of a pair) */
  isPaired: boolean
  /** Whether there's a surgeon override for this milestone */
  isOverride: boolean
  /** Whether the row is currently saving */
  isSaving: boolean
  onToggle: () => void
}

export function SurgeonMilestoneRow({
  id,
  displayName,
  isEnabled,
  procedureDefault,
  isBoundary,
  isPaired,
  isOverride,
  isSaving,
  onToggle,
}: SurgeonMilestoneRowProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
        ${isDragging ? 'shadow-md ring-2 ring-indigo-200 z-50 bg-white' : ''}
        ${isOverride ? 'bg-amber-50 border-amber-200' : ''}
        ${!isOverride && isEnabled ? 'bg-white border-slate-200' : ''}
        ${!isOverride && !isEnabled ? 'bg-white/50 border-slate-100' : ''}
        ${isBoundary ? 'bg-slate-50 border-slate-200' : ''}
      `}
    >
      {/* Drag handle — only visible for enabled, non-boundary milestones */}
      {isEnabled && !isBoundary ? (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-slate-300 hover:text-slate-500"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-4" />
      )}

      {/* Toggle */}
      {isBoundary ? (
        <Tooltip content="Required for phase tracking — cannot be overridden">
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

      {/* Default indicator */}
      {!isBoundary && (
        <span className="text-xs text-slate-400">
          Default: {procedureDefault ? 'on' : 'off'}
        </span>
      )}

      {/* Override badge */}
      {isOverride && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
          Override
        </span>
      )}

      {/* Role indicators */}
      {isBoundary && (
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
