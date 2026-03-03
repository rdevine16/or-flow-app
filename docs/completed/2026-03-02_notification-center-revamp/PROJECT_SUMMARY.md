# Project: Notification Center Revamp
**Completed:** 2026-03-02
**Branch:** feature/notification-center-revamp
**Duration:** 2026-03-02 → 2026-03-02
**Total Phases:** 6

## What Was Built
Redesigned the notification system from a disconnected set of unused tables and computed dashboard alerts into a unified, persistent notification center. The slide-out panel features two sections: Active Alerts (computed, ephemeral dashboard alerts with dismiss support) at the top and Persistent Notifications (from the database via a new creation pipeline) below. Notifications are created by the HL7v2 edge function for case auto-created/updated/cancelled events and by the data quality detection edge function when new issues are found.

The system includes Supabase Realtime subscriptions for live updates, deep-link click-through navigation, read/unread tracking with visual indicators, and a `create_notification_if_enabled()` DB function that respects per-facility notification settings. The existing notification settings infrastructure (13 notification types, per-facility toggles, channel selection) is now wired to an actual delivery pipeline. Auto-cleanup handles retention: read notifications purged after 30 days, unread after 90 days.

The existing CallNextPatientModal (patient_call notifications) continues to work unchanged. The `data_quality_notifications` table was consolidated into the main `notifications` table.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Schema migration and notification creation pipeline | 14511d6 |
| 2     | Notification panel UI with realtime and deep links | f8514c7 |
| 3     | Integration event notifications from HL7v2 edge function | d26b5d8 |
| 4     | Data quality detection notifications | 30adf0d |
| 5     | Alert dismissal and panel polish | 9bd5dba |
| 6     | Auto-cleanup, performance audit, and final testing | 611cbf6 |

## Key Files Created/Modified

### New Components
- `components/global/NotificationPanel.tsx` — Slide-out panel with two sections, tabs, scroll area, mark all read
- `components/global/NotificationCard.tsx` — Individual notification card with unread dot, icon, timestamp, deep-link click-through
- `components/global/ActiveAlertCard.tsx` — Alert card with dismiss button, priority dot, fade-out animation

### Modified Components
- `components/global/NotificationBell.tsx` — Replaced dropdown with panel trigger, merged badge count (unread + alerts)

### New Hooks
- `lib/hooks/useNotifications.ts` — Fetches notifications with Realtime subscription, pagination, tab filtering, polling fallback
- `lib/hooks/useUnreadCount.ts` — Unread badge count with Realtime updates

### Modified Hooks
- `lib/hooks/useDashboardAlerts.ts` — Added `dismissAlert()` and `isDismissed()` with sessionStorage backing

### New DAL
- `lib/dal/notifications.ts` — `getNotifications()`, `getUnreadCount()`, `markAsRead()`, `markAllAsRead()`, `createNotification()`

### Edge Function Updates
- `supabase/functions/hl7v2-listener/import-service.ts` — Added notification creation after case processing
- `supabase/functions/hl7v2-listener/notification-helper.ts` — Helper to build notification title/message/metadata from SIU data
- `supabase/functions/run-data-quality-detection/index.ts` — Added notification creation when issues found, with dedup

### Test Files
- `components/global/__tests__/ActiveAlertCard.test.tsx`
- `components/global/__tests__/NotificationBell.test.tsx` (modified)
- `components/global/__tests__/NotificationCard.test.tsx`
- `lib/hooks/__tests__/useDashboardAlerts-dismissal.test.ts`
- `supabase/functions/hl7v2-listener/__tests__/notification-helper.test.ts`
- `supabase/functions/hl7v2-listener/__tests__/import-service-notifications.integration.test.ts`

## Architecture Decisions
- **Two-section panel** — Active Alerts (computed, ephemeral) at top + Notifications (persistent, DB) below. Merged badge count on bell icon.
- **DB function pipeline** — `create_notification_if_enabled()` checks `facility_notification_settings` before inserting. Called from edge functions (HL7v2 listener, DQ detection).
- **Consolidated table** — Dropped `data_quality_notifications`, consolidated into `notifications` with `type='data_quality_issue'` and JSONB metadata.
- **JSONB metadata** — Each notification stores flexible per-type data (link_to, case_id, patient_name, procedure_name, changes, etc.) rather than dedicated columns.
- **Nullable expires_at** — Persistent notifications have NULL expires_at. patient_call keeps existing 24hr expiry.
- **SessionStorage for alert dismissal** — Dismissed alerts reappear on page refresh or data refetch if the condition still exists.
- **Realtime with polling fallback** — Supabase Realtime for live updates, falls back to 30s polling if subscription fails.
- **One notification per DQ run** — Summary notification with issue count, not one per issue. Dedup within 1 hour.

## Database Changes

### Migrations
- `supabase/migrations/20260302200002_notification_center_schema.sql` — ALTER `notifications` (add category, metadata JSONB, make expires_at nullable), DROP `data_quality_notifications`, CREATE FUNCTION `create_notification_if_enabled()`, CREATE FUNCTION `clean_old_notifications()`, add indexes, seed new notification types
- `supabase/migrations/20260302200003_notification_cleanup_cron.sql` — Schedule `clean_old_notifications()` daily via pg_cron (with pg_net fallback)

### New DB Functions
- `create_notification_if_enabled(p_facility_id, p_type, p_title, p_message, p_category, p_metadata, p_case_id, p_sent_by)` — Checks facility settings before inserting notification
- `clean_old_notifications()` — Purges read (30 days) and unread (90 days) notifications, preserves patient_call

### New Indexes
- `notifications(facility_id, category)`
- `notifications(facility_id, created_at DESC)`
- `notification_reads(user_id, notification_id)`

### New Notification Types Seeded
- `case_auto_created`, `case_auto_updated`, `case_auto_cancelled`, `data_quality_issue`

## Known Limitations / Future Work
- **In-app only** — Push and email delivery channels are not yet implemented. Channel settings are respected (only `in_app`), but actual push/email sending is deferred.
- **Integration events + Data quality only** — Case lifecycle (case_started, case_completed, delay_recorded), schedule alerts, tray management, and reports notification types are not yet wired up.
- **Missing test coverage** — NotificationPanel.tsx, useNotifications.ts, useUnreadCount.ts, notifications.ts DAL, and DQ edge function notification logic lack unit tests. Integration flow tests (bell → panel → notifications → mark as read → badge update) and Realtime subscription lifecycle tests are also missing.
- **No batch operations** — Cannot select and delete/archive multiple notifications at once.
- **No notification preferences UI per user** — Settings are per-facility, not per-user. Individual user notification preferences are future work.
