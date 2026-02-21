# Implementation Plan: Codebase Quality & Consistency Overhaul

## Summary
Bring the ORbit web app to professional-grade code quality by creating shared UI primitives, eliminating duplication across ~90 files, splitting 5 mega-files, migrating 20 components to the DAL pattern, and extracting hooks from god components. UI consistency work comes first so visual improvements are seen early.

## Interview Notes
- **Sparklines:** Recharts AreaChart everywhere — all KPI cards use the gradient-fill sparkline from the dashboard
- **Import strategy:** Update all imports when splitting mega-files (no barrel re-exports). Cleaner long-term.
- **God components:** Full split — extract hooks AND break JSX into sub-components, each under 400 lines
- **DAL migration:** All 20 components with direct `createClient()` calls get migrated
- **Code splitting:** Dynamic import Recharts on analytics pages (~180KB savings, brief skeleton acceptable)
- **KpiCard status dot:** Optional via prop — shown when `target` is provided, omitted otherwise
- **Supabase types:** Generate from schema to eliminate ~200 type assertions in DAL layer
- **Phase order:** UI consistency first, then structural cleanup, then performance

---

## Phase 1: Shared UI Primitives + Design Tokens
**Complexity:** Large

### What it does
Create the foundation components that all subsequent phases depend on:

1. **`components/ui/KpiCard.tsx`** — Unified KPI card matching DashboardKpiCard style:
   - Recharts AreaChart sparkline (gradient fill)
   - Optional status dot (green/amber/red when `target` prop provided)
   - `TrendBadge` sub-component (ArrowUp/Down + percentage pill)
   - Optional target progress bar
   - Title: `text-xs font-medium text-slate-500 uppercase tracking-wide`
   - Value: `text-2xl font-bold text-slate-900`
   - Wrapper: `bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all`
   - Loading skeleton variant
   - Props: `title, value, unit?, trend?, trendInverse?, increaseIsGood?, sparkData?, sparkColor?, target?, subtitle?, secondaryValue?, loading?`

2. **`components/ui/TrendBadge.tsx`** — Extracted from inline implementations:
   - `value` (number), `inverse?` (boolean), `size?: 'sm' | 'md'`
   - Lucide ArrowUp/ArrowDown icons
   - Green pill for positive, rose pill for negative (inverted when `inverse`)

3. **`components/ui/Spinner.tsx`** — Standardized loading spinner:
   - `size?: 'sm' | 'md' | 'lg'` (maps to w-4/w-6/w-8)
   - `color?: 'blue' | 'slate'`
   - Uses Lucide `Loader2` with `animate-spin`

4. **`components/ui/MicroBar.tsx`** — Horizontal progress/utilization bar:
   - `value` (0-100), `color?`, `height?: 'sm' | 'md'` (h-1.5 / h-2)
   - Rounded corners, slate-100 background track

5. **`components/ui/ChartTooltip.tsx`** — Shared Recharts tooltip wrapper:
   - Standard card-like container: `bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-lg`
   - Render prop for custom content
   - Handles `active`/`payload` null checks

6. **Update `lib/design-tokens.ts`** — Add missing tokens:
   - `CHART_PALETTE`: 10-color array currently hardcoded in 24 files
   - `CHART_COLORS`: named semantic colors (profit green, loss red, neutral blue, etc.)
   - `TOAST_DISMISS_MS = 2000`: timeout constant used in 14 files
   - `SPARKLINE_DEFAULT_COLOR = '#3b82f6'`
   - Status colors for KPI dots (emerald/amber/rose thresholds)

### Files touched
- `components/ui/KpiCard.tsx` (NEW)
- `components/ui/TrendBadge.tsx` (NEW)
- `components/ui/Spinner.tsx` (NEW)
- `components/ui/MicroBar.tsx` (NEW)
- `components/ui/ChartTooltip.tsx` (NEW)
- `lib/design-tokens.ts` (MODIFY — add chart palette, toast timing, status colors)

