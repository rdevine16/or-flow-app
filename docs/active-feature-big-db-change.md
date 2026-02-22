# Feature: Codebase Quality & Consistency Overhaul

## Goal
Bring the entire ORbit web app to professional-grade code quality by eliminating inconsistencies, deduplicating patterns, creating shared components, splitting oversized files, and improving performance. The app works well functionally, but dozens of UI patterns are reinvented across 80+ files instead of using shared components. Card components with graphs have 3+ different border colors, title styles, sparkline implementations, and trend badge designs. This overhaul will make the codebase maintainable, consistent, and fast.

## Requirements
1. Unify all KPI/stat cards with sparklines into a single shared `KpiCard` component matching the dashboard style
2. Consolidate duplicate Sparkline implementations (keep Recharts-based mini-chart for KPI cards, SVG Sparkline for standalone use)
3. Create shared `Spinner`, `TrendBadge`, `MicroBar`, and `ChartTooltip` primitives
4. Move all hardcoded chart colors and magic numbers to `lib/design-tokens.ts`
5. Eliminate 32 files with duplicate formatting functions — consolidate to `lib/formatters.ts`
6. Migrate 31 files with inline empty states to use existing `EmptyState` component
7. Migrate 16 files with inconsistent loading spinners to use shared `Spinner`
8. Split 5 mega-files (2,000+ lines each) into focused modules
9. Move 20 direct `createClient()` calls from components to DAL/hooks
10. Add `React.memo` to pure display components, dynamic import Recharts, memoize expensive render computations
11. Extract hooks from god components (CaseForm, DataQualityPage, case detail)

## Current State — Inconsistencies Found

### Card Wrappers (3 border colors, 3 padding values)
```
DashboardKpiCard:  border-slate-100  shadow-sm  p-4
FlagKPICard:       border-slate-200  shadow-sm  p-4
QuickStatCard:     border-slate-200/60  shadow-sm  p-4
PayerMixCard:      border-slate-200  shadow-sm  p-5
CaseEconomicsCard: border-slate-200  shadow-sm  p-5
```

### Title Labels (3 different styles)
```
DashboardKpiCard:  text-xs font-medium text-slate-500 uppercase tracking-wide
FlagKPICard:       text-[11px] font-semibold text-slate-500 uppercase tracking-[0.05em]
QuickStatCard:     text-xs text-slate-500 font-medium (no uppercase)
```

### Value Text (3 styles)
```
DashboardKpiCard:  text-2xl font-bold text-slate-900
FlagKPICard:       text-[28px] font-bold font-mono tracking-tight
QuickStatCard:     text-2xl font-bold font-mono tracking-tight
```

### Sparklines (3 implementations)
```
DashboardKpiCard:  Recharts AreaChart 72x28 (gradient fill — user's preferred look)
FlagKPICard:       SVG Sparkline (ui/) 64x24
QuickStatCard:     SVG Sparkline (ui/) 72x24, opacity-70, no area fill
```

### Trend Badges (3 approaches)
```
DashboardKpiCard:  Lucide ArrowUp/Down, inline color classes
FlagKPICard:       Lucide TrendingUp/Down, custom TrendBadge with pill
QuickStatCard:     Unicode ↑/↓ arrows, inline pill with custom padding
```

### Status Dots (2 sizes)
```
DashboardKpiCard:  w-2 h-2 rounded-full
FlagKPICard:       w-1.5 h-1.5 rounded-full
QuickStatCard:     (none)
```

## Inventory by Category

| Category | Files Affected |
|----------|---------------|
| KPI/metric card components to unify | 5 |
| Inline empty states → EmptyState | 31 |
| Inconsistent loading spinners → Spinner | 16 |
| Duplicate formatting functions → formatters.ts | 32 |
| Direct createClient() in components → DAL/hooks | 20 |
| Hardcoded chart color hex values → design tokens | 24 |
| Duplicate Sparkline imports to consolidate | 5 |
| Component files over 800 lines | 11 |
| Page files over 1,000 lines | 10 |
| Lib files over 800 lines | 8 |
| **Total unique files requiring changes** | **~90** |

## Mega-Files Requiring Splitting

| File | Lines | Exports | Split Target |
|------|-------|---------|-------------|
| `app/admin/docs/page.tsx` | 3,195 | 37 helpers | Extract helpers + sub-components |
| `lib/audit-logger.ts` | 2,903 | 34 audit objects | Split by domain (case, admin, settings) |
| `lib/analyticsV2.ts` | 2,875 | 50 functions | Split by KPI domain |
| `components/analytics/AnalyticsComponents.tsx` | 2,193 | 29 components | Split by purpose (cards, charts, badges) |
| `app/analytics/block-utilization/page.tsx` | 2,125 | 27 helpers | Extract calculation functions to lib/ |

