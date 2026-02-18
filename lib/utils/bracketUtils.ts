// lib/utils/bracketUtils.ts
// Bracket computation utilities for paired milestones.
// Moved from PairBracketOverlay.tsx during dead-code cleanup (Phase 4).

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

// ─── Types ──────────────────────────────────────────────────────────

/** Minimal interface for milestones passed to bracket computation */
export interface BracketMilestone {
  pair_group: string | null
}

export interface BracketRange {
  group: string
  start: number
  end: number
  color: PairColorConfig
  hasIssue: boolean
  lane: number
}

// ─── Computation Utilities ──────────────────────────────────────────

const LANE_WIDTH = 14

/**
 * Compute bracket data for a list of milestones.
 * Groups pairs by pair_group, finds start/end indices, runs lane allocation.
 */
export function computeBracketData(
  milestones: BracketMilestone[],
  pairIssues: Record<string, string>,
  pairColors?: Record<string, PairColorConfig>
): BracketRange[] {
  // Find unique pair groups
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
