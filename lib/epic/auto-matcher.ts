/**
 * Epic Auto-Matcher
 *
 * Fuzzy name matching for surgeons, rooms, and procedures.
 * Uses Levenshtein distance (no external deps) normalized to 0-1 score.
 * - >= 0.90 confidence: auto-apply
 * - 0.70-0.89 confidence: suggest for manual review
 * - < 0.70: skip
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { epicDAL } from '@/lib/dal/epic'
import { logger } from '@/lib/logger'
import type { EpicMappingType } from './types'

const log = logger('epic-auto-matcher')

// =====================================================
// THRESHOLDS
// =====================================================

const AUTO_APPLY_THRESHOLD = 0.90
const SUGGEST_THRESHOLD = 0.70

// =====================================================
// LEVENSHTEIN DISTANCE
// =====================================================

/**
 * Compute the Levenshtein edit distance between two strings.
 * Returns the number of single-character edits (insert, delete, substitute).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // Optimize: if either string is empty, distance is the other's length
  if (m === 0) return n
  if (n === 0) return m

  // Use single-row optimization (O(min(m,n)) space)
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) {
    prev[j] = j
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      )
    }
    // Swap rows
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j]
    }
  }

  return prev[n]
}

/**
 * Compute normalized similarity score (0-1) between two strings.
 * 1.0 = exact match, 0.0 = completely different.
 * Case-insensitive and trims whitespace.
 */
export function similarityScore(a: string, b: string): number {
  const normA = a.trim().toLowerCase()
  const normB = b.trim().toLowerCase()

  if (normA === normB) return 1.0
  if (normA.length === 0 || normB.length === 0) return 0.0

  const distance = levenshteinDistance(normA, normB)
  const maxLen = Math.max(normA.length, normB.length)

  return 1 - distance / maxLen
}

// =====================================================
// TYPES
// =====================================================

export interface AutoMatchResult {
  epicResourceId: string
  epicDisplayName: string
  orbitEntityId: string
  orbitEntityName: string
  confidence: number
  action: 'auto_applied' | 'suggested' | 'skipped'
}

export interface AutoMatchSummary {
  mappingType: EpicMappingType
  autoApplied: number
  suggested: number
  skipped: number
  results: AutoMatchResult[]
}

interface OrbitEntity {
  id: string
  name: string
}

// =====================================================
// MATCHING LOGIC
// =====================================================

/**
 * Find the best matching ORbit entity for an Epic entity name.
 * Returns the match with highest confidence above the suggestion threshold.
 */
function findBestMatch(
  epicName: string,
  orbitEntities: OrbitEntity[]
): { entity: OrbitEntity; confidence: number } | null {
  let bestMatch: OrbitEntity | null = null
  let bestScore = 0

  for (const entity of orbitEntities) {
    const score = similarityScore(epicName, entity.name)
    if (score > bestScore) {
      bestScore = score
      bestMatch = entity
    }
  }

  if (!bestMatch || bestScore < SUGGEST_THRESHOLD) {
    return null
  }

  return { entity: bestMatch, confidence: bestScore }
}

/**
 * Run auto-matching for a specific mapping type.
 * Compares unmapped Epic entities against ORbit entities by name similarity.
 */
