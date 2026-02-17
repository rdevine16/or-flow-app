// lib/utils/inferPhaseGroup.ts
// Shared utility: infers phase_group from milestone internal name.
// Mirrors the SQL CASE logic in migration 20260215000002.

export type PhaseGroup = 'pre_op' | 'surgical' | 'closing' | 'post_op'

export const PHASE_GROUP_OPTIONS: { value: PhaseGroup; label: string }[] = [
  { value: 'pre_op', label: 'Pre-Op' },
  { value: 'surgical', label: 'Surgical' },
  { value: 'closing', label: 'Closing' },
  { value: 'post_op', label: 'Post-Op' },
]

/** Label lookup for display purposes */
export const PHASE_GROUP_LABELS: Record<PhaseGroup, string> = {
  pre_op: 'Pre-Op',
  surgical: 'Surgical',
  closing: 'Closing',
  post_op: 'Post-Op',
}

const PRE_OP_NAMES = new Set([
  'patient_in',
  'anes_start',
  'anes_end',
  'prep_drape_start',
  'prep_drape_complete',
])

const SURGICAL_NAMES = new Set(['incision'])

const CLOSING_NAMES = new Set(['closing', 'closing_complete', 'surgeon_left'])

const POST_OP_NAMES = new Set(['patient_out'])

/**
 * Infer the phase_group from a milestone's internal name.
 * Returns null for unrecognized names — facility can set manually.
 */
export function inferPhaseGroup(name: string): PhaseGroup | null {
  const normalized = name.toLowerCase().trim()
  if (PRE_OP_NAMES.has(normalized)) return 'pre_op'
  if (SURGICAL_NAMES.has(normalized)) return 'surgical'
  if (CLOSING_NAMES.has(normalized)) return 'closing'
  if (POST_OP_NAMES.has(normalized)) return 'post_op'
  return null
}
