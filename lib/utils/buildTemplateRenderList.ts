// lib/utils/buildTemplateRenderList.ts
// Core rendering logic for the milestone template builder.
// Transforms DB data (template items, phases, milestones) into a flat
// array of render items that handles shared boundaries, edge milestones,
// sub-phase indicators, drop zones, and unassigned milestones.

import { resolveColorKey, type ColorKeyConfig } from '@/lib/milestone-phase-config'

// ─── Input Types ───────────────────────────────────────────

export interface TemplateItemData {
  id: string
  template_id: string
  facility_milestone_id: string
  facility_phase_id: string | null
  display_order: number
}

export interface PhaseLookup {
  id: string
  name: string
  display_name: string
  color_key: string | null
  display_order: number
  parent_phase_id: string | null
}

export interface MilestoneLookup {
  id: string
  name: string
  display_name: string
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
}

// ─── Output Types ──────────────────────────────────────────

export interface PhaseHeaderItem {
  type: 'phase-header'
  phase: PhaseLookup
  color: ColorKeyConfig
  itemCount: number
}

export interface SharedBoundaryItem {
  type: 'shared-boundary'
  milestone: MilestoneLookup
  templateItemId: string
  endsPhase: PhaseLookup
  startsPhase: PhaseLookup
  endsColor: ColorKeyConfig
  startsColor: ColorKeyConfig
}

export interface EdgeMilestoneItem {
  type: 'edge-milestone'
  milestone: MilestoneLookup
  templateItem: TemplateItemData
  phase: PhaseLookup
  color: ColorKeyConfig
  edge: 'start' | 'end'
}

export interface InteriorMilestoneItem {
  type: 'interior-milestone'
  milestone: MilestoneLookup
  templateItem: TemplateItemData
  phase: PhaseLookup
  color: ColorKeyConfig
}

export interface SubPhaseItem {
  type: 'sub-phase'
  phase: PhaseLookup
  parentPhase: PhaseLookup
  color: ColorKeyConfig
  milestones: { milestone: MilestoneLookup; templateItem: TemplateItemData }[]
}

export interface DropZoneItem {
  type: 'drop-zone'
  phaseId: string
  phaseName: string
  color: ColorKeyConfig
}

export interface UnassignedHeaderItem {
  type: 'unassigned-header'
  count: number
}

export interface UnassignedMilestoneItem {
  type: 'unassigned-milestone'
  milestone: MilestoneLookup
  templateItem: TemplateItemData
}

export type RenderItem =
  | PhaseHeaderItem
  | SharedBoundaryItem
  | EdgeMilestoneItem
  | InteriorMilestoneItem
  | SubPhaseItem
  | DropZoneItem
  | UnassignedHeaderItem
  | UnassignedMilestoneItem

// ─── Internal ──────────────────────────────────────────────

interface PhaseGroup {
  phase: PhaseLookup
  items: { item: TemplateItemData; milestone: MilestoneLookup }[]
}

// ─── Build Function ────────────────────────────────────────

