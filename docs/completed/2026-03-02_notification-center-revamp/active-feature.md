# Feature: Notification Center Revamp

## Goal

Redesign the notification system from a disconnected set of unused tables and computed dashboard alerts into a unified, persistent notification center. Users see real notifications from integration events and data quality detection in a slide-out panel, with read/unread tracking, deep-link click-through, and Supabase Realtime for live updates. The existing settings infrastructure (13 notification types, per-facility toggles, channel selection) finally gets wired to an actual delivery pipeline.

The revamp includes:
1. **Schema evolution** — extend `notifications` table with metadata/category, consolidate `data_quality_notifications`, wire up `notification_reads`
2. **Notification creation pipeline** — DB function `create_notification_if_enabled()` that respects `facility_notification_settings`
3. **Slide-out notification panel** — replaces the current dropdown with a right-side panel (overlay with backdrop)
4. **Two-section layout** — "Active Alerts" (computed, ephemeral) at top + "Notifications" (persistent, from DB) below
5. **Integration event notifications** — created in the HL7v2 edge function for case auto-created/updated/cancelled
6. **Data quality notifications** — created in `run-data-quality-detection` edge function when new issues found
7. **Auto-cleanup** — scheduled purge of read notifications (30 days) and unread notifications (90 days)

---

## What Exists Today

### Database tables
- `notifications` — transient, 24hr expiry. Only used for "Call Next Patient" (`type: 'patient_call'`). Columns: id, facility_id, type, title, message, room_id, case_id, sent_by, expires_at, created_at
- `notification_reads` — per-user read tracking (notification_id + user_id + read_at). **Exists but unused in code**
- `data_quality_notifications` — legacy table with is_read boolean. Has `notify_facility_admins_of_issues()` function that's never called. **Unused — will be consolidated into `notifications`**
- `notification_settings_template` — global admin catalog of 13 notification types across 4 categories. Managed at `/admin/settings/notifications`
- `facility_notification_settings` — per-facility preferences: is_enabled, channels (push/in_app/email). Auto-seeded on facility creation. **Settings work but have no effect**

### UI components
- `NotificationBell.tsx` — bell icon in global header. Shows **computed dashboard alerts** (validation issues, missing milestones, behind schedule, stale cases) via `useDashboardAlerts()` hook. Does NOT read from `notifications` table
- `CallNextPatientModal.tsx` — the only component creating real `notifications` records (type: 'patient_call')
- Settings pages at `/settings/notifications` and `/admin/settings/notifications` — fully functional CRUD for toggling types and channels, but no delivery pipeline exists

### What's missing
1. No in-app notification center / slide-out panel
2. No read/unread tracking in UI (table exists, not wired)
3. No general-purpose notification creation pipeline (only patient_call works)
4. Bell icon shows ephemeral dashboard alerts, not persistent notifications
5. No click-through actions from notifications to relevant pages
6. 12 of 13 notification types in settings are never triggered
7. No Supabase Realtime subscription for notifications
8. No DAL functions for notification CRUD
9. `data_quality_notifications` table is orphaned

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Dashboard alerts vs. notifications | Keep both, separate sections | Active Alerts (computed, ephemeral) at top of panel + Notifications (persistent, DB) below. Merged badge count. |
| 2 | Retention model | Remove 24hr default expiry | Notifications persist until cleanup. Read: 30 days. Unread: 90 days. patient_call keeps existing behavior. |
| 3 | `data_quality_notifications` table | Consolidate into `notifications` | Use main `notifications` table with `type='data_quality_issue'`. Add JSONB metadata for extra fields. One table, one system. |
| 4 | Creation pipeline | DB function + edge functions | `create_notification_if_enabled()` DB function checks `facility_notification_settings`. Called from edge functions. |
| 5 | UI layout | Slide-out panel (right side) | Overlay with backdrop, like case drawer. More room than dropdown. |
| 6 | Initial scope | Integration events + Data quality | Defer case lifecycle, schedule alerts, tray management, reports to future phases. |
| 7 | Realtime | Supabase Realtime subscription | Subscribe to INSERT on `notifications` filtered by facility_id. Live updates. |
| 8 | Click-through | Deep links | Each notification type maps to a route. `link_to` stored in metadata or derived from type + entity IDs. |
| 9 | Schema extension | JSONB metadata column | Add `metadata JSONB` and `category TEXT` to `notifications`. Flexible per-type data without table bloat. |
| 10 | Panel style | Overlay with backdrop | Semi-transparent backdrop, click to close. Matches existing case drawer pattern. |
| 11 | HL7v2 notification source | In the HL7v2 edge function | Add notification creation directly after case processing. Explicit control, tightly scoped. |
| 12 | Filtering | Tabs: All / Unread | Simple toggle. Unread items have visual indicator (dot). |
| 13 | DQ notification source | `run-data-quality-detection` edge function | One notification per detection run summarizing issues found. |
| 14 | Alert dismissal | Dismissable until next detection | Users can dismiss an active alert; it reappears if the condition still exists on next data refresh. |
| 15 | Cleanup retention | 30 days read, 90 days unread | Read notifications cleaned 30 days after `read_at`. Unread cleaned 90 days after `created_at`. |