async function autoMatchEntities(
  supabase: SupabaseClient,
  connectionId: string,
  facilityId: string,
  mappingType: EpicMappingType,
  orbitEntities: OrbitEntity[]
): Promise<AutoMatchSummary> {
  const summary: AutoMatchSummary = {
    mappingType,
    autoApplied: 0,
    suggested: 0,
    skipped: 0,
    results: [],
  }

  // Get existing mappings for this type
  const { data: mappings, error } = await epicDAL.listEntityMappings(
    supabase,
    connectionId,
    mappingType
  )

  if (error) {
    log.error('Failed to list entity mappings for auto-match', { connectionId, mappingType, error: error.message })
    return summary
  }

  // Only process unmapped entities
  const unmapped = mappings.filter(m => !m.orbit_entity_id)

  // Track which ORbit entities have already been matched (avoid double-mapping)
  const alreadyMappedOrbitIds = new Set(
    mappings.filter(m => m.orbit_entity_id).map(m => m.orbit_entity_id as string)
  )

  for (const mapping of unmapped) {
    const epicName = mapping.epic_display_name || ''
    if (!epicName) {
      summary.skipped++
      summary.results.push({
        epicResourceId: mapping.epic_resource_id,
        epicDisplayName: epicName,
        orbitEntityId: '',
        orbitEntityName: '',
        confidence: 0,
        action: 'skipped',
      })
      continue
    }

    // Only match against ORbit entities not already mapped
    const availableEntities = orbitEntities.filter(e => !alreadyMappedOrbitIds.has(e.id))
    const match = findBestMatch(epicName, availableEntities)

    if (!match) {
      summary.skipped++
      summary.results.push({
        epicResourceId: mapping.epic_resource_id,
        epicDisplayName: epicName,
        orbitEntityId: '',
        orbitEntityName: '',
        confidence: 0,
        action: 'skipped',
      })
      continue
    }

    const action: AutoMatchResult['action'] =
      match.confidence >= AUTO_APPLY_THRESHOLD ? 'auto_applied' : 'suggested'

    if (action === 'auto_applied') {
      // Auto-apply: update the mapping directly
      await epicDAL.upsertEntityMapping(supabase, {
        facility_id: facilityId,
        connection_id: connectionId,
        mapping_type: mappingType,
        epic_resource_type: mapping.epic_resource_type,
        epic_resource_id: mapping.epic_resource_id,
        epic_display_name: mapping.epic_display_name || undefined,
        orbit_entity_id: match.entity.id,
        match_method: 'auto',
        match_confidence: Math.round(match.confidence * 100) / 100,
      })
      alreadyMappedOrbitIds.add(match.entity.id)
      summary.autoApplied++
    } else {
      summary.suggested++
    }

    summary.results.push({
      epicResourceId: mapping.epic_resource_id,
      epicDisplayName: epicName,
      orbitEntityId: match.entity.id,
      orbitEntityName: match.entity.name,
      confidence: Math.round(match.confidence * 100) / 100,
      action,
    })
  }

  log.info('Auto-match completed', {
    connectionId,
    mappingType,
    autoApplied: summary.autoApplied,
    suggested: summary.suggested,
    skipped: summary.skipped,
  })

  return summary
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Auto-match Epic practitioners to ORbit surgeons by name.
 */
export async function autoMatchSurgeons(
  supabase: SupabaseClient,
  connectionId: string,
  facilityId: string,
  surgeons: Array<{ id: string; first_name: string; last_name: string }>
): Promise<AutoMatchSummary> {
  const orbitEntities: OrbitEntity[] = surgeons.map(s => ({
    id: s.id,
    name: `${s.last_name}, ${s.first_name}`,
  }))

  return autoMatchEntities(supabase, connectionId, facilityId, 'surgeon', orbitEntities)
}

/**
 * Auto-match Epic locations to ORbit rooms by name.
 */
export async function autoMatchRooms(
  supabase: SupabaseClient,
  connectionId: string,
  facilityId: string,
  rooms: Array<{ id: string; name: string }>
): Promise<AutoMatchSummary> {
  const orbitEntities: OrbitEntity[] = rooms.map(r => ({
    id: r.id,
    name: r.name,
  }))

  return autoMatchEntities(supabase, connectionId, facilityId, 'room', orbitEntities)
}

/**
 * Auto-match Epic service types to ORbit procedure types by name.
 */
export async function autoMatchProcedures(
  supabase: SupabaseClient,
  connectionId: string,
  facilityId: string,
  procedures: Array<{ id: string; name: string }>
): Promise<AutoMatchSummary> {
  const orbitEntities: OrbitEntity[] = procedures.map(p => ({
    id: p.id,
    name: p.name,
  }))

  return autoMatchEntities(supabase, connectionId, facilityId, 'procedure', orbitEntities)
}
