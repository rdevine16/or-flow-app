// lib/utils/buildFlatRows.ts
// Builds a flat ordered row array from the phase tree and active milestones.
// Used by FlatMilestoneList to render a single continuous list with color rails.

import type { PhaseBlockMilestone } from '@/components/settings/milestones/PhaseBlock'
import type { PhaseDefLike, PhaseTreeNode } from '@/lib/milestone-phase-config'
import { resolveColorKey } from '@/lib/milestone-phase-config'

// ─── Types ──────────────────────────────────────────────

export interface PhaseTag {
  label: string
  action: 'start' | 'end'
  color: string
}

export interface FlatRow extends PhaseBlockMilestone {
  /** Primary rail color (top-level phase hex) */
  primaryColor: string
  /** True if this row is at a phase transition boundary */
  isPhaseTransition: boolean
  /** Gradient from-color (equals primaryColor when no transition) */
  transitionFromColor: string
  /** Gradient to-color (equals primaryColor when no transition) */
  transitionToColor: string
  /** Phase start/end tags to display inline */
  phaseTags: PhaseTag[]
  /** Top-level phase key this row belongs to (for drag boundary enforcement) */
  ownerPhaseKey: string
}

export interface SubPhaseRailDef {
  phaseKey: string
  phaseLabel: string
  color: string
  startRowIndex: number
  endRowIndex: number
}

export interface PhaseDefForLegend {
  key: string
  label: string
  color: string
  depth: number // 0 = top-level, 1 = child
}

export interface BuildFlatRowsResult {
  rows: FlatRow[]
  subPhaseRails: SubPhaseRailDef[]
  legendPhases: PhaseDefForLegend[]
}

/** Minimal milestone interface satisfied by all page-level FacilityMilestone types */
export interface FlatRowMilestone {
  id: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  phase_group: string | null
  min_minutes: number | null
  max_minutes: number | null
}

/** Phase definition with boundary milestone refs (extends PhaseDefLike) */
export interface PhaseDefWithBoundaries extends PhaseDefLike {
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
}

const UNPHASED_COLOR = '#94A3B8'

// ─── Builder ─────────────────────────────────────────────

/**
 * Build a flat ordered FlatRow[] array from the phase tree and active milestones.
 *
 * Walk the phase tree in order. For each top-level phase:
 *  1. Emit start boundary row
 *  2. Emit non-boundary milestones (parent + child phases interleaved by display_order)
 *  3. Emit end boundary row (or shared transition boundary handled by next phase)
 *
 * Shared boundaries (where phase A's end = phase B's start) are emitted once
 * with isPhaseTransition = true and gradient color data.
 */
