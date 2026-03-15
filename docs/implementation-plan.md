# Implementation Plan: Time-Off Push Notifications

## Branch: `feature/time-off-push-notifications`

## Summary
Wire up APNs push notifications for the time-off workflow. When an admin approves/denies a request, the staff member receives a push notification on their iOS device. When staff submits a new request, facility admins receive a push notification. Respects existing `facility_notification_settings` push channel toggles.

## Interview Notes
- **Push scope:** Both broadcast (existing callers) and targeted (time-off) modes in edge function
- **APNs keys:** Already configured as Supabase secrets (edge function deployed, v6, active)
- **Notification scope:** All three — approval, denial, and new request submission
- **Settings:** Respect `facility_notification_settings` push channel toggle per notification type
- **Settings UI:** Push toggle already exists in both global admin and facility admin notification settings pages

## Current State
- `send-push-notification` edge function is **deployed** (v6) but **not saved locally** in repo
- Edge function supports broadcast only (`exclude_user_id`), no targeted push, no facility scoping on token queries
- In-app notifications for time-off already work (DB triggers: `notify_time_off_reviewed`, `notify_time_off_requested`)
- Email notifications for time-off review already work (fire-and-forget from `/api/time-off/notify`)
- `device_tokens` table exists with iOS tokens
- `pg_net` extension is enabled but unused
- Push channel option exists in notification settings UI (`CHANNEL_OPTIONS` includes `'push'`)

## Architecture
- **Review push (approval/denial → staff):** Extend existing `/api/time-off/notify` route (mirrors email pattern — fire-and-forget from web client after review)
- **New request push (submission → admins):** Use `pg_net` from DB trigger (fires regardless of which client creates the request)
- **Settings check:** Done in API route for review push; done in DB trigger for new request push

## Phase Overview

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Update edge function — targeted push + facility scoping | Medium |
| 2 | Seed push channel + wire up review push (web → staff) | Medium |
| 3 | Wire up new request push (DB trigger → admins via pg_net) | Medium |

---

## Phase 1: Update Edge Function — Targeted Push + Facility Scoping
**Complexity:** Medium
**Dependencies:** None

### What it does
Save the deployed edge function locally and update it to support:
1. `target_user_id` — send push to a specific user (for review → staff)
2. `target_access_level` — send push to all users with a specific role in the facility (for new request → admins)
3. `facility_id` scoping on device token queries (currently missing — sends to ALL tokens in DB)
4. Backward compatibility with existing broadcast callers (CallNextPatientModal, iOS patient calls)

### Updated PushPayload interface
```typescript
interface PushPayload {
  facility_id: string;            // Required — scopes device token query
  title: string;
  body: string;
  exclude_user_id?: string;       // Existing — for broadcast mode
  target_user_id?: string;        // NEW — send to specific user only
  target_access_level?: string;   // NEW — send to all users with this access_level
  data?: Record<string, string>;  // NEW — custom payload data (for deep linking)
}
```

### Query logic
- If `target_user_id` set → `SELECT token FROM device_tokens WHERE user_id = $1`
- If `target_access_level` set → `SELECT dt.token FROM device_tokens dt JOIN user_roles ur ON dt.user_id = ur.user_id WHERE ur.facility_id = $1 AND ur.access_level = $2`
- Otherwise (broadcast) → `SELECT dt.token FROM device_tokens dt JOIN user_roles ur ON dt.user_id = ur.user_id WHERE ur.facility_id = $1 AND dt.user_id != $2`

### Files touched
- `supabase/functions/send-push-notification/index.ts` (new locally — save + update)
- `supabase/functions/send-push-notification/deno.json` (new locally — save)

### Commit message
`feat(push): phase 1 - save edge function locally, add targeted push + facility scoping`

### 3-stage test gate
1. **Unit:** Edge function handles all three modes (targeted, role-based, broadcast) with correct token queries
2. **Integration:** Deploy to Supabase, verify existing patient call push still works (broadcast mode backward compat)
3. **Workflow:** Call edge function with `target_user_id` → only that user's device receives push

---

## Phase 2: Seed Push Channel + Wire Up Review Push (Web → Staff)
**Complexity:** Medium
**Dependencies:** Phase 1

### What it does
1. Migration to add `'push'` to channels array for time-off notification types in `facility_notification_settings` and `notification_settings_template`
2. Extend `/api/time-off/notify` route to also send push notification after review
3. Check `facility_notification_settings` for `'push'` in channels before calling edge function

### API route flow (after review)
```
Existing:
1. Check facility_notification_settings for notification_type
2. If 'email' in channels → send email via Resend

New (added after email):
3. If 'push' in channels → call send-push-notification edge function
   - target_user_id = staff member's user_id
   - title = "Time-Off Request Approved" (or "Denied")
   - body = "Your PTO request for Mar 10–14 has been approved by Dr. Smith"
```

### Files touched
- `supabase/migrations/YYYYMMDD_seed_push_channel_time_off.sql` (new — add push to channels)
- `app/api/time-off/notify/route.ts` (modify — add push delivery alongside email)

### Commit message
`feat(push): phase 2 - seed push channel defaults, wire up review push notifications`

### 3-stage test gate
1. **Unit:** API route correctly checks for push channel and constructs edge function payload
2. **Integration:** Migration applies cleanly, push channel appears in facility_notification_settings for time-off types
3. **Workflow:** Admin approves request on web → staff member receives push on iOS device

---

## Phase 3: Wire Up New Request Push (DB Trigger → Admins via pg_net)
**Complexity:** Medium
**Dependencies:** Phase 1

### What it does
1. Modify the `notify_time_off_requested()` DB trigger function to also send push to facility admins via `pg_net`
2. Check `facility_notification_settings` for push channel before sending
3. Call edge function with `target_access_level = 'facility_admin'`

### Trigger flow (after INSERT on time_off_requests)
```
Existing:
1. Create in-app notifications for each admin (unchanged)

New (added after in-app):
2. Check facility_notification_settings for 'time_off_requested' type
3. If 'push' in channels → call send-push-notification via pg_net:
   - facility_id = NEW.facility_id
   - target_access_level = 'facility_admin'
   - title = "New Time-Off Request"
   - body = "Jane Doe requested PTO for Mar 10–14"
```

### pg_net call
```sql
PERFORM net.http_post(
  url := '<supabase-url>/functions/v1/send-push-notification',
  body := jsonb_build_object(
    'facility_id', NEW.facility_id,
    'target_access_level', 'facility_admin',
    'title', 'New Time-Off Request',
    'body', format('%s requested %s for %s to %s', v_user_name, v_type_label, ...)
  )::text,
  headers := jsonb_build_object('Content-Type', 'application/json')
);
```

### Files touched
- `supabase/migrations/YYYYMMDD_time_off_request_push_trigger.sql` (new — update trigger function)

### Commit message
`feat(push): phase 3 - wire up new request push notification to admins via pg_net`

### 3-stage test gate
1. **Unit:** Trigger function correctly builds pg_net payload with facility scoping
2. **Integration:** Insert a time_off_request → verify pg_net queues the HTTP call to edge function
3. **Workflow:** Staff submits time-off request on iOS → facility admin receives push notification

---

## Dependency Graph
```
Phase 1 (edge function) ──► Phase 2 (review push - web → staff)
                         ──► Phase 3 (new request push - trigger → admins)
```
Phases 2 and 3 are independent of each other but both depend on Phase 1.

---

## Session Log
(empty — will be populated as phases are completed)