### Commit message
`feat(ui): phase 1 — shared KpiCard, TrendBadge, Spinner, MicroBar, ChartTooltip + design tokens`

### 3-stage test gate
1. **Unit:** KpiCard renders with/without sparkline, trend, target, status dot. TrendBadge shows correct color/direction. Spinner renders at all sizes. MicroBar renders at correct width percentage. ChartTooltip renders custom content.
2. **Integration:** KpiCard loading skeleton renders correctly. Design token exports are importable. ChartTooltip works inside a Recharts chart.
3. **Workflow:** Import all new components into a test page → verify they render without errors → verify TypeScript types are strict.

---

## Phase 2: Formatting Consolidation + Sparkline Dedup
**Complexity:** Medium

### What it does
1. **Audit `lib/formatters.ts`** — add any missing functions that are currently duplicated locally:
   - `formatTime` (12-hour AM/PM conversion)
   - `formatTimeShort` (compact time)
   - `formatScheduledTime` (scheduled vs actual)
   - `getSurgeonDisplayName` / `getSurgeonInitials`
   - `formatDuration` (minutes → "Xh Ym" or "X min")
   - `formatDate` (locale-aware date)

2. **Migrate 32 files** — replace local formatting function definitions with imports from `lib/formatters.ts`. Delete the local definitions.

3. **Delete duplicate Sparkline** — remove `components/analytics/financials/shared/Sparkline.tsx` and update 4 files that import it to use `components/ui/Sparkline.tsx` instead.

### Files touched
- `lib/formatters.ts` (MODIFY — add missing functions)
- `components/analytics/financials/shared/Sparkline.tsx` (DELETE)
- `components/analytics/financials/shared/index.ts` (MODIFY — remove Sparkline export)
- `components/analytics/financials/OverviewTab.tsx` (MODIFY — update import)
- `components/analytics/financials/SurgeonHero.tsx` (MODIFY — update import)
- `components/analytics/financials/ProcedureDetail.tsx` (MODIFY — update import)
- 32 files with duplicate formatters (MODIFY — replace local functions with imports):
  - `components/CallNextPatientModal.tsx`
  - `components/GlobalSearch.tsx`
  - `components/analytics/InsightPanelCallback.tsx`
  - `components/analytics/InsightPanelCancellation.tsx`
  - `components/analytics/InsightPanelFCOTS.tsx`
  - `components/analytics/InsightPanelTurnover.tsx`
  - `components/analytics/financials/OverviewTab.tsx`
  - `components/analytics/financials/SurgeonDailyActivity.tsx`
  - `components/analytics/financials/SurgeonDetail.tsx`
  - `components/block-schedule/BlockCard.tsx`
  - `components/block-schedule/BlockPopover.tsx`
  - `components/block-schedule/WeekCalendar.tsx`
  - `components/cases/CaseDrawer.tsx`
  - `components/cases/CaseDrawerValidation.tsx`
  - `components/cases/CaseFlagsSection.tsx`
  - `components/cases/CaseSummary.tsx`
  - `components/cases/CasesTable.tsx`
  - `components/cases/CompletedCaseView.tsx`
  - `components/cases/DeviceRepSection.tsx`
  - `components/cases/MilestoneDetailRow.tsx`
  - `components/cases/MilestoneTimelineV2.tsx`
  - `components/cases/TimerChip.tsx`
  - `components/dashboard/CaseListView.tsx`
  - `components/dashboard/EnhancedRoomCard.tsx`
  - `components/dashboard/RoomGridView.tsx`
  - `components/dashboard/ScheduleAdherenceTimeline.tsx`
  - `components/dashboard/TrendChart.tsx`
  - `components/data-quality/MilestoneTimeline.tsx`
  - `components/data-quality/ReviewDrawer.tsx`
  - `components/pip/PiPMilestonePanel.tsx`
  - `components/ui/MilestoneButton.tsx`
  - `components/settings/procedures/SurgeonOverrideList.tsx`

