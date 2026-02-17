// lib/utils/pairIssues.ts
// Detects pair issues in milestone lists: pairs split across phases,
// and END appearing before START in display order.

export interface PairIssueMilestone {
  id: string
  phase_group: string | null
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  pair_group: string | null
}

/**
 * Detect pair issues in a flat, ordered list of milestones.
 *
 * Returns a map of pair_group → issue description string for each pair
 * that has a problem:
 *  - "split across phases" — START and END are in different phase_groups
 *  - "END before START" — END appears before START in display order
 *
 * Milestones with no pair_group are ignored.
 */
export function detectPairIssues(
  milestones: PairIssueMilestone[]
): Record<string, string> {
  const issues: Record<string, string> = {}

  // Build a map of pair_group → { startIdx, endIdx, startPhase, endPhase }
  const groups: Record<
    string,
    {
      startIdx?: number
      endIdx?: number
      startPhase?: string | null
      endPhase?: string | null
    }
  > = {}

  for (let i = 0; i < milestones.length; i++) {
    const ms = milestones[i]
    if (!ms.pair_group || !ms.pair_position) continue

    if (!groups[ms.pair_group]) {
      groups[ms.pair_group] = {}
    }

    if (ms.pair_position === 'start') {
      groups[ms.pair_group].startIdx = i
      groups[ms.pair_group].startPhase = ms.phase_group
    } else if (ms.pair_position === 'end') {
      groups[ms.pair_group].endIdx = i
      groups[ms.pair_group].endPhase = ms.phase_group
    }
  }

  for (const [groupId, group] of Object.entries(groups)) {
    if (group.startIdx === undefined || group.endIdx === undefined) continue

    // Check for split across phases
    if (group.startPhase !== group.endPhase) {
      issues[groupId] = 'split across phases'
      continue
    }

    // Check for END before START in display order
    if (group.endIdx < group.startIdx) {
      issues[groupId] = 'END before START'
    }
  }

  return issues
}

/**
 * Count how many pair issues exist in a specific phase.
 * Filters the full issue map to only pairs where at least one milestone
 * is in the given phase.
 */
export function countPairIssuesInPhase(
  milestones: PairIssueMilestone[],
  issues: Record<string, string>,
  phaseGroup: string
): number {
  const pairGroupsInPhase = new Set<string>()
  for (const ms of milestones) {
    if (ms.pair_group && ms.phase_group === phaseGroup) {
      pairGroupsInPhase.add(ms.pair_group)
    }
  }

  let count = 0
  for (const pg of pairGroupsInPhase) {
    if (issues[pg]) count++
  }
  return count
}
