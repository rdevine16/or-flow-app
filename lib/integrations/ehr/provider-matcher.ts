/**
 * Provider (Surgeon) Matcher
 *
 * Matches HL7v2 provider references to ORbit users with surgeon role.
 * Strategy: entity mapping (NPI) → entity mapping (name) → fuzzy name match.
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { ehrDAL } from '@/lib/dal/ehr'
import { usersDAL } from '@/lib/dal/users'
import { similarityScore } from '@/lib/epic/auto-matcher'
import { logger } from '@/lib/logger'
import type { EntitySuggestion } from '@/lib/integrations/shared/integration-types'

const log = logger('provider-matcher')

const AUTO_MAP_THRESHOLD = 0.90
const SUGGEST_THRESHOLD = 0.70

export interface ProviderMatchResult {
  matched: boolean
  orbitSurgeonId: string | null
  orbitDisplayName: string | null
  confidence: number | null
  matchSource: 'mapping' | 'fuzzy' | 'none'
  suggestions: EntitySuggestion[]
}

/**
 * Build a display name from provider components.
 * Handles "SMITH^JOHN^A^MD" → "SMITH, JOHN A"
 */
function buildProviderDisplayName(lastName: string, firstName: string, middleName?: string): string {
  const parts = [lastName, firstName].filter(Boolean)
  if (middleName) parts.push(middleName)
  return parts.length >= 2 ? `${parts[0]}, ${parts.slice(1).join(' ')}` : parts[0] || ''
}

/**
 * Match an HL7v2 provider reference to an ORbit surgeon.
 *
 * @param supabase - Supabase client
 * @param integrationId - ehr_integrations.id
 * @param facilityId - Facility ID for scoping
 * @param npi - NPI from AIP-3.9/10 or PV1-7
 * @param lastName - Provider last name
 * @param firstName - Provider first name
 * @param middleName - Provider middle name (optional)
 */
export async function matchSurgeon(
  supabase: AnySupabaseClient,
  integrationId: string,
  facilityId: string,
  npi: string,
  lastName: string,
  firstName: string,
  middleName?: string,
): Promise<ProviderMatchResult> {
  const displayName = buildProviderDisplayName(lastName, firstName, middleName)

  // Use NPI as primary identifier if available, otherwise use display name
  const primaryIdentifier = npi || displayName

  if (!primaryIdentifier) {
    return { matched: false, orbitSurgeonId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 1. Check entity mappings — try NPI first, then display name
  const identifiersToCheck = [npi, displayName].filter(Boolean)
  for (const identifier of identifiersToCheck) {
    const { data: mapping } = await ehrDAL.getEntityMapping(
      supabase,
      integrationId,
      'surgeon',
      identifier,
    )

    if (mapping?.orbit_entity_id) {
      log.debug('Surgeon matched via entity mapping', { identifier, orbitId: mapping.orbit_entity_id })
      return {
        matched: true,
        orbitSurgeonId: mapping.orbit_entity_id,
        orbitDisplayName: mapping.orbit_display_name,
        confidence: 1.0,
        matchSource: 'mapping',
        suggestions: [],
      }
    }
  }

  // 2. Get all surgeons for this facility
  const { data: surgeons } = await usersDAL.listSurgeons(supabase, facilityId)
  if (!surgeons || surgeons.length === 0) {
    log.debug('No surgeons found for facility', { facilityId })
    return { matched: false, orbitSurgeonId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 3. Fuzzy match by name
  let bestMatch: { id: string; first_name: string; last_name: string } | null = null
  let bestScore = 0

  for (const surgeon of surgeons) {
    // Compare "LAST, FIRST" format
    const orbitName = `${surgeon.last_name}, ${surgeon.first_name}`
    const score = similarityScore(displayName, orbitName)
    if (score > bestScore) {
      bestScore = score
      bestMatch = surgeon
    }

    // Also try "FIRST LAST" format
    const orbitNameAlt = `${surgeon.first_name} ${surgeon.last_name}`
    const inputNameAlt = `${firstName} ${lastName}`
    const scoreAlt = similarityScore(inputNameAlt, orbitNameAlt)
    if (scoreAlt > bestScore) {
      bestScore = scoreAlt
      bestMatch = surgeon
    }
  }

  // Build suggestions from surgeons above threshold
  const suggestions: EntitySuggestion[] = []
  for (const surgeon of surgeons) {
    const orbitName = `${surgeon.last_name}, ${surgeon.first_name}`
    const score1 = similarityScore(displayName, orbitName)
    const score2 = similarityScore(`${firstName} ${lastName}`, `${surgeon.first_name} ${surgeon.last_name}`)
    const maxScore = Math.max(score1, score2)

    if (maxScore >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: surgeon.id,
        orbit_display_name: orbitName,
        confidence: Math.round(maxScore * 100) / 100,
        match_reason: `Name similarity: "${displayName}" → "${orbitName}"`,
      })
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence)

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    const orbitName = `${bestMatch.last_name}, ${bestMatch.first_name}`
    log.debug('Surgeon matched via fuzzy (auto-map)', { displayName, orbitName, score: bestScore })
    return {
      matched: true,
      orbitSurgeonId: bestMatch.id,
      orbitDisplayName: orbitName,
      confidence: Math.round(bestScore * 100) / 100,
      matchSource: 'fuzzy',
      suggestions,
    }
  }

  log.debug('Surgeon unmatched', { displayName, npi, bestScore })
  return {
    matched: false,
    orbitSurgeonId: null,
    orbitDisplayName: null,
    confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null,
    matchSource: 'none',
    suggestions,
  }
}
