// lib/utils/buildFlatRows.ts
// Builds a flat ordered row array from the phase tree and active milestones.
// Used by FlatMilestoneList to render a single continuous list with color rails.
//
// ORDER IS DETERMINED BY display_order (or configOrderMap), NOT by phase tree
// structure. Phase ranges are computed dynamically from boundary positions —
// just like the reference design. This means dragging ANY milestone (including
// boundaries) changes where phases visually start and end.

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
  /** Top-level phase key this row belongs to */
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
 * Build a flat ordered FlatRow[] array from active milestones sorted by
 * display_order (or configOrderMap). Phase membership and transition colors
 * are computed dynamically from where boundary milestones sit in the sorted
 * order — so dragging a boundary changes the phase ranges.
 */
export function buildFlatRows(
  phaseTree: PhaseTreeNode<PhaseDefWithBoundaries>[],
  activeMilestones: FlatRowMilestone[],
  pairGroupMap: Map<string, string>,
  milestoneById: Map<string, FlatRowMilestone>,
  configOrderMap?: Map<string, number>,
): BuildFlatRowsResult {
  // Sort key helper
  const orderOf = (ms: FlatRowMilestone) =>
    configOrderMap?.get(ms.id) ?? ms.display_order

  // 1. Sort ALL milestones by display_order (boundaries included)
  const sorted = [...activeMilestones].sort((a, b) => orderOf(a) - orderOf(b))

  // 2. Build top-level boundary ID set
  const topLevelBoundaryIds = new Set<string>()
  for (const node of phaseTree) {
    topLevelBoundaryIds.add(node.phase.start_milestone_id)
    topLevelBoundaryIds.add(node.phase.end_milestone_id)
  }

  // 3. Pre-compute phase tags for milestone IDs
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

  // 4. Compute phase ranges from sorted positions
  //    For each top-level phase, find the indices of its boundary milestones
  const phaseRanges: { name: string; color: string; start: number; end: number }[] = []
  for (const node of phaseTree) {
    const startIdx = sorted.findIndex(m => m.id === node.phase.start_milestone_id)
    const endIdx = sorted.findIndex(m => m.id === node.phase.end_milestone_id)
    const color = resolveColorKey(node.phase.color_key).hex
    if (startIdx >= 0 && endIdx >= 0) {
      phaseRanges.push({ name: node.phase.name, color, start: startIdx, end: endIdx })
    }
  }

  // 5. Helper: determine top-level phase(s) for a row index
  const getPhaseForIndex = (idx: number): {
    from: string; to: string; fromColor: string; toColor: string
  } | null => {
    const containing: { name: string; color: string; start: number }[] = []
    for (const range of phaseRanges) {
      if (range.start > range.end) continue // inverted range
      if (idx >= range.start && idx <= range.end) {
        containing.push({ name: range.name, color: range.color, start: range.start })
      }
    }

    if (containing.length === 0) return null
    if (containing.length === 1) {
      return {
        from: containing[0].name,
        to: containing[0].name,
        fromColor: containing[0].color,
        toColor: containing[0].color,
      }
    }
    // Transition: row sits in two top-level phases
    // The one that started earlier is "from", the other is "to"
    containing.sort((a, b) => a.start - b.start)
    return {
      from: containing[0].name,
      to: containing[1].name,
      fromColor: containing[0].color,
      toColor: containing[1].color,
    }
  }

  // 6. Build FlatRows from sorted milestones
  const rows: FlatRow[] = []
  for (let i = 0; i < sorted.length; i++) {
    const ms = sorted[i]
    const isBoundary = topLevelBoundaryIds.has(ms.id)
    const phaseInfo = getPhaseForIndex(i)
    const isTransition = phaseInfo ? phaseInfo.from !== phaseInfo.to : false
    const primaryColor = phaseInfo ? phaseInfo.fromColor : UNPHASED_COLOR
    const ownerPhase = phaseInfo
      ? (isTransition ? phaseInfo.to : phaseInfo.from)
      : 'unphased'

    rows.push({
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
      isPhaseTransition: isTransition,
      transitionFromColor: phaseInfo?.fromColor ?? UNPHASED_COLOR,
      transitionToColor: phaseInfo?.toColor ?? UNPHASED_COLOR,
      phaseTags: phaseTagsMap.get(ms.id) || [],
      ownerPhaseKey: ownerPhase,
    })
  }

  // 7. Compute sub-phase rails
  const subPhaseRails: SubPhaseRailDef[] = []
  for (const node of phaseTree) {
    for (const child of node.children) {
      const childColor = resolveColorKey(child.phase.color_key).hex

      // Find boundary milestone indices in sorted array
      const startIdx = sorted.findIndex(m => m.id === child.phase.start_milestone_id)
      const endIdx = sorted.findIndex(m => m.id === child.phase.end_milestone_id)

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

  // 8. Build legend
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
