/**
 * OR Room Matcher
 *
 * Matches HL7v2 room references to ORbit or_rooms.
 * Strategy: entity mapping → normalized exact → fuzzy name match.
 * Normalization handles "OR3" = "OR 3" = "Operating Room 3" equivalence.
 */

import type { AnySupabaseClient } from '@/lib/dal'
import { ehrDAL } from '@/lib/dal/ehr'
import { facilitiesDAL } from '@/lib/dal/facilities'
import { similarityScore } from '@/lib/epic/auto-matcher'
import { logger } from '@/lib/logger'
import type { EntitySuggestion } from '@/lib/integrations/shared/integration-types'

const log = logger('room-matcher')

const AUTO_MAP_THRESHOLD = 0.90
const SUGGEST_THRESHOLD = 0.70

export interface RoomMatchResult {
  matched: boolean
  orbitRoomId: string | null
  orbitDisplayName: string | null
  confidence: number | null
  matchSource: 'mapping' | 'exact' | 'fuzzy' | 'none'
  suggestions: EntitySuggestion[]
}

/**
 * Normalize a room name for comparison.
 * "OR3" → "or 3", "Operating Room 3" → "or 3", "OR 3" → "or 3"
 */
export function normalizeRoomName(name: string): string {
  let n = name.trim().toLowerCase()

  // "operating room" → "or"
  n = n.replace(/operating\s+room/gi, 'or')

  // Ensure space between letters and digits: "or3" → "or 3"
  n = n.replace(/([a-z])(\d)/g, '$1 $2')

  // Collapse multiple spaces
  n = n.replace(/\s+/g, ' ')

  return n.trim()
}

/**
 * Match an HL7v2 room reference to an ORbit OR room.
 *
 * @param supabase - Supabase client (server or service role)
 * @param integrationId - The ehr_integrations.id for this facility
 * @param facilityId - Facility ID for scoping
 * @param roomCode - Room code from AIL-3.1 (e.g., "OR3")
 * @param roomDescription - Room description from AIL-3.2 (e.g., "Operating Room 3")
 */
export async function matchRoom(
  supabase: AnySupabaseClient,
  integrationId: string,
  facilityId: string,
  roomCode: string,
  roomDescription: string,
): Promise<RoomMatchResult> {
  const externalIdentifier = roomCode || roomDescription

  if (!externalIdentifier) {
    return { matched: false, orbitRoomId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 1. Check entity mappings first
  const { data: mapping } = await ehrDAL.getEntityMapping(
    supabase,
    integrationId,
    'room',
    externalIdentifier,
  )

  if (mapping?.orbit_entity_id) {
    log.debug('Room matched via entity mapping', { roomCode, orbitRoomId: mapping.orbit_entity_id })
    return {
      matched: true,
      orbitRoomId: mapping.orbit_entity_id,
      orbitDisplayName: mapping.orbit_display_name,
      confidence: 1.0,
      matchSource: 'mapping',
      suggestions: [],
    }
  }

  // 2. Get all rooms for this facility
  const { data: rooms } = await facilitiesDAL.getRooms(supabase, facilityId)
  if (!rooms || rooms.length === 0) {
    log.debug('No rooms found for facility', { facilityId })
    return { matched: false, orbitRoomId: null, orbitDisplayName: null, confidence: null, matchSource: 'none', suggestions: [] }
  }

  // 3. Try normalized exact match
  const normalizedInput = normalizeRoomName(roomDescription || roomCode)
  for (const room of rooms) {
    if (normalizeRoomName(room.name) === normalizedInput) {
      log.debug('Room matched via normalized exact', { roomCode, orbitRoom: room.name })
      return {
        matched: true,
        orbitRoomId: room.id,
        orbitDisplayName: room.name,
        confidence: 1.0,
        matchSource: 'exact',
        suggestions: [],
      }
    }
  }

  // 4. Fuzzy match using both code and description
  const candidates = [roomCode, roomDescription].filter(Boolean)
  let bestMatch: { id: string; name: string } | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    for (const room of rooms) {
      // Compare normalized names
      const score = similarityScore(normalizeRoomName(candidate), normalizeRoomName(room.name))
      if (score > bestScore) {
        bestScore = score
        bestMatch = room
      }
    }
  }

  // Build suggestions from rooms above suggestion threshold
  const suggestions: EntitySuggestion[] = []
  for (const room of rooms) {
    const maxScore = Math.max(
      ...candidates.map(c => similarityScore(normalizeRoomName(c), normalizeRoomName(room.name))),
    )
    if (maxScore >= SUGGEST_THRESHOLD) {
      suggestions.push({
        orbit_entity_id: room.id,
        orbit_display_name: room.name,
        confidence: Math.round(maxScore * 100) / 100,
        match_reason: `Fuzzy match: "${roomDescription || roomCode}" → "${room.name}"`,
      })
    }
  }
  suggestions.sort((a, b) => b.confidence - a.confidence)

  if (bestMatch && bestScore >= AUTO_MAP_THRESHOLD) {
    log.debug('Room matched via fuzzy (auto-map)', { roomCode, orbitRoom: bestMatch.name, score: bestScore })
    return {
      matched: true,
      orbitRoomId: bestMatch.id,
      orbitDisplayName: bestMatch.name,
      confidence: Math.round(bestScore * 100) / 100,
      matchSource: 'fuzzy',
      suggestions,
    }
  }

  log.debug('Room unmatched', { roomCode, roomDescription, bestScore })
  return {
    matched: false,
    orbitRoomId: null,
    orbitDisplayName: null,
    confidence: bestScore > 0 ? Math.round(bestScore * 100) / 100 : null,
    matchSource: 'none',
    suggestions,
  }
}
