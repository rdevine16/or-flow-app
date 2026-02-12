// lib/hooks/useFlipRoom.ts
// Custom hook for fetching and subscribing to flip room data
// Manages surgeon's next case in a different room with Realtime updates

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  findNextCase,
  getCurrentMilestoneStatus,
  type SurgeonDayCase,
  type FlipRoomMilestoneData,
  type CurrentMilestoneStatus,
} from '@/lib/flip-room'

// ============================================================================
// TYPES
// ============================================================================

interface UseFlipRoomOptions {
  supabase: {
    from: (table: string) => any
    channel: (name: string) => any
    removeChannel: (channel: any) => void
  }
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
  const fetchRef = useRef<() => Promise<void>>()

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
      const normalized: SurgeonDayCase[] = dayCases.map((c: any) => ({
        id: c.id,
        case_number: c.case_number,
        or_room_id: c.or_room_id,
        room_name: Array.isArray(c.or_rooms) ? c.or_rooms[0]?.name : c.or_rooms?.name || null,
        start_time: c.start_time,
        status_name: Array.isArray(c.case_statuses) ? c.case_statuses[0]?.name : c.case_statuses?.name || 'scheduled',
        procedure_name: Array.isArray(c.procedure_types) ? c.procedure_types[0]?.name : c.procedure_types?.name || null,
        called_back_at: c.called_back_at,
      }))

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
        const msData: FlipRoomMilestoneData[] = flipMilestones.map((m: any) => {
          const fm = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
          return {
            facility_milestone_id: m.facility_milestone_id,
            recorded_at: m.recorded_at,
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
        (payload: any) => {
          if (payload.new) {
            setFlipRoom(prev => prev ? {
              ...prev,
              calledBackAt: payload.new.called_back_at || null,
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