### Commit message
`refactor(formatters): phase 2 — consolidate 32 duplicate formatters + delete duplicate Sparkline`

### 3-stage test gate
1. **Unit:** All formatter functions return correct output for edge cases (midnight, noon, negative durations, empty strings)
2. **Integration:** Every migrated file still renders correctly — spot-check 5 representative components
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green

---

## Phase 3: Card Unification + Component Adoption Sweep
**Complexity:** Large

### What it does
1. **Migrate KPI cards** — Replace `DashboardKpiCard`, `FlagKPICard`, `QuickStatCard`, and `EnhancedMetricCard` with the unified `KpiCard`:
   - `app/dashboard/page.tsx` — swap DashboardKpiCard → KpiCard
   - `app/analytics/flags/page.tsx` — swap FlagKPICard → KpiCard
   - `app/analytics/page.tsx` — swap inline QuickStatCard/CombinedTurnoverCard → KpiCard
   - Delete `components/dashboard/DashboardKpiCard.tsx`
   - Delete `components/analytics/flags/FlagKPICard.tsx`
   - Remove `EnhancedMetricCard` from AnalyticsComponents.tsx

2. **Migrate empty states** — Replace 31 inline empty state patterns with `<EmptyState>`:
   - All files listed in Category 2 inventory

3. **Migrate loading spinners** — Replace 16 inconsistent spinner patterns with `<Spinner>`:
   - All files listed in Category 3 inventory

4. **Migrate hardcoded chart colors** — Replace hex color arrays in 24 files with `CHART_PALETTE` / `CHART_COLORS` from design tokens

### Files touched
- `components/dashboard/DashboardKpiCard.tsx` (DELETE)
- `components/analytics/flags/FlagKPICard.tsx` (DELETE)
- `app/dashboard/page.tsx` (MODIFY — use KpiCard)
- `app/analytics/flags/page.tsx` (MODIFY — use KpiCard)
- `app/analytics/page.tsx` (MODIFY — use KpiCard, delete inline QuickStatCard/CombinedTurnoverCard)
- 31 files for EmptyState migration
- 16 files for Spinner migration
- 24 files for chart color token migration

### Commit message
`refactor(ui): phase 3 — unify KPI cards, adopt EmptyState/Spinner/design tokens across 70+ files`

### 3-stage test gate
1. **Unit:** KpiCard renders correctly in all 3 page contexts (dashboard, flags, analytics hub). EmptyState shows correct messages. Spinner renders at correct sizes.
2. **Integration:** Dashboard page loads with new KpiCard — sparklines render, trends display correctly, targets show progress bars
3. **Workflow:** Navigate through all analytics pages + dashboard → verify no visual regressions, all cards look consistent. `npm run typecheck && npm run lint && npm run test` — all green.

---

## Phase 4: Split AnalyticsComponents.tsx + analyticsV2.ts
**Complexity:** Large

### What it does
1. **Split `components/analytics/AnalyticsComponents.tsx`** (2,193 lines → 5 files):
   - `components/analytics/shared/MetricCards.tsx` — EnhancedMetricCard (if still referenced after Phase 3), RadialProgress
   - `components/analytics/shared/Selectors.tsx` — PeriodSelector, SurgeonSelector
   - `components/analytics/shared/Charts.tsx` — CallTimingTimeline, DelayDonut, ProcedureComparisonChart
   - `components/analytics/shared/Timeline.tsx` — DayTimeline, CasePhaseBar, CasePhaseBarNested, PhaseLegend, PhaseTreeLegend, PhaseMedianComparison, CaseDetailPanel, SidebarFlagList
   - `components/analytics/shared/Badges.tsx` — TrendPill, ConsistencyBadge, FlagBadge, FlagCountPills, MetricPillStrip, UptimeRing, InlineBar
   - `components/analytics/shared/Skeletons.tsx` — SkeletonMetricCards, SkeletonTable, SkeletonChart, SkeletonDayAnalysis
   - `components/analytics/shared/Panels.tsx` — InsightCard, SlideOutPanel, SectionHeader
   - Delete original `AnalyticsComponents.tsx`
   - Update ALL import paths across the codebase

