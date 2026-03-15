# Implementation Plan: Global Announcement System

## Summary
Add a global announcement system to the Staff Management page. Facility admins create announcements that display as priority-colored banners at the top of every page and trigger push notifications to iOS devices. Features include audience targeting (staff/surgeons/both), priority levels, category tags, 1–7 day duration, scheduled send, per-user dismissal, full edit capability, and message history with filtering.

## Interview Notes
- **Banner stacking**: Stack vertically, highest priority first
- **Edit capability**: Fully editable while active (title, body, priority, duration, audience)
- **Audience mapping**: Role-based — Staff = non-Surgeon roles, Surgeons = Surgeon role, Both = all
- **Scheduled send**: pg_cron job runs every minute, flips scheduled→active, fires push via pg_net
- **Banner scope**: Every page (rendered in DashboardLayout)
- **Create UI**: Modal dialog (matches existing HolidayDialog pattern)

## Architecture Decisions
- **Separate `announcements` table** (not reusing `notifications`) — announcements have extra fields (audience, priority, category, duration, scheduled send) that don't fit the notification schema
- **Notification record created on activation** — bridges announcements into the existing NotificationPanel
- **`announcement_dismissals` table** — tracks per-user banner dismissals (separate from notification_reads)
- **pg_cron + pg_net** — proven pattern from time-off push triggers; cron activates scheduled announcements, trigger fires push

---

## Phase 1: Database Schema & Triggers
**Complexity:** Large

### What it does
Creates the `announcements` and `announcement_dismissals` tables with RLS, soft delete, indexes, and automated triggers. Seeds the notification settings template with an `announcements` category. Adds a pg_cron job to activate scheduled announcements and a pg_net trigger to fire push notifications on activation.

### Files touched
- `supabase/migrations/YYYYMMDD_announcements_schema.sql` (new)

### Schema
```sql
-- announcements table
-- announcement_dismissals table
-- RLS: all facility users can SELECT (filtered by audience/role), admins can INSERT/UPDATE
-- Soft delete trigger (sync_soft_delete_columns)
-- Index: facility_id + status + starts_at + expires_at
-- Index: facility_id + created_at DESC
-- Notification settings template: seed 'announcement' type in 'announcements' category
-- pg_cron: activate_scheduled_announcements() — every minute
-- DB trigger: on status change to 'active' → pg_net call to send-push-notification
-- DB trigger: auto-expire announcements (status → 'expired' when expires_at <= now())
```

### Commit message
`feat(announcements): phase 1 - database schema, RLS, cron activation, push trigger`

### Test gate
1. **Unit**: Verify tables exist, constraints work (invalid audience/priority rejected), RLS allows/blocks correct operations
2. **Integration**: Insert a scheduled announcement, verify cron flips it to active, verify pg_net fires push call
3. **Workflow**: Create announcement as admin → verify it's visible to facility users → verify push trigger fires

---

## Phase 2: DAL, Types & Hooks
**Complexity:** Medium

### What it does
Creates TypeScript interfaces, data access layer functions, and React hooks for announcements. Follows existing DAL patterns (notifications.ts, core.ts).

### Files touched
- `types/announcements.ts` (new)
- `lib/dal/announcements.ts` (new)
- `lib/dal/index.ts` (modify — add export)
- `hooks/useAnnouncements.ts` (new)

### DAL functions
- `createAnnouncement(supabase, params)` — insert + create notification record
- `updateAnnouncement(supabase, id, params)` — edit active/scheduled announcement
- `deactivateAnnouncement(supabase, id, userId)` — set status='deactivated'
- `listAnnouncements(supabase, facilityId, filters)` — paginated list for history table
- `getActiveAnnouncements(supabase, facilityId, userId)` — active announcements for banner (excludes dismissed)
- `dismissAnnouncement(supabase, announcementId, userId)` — insert dismissal record
- `deleteAnnouncement(supabase, id)` — soft delete (is_active=false)

### Hooks
- `useAnnouncements(facilityId, filters)` — history list for admin tab
- `useActiveAnnouncements(facilityId, userId)` — active banners for global display
- `useDismissAnnouncement()` — mutation hook for dismissal

### Commit message
`feat(announcements): phase 2 - DAL, TypeScript types, and React hooks`

### Test gate
1. **Unit**: DAL functions return correct types, handle errors gracefully, respect facility scoping
2. **Integration**: Create → list → getActive → dismiss → getActive (dismissed excluded)
3. **Workflow**: Hook returns data, refetches on dependency change, loading/error states work

---

## Phase 3: Announcements Tab + Create/Edit Dialog
**Complexity:** Large

### What it does
Adds an "Announcements" tab to the Staff Management page with a creation/edit modal dialog and a filterable history table. The dialog includes a live banner preview.

