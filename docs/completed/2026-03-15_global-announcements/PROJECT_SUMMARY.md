# Project: Global Announcement System
**Completed:** 2026-03-15
**Branch:** feature/global-announcements
**Duration:** 2026-03-15 → 2026-03-15
**Total Phases:** 5

## What Was Built
A global announcement system for the ORbit platform that allows facility admins to create announcements from the Staff Management page. Announcements display as priority-colored banners (blue/amber/red) at the top of every page via DashboardLayout, and trigger push notifications to targeted iOS devices via the existing APNs edge function.

The system supports audience targeting (staff/surgeons/both), three priority levels (normal/warning/critical), four category tags, configurable 1-7 day duration, scheduled send via pg_cron, per-user dismissal (normal/warning only — critical is non-dismissible), full edit capability while active, and a filterable/searchable message history table.

Announcements are bridged into the existing notification system — each active announcement creates a notification record that appears in the NotificationPanel alongside other notifications.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Database schema, RLS, cron activation, push trigger | 65995f1 |
| 2     | DAL, TypeScript types, and React hooks | abb3d39 |
| 3     | Announcements tab, create/edit dialog, history table | bddae01 |
| 4     | Global announcement banner in DashboardLayout | e1c2427 |
| 5     | Push notification trigger, notification panel integration | ad3a2c8 |
| fix   | Fix banner audience filter and push 401 | a7c9274 |

## Key Files Created/Modified

### New Files
- `types/announcements.ts` — TypeScript interfaces for announcements, dismissals, filters
- `lib/dal/announcements.ts` — Data access layer (CRUD, filtering, dismissals, soft delete)
- `hooks/useAnnouncements.ts` — React hooks (useAnnouncements, useActiveAnnouncements, useDismissAnnouncement)
- `components/staff-management/AnnouncementsTab.tsx` — Tab container with stats and create button
- `components/staff-management/CreateAnnouncementDialog.tsx` — Create/edit dialog with live banner preview
- `components/staff-management/AnnouncementHistoryTable.tsx` — Filterable, sortable history table
- `components/global/AnnouncementBanner.tsx` — Global banner with priority styling, expand/collapse, dismiss

### Modified Files
- `app/staff-management/PageClient.tsx` — Added Announcements tab
- `components/layouts/DashboardLayout.tsx` — Renders AnnouncementBanner below existing banners
- `components/global/NotificationCard.tsx` — Added announcement_created type with Megaphone icon
- `supabase/functions/send-push-notification/index.ts` — Added audience-based role targeting

### Migration
- `supabase/migrations/20260315_announcements_schema.sql`

### Tests (9 test files, 150+ tests)
- `lib/dal/__tests__/announcements.test.ts` — 48 tests
- `hooks/__tests__/useAnnouncements.test.tsx` — 24 tests
- `components/staff-management/__tests__/AnnouncementHistoryTable.test.tsx` — 26 tests
- `components/staff-management/__tests__/CreateAnnouncementDialog.test.tsx` — 20 tests
- `components/staff-management/__tests__/AnnouncementsTab.test.tsx` — 6 tests
- `components/global/__tests__/NotificationCard.announcement.test.tsx` — 2 tests
- `components/global/__tests__/NotificationPanel.integration.test.tsx` — 4 tests
- `supabase/functions/send-push-notification/__tests__/role-targeting.test.ts`
- `supabase/migrations/__tests__/announcements-push-trigger.test.ts` — 20 tests

## Architecture Decisions
- **Separate `announcements` table** rather than reusing `notifications` — announcements have unique fields (audience, priority, category, duration, scheduled send) that don't fit the notification schema
- **Bridge to notifications** — each active announcement creates a notification record so it appears in the existing NotificationPanel
- **`announcement_dismissals` table** — separate from notification_reads because dismissal semantics differ (hides banner but notification persists)
- **pg_cron + pg_net** — reused the proven pattern from time-off push triggers; cron activates scheduled announcements every minute, DB trigger fires push via pg_net on status change to 'active'
- **Audience filtering via role check** — Staff = non-Surgeon roles, Surgeons = Surgeon role, Both = all. Implemented in both the banner hook (client-side filter) and push edge function (server-side targeting)
- **Critical announcements non-dismissible** — design decision to ensure safety alerts are always visible

## Database Changes
- **New table:** `announcements` — stores announcement content, audience, priority, category, status, scheduling, soft delete
- **New table:** `announcement_dismissals` — tracks per-user banner dismissals (unique constraint on announcement_id + user_id)
- **RLS policies:** Facility users can SELECT (audience-filtered), admins can INSERT/UPDATE, users can INSERT own dismissals
- **Indexes:** `idx_announcements_facility_active` (facility_id, status, starts_at, expires_at), `idx_announcements_facility_created` (facility_id, created_at DESC)
- **pg_cron job:** `activate_scheduled_announcements` — runs every minute, flips scheduled→active when starts_at <= now()
- **DB trigger:** On status change to 'active' → pg_net POST to send-push-notification edge function
- **DB trigger:** Auto-expire announcements when expires_at <= now()
- **Notification settings seed:** Added 'announcement' type in 'announcements' category
- **Migration file:** `supabase/migrations/20260315_announcements_schema.sql`

## Known Limitations / Future Work
- **AnnouncementBanner.tsx lacks isolated unit tests** — tested via integration only. Missing: expand/collapse, priority styling, dismissal flow, Realtime subscription tests
- **No end-to-end workflow tests** for: create→push→notification chain, scheduled auto-activation, dismissal persistence across navigation, Realtime live updates, role-based audience targeting verification
- **Out of scope (deferred):** Multi-facility broadcasting, rich text/markdown body, file attachments, announcement templates/drafts, email delivery, web push notifications, announcement analytics (open/dismiss rates)
