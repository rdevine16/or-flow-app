// hooks/useRoomOrdering.ts
// Hook for managing room display order with optimistic updates

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export interface OrderableRoom {
  id: string
  name: string
  display_order: number
}

interface UseRoomOrderingOptions {
  facilityId: string | null
}

interface UseRoomOrderingReturn {
  rooms: OrderableRoom[]
  loading: boolean
  saving: boolean
  error: string | null
  reorderRooms: (reorderedRooms: OrderableRoom[]) => Promise<boolean>
  refreshRooms: () => Promise<void>
}

export function useRoomOrdering({ facilityId }: UseRoomOrderingOptions): UseRoomOrderingReturn {
  const supabase = createClient()
  const [rooms, setRooms] = useState<OrderableRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch rooms ordered by display_order
  const fetchRooms = useCallback(async () => {
    if (!facilityId) {
      setRooms([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('or_rooms')
        .select('id, name, display_order')
        .eq('facility_id', facilityId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })

      if (fetchError) throw fetchError

      setRooms(data || [])
    } catch (err) {
      console.error('Error fetching rooms:', err)
      setError('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  // Initial fetch
  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // Reorder rooms - saves new order to database
  const reorderRooms = useCallback(async (reorderedRooms: OrderableRoom[]): Promise<boolean> => {
    if (!facilityId) return false

    setSaving(true)
    setError(null)

    // Store previous state for rollback
    const previousRooms = [...rooms]

    // Optimistic update - apply new order immediately
    const roomsWithNewOrder = reorderedRooms.map((room, index) => ({
      ...room,
      display_order: index + 1
    }))
    setRooms(roomsWithNewOrder)

    try {
      // Update each room's display_order
      for (const room of roomsWithNewOrder) {
        const { error: updateError } = await supabase
          .from('or_rooms')
          .update({ display_order: room.display_order })
          .eq('id', room.id)

        if (updateError) throw updateError
      }

      // Log to audit (inline to avoid circular dependency issues)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('facility_id')
            .eq('id', user.id)
            .single()

          await supabase.from('audit_log').insert({
            user_id: user.id,
            user_email: user.email,
            facility_id: userData?.facility_id || facilityId,
            action: 'room.reordered',
            target_type: 'room',
            target_label: `${roomsWithNewOrder.length} rooms`,
            new_values: {
              order: roomsWithNewOrder.map(r => ({ name: r.name, position: r.display_order }))
            },
            success: true
          })
        }
      } catch (auditErr) {
        console.error('Audit log error:', auditErr)
        // Don't fail the operation for audit errors
      }

      return true
    } catch (err) {
      console.error('Error saving room order:', err)
      setError('Failed to save room order')
      
      // Rollback to previous state
      setRooms(previousRooms)
      return false
    } finally {
      setSaving(false)
    }
  }, [facilityId, rooms, supabase])

  return {
    rooms,
    loading,
    saving,
    error,
    reorderRooms,
    refreshRooms: fetchRooms
  }
}