### Files touched
- `app/staff-management/PageClient.tsx` (modify — add tab)
- `components/staff-management/AnnouncementsTab.tsx` (new)
- `components/staff-management/CreateAnnouncementDialog.tsx` (new — used for both create and edit)
- `components/staff-management/AnnouncementHistoryTable.tsx` (new)

### UI details
- **Tab**: key='announcements', label='Announcements', icon=Megaphone
- **AnnouncementsTab**: "Create Announcement" button + stats summary + AnnouncementHistoryTable
- **CreateAnnouncementDialog**: Form fields (title, body, audience, priority, category, duration, schedule), live banner preview at bottom, reused for edit (pre-filled)
- **AnnouncementHistoryTable**: Sortable columns (title, sender, audience, priority, category, status, created, expires). Filters: status dropdown, priority dropdown, category dropdown. Search by title. Status badges (Scheduled=gray, Active=green, Expired=muted, Deactivated=red). Row actions: Edit (pencil), Deactivate (pause), Delete (trash, soft).

### Commit message
`feat(announcements): phase 3 - announcements tab, create/edit dialog, history table`

### Test gate
1. **Unit**: Dialog validates required fields, duration defaults to 1 day, schedule toggle works
2. **Integration**: Create announcement → appears in history table → edit → changes reflected → deactivate → status updates
3. **Workflow**: Admin opens tab → creates announcement → sees it in history → edits it → deactivates it

---

## Phase 4: Global Announcement Banner
**Complexity:** Medium

### What it does
Creates the AnnouncementBanner component and renders it in DashboardLayout on every authenticated page. Handles priority styling, expand/collapse, per-user dismissal, and vertical stacking.

### Files touched
- `components/global/AnnouncementBanner.tsx` (new)
- `components/layouts/DashboardLayout.tsx` (modify — render banner)

### UI details
- **Position**: After existing banners (BranchBanner, TrialBanner, ImpersonationBanner), before main content
- **Stacking**: Multiple banners stack vertically, sorted by priority (critical > warning > normal), then by created_at DESC
- **Priority styles**:
  - Normal: blue-50 bg, blue-600 text, blue-200 border, Info icon
  - Warning: amber-50 bg, amber-700 text, amber-200 border, AlertTriangle icon
  - Critical: red-50 bg, red-700 text, red-200 border, AlertOctagon icon
- **Layout**: Icon + category badge + title + time info | expand chevron + dismiss X
- **Expand**: Click chevron or title to expand body text below
- **Dismiss**: X button on Normal/Warning only. Critical has no dismiss. Calls dismissAnnouncement DAL.
- **Audience filtering**: Hook filters by user's role (surgeon vs non-surgeon) matching announcement audience
- **Realtime**: Supabase channel subscription on announcements table for live updates

### Commit message
`feat(announcements): phase 4 - global announcement banner in DashboardLayout`

### Test gate
1. **Unit**: Banner renders correct colors per priority, dismiss button hidden for Critical, body expands on click
2. **Integration**: Create announcement → banner appears → dismiss → banner hidden for that user, visible for others
3. **Workflow**: Admin creates Critical announcement → all users see red banner → cannot dismiss → admin deactivates → banner disappears for everyone

---

## Phase 5: Push Notification + Notification Panel Integration
**Complexity:** Medium

### What it does
Wires up push notifications via the existing edge function and integrates announcements into the NotificationPanel. Verifies end-to-end flow from creation through push delivery and notification display.

### Files touched
- `components/global/NotificationCard.tsx` (modify — add announcement type config)
- `components/global/NotificationPanel.tsx` (modify — if any announcement-specific rendering needed)
- `supabase/functions/send-push-notification/index.ts` (modify — if audience-based targeting needs adjustment)

### Integration details
- **Push notification**: Triggered by DB trigger (Phase 1) via pg_net when announcement status → 'active'
  - Audience='staff' → `target_access_level` excludes surgeon role
  - Audience='surgeons' → `target_access_level` = surgeon-related levels
  - Audience='both' → broadcast to all facility users (exclude creator)
- **Notification record**: Created by DAL on announcement creation (Phase 2), category='announcements'
- **NotificationCard**: Add `announcement_created` type with Megaphone icon, priority-based color
- **Deep link**: `metadata.link_to = '/staff-management?tab=announcements'`

### Commit message
`feat(announcements): phase 5 - push notification trigger, notification panel integration`

### Test gate
1. **Unit**: NotificationCard renders announcement type correctly with Megaphone icon
2. **Integration**: Create announcement → notification appears in panel → push edge function called with correct audience payload
3. **Workflow**: Admin creates announcement for surgeons → surgeon sees push on iOS + notification in panel + banner on web → staff user does NOT see it

---

## Dependencies
```
Phase 1 (DB) → Phase 2 (DAL) → Phase 3 (Tab UI)
                              → Phase 4 (Banner)
                              → Phase 5 (Push + Panel)
```
Phases 3, 4, 5 can theoretically run in parallel after Phase 2, but sequential execution is recommended for clean commits and testing.
