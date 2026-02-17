// components/settings/milestones/PairBracketOverlay.tsx
'use client'

import { useMemo } from 'react'
import type { PhaseBlockMilestone } from './PhaseBlock'

// ─── Pair Color Config ──────────────────────────────────────────────

export interface PairColorConfig {
  dot: string
  bg: string
  border: string
}

/**
 * Default pair color palette. Colors are auto-assigned to pair groups
 * in the order they appear. Override via the `pairColors` prop.
 */
const DEFAULT_PAIR_PALETTE: PairColorConfig[] = [
  { dot: '#3B82F6', bg: '#EFF6FF', border: '#93C5FD' },   // blue
  { dot: '#22C55E', bg: '#F0FDF4', border: '#86EFAC' },   // green
  { dot: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D' },   // amber
  { dot: '#EC4899', bg: '#FDF2F8', border: '#F9A8D4' },   // pink
  { dot: '#6366F1', bg: '#EEF2FF', border: '#A5B4FC' },   // indigo
  { dot: '#14B8A6', bg: '#F0FDFA', border: '#5EEAD4' },   // teal
  { dot: '#F97316', bg: '#FFF7ED', border: '#FDBA74' },   // orange
  { dot: '#A855F7', bg: '#FAF5FF', border: '#C084FC' },   // purple
]

const ISSUE_COLOR = '#EF4444'

// ─── Types ──────────────────────────────────────────────────────────

export interface BracketRange {
  group: string
  start: number
  end: number
  color: PairColorConfig
  hasIssue: boolean
  lane: number
}

// ─── Computation Utilities (exported for testing + PhaseBlock) ──────

const ROW_HEIGHT = 34
const LANE_WIDTH = 14

/**
 * Compute bracket data for a list of non-boundary milestones in a single phase.
 * Groups pairs by pair_group, finds start/end indices, runs lane allocation.
 */
export function computeBracketData(
  milestones: PhaseBlockMilestone[],
  pairIssues: Record<string, string>,
  pairColors?: Record<string, PairColorConfig>
): BracketRange[] {
  // Find unique pair groups in this phase
  const pairGroupsInPhase = [
    ...new Set(
      milestones
        .filter((m) => m.pair_group)
        .map((m) => m.pair_group!)
    ),
  ]

  if (pairGroupsInPhase.length === 0) return []

  // Build ranges: for each pair group, find start and end milestone indices
  const ranges: BracketRange[] = []
  let autoColorIdx = 0

  for (const group of pairGroupsInPhase) {
    const indices: number[] = []
    milestones.forEach((ms, i) => {
      if (ms.pair_group === group) indices.push(i)
    })

    if (indices.length < 2) continue

    // Resolve color: use explicit map, or auto-assign from palette
    const color =
      pairColors?.[group] ??
      DEFAULT_PAIR_PALETTE[autoColorIdx % DEFAULT_PAIR_PALETTE.length]
    autoColorIdx++

    ranges.push({
      group,
      start: Math.min(...indices),
      end: Math.max(...indices),
      color,
      hasIssue: !!pairIssues[group],
      lane: 0,
    })
  }

  // Sort by span width (largest first) for lane allocation
  ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start))

  // Lane allocation: assign lanes so overlapping brackets don't collide
  const allocated: BracketRange[] = []
  for (const range of ranges) {
    let lane = 0
    while (
      allocated.some(
        (a) =>
          a.lane === lane && !(a.end < range.start || a.start > range.end)
      )
    ) {
      lane++
    }
    range.lane = lane
    allocated.push(range)
  }

  return ranges
}

/**
 * Compute the pixel width needed for the bracket area.
 * Returns 0 if no brackets.
 */
export function computeBracketAreaWidth(brackets: BracketRange[]): number {
  if (brackets.length === 0) return 0
  const maxLane = Math.max(...brackets.map((b) => b.lane)) + 1
  return maxLane * LANE_WIDTH + (maxLane > 0 ? 4 : 0)
}

// ─── Component ──────────────────────────────────────────────────────

interface PairBracketOverlayProps {
  /** Non-boundary milestones in display order for this phase */
  milestones: PhaseBlockMilestone[]
  /** Map of pair_group → issue description from detectPairIssues */
  pairIssues: Record<string, string>
  /** Optional explicit color map: pair_group → colors. Auto-assigned if missing. */
  pairColors?: Record<string, PairColorConfig>
}

/**
 * SVG overlay that renders bracket lines connecting START/END paired milestones.
 *
 * Renders as an absolutely-positioned layer inside PhaseBlock's expanded rows.
 * Each bracket is a vertical line with horizontal ticks and filled dots at endpoints.
 * Milestones between a pair get small indicator dots (opacity 0.35).
 * Pairs with issues are rendered in red.
 *
 * Usage:
 * ```tsx
 * <PhaseBlock milestones={ms} ...>
 *   <PairBracketOverlay milestones={ms} pairIssues={issues} />
 * </PhaseBlock>
 * ```
 */
export function PairBracketOverlay({
  milestones,
  pairIssues,
  pairColors,
}: PairBracketOverlayProps) {
  const brackets = useMemo(
    () => computeBracketData(milestones, pairIssues, pairColors),
    [milestones, pairIssues, pairColors]
  )

  const areaWidth = useMemo(
    () => computeBracketAreaWidth(brackets),
    [brackets]
  )

  if (brackets.length === 0) return null

  const totalHeight = milestones.length * ROW_HEIGHT

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-[5]"
      style={{ width: areaWidth, height: totalHeight }}
    >
      {brackets.map((b) => {
        const x = areaWidth - b.lane * LANE_WIDTH - 10
        const yStart = b.start * ROW_HEIGHT + ROW_HEIGHT / 2
        const yEnd = b.end * ROW_HEIGHT + ROW_HEIGHT / 2
        const strokeColor = b.hasIssue ? ISSUE_COLOR : b.color.dot

        return (
          <svg
            key={b.group}
            className="absolute top-0 left-0 w-full h-full overflow-visible"
          >
            {/* Vertical bracket line */}
            <line
              x1={x}
              y1={yStart}
              x2={x}
              y2={yEnd}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* Top horizontal tick */}
            <line
              x1={x}
              y1={yStart}
              x2={x + 6}
              y2={yStart}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* Bottom horizontal tick */}
            <line
              x1={x}
              y1={yEnd}
              x2={x + 6}
              y2={yEnd}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {/* Start endpoint dot */}
            <circle cx={x + 8} cy={yStart} r={3} fill={strokeColor} />
            {/* End endpoint dot */}
            <circle cx={x + 8} cy={yEnd} r={3} fill={strokeColor} />

            {/* Small dots for milestones between the pair */}
            {milestones.map((ms, i) => {
              if (i <= b.start || i >= b.end) return null
              if (ms.pair_group) return null // Skip paired milestones
              return (
                <circle
                  key={ms.id}
                  cx={x + 8}
                  cy={i * ROW_HEIGHT + ROW_HEIGHT / 2}
                  r={1.5}
                  fill={strokeColor}
                  opacity={0.35}
                />
              )
            })}
          </svg>
        )
      })}
    </div>
  )
}