---

## Database Changes

### Altered Tables

#### `notifications` — Schema extension
```sql
-- New columns
category TEXT,                    -- Matches the 4 settings categories (Case Alerts, Schedule Alerts, etc.)
metadata JSONB DEFAULT '{}',      -- Flexible per-type data: { link_to, entity_id, severity, issues_count, ... }
-- Alter expires_at to be nullable (persistent notifications have NULL expires_at)
ALTER COLUMN expires_at DROP NOT NULL;
ALTER COLUMN expires_at DROP DEFAULT;
-- patient_call INSERT trigger keeps setting expires_at = now() + 24hr for backwards compat
```

#### `notification_reads` — Already correct schema
- No changes needed. Will be wired up in code.

### Dropped Tables
- `data_quality_notifications` — consolidated into `notifications` with `type='data_quality_issue'`

### New Functions

#### `create_notification_if_enabled()`
```sql
-- Called by edge functions to create a notification
-- Checks facility_notification_settings before inserting
-- Parameters: p_facility_id, p_type, p_title, p_message, p_category, p_metadata, p_case_id, p_sent_by
-- Returns: notification ID or NULL if type is disabled for facility
```

#### `clean_old_notifications()`
```sql
-- Called by scheduled job (pg_cron or edge function)
-- Deletes: read notifications where notification_reads.read_at < now() - 30 days
-- Deletes: unread notifications where created_at < now() - 90 days
-- Preserves: patient_call notifications (handled by existing expires_at cleanup)
```

### Indexes
- `notifications(facility_id, category)` — panel queries by category
- `notifications(facility_id, created_at DESC)` — chronological listing
- `notification_reads(user_id, notification_id)` — read state lookups

---

## UI Design

### Notification Bell (Updated)
- Badge count = unread persistent notifications + active alert count
- Click opens slide-out panel (replaces current dropdown)
- Bell position unchanged in header

### Slide-Out Notification Panel
```
┌─────────────────────────┬──────────────────────┐
│                         │ ╔════════════════════╗│
│                         │ ║ Notifications  ✕   ║│
│                         │ ╠════════════════════╣│
│                         │ ║ ACTIVE ALERTS (2)  ║│
│                         │ ║ ┌────────────────┐ ║│
│   Main Content          │ ║ │⚠ 5 cases flag… │ ║│
│   (dimmed backdrop)     │ ║ │⚠ 2 rooms beh…  │ ║│
│                         │ ║ └────────────────┘ ║│
│                         │ ║                    ║│
│                         │ ║ [All] [Unread]     ║│
│                         │ ║ ┌────────────────┐ ║│
│                         │ ║ │● Case created…  │ ║│
│                         │ ║ │  DQ issues de…  │ ║│
│                         │ ║ │  Case updated…  │ ║│
│                         │ ║ │  ...scroll      │ ║│
│                         │ ║ └────────────────┘ ║│
│                         │ ║ [Mark all read]    ║│
│                         │ ╚════════════════════╝│
└─────────────────────────┴──────────────────────┘
```

### Panel Sections

**Active Alerts (top section)**
- Computed by `useDashboardAlerts()` (existing logic, unchanged)
- Same 4 alert types: validation, missing_milestones, behind_schedule, stale_cases
- Each alert has a dismiss button (X) — dismisses until next data refresh
- Collapsed section header with count badge
- Deep-link click-through to relevant page

**Notifications (bottom section)**
- Persistent notifications from DB
- Tabs: All | Unread
- Each notification card shows: icon, title, message preview, timestamp, unread dot
- Click → navigate to deep link (derived from type + metadata)
- "Mark as read" on individual notifications (hover action)
- "Mark all read" button in footer
- Empty state when no notifications
- Infinite scroll or "Load more" pagination

### Notification Card
```
┌──────────────────────────────────────┐
│ ● 🔗 Case Auto-Created              │
│   Jane Doe — Total Knee Arthroplasty │
│   via Epic HL7v2 • 5 min ago     ✕  │
└──────────────────────────────────────┘
```
- Blue dot (●) = unread
- Icon based on notification type
- Title + message preview (2 lines max)
- Source badge + relative timestamp
- Click navigates to link_to URL

---

## Notification Types (Initial Scope)

### Integration Events (from HL7v2 edge function)
| Type | Trigger | Title Template | Link To |
|------|---------|----------------|---------|
| `case_auto_created` | S12 processed → case created | "Case Auto-Created: {patient} — {procedure}" | `/cases/{case_id}` |
| `case_auto_updated` | S13/S14 processed → case updated | "Case Updated via Epic: {patient} — {changes}" | `/cases/{case_id}` |
| `case_auto_cancelled` | S15/S16 processed → case cancelled | "Case Cancelled via Epic: {patient}" | `/cases/{case_id}` |

