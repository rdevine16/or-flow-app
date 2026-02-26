# Implementation Plan: Production Readiness (Remaining Items)

**Source:** `docs/active-feature.md` + Review Q&A (30 items)
**Branch:** `fix/production-readiness`
**Prerequisite for:** 15-phase audit remediation plan (backed up in git history, commit `ee6549b`)

---

## Summary

Complete the remaining production readiness fixes not covered by commit `036c063`. Work is grouped into 5 phases with separate commits: security/config fixes, dead code removal, console.log cleanup, page metadata + branded error page, and build verification.

## Interview Notes

- Convert all Next.js app console.log to structured logger; leave supabase functions and scripts as-is (different runtimes)
- Fix ErrorBoundary/ToastProvider ordering bug
- Single phase for all 85 page metadata wrappers (mechanically repetitive)
- Page titles use generic names for dynamic routes ("Case Detail", not DB-queried titles)
- Wrapper pattern: rename `page.tsx` → `PageClient.tsx`, new `page.tsx` exports metadata + renders client component
- Keep current CSP (no nonces). Add HSTS for defense in depth.
- Remove sentry example files, refactor tool, admin docs page + supporting files, error-tracking.ts, error-logger.ts
- Replace errorLogger usage in login page with structured logger
- Remove /privacy and /terms links from login page
- Brand global-error.tsx to match ORbit aesthetic
- Add /monitoring to PUBLIC_ROUTES for Sentry tunnel

---

## Phase 1: Security & Config Fixes ✅

**Status:** completed

### What it does
Fix remaining security, Sentry, and configuration issues.

### Changes
1. **`instrumentation-client.ts`** — Change `tracesSampleRate: 1` → `0.1`, `sendDefaultPii: true` → `false`
2. **`next.config.ts`** — Add `Strict-Transport-Security` header
3. **`middleware.ts`** — Add `'/monitoring'` to `PUBLIC_ROUTES` array
4. **`lib/supabase.ts`** — Replace `process.env.NEXT_PUBLIC_SUPABASE_URL!` with validated `env.NEXT_PUBLIC_SUPABASE_URL`; same for anon key
5. **`lib/supabase-server.ts`** — Same validated env replacement
6. **`app/layout.tsx`** — Move `ErrorBoundary` inside `ToastProvider` so it has access to toast context
7. **`app/login/page.tsx`** — Remove `/privacy` and `/terms` footer links

### Files touched
- `instrumentation-client.ts`
- `next.config.ts`
- `middleware.ts`
- `lib/supabase.ts`
- `lib/supabase-server.ts`
- `app/layout.tsx`
- `app/login/page.tsx`

### Commit message
`fix(security): sentry client config, HSTS, env validation, ErrorBoundary ordering`

### 3-stage test gate
1. **Unit:** Verify env imports resolve correctly in supabase clients
2. **Integration:** Verify middleware allows /monitoring route without auth; verify ErrorBoundary renders inside ToastProvider
3. **Workflow:** Full login → dashboard navigation works; check response headers include HSTS

### Complexity: small

---

## Phase 2: Dead Code Removal ✅

**Status:** completed

### What it does
Remove developer tools, dead scaffolding, and unused error infrastructure that should not ship to production.

### Changes
1. **Delete** `app/sentry-example-page/` directory
2. **Delete** `app/api/sentry-example-api/` directory
3. **Delete** `app/refactor/` directory (4 files)
4. **Delete** `app/api/refactor/` directory (3 files)
5. **Delete** `app/admin/docs/page.tsx`
6. **Delete** `lib/supabaseIntrospection.ts`
7. **Delete** `lib/pageRegistry.ts`
8. **Delete** `lib/error-tracking.ts`
9. **Delete** `lib/error-logger.ts`
10. **Remove** "Developer" nav group from `components/layouts/navigation-config.tsx` (entries for /admin/docs and /refactor)
11. **Remove** any breadcrumb entries referencing admin/docs
12. **Remove** imports of `error-logger.ts` and `error-tracking.ts` from consuming files

### Files touched
- `app/sentry-example-page/page.tsx` (DELETE)
- `app/api/sentry-example-api/route.ts` (DELETE)
- `app/refactor/page.tsx`, `RefactorDashboard.tsx`, `components.tsx`, `IssueCard.tsx` (DELETE)
- `app/api/refactor/scan/route.ts`, `css-patterns.ts`, `pagination-patterns.ts` (DELETE)
- `app/admin/docs/page.tsx` (DELETE)
- `lib/supabaseIntrospection.ts` (DELETE)
- `lib/pageRegistry.ts` (DELETE)
- `lib/error-tracking.ts` (DELETE)
- `lib/error-logger.ts` (DELETE)
- `components/layouts/navigation-config.tsx` (EDIT)
- Any files importing error-logger or error-tracking (EDIT)

### Commit message
`chore(cleanup): remove dev tools, sentry examples, dead error infrastructure`