export function buildFlatRows(
  phaseTree: PhaseTreeNode<PhaseDefWithBoundaries>[],
  activeMilestones: FlatRowMilestone[],
  pairGroupMap: Map<string, string>,
  milestoneById: Map<string, FlatRowMilestone>,
  configOrderMap?: Map<string, number>,
): BuildFlatRowsResult {
  const rows: FlatRow[] = []
  const emittedIds = new Set<string>()

  // 1. Compute top-level boundary IDs
  const topLevelBoundaryIds = new Set<string>()
  for (const node of phaseTree) {
    topLevelBoundaryIds.add(node.phase.start_milestone_id)
    topLevelBoundaryIds.add(node.phase.end_milestone_id)
  }

  // 2. Pre-compute phase tags for milestone IDs
  const phaseTagsMap = new Map<string, PhaseTag[]>()
  const addTag = (msId: string, tag: PhaseTag) => {
    const existing = phaseTagsMap.get(msId) || []
    existing.push(tag)
    phaseTagsMap.set(msId, existing)
  }

  for (const node of phaseTree) {
    const color = resolveColorKey(node.phase.color_key).hex
    addTag(node.phase.start_milestone_id, { label: node.phase.display_name, action: 'start', color })
    addTag(node.phase.end_milestone_id, { label: node.phase.display_name, action: 'end', color })

    for (const child of node.children) {
      const childColor = resolveColorKey(child.phase.color_key).hex
      addTag(child.phase.start_milestone_id, { label: child.phase.display_name, action: 'start', color: childColor })
      addTag(child.phase.end_milestone_id, { label: child.phase.display_name, action: 'end', color: childColor })
    }
  }

  // Helper: get sort key for a milestone
  const orderOf = (ms: FlatRowMilestone) =>
    configOrderMap?.get(ms.id) ?? ms.display_order

  // Helper: create a FlatRow from a milestone
  const toFlatRow = (
    ms: FlatRowMilestone,
    isBoundary: boolean,
    primaryColor: string,
    ownerPhaseKey: string,
    isPhaseTransition: boolean,
    fromColor: string,
    toColor: string,
  ): FlatRow => ({
    id: ms.id,
    display_name: ms.display_name,
    phase_group: ms.phase_group,
    is_boundary: isBoundary,
    pair_with_id: ms.pair_with_id,
    pair_position: ms.pair_position,
    pair_group: pairGroupMap.get(ms.id) || null,
    min_minutes: ms.min_minutes,
    max_minutes: ms.max_minutes,
    primaryColor,
    isPhaseTransition,
    transitionFromColor: fromColor,
    transitionToColor: toColor,
    phaseTags: phaseTagsMap.get(ms.id) || [],
    ownerPhaseKey,
  })

  // 3. Walk phase tree and emit rows
  for (let i = 0; i < phaseTree.length; i++) {
    const node = phaseTree[i]
    const phase = node.phase
    const color = resolveColorKey(phase.color_key).hex
    const prevNode = i > 0 ? phaseTree[i - 1] : null
    const prevColor = prevNode ? resolveColorKey(prevNode.phase.color_key).hex : color

    // Start boundary
    if (!emittedIds.has(phase.start_milestone_id)) {
      const ms = milestoneById.get(phase.start_milestone_id)
      if (ms) {
        const isShared = prevNode?.phase.end_milestone_id === phase.start_milestone_id
        rows.push(toFlatRow(
          ms,
          true,
          isShared ? prevColor : color,
          phase.name,
          isShared,
          isShared ? prevColor : color,
          color,
        ))
        emittedIds.add(ms.id)
      }
    }

    // Non-boundary milestones for this phase and children
    const allPhaseNames = new Set([phase.name, ...node.children.map(c => c.phase.name)])
    const phaseMilestones = activeMilestones
      .filter(m =>
        m.phase_group !== null &&
        allPhaseNames.has(m.phase_group) &&
        !topLevelBoundaryIds.has(m.id)
      )
      .sort((a, b) => orderOf(a) - orderOf(b))

    for (const ms of phaseMilestones) {
      if (emittedIds.has(ms.id)) continue
      rows.push(toFlatRow(ms, false, color, phase.name, false, color, color))
      emittedIds.add(ms.id)
    }

    // End boundary — only emit if NOT shared with next phase's start
    const nextNode = i < phaseTree.length - 1 ? phaseTree[i + 1] : null
    const isSharedWithNext = nextNode?.phase.start_milestone_id === phase.end_milestone_id

    if (!isSharedWithNext && !emittedIds.has(phase.end_milestone_id)) {
      const ms = milestoneById.get(phase.end_milestone_id)
      if (ms) {
        rows.push(toFlatRow(ms, true, color, phase.name, false, color, color))
        emittedIds.add(ms.id)
      }
    }
    // If shared, the next phase's start boundary loop will emit it with transition
  }

  // 4. Unphased milestones (not yet emitted, not top-level boundaries)
  const unphasedMs = activeMilestones
    .filter(m => !emittedIds.has(m.id) && !topLevelBoundaryIds.has(m.id))
    .sort((a, b) => orderOf(a) - orderOf(b))

  for (const ms of unphasedMs) {
    rows.push(toFlatRow(
      ms, false, UNPHASED_COLOR, 'unphased', false, UNPHASED_COLOR, UNPHASED_COLOR,
    ))
  }

  // 5. Compute sub-phase rails
  const subPhaseRails: SubPhaseRailDef[] = []
  for (const node of phaseTree) {
    for (const child of node.children) {
      const childColor = resolveColorKey(child.phase.color_key).hex

      // Primary: find start/end milestone row indices
      const startMs = milestoneById.get(child.phase.start_milestone_id)
      const endMs = milestoneById.get(child.phase.end_milestone_id)
      const startIdx = startMs ? rows.findIndex(r => r.id === startMs.id) : -1
      const endIdx = endMs ? rows.findIndex(r => r.id === endMs.id) : -1

      if (startIdx >= 0 && endIdx >= 0 && endIdx >= startIdx) {
        subPhaseRails.push({
          phaseKey: child.phase.name,
          phaseLabel: child.phase.display_name,
          color: childColor,
          startRowIndex: startIdx,
          endRowIndex: endIdx,
        })
      } else {
        // Fallback: find rows by matching phase_group
        let firstIdx = -1
        let lastIdx = -1
        for (let r = 0; r < rows.length; r++) {
          if (rows[r].phase_group === child.phase.name) {
            if (firstIdx === -1) firstIdx = r
            lastIdx = r
          }
        }
        if (firstIdx >= 0) {
          subPhaseRails.push({
            phaseKey: child.phase.name,
            phaseLabel: child.phase.display_name,
            color: childColor,
            startRowIndex: firstIdx,
            endRowIndex: lastIdx,
          })
        }
      }
    }
  }

  // 6. Build legend
  const legendPhases: PhaseDefForLegend[] = []
  for (const node of phaseTree) {
    const color = resolveColorKey(node.phase.color_key).hex
    legendPhases.push({ key: node.phase.name, label: node.phase.display_name, color, depth: 0 })
    for (const child of node.children) {
      const childColor = resolveColorKey(child.phase.color_key).hex
      legendPhases.push({ key: child.phase.name, label: child.phase.display_name, color: childColor, depth: 1 })
    }
  }

  return { rows, subPhaseRails, legendPhases }
}
