// components/settings/milestones/FlatMilestoneList.tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { GripVertical, Archive, Pencil, Lock, Check, AlertTriangle } from 'lucide-react'
import type { FlatRow, SubPhaseRailDef, PhaseDefForLegend } from '@/lib/utils/buildFlatRows'
import {
  computeBracketData,
  computeBracketAreaWidth,
} from '@/lib/utils/bracketUtils'

// ─── Constants ──────────────────────────────────────────

const ROW_HEIGHT = 40
const PRIMARY_RAIL_W = 4
const SUB_RAIL_W = 4
const SUB_RAIL_GAP = 6
const LANE_WIDTH = 14
const ISSUE_COLOR = '#EF4444'

// ─── Props ──────────────────────────────────────────────

export interface FlatMilestoneListProps {
  rows: FlatRow[]
  mode: 'table' | 'config'
  phaseDefinitions: PhaseDefForLegend[]
  subPhaseRails: SubPhaseRailDef[]
  pairIssues: Record<string, string>
  // Table mode
  onDelete?: (milestoneId: string) => void
  onEditMilestone?: (milestoneId: string) => void
  onReorder?: (rows: FlatRow[]) => void
  draggable?: boolean
  // Config mode
  config?: Record<string, boolean> | null
  parentConfig?: Record<string, boolean> | null
  overriddenIds?: Set<string> | null
  overrideLabel?: string | null
  onToggle?: (milestoneId: string) => void
}

// ─── Component ──────────────────────────────────────────

