import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// ============================================================================
// TYPES
// ============================================================================

export interface RealtimeCaseMilestone {
  id: string
  case_id: string
  facility_milestone_id: string
  recorded_at: string | null
}

export interface CaseMilestoneState {
  id: string
  facility_milestone_id: string
  recorded_at: string | null
}

export interface UseMilestoneRealtimeOptions {
  supabase: {
    channel: (name: string) => RealtimeChannel
    removeChannel: (channel: RealtimeChannel) => void
  }
  caseId: string
  enabled: boolean
  setCaseMilestones: React.Dispatch<React.SetStateAction<CaseMilestoneState[]>>
}

// ============================================================================
// MERGE LOGIC
// ============================================================================

/**
 * Merges an incoming Realtime row into the current milestone state.
 *
 * Handles:
 * - Dedup: skips if we already have the same row ID with identical data
 * - Optimistic replacement: replaces `optimistic-*` entries with the real DB row
 * - Simultaneous recording: if two devices INSERT for the same facility_milestone_id,
 *   keeps the one with the earlier `recorded_at`
 * - New rows: appends truly new milestones
 */
export function mergeInsert(
  prev: CaseMilestoneState[],
  row: RealtimeCaseMilestone
): CaseMilestoneState[] {
  const incoming: CaseMilestoneState = {
    id: row.id,
    facility_milestone_id: row.facility_milestone_id,
    recorded_at: row.recorded_at,
  }

  // Already have this exact row ID?
  const existingById = prev.find(m => m.id === row.id)
  if (existingById) {
    // Update if data changed, otherwise skip
    if (existingById.recorded_at === row.recorded_at) return prev
    return prev.map(m => (m.id === row.id ? incoming : m))
  }

  // Replace optimistic entry for same facility_milestone_id
  const hasOptimistic = prev.some(
    m => m.id.startsWith('optimistic-') && m.facility_milestone_id === row.facility_milestone_id
  )
  if (hasOptimistic) {
    return prev.map(m =>
      m.id.startsWith('optimistic-') && m.facility_milestone_id === row.facility_milestone_id
        ? incoming
        : m
    )
  }

  // Already have a real row for this facility_milestone_id? (simultaneous recording)
  const existingByFacilityId = prev.find(
    m => m.facility_milestone_id === row.facility_milestone_id
  )
  if (existingByFacilityId) {
    // Keep whichever has the earlier recorded_at
    if (existingByFacilityId.recorded_at && row.recorded_at) {
      if (new Date(row.recorded_at) < new Date(existingByFacilityId.recorded_at)) {
        return prev.map(m =>
          m.facility_milestone_id === row.facility_milestone_id ? incoming : m
        )
      }
    }
    // Keep existing (it was recorded first, or one has null)
    return prev
  }

  // Truly new — add it
  return [...prev, incoming]
}

export function mergeUpdate(
  prev: CaseMilestoneState[],
  row: RealtimeCaseMilestone
): CaseMilestoneState[] {
  const incoming: CaseMilestoneState = {
    id: row.id,
    facility_milestone_id: row.facility_milestone_id,
    recorded_at: row.recorded_at,
  }

  const exists = prev.some(m => m.id === row.id)
  if (!exists) return prev

  // Only update if data actually changed
  const current = prev.find(m => m.id === row.id)!
  if (current.recorded_at === row.recorded_at) return prev

  return prev.map(m => (m.id === row.id ? incoming : m))
}

export function mergeDelete(
  prev: CaseMilestoneState[],
  oldId: string
): CaseMilestoneState[] {
  if (!prev.some(m => m.id === oldId)) return prev
  return prev.filter(m => m.id !== oldId)
}

// ============================================================================
// HOOK
// ============================================================================

export function useMilestoneRealtime({
  supabase,
  caseId,
  enabled,
  setCaseMilestones,
}: UseMilestoneRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled || !caseId) return

    const channel = supabase
      .channel(`case-milestones:${caseId}`)
      // @ts-expect-error Supabase Realtime types use a narrow union for the event param; 'postgres_changes' is valid at runtime
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_milestones',
          filter: `case_id=eq.${caseId}`,
        },
        (payload: { eventType: string; new?: RealtimeCaseMilestone; old?: { id: string } }) => {
          const eventType = payload.eventType

          if (eventType === 'INSERT') {
            const row = payload.new as RealtimeCaseMilestone
            setCaseMilestones(prev => mergeInsert(prev, row))
          }

          if (eventType === 'UPDATE') {
            const row = payload.new as RealtimeCaseMilestone
            setCaseMilestones(prev => mergeUpdate(prev, row))
          }

          if (eventType === 'DELETE') {
            const oldRow = payload.old as { id: string }
            if (oldRow?.id) {
              setCaseMilestones(prev => mergeDelete(prev, oldRow.id))
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active for case milestones', { caseId })
        }
        if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime channel error for case milestones — verify case_milestones is in supabase_realtime publication', { caseId })
        }
        if (status === 'TIMED_OUT') {
          logger.warn('Realtime subscription timed out for case milestones', { caseId })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, caseId, enabled, setCaseMilestones])

  return channelRef
}
