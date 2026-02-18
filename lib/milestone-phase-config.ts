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
  /** Hex color for SVG rendering and boundary dot gradients */
  hex: string
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
    hex: '#3B82F6',
  },
  {
    key: 'surgical',
    label: 'Surgical',
    accentBg: 'bg-green-500',
    accentText: 'text-green-700',
    headerBg: 'bg-green-50',
    borderColor: 'border-green-500',
    hex: '#22C55E',
  },
  {
    key: 'closing',
    label: 'Closing',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-700',
    headerBg: 'bg-amber-50',
    borderColor: 'border-amber-500',
    hex: '#F59E0B',
  },
  {
    key: 'post_op',
    label: 'Post-Op',
    accentBg: 'bg-purple-500',
    accentText: 'text-purple-700',
    headerBg: 'bg-purple-50',
    borderColor: 'border-purple-500',
    hex: '#8B5CF6',
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
  hex: '#94A3B8',
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
  /** Hex color for SVG rendering and boundary dot gradients */
  hex: string
  /** Lighter hex shade for subphase insets (Tailwind -300 level) */
  lightHex: string
}

export const COLOR_KEY_PALETTE: ColorKeyConfig[] = [
  { key: 'blue',   label: 'Blue',   swatch: 'bg-blue-500',   accentBg: 'bg-blue-500',   accentText: 'text-blue-700',   headerBg: 'bg-blue-50',   borderColor: 'border-blue-500',   hex: '#3B82F6', lightHex: '#93C5FD' },
  { key: 'green',  label: 'Green',  swatch: 'bg-green-500',  accentBg: 'bg-green-500',  accentText: 'text-green-700',  headerBg: 'bg-green-50',  borderColor: 'border-green-500',  hex: '#22C55E', lightHex: '#86EFAC' },
  { key: 'amber',  label: 'Amber',  swatch: 'bg-amber-500',  accentBg: 'bg-amber-500',  accentText: 'text-amber-700',  headerBg: 'bg-amber-50',  borderColor: 'border-amber-500',  hex: '#F59E0B', lightHex: '#FCD34D' },
  { key: 'purple', label: 'Purple', swatch: 'bg-purple-500', accentBg: 'bg-purple-500', accentText: 'text-purple-700', headerBg: 'bg-purple-50', borderColor: 'border-purple-500', hex: '#8B5CF6', lightHex: '#C4B5FD' },
  { key: 'teal',   label: 'Teal',   swatch: 'bg-teal-500',   accentBg: 'bg-teal-500',   accentText: 'text-teal-700',   headerBg: 'bg-teal-50',   borderColor: 'border-teal-500',   hex: '#14B8A6', lightHex: '#5EEAD4' },
  { key: 'indigo', label: 'Indigo', swatch: 'bg-indigo-500', accentBg: 'bg-indigo-500', accentText: 'text-indigo-700', headerBg: 'bg-indigo-50', borderColor: 'border-indigo-500', hex: '#6366F1', lightHex: '#A5B4FC' },
  { key: 'rose',   label: 'Rose',   swatch: 'bg-rose-500',   accentBg: 'bg-rose-500',   accentText: 'text-rose-700',   headerBg: 'bg-rose-50',   borderColor: 'border-rose-500',   hex: '#F43F5E', lightHex: '#FDA4AF' },
  { key: 'slate',  label: 'Slate',  swatch: 'bg-slate-500',  accentBg: 'bg-slate-500',  accentText: 'text-slate-700',  headerBg: 'bg-slate-50',  borderColor: 'border-slate-500',  hex: '#64748B', lightHex: '#CBD5E1' },
]

export const COLOR_KEY_MAP: Record<string, ColorKeyConfig> = Object.fromEntries(
  COLOR_KEY_PALETTE.map((c) => [c.key, c])
)

/** Resolve a DB color_key to full Tailwind config. Falls back to slate. */
export function resolveColorKey(colorKey: string | null): ColorKeyConfig {
  if (!colorKey) return COLOR_KEY_PALETTE[7] // slate
  return COLOR_KEY_MAP[colorKey] ?? COLOR_KEY_PALETTE[7]
}

/** Resolve a color_key to its primary hex color (for parent phases). */
export function resolvePhaseHex(colorKey: string | null): string {
  return resolveColorKey(colorKey).hex
}

/** Resolve a color_key to its lighter hex shade (for subphase insets). */
export function resolveSubphaseHex(colorKey: string | null): string {
  return resolveColorKey(colorKey).lightHex
}

// ─── Phase Tree Types & Builder ──────────────────────────────────

/**
 * Minimal interface for phase definitions used by the tree builder.
 * Satisfied by both DAL PhaseDefinition and page-local PhaseDefinitionRow types.
 */
export interface PhaseDefLike {
  id: string
  name: string
  display_name: string
  display_order: number
  parent_phase_id: string | null
}

export interface PhaseTreeNode<T extends PhaseDefLike = PhaseDefLike> {
  phase: T
  children: PhaseTreeNode<T>[]
}

/**
 * Build a 1-level-deep tree from flat phase definitions.
 * Top-level nodes: phases where parent_phase_id is null.
 * Children: phases where parent_phase_id matches a top-level phase's id.
 * Sorted by display_order at each level.
 */
export function buildPhaseTree<T extends PhaseDefLike>(phases: T[]): PhaseTreeNode<T>[] {
  const topLevel = phases.filter(p => !p.parent_phase_id)
  const childMap = new Map<string, T[]>()

  for (const p of phases) {
    if (p.parent_phase_id) {
      const existing = childMap.get(p.parent_phase_id) || []
      existing.push(p)
      childMap.set(p.parent_phase_id, existing)
    }
  }

  return topLevel
    .sort((a, b) => a.display_order - b.display_order)
    .map(p => ({
      phase: p,
      children: (childMap.get(p.id) || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(child => ({
          phase: child,
          children: [] as PhaseTreeNode<T>[],
        })),
    }))
}

/**
 * Convert a color_key from phase_definitions to a PhaseConfig-compatible object.
 * Used by analytics components that need PhaseConfig-style styling from DB-stored color keys.
 */
export function phaseConfigFromColorKey(
  colorKey: string | null,
  label: string,
  key: PhaseGroup = 'pre_op',
): PhaseConfig {
  const resolved = resolveColorKey(colorKey)
  return {
    key,
    label,
    accentBg: resolved.accentBg,
    accentText: resolved.accentText,
    headerBg: resolved.headerBg,
    borderColor: resolved.borderColor,
    hex: resolved.hex,
  }
}