2. **Split `lib/analyticsV2.ts`** (2,875 lines → 6 files):
   - `lib/analytics/types.ts` — all type/interface exports
   - `lib/analytics/timeUtils.ts` — getTimeDiffSeconds/Minutes, formatSeconds*, formatMinutes*, formatTimeFromTimestamp, formatDurationHHMMSS, parseScheduledDateTime
   - `lib/analytics/caseUtils.ts` — getMilestoneMap, buildMilestoneTimestampMap, computePhaseDurations, computeSubphaseOffsets, groupCasesByDate, getDateRange, filterActiveCases, milestone getter functions (getSurgeonDoneTime, getTotalORTime, etc.)
   - `lib/analytics/turnover.ts` — calculateSurgicalTurnovers, calculateTurnoverTime, calculateFlipRoomTurnover, getAllSameRoomTurnovers, getAllSameRoomSurgicalTurnovers
   - `lib/analytics/utilization.ts` — calculateORUtilization, calculateFCOTS, calculateCaseVolume, calculateCancellationRate, calculateTimeBreakdown, calculateAvgCaseTime
   - `lib/analytics/scheduling.ts` — calculateCumulativeTardiness, calculateNonOperativeTime, calculateSurgeonIdleTime, aggregateSurgeonIdleSummaries, calculateSurgeonLeaderboard
   - `lib/analytics/stats.ts` — calculateAverage, calculateSum, calculateStdDev, calculateMedian, calculatePercentageChange, getKPIStatus, calculateAnalyticsOverview
   - Delete original `analyticsV2.ts`
   - Update ALL import paths across the codebase

### Files touched
- `components/analytics/AnalyticsComponents.tsx` (DELETE)
- `components/analytics/shared/MetricCards.tsx` (NEW)
- `components/analytics/shared/Selectors.tsx` (NEW)
- `components/analytics/shared/Charts.tsx` (NEW)
- `components/analytics/shared/Timeline.tsx` (NEW)
- `components/analytics/shared/Badges.tsx` (NEW)
- `components/analytics/shared/Skeletons.tsx` (NEW)
- `components/analytics/shared/Panels.tsx` (NEW)
- `lib/analyticsV2.ts` (DELETE)
- `lib/analytics/types.ts` (NEW)
- `lib/analytics/timeUtils.ts` (NEW)
- `lib/analytics/caseUtils.ts` (NEW)
- `lib/analytics/turnover.ts` (NEW)
- `lib/analytics/utilization.ts` (NEW)
- `lib/analytics/scheduling.ts` (NEW)
- `lib/analytics/stats.ts` (NEW)
- All files importing from `AnalyticsComponents` or `analyticsV2` (update import paths)

### Commit message
`refactor(analytics): phase 4 — split AnalyticsComponents (29 components) + analyticsV2 (50 functions) into focused modules`

### 3-stage test gate
1. **Unit:** Each new module exports the correct functions/components. No circular dependencies.
2. **Integration:** All analytics pages still render correctly with updated imports. All existing tests pass.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green. Navigate analytics pages to verify no regressions.

---

## Phase 5: Split audit-logger.ts + Block Utilization Helpers + Financial Utils
**Complexity:** Large

