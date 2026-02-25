// components/settings/milestones/SubPhaseIndicator.tsx
// Renders a sub-phase section inline within the parent phase block.
// Supports block-level sorting (movable within parent) via sortableId prop.
// Sub-phase milestones participate in the outer DndContext for cross-phase drag.
'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SubPhaseItem, MilestoneLookup, TemplateItemData } from '@/lib/utils/buildTemplateRenderList'
import { GripVertical, X, Lock } from 'lucide-react'
import { PairBadge } from './FlowNode'

// Must match the prefix in TemplateBuilder.tsx so handleDragEnd resolves correctly
const DROP_PHASE_PREFIX = 'drop-phase:'

interface SubPhaseIndicatorProps {
  item: SubPhaseItem
  onRemove?: () => void
  onRemoveMilestone?: (itemId: string) => void
  isDraggingMilestone?: boolean
  sortableId?: string
  pairIssues?: Set<string>
  requiredMilestoneItemIds?: Set<string>
}

export function SubPhaseIndicator({
  item,
  onRemove,
  onRemoveMilestone,
  isDraggingMilestone,
  sortableId,
  pairIssues,
  requiredMilestoneItemIds,
}: SubPhaseIndicatorProps) {
  const { phase, color, milestones } = item
  const hex = color.hex

  const droppableId = `${DROP_PHASE_PREFIX}${phase.id}`
  // Only enable the droppable when a library milestone is being dragged;
  // otherwise it blocks sortable reordering of milestones within the parent phase.
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId, disabled: !isDraggingMilestone })
  const isHighlighted = isOver && isDraggingMilestone

  // Block-level sortable (for moving the sub-phase within the parent phase)
  const {
    attributes: blockAttributes,
    listeners: blockListeners,
    setNodeRef: setSortRef,
    transform: blockTransform,
    transition: blockTransition,
    isDragging: isBlockDragging,
  } = useSortable({ id: sortableId ?? `sp-fallback-${phase.id}`, disabled: !sortableId })

  // Combine refs: both droppable (for library drops) and sortable (for block movement)
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node)
    setSortRef(node)
  }, [setDropRef, setSortRef])

  const blockStyle = {
    transform: CSS.Transform.toString(blockTransform),
    transition: blockTransition,
    opacity: isBlockDragging ? 0.5 : 1,
    zIndex: isBlockDragging ? 50 : undefined,
  }

  const milestoneIds = useMemo(
    () => milestones.map(m => m.templateItem.id),
    [milestones],
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        ...blockStyle,
        background: isHighlighted ? `${hex}18` : `${hex}0c`,
        boxShadow: isHighlighted ? `inset 0 0 0 1.5px ${hex}40` : undefined,
      }}
      className="transition-all mx-2 my-0.5 rounded-sm"
    >
      {/* Sub-phase header bar */}
      <div
        className="flex items-center gap-1 pl-2 pr-2 py-[2px]"
        style={{
          borderTop: `1px solid ${hex}20`,
          borderBottom: `1px solid ${hex}12`,
        }}
      >
        {/* Drag handle for block movement */}
        <div
          className="touch-none flex-shrink-0"
          {...blockAttributes}
          {...blockListeners}
        >
          <GripVertical
            className="w-2.5 h-2.5 cursor-grab active:cursor-grabbing"
            style={{ color: `${hex}50` }}
          />
        </div>

        <div className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: hex }} />
        <span
          className="text-[9.5px] font-bold uppercase tracking-wide"
          style={{ color: hex }}
        >
          {phase.display_name}
        </span>
        <span
          className="text-[7.5px] font-semibold px-1 py-[1px] rounded"
          style={{ background: `${hex}15`, color: `${hex}90` }}
        >
          SUB-PHASE
        </span>
        {isHighlighted && (
          <span className="text-[8px] font-medium" style={{ color: hex }}>
            Drop here
          </span>
        )}
        <span
          className="text-[9px] ml-auto"
          style={{ color: `${hex}60` }}
        >
          {milestones.length}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-[1px] text-slate-400 hover:text-red-500 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Empty state */}
      {milestones.length === 0 && (
        <div className="flex items-center gap-0 py-[3px] pl-3 pr-2">
          <div className="w-5 flex-shrink-0" />
          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-dashed" style={{ borderColor: `${hex}40` }} />
          <span className="text-[11px] ml-1.5 italic" style={{ color: `${hex}60` }}>
            {isDraggingMilestone ? 'Drop milestone here' : 'Drag milestones here'}
          </span>
        </div>
      )}

      {/* Milestone rows — sortable within outer DndContext */}
      {milestones.length > 0 && (
        <SortableContext
          items={milestoneIds}
          strategy={verticalListSortingStrategy}
        >
          {milestones.map(({ milestone, templateItem }, idx) => (
            <SortableSubPhaseMilestone
              key={templateItem.id}
              milestone={milestone}
              templateItem={templateItem}
              idx={idx}
              total={milestones.length}
              hex={hex}
              phaseName={phase.display_name}
              onRemove={onRemoveMilestone}
              pairIssues={pairIssues}
              isRequired={requiredMilestoneItemIds?.has(templateItem.id)}
            />
          ))}
        </SortableContext>
      )}

      {/* Bottom edge */}
      <div style={{ borderBottom: `1px solid ${hex}15` }} />
    </div>
  )
}