## God Components Requiring Hook Extraction

| Component | Lines | Extract To |
|-----------|-------|-----------|
| `components/cases/CaseForm.tsx` | 1,507 | `useCaseFormState`, `useRoomConflicts` hooks |
| `components/data-quality/DataQualityPage.tsx` | 1,460 | `useDataQualityIssues`, `useDataQualityScanner` hooks |
| `app/cases/[id]/page.tsx` | 1,655 | `useCaseDetail`, `useCaseMilestones` hooks |
| `components/analytics/financials/SurgeonDetail.tsx` | 1,318 | Move helpers to `lib/analytics/financialUtils.ts` |
| `components/analytics/financials/ProcedureDetail.tsx` | 1,197 | Same as above, share with SurgeonDetail |

## Files Likely Involved

### New Files to Create
- `components/ui/KpiCard.tsx` — unified KPI card with Recharts sparkline, trend badge, target bar
- `components/ui/Spinner.tsx` — standardized loading spinner (sm/md/lg)
- `components/ui/TrendBadge.tsx` — unified trend indicator with arrow + percentage
- `components/ui/MicroBar.tsx` — horizontal progress/utilization bar primitive
- `components/ui/ChartTooltip.tsx` — shared Recharts tooltip wrapper
- `lib/analytics/turnover.ts` — extracted from analyticsV2
- `lib/analytics/utilization.ts` — extracted from analyticsV2
- `lib/analytics/scheduling.ts` — extracted from analyticsV2
- `lib/analytics/surgeonMetrics.ts` — extracted from analyticsV2
- `lib/analytics/blockUtilization.ts` — extracted from block-utilization page
- `lib/analytics/financialUtils.ts` — extracted from SurgeonDetail/ProcedureDetail
- `lib/audit/types.ts` — AuditAction types split from audit-logger
- `lib/audit/case.ts` — case audit functions
- `lib/audit/admin.ts` — admin audit functions
- `lib/audit/settings.ts` — settings audit functions
- `components/analytics/shared/MetricCards.tsx` — split from AnalyticsComponents
- `components/analytics/shared/Badges.tsx` — split from AnalyticsComponents
- `components/analytics/shared/Charts.tsx` — split from AnalyticsComponents
- `components/analytics/shared/Timeline.tsx` — split from AnalyticsComponents
- `components/analytics/shared/Skeletons.tsx` — split from AnalyticsComponents
- `lib/hooks/useCaseDetail.ts` — extracted from case detail page
- `lib/hooks/useDataQualityIssues.ts` — extracted from DataQualityPage
- `lib/hooks/useCaseFormState.ts` — extracted from CaseForm

### Files to Delete
- `components/analytics/financials/shared/Sparkline.tsx` — duplicate of `ui/Sparkline.tsx`

### Existing Files to Modify (major categories)
- `lib/design-tokens.ts` — add chart color palettes, timeout constants, status colors
- `lib/formatters.ts` — add any missing format functions (formatTime, getSurgeonName variants)
- `components/ui/EmptyState.tsx` — review API, ensure it covers all use cases found
- 32 files with duplicate formatters → replace with imports
- 31 files with inline empty states → replace with EmptyState
- 16 files with inline spinners → replace with Spinner
- 20 component files with createClient() → move to DAL/hooks
- 24 files with hardcoded hex colors → import from design tokens

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait (code quality refactor is web-only)

## Known Issues / Constraints
- Pre-existing typecheck errors in test files (mock types) — not related to this feature
- `lib/analyticsV2.ts` has 50+ functions — splitting requires updating imports across many consumer files
- `audit-logger.ts` exports are used in 40+ files — barrel re-export needed to avoid breaking imports
- Some inline styles (`style={{ width: '${pct}%' }}`) are necessary for dynamic values — Tailwind can't handle runtime values
- Card unification must preserve all current functionality (sparklines, targets, trends, status dots)
- The user prefers the DashboardKpiCard style (Recharts AreaChart sparkline with gradient fill)
- `AnalyticsComponents.tsx` components are imported individually across 10+ files — split must maintain all exports