### What it does
1. **Split `lib/audit-logger.ts`** (2,903 lines → 7 files):
   - `lib/audit/types.ts` — AuditAction type, auditActionLabels
   - `lib/audit/core.ts` — core logAudit function
   - `lib/audit/case.ts` — caseAudit, milestoneAudit, staffAudit, delayAudit, caseDeviceAudit
   - `lib/audit/admin.ts` — adminAudit, facilityAudit, userAudit, authAudit, featureAudit
   - `lib/audit/settings.ts` — roomAudit, roomScheduleAudit, procedureAudit, milestoneTypeAudit, phaseDefinitionAudit, phaseTemplateAudit, delayTypeAudit, cancellationReasonAudit, flagRuleAudit
   - `lib/audit/financial.ts` — costCategoryAudit, procedureCostItemAudit, surgeonCostItemAudit
   - `lib/audit/misc.ts` — blockScheduleAudit, facilityHolidayAudit, facilityClosureAudit, surgeonColorAudit, bodyRegionAudit, procedureCategoryAudit, implantCompanyAudit, deviceRepAudit, surgeonPrefAudit, notificationSettingsAudit, checkinAudit, dataQualityAudit
   - Delete original `audit-logger.ts`
   - Update ALL import paths across the codebase

2. **Extract block-utilization helpers** from `app/analytics/block-utilization/page.tsx` (2,125 lines):
   - `lib/analytics/blockUtilization.ts` (NEW) — resolveBlockDates, matchesRecurrence, resolveHolidayDates, getNthWeekdayOfMonth, matchCasesToBlocks, findCasesOutsideBlocks, getRoomScheduleForDate, calculateRoomUtilization, calculateWhatFits, calculateWeeklyTrends, median, utilizationColor, timeDiffMinutes, timeToMinutes, minutesToTimeStr, toDateStr, formatDuration, formatHours
   - Keep sub-components (UtilizationBar, BlockDayTimeline, WhatFitsPanel, etc.) in the page file but slimmed down
   - Target: page.tsx under 1,000 lines

3. **Extract financial helper functions**:
   - `lib/analytics/financialUtils.ts` (NEW) — computeSurgeonPayerMix, computeSurgeonProfitBins, and other shared helpers from SurgeonDetail.tsx and ProcedureDetail.tsx
   - Update both files to import from shared module

### Files touched
- `lib/audit-logger.ts` (DELETE)
- `lib/audit/types.ts` (NEW)
- `lib/audit/core.ts` (NEW)
- `lib/audit/case.ts` (NEW)
- `lib/audit/admin.ts` (NEW)
- `lib/audit/settings.ts` (NEW)
- `lib/audit/financial.ts` (NEW)
- `lib/audit/misc.ts` (NEW)
- `lib/analytics/blockUtilization.ts` (NEW)
- `lib/analytics/financialUtils.ts` (NEW)
- `app/analytics/block-utilization/page.tsx` (MODIFY — remove extracted helpers)
- `components/analytics/financials/SurgeonDetail.tsx` (MODIFY — import shared helpers)
- `components/analytics/financials/ProcedureDetail.tsx` (MODIFY — import shared helpers)
- All files importing from `audit-logger` (update import paths)

### Commit message
`refactor(lib): phase 5 — split audit-logger (34 objects) + extract block-utilization & financial helpers`

### 3-stage test gate
1. **Unit:** Each audit module exports correct functions. Block utilization calculations return same results when called from lib/.
2. **Integration:** Audit logging works end-to-end (create a case → verify audit log entry). Block utilization page renders correctly.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green.

---

## Phase 6: DAL Migration + Supabase Type Generation
**Complexity:** Large

### What it does
1. **Generate Supabase types** from database schema:
   - Run `supabase gen types typescript --local > lib/database.types.ts`
   - Update DAL layer (`lib/dal/cases.ts`, `users.ts`, `facilities.ts`, `lookups.ts`, `core.ts`) to use generated types
   - Eliminate ~200 `as unknown as T` type assertions

2. **Create DAL functions/hooks for 20 components** that currently call `createClient()` directly:
   - Group by domain and create focused hooks:
     - `lib/hooks/useGlobalSearch.ts` — for GlobalSearch.tsx
     - `lib/hooks/useCallNextPatient.ts` — for CallNextPatientModal.tsx
     - `lib/hooks/useFacilityLogo.ts` — for FacilityLogoUpload.tsx
   - For simpler cases, add functions to existing DAL files:
     - `lib/dal/cases.ts` — add functions for CaseForm, CancelCaseModal, CaseComplexitySelector
     - `lib/dal/users.ts` — add functions for InviteUserModal, StaffMultiSelect
     - `lib/dal/lookups.ts` — add functions for ImplantCompanySelect, SurgeonPreferenceSelect
     - `lib/dal/facilities.ts` — add functions for DeleteFacilityModal, DashboardLayout, Navbar
   - Update all 20 component files to use DAL/hooks instead of `createClient()`

