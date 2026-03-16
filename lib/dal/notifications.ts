/**
 * Notifications Data Access Layer
 *
 * Centralizes all `notifications` and `notification_reads` table queries.
 * Supports the notification center panel with pagination, read/unread tracking,
 * and unread count for the bell badge.
 */

import type { AnySupabaseClient, DALResult, DALListResult } from './index'

// ============================================
// TYPES
// ============================================

/** Notification record from the database */
export interface Notification {
  id: string
  facility_id: string
  type: string
  title: string
  message: string | null
  category: string | null
  metadata: Record<string, unknown>
  room_id: string | null
  case_id: string | null
  sent_by: string | null
  expires_at: string | null
  created_at: string
}

/** Notification with read state for the current user */
export interface NotificationWithReadState extends Notification {
  is_read: boolean
  read_at: string | null
}

/** Filter for fetching notifications */
export type NotificationFilter = 'all' | 'unread'

/** Params for paginated notification fetch */
export interface GetNotificationsParams {
  facilityId: string
  userId: string
  filter?: NotificationFilter
  limit?: number
  offset?: number
}

/** Result from creating a notification via the DB function */
export interface CreateNotificationParams {
  facilityId: string
  type: string
  title: string
  message: string
  category?: string
  metadata?: Record<string, unknown>
  caseId?: string | null
  sentBy?: string | null
  targetUserId?: string | null
}

// ============================================
// DAL FUNCTIONS
// ============================================

/**
 * Get paginated notifications for a facility, with read state per user.
 * Uses a LEFT JOIN to notification_reads to determine read/unread state.
 */
async function getNotifications(
  supabase: AnySupabaseClient,
  params: GetNotificationsParams
): Promise<DALListResult<NotificationWithReadState>> {
  const {
    facilityId,
    userId,
    filter = 'all',
    limit = 20,
    offset = 0,
  } = params

  // We need to query notifications with a left join to notification_reads
  // to get per-user read state. Supabase's PostgREST doesn't support
  // left joins with filters on the joined table easily, so we use RPC
  // or a two-step approach.
  //
  // Approach: fetch notifications, then fetch read states for those IDs.

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Exclude patient_call — those are handled by CallNextPatientModal
  query = query.neq('type', 'patient_call')

  // Only show broadcast notifications or ones targeted at this user
  // (defense-in-depth — RLS also enforces this)
  query = query.or(`target_user_id.is.null,target_user_id.eq.${userId}`)

  const { data: notifications, error, count } = await query

  if (error) {
    return { data: [], error, count: 0 }
  }

  if (!notifications || notifications.length === 0) {
    return { data: [], error: null, count: count ?? 0 }
  }

  // Fetch read states for these notification IDs
  const notificationIds = notifications.map((n: Notification) => n.id)
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id, read_at')
    .eq('user_id', userId)
    .in('notification_id', notificationIds)

  const readMap = new Map<string, string>()
  if (reads) {
    for (const r of reads) {
      readMap.set(r.notification_id, r.read_at)
    }
  }

  // Merge read state into notifications
  const withReadState: NotificationWithReadState[] = notifications.map(
    (n: Notification) => ({
      ...n,
      metadata: (n.metadata ?? {}) as Record<string, unknown>,
      is_read: readMap.has(n.id),
      read_at: readMap.get(n.id) ?? null,
    })
  )

  // Apply unread filter after merging (done client-side to keep count accurate)
  const filtered =
    filter === 'unread'
      ? withReadState.filter((n) => !n.is_read)
      : withReadState

  return { data: filtered, error: null, count: count ?? 0 }
}

/**
 * Get the count of unread notifications for a user at a facility.
 * Lightweight query for the bell badge — does not fetch full notification data.
 */
