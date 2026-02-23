// lib/utils/pairOrderValidation.ts
// Detects pair order issues in the template builder render list.
// Returns a Set of template item IDs where a START milestone appears
// after its linked END milestone in the visual tree.

import type { RenderItem, MilestoneLookup } from './buildTemplateRenderList'

interface MilestonePosition {
  templateItemId: string
  visualIndex: number
}

/**
 * Walk the render list in visual order, detect pairs where START appears
 * after END. Returns a Set of template item IDs that have order issues.
 *
 * Handles: same phase, different phases, sub-phases, shared boundaries
 * (milestone appearing multiple times), and missing partners.
 */
export function detectPairOrderIssues(
  renderList: RenderItem[],
  milestones: MilestoneLookup[],
): Set<string> {
  const milestoneMap = new Map(milestones.map(m => [m.id, m]))
  const issueItemIds = new Set<string>()

  // Step 1: Walk render list, collect visual positions for every milestone instance
  const positionsByMilestone = new Map<string, MilestonePosition[]>()
  let visualIndex = 0

  function trackPosition(milestoneId: string, templateItemId: string) {
    let positions = positionsByMilestone.get(milestoneId)
    if (!positions) {
      positions = []
      positionsByMilestone.set(milestoneId, positions)
    }
    positions.push({ templateItemId, visualIndex })
    visualIndex++
  }

  for (const item of renderList) {
    if (item.type === 'edge-milestone' || item.type === 'interior-milestone') {
      trackPosition(item.milestone.id, item.templateItem.id)
    } else if (item.type === 'sub-phase') {
      for (const { milestone, templateItem } of item.milestones) {
        trackPosition(milestone.id, templateItem.id)
      }
    } else if (item.type === 'unassigned-milestone') {
      trackPosition(item.milestone.id, item.templateItem.id)
    }
  }

  // Step 2: For each START milestone, check if any instance appears after any END instance
  for (const [msId, positions] of positionsByMilestone) {
    const ms = milestoneMap.get(msId)
    if (!ms?.pair_with_id || ms.pair_position !== 'start') continue

    const partnerPositions = positionsByMilestone.get(ms.pair_with_id)
    if (!partnerPositions) continue

    const partner = milestoneMap.get(ms.pair_with_id)
    if (!partner || partner.pair_position !== 'end') continue

    // Check every START instance against every END instance
    for (const startPos of positions) {
      for (const endPos of partnerPositions) {
        if (startPos.visualIndex > endPos.visualIndex) {
          // START after END — flag both
          issueItemIds.add(startPos.templateItemId)
          issueItemIds.add(endPos.templateItemId)
        }
      }
    }
  }

  return issueItemIds
}
