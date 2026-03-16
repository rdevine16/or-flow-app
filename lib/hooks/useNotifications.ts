// lib/hooks/useNotifications.ts
// Hook for fetching notifications with pagination and Supabase Realtime subscription.
// Powers the notification panel's persistent notifications section.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { notificationsDAL, type NotificationWithReadState, type NotificationFilter } from '@/lib/dal/notifications'
import { logger } from '@/lib/logger'

const log = logger('useNotifications')

const PAGE_SIZE = 20
const POLL_INTERVAL_MS = 30_000

// ============================================
// Types
// ============================================

interface UseNotificationsReturn {
  notifications: NotificationWithReadState[]
  loading: boolean
  error: string | null
  filter: NotificationFilter
  setFilter: (f: NotificationFilter) => void
  hasMore: boolean
  loadMore: () => void
  loadingMore: boolean
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refetch: () => Promise<void>
}

// ============================================
// Hook
// ============================================

export function useNotifications(): UseNotificationsReturn {
  const { userData, effectiveFacilityId } = useUser()
  const userId = userData.userId
  const facilityId = effectiveFacilityId

  const [notifications, setNotifications] = useState<NotificationWithReadState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const supabaseRef = useRef(createClient())
  const mountedRef = useRef(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch notifications (initial or refresh)
  const fetchNotifications = useCallback(async (reset = true) => {
    if (!facilityId || !userId) {
      setLoading(false)
      return
    }

    if (reset) setLoading(true)
    setError(null)

    try {
      const result = await notificationsDAL.getNotifications(supabaseRef.current, {
        facilityId,
        userId,
        filter,
        limit: PAGE_SIZE,
        offset: 0,
      })

      if (!mountedRef.current) return

      if (result.error) {
        setError(result.error.message)
        return
      }

      setNotifications(result.data)
      setTotalCount(result.count ?? 0)
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [facilityId, userId, filter])

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!facilityId || !userId || loadingMore) return

    setLoadingMore(true)
    try {
      const result = await notificationsDAL.getNotifications(supabaseRef.current, {
        facilityId,
        userId,
        filter,
        limit: PAGE_SIZE,
        offset: notifications.length,
      })

      if (!mountedRef.current) return

      if (result.error) {
        log.error('Failed to load more notifications', { error: result.error.message })
        return
      }

      setNotifications(prev => [...prev, ...result.data])
    } catch (err) {
      log.error('Failed to load more notifications', { error: err instanceof Error ? err.message : 'Unknown' })
    } finally {
      if (mountedRef.current) setLoadingMore(false)
    }
  }, [facilityId, userId, filter, notifications.length, loadingMore])

  // Mark a single notification as read (optimistic UI)
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return

    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
      )
    )

    const result = await notificationsDAL.markAsRead(
      supabaseRef.current,
      notificationId,
      userId
    )

    if (result.error) {
      log.error('Failed to mark notification as read', { error: result.error.message })
      // Revert optimistic update
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: false, read_at: null }
            : n
        )
      )
    }
  }, [userId])

  // Mark all as read (optimistic UI)
  const markAllAsRead = useCallback(async () => {
    if (!facilityId || !userId) return

    const now = new Date().toISOString()

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: n.read_at ?? now }))
    )

    const result = await notificationsDAL.markAllAsRead(
      supabaseRef.current,
      facilityId,
      userId
    )

    if (result.error) {
      log.error('Failed to mark all as read', { error: result.error.message })
      // Revert — refetch to get the true state
      await fetchNotifications()
    }
  }, [facilityId, userId, fetchNotifications])

  // Initial fetch + refetch on filter/facility change
  useEffect(() => {
    mountedRef.current = true
    fetchNotifications()
    return () => { mountedRef.current = false }
  }, [fetchNotifications])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!facilityId) return

    const channel = supabaseRef.current
      .channel(`notifications:facility_id=eq.${facilityId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `facility_id=eq.${facilityId}`,
      }, (payload) => {
        const newNotification = payload.new as NotificationWithReadState & { type: string; target_user_id: string | null }
        // Skip patient_call notifications
        if (newNotification.type === 'patient_call') return

        // Skip targeted notifications meant for other users
        if (newNotification.target_user_id && newNotification.target_user_id !== userId) return

        log.info('Realtime: new notification received', { id: newNotification.id })

        // Prepend to list with unread state
        setNotifications(prev => {
          // Avoid duplicates
          if (prev.some(n => n.id === newNotification.id)) return prev
          return [{
            ...newNotification,
            metadata: (newNotification.metadata ?? {}) as Record<string, unknown>,
            is_read: false,
            read_at: null,
          }, ...prev]
        })
        setTotalCount(prev => prev + 1)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          log.info('Realtime subscription active for notifications')
          // Stop polling if Realtime is active
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          log.warn('Realtime unavailable for notifications — falling back to polling')
          if (!pollRef.current) {
            pollRef.current = setInterval(() => {
              fetchNotifications(false)
            }, POLL_INTERVAL_MS)
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
  }, [facilityId, fetchNotifications])

  const hasMore = notifications.length < totalCount

  return {
    notifications,
    loading,
    error,
    filter,
    setFilter,
    hasMore,
    loadMore,
    loadingMore,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