3. **Create type guard utilities** for Supabase join handling:
   - `lib/supabase-helpers.ts` — `getSingle<T>()`, `getArray<T>()` for handling `T | T[] | null` join results
   - Replace ~30 manual join type assertions with helper calls

### Files touched
- `lib/database.types.ts` (NEW — generated)
- `lib/supabase-helpers.ts` (NEW)
- `lib/hooks/useGlobalSearch.ts` (NEW)
- `lib/hooks/useCallNextPatient.ts` (NEW)
- `lib/hooks/useFacilityLogo.ts` (NEW)
- `lib/dal/cases.ts` (MODIFY)
- `lib/dal/users.ts` (MODIFY)
- `lib/dal/lookups.ts` (MODIFY)
- `lib/dal/facilities.ts` (MODIFY)
- `lib/dal/core.ts` (MODIFY)
- 20 component files removing `createClient()` calls
- ~30 files with join type assertions → use helpers

### Commit message
`refactor(dal): phase 6 — generate Supabase types, migrate 20 components to DAL, add join type helpers`

### 3-stage test gate
1. **Unit:** Generated types compile. DAL functions return correctly typed data. Type guards handle all join shapes (single, array, null).
2. **Integration:** All 20 migrated components still fetch and display data correctly. No `createClient` imports remain in components/ directory.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green. Verify zero `as unknown` in DAL files.

---

## Phase 7: God Component Splitting (CaseForm, DataQualityPage, Case Detail)
**Complexity:** Large

### What it does
1. **Split `components/cases/CaseForm.tsx`** (1,507 lines → ~500 + hooks + sub-components):
   - `lib/hooks/useCaseFormState.ts` — form state management, draft handling, submission logic
   - `lib/hooks/useRoomConflicts.ts` — room conflict detection logic
   - `components/cases/form/CaseFormStaffSection.tsx` — staff multi-select + missing-anesthesia warning
   - `components/cases/form/CaseFormDeviceSection.tsx` — device rep selection + implant fields
   - `components/cases/form/CaseFormScheduleSection.tsx` — date, time, room, duration fields
   - `components/cases/CaseForm.tsx` — slim orchestrator (~500 lines)

2. **Split `components/data-quality/DataQualityPage.tsx`** (1,460 lines → ~400 + hooks):
   - `lib/hooks/useDataQualityIssues.ts` — issue fetching, filtering, resolution
   - `lib/hooks/useDataQualityScanner.ts` — scan trigger, progress tracking
   - `components/data-quality/DataQualityFilters.tsx` — filter bar sub-component
   - `components/data-quality/DataQualityActions.tsx` — bulk actions, scan button
   - `components/data-quality/DataQualityPage.tsx` — slim orchestrator (~400 lines)

3. **Split `app/cases/[id]/page.tsx`** (1,655 lines → ~600 + hooks + sub-components):
   - `lib/hooks/useCaseDetail.ts` — data fetching, realtime subscriptions
   - `lib/hooks/useCaseMilestones.ts` — milestone tracking, pace calculation
   - `components/cases/detail/CaseDetailTeamPanel.tsx` — staff display + management
   - `components/cases/detail/CaseDetailActivityPanel.tsx` — activity log, delay tracking
   - `app/cases/[id]/page.tsx` — slim orchestrator (~600 lines)

