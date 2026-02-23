// lib/utils/buildTemplateRenderList.ts
// Core rendering logic for the milestone template builder.
// Transforms DB data (template items, phases, milestones) into a flat
// array of render items that handles boundary connectors, edge milestones,
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

export interface BoundaryConnectorItem {
  type: 'boundary-connector'
  milestoneName: string
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
  | BoundaryConnectorItem
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
  subPhaseMap?: Record<string, string>,
): RenderItem[] {
  const milestoneMap = new Map(milestones.map(m => [m.id, m]))
  const phaseMap = new Map(phases.map(p => [p.id, p]))

  // Use template-specific sub-phase map to determine parent-child relationships.
  // A phase is a sub-phase in THIS template if subPhaseMap[childId] = parentId.
  const spMap = subPhaseMap ?? {}
  const getParentPhaseId = (phaseId: string): string | null => spMap[phaseId] ?? null

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

  // Top-level phases sorted by display_order (not a sub-phase in this template)
  const topLevel = Array.from(phaseGroups.values())
    .filter(g => !getParentPhaseId(g.phase.id))
    .sort((a, b) => a.phase.display_order - b.phase.display_order)

  // Sub-phases grouped by parent (from items + empty sub-phases)
  const subPhaseGroupMap = new Map<string, PhaseGroup[]>()
  for (const group of phaseGroups.values()) {
    const parentId = getParentPhaseId(group.phase.id)
    if (parentId) {
      const existing = subPhaseGroupMap.get(parentId) || []
      existing.push(group)
      subPhaseGroupMap.set(parentId, existing)
    }
  }

  // Include empty sub-phases (in emptyPhaseIds with a parent in subPhaseMap)
  if (emptyPhaseIds) {
    for (const phaseId of emptyPhaseIds) {
      if (phaseGroups.has(phaseId)) continue
      const phase = phaseMap.get(phaseId)
      if (!phase) continue
      const parentId = getParentPhaseId(phaseId)
      if (!parentId) continue
      const existing = subPhaseGroupMap.get(parentId) || []
      existing.push({ phase, items: [] })
      subPhaseGroupMap.set(parentId, existing)
    }
  }

  const result: RenderItem[] = []

  for (let i = 0; i < topLevel.length; i++) {
    const group = topLevel[i]
    const { phase, items } = group
    const color = resolveColorKey(phase.color_key)

    const nextGroup = i < topLevel.length - 1 ? topLevel[i + 1] : null

    const lastMsId = items.length > 0 ? items[items.length - 1].milestone.id : null
    const nextFirstMsId = nextGroup?.items.length
      ? nextGroup.items[0].milestone.id
      : null

    const sharedWithNext = !!(lastMsId && lastMsId === nextFirstMsId)

    // Phase header
    result.push({ type: 'phase-header', phase, color, itemCount: items.length })

    // Get sub-phases for this phase
    const subPhases = (subPhaseGroupMap.get(phase.id) || [])
      .sort((a: PhaseGroup, b: PhaseGroup) => a.phase.display_order - b.phase.display_order)

    // Render milestones — every milestone renders, including boundary edges
    const renderedSubPhaseIds = new Set<string>()

    for (let j = 0; j < items.length; j++) {
      const { item, milestone } = items[j]
      const isFirst = j === 0
      const isLast = j === items.length - 1

      if (isFirst || isLast) {
        result.push({
          type: 'edge-milestone',
          milestone,
          templateItem: item,
          phase,
          color,
          edge: isFirst ? 'start' : 'end',
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
            milestones: sp.items.map((si: PhaseGroup['items'][number]) => ({ milestone: si.milestone, templateItem: si.item })),
          })
          renderedSubPhaseIds.add(sp.phase.id)
        }
      }
    }

    // Render any sub-phases not yet rendered (empty or with milestones not in parent)
    for (const sp of subPhases) {
      if (!renderedSubPhaseIds.has(sp.phase.id)) {
        result.push({
          type: 'sub-phase',
          phase: sp.phase,
          parentPhase: phase,
          color: resolveColorKey(sp.phase.color_key),
          milestones: sp.items.map(si => ({ milestone: si.milestone, templateItem: si.item })),
        })
      }
    }

    // Drop zone for this phase
    result.push({ type: 'drop-zone', phaseId: phase.id, phaseName: phase.display_name, color })

    // Boundary connector after this phase (when same milestone bridges two phases)
    if (sharedWithNext && lastMsId && nextGroup) {
      const ms = milestoneMap.get(lastMsId)
      if (ms) {
        result.push({
          type: 'boundary-connector',
          milestoneName: ms.display_name,
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
      if (!phase || getParentPhaseId(phaseId)) continue
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