export function FlatMilestoneList({
  rows,
  mode,
  phaseDefinitions,
  subPhaseRails,
  pairIssues,
  onDelete,
  onEditMilestone,
  onReorder,
  draggable = false,
  config = null,
  parentConfig = null,
  overriddenIds = null,
  overrideLabel = 'OVERRIDE',
  onToggle,
}: FlatMilestoneListProps) {
  const isTable = mode === 'table'

  // ── DnD state ──
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null)

  // ── Bracket computation ──
  const brackets = useMemo(
    () => computeBracketData(rows, pairIssues),
    [rows, pairIssues]
  )
  const bracketAreaWidth = useMemo(
    () => computeBracketAreaWidth(brackets),
    [brackets]
  )

  // ── Sub-phase rail layout ──
  const subRailTotalWidth =
    subPhaseRails.length > 0
      ? subPhaseRails.length * (SUB_RAIL_W + 4) + SUB_RAIL_GAP
      : 0
  const totalLeftPad = 6 + PRIMARY_RAIL_W + subRailTotalWidth

  // ── Row numbering (all rows) ──
  const rowNumbers = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      map.set(rows[i].id, i + 1)
    }
    return map
  }, [rows])

  // ── DnD handlers ──
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

      const fromIdx = rows.findIndex(r => r.id === dragId)
      const toIdx = rows.findIndex(r => r.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return

      const reordered = [...rows]
      const [moved] = reordered.splice(fromIdx, 1)
      let insertIdx = reordered.findIndex(r => r.id === targetId)
      if (dropPos === 'after') insertIdx++
      reordered.splice(insertIdx, 0, moved)
      onReorder(reordered)

      setDragId(null)
      setDropTargetId(null)
      setDropPos(null)
    },
    [dragId, dropPos, rows, onReorder]
  )

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDropTargetId(null)
    setDropPos(null)
  }, [])

  // ── Render ──
  const totalHeight = rows.length * ROW_HEIGHT

  return (
    <div>
      {/* Phase legend */}
      <div className="flex gap-3.5 mb-4 px-3.5 py-2.5 bg-white rounded-lg border border-slate-200 flex-wrap items-center">
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
          Phases
        </span>
        {phaseDefinitions.map(pd => (
          <div key={pd.key} className="flex items-center gap-[5px] text-[11px]">
            <div
              className="rounded-sm"
              style={{
                width: 3,
                height: pd.depth === 0 ? 14 : 10,
                background: pd.color,
              }}
            />
            <span
              className={pd.depth === 0 ? 'font-semibold text-slate-600' : 'font-normal text-slate-600'}
            >
              {pd.depth === 1 && (
                <span className="text-slate-300 mr-0.5 text-[10px]">{'\u21B3'}</span>
              )}
              {pd.label}
            </span>
          </div>
        ))}
      </div>

      {/* Milestone list container */}
      <div
        className="bg-white rounded-[10px] border border-slate-200 overflow-hidden relative"
      >
        {/* Primary rail SVG */}
        <svg
          className="absolute z-[4] overflow-visible"
          style={{ left: 6, top: 0, width: PRIMARY_RAIL_W, height: totalHeight }}
        >
          {rows.map((row, idx) => {
            const y = idx * ROW_HEIGHT
            if (row.isPhaseTransition) {
              const gradId = `flat-grad-${idx}`
              return (
                <g key={row.id}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={row.transitionFromColor} />
                      <stop offset="100%" stopColor={row.transitionToColor} />
                    </linearGradient>
                  </defs>
                  <rect
                    x="0"
                    y={y}
                    width={PRIMARY_RAIL_W}
                    height={ROW_HEIGHT}
                    fill={`url(#${gradId})`}
                  />
                </g>
              )
            }
            // Determine if first/last of a color segment for rounding
            const prevColor = idx > 0 ? rows[idx - 1].primaryColor : null
            const nextColor = idx < rows.length - 1 ? rows[idx + 1].primaryColor : null
            const isFirst = prevColor !== row.primaryColor
            const isLast = nextColor !== row.primaryColor
            return (
              <rect
                key={row.id}
                x="0"
                y={y}
                width={PRIMARY_RAIL_W}
                height={ROW_HEIGHT}
                rx={isFirst || isLast ? 2 : 0}
                fill={row.primaryColor}
              />
            )
          })}
        </svg>

        {/* Sub-phase rails */}
        {subPhaseRails.map((rail, spIdx) => {
          const x = 6 + PRIMARY_RAIL_W + SUB_RAIL_GAP + spIdx * (SUB_RAIL_W + 4)
          const yStart = rail.startRowIndex * ROW_HEIGHT + 4
          const yEnd = (rail.endRowIndex + 1) * ROW_HEIGHT - 4
          const h = yEnd - yStart
          if (h <= 0) return null
          return (
            <div
              key={rail.phaseKey}
              className="absolute z-[4] rounded-[3px] opacity-70"
              style={{
                left: x,
                top: yStart,
                width: SUB_RAIL_W,
                height: h,
                background: rail.color,
              }}
            />
          )
        })}

        {/* Pair bracket SVG */}
        {brackets.length > 0 && (
          <svg
            className="absolute z-[5] overflow-visible"
            style={{
              top: 0,
              right: 8,
              width: bracketAreaWidth,
              height: totalHeight,
            }}
          >
            {brackets.map(b => {
              const x = bracketAreaWidth - b.lane * LANE_WIDTH - 10
              const yStart = b.start * ROW_HEIGHT + ROW_HEIGHT / 2
              const yEnd = b.end * ROW_HEIGHT + ROW_HEIGHT / 2
              const strokeColor = b.hasIssue ? ISSUE_COLOR : b.color.dot

              return (
                <g key={b.group}>
                  {/* Vertical bracket line */}
                  <line
                    x1={x} y1={yStart} x2={x} y2={yEnd}
                    stroke={strokeColor} strokeWidth={2} strokeLinecap="round"
                  />
                  {/* Top horizontal tick */}
                  <line
                    x1={x} y1={yStart} x2={x + 6} y2={yStart}
                    stroke={strokeColor} strokeWidth={2} strokeLinecap="round"
                  />
                  {/* Bottom horizontal tick */}
                  <line
                    x1={x} y1={yEnd} x2={x + 6} y2={yEnd}
                    stroke={strokeColor} strokeWidth={2} strokeLinecap="round"
                  />
                  {/* Start endpoint dot */}
                  <circle cx={x + 8} cy={yStart} r={3} fill={strokeColor} />
                  {/* End endpoint dot */}
                  <circle cx={x + 8} cy={yEnd} r={3} fill={strokeColor} />
                  {/* Small dots for in-between rows */}
                  {rows.map((ms, ri) => {
                    if (ri <= b.start || ri >= b.end) return null
                    if (ms.pair_group) return null
                    return (
                      <circle
                        key={ms.id}
                        cx={x + 8}
                        cy={ri * ROW_HEIGHT + ROW_HEIGHT / 2}
                        r={1.5}
                        fill={strokeColor}
                        opacity={0.35}
                      />
                    )
                  })}
                </g>
              )
            })}
          </svg>
        )}

        {/* Rows */}
        {rows.map((row) => {
          const isDragging = dragId === row.id
          const isTarget = dropTargetId === row.id
          const isHovered = hoveredId === row.id
          const hasIssue = row.pair_group ? !!pairIssues[row.pair_group] : false
          const isOverridden = overriddenIds?.has(row.id) ?? false
          const parentVal = parentConfig?.[row.id]
          const isOn = config ? config[row.id] !== false : true
          const counter = rowNumbers.get(row.id)

          // Find bracket color for pair badge
          const pairBracket = row.pair_group
            ? brackets.find(b => b.group === row.pair_group)
            : null

          // Determine row background
          let rowBg = 'transparent'
          if (hasIssue) rowBg = 'rgba(254,242,242,0.03)'
          if (isOverridden) rowBg = '#FFFBEB'

          const canDrag = draggable
          const canToggle = !row.is_boundary && onToggle

          return (
            <div
              key={row.id}
              draggable={canDrag || undefined}
              onDragStart={canDrag ? (e) => handleDragStart(e, row.id) : undefined}
              onDragOver={canDrag ? (e) => handleDragOver(e, row.id) : undefined}
              onDragEnd={canDrag ? handleDragEnd : undefined}
              onDrop={canDrag ? (e) => handleDrop(e, row.id) : undefined}
              onMouseEnter={() => setHoveredId(row.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative"
              style={{
                height: ROW_HEIGHT,
                opacity: isDragging ? 0.25 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Drop indicators */}
              {isTarget && dropPos === 'before' && (
                <div
                  className="absolute top-[-1px] right-3 h-0.5 bg-blue-500 rounded-sm z-20"
                  style={{ left: totalLeftPad + 8 }}
                >
                  <div className="absolute left-[-3px] top-[-3px] w-2 h-2 rounded-full bg-blue-500" />
                </div>
              )}
              {isTarget && dropPos === 'after' && (
                <div
                  className="absolute bottom-[-1px] right-3 h-0.5 bg-blue-500 rounded-sm z-20"
                  style={{ left: totalLeftPad + 8 }}
                >
                  <div className="absolute left-[-3px] top-[-3px] w-2 h-2 rounded-full bg-blue-500" />
                </div>
              )}

              {/* Row content */}
              <div
                onClick={canToggle ? () => onToggle!(row.id) : undefined}
                className={`flex items-center gap-[7px] h-full border-b border-[#F1F5F9] relative z-[3] transition-colors ${
                  canDrag
                    ? 'cursor-grab'
                    : canToggle
                      ? 'cursor-pointer'
                      : 'cursor-default'
                }`}
                style={{
                  background: rowBg,
                  paddingLeft: totalLeftPad + 8,
                  paddingRight: bracketAreaWidth + 16,
                }}
                onMouseEnter={(e) => {
                  if (rowBg === 'transparent')
                    e.currentTarget.style.background = '#F8FAFC'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = rowBg
                }}
              >
                {/* Grip handle (table mode, non-boundary) */}
                {isTable && canDrag && (
                  <div className="cursor-grab flex items-center shrink-0">
                    <GripVertical className="w-3.5 h-3.5 opacity-30" />
                  </div>
                )}

                {/* Row number (table mode, non-boundary) */}
                {isTable && counter !== undefined && (
                  <span className="text-[10px] text-slate-300 w-5 text-center shrink-0 tabular-nums">
                    {counter}
                  </span>
                )}

                {/* Checkbox (config mode, non-boundary) */}
                {!isTable && config && canToggle && (
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
                  className={`text-xs flex-1 ${
                    row.is_boundary
                      ? 'font-semibold text-slate-800'
                      : isOverridden
                        ? 'font-medium text-slate-800'
                        : 'font-normal text-slate-800'
                  } ${config && !isOn && !row.is_boundary ? 'line-through opacity-40' : ''}`}
                >
                  {row.display_name}
                </span>

                {/* Interval badge */}
                {(row.min_minutes != null || row.max_minutes != null) && (
                  <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-[1px] shrink-0">
                    {row.min_minutes != null && row.max_minutes != null
                      ? `${row.min_minutes}\u2013${row.max_minutes} min`
                      : row.max_minutes != null
                        ? `\u2264${row.max_minutes} min`
                        : `\u2265${row.min_minutes} min`}
                  </span>
                )}

                {/* Phase start/end tags */}
                {row.phaseTags.map((tag, ti) => (
                  <span
                    key={ti}
                    className="text-[8px] font-bold px-[5px] py-[2px] rounded-[3px] uppercase whitespace-nowrap shrink-0"
                    style={{
                      background: `${tag.color}15`,
                      color: tag.color,
                      border: `1px solid ${tag.color}30`,
                    }}
                  >
                    {tag.label} {tag.action}
                  </span>
                ))}

                {/* Pair badge */}
                {row.pair_position && pairBracket && (
                  <span
                    className="text-[8px] font-bold px-[5px] py-[2px] rounded-[3px] uppercase shrink-0"
                    style={{
                      background: hasIssue
                        ? '#FEE2E2'
                        : `${pairBracket.color.dot}12`,
                      color: hasIssue ? '#DC2626' : pairBracket.color.dot,
                      border: `1px solid ${hasIssue ? '#FECACA' : pairBracket.color.dot + '30'}`,
                    }}
                  >
                    {row.pair_position === 'start' ? 'START' : 'END'}
                  </span>
                )}

                {/* Override badge (config mode) */}
                {isOverridden && overrideLabel && (
                  <span className="text-xs font-bold px-1 py-[1px] rounded-sm bg-amber-100 text-amber-700 shrink-0">
                    {overrideLabel}
                  </span>
                )}

                {/* "was on/off" text (config mode) */}
                {isOverridden && parentVal !== undefined && (
                  <span className="text-xs text-slate-400 shrink-0">
                    was {parentVal ? 'on' : 'off'}
                  </span>
                )}

                {/* Lock icon (boundary rows) */}
                {row.is_boundary && (
                  <span className="text-slate-300 flex items-center shrink-0">
                    <Lock className="w-[10px] h-[10px]" />
                  </span>
                )}

                {/* Alert icon (pair issue) */}
                {hasIssue && (
                  <span className="text-red-500 flex items-center shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}

                {/* Pencil/edit button (table mode or boundary, hover-reveal) */}
                {onEditMilestone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditMilestone(row.id)
                    }}
                    className={`border-none bg-transparent cursor-pointer text-slate-300 hover:text-blue-500 flex items-center p-0.5 rounded transition-opacity shrink-0 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Pencil className="w-[11px] h-[11px]" />
                  </button>
                )}

                {/* Archive button (table mode, non-boundary, hover-reveal) */}
                {isTable && !row.is_boundary && onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(row.id)
                    }}
                    className={`border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 flex items-center p-0.5 rounded transition-opacity shrink-0 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Archive className="w-[11px] h-[11px]" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