4. **Split `app/admin/docs/page.tsx`** (3,195 lines → ~800 + sub-components):
   - `components/admin/docs/PageFormModal.tsx` — page registration form
   - `components/admin/docs/ScannerModal.tsx` — drift detection scanner
   - `components/admin/docs/CategoryManagerModal.tsx` — category CRUD
   - `components/admin/docs/HealthPanel.tsx` — health analysis display
   - `components/admin/docs/DocsTabs.tsx` — OverviewTab, DatabaseTab, TriggersTab, PlatformTab, DependenciesTab
   - `lib/pageRegistryHelpers.ts` — analyzeHealth, isLayoutWrapper, splitComponents, getAllUniqueTablesCount
   - `app/admin/docs/page.tsx` — slim orchestrator (~800 lines)

### Files touched
- `lib/hooks/useCaseFormState.ts` (NEW)
- `lib/hooks/useRoomConflicts.ts` (NEW)
- `components/cases/form/CaseFormStaffSection.tsx` (NEW)
- `components/cases/form/CaseFormDeviceSection.tsx` (NEW)
- `components/cases/form/CaseFormScheduleSection.tsx` (NEW)
- `components/cases/CaseForm.tsx` (MODIFY — slim down)
- `lib/hooks/useDataQualityIssues.ts` (NEW)
- `lib/hooks/useDataQualityScanner.ts` (NEW)
- `components/data-quality/DataQualityFilters.tsx` (NEW)
- `components/data-quality/DataQualityActions.tsx` (NEW)
- `components/data-quality/DataQualityPage.tsx` (MODIFY — slim down)
- `lib/hooks/useCaseDetail.ts` (NEW)
- `lib/hooks/useCaseMilestones.ts` (NEW)
- `components/cases/detail/CaseDetailTeamPanel.tsx` (NEW)
- `components/cases/detail/CaseDetailActivityPanel.tsx` (NEW)
- `app/cases/[id]/page.tsx` (MODIFY — slim down)
- `components/admin/docs/PageFormModal.tsx` (NEW)
- `components/admin/docs/ScannerModal.tsx` (NEW)
- `components/admin/docs/CategoryManagerModal.tsx` (NEW)
- `components/admin/docs/HealthPanel.tsx` (NEW)
- `components/admin/docs/DocsTabs.tsx` (NEW)
- `lib/pageRegistryHelpers.ts` (NEW)
- `app/admin/docs/page.tsx` (MODIFY — slim down)

### Commit message
`refactor(components): phase 7 — split CaseForm, DataQualityPage, CaseDetail, AdminDocs into hooks + sub-components`

### 3-stage test gate
1. **Unit:** Each extracted hook returns correct state. Sub-components render in isolation with mock props.
2. **Integration:** CaseForm creates/edits cases correctly. DataQualityPage scans and resolves issues. Case detail page loads with realtime updates. Admin docs page manages registry.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green. Navigate through all affected pages to verify no visual regressions.

---

## Phase 8: Performance + React.memo + Dynamic Imports
**Complexity:** Medium

### What it does
1. **Add `React.memo`** to pure display components:
   - `components/ui/StatusBadge.tsx`
   - `components/ui/Badge.tsx`
   - `components/ui/ProcedureIcon.tsx`
   - `components/ui/DeltaBadge.tsx`
   - `components/ui/ProfitBadge.tsx`
   - `components/ui/TrendBadge.tsx` (from Phase 1)
   - `components/ui/MicroBar.tsx` (from Phase 1)
   - `components/ui/Spinner.tsx` (from Phase 1)
   - All Recharts tooltip components

2. **Dynamic import Recharts** on analytics pages:
   - `app/analytics/page.tsx`
   - `app/analytics/block-utilization/page.tsx`
   - `app/analytics/surgeons/page.tsx`
   - `app/analytics/flags/page.tsx`
   - `app/analytics/orbit-score/page.tsx`
   - Use `next/dynamic` with loading skeletons

3. **Memoize expensive render computations**:
   - `app/analytics/block-utilization/page.tsx` — wrap `.filter().map().sort()` chains in `useMemo`
   - `app/analytics/page.tsx` — memoize category chart data, daily case aggregations
   - `app/analytics/surgeons/page.tsx` — memoize sort operations
   - `app/settings/flags/page.tsx` — memoize tab construction from CATEGORY_ORDER