export function buildTemplateRenderList(
  templateItems: TemplateItemData[],
  phases: PhaseLookup[],
  milestones: MilestoneLookup[],
  emptyPhaseIds?: Set<string>,
): RenderItem[] {
  const milestoneMap = new Map(milestones.map(m => [m.id, m]))
  const phaseMap = new Map(phases.map(p => [p.id, p]))

  // Group items by phase
  const phaseGroups = new Map<string, PhaseGroup>()
  const unassigned: { item: TemplateItemData; milestone: MilestoneLookup }[] = []

  const sorted = [...templateItems].sort((a, b) => a.display_order - b.display_order)

  for (const item of sorted) {
    const milestone = milestoneMap.get(item.facility_milestone_id)
    if (!milestone) continue

    if (!item.facility_phase_id) {
      unassigned.push({ item, milestone })
      continue
    }

    const phase = phaseMap.get(item.facility_phase_id)
    if (!phase) {
      unassigned.push({ item, milestone })
      continue
    }

    let group = phaseGroups.get(phase.id)
    if (!group) {
      group = { phase, items: [] }
      phaseGroups.set(phase.id, group)
    }
    group.items.push({ item, milestone })
  }

  // Top-level phases sorted by display_order
  const topLevel = Array.from(phaseGroups.values())
    .filter(g => !g.phase.parent_phase_id)
    .sort((a, b) => a.phase.display_order - b.phase.display_order)

  // Sub-phases grouped by parent
  const subPhaseMap = new Map<string, PhaseGroup[]>()
  for (const group of phaseGroups.values()) {
    if (group.phase.parent_phase_id) {
      const existing = subPhaseMap.get(group.phase.parent_phase_id) || []
      existing.push(group)
      subPhaseMap.set(group.phase.parent_phase_id, existing)
    }
  }

  const result: RenderItem[] = []

  for (let i = 0; i < topLevel.length; i++) {
    const group = topLevel[i]
    const { phase, items } = group
    const color = resolveColorKey(phase.color_key)

    const nextGroup = i < topLevel.length - 1 ? topLevel[i + 1] : null
    const prevGroup = i > 0 ? topLevel[i - 1] : null

    const firstMsId = items.length > 0 ? items[0].milestone.id : null
    const lastMsId = items.length > 0 ? items[items.length - 1].milestone.id : null
    const prevLastMsId = prevGroup?.items.length
      ? prevGroup.items[prevGroup.items.length - 1].milestone.id
      : null
    const nextFirstMsId = nextGroup?.items.length
      ? nextGroup.items[0].milestone.id
      : null

    const sharedWithPrev = !!(firstMsId && firstMsId === prevLastMsId)
    const sharedWithNext = !!(lastMsId && lastMsId === nextFirstMsId)

    // Phase header
    result.push({ type: 'phase-header', phase, color, itemCount: items.length })

    // Get sub-phases for this phase
    const subPhases = (subPhaseMap.get(phase.id) || [])
      .sort((a, b) => a.phase.display_order - b.phase.display_order)

    // Render milestones
    for (let j = 0; j < items.length; j++) {
      const { item, milestone } = items[j]
      const isFirst = j === 0
      const isLast = j === items.length - 1

      // Skip if rendered as shared boundary
      if (isFirst && sharedWithPrev) continue
      if (isLast && sharedWithNext) continue

      if (isFirst && !sharedWithPrev) {
        result.push({
          type: 'edge-milestone',
          milestone,
          templateItem: item,
          phase,
          color,
          edge: 'start',
        })
      } else if (isLast && !sharedWithNext) {
        result.push({
          type: 'edge-milestone',
          milestone,
          templateItem: item,
          phase,
          color,
          edge: 'end',
        })
      } else {
        result.push({
          type: 'interior-milestone',
          milestone,
          templateItem: item,
          phase,
          color,
        })
      }

      // Sub-phase indicator: render after the parent milestone matching the sub-phase's last item
      for (const sp of subPhases) {
        if (sp.items.length > 0 && sp.items[sp.items.length - 1].milestone.id === milestone.id) {
          result.push({
            type: 'sub-phase',
            phase: sp.phase,
            parentPhase: phase,
            color: resolveColorKey(sp.phase.color_key),
            milestones: sp.items.map(si => ({ milestone: si.milestone, templateItem: si.item })),
          })
        }
      }
    }

    // Drop zone for this phase
    result.push({ type: 'drop-zone', phaseId: phase.id, phaseName: phase.display_name, color })

    // Shared boundary after this phase
    if (sharedWithNext && lastMsId && nextGroup) {
      const ms = milestoneMap.get(lastMsId)
      if (ms) {
        result.push({
          type: 'shared-boundary',
          milestone: ms,
          templateItemId: items[items.length - 1].item.id,
          endsPhase: phase,
          startsPhase: nextGroup.phase,
          endsColor: color,
          startsColor: resolveColorKey(nextGroup.phase.color_key),
        })
      }
    }
  }

  // Empty phases (added to builder but no milestones yet)
  if (emptyPhaseIds) {
    for (const phaseId of emptyPhaseIds) {
      if (phaseGroups.has(phaseId)) continue
      const phase = phaseMap.get(phaseId)
      if (!phase || phase.parent_phase_id) continue
      const color = resolveColorKey(phase.color_key)
      result.push({ type: 'phase-header', phase, color, itemCount: 0 })
      result.push({ type: 'drop-zone', phaseId: phase.id, phaseName: phase.display_name, color })
    }
  }

  // Unassigned section
  if (unassigned.length > 0) {
    result.push({ type: 'unassigned-header', count: unassigned.length })
    for (const { item, milestone } of unassigned) {
      result.push({ type: 'unassigned-milestone', milestone, templateItem: item })
    }
  }

  return result
}