// ─── Sortable Sub-Phase Milestone Row ──────────────────────

function SortableSubPhaseMilestone({
  milestone,
  templateItem,
  idx,
  total,
  hex,
  phaseName,
  onRemove,
  pairIssues,
  isRequired,
}: {
  milestone: MilestoneLookup
  templateItem: TemplateItemData
  idx: number
  total: number
  hex: string
  phaseName: string
  onRemove?: (itemId: string) => void
  pairIssues?: Set<string>
  isRequired?: boolean
}) {
  const [hover, setHover] = useState(false)
  const isFirst = idx === 0
  const isLast = idx === total - 1
  const isEdge = isFirst || isLast
  const dotSize = isEdge ? 'w-4 h-4' : 'w-3.5 h-3.5'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: templateItem.id })

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
      className="flex items-center gap-0 py-[3px] pl-3 pr-2 relative"
    >
      {/* Phase rail */}
      <div
        className="absolute left-[34px] w-0.5"
        style={{
          background: `${hex}20`,
          top: isFirst ? '50%' : 0,
          bottom: isLast ? '50%' : 0,
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

      {/* Marker dot — larger for edge milestones */}
      <div
        className={`${dotSize} rounded-full flex-shrink-0 relative z-[1]`}
        style={{
          background: hex,
          boxShadow: isEdge ? '0 0 0 2px #fff' : undefined,
        }}
      />

      {/* Name */}
      <span className={`ml-1.5 flex-1 truncate ${isEdge ? 'text-[12.5px] font-semibold text-slate-900' : 'text-xs font-medium text-slate-700'}`}>
        {milestone.display_name}
      </span>

      {/* Sub-phase Start/End column */}
      <div className="w-[130px] min-w-[130px] flex justify-end flex-shrink-0">
        {isEdge && (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-bold tracking-wide px-1 py-[1px] rounded"
            style={{
              background: `${hex}10`,
              color: hex,
              border: `1px solid ${hex}20`,
            }}
          >
            {isFirst ? (
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            ) : (
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
            )}
            {isFirst ? 'STARTS' : 'ENDS'} {phaseName.toUpperCase()}
          </span>
        )}
      </div>

      {/* Milestone Link column */}
      <div className="w-[44px] min-w-[44px] flex justify-center flex-shrink-0">
        {milestone.pair_position ? (
          <PairBadge position={milestone.pair_position} hasIssue={pairIssues?.has(templateItem.id)} />
        ) : null}
      </div>

      {/* Actions column */}
      <div className="w-[24px] min-w-[24px] flex justify-center flex-shrink-0">
        {isRequired ? (
          hover && <span title="Required milestone"><Lock className="w-2.5 h-2.5 text-slate-300" /></span>
        ) : (
          hover && !isDragging && onRemove && (
            <button
              onClick={() => onRemove(templateItem.id)}
              className="p-0.5 text-red-500 hover:text-red-700 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )
        )}
      </div>
    </div>
  )
}
