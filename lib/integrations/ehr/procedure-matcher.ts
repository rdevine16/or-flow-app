/**
 * Procedure Matcher
 *
 * Matches HL7v2 procedure references (CPT codes + descriptions) to ORbit procedure_types.
 * Strategy: entity mapping (CPT) → entity mapping (name) → fuzzy name match.
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { ehrDAL } from '@/lib/dal/ehr'
import { lookupsDAL } from '@/lib/dal/lookups'
import { similarityScore } from '@/lib/epic/auto-matcher'
import { logger } from '@/lib/logger'
import type { EntitySuggestion } from '@/lib/integrations/shared/integration-types'

const log = logger('procedure-matcher')

const AUTO_MAP_THRESHOLD = 0.90
const SUGGEST_THRESHOLD = 0.70

export interface ProcedureMatchResult {
  matched: boolean
  orbitProcedureId: string | null
  orbitDisplayName: string | null
  confidence: number | null
  matchSource: 'mapping' | 'fuzzy' | 'none'
  suggestions: EntitySuggestion[]
}

/**
 * Match an HL7v2 procedure reference to an ORbit procedure type.
 *
 * @param supabase - Supabase client
 * @param integrationId - ehr_integrations.id
 * @param facilityId - Facility ID for scoping
 * @param cptCode - CPT code from AIS-3.1 (e.g., "27447")
 * @param procedureName - Procedure description from AIS-3.2 (e.g., "Total knee arthroplasty")
 */
export async function matchProcedure(
  supabase: AnySupabaseClient,
  integrationId: string,
  facilityId: string,
  cptCode: string,
  procedureName: string,
): Promise<ProcedureMatchResult> {
  // Use CPT code as primary identifier if available, otherwise use name
  const primaryIdentifier = cptCode || procedureName

  if (!primaryIdentifier) {
    return { matched: false, orbitProcedureId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 1. Check entity mappings — try CPT first, then name
  const identifiersToCheck = [cptCode, procedureName].filter(Boolean)
  for (const identifier of identifiersToCheck) {
    const { data: mapping } = await ehrDAL.getEntityMapping(
      supabase,
      integrationId,
      'procedure',
      identifier,
    )

    if (mapping?.orbit_entity_id) {
      log.debug('Procedure matched via entity mapping', { identifier, orbitId: mapping.orbit_entity_id })
      return {
        matched: true,
        orbitProcedureId: mapping.orbit_entity_id,
        orbitDisplayName: mapping.orbit_display_name,
        confidence: 1.0,
        matchSource: 'mapping',
        suggestions: [],
      }
    }
  }

  // 2. Get all procedure types for this facility
  const { data: procedures } = await lookupsDAL.procedureTypes(supabase, facilityId)
  if (!procedures || procedures.length === 0) {
    log.debug('No procedure types found for facility', { facilityId })
    return { matched: false, orbitProcedureId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 3. Fuzzy match by name
  let bestMatch: { id: string; name: string } | null = null
  let bestScore = 0

  for (const proc of procedures) {
    const score = similarityScore(procedureName, proc.name)
    if (score > bestScore) {
      bestScore = score
      bestMatch = proc
    }
  }

  // Build suggestions from procedures above threshold
  const suggestions: EntitySuggestion[] = []
  for (const proc of procedures) {
    const score = similarityScore(procedureName, proc.name)
    if (score >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: proc.id,
        orbit_display_name: proc.name,
        confidence: Math.round(score * 100) / 100,
        match_reason: `Name similarity: "${procedureName}" → "${proc.name}"`,
      })
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence)

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    log.debug('Procedure matched via fuzzy (auto-map)', { procedureName, orbitName: bestMatch.name, score: bestScore })
    return {
      matched: true,
      orbitProcedureId: bestMatch.id,
      orbitDisplayName: bestMatch.name,
      confidence: Math.round(bestScore * 100) / 100,
      matchSource: 'fuzzy',
      suggestions,
    }
  }

  log.debug('Procedure unmatched', { cptCode, procedureName, bestScore })
  return {
    matched: false,
    orbitProcedureId: null,
    orbitDisplayName: null,
    confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null,
    matchSource: 'none',
    suggestions,
  }
}
