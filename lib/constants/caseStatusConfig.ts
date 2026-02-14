// lib/constants/caseStatusConfig.ts
// Status → display configuration for case status badges and tabs.
// Maps DB status names to display labels and color keys.

import { statusColors } from '@/lib/design-tokens'

export interface CaseStatusDisplayConfig {
  label: string
  /** Key into statusColors from design-tokens.ts */
  colorKey: keyof typeof statusColors
}

/**
 * Maps case_statuses.name values to display config.
 * Status column now shows pure DB status — DQ validation state
 * is displayed separately in the Validation column.
 */
export const CASE_STATUS_CONFIG: Record<string, CaseStatusDisplayConfig> = {
  scheduled: {
    label: 'Scheduled',
    colorKey: 'scheduled',
  },
  in_progress: {
    label: 'In Progress',
    colorKey: 'in_progress',
  },
  completed: {
    label: 'Completed',
    colorKey: 'completed',
  },
  cancelled: {
    label: 'Cancelled',
    colorKey: 'cancelled',
  },
  on_hold: {
    label: 'On Hold',
    colorKey: 'inactive',
  },
}

/**
 * Resolve the display status for a case.
 * Returns the lowercased DB status name, defaulting to 'scheduled'.
 */
export function resolveDisplayStatus(
  statusName: string | null | undefined,
): string {
  return statusName?.toLowerCase() ?? 'scheduled'
}

/**
 * Get display config for a case status (or compound display status).
 * Falls back to scheduled if status is unknown.
 */
export function getCaseStatusConfig(statusKey: string): CaseStatusDisplayConfig {
  return CASE_STATUS_CONFIG[statusKey] ?? CASE_STATUS_CONFIG.scheduled
}
