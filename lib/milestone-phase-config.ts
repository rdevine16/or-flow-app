// lib/milestone-phase-config.ts
// Phase display config for milestones settings table.
// Maps DB phase_group values to display names, colors, and ordering.

import type { PhaseGroup } from '@/lib/utils/inferPhaseGroup'

export interface PhaseConfig {
  /** DB value */
  key: PhaseGroup
  /** Human-readable label */
  label: string
  /** Tailwind color classes for the accent bar / section header */
  accentBg: string
  /** Text color for the phase label */
  accentText: string
  /** Lighter background for the header row */
  headerBg: string
  /** Border color for the left accent bar */
  borderColor: string
}

/**
 * Ordered list of phase groups. Determines rendering order in the table.
 * Maps DB phase_group values → phaseColors palette from design-tokens.
 *
 * Color mapping:
 *   pre_op   → blue   (Patient In)
 *   surgical → green  (In Surgery)
 *   closing  → amber  (Closing)
 *   post_op  → purple (Complete/Post-Op)
 */
export const PHASE_ORDER: PhaseConfig[] = [
  {
    key: 'pre_op',
    label: 'Pre-Op',
    accentBg: 'bg-blue-500',
    accentText: 'text-blue-700',
    headerBg: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    key: 'surgical',
    label: 'Surgical',
    accentBg: 'bg-green-500',
    accentText: 'text-green-700',
    headerBg: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  {
    key: 'closing',
    label: 'Closing',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-700',
    headerBg: 'bg-amber-50',
    borderColor: 'border-amber-500',
  },
  {
    key: 'post_op',
    label: 'Post-Op',
    accentBg: 'bg-purple-500',
    accentText: 'text-purple-700',
    headerBg: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
]

/** Quick lookup by phase_group DB value */
export const PHASE_CONFIG_MAP: Record<PhaseGroup, PhaseConfig> = Object.fromEntries(
  PHASE_ORDER.map((p) => [p.key, p])
) as Record<PhaseGroup, PhaseConfig>

/** Config for milestones with no phase_group assigned */
export const UNASSIGNED_PHASE: PhaseConfig = {
  key: 'pre_op', // placeholder — never matched by key
  label: 'Unassigned',
  accentBg: 'bg-slate-400',
  accentText: 'text-slate-600',
  headerBg: 'bg-slate-50',
  borderColor: 'border-slate-400',
}