## Out of Scope
- New features or pages — this is purely a quality refactor
- Database migrations or schema changes
- iOS app changes
- Changing the visual design — only making it consistent
- Rewriting business logic — only moving it to better locations
- Adding new tests for existing functionality (only tests for new shared components)
- Refactoring Supabase Edge Functions (they use console.log appropriately)

## Scope Revision (from /review)
The following items are **OUT OF SCOPE** for this overhaul:
- Splitting the 5 mega-files (AnalyticsComponents.tsx, analyticsV2.ts, audit-logger.ts, block-utilization/page.tsx, admin/docs/page.tsx)
- Extracting financial helpers from SurgeonDetail.tsx / ProcedureDetail.tsx
- MicroBar as a standalone component (built into KpiCard instead)

## Revised Acceptance Criteria
- [ ] All KPI/stat cards with graphs use the unified `KpiCard` component
- [ ] One Sparkline implementation (no duplicate in financials/shared/)
- [ ] Zero inline empty states — all use `EmptyState` component with best-match icons
- [ ] Zero inconsistent loading spinners — all use shared `Spinner` (Skeleton stays for content placeholders)
- [ ] Zero duplicate formatting functions in component files
- [ ] All chart colors reference `lib/design-tokens.ts`, not hardcoded hex strings
- [ ] No direct `createClient()` calls in component files
- [ ] `React.memo` on all pure display components (badges, icons, tooltips)
- [ ] Recharts dynamically imported at chart component level on analytics pages
- [ ] God components (CaseForm, DataQualityPage, CaseDetail) reduced to <600 lines via hook extraction
- [ ] UserContext split into UserDataContext + ImpersonationContext, contexts moved to contexts/ dir
- [ ] All tests pass per phase (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
- [ ] No visual regressions — cards, charts, and layouts look identical after refactor

## Revised Phase Order (7 phases)
1. Shared UI Primitives + Design Tokens
2. Formatting Consolidation + Sparkline Dedup
3. Card Unification + Component Adoption Sweep (4 sub-commits)
4. DAL Migration + Supabase Type Generation
5. God Component Splitting (CaseForm, DataQualityPage, CaseDetail)
6. Performance + React.memo + Dynamic Imports
7. Final Polish + Context Move + Verification

---

## Review Q&A

> Generated by /review on 2026-02-21

**Q1:** For splitting analyticsV2.ts (56 importers) and audit-logger.ts (55 importers), should we use barrel re-exports as a transitional strategy, or update all 111 import paths directly?
**A1:** Direct import updates. Update all paths in-phase for a clean result. (NOTE: These splits are now out of scope, but the decision stands if revisited later.)

**Q2:** DataQualityPage.tsx was already split into 11 sub-components in a previous feature branch, but it's still 1,461 lines with 20+ useState hooks. Should we still extract hooks from it?
**A2:** Still extract hooks. The file is still 1,461 lines — extract useDataQualityIssues and useDataQualityScanner hooks to get it under 600 lines.

**Q3:** For the unified KpiCard's trend API, which pattern should we use?
**A3:** Single `trend` number (e.g., `trend={-12.5}`). Sign determines direction. Add `increaseIsGood?: boolean` (default true) for metrics where down is good.

**Q4:** For KpiCard's sparkline data prop, should it accept `number[]` or `{ v: number }[]`?
**A4:** `number[]`. Simpler consumer API. KpiCard maps to Recharts format internally.

**Q5:** For splitting AnalyticsComponents.tsx, should we group by component type or by consumer domain?
**A5:** By type (MetricCards, Selectors, Charts, etc.) — as planned. (NOTE: This split is now out of scope.)

**Q6:** Should we move the 3 Context files from lib/ to contexts/ in the final phase?
**A6:** Yes, move them as planned. Conventional Next.js pattern.

**Q7:** For Supabase type generation, generate from local or remote? Commit or .gitignore?
**A7:** Generate from remote (`supabase gen types typescript --project-id zplyoslgguxtojgnkxlt`) and commit the file.

**Q8:** For React.memo + useMemo performance work, apply broadly or only measured hot spots?
**A8:** Apply broadly as planned. Low-risk for truly pure components (Badge, Spinner, etc.).

**Q9:** AnalyticsComponents.tsx has its own inline EmptyState. Delete it and use ui/EmptyState everywhere?
**A9:** Delete the analytics version. One EmptyState to rule them all.

**Q10:** Phase 3 touches 70+ files. Break into sub-commits or one atomic commit?
**A10:** Sub-commits within Phase 3: (1) KPI card unification, (2) EmptyState migration, (3) Spinner migration, (4) Design token migration.

**Q11:** For the shared ChartTooltip, render-prop or declarative row-based pattern?
**A11:** Declarative rows: `<ChartTooltip title={label} rows={[{label, value, color}]} />`. Add a `children` escape hatch for custom 20% cases.

**Q12:** Should we fully split admin/docs/page.tsx (3,195 lines) given it's global-admin-only?
**A12:** Skip entirely. Low-traffic, admin-only. Focus effort on high-impact files.

**Q13:** For the 20 components with direct createClient() calls, should every one get a dedicated DAL function?
**A13:** DAL for complex (GlobalSearch, CaseForm, FacilityLogo), inline `useSupabaseQuery` for simple dropdown fetches (StaffMultiSelect, ImplantCompanySelect, etc.).

**Q14:** KpiCard status dot: auto-calculate from target, explicit status prop, or both?
**A14:** Both. If `target` prop provided, auto-calculate dot color. If `status` prop provided, use that directly. If neither, no dot.

**Q15:** Spinner migration: replace only spinning-icon patterns, or also shadcn Skeleton placeholders?
**A15:** Spinner for action indicators, Skeleton stays for content placeholders, and KpiCard gets a loading skeleton variant.

**Q16:** Since we're NOT splitting analyticsV2.ts, should formatting consolidation also pull its time formatters?
**A16:** Component duplicates only. Leave analyticsV2.ts time functions where they are.

**Q17:** One universal CHART_PALETTE or semantic palettes?
**A17:** One universal 10-color `CHART_PALETTE` array. Keep existing `surgeonPalette` for surgeon-specific coloring.

**Q18:** Dynamic Recharts imports: page level or chart component level?
**A18:** Chart component level. Page shell loads immediately, charts lazy-load with skeletons.

**Q19:** CaseForm hook extraction: one master hook, multiple focused hooks, or useReducer?
**A19:** One master `useCaseFormState` hook owning all 18+ state variables. Sub-components receive via props.

**Q20:** Case detail page: one useCaseDetail hook or two separate hooks?
**A20:** One `useCaseDetail` hook. Keeps the dependency chain (milestones → pace stats) contained.

**Q21:** Fix broken tests in each phase or batch in final phase?
**A21:** Fix in each phase. Every phase must pass typecheck + test before committing. No debt accumulation.

**Q22:** Revised 7-phase order — does it work?
**A22:** Yes. Phases 1-3 build UI foundation, Phase 4 (DAL) prepares data layer, Phase 5 (god components) uses new DAL hooks, Phase 6-7 are polish.

**Q23:** KpiCard sparkline: inline Recharts, lazy-loaded, or SVG?
**A23:** Lazy-load the sparkline sub-component inside KpiCard. Brief skeleton while Recharts loads. Better bundle size.

**Q24:** TOAST_DISMISS_MS constant — add to design tokens or skip?
**A24:** Add it. Quick win, eliminates a magic number in 14 files.

**Q25:** When migrating 31 empty states, pick best-match icon per context or use default?
**A25:** Best-match icons. Pick the most appropriate EmptyStateIcon for each migration (Calendar for schedule, Chart for analytics, Users for staff, etc.).

**Q26:** SurgeonDetail/ProcedureDetail duplicate financial helpers — deduplicate or leave?
**A26:** Leave them. Contained duplication between 2 files isn't worth scope creep.

**Q27:** lib/formatters.ts already has getJoinedValue. Create new supabase-helpers.ts or extend?
**A27:** New `supabase-helpers.ts` with `getSingle<T>()`/`getArray<T>()`. Keep `getJoinedValue` in formatters.ts.

**Q28:** Migrating DashboardKpiCard → KpiCard: update call sites for number[] or accept both shapes?
**A28:** Update call sites. Clean API, KpiCard only accepts `number[]`.

**Q29:** After migration, delete old card components immediately or deprecate first?
**A29:** Delete immediately. TypeScript catches any missed references.

**Q30:** UserContext: consolidate useState only, or split into 2 contexts?
**A30:** Split into UserDataContext (userData, loading) and ImpersonationContext (facilityId, facilityName). Components subscribe to only what they need.

**Q31:** MicroBar as standalone component or built into KpiCard?
**A31:** Build into KpiCard only. No standalone MicroBar. Extract later if needed.

**Q32:** Remove EnhancedMetricCard from AnalyticsComponents.tsx after KpiCard migration, or leave as dead code?
**A32:** Remove it. No dead code.