### 3-stage test gate
1. **Unit:** No dangling imports — `npm run build` compiles without unresolved modules
2. **Integration:** Navigation sidebar renders without "Developer" section; admin pages still work
3. **Workflow:** Navigate through admin section — no broken links or missing pages

### Complexity: medium

---

## Phase 3: Console.log Cleanup

**Status:** completed

### What it does
Replace all raw `console.log/warn/error` calls in Next.js app code with structured logger. Supabase functions and scripts are excluded (different runtimes).

### Changes
1. **`app/login/page.tsx`** — Replace `errorLogger` usage (7 calls) with `const log = logger('login')` + `log.warn()`/`log.error()` calls
2. **`lib/demo-data-generator.ts`** — Replace 24 console calls with `const log = logger('demo-data-generator')`
3. **`lib/audit-logger.ts`** — Replace 2 console calls with structured logger
4. **`lib/hooks/useFlipRoom.ts`** — Replace 1 console.log with structured logger
5. **`lib/UserContext.tsx`** — Replace 1 console.log with structured logger
6. **`app/analytics/orbit-score/page.tsx`** — Replace 1 console.log with structured logger

### Files touched
- `app/login/page.tsx`
- `lib/demo-data-generator.ts`
- `lib/audit-logger.ts`
- `lib/hooks/useFlipRoom.ts`
- `lib/UserContext.tsx`
- `app/analytics/orbit-score/page.tsx`

### Commit message
`fix(logging): replace all console.log with structured logger`

### 3-stage test gate
1. **Unit:** Logger instances created correctly with proper module names
2. **Integration:** Login flow logs errors via structured logger; demo data generation logs progress
3. **Workflow:** Generate demo data → verify structured log output in console (JSON in prod mode)

### Complexity: medium

---

## Phase 4: Page Metadata & Branded Error Page

**Status:** completed

### What it does
Add page-specific `<title>` metadata to all 85 pages and brand the global error page.

### Changes

#### 4a: Branded global-error.tsx
- Replace default `NextError` component with custom ORbit-branded error UI matching the 404 page aesthetic

#### 4b: not-found.tsx metadata
- Add `export const metadata = { title: 'Page Not Found' }` to existing 404 page

#### 4c: Server wrapper pages for all client components
For each `'use client'` page:
1. Rename `page.tsx` → `PageClient.tsx`
2. Create new `page.tsx` that exports metadata and renders `<PageClient />`

Pattern:
```tsx
// page.tsx (server component)
import { Metadata } from 'next'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'Page Title',
}

export default function Page() {
  return <PageClient />
}
```

For dynamic routes like `[id]`, use generic titles ("Case Detail", "Edit Case").

#### Title mapping (key pages)
- `/login` → "Sign In"
- `/dashboard` → "Dashboard"
- `/cases` → "Cases"
- `/cases/new` → "New Case"
- `/cases/[id]` → "Case Detail"
- `/cases/[id]/edit` → "Edit Case"
- `/analytics` → "Analytics"
- `/analytics/orbit-score` → "ORbit Score"
- `/analytics/flags` → "Flags"
- `/settings` → "Settings"
- `/admin` → "Admin"
- `/status/[token]` → "Case Status"
- (full list for all 85 pages determined during implementation)

### Files touched
- `app/global-error.tsx` (EDIT)
- `app/not-found.tsx` (EDIT)
- ~85 page.tsx files (RENAME → PageClient.tsx + CREATE new page.tsx)

### Commit message
`feat(metadata): add page titles to all pages, brand global error page`

### 3-stage test gate
1. **Unit:** All new page.tsx files export valid Metadata objects; PageClient imports resolve
2. **Integration:** Browser tab shows correct title on each page; global-error.tsx renders branded UI
3. **Workflow:** Navigate through 5+ pages → verify tab titles update; trigger error → verify branded error page

### Complexity: large

---

## Phase 5: Build Verification ✅

**Status:** completed

### What it does
Run full production build to verify all changes compile cleanly. Fix any errors.

### Changes
1. Run `npm run build`
2. Fix any TypeScript errors, missing imports, or build failures
3. Run typecheck separately if needed

### Files touched
- Any files that fail build (TBD)

### Commit message
`fix(build): resolve build errors from production readiness changes`

### 3-stage test gate
1. **Unit:** `npm run build` exits 0
2. **Integration:** No TypeScript errors in changed files
3. **Workflow:** `npm run dev` starts and key pages render

### Complexity: small

---

## Phase Dependency Chain

```
Phase 1 (Security) → Phase 2 (Dead Code) → Phase 3 (Console.log) → Phase 4 (Metadata) → Phase 5 (Build)
```

Phase 2 must come before Phase 3 because dead code removal (error-logger.ts deletion) affects console.log cleanup scope (login page must replace errorLogger with logger).

Phase 5 is the final gate before merging to main.
