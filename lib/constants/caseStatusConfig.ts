// lib/constants/caseStatusConfig.ts
// Status → display configuration for case status badges and tabs.
// Includes compound display states (needs_validation, on_hold) that are
// derived from case data, not stored as separate DB statuses.

import { statusColors } from '@/lib/design-tokens'

export interface CaseStatusDisplayConfig {
  label: string
  /** Key into statusColors from design-tokens.ts */
  colorKey: keyof typeof statusColors
}

/**
 * Maps case_statuses.name values (and compound display states) to display config.
 * Compound states like 'needs_validation' are resolved at the display layer
 * based on case data (e.g., completed + !data_validated → needs_validation).
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
  // Compound display state: completed + !data_validated
  needs_validation: {
    label: 'Needs Validation',
    colorKey: 'needs_validation',
  },
}

/**
 * Resolve the display status for a case.
 * Handles compound states like needs_validation (completed + !data_validated).
 */
export function resolveDisplayStatus(
  statusName: string | null | undefined,
  dataValidated: boolean,
): string {
  const status = statusName?.toLowerCase() ?? 'scheduled'

  // Compound state: completed but not validated
  if (status === 'completed' && !dataValidated) {
    return 'needs_validation'
  }

  return status
}

/**
 * Get display config for a case status (or compound display status).
 * Falls back to scheduled if status is unknown.
 */
export function getCaseStatusConfig(statusKey: string): CaseStatusDisplayConfig {
  return CASE_STATUS_CONFIG[statusKey] ?? CASE_STATUS_CONFIG.scheduled
}
