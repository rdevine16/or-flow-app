// lib/hooks/useUnreadCount.ts
// Lightweight hook for the notification bell badge.
// Fetches unread count and subscribes to Realtime for live updates.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { notificationsDAL } from '@/lib/dal/notifications'
import { logger } from '@/lib/logger'

const log = logger('useUnreadCount')

const POLL_INTERVAL_MS = 30_000

// ============================================
// Hook
// ============================================

export function useUnreadCount() {
  const { userData, effectiveFacilityId } = useUser()
  const userId = userData.userId
  const facilityId = effectiveFacilityId

  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabaseRef = useRef(createClient())
  const mountedRef = useRef(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = useCallback(async () => {
    if (!facilityId || !userId) return

    try {
      const result = await notificationsDAL.getUnreadCount(
        supabaseRef.current,
        facilityId,
        userId
      )

      if (!mountedRef.current) return

      if (result.error) {
        log.error('Failed to fetch unread count', { error: result.error.message })
        return
      }

      setCount(result.data ?? 0)
    } catch (err) {
      log.error('Failed to fetch unread count', { error: err instanceof Error ? err.message : 'Unknown' })
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [facilityId, userId])

  // Initial fetch + refetch on facility change
  useEffect(() => {
    mountedRef.current = true
    fetchCount()
    return () => { mountedRef.current = false }
  }, [fetchCount])

  // Supabase Realtime — increment count on new notification INSERT
  useEffect(() => {
    if (!facilityId) return

    const channel = supabaseRef.current
      .channel(`unread-count:facility_id=eq.${facilityId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `facility_id=eq.${facilityId}`,
      }, (payload) => {
        const newRow = payload.new as { type: string }
        if (newRow.type === 'patient_call') return

        log.info('Realtime: incrementing unread count')
        setCount(prev => prev + 1)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          log.info('Realtime subscription active for unread count')
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          log.warn('Realtime unavailable for unread count — falling back to polling')
          if (!pollRef.current) {
            pollRef.current = setInterval(() => { fetchCount() }, POLL_INTERVAL_MS)
          }
        }
      })

    return () => {
      supabaseRef.current.removeChannel(channel)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [facilityId, fetchCount])

  /** Decrement count by 1 (used after marking a notification as read) */
  const decrement = useCallback((by = 1) => {
    setCount(prev => Math.max(0, prev - by))
  }, [])

  /** Set count to 0 (used after marking all as read) */
  const clearCount = useCallback(() => {
    setCount(0)
  }, [])

  /** Force refetch the count from DB */
  const refetch = fetchCount

  return { count, loading, decrement, clearCount, refetch }
}
