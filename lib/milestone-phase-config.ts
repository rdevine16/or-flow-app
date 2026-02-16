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

/**
 * Color key palette for phase definitions.
 * DB stores a color_key string (e.g. 'blue'), this resolves to full Tailwind classes.
 */
export interface ColorKeyConfig {
  key: string
  label: string
  swatch: string       // bg-color for swatch preview
  accentBg: string
  accentText: string
  headerBg: string
  borderColor: string
}

export const COLOR_KEY_PALETTE: ColorKeyConfig[] = [
  { key: 'blue',   label: 'Blue',   swatch: 'bg-blue-500',   accentBg: 'bg-blue-500',   accentText: 'text-blue-700',   headerBg: 'bg-blue-50',   borderColor: 'border-blue-500' },
  { key: 'green',  label: 'Green',  swatch: 'bg-green-500',  accentBg: 'bg-green-500',  accentText: 'text-green-700',  headerBg: 'bg-green-50',  borderColor: 'border-green-500' },
  { key: 'amber',  label: 'Amber',  swatch: 'bg-amber-500',  accentBg: 'bg-amber-500',  accentText: 'text-amber-700',  headerBg: 'bg-amber-50',  borderColor: 'border-amber-500' },
  { key: 'purple', label: 'Purple', swatch: 'bg-purple-500', accentBg: 'bg-purple-500', accentText: 'text-purple-700', headerBg: 'bg-purple-50', borderColor: 'border-purple-500' },
  { key: 'teal',   label: 'Teal',   swatch: 'bg-teal-500',   accentBg: 'bg-teal-500',   accentText: 'text-teal-700',   headerBg: 'bg-teal-50',   borderColor: 'border-teal-500' },
  { key: 'indigo', label: 'Indigo', swatch: 'bg-indigo-500', accentBg: 'bg-indigo-500', accentText: 'text-indigo-700', headerBg: 'bg-indigo-50', borderColor: 'border-indigo-500' },
  { key: 'rose',   label: 'Rose',   swatch: 'bg-rose-500',   accentBg: 'bg-rose-500',   accentText: 'text-rose-700',   headerBg: 'bg-rose-50',   borderColor: 'border-rose-500' },
  { key: 'slate',  label: 'Slate',  swatch: 'bg-slate-500',  accentBg: 'bg-slate-500',  accentText: 'text-slate-700',  headerBg: 'bg-slate-50',  borderColor: 'border-slate-500' },
]

export const COLOR_KEY_MAP: Record<string, ColorKeyConfig> = Object.fromEntries(
  COLOR_KEY_PALETTE.map((c) => [c.key, c])
)

/** Resolve a DB color_key to full Tailwind config. Falls back to slate. */
export function resolveColorKey(colorKey: string | null): ColorKeyConfig {
  if (!colorKey) return COLOR_KEY_PALETTE[7] // slate
  return COLOR_KEY_MAP[colorKey] ?? COLOR_KEY_PALETTE[7]
}
