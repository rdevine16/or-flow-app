// lib/template-defaults.ts
// Constants and helpers defining the required minimum milestones and phases for new templates.
// Existing templates that don't contain all required items are grandfathered (no enforcement).
// Tier-aware variants allow Essential tier to require only patient_in/patient_out.

import type { TierSlug } from './tier-config'

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

// ============================================
// Tier-aware variants
// ============================================

/**
 * Essential tier only requires patient_in + patient_out.
 * Professional and Enterprise require the full 7 milestones.
 */
export function getRequiredMilestonesForTier(tier: TierSlug): readonly string[] {
  if (tier === 'essential') {
    return ['patient_in', 'patient_out']
  }
  return REQUIRED_MILESTONE_NAMES
}

/**
 * Essential tier only requires pre_op + post_op phases.
 * Professional and Enterprise require all 4 phases.
 */
export function getRequiredPhasesForTier(tier: TierSlug): readonly string[] {
  if (tier === 'essential') {
    return ['pre_op', 'post_op']
  }
  return REQUIRED_PHASE_NAMES
}

/**
 * Phase → milestone mapping scoped to a tier.
 * Essential: pre_op has patient_in, post_op has patient_out.
 * Professional/Enterprise: full mapping.
 */
export function getRequiredPhaseMilestonesForTier(tier: TierSlug): Record<string, readonly string[]> {
  if (tier === 'essential') {
    return {
      pre_op: ['patient_in'],
      post_op: ['patient_out'],
    }
  }
  return REQUIRED_PHASE_MILESTONES
}

export function isRequiredMilestoneForTier(milestoneName: string, tier: TierSlug): boolean {
  return getRequiredMilestonesForTier(tier).includes(milestoneName)
}

export function isRequiredPhaseForTier(phaseName: string, tier: TierSlug): boolean {
  return (getRequiredPhasesForTier(tier) as readonly string[]).includes(phaseName)
}
