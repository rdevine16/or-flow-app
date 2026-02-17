// lib/hooks/useFlipRoom.ts
// Custom hook for fetching and subscribing to flip room data
// Manages surgeon's next case in a different room with Realtime updates

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findNextCase,
  getCurrentMilestoneStatus,
  type SurgeonDayCase,
  type FlipRoomMilestoneData,
} from '@/lib/flip-room'

// ============================================================================
// TYPES
// ============================================================================

interface UseFlipRoomOptions {
  supabase: SupabaseClient
  surgeonId: string | null
  currentCaseId: string
  currentRoomId: string | null
  scheduledDate: string | null
  facilityId: string | null
  enabled: boolean
}

export interface FlipRoomData {
  caseId: string
  caseNumber: string
  roomName: string
  procedureName: string
  startTime: string | null
  calledBackAt: string | null
  lastMilestoneDisplayName: string | null
  lastMilestoneRecordedAt: string | null
}

// ============================================================================
// HOOK
// ============================================================================

export function useFlipRoom({
  supabase,
  surgeonId,
  currentCaseId,
  currentRoomId,
  scheduledDate,
  facilityId,
  enabled,
}: UseFlipRoomOptions) {
  const [flipRoom, setFlipRoom] = useState<FlipRoomData | null>(null)
  const [nextSameRoomCaseNumber, setNextSameRoomCaseNumber] = useState<string | null>(null)
  const [flipCaseId, setFlipCaseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Ref to latest fetchFlipRoom so Realtime callbacks don't cause subscription churn
const fetchRef = useRef<() => Promise<void>>(null)

  const fetchFlipRoom = useCallback(async () => {
    if (!surgeonId || !scheduledDate || !facilityId || !enabled) return

    setLoading(true)
    try {
      // Fetch all surgeon's cases for the day
      const { data: dayCases } = await supabase
        .from('cases')
        .select(`
          id, case_number, or_room_id, start_time, called_back_at, called_back_by,
          or_rooms (name),
          procedure_types (name),
          case_statuses (name)
        `)
        .eq('surgeon_id', surgeonId)
        .eq('scheduled_date', scheduledDate)
        .eq('facility_id', facilityId)
        .order('start_time', { ascending: true })

      if (!dayCases) {
        setFlipRoom(null)
        setNextSameRoomCaseNumber(null)
        setFlipCaseId(null)
        return
      }

      // Normalize Supabase joined values (can be array or object)
      const normalized: SurgeonDayCase[] = dayCases.map((c: Record<string, unknown>) => {
        const orRooms = c.or_rooms as { name: string }[] | { name: string } | null
        const caseStatuses = c.case_statuses as { name: string }[] | { name: string } | null
        const procedureTypes = c.procedure_types as { name: string }[] | { name: string } | null
        return {
          id: c.id as string,
          case_number: c.case_number as string,
          or_room_id: c.or_room_id as string | null,
          room_name: Array.isArray(orRooms) ? orRooms[0]?.name : orRooms?.name || null,
          start_time: c.start_time as string | null,
          status_name: Array.isArray(caseStatuses) ? caseStatuses[0]?.name : caseStatuses?.name || 'scheduled',
          procedure_name: Array.isArray(procedureTypes) ? procedureTypes[0]?.name : procedureTypes?.name || null,
          called_back_at: c.called_back_at as string | null,
        }
      })

      const { flipCase, nextSameRoomCase } = findNextCase(normalized, currentCaseId, currentRoomId)

      setNextSameRoomCaseNumber(nextSameRoomCase?.case_number || null)

      if (!flipCase) {
        setFlipRoom(null)
        setFlipCaseId(null)
        return
      }

      setFlipCaseId(flipCase.id)

      // Fetch milestones for the flip room case
      const { data: flipMilestones } = await supabase
        .from('case_milestones')
        .select(`
          facility_milestone_id, recorded_at,
          facility_milestones (name, display_name, display_order)
        `)
        .eq('case_id', flipCase.id)

      // Find last recorded milestone
      let lastMilestoneDisplayName: string | null = null
      let lastMilestoneRecordedAt: string | null = null

      if (flipMilestones) {
        const msData: FlipRoomMilestoneData[] = flipMilestones.map((m: Record<string, unknown>) => {
          const fmRaw = m.facility_milestones as { name?: string; display_name?: string; display_order?: number }[] | { name?: string; display_name?: string; display_order?: number } | null
          const fm = Array.isArray(fmRaw) ? fmRaw[0] : fmRaw
          return {
            facility_milestone_id: m.facility_milestone_id as string,
            recorded_at: m.recorded_at as string | null,
            display_name: fm?.display_name || '',
            display_order: fm?.display_order || 0,
            name: fm?.name || '',
          }
        })

        const milestoneStatus = getCurrentMilestoneStatus(msData, Date.now())
        if (milestoneStatus) {
          lastMilestoneDisplayName = milestoneStatus.milestoneDisplayName
          lastMilestoneRecordedAt = milestoneStatus.recordedAt
        }
      }

      setFlipRoom({
        caseId: flipCase.id,
        caseNumber: flipCase.case_number,
        roomName: flipCase.room_name || 'Unknown Room',
        procedureName: flipCase.procedure_name || 'Unknown Procedure',
        startTime: flipCase.start_time,
        calledBackAt: flipCase.called_back_at,
        lastMilestoneDisplayName,
        lastMilestoneRecordedAt,
      })
    } catch (err) {
      console.error('Failed to fetch flip room data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, surgeonId, currentCaseId, currentRoomId, scheduledDate, facilityId, enabled])

  // Keep ref current
  fetchRef.current = fetchFlipRoom

  // Initial fetch
  useEffect(() => {
    fetchFlipRoom()
  }, [fetchFlipRoom])

  // Realtime subscriptions for flip room case
  useEffect(() => {
    if (!flipCaseId || !enabled) return

    // Subscribe to milestone changes — refetch on any change
    const milestoneChannel = supabase
      .channel(`flip-milestones:${flipCaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_milestones',
          filter: `case_id=eq.${flipCaseId}`,
        },
        () => {
          fetchRef.current?.()
        }
      )
      .subscribe()

    // Subscribe to case updates (called_back_at, status changes)
    const caseChannel = supabase
      .channel(`flip-case:${flipCaseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${flipCaseId}`,
        },
        (payload: { new?: { called_back_at?: string | null } }) => {
          const newPayload = payload.new
          if (newPayload) {
            setFlipRoom(prev => prev ? {
              ...prev,
              calledBackAt: newPayload.called_back_at || null,
            } : null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(milestoneChannel)
      supabase.removeChannel(caseChannel)
    }
  }, [supabase, flipCaseId, enabled])

  // Optimistic update for called_back_at (used by page callback functions)
  const setCalledBackAt = (value: string | null) => {
    setFlipRoom(prev => prev ? { ...prev, calledBackAt: value } : null)
  }

  return { flipRoom, nextSameRoomCaseNumber, loading, setCalledBackAt }
}