4. **Optimize UserContext**:
   - Consolidate 4 separate `useState` hooks into single state object
   - Prevents re-rendering all consumers on any individual state change
   - Replace `console.error` at line 143 with structured logger

5. **Replace raw `console.error` in UserContext** with structured logger

### Files touched
- 9 `components/ui/` files (add React.memo)
- 5 `app/analytics/` pages (dynamic Recharts import)
- 4 files with unmemoized computations (add useMemo)
- `lib/UserContext.tsx` (optimize state, fix console.error)

### Commit message
`perf: phase 8 — React.memo on 9 components, dynamic Recharts import, memoize analytics computations, optimize UserContext`

### 3-stage test gate
1. **Unit:** Memoized components only re-render when props change (test with React DevTools profiler). UserContext state updates don't trigger unnecessary consumer re-renders.
2. **Integration:** Analytics pages load correctly with dynamic Recharts (skeleton → chart transition works). All memoized computations produce correct results.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green. Measure bundle size reduction from dynamic imports. Navigate analytics pages to verify loading experience is smooth.

---

## Phase 9: Final Polish + Comprehensive Test Pass
**Complexity:** Medium

### What it does
1. **Move Context files** to proper directory:
   - `lib/UserContext.tsx` → `contexts/UserContext.tsx`
   - `lib/SubNavContext.tsx` → `contexts/SubNavContext.tsx`
   - `lib/BreadcrumbContext.tsx` → `contexts/BreadcrumbContext.tsx`
   - Update all import paths

2. **Clean up unused exports** — after all splits, verify no dead code remains in original file locations

3. **Verify file size targets**:
   - No component file over 800 lines
   - No page file over 1,500 lines
   - No lib file over 1,500 lines
   - Verify all god components are under 600 lines

4. **Full test suite** — `npm run typecheck && npm run lint && npm run test`

5. **Visual regression check** — navigate every major page and verify consistency:
   - Dashboard → all KPI cards consistent
   - Analytics hub → cards match dashboard style
   - Analytics flags → cards match dashboard style
   - Financials → cards consistent
   - Data quality → spinners and empty states consistent
   - Case detail → no visual regressions
   - All settings pages → consistent patterns

### Files touched
- `lib/UserContext.tsx` → `contexts/UserContext.tsx` (MOVE)
- `lib/SubNavContext.tsx` → `contexts/SubNavContext.tsx` (MOVE)
- `lib/BreadcrumbContext.tsx` → `contexts/BreadcrumbContext.tsx` (MOVE)
- All files importing these contexts (update paths)
- Any remaining cleanup from prior phases

### Commit message
`refactor: phase 9 — move contexts, verify file sizes, final cleanup and visual regression check`

### 3-stage test gate
1. **Unit:** All context imports resolve correctly. No dead code exports.
2. **Integration:** All pages render correctly after context path changes.
3. **Workflow:** Full pass: `npm run typecheck && npm run lint && npm run test` — all green. Manual visual walk-through of every major page confirms consistency.

---

## Dependency Chain
```
Phase 1 (Primitives + tokens)
  → Phase 2 (Formatting + Sparkline dedup)
  → Phase 3 (Card unification + adoption sweep)  ← depends on Phase 1 primitives
  → Phase 4 (Split AnalyticsComponents + analyticsV2)
  → Phase 5 (Split audit-logger + block-util + financial helpers)
  → Phase 6 (DAL migration + Supabase types)
  → Phase 7 (God component splitting)
  → Phase 8 (Performance + React.memo)
  → Phase 9 (Final polish + verification)
```
Phases 4-6 are independent of each other and could theoretically run in any order, but the listed order groups related work logically. Phases 1-3 must run first (they create the primitives). Phase 7 depends on Phase 6 (DAL hooks used by extracted component hooks). Phase 8-9 come last as polish.
