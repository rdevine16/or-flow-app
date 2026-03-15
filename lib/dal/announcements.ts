/**
 * Announcements Data Access Layer
 *
 * Centralizes all `announcements` and `announcement_dismissals` table queries.
 * Supports announcement creation, editing, deactivation, history listing,
 * active banner fetching, and per-user dismissal.
 */

import type { AnySupabaseClient, DALResult, DALListResult } from './index'
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
} from '@/types/announcements'
import { notificationsDAL } from './notifications'
import { logger } from '@/lib/logger'

const log = logger('dal:announcements')

// ============================================
// SELECT STRINGS
// ============================================

const ANNOUNCEMENT_SELECT = `
  id,
  facility_id,
  created_by,
  title,
  body,
  audience,
  priority,
  category,
  status,
  starts_at,
  expires_at,
  deactivated_at,
  deactivated_by,
  created_at,
  updated_at,
  is_active,
  deleted_at,
  deleted_by,
  creator:created_by(id, first_name, last_name)
` as const

// ============================================
// HELPERS
// ============================================

/** Compute expires_at from a start time and duration in days */
function computeExpiresAt(startsAt: string, durationDays: number): string {
  const start = new Date(startsAt)
  start.setDate(start.getDate() + durationDays)
  return start.toISOString()
}

// ============================================
// DAL FUNCTIONS
// ============================================

/**
 * List announcements for the history table (admin view).
 * Returns all announcements (active, scheduled, expired, deactivated)
 * with optional filtering and search.
 */
async function listAnnouncements(
  supabase: AnySupabaseClient,
  facilityId: string,
  filters?: AnnouncementFilterParams
): Promise<DALListResult<Announcement>> {
  let query = supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT, { count: 'exact' })
    .eq('facility_id', facilityId)
    .eq('is_active', true)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters?.category) {
    query = query.eq('category', filters.category)
  }
  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    log.error('listAnnouncements failed', { facilityId, error })
    return { data: [], error, count: 0 }
  }

  return {
    data: (data as unknown as Announcement[]) || [],
    error: null,
    count: count ?? 0,
  }
}

/**
 * Get active announcements for the global banner display.
 * Excludes announcements the user has dismissed.
 * Sorted by priority (critical > warning > normal) then created_at DESC.
 */
async function getActiveAnnouncements(
  supabase: AnySupabaseClient,
  facilityId: string,
  userId: string
): Promise<DALListResult<Announcement>> {
  // Fetch active announcements
  const { data: announcements, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('facility_id', facilityId)
    .eq('status', 'active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    log.error('getActiveAnnouncements failed', { facilityId, error })
    return { data: [], error }
  }

  if (!announcements || announcements.length === 0) {
    return { data: [], error: null }
  }

  // Fetch dismissals for this user
  const announcementIds = (announcements as unknown as Announcement[]).map((a) => a.id)
  const { data: dismissals } = await supabase
    .from('announcement_dismissals')
    .select('announcement_id')
    .eq('user_id', userId)
    .in('announcement_id', announcementIds)

  const dismissedSet = new Set(
    (dismissals ?? []).map((d: { announcement_id: string }) => d.announcement_id)
  )

  // Filter out dismissed, sort by priority then created_at
  const priorityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    normal: 2,
  }

  const filtered = (announcements as unknown as Announcement[])
    .filter((a) => !dismissedSet.has(a.id))
    .sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2
      const pb = priorityOrder[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return { data: filtered, error: null }
}

/**
 * Create a new announcement. Also creates a notification record
 * for the notification panel.
 */
async function createAnnouncement(
  supabase: AnySupabaseClient,
  facilityId: string,
  userId: string,
  input: CreateAnnouncementInput
): Promise<DALResult<Announcement>> {
  const isScheduled = !!input.scheduled_for
  const startsAt = isScheduled ? input.scheduled_for! : new Date().toISOString()
  const expiresAt = computeExpiresAt(startsAt, input.duration_days)

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      facility_id: facilityId,
      created_by: userId,
      title: input.title,
      body: input.body ?? null,
      audience: input.audience,
      priority: input.priority,
      category: input.category,
      status: isScheduled ? 'scheduled' : 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
    })
    .select(ANNOUNCEMENT_SELECT)
    .single()

  if (error) {
    log.error('createAnnouncement failed', { facilityId, error })
    return { data: null, error }
  }

  // Create notification record (non-blocking — don't fail if this errors)
  try {
    await notificationsDAL.createNotification(supabase, {
      facilityId,
      type: 'announcement_created',
      title: input.title,
      message: input.body ?? `New ${input.priority} announcement`,
      category: 'announcements',
      metadata: {
        announcement_id: data.id,
        audience: input.audience,
        priority: input.priority,
        link_to: '/staff-management?tab=announcements',
      },
      sentBy: userId,
    })
  } catch (notifErr) {
    log.warn('Failed to create notification for announcement', { announcementId: data.id, notifErr })
  }

  return { data: data as unknown as Announcement, error: null }
}

