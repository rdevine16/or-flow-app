# Project: Time-Off Push Notifications
**Completed:** 2026-03-15
**Branch:** feature/time-off-push-notifications
**Duration:** 2026-03-15 → 2026-03-15
**Total Phases:** 3

## What Was Built
APNs push notifications for the time-off workflow. When an admin approves or denies a time-off request on the web, the staff member receives a push notification on their iOS device. When staff submits a new request (from any client), facility admins and global admins receive a push notification via a DB trigger + pg_net.

The existing `send-push-notification` edge function (previously broadcast-only for patient calls) was extended to support three modes: targeted (specific user), role-based (all users with matching access levels in a facility), and broadcast (existing). Push delivery respects `facility_notification_settings` channel toggles.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Save edge function locally, add targeted push + facility scoping | dda56c6 |
| 2 | Seed push channel defaults, wire up review push notifications | 9d9d711 |
| 3 | Wire up new request push notification to admins via pg_net | 890da4f |
| fix | Suspense boundary + global_admin recipient parity | 072b955 |

## Key Files Created/Modified
- `supabase/functions/send-push-notification/index.ts` — edge function with 3 push modes (targeted, role-based, broadcast)
- `supabase/functions/send-push-notification/deno.json` — Deno config
- `app/api/time-off/notify/route.ts` — API route for review push (email + push delivery)
- `app/api/time-off/notify/__tests__/route.test.ts` — 21 unit tests for route logic
- `app/staff-management/page.tsx` — added Suspense boundary for useSearchParams
- `app/staff-management/PageClient.tsx` — passes staffUserId in notify payload
- `supabase/migrations/20260315100000_seed_push_channel_time_off.sql` — seed push channel defaults
- `supabase/migrations/20260315110000_update_time_off_link_to_tab.sql` — update notification deep links
- `supabase/migrations/20260315120000_time_off_request_push_trigger.sql` — pg_net push from DB trigger
- `supabase/migrations/20260315130000_fix_time_off_push_recipient_parity.sql` — global_admin parity fix

## Architecture Decisions
- **Review push (approval/denial → staff):** Sent from `/api/time-off/notify` API route, mirroring the existing email pattern (fire-and-forget from web client after review action)
- **New request push (submission → admins):** Sent from DB trigger via `pg_net.http_post()` so it fires regardless of which client (web or iOS) creates the request
- **Edge function modes:** `target_user_id` for targeted, `target_access_level` (string or array) for role-based, neither for broadcast. All modes scope device tokens by facility_id.
- **JWT verification disabled on edge function:** Called from pg_net (DB trigger) which cannot pass a JWT. The function uses service_role_key internally.

## Database Changes
- Migration `20260315100000_seed_push_channel_time_off.sql` — adds 'push' to channels array in facility_notification_settings and notification_settings_template for time-off types
- Migration `20260315110000_update_time_off_link_to_tab.sql` — updates link_to in notification triggers to use tab-aware URL
- Migration `20260315120000_time_off_request_push_trigger.sql` — updates `notify_time_off_requested()` trigger to call edge function via pg_net
- Migration `20260315130000_fix_time_off_push_recipient_parity.sql` — fixes recipient list to include both facility_admin and global_admin
- Edge function `send-push-notification` redeployed (v7+) with targeted + role-based push support

## Known Limitations / Future Work
- Edge function uses development APNs endpoint (`api.development.push.apple.com`) — must switch to production for App Store builds
- No integration tests for the trigger → pg_net → edge function chain (would require test harness for pg_net)
- No retry logic for failed push deliveries (fire-and-forget)
- Badge count is hardcoded to 1 — should sync with actual unread notification count
