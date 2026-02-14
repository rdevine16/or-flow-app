// lib/constants/procedureIcons.ts
// Maps procedure_categories.name → Lucide icon component name.
// Used by ProcedureIcon component to render category-specific icons in the cases table.

import {
  Bone,
  Hand,
  Eye,
  Heart,
  Ear,
  Scissors,
  Cross,
  type LucideIcon,
} from 'lucide-react'

/**
 * Maps procedure category names (from procedure_categories table) to Lucide icons.
 * Keys are lowercase for case-insensitive matching.
 */
export const PROCEDURE_ICON_MAP: Record<string, LucideIcon> = {
  // Orthopedic / Joint
  orthopedic: Bone,
  orthopaedic: Bone,
  joint: Bone,
  'joint replacement': Bone,

  // Spine
  spine: Bone,
  spinal: Bone,

  // Hand / Wrist
  hand: Hand,
  'hand/wrist': Hand,
  wrist: Hand,
  'upper extremity': Hand,

  // Ophthalmology
  ophthalmology: Eye,
  eye: Eye,
  ophthalmic: Eye,

  // Cardiac
  cardiac: Heart,
  cardiovascular: Heart,
  heart: Heart,

  // ENT
  ent: Ear,
  'ear, nose & throat': Ear,
  otolaryngology: Ear,

  // General
  general: Scissors,
  'general surgery': Scissors,
}

/** Default fallback icon when no category match is found */
export const PROCEDURE_ICON_FALLBACK: LucideIcon = Cross

/**
 * Get the Lucide icon component for a procedure category name.
 * Case-insensitive lookup with fallback to generic icon.
 */
export function getProcedureIcon(categoryName: string | null | undefined): LucideIcon {
  if (!categoryName) return PROCEDURE_ICON_FALLBACK
  return PROCEDURE_ICON_MAP[categoryName.toLowerCase()] ?? PROCEDURE_ICON_FALLBACK
}
