/**
 * Out-of-order milestone detection.
 * Pure functions for checking if a milestone is being recorded before its predecessors.
 */

export interface MilestoneTypeForOrder {
  id: string
  display_name: string
  display_order: number
}

export interface RecordedMilestoneForOrder {
  facility_milestone_id: string
  recorded_at: string | null
}

export interface OrderCheckResult {
  isOutOfOrder: boolean
  skippedCount: number
}

/**
 * Checks if recording a milestone would skip earlier milestones in the sequence.
 * Compares `display_order` of the target milestone against all milestones with
 * lower `display_order` that haven't been recorded yet.
 *
 * Returns { isOutOfOrder: true, skippedCount: N } if N predecessors are unrecorded.
 * Returns { isOutOfOrder: false, skippedCount: 0 } if all predecessors are recorded,
 * or if the target milestone is not found.
 */
export function checkMilestoneOrder(
  milestoneTypeId: string,
  milestoneTypes: MilestoneTypeForOrder[],
  caseMilestones: RecordedMilestoneForOrder[],
): OrderCheckResult {
  const targetMilestone = milestoneTypes.find(mt => mt.id === milestoneTypeId)
  if (!targetMilestone) {
    return { isOutOfOrder: false, skippedCount: 0 }
  }

  // Find all milestones that should come before this one (lower display_order)
  const predecessors = milestoneTypes.filter(
    mt => mt.display_order < targetMilestone.display_order
  )

  // Count how many predecessors are unrecorded (no matching milestone or recorded_at is null)
  const skippedCount = predecessors.filter(pred => {
    const recorded = caseMilestones.find(cm => cm.facility_milestone_id === pred.id)
    return !recorded || recorded.recorded_at === null
  }).length

  return {
    isOutOfOrder: skippedCount > 0,
    skippedCount,
  }
}
