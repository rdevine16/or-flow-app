// components/settings/milestones/PhaseBlock.tsx
'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, GripVertical, Trash2, Check, AlertTriangle } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

export interface PhaseBlockMilestone {
  id: string
  display_name: string
  phase_group: string | null
  is_boundary: boolean
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  pair_group: string | null
}

export type PhaseBlockMode = 'table' | 'config'

export interface PhaseBlockProps {
  /** Phase hex color for the left border */
  phaseColor: string
  /** Phase display label (e.g. "Pre-Op") */
  phaseLabel: string
  /** Phase key (e.g. "pre_op") — used for reorder callbacks */
  phaseKey: string
  /** Display mode: 'table' = numbered rows with grip+delete, 'config' = checkboxes with override badges */
  mode: PhaseBlockMode
  /** Internal (non-boundary) milestones in this phase, in display order */
  milestones: PhaseBlockMilestone[]
  /**
   * Config map for config mode: milestone id → enabled (true/false).
   * Null in table mode.
   */
  config?: Record<string, boolean> | null
  /**
   * Parent config for override detection (config mode only).
   * Milestone id → parent enabled value. Null in table mode.
   */
  parentConfig?: Record<string, boolean> | null
  /** Set of milestone IDs that differ from parent (config mode) */
  overriddenIds?: Set<string> | null
  /** Label for override badges (e.g. "OVERRIDE", "SURGEON") */
  overrideLabel?: string | null
  /** Number of pair issues in this phase (shows red alert in header) */
  pairIssueCount?: number
  /** Called when a milestone is toggled (config mode) */
  onToggle?: (milestoneId: string) => void
  /** Called with new milestone order after drag-and-drop */
  onReorder?: (phaseKey: string, newOrder: PhaseBlockMilestone[]) => void
  /** Whether rows are draggable */
  draggable?: boolean
  /** Called when delete button is clicked (table mode) */
  onDelete?: (milestoneId: string) => void
  /** Starting counter value for numbered rows (table mode). Defaults to 1. */
  startCounter?: number
  /** Optional children to render (e.g. PairBracketOverlay in Phase 2) */
  children?: React.ReactNode
}

const ROW_HEIGHT = 34

// ─── Component ──────────────────────────────────────────────────────

