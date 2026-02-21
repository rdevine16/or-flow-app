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

## Acceptance Criteria
- [ ] All KPI/stat cards with graphs use the unified `KpiCard` component
- [ ] One Sparkline implementation (no duplicate in financials/shared/)
- [ ] Zero inline empty states — all use `EmptyState` component
- [ ] Zero inconsistent loading spinners — all use shared `Spinner`
- [ ] Zero duplicate formatting functions in component files
- [ ] All chart colors reference `lib/design-tokens.ts`, not hardcoded hex strings
- [ ] No files over 800 lines (components) or 1,500 lines (pages/lib) after splitting
- [ ] No direct `createClient()` calls in component files
- [ ] `React.memo` on all pure display components (badges, icons, tooltips)
- [ ] Recharts dynamically imported on analytics pages
- [ ] All god components reduced to <600 lines via hook extraction
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
- [ ] No visual regressions — cards, charts, and layouts look identical after refactor
