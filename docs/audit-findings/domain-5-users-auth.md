# AUDIT DOMAIN 5: Users, Permissions & Authentication

**Date:** 2026-02-24
**Scope:** Invite to Access to Enforcement — full user lifecycle trace
**Status:** Complete

---

## Executive Summary

The user authentication and permission system has a **solid architectural foundation** — Supabase Auth with httpOnly cookies, RLS on all tables, audit logging, and a database-driven permission model. However, the audit uncovered **8 critical bugs** and **significant enforcement gaps** that collectively undermine the security posture:

1. **Invite creation is broken** — API writes to non-existent `invites` table (should be `user_invites`)
2. **Device rep signup is broken** — API inserts non-existent column, RLS references wrong table
3. **Permission enforcement is UI-only** — `user_has_permission()` exists in DB but is used by zero RLS policies
4. **Rate limiting is broken in production** — in-memory storage won't work on Vercel serverless
5. **Session manager code is dead** — extensive session tracking exists but is never called
6. **Impersonation has no write restrictions** — admins can make destructive changes while impersonating
7. **Audit log is not immutable** — no UPDATE/DELETE deny policies
8. **No force-expire mechanism** — no way to revoke all sessions for a compromised user

---

## Severity Tally

| Severity | Count |
|----------|-------|
| CRITICAL BUG | 8 |
| CONCERN | 18 |
| MISSING | 22 |
| GOOD | 28 |

---

## A. User Invitation Flow

### How It Works (Intended)
1. Facility admin opens InviteUserModal, fills email/name/role/access_level
2. POST to `/api/admin/invite` creates invite record, sends email via Resend
3. User clicks link → `/invite/user/[token]` validates token, shows signup form
4. POST to `/api/invite/accept` creates Supabase Auth user + `users` table row
5. Invite marked as accepted (`accepted_at = now()`)

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| A1 | CRITICAL BUG | `/api/admin/invite` INSERTs into non-existent `invites` table. DB only has `user_invites`. **Invite creation always fails.** | `app/api/admin/invite/route.ts:60-71` |
| A2 | CRITICAL BUG | `/api/resend-invite` also references non-existent `invites` table. **Resend is broken.** | `app/api/resend-invite/route.ts:20-24` |
| A3 | CONCERN | Profile creation failure is silently swallowed — user could have auth account but no `users` row | `app/api/invite/accept/route.ts:146-150` |
| A4 | CONCERN | No token rotation on resend — if original email was intercepted, resend doesn't help | `app/api/resend-invite/route.ts:21` |
| A5 | MISSING | No rate limiting on invite creation — admin could spam unlimited invites | `app/api/admin/invite/route.ts` |
| A6 | MISSING | No cleanup of expired invites (no cron job or trigger) | — |
| A7 | MISSING | No audit trail on invite acceptance (IP, user-agent) | — |
| A8 | GOOD | Acceptance flow correctly uses `user_invites` table | `app/api/invite/accept/route.ts:54-64` |
| A9 | GOOD | Token validated: not expired + not already used | `app/invite/user/[token]/page.tsx:68-83` |
| A10 | GOOD | Service role key used to bypass email confirmation (appropriate for invite flow) | `app/api/invite/accept/route.ts:104-112` |
| A11 | GOOD | Access level comes from invite record, not user input (prevents privilege escalation) | `app/api/invite/accept/route.ts:142-143` |
| A12 | GOOD | RLS restricts invite creation to admins | `baseline.sql:9608` |
| A13 | GOOD | Professional, role-aware email templates via Resend | `lib/email.ts:159-345` |