export function PhaseBlock({
  phaseColor,
  phaseLabel,
  phaseKey,
  mode,
  milestones,
  config = null,
  parentConfig = null,
  overriddenIds = null,
  overrideLabel = 'OVERRIDE',
  pairIssueCount = 0,
  onToggle,
  onReorder,
  draggable = false,
  onDelete,
  startCounter = 1,
  children,
}: PhaseBlockProps) {
  const [expanded, setExpanded] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null)

  const isTable = mode === 'table'
  const enabledCount = config
    ? milestones.filter((ms) => config[ms.id] !== false).length
    : milestones.length

  // ── Drag-and-drop handlers ──
  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    },
    []
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (targetId === dragId) return
      const rect = e.currentTarget.getBoundingClientRect()
      setDropTargetId(targetId)
      setDropPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
    },
    [dragId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (!dragId || dragId === targetId || !onReorder) return
      const fromIdx = milestones.findIndex((m) => m.id === dragId)
      const toIdx = milestones.findIndex((m) => m.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return
      const reordered = [...milestones]
      const [moved] = reordered.splice(fromIdx, 1)
      let insertIdx = reordered.findIndex((m) => m.id === targetId)
      if (dropPos === 'after') insertIdx++
      reordered.splice(insertIdx, 0, moved)
      onReorder(phaseKey, reordered)
      setDragId(null)
      setDropTargetId(null)
      setDropPos(null)
    },
    [dragId, dropPos, milestones, onReorder, phaseKey]
  )

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDropTargetId(null)
    setDropPos(null)
  }, [])

  // ── Render ──
  return (
    <div>
      {/* Phase block with left color border */}
      <div
        className="relative ml-[11px] bg-white rounded-r-[5px]"
        style={{ borderLeft: `2.5px solid ${phaseColor}` }}
      >
        {/* Collapsible header */}
        <div
          onClick={() => milestones.length > 0 && setExpanded(!expanded)}
          className={`flex items-center justify-between px-2.5 py-[7px] select-none ${
            milestones.length > 0 ? 'cursor-pointer' : 'cursor-default'
          } ${expanded && milestones.length > 0 ? 'rounded-tr-[5px]' : 'rounded-r-[5px]'}`}
          style={{
            background: `${phaseColor}06`,
            borderBottom:
              expanded && milestones.length > 0 ? '1px solid #F1F5F9' : 'none',
          }}
        >
          <div className="flex items-center gap-[5px]">
            <span
              className="text-[11px] font-bold"
              style={{ color: phaseColor }}
            >
              {phaseLabel}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {isTable
                ? `${milestones.length} milestone${milestones.length !== 1 ? 's' : ''}`
                : `${enabledCount}/${milestones.length}`}
            </span>
            {pairIssueCount > 0 && (
              <span className="text-red-500 flex items-center gap-0.5 text-[10px] font-medium">
                <AlertTriangle className="w-3 h-3" /> {pairIssueCount}
              </span>
            )}
          </div>
          {milestones.length > 0 && (
            <ChevronDown
              className={`w-[13px] h-[13px] transition-transform duration-200 ${
                expanded ? 'rotate-180' : 'rotate-0'
              }`}
            />
          )}
        </div>

        {/* Expanded row list */}
        {expanded && milestones.length > 0 && (
          <div className="relative">
            {/* Slot for bracket overlays (Phase 2 will inject here) */}
            {children}

            {milestones.map((ms, i) => {
              const counter = startCounter + i
              const isOn = config ? config[ms.id] !== false : true
              const isOverridden = overriddenIds?.has(ms.id) ?? false
              const parentVal = parentConfig?.[ms.id]
              const isDragging = dragId === ms.id
              const isTarget = dropTargetId === ms.id
              const isHovered = hoveredId === ms.id

              let rowBg = 'transparent'
              if (isOverridden) rowBg = '#FFFBEB'

              return (
                <div
                  key={ms.id}
                  draggable={draggable}
                  onDragStart={
                    draggable ? (e) => handleDragStart(e, ms.id) : undefined
                  }
                  onDragOver={
                    draggable ? (e) => handleDragOver(e, ms.id) : undefined
                  }
                  onDragEnd={draggable ? handleDragEnd : undefined}
                  onDrop={
                    draggable ? (e) => handleDrop(e, ms.id) : undefined
                  }
                  onMouseEnter={() => setHoveredId(ms.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="relative"
                  style={{
                    height: ROW_HEIGHT,
                    opacity: isDragging ? 0.3 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* Drop indicator — before */}
                  {isTarget && dropPos === 'before' && (
                    <div className="absolute top-[-1px] left-2 right-2 h-0.5 bg-blue-500 rounded-sm z-20">
                      <div className="absolute left-[-3px] top-[-3px] w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                  {/* Drop indicator — after */}
                  {isTarget && dropPos === 'after' && (
                    <div className="absolute bottom-[-1px] left-2 right-2 h-0.5 bg-blue-500 rounded-sm z-20">
                      <div className="absolute left-[-3px] top-[-3px] w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  )}

                  {/* Row content */}
                  <div
                    onClick={onToggle ? () => onToggle(ms.id) : undefined}
                    className={`flex items-center gap-1.5 h-full pl-1.5 pr-2.5 border-b border-[#F5F5F5] relative z-[3] transition-colors ${
                      draggable
                        ? 'cursor-grab'
                        : onToggle
                          ? 'cursor-pointer'
                          : 'cursor-default'
                    }`}
                    style={{ background: rowBg }}
                    onMouseEnter={(e) => {
                      if (rowBg === 'transparent')
                        e.currentTarget.style.background = '#F8FAFC'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rowBg
                    }}
                  >
                    {/* Grip handle (table mode) */}
                    {draggable && (
                      <div className="cursor-grab flex items-center shrink-0">
                        <GripVertical className="w-3 h-3 opacity-35" />
                      </div>
                    )}

                    {/* Row number (table mode) */}
                    {isTable && (
                      <span className="text-[10px] text-slate-400 w-[18px] text-center shrink-0">
                        {counter}
                      </span>
                    )}

                    {/* Checkbox (config mode) */}
                    {config && onToggle && (
                      <div
                        className={`w-[15px] h-[15px] rounded-[3px] shrink-0 flex items-center justify-center ${
                          isOn
                            ? 'bg-blue-500'
                            : 'border-[1.5px] border-slate-300 bg-white'
                        }`}
                      >
                        {isOn && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
                      </div>
                    )}

                    {/* Milestone name */}
                    <span
                      className={`text-[11px] text-slate-800 flex-1 ${
                        isOverridden ? 'font-medium' : 'font-normal'
                      } ${config && !isOn ? 'line-through opacity-40' : ''}`}
                    >
                      {ms.display_name}
                    </span>

                    {/* Override badge (config mode) */}
                    {isOverridden && overrideLabel && (
                      <span className="text-[8px] font-bold px-1 py-[1px] rounded-sm bg-amber-100 text-amber-700">
                        {overrideLabel}
                      </span>
                    )}

                    {/* "was on/off" text (config mode) */}
                    {isOverridden && parentVal !== undefined && (
                      <span className="text-[9px] text-slate-400">
                        was {parentVal ? 'on' : 'off'}
                      </span>
                    )}

                    {/* Delete button (table mode, hover-reveal) */}
                    {isTable && onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(ms.id)
                        }}
                        className={`border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 flex items-center p-0.5 rounded transition-opacity ${
                          isHovered ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <Trash2 className="w-[11px] h-[11px]" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {expanded && milestones.length === 0 && (
          <div className="px-2.5 py-2 text-[10px] text-slate-400 italic">
            No optional milestones
          </div>
        )}
      </div>
    </div>
  )
}
