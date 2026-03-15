// types/announcements.ts
// TypeScript types for the global announcements system

// =====================================================
// ENUMS (union types)
// =====================================================

export type AnnouncementAudience = 'staff' | 'surgeons' | 'both'

export type AnnouncementPriority = 'normal' | 'warning' | 'critical'

export type AnnouncementCategory =
  | 'general'
  | 'maintenance'
  | 'policy_update'
  | 'safety_alert'

export type AnnouncementStatus =
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'deactivated'

// =====================================================
// DATABASE TYPES
// =====================================================

/** Full announcement row from the database */
export interface Announcement {
  id: string
  facility_id: string
  created_by: string
  title: string
  body: string | null
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  category: AnnouncementCategory
  status: AnnouncementStatus
  starts_at: string
  expires_at: string
  deactivated_at: string | null
  deactivated_by: string | null
  created_at: string
  updated_at: string
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
  // Joined fields (optional)
  creator?: {
    id: string
    first_name: string
    last_name: string
  }
}

/** Dismissal record for per-user banner dismissal */
export interface AnnouncementDismissal {
  id: string
  announcement_id: string
  user_id: string
  dismissed_at: string
}

// =====================================================
// INPUT TYPES
// =====================================================

/** Input for creating a new announcement */
export interface CreateAnnouncementInput {
  title: string
  body?: string | null
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  category: AnnouncementCategory
  /** Duration in days (1–7). Used to compute expires_at. */
  duration_days: number
  /** If provided, announcement starts at this time (status='scheduled'). Otherwise starts now (status='active'). */
  scheduled_for?: string | null
}

/** Input for updating an existing announcement */
export interface UpdateAnnouncementInput {
  title?: string
  body?: string | null
  audience?: AnnouncementAudience
  priority?: AnnouncementPriority
  category?: AnnouncementCategory
  /** If changed, recomputes expires_at from starts_at + duration_days */
  duration_days?: number
  scheduled_for?: string | null
}

// =====================================================
// FILTER TYPES
// =====================================================

/** Filters for the announcement history table */
export interface AnnouncementFilterParams {
  status?: AnnouncementStatus
  priority?: AnnouncementPriority
  category?: AnnouncementCategory
  search?: string
}

// =====================================================
// LABEL MAPS
// =====================================================

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  staff: 'Staff',
  surgeons: 'Surgeons',
  both: 'Both',
}

export const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
}

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: 'General',
  maintenance: 'Maintenance',
  policy_update: 'Policy Update',
  safety_alert: 'Safety Alert',
}

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Expired',
  deactivated: 'Deactivated',
}
