// lib/template-defaults.ts
// Constants and helpers defining the required minimum milestones and phases for new templates.
// Existing templates that don't contain all required items are grandfathered (no enforcement).

/** The 4 phases every new template must include. */
export const REQUIRED_PHASE_NAMES = ['pre_op', 'surgical', 'closing', 'post_op'] as const

/** The 7 unique milestones every new template must include (8 placements, 2 shared boundaries). */
export const REQUIRED_MILESTONE_NAMES = [
  'patient_in',
  'prep_drape_start',
  'prep_drape_complete',
  'incision',
  'closing',
  'closing_complete',
  'patient_out',
] as const

/**
 * Map of phase name → ordered milestone names that belong in that phase.
 * Shared boundaries (closing, closing_complete) appear in multiple phases.
 */
export const REQUIRED_PHASE_MILESTONES: Record<string, readonly string[]> = {
  pre_op: ['patient_in', 'prep_drape_start', 'prep_drape_complete'],
  surgical: ['incision', 'closing'],
  closing: ['closing', 'closing_complete'],
  post_op: ['closing_complete', 'patient_out'],
}

export function isRequiredMilestone(milestoneName: string): boolean {
  return (REQUIRED_MILESTONE_NAMES as readonly string[]).includes(milestoneName)
}

export function isRequiredPhase(phaseName: string): boolean {
  return (REQUIRED_PHASE_NAMES as readonly string[]).includes(phaseName)
}

/** Returns which required phases use this milestone (empty array if not required). */
export function getRequiredPhasesForMilestone(milestoneName: string): string[] {
  return Object.entries(REQUIRED_PHASE_MILESTONES)
    .filter(([, milestones]) => milestones.includes(milestoneName))
    .map(([phase]) => phase)
}
