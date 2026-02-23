// components/settings/milestones/FlowNode.tsx
// Renders milestone rows in the template builder.
// EdgeMilestone: first/last milestone in a phase with position badge.
// InteriorMilestone: middle milestones with no position badge.
// UnassignedMilestone: milestones with no phase assignment.
// All support @dnd-kit useSortable for drag-to-reorder within phases.
'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  EdgeMilestoneItem,
  InteriorMilestoneItem,
  UnassignedMilestoneItem,
} from '@/lib/utils/buildTemplateRenderList'
import { GripVertical, X } from 'lucide-react'

// ─── Edge Milestone ────────────────────────────────────────

interface EdgeMilestoneProps {
  item: EdgeMilestoneItem
  onRemove: (itemId: string) => void
  sortableId?: string
}

export function EdgeMilestone({ item, onRemove, sortableId }: EdgeMilestoneProps) {
  const [hover, setHover] = useState(false)
  const { milestone, templateItem, color, edge } = item
  const hex = color.hex

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? templateItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-0 py-1 pl-1 pr-2 relative transition-colors"
      data-phase-id={item.phase.id}
    >
      {/* Phase rail */}
      <div
        className="absolute left-[26px] w-0.5"
        style={{
          background: `${hex}30`,
          top: edge === 'start' ? '50%' : 0,
          bottom: edge === 'end' ? '50%' : 0,
        }}
      />

      {/* Drag handle */}
      <div
        className="w-5 flex items-center justify-center flex-shrink-0 relative z-[1] touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical
          className="w-2.5 h-2.5 transition-colors cursor-grab active:cursor-grabbing"
          style={{ color: hover || isDragging ? '#94a3b8' : 'transparent' }}
        />
      </div>

      {/* Marker */}
      <div
        className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center relative z-[2]"
        style={{
          background: hex,
          boxShadow: '0 0 0 2px #fff',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      {/* Name */}
      <span className="text-[12.5px] font-semibold text-slate-900 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>

      {/* Edge badge */}
      <span
        className="inline-flex items-center gap-0.5 text-[8.5px] font-bold tracking-wide px-1 py-[1px] rounded"
        style={{
          background: `${hex}10`,
          color: hex,
          border: `1px solid ${hex}20`,
        }}
      >
        {edge === 'start' ? (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
        )}
        {edge === 'start' ? 'STARTS' : 'ENDS'} {item.phase.display_name.toUpperCase()}
      </span>

      {/* Pair badge */}
      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}

      {/* Remove button */}
      {hover && !isDragging && (
        <button
          onClick={() => onRemove(templateItem.id)}
          className="p-0.5 ml-0.5 text-red-500 hover:text-red-700 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

// ─── Interior Milestone ────────────────────────────────────

interface InteriorMilestoneProps {
  item: InteriorMilestoneItem
  onRemove: (itemId: string) => void
  sortableId?: string
}

export function InteriorMilestone({ item, onRemove, sortableId }: InteriorMilestoneProps) {
  const [hover, setHover] = useState(false)
  const { milestone, templateItem, color } = item
  const hex = color.hex

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? templateItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-0 py-[3px] pl-1 pr-2 relative transition-colors"
      data-phase-id={item.phase.id}
    >
      {/* Phase rail */}
      <div
        className="absolute left-[26px] top-0 bottom-0 w-0.5"
        style={{ background: `${hex}25` }}
      />

      {/* Drag handle */}
      <div
        className="w-5 flex items-center justify-center flex-shrink-0 relative z-[1] touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical
          className="w-2.5 h-2.5 transition-colors cursor-grab active:cursor-grabbing"
          style={{ color: hover || isDragging ? '#94a3b8' : 'transparent' }}
        />
      </div>

      {/* Marker */}
      <div
        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center relative z-[1]"
        style={{ background: hex }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      {/* Name */}
      <span className="text-xs font-medium text-slate-700 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>

      {/* Pair badge */}
      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}

      {/* Remove button */}
      {hover && !isDragging && (
        <button
          onClick={() => onRemove(templateItem.id)}
          className="p-0.5 ml-0.5 text-red-500 hover:text-red-700 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

// ─── Unassigned Milestone ──────────────────────────────────

interface UnassignedMilestoneProps {
  item: UnassignedMilestoneItem
  onRemove: (itemId: string) => void
  sortableId?: string
}

export function UnassignedMilestone({ item, onRemove, sortableId }: UnassignedMilestoneProps) {
  const [hover, setHover] = useState(false)
  const { milestone, templateItem } = item

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? templateItem.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-0 py-[3px] pl-1 pr-2 relative transition-colors"
    >
      {/* Rail */}
      <div className="absolute left-[26px] top-0 bottom-0 w-0.5 bg-slate-200" />

      <div
        className="w-5 flex items-center justify-center flex-shrink-0 relative z-[1] touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical
          className="w-2.5 h-2.5 transition-colors cursor-grab active:cursor-grabbing"
          style={{ color: hover || isDragging ? '#94a3b8' : 'transparent' }}
        />
      </div>

      <div className="w-3.5 h-3.5 rounded flex-shrink-0 bg-slate-400 flex items-center justify-center relative z-[1]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <span className="text-xs font-medium text-slate-600 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>

      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}

      {hover && !isDragging && (
        <button
          onClick={() => onRemove(templateItem.id)}
          className="p-0.5 ml-0.5 text-red-500 hover:text-red-700 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

// ─── Pair Badge ────────────────────────────────────────────

function PairBadge({ position }: { position: 'start' | 'end' }) {
  return (
    <span
      className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase flex-shrink-0 ml-1 ${
        position === 'start'
          ? 'bg-green-50 text-green-600'
          : 'bg-amber-50 text-amber-600'
      }`}
    >
      {position}
    </span>
  )
}