async function getUnreadCount(
  supabase: AnySupabaseClient,
  facilityId: string,
  userId: string
): Promise<DALResult<number>> {
  // Count all non-patient_call notifications minus those the user has read
  // Only count broadcast or user-targeted notifications (defense-in-depth)
  const { count: totalCount, error: totalError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('facility_id', facilityId)
    .neq('type', 'patient_call')
    .or(`target_user_id.is.null,target_user_id.eq.${userId}`)

  if (totalError) {
    return { data: null, error: totalError }
  }

  // Count how many of those the user has read
  // We need to join through notification_reads, but since we can't do a
  // cross-table count easily, we count read entries for this facility's notifications
  const { data: readNotifications, error: readError } = await supabase
    .from('notification_reads')
    .select('notification_id, notifications!inner(facility_id, type)')
    .eq('user_id', userId)
    .eq('notifications.facility_id', facilityId)
    .neq('notifications.type', 'patient_call')

  if (readError) {
    return { data: null, error: readError }
  }

  const readCount = readNotifications?.length ?? 0
  const unreadCount = Math.max(0, (totalCount ?? 0) - readCount)

  return { data: unreadCount, error: null }
}

/**
 * Mark a single notification as read for the current user.
 * Uses upsert with the unique constraint (notification_id, user_id).
 */
async function markAsRead(
  supabase: AnySupabaseClient,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error: { message: string } | null }> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { notification_id: notificationId, user_id: userId },
      { onConflict: 'notification_id,user_id' }
    )

  if (error) {
    return { success: false, error: { message: error.message } }
  }

  return { success: true, error: null }
}

/**
 * Mark all unread notifications as read for the current user at a facility.
 * Fetches unread notification IDs, then bulk inserts into notification_reads.
 */
async function markAllAsRead(
  supabase: AnySupabaseClient,
  facilityId: string,
  userId: string
): Promise<{ success: boolean; error: { message: string } | null }> {
  // Get all notification IDs for this facility that the user hasn't read
  // Only include broadcast or user-targeted notifications (defense-in-depth)
  const { data: notifications, error: fetchError } = await supabase
    .from('notifications')
    .select('id')
    .eq('facility_id', facilityId)
    .neq('type', 'patient_call')
    .or(`target_user_id.is.null,target_user_id.eq.${userId}`)

  if (fetchError) {
    return { success: false, error: { message: fetchError.message } }
  }

  if (!notifications || notifications.length === 0) {
    return { success: true, error: null }
  }

  const allIds = notifications.map((n: { id: string }) => n.id)

  // Check which ones are already read
  const { data: existingReads } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId)
    .in('notification_id', allIds)

  const alreadyReadSet = new Set(
    (existingReads ?? []).map((r: { notification_id: string }) => r.notification_id)
  )

  // Filter to only unread IDs
  const unreadIds = allIds.filter((id: string) => !alreadyReadSet.has(id))

  if (unreadIds.length === 0) {
    return { success: true, error: null }
  }

  // Bulk insert read records
  const readRecords = unreadIds.map((notificationId: string) => ({
    notification_id: notificationId,
    user_id: userId,
  }))

  const { error: insertError } = await supabase
    .from('notification_reads')
    .insert(readRecords)

  if (insertError) {
    return { success: false, error: { message: insertError.message } }
  }

  return { success: true, error: null }
}

/**
 * Create a notification via the DB function that checks facility settings.
 * Returns the notification ID if created, null if the type is disabled.
 */
async function createNotification(
  supabase: AnySupabaseClient,
  params: CreateNotificationParams
): Promise<DALResult<string | null>> {
  const { data, error } = await supabase.rpc('create_notification_if_enabled', {
    p_facility_id: params.facilityId,
    p_type: params.type,
    p_title: params.title,
    p_message: params.message,
    p_category: params.category ?? null,
    p_metadata: params.metadata ?? {},
    p_case_id: params.caseId ?? null,
    p_sent_by: params.sentBy ?? null,
    p_target_user_id: params.targetUserId ?? null,
  })

  if (error) {
    return { data: null, error }
  }

  return { data: data as string | null, error: null }
}

// ============================================
// EXPORT
// ============================================

export const notificationsDAL = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
}