### Fix Priority
- **P0:** Fix table name in `/api/admin/invite` and `/api/resend-invite` (`invites` → `user_invites`)
- **P1:** Add rate limiting (10 invites/hour per admin)
- **P1:** Rotate token on resend
- **P2:** Make profile creation failure throw error (don't silent-fail)
- **P3:** Add expired invite cleanup cron

---

## B. Device Rep Signup

### How It Works (Intended)
1. Facility admin creates invite in `/settings/device-reps` → stored in `device_rep_invites`
2. Rep clicks link → `/invite/accept/[token]` or `/auth/rep-signup`
3. POST to `/api/create-device-rep` creates auth user + profile with `access_level = 'device_rep'`
4. Rep can view cases at facilities where they have access, filtered by their `implant_company_id`

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| B1 | CRITICAL BUG | **Two tables serve same purpose:** `device_rep_facility_access` (used by RLS) and `facility_device_reps` (used by app code). **Never synced.** | `baseline.sql:4943-4948`, `baseline.sql:5058-5068` |
| B2 | CRITICAL BUG | API inserts `implant_company_id` into `facility_device_reps` — **column does not exist**. Signup always fails. | `app/api/create-device-rep/route.ts:81-89` |
| B3 | CRITICAL BUG | Cases RLS policy references `device_rep_facility_access` but app writes to `facility_device_reps`. Even if B2 fixed, **device reps can't see cases.** | `baseline.sql:9533-9537` |
| B4 | CONCERN | Status field mismatch: API sets `status: 'active'` but constraint only allows `pending/accepted/revoked` | `app/api/create-device-rep/route.ts` |
| B5 | MISSING | No cleanup of expired device rep invites | — |
| B6 | GOOD | Secure token generation via `crypto.randomUUID()` (122 bits entropy) | `app/settings/device-reps/page.tsx:191` |
| B7 | GOOD | Token validated: not expired + not already used | `app/auth/rep-signup/page.tsx:47-85` |
| B8 | GOOD | Device reps intentionally have NULL `facility_id` (multi-facility by design) | `baseline.sql:1061-1078` |
| B9 | GOOD | RLS properly restricts device reps to cases with their company's implants | `baseline.sql:9533-9537` (correct policy logic, wrong table reference) |

### Fix Priority
- **P0:** Consolidate to ONE table (recommend keeping `device_rep_facility_access`, dropping `facility_device_reps`, or creating a migration to sync them)
- **P0:** Fix column reference in `/api/create-device-rep`
- **P0:** Fix status constraint mismatch
- **P2:** Add expired invite cleanup

---

## C. User Management

### How It Works
- Facility admins manage users at `/settings/users` (910-line page)
- Operations: edit (name, email, role, access_level), deactivate (soft delete), reactivate, resend invite
- Deactivation sets `is_active = false`, `deleted_at`, `deleted_by`

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| C1 | CRITICAL BUG | **No session revocation on deactivation.** Deactivated users remain logged in until session naturally expires. Should call `supabase.auth.admin.signOut(userId)`. | `app/settings/users/page.tsx:391-419` |
| C2 | CONCERN | Self-demotion prevented by UI only (`disabled={editingUser.id === currentUserId}`), no DB constraint. API call could bypass. | `app/settings/users/page.tsx:853` |
| C3 | CONCERN | Facility admins can promote other users to `facility_admin` with no confirmation dialog — significant privilege escalation | `app/settings/users/page.tsx:857` |
| C4 | CONCERN | Deactivated surgeons remain assigned to historical cases. Analytics queries may not filter `is_active = true` on users. | `lib/dal/users.ts:149` |
| C5 | CONCERN | Deactivation confirmation is inline 2-click pattern, not a proper modal with impact warning | `app/settings/users/page.tsx:681-695` |
| C6 | GOOD | Double self-removal protection (UI hides button + handler-level `if (id === currentUserId) return`) | `app/settings/users/page.tsx:392, 738-746` |
| C7 | GOOD | Full audit trail: `userAudit.updated()`, `.deactivated()`, `.reactivated()` with before/after values | `app/settings/users/page.tsx:344-351, 412, 439` |
| C8 | GOOD | Soft delete pattern with `deleted_by` attribution | `baseline.sql:4423, 4429-4430` |
| C9 | GOOD | RLS enforces facility scoping — facility admins can only modify users in their own facility | `baseline.sql:9966` |
| C10 | GOOD | `listSurgeons()` correctly filters `is_active = true` for dropdowns | `lib/dal/users.ts:129-153` |

### Fix Priority
- **P0:** Add `supabase.auth.admin.signOut(userId)` to deactivation handler
- **P1:** Add DB-level constraint preventing self-demotion (or RPC with validation)
- **P2:** Add confirmation modal for privilege escalation to facility_admin
- **P2:** Add `is_active = true` filter to analytics RPCs that aggregate by surgeon
- **P3:** Show impact summary in deactivation dialog (active sessions, assigned cases)

---

## D. Permission System

### How It Works
- 41 permission keys in `permissions` table (7 categories: Cases, Financials, Analytics, etc.)
- Three-tier model: `permission_templates` (global defaults) → `facility_permissions` (per-facility overrides) → resolution
- `get_user_permissions(p_user_id)` RPC returns JSONB map of key → boolean
- `facility_admin` and `global_admin` always get all permissions (hardcoded bypass)
- Frontend: `usePermissions` hook → `can()`, `canAny()`, `canAll()` checks
- Admin pages for managing templates and facility-level permissions

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| D1 | CRITICAL BUG | **`user_has_permission()` function exists but is used by ZERO RLS policies.** All 338 RLS policies use role-based checks only. Users can bypass UI and query Supabase directly. | `20260215000000_permissions_system.sql:358-383` |
| D2 | CONCERN | `PermissionGuard` component exists but is NOT USED in any page — all checks are inline `can()` | `components/permissions/PermissionGuard.tsx` |
| D3 | CONCERN | No permission enforcement in middleware.ts (auth-only, not authz) | `middleware.ts` |
| D4 | CONCERN | API routes (demo data, admin scan, invite) have no permission checks — only auth | Various API routes |
| D5 | CONCERN | Permission keys are plain strings — typos won't be caught at compile time | `lib/hooks/usePermissions.ts` |
| D6 | CONCERN | No real-time updates — permission changes require page reload | — |
| D7 | MISSING | No RLS integration with permission system (explicitly deferred per PROJECT_SUMMARY.md:73) | — |
| D8 | MISSING | No permission audit log (who changed what permissions when) | — |
| D9 | MISSING | No server-side permission enforcement in API routes | — |
| D10 | GOOD | Clean 3-tier architecture: template → facility → resolution | `20260215000000_permissions_system.sql:320-356` |
| D11 | GOOD | Dynamic system — adding DB row auto-appears in UI, no code changes needed | — |
| D12 | GOOD | Comprehensive coverage: 41 keys across 7 categories | `20260215000000_permissions_system.sql:119-176` |
| D13 | GOOD | Admin bypass works correctly at both RPC and hook level | `usePermissions.ts:54-59` |
| D14 | GOOD | Auto-save UX with sync detection for new permissions | `app/admin/permission-templates/page.tsx` |
| D15 | GOOD | Navigation items support optional `permission` field for sidebar filtering | `components/layouts/navigation-config.tsx` |

### Fix Priority
- **P0:** Add `user_has_permission()` checks to RLS policies on sensitive tables (cases financials, analytics)
- **P1:** Add server-side permission checks to API routes (especially demo data, admin operations)
- **P2:** Use `PermissionGuard` consistently or document inline `can()` as the standard pattern
- **P3:** Generate TypeScript types for permission keys from DB for compile-time safety

---

## E. Authentication & Session Management

### How It Works
- Supabase Auth with `@supabase/ssr` — tokens in httpOnly cookies
- `middleware.ts` calls `supabase.auth.getUser()` on every request (triggers refresh if needed)
- Public routes: `/auth/*`, `/invite/*`, `/login`, `/status/*`
- `lib/session-manager.ts` has extensive session tracking code (but is largely unused)
- `lib/rate-limiter.ts` has in-memory rate limiting integrated into login flow

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| E1 | CRITICAL BUG | **Rate limiter uses in-memory Map** — resets on every Vercel cold start, won't work across serverless instances. DB-based functions exist (`checkRateLimitDB`) but are NOT used. | `lib/rate-limiter.ts:28-29, 254-349` |
| E2 | CRITICAL BUG | **IP-based rate limiting broken** — login page passes hardcoded `'web-client'` string instead of real IP. All users share one rate limit bucket. | `app/login/page.tsx:71` |
| E3 | BUG | **`signInWithSession()` doesn't actually set custom session duration** — Supabase `setSession()` doesn't accept `expiresIn` parameter. "Remember me" is cosmetic. | `lib/session-manager.ts:52-59` |
| E4 | BUG | **`recordSession()` never called** — `user_sessions` table exists but is never populated during login | `lib/session-manager.ts:72-93` |
| E5 | CONCERN | No session revocation on password change — old sessions remain valid | — |
| E6 | CONCERN | No periodic revalidation in UserContext — deactivated users stay logged in until page reload | `lib/UserContext.tsx:92-141` |
| E7 | CONCERN | No CSRF protection beyond default SameSite cookie attribute | — |
| E8 | CONCERN | No role-based authorization in middleware (only checks if user exists) | `middleware.ts:83-111` |
| E9 | MISSING | MFA/2FA — no multi-factor authentication | — |
| E10 | MISSING | Concurrent session limits — no max sessions per user | — |
| E11 | MISSING | Password history — no prevention of reusing recent passwords | — |
| E12 | MISSING | Account lockout — rate limiter blocks temporarily but doesn't permanently lock after X attempts | — |
| E13 | MISSING | Session activity tracking — `updateSessionActivity()` exists but never called | `lib/session-manager.ts:197-211` |
| E14 | GOOD | Tokens stored in httpOnly cookies via Supabase SSR (not localStorage) | `lib/supabase.ts`, `middleware.ts:54-67` |
| E15 | GOOD | Comprehensive password strength validator with scoring system | `lib/passwords.ts:149-203` |
| E16 | GOOD | Rate limiting integrated into login UI with countdown timer | `app/login/page.tsx:64-89` |
| E17 | GOOD | Active user status checked on login | `lib/auth-helpers.ts:27-47` |
| E18 | GOOD | Deactivation immediately signs user out (when detected) | `app/login/page.tsx:137` |
| E19 | GOOD | Clear public/private route separation in middleware | `middleware.ts:10-33` |
| E20 | GOOD | Password reset requires strong passwords with visual feedback | `app/auth/reset-password/page.tsx:69-72` |
| E21 | GOOD | Proper auth callback flow with token_hash and code verification | `app/auth/callback/route.ts:20-41` |

### Fix Priority
- **P0:** Switch rate limiter to DB-based (`checkRateLimitDB`) or Redis for distributed state
- **P0:** Fix IP tracking — pass real client IP from request headers, not hardcoded string
- **P1:** Either integrate session-manager.ts into login flow OR remove dead code to avoid confusion
- **P1:** Add session revocation on password change
- **P2:** Add periodic user revalidation in UserContext (every 5 min check `is_active`)
- **P3:** Implement MFA (Supabase supports TOTP natively)

---

## F. Impersonation System

### How It Works
- Global admins can "view as" any facility from `/admin/facilities`
- Creates `admin_sessions` record, stores state in localStorage
- `ImpersonationBanner` (amber gradient) shown at top of all pages
- Exit button ends session, clears localStorage, updates DB

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| F1 | CRITICAL BUG | **No write restrictions during impersonation.** Admin can delete users, modify financials, purge data while impersonating. | `lib/impersonation.ts` |
| F2 | CONCERN | `verifyImpersonationSession()` exists but is **never called** in any API route | `lib/impersonation.ts` |
| F3 | CONCERN | Impersonation state relies solely on localStorage — no server-side verification | `lib/impersonation.ts:56` |
| F4 | CONCERN | Abandoned sessions (browser close without clicking Exit) remain `is_active = true` forever | — |
| F5 | CONCERN | If DB update fails on exit, localStorage still clears — creates audit gap | `lib/impersonation.ts` |
| F6 | MISSING | No read-only mode or restricted permissions during impersonation | — |
| F7 | MISSING | No server-side session timeout for abandoned impersonation sessions | — |
| F8 | GOOD | Only `global_admin` can impersonate (RLS enforced on `admin_sessions`) | `baseline.sql:10353` |
| F9 | GOOD | Impersonation logged to audit trail with `impersonating_user_id` and `impersonating_user_email` | `lib/audit.ts:95-97` |
| F10 | GOOD | Prominent amber banner with facility name clearly indicates impersonation mode | `components/layouts/Header.tsx:304-327` |

### Fix Priority
- **P1:** Add `verifyImpersonationSession()` middleware to API routes that perform writes
- **P1:** Consider read-only mode for impersonation (or at minimum, require confirmation for destructive actions)
- **P2:** Add server-side timeout for abandoned sessions (e.g., auto-expire after 4 hours)
- **P3:** Add pg_cron job to clean up stale `is_active = true` admin_sessions

---

## G. DB Architecture Review

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| G1 | CRITICAL BUG | **audit_log is NOT immutable.** RLS enabled but no UPDATE/DELETE deny policies. Authenticated users could potentially modify audit records. | `baseline.sql:11209, 9329-10607` |
| G2 | MISSING | No function to force-expire all sessions for a user (critical for compromised accounts) | — |
| G3 | MISSING | No RLS policies on `login_attempts` table (information disclosure risk) | — |
| G4 | MISSING | No automatic scheduling for `cleanup_expired_sessions()` and `cleanup_old_login_attempts()` — relies on manual invocation | `baseline.sql:647-697` |
| G5 | MISSING | No `revoked_at` / `revoked_by` columns on `user_sessions` for revocation tracking | — |
| G6 | GOOD | `user_sessions` properly indexed: `idx_user_sessions_expires_at`, `idx_user_sessions_user_id` | `baseline.sql:7821, 7826` |
| G7 | GOOD | `admin_sessions` has partial index on active sessions | `baseline.sql:6951` |
| G8 | GOOD | `login_attempts` properly indexed: email, IP, blocked_until | `baseline.sql:7491-7501` |
| G9 | GOOD | Unique constraint on `users.email` prevents duplicate registrations | `baseline.sql:6940` |
| G10 | GOOD | Global admins intentionally have NULL `facility_id` — RLS policies handle this explicitly | — |
| G11 | GOOD | Cleanup functions exist for both sessions and login_attempts (just need scheduling) | `baseline.sql:644-697` |

### Fix Priority
- **P0:** Add explicit UPDATE/DELETE deny policies on `audit_log`
- **P0:** Create `force_expire_user_sessions(user_id UUID)` function
- **P1:** Add RLS policies to `login_attempts` table
- **P2:** Schedule cleanup functions via pg_cron or external scheduler
- **P3:** Add revocation tracking columns to `user_sessions`

---

## Consolidated Fix Priorities

### P0 — Blocking / Security Critical

| # | Fix | Domain |
|---|-----|--------|
| 1 | Fix `/api/admin/invite` to use `user_invites` table (not `invites`) | A |
| 2 | Fix `/api/resend-invite` to use `user_invites` table | A |
| 3 | Consolidate device rep tables (pick ONE of `device_rep_facility_access` / `facility_device_reps`) | B |
| 4 | Fix `/api/create-device-rep` column reference + status constraint | B |
| 5 | Add `supabase.auth.admin.signOut(userId)` to user deactivation | C |
| 6 | Add `user_has_permission()` to RLS policies on sensitive tables | D |
| 7 | Switch rate limiter to DB-based (`checkRateLimitDB`) | E |
| 8 | Fix IP tracking in login — use real client IP, not hardcoded string | E |
| 9 | Add UPDATE/DELETE deny policies on `audit_log` | G |
| 10 | Create `force_expire_user_sessions()` function | G |

### P1 — High Priority

| # | Fix | Domain |
|---|-----|--------|
| 11 | Add rate limiting on invite creation | A |
| 12 | Rotate invite token on resend | A |
| 13 | Add DB-level constraint preventing self-demotion | C |
| 14 | Add server-side permission checks to API routes | D |
| 15 | Integrate session-manager.ts into login flow OR remove dead code | E |
| 16 | Add session revocation on password change | E |
| 17 | Add `verifyImpersonationSession()` middleware for write operations | F |
| 18 | Consider read-only mode for impersonation | F |
| 19 | Add RLS policies to `login_attempts` table | G |

### P2 — Medium Priority

| # | Fix | Domain |
|---|-----|--------|
| 20 | Make profile creation failure throw error (not silent-fail) | A |
| 21 | Add expired invite cleanup (both user and device rep) | A, B |
| 22 | Add confirmation modal for privilege escalation to facility_admin | C |
| 23 | Filter `is_active = true` on users in analytics RPCs | C |
| 24 | Use PermissionGuard consistently or document inline `can()` as standard | D |
| 25 | Add periodic user revalidation in UserContext (every 5 min) | E |
| 26 | Add server-side timeout for abandoned impersonation sessions | F |
| 27 | Schedule cleanup functions via pg_cron | G |

### P3 — Low Priority / Nice-to-Have

| # | Fix | Domain |
|---|-----|--------|
| 28 | Add audit logging on invite acceptance (IP, user-agent) | A |
| 29 | Generate TypeScript types for permission keys from DB | D |
| 30 | Implement MFA/TOTP (Supabase supports natively) | E |
| 31 | Add password history prevention | E |
| 32 | Clean up stale `admin_sessions` via pg_cron | F |
| 33 | Add revocation tracking columns to `user_sessions` | G |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE.TS                             │
│  Auth check only (getUser) — no permission enforcement          │
│  Public: /auth/*, /invite/*, /login, /status/*                  │
│  Protected: everything else                                     │
└─────────────┬───────────────────────────────────┬───────────────┘
              │                                   │
    ┌─────────▼─────────┐             ┌───────────▼────────────┐
    │   PAGE COMPONENTS  │             │     API ROUTES         │
    │                    │             │                        │
    │  can('key') checks │             │  Auth check only       │
    │  (UI enforcement)  │             │  NO permission checks  │ ← GAP
    │                    │             │  NO impersonation      │
    │  PermissionGuard   │             │    verification        │ ← GAP
    │  (exists, unused)  │             │                        │
    └─────────┬──────────┘             └───────────┬────────────┘
              │                                    │
    ┌─────────▼────────────────────────────────────▼──────────┐
    │                    SUPABASE CLIENT                       │
    │  httpOnly cookies (GOOD)                                 │
    │  Automatic token refresh (GOOD)                          │
    └─────────┬────────────────────────────────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────────┐
    │                    ROW LEVEL SECURITY                     │
    │                                                          │
    │  338 policies — ALL role-based (access_level checks)     │
    │  user_has_permission() exists but UNUSED                 │ ← GAP
    │  Facility scoping: GOOD (get_my_facility_id)             │
    │  Device rep scoping: BROKEN (wrong table reference)      │ ← BUG
    │  audit_log: NOT IMMUTABLE (no deny policies)             │ ← BUG
    └──────────────────────────────────────────────────────────┘
```

## Dead Code Inventory

| File | Status | Action |
|------|--------|--------|
| `lib/session-manager.ts` — `recordSession()`, `updateSessionActivity()`, `cleanupExpiredSessions()` | Never called | Integrate or remove |
| `lib/session-manager.ts` — custom session duration logic | Doesn't work (Supabase API limitation) | Remove |
| `components/permissions/PermissionGuard.tsx` | Component exists, zero page usage | Either adopt consistently or remove |
| `lib/impersonation.ts` — `verifyImpersonationSession()` | Exists but never called | Wire into API middleware |
| `lib/rate-limiter.ts` — `checkRateLimitDB()`, `recordFailedAttemptDB()` | DB-based alternatives exist but unused | Replace in-memory version |