### Data Quality (from run-data-quality-detection edge function)
| Type | Trigger | Title Template | Link To |
|------|---------|----------------|---------|
| `data_quality_issue` | Detection run finds new issues | "Data Quality: {count} new issues detected" | `/data-quality` |

---

## Key Files

### Existing (to modify)
- `components/global/NotificationBell.tsx` — replace dropdown with slide-out panel trigger
- `lib/hooks/useDashboardAlerts.ts` — add dismissal state management
- `supabase/functions/hl7v2-listener/` — add notification creation after case processing
- `supabase/functions/run-data-quality-detection/` — add notification creation when issues found

### New
- `components/global/NotificationPanel.tsx` — slide-out panel component
- `components/global/NotificationCard.tsx` — individual notification card
- `lib/dal/notifications.ts` — DAL functions for notification CRUD and read tracking
- `lib/hooks/useNotifications.ts` — hook for fetching notifications with Realtime subscription
- `lib/hooks/useUnreadCount.ts` — hook for unread badge count with Realtime updates
- Migration: schema changes (alter notifications, drop data_quality_notifications, add functions)

### Unchanged
- `components/CallNextPatientModal.tsx` — continues working as-is (patient_call type)
- `app/settings/notifications/PageClient.tsx` — settings UI unchanged, now actually effective
- `app/admin/settings/notifications/PageClient.tsx` — admin template UI unchanged

---

## Scope Notes

- **In-app only.** Push and email delivery are future work. Channel settings are respected (only create notification if `in_app` is in channels array).
- **Integration events + Data quality only.** Case lifecycle (case_started, case_completed, delay_recorded), schedule alerts, tray management, and reports are deferred.
- **Call Next Patient unchanged.** The existing patient_call flow continues to work — the revamp is additive, not a rewrite.
- **HL7v2 coordination.** Integration notifications are created in the HL7v2 edge function. The revamp is designed to receive them — the edge function changes are part of this feature's scope.
- **Dashboard alerts preserved.** `useDashboardAlerts()` hook stays. Alerts are displayed in the "Active Alerts" section of the panel with dismissal support.

---

## Review Q&A

> Generated by pre-implementation interview on 2026-03-02

### Planning Interview

**Q1:** How should dashboard alerts relate to the new notification center?
**A1:** Keep both in separate sections. Active Alerts (computed, ephemeral) at top + Notifications (persistent, from DB) below. Merged badge count.

**Q2:** What retention model for persistent notifications?
**A2:** Remove 24hr default expiry. Notifications persist until cleanup. Read: cleaned after 30 days. Unread: cleaned after 90 days.

**Q3:** What to do with `data_quality_notifications` table?
**A3:** Consolidate into main `notifications` table. Use `type='data_quality_issue'` with JSONB metadata for issues_count etc.

**Q4:** How should the notification creation pipeline work?
**A4:** DB function `create_notification_if_enabled()` that checks `facility_notification_settings`. Called from edge functions.

**Q5:** UI layout for the notification center?
**A5:** Slide-out panel from the right side, overlay with semi-transparent backdrop. Like the existing case drawer pattern.

**Q6:** Which notification types to wire up initially?
**A6:** Integration events (case_auto_created, case_auto_updated, case_auto_cancelled) + Data quality. Defer case lifecycle, schedule alerts.

**Q7:** Realtime approach?
**A7:** Supabase Realtime subscription on `notifications` table filtered by facility_id. New notifications appear instantly.

**Q8:** Should notifications have click-through?
**A8:** Yes, deep links. Each type maps to a route. Link derived from type + metadata (case_id, etc.).

**Q9:** How to extend the notifications schema?
**A9:** Add `metadata JSONB` and `category TEXT` columns. Flexible per-type data without adding dedicated columns.

**Q10:** Panel overlay style?
**A10:** Overlay with backdrop (semi-transparent dimming). Click backdrop to close. Matches case drawer pattern.

**Q11:** Where should HL7v2 integration notifications be created?
**A11:** Directly in the HL7v2 edge function after case processing. More explicit than DB trigger approach.

**Q12:** Notification list filtering?
**A12:** Simple tabs: All | Unread. No category filtering in initial scope.

**Q13:** How should data quality become persistent notifications?
**A13:** Trigger from `run-data-quality-detection` edge function. One notification per run summarizing issues found.

**Q14:** Can users dismiss active alerts?
**A14:** Yes, dismissable until next detection run. Alert reappears if condition still exists on refresh.

**Q15:** Auto-cleanup retention periods?
**A15:** Read notifications: 30 days after read_at. Unread notifications: 90 days after created_at.
