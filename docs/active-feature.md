# Current Work: Production Readiness Fixes

## Goal
Fix critical and high-priority production readiness issues found during pre-launch audit. These are NEW findings that supplement the existing 15-phase remediation plan in `docs/implementation-plan.md`.

## Status
- **Branch:** `fix/production-readiness`
- **Current Phase:** In progress
- **Scope:** Build fixes, security headers, Sentry config, 404 page, offline handling, env cleanup

## Findings (new — not in existing remediation plan)

### CRITICAL
1. **Build broken** — `useMilestoneRealtime.ts:173` calls `logger.info()` but `logger` is a factory function. Needs `const log = logger('useMilestoneRealtime')`.
2. **Env var mismatch** — `lib/env.ts` expects `NEXT_PUBLIC_APP_URL` but `.env.*` files define `NEXT_PUBLIC_SITE_URL`. Runtime crash in production.

### HIGH
3. **No security headers** — `next.config.ts` missing `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`.
4. **No custom 404 page** — No `app/not-found.tsx`. Users see default Next.js 404.
5. **Sentry 100% trace sampling** — `tracesSampleRate: 1` in all 3 Sentry configs. Expensive in production.
6. **Sentry `sendDefaultPii: true`** — Sends PII to Sentry. HIPAA concern for healthcare app.
7. **Demo-data endpoints lack role authorization** — Any authenticated user can hit `/api/demo-data/*`.

### MEDIUM
8. **No offline/network error handling** — No `navigator.onLine` detection, no retry logic.
9. **Missing `.env.example`** — No template for required env vars.
10. **Missing `robots.txt`** — Login-required app should block search engine indexing.
11. **Minimal metadata** — Only root layout has basic title/description. No OG tags, no page titles.

### Items already covered by existing remediation plan
- Rate limiter (Phase 2)
- Race conditions / optimistic locking (Phase 3 + 11)
- Validation layer (Phase 9)
- Error boundaries at page level (Phase 15)
- Demo data auth at role level (Phase 6)
- Accessibility improvements (not in plan — add to Phase 15 backlog)

---

## Previous Feature: Audit Remediation
The 15-phase remediation plan at `docs/implementation-plan.md` remains active. This production-readiness work is a prerequisite fix that should land first.
