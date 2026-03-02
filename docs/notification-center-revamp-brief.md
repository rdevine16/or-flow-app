# Feature Brief: Notification Center Revamp

> Hand this to a new Claude Code session and run `/audit` to generate the full feature spec and implementation plan.

## What exists today

### Database tables (already created)
- `notifications` — transient notifications with 24hr expiry. Only used for "Call Next Patient". Columns: id, facility_id, type, title, message, room_id, case_id, sent_by, expires_at, created_at
- `notification_reads` — per-user read tracking (notification_id + user_id + read_at). Table exists but is **unused in code**
- `data_quality_notifications` — legacy table with is_read boolean. Has a `notify_facility_admins_of_issues()` function that's never called. **Unused**
- `notification_settings_template` — global admin catalog of 13 notification types across 4 categories (Case Alerts, Schedule Alerts, Tray Management, Reports & Summaries). Managed at `/admin/settings/notifications`
- `facility_notification_settings` — per-facility preferences: is_enabled, channels (push/in_app/email). Auto-seeded on facility creation. Managed at `/settings/notifications`. **Settings work but have no effect — notifications are never created for most types**

### UI components
- `NotificationBell.tsx` — bell icon in global header. Shows **calculated dashboard alerts** (validation issues, missing milestones, behind schedule, stale cases) via `useDashboardAlerts()` hook. Does NOT read from the `notifications` table
- `CallNextPatientModal.tsx` — the only component that creates real `notifications` records (type: 'patient_call'). Shows recent calls from last 30 min
- Settings pages at `/settings/notifications` and `/admin/settings/notifications` — fully functional CRUD for toggling types and channels, but the actual notification delivery doesn't exist

### What's missing
1. No in-app notification center / dropdown panel
2. No read/unread tracking in UI (table exists, not wired)
3. No general-purpose notification creation pipeline (only patient_call works)
4. No push notification delivery (edge function `send-push-notification` is invoked but doesn't exist)
5. No email notification delivery
6. Bell icon shows ephemeral dashboard alerts, not persistent notifications
7. No click-through actions from notifications to relevant pages
8. The 12 non-call notification types in settings are never triggered

## What we want

### Notification center (the bell icon area)
- Redesign the bell icon dropdown as a proper notification center
- Show persistent notifications with read/unread state
- Unread count badge on the bell
- Click a notification → navigate to the relevant page (case detail, integration settings, DQ page, etc.)
- "Mark as read" / "Mark all read" actions
- Notification list with infinite scroll or pagination
- Empty state when no notifications

### Notification creation pipeline
- Centralized function/service that creates notifications based on type
- Respects facility_notification_settings (only create if type is enabled for that facility)
- Respects channel settings (in_app, push, email) — start with in_app only, push/email can be future phases
- Sources that should create notifications:
  - **Integration events**: case auto-created, case auto-updated, case auto-cancelled from HL7v2 (these are being added as part of the current HL7v2 feature)
  - **Data quality**: validation issues detected (replace the current dashboard alert approach, or keep both)
  - **Schedule alerts**: first case reminder, case running long, turnover alert
  - **Case lifecycle**: case started, case completed, delay recorded
  - **The existing patient_call** should continue to work as-is

### Notification settings integration
- The existing settings pages already work — just need the delivery pipeline to respect them
- When a notification type is disabled for a facility, don't create notifications of that type
- Channel selection (in_app/push/email) determines delivery method

## Architecture considerations
- The `notifications` table currently has a 24hr expiry. Persistent notifications may need a different retention model or a schema tweak
- `notification_reads` tracks per-user read state — this is the right pattern for in_app notifications
- Consider whether to keep `data_quality_notifications` as a separate table or consolidate into `notifications`
- The bell icon currently mixes two concepts (calculated alerts + notifications). Decide whether to keep dashboard alerts separate or fold them into the notification system
- RLS is already set up on all notification tables (facility-scoped)

## Key files to reference
- `components/global/NotificationBell.tsx` — current bell icon implementation
- `lib/hooks/useDashboardAlerts.ts` — current alert calculation logic
- `components/CallNextPatientModal.tsx` — only working notification creator
- `app/settings/notifications/PageClient.tsx` — facility notification preferences
- `app/admin/settings/notifications/PageClient.tsx` — global notification template management
- Migrations: `20260101000000_baseline.sql` (notifications, notification_reads, data_quality_notifications), `20260221100000_global_admin_settings_templates.sql` (notification_settings_template, facility_notification_settings)

## Scope notes
- Start with in-app notifications only (push and email are future)
- Integration notifications (HL7v2 case events) are being added separately in the current feature branch — the revamp should be designed to receive them
- The "Call Next Patient" flow should continue to work — don't break it during the revamp
