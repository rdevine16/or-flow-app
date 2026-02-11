# Phase 2: Enterprise Remediation — Full Delivery

## What's in This Package

### 1. CI/CD Pipeline — `.github/workflows/ci.yml`
GitHub Actions that runs on every push and PR to `main`:

| Job | What it does |
|-----|-------------|
| **Lint** | `next lint` — catches import issues, accessibility violations |
| **Type check** | `tsc --noEmit` — catches type errors before deploy |
| **Unit tests** | `vitest run` — runs all 6 test suites |
| **Build** | `next build` — catches runtime errors, ensures clean production build |

**Setup required:**
```bash
# Add these GitHub repo secrets (Settings → Secrets → Actions):
NEXT_PUBLIC_SUPABASE_URL       # your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # your Supabase anon key
SENTRY_AUTH_TOKEN              # from sentry.io → Settings → Auth Tokens
```

After adding secrets, every PR will show ✅/❌ checks before merge. Vercel will still handle deploys.

---

### 2. Sentry Example Cleanup — `scripts/cleanup-sentry-example.sh`
```bash
chmod +x scripts/cleanup-sentry-example.sh
./scripts/cleanup-sentry-example.sh
```
Removes the test pages Sentry wizard created. Run after you've verified Sentry receives errors at sentry.io.

---

### 3. Migration Codemod — `scripts/migrate-to-query-hooks.mjs`
```bash
node scripts/migrate-to-query-hooks.mjs
```
Scans your entire `app/` directory and generates `docs/MIGRATION-REPORT.md` with:
- Every page that still uses the manual `useState` + `useEffect` + `fetchData` pattern
- Categorized by complexity (simple / medium / complex)
- Generated replacement code for each simple page
- Time estimates for the full migration

---

## How to Apply Everything

```bash
git checkout -b refactor/phase2-ci-migration
unzip -o ~/Downloads/phase2-full.zip

# 1. Verify CI pipeline
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline for lint, type check, tests, build"
git push origin refactor/phase2-ci-migration
# → Open PR, check that CI runs

# 2. Clean up Sentry examples (after verifying Sentry dashboard works)
chmod +x scripts/cleanup-sentry-example.sh
./scripts/cleanup-sentry-example.sh
git add -A && git commit -m "chore: remove Sentry example pages"

# 3. Run migration scanner
node scripts/migrate-to-query-hooks.mjs
# → Review docs/MIGRATION-REPORT.md
# → Migrate pages following the pattern below

# 4. Build + test
npm run build && npx vitest run
```

---

## useSupabaseQuery Migration — The Pattern

Every CRUD settings page in your app follows this **identical** pattern:

### Before (manual — 15+ lines of boilerplate per page):
```tsx
const [items, setItems] = useState<Type[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  if (facilityId) fetchData()
}, [facilityId])

const fetchData = async () => {
  setLoading(true)
  setError(null)
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('facility_id', facilityId)
      .order('display_order')
    if (error) throw error
    setItems(data || [])
  } catch (err) {
    setError('Failed to load.')
  } finally {
    setLoading(false)
  }
}
```

### After (useSupabaseList — 8 lines):
```tsx
const { data: items, loading, error, refetch } = useSupabaseList<Type>(
  async (sb) => {
    const { data, error } = await sb
      .from('table_name')
      .select('*')
      .eq('facility_id', facilityId)
      .order('display_order')
    return { data: data || [], error }
  },
  [facilityId],
  { enabled: !!facilityId }
)
```

### What else changes in the file:
1. **Add import:** `import { useSupabaseList } from '@/hooks/useSupabaseQuery'`
2. **Remove:** The 3 `useState` declarations, the `useEffect`, and the `fetchData` function
3. **CRUD handlers:** Replace `setItems(prev => [...prev, newItem])` with `refetch()`
4. **Error display:** Change `message={error}` to `message={error?.message ?? null}`
5. **Remove:** `import { createClient } from '@/lib/supabase'` if only used for the initial fetch (keep if used in CRUD handlers)

### Migration priority (from codemod report):

| Priority | Pages | Pattern | Time each |
|----------|-------|---------|-----------|
| **Simple** | ~20 pages | Single table, 1-2 queries | 5 min |
| **Medium** | ~18 pages | Multiple tables, 3-5 queries | 15 min |
| **Complex** | ~16 pages | 6+ queries, dependent fetches, analytics | 30 min |

**Start with these 10 (identical CRUD pattern):**
1. `app/settings/implant-companies/page.tsx`
2. `app/settings/flags/page.tsx`
3. `app/settings/cancellation-reasons/page.tsx`
4. `app/settings/complexities/page.tsx`
5. `app/settings/checkin/page.tsx`
6. `app/settings/subscription/page.tsx`
7. `app/admin/settings/implant-companies/page.tsx`
8. `app/admin/settings/delay-types/page.tsx`
9. `app/admin/cancellation-reasons/page.tsx`
10. `app/admin/complexities/page.tsx`

Use `app/settings/delay-types/page.tsx` (already migrated) as your reference.

---

## Server Components Analysis

Most of your pages genuinely need `'use client'` because they contain modals, forms, and interactive state. Here's the realistic picture:

### Already Server Components (no changes needed)
- `app/layout.tsx`
- `app/admin/layout.tsx`
- `app/page.tsx` (landing/redirect)

### Could Remove `'use client'` (no interactivity)
These are placeholder/static pages that don't actually use any client features:
- `app/invite/success/page.tsx` — static success message
- However: they import `DashboardLayout` which is likely a client component, so they need `'use client'` anyway

### Future RSC Pattern (architectural change, not now)
The real server component win would be splitting data-heavy pages into:
```
page.tsx (Server) → fetches data via Supabase server client
  └── PageContent.tsx (Client) → receives data as props, handles interactivity
```

This eliminates loading spinners entirely (data arrives with the HTML), but requires:
1. A server-side Supabase client (different from your current browser client)
2. Moving auth checks to middleware (which you already have)
3. Restructuring every page into server wrapper + client child

**Recommendation:** Don't do this now. It's a Next.js 15+ pattern that's still stabilizing. The `useSupabaseQuery` migration is the right move for your current architecture — it eliminates boilerplate without requiring an architectural rewrite. When you're ready for RSC, the migration from `useSupabaseQuery` → server-fetched props is straightforward because the data layer is already centralized.

---

## Remaining Backlog After This Delivery

| Item | Status | Notes |
|------|--------|-------|
| CI/CD pipeline | ✅ Delivered | Add GitHub secrets to activate |
| Sentry cleanup | ✅ Delivered | Run after dashboard verification |
| Migration codemod | ✅ Delivered | Generates report + replacement code |
| useSupabaseQuery migration | 🔄 2/54 done | Follow the pattern above |
| God-file decomposition | ⏳ Deferred | `admin/docs` (3,181L) — keep for now per your call |
| Playwright E2E tests | ⏳ Next phase | After CI is green |
| Server Components | ⏳ Future | Not worth the arch change yet |