/**
 * Update an existing announcement (active or scheduled).
 * Recomputes expires_at if duration_days changes.
 */
async function updateAnnouncement(
  supabase: AnySupabaseClient,
  facilityId: string,
  announcementId: string,
  input: UpdateAnnouncementInput
): Promise<DALResult<Announcement>> {
  // Build update payload
  const updatePayload: Record<string, unknown> = {}

  if (input.title !== undefined) updatePayload.title = input.title
  if (input.body !== undefined) updatePayload.body = input.body
  if (input.audience !== undefined) updatePayload.audience = input.audience
  if (input.priority !== undefined) updatePayload.priority = input.priority
  if (input.category !== undefined) updatePayload.category = input.category

  // Handle schedule changes
  if (input.scheduled_for !== undefined) {
    if (input.scheduled_for) {
      updatePayload.starts_at = input.scheduled_for
      updatePayload.status = 'scheduled'
    } else {
      updatePayload.starts_at = new Date().toISOString()
      updatePayload.status = 'active'
    }
  }

  // If duration changed, recompute expires_at
  if (input.duration_days !== undefined) {
    // Need the current starts_at to recompute
    const { data: current, error: fetchErr } = await supabase
      .from('announcements')
      .select('starts_at')
      .eq('id', announcementId)
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .single()

    if (fetchErr) {
      log.error('updateAnnouncement: failed to fetch current', { announcementId, fetchErr })
      return { data: null, error: fetchErr }
    }

    const startsAt = (updatePayload.starts_at as string) ?? current.starts_at
    updatePayload.expires_at = computeExpiresAt(startsAt, input.duration_days)
  }

  const { data, error } = await supabase
    .from('announcements')
    .update(updatePayload)
    .eq('id', announcementId)
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .select(ANNOUNCEMENT_SELECT)
    .single()

  if (error) {
    log.error('updateAnnouncement failed', { announcementId, error })
    return { data: null, error }
  }

  return { data: data as unknown as Announcement, error: null }
}

/**
 * Deactivate an active announcement.
 * Sets status='deactivated', records who deactivated and when.
 */
async function deactivateAnnouncement(
  supabase: AnySupabaseClient,
  facilityId: string,
  announcementId: string,
  userId: string
): Promise<DALResult<Announcement>> {
  const { data, error } = await supabase
    .from('announcements')
    .update({
      status: 'deactivated',
      deactivated_at: new Date().toISOString(),
      deactivated_by: userId,
    })
    .eq('id', announcementId)
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .select(ANNOUNCEMENT_SELECT)
    .single()

  if (error) {
    log.error('deactivateAnnouncement failed', { announcementId, error })
    return { data: null, error }
  }

  return { data: data as unknown as Announcement, error: null }
}

/**
 * Soft delete an announcement (set is_active=false).
 * The sync_soft_delete_columns trigger handles deleted_at/deleted_by.
 */
async function deleteAnnouncement(
  supabase: AnySupabaseClient,
  facilityId: string,
  announcementId: string
): Promise<{ success: boolean; error: { message: string } | null }> {
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: false })
    .eq('id', announcementId)
    .eq('facility_id', facilityId)

  if (error) {
    log.error('deleteAnnouncement failed', { announcementId, error })
    return { success: false, error: { message: error.message } }
  }

  return { success: true, error: null }
}

/**
 * Dismiss an announcement for a specific user.
 * Creates a record in announcement_dismissals.
 * Uses upsert to handle duplicate dismissals gracefully.
 */
async function dismissAnnouncement(
  supabase: AnySupabaseClient,
  announcementId: string,
  userId: string
): Promise<{ success: boolean; error: { message: string } | null }> {
  const { error } = await supabase
    .from('announcement_dismissals')
    .upsert(
      { announcement_id: announcementId, user_id: userId },
      { onConflict: 'announcement_id,user_id' }
    )

  if (error) {
    log.error('dismissAnnouncement failed', { announcementId, userId, error })
    return { success: false, error: { message: error.message } }
  }

  return { success: true, error: null }
}

/**
 * Get a single announcement by ID.
 */
async function getAnnouncement(
  supabase: AnySupabaseClient,
  facilityId: string,
  announcementId: string
): Promise<DALResult<Announcement>> {
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_SELECT)
    .eq('id', announcementId)
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .single()

  if (error) {
    log.error('getAnnouncement failed', { announcementId, error })
    return { data: null, error }
  }

  return { data: data as unknown as Announcement, error: null }
}

// ============================================
// EXPORT
// ============================================

export const announcementsDAL = {
  listAnnouncements,
  getActiveAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deactivateAnnouncement,
  deleteAnnouncement,
  dismissAnnouncement,
}
