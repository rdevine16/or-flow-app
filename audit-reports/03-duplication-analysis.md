# Near-Duplicate Detection — ORbit Codebase Audit (Report 03 of 08)

## Summary

Found **89 duplication instances** across 15 categories covering both the Next.js web app and SwiftUI iOS app. The highest-impact duplications are in KPI/metric cards (8+ variants), status badges (10+ variants), and inline PageClient helpers (50+ instances).

### Severity Breakdown

| Severity | Count | Criteria |
|----------|-------|----------|
| :red_circle: Critical | 5 categories | 5+ instances or causes inconsistency bugs |
| :yellow_circle: Moderate | 5 categories | 3-4 instances or growing pattern |
| :green_circle: Minor | 3 categories | 2 instances, already manageable |
| :white_check_mark: Consolidated | 2 categories | No action needed |

---

## 1. Loading/Skeleton States

### :red_circle: CRITICAL — Skeleton Card Patterns (12+ instances)

**Web App:**
| File | Component | Type |
|------|-----------|------|
| `components/ui/Skeleton.tsx` | `SkeletonMetricCard`, `SkeletonCaseCard`, `SkeletonChart`, `SkeletonTable`, `SkeletonText`, `SkeletonProfile`, `SkeletonPage` | Shared |
| `components/ui/Loading.tsx` | `Spinner`, `PageLoader`, `LoadingOverlay` | Shared |
| `app/admin/facilities/[id]/PageClient.tsx:129` | `StatCardSkeleton` | Inline |
| `components/dashboard/DashboardKpiCard.tsx:64-75` | Inline skeleton loading state | Inline |
| `components/ui/MetricCard.tsx:113-123` | Inline skeleton loading state | Inline |

**iOS App:**
| File | Component | Type |
|------|-----------|------|
| `Components/SkeletonView.swift` | `SkeletonRoomCard`, `SkeletonCaseCard`, `SkeletonRoomsList`, `SkeletonCasesList` | Shared |
| `Components/LoadingView.swift` | `LoadingView`, `EmptyStateView`, `ErrorView` | Shared |
| `Features/SurgeonHome/ORbitScoreCard.swift:252-287` | `SkeletonScoreCard` | Inline |

**What's identical:** Pulse/shimmer animation, container-with-placeholder-rectangles structure, rounded corners.

**What varies:** Hardcoded dimensions per card type, web uses CSS `animate-pulse` vs iOS explicit animations, different opacity/color values.

**Recommendation:** Consolidate inline skeletons into the existing `Skeleton.tsx` variant system. Add a `variant` prop for `metricCard`, `caseCard`, `chart`. On iOS, move `SkeletonScoreCard` into `SkeletonView.swift`.

```typescript
// Before (inline in DashboardKpiCard.tsx)
<div className="animate-pulse space-y-2">
  <div className="h-4 bg-slate-200 rounded w-1/3" />
  <div className="h-8 bg-slate-200 rounded w-2/3" />
</div>

// After (shared component)
<SkeletonMetricCard />
```

---

## 2. Empty States

### :yellow_circle: MODERATE — Empty State Patterns (4 instances)

**Web App:**
- `components/ui/EmptyState.tsx` — Centralized component with icon + title + description + action button
- `components/ui/Skeleton.tsx:217-247` — `ErrorState` component (misplaced; should be in EmptyState.tsx)
- Multiple inline empty states in PageClient files

**iOS App:**
- `Components/LoadingView.swift:22-69` — `EmptyStateView`
- `Features/SurgeonHome/ORbitScoreCard.swift:226-248` — `EmptyScoreCard` (inline)

**What's identical:** Icon + title + description + optional action, centered layout, gray color scheme.

**What varies:** Icon sizes (32-80px), padding values, some have containers vs transparent background.

**Recommendation:** Web is mostly consolidated. Move `ErrorState` from `Skeleton.tsx` to `EmptyState.tsx`. On iOS, extract `EmptyScoreCard` pattern into `EmptyStateView` with variants.

---

## 3. Error Displays

### :green_circle: MINOR — Error Banner/Alert (2 instances)

**Web:** `components/ui/ErrorBanner.tsx` (inline banner) + `Skeleton.tsx:217` `ErrorState` (full-page)
**iOS:** `Components/LoadingView.swift:72-113` `ErrorView`

**What's identical:** AlertCircle icon, red color scheme, optional retry button.
**What varies:** Web has banner + full-page variants; iOS only full-page.

**Recommendation:** Already well-consolidated. No action needed.

---

## 4. Modal/Dialog Wrappers

### :green_circle: MINOR — Modal Structure (2 core components)

- `components/ui/Modal.tsx` — Generic modal with header/body/footer, compound component pattern
- `components/ui/ConfirmDialog.tsx` — Specialized confirm with variants (`DeleteConfirm`, `LeaveConfirm`, `ArchiveConfirm`) + `useConfirmDialog` hook

**What's identical:** Portal rendering, backdrop, escape-to-close, body scroll lock, fade animation.
**What varies:** Modal is generic (custom children), ConfirmDialog is opinionated (icon + message + 2 buttons).

**Recommendation:** Already well-consolidated. These are complementary, not duplicates. Keep both.

---

## 5. Form Field Components — Searchable Dropdown Pattern

### :yellow_circle: MODERATE — (3-4 instances)

| File | Component | Distinguishing Feature |
|------|-----------|----------------------|
| `components/ui/SearchableDropdown.tsx` | `SearchableDropdown` | Generic, centralized |
| `components/analytics/AnalyticsComponents.tsx:256-332` | `SurgeonSelector` | Avatar initials in dropdown |
| Multiple PageClient files | Inline select/filter dropdowns | Various |

**What's identical:** Dropdown trigger + search input + filtered list + click-outside-to-close.
**What varies:** SurgeonSelector adds avatar initials, some use native `<select>`.

**Recommendation:** Extract SurgeonSelector's avatar pattern into a `renderOption` prop on `SearchableDropdown`:
```typescript
<SearchableDropdown
  options={surgeons}
  renderOption={(s) => <Avatar name={s.name} size="sm" />}
/>
```

---

## 6. Card/List Item Layouts — KPI/Metric Cards

### :red_circle: CRITICAL — Metric/KPI Card Pattern (8+ instances)

This is the single highest-impact duplication in the codebase.

| File | Component | Animation | Trend | Icon | Accent | Sparkline | Progress |
|------|-----------|-----------|-------|------|--------|-----------|----------|
| `components/ui/MetricCard.tsx` | `MetricCard` | Count-up | Pill | - | - | - | - |
| `components/ui/MetricCard.tsx:156` | `MetricCardCompact` | - | - | - | - | - | - |
| `components/dashboard/DashboardKpiCard.tsx` | `DashboardKpiCard` | - | Inline | - | - | Sparkline | Target bar |
| `components/analytics/AnalyticsComponents.tsx:70-145` | `EnhancedMetricCard` | - | Pill | Icon | Top bar | - | Radial |
| `app/analytics/PageClient.tsx:183-235` | `QuickStatCard` | - | - | Icon | - | - | - |
| `app/admin/facilities/[id]/PageClient.tsx:174-218` | `StatCard` | - | Inline | Icon | - | - | - |
| `components/analytics/flags/FlagDrillThrough.tsx:336-349` | `StatCard` | - | - | - | - | - | - |
| `app/analytics/orbit-score/PageClient.tsx:229-378` | `SurgeonCard` | - | - | - | - | - | Score gauge |

**What's identical across ALL variants:**
- Small gray uppercase title text
- Large bold value (24-48px)
- Optional subtitle/secondary value
- White background + border + rounded corners + shadow

**Recommendation:** Consolidate into unified `KPICard` with feature flags:

```typescript
interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; improved: boolean }
  icon?: React.ReactNode
  accent?: 'blue' | 'green' | 'red' | 'amber'
  sparkline?: number[]
  progress?: { value: number; target: number }
  animated?: boolean
  compact?: boolean
}
```

Keep 3 variants: `KPICard` (full), `KPICardCompact` (horizontal), `KPICardSkeleton` (loading).

---

## 7. Status Badges/Pills

### :red_circle: CRITICAL — Badge Pattern Explosion (10+ instances)

| File | Component | Purpose |
|------|-----------|---------|
| `components/ui/Badge.tsx` | `Badge` | Base badge (variant + size) |
| `components/ui/StatusBadge.tsx` | `StatusBadge` | Case status (scheduled/in_progress/completed) |
| `components/ui/StatusBadge.tsx:45` | `StatusBadgeDot` | Status with dot indicator |
| `components/ui/PhaseBadge.tsx` | `PhaseBadge` | Surgical phase |
| `components/ui/StatusIndicator.tsx` | `StatusIndicator` | Room status with glowing dot |
| `components/ui/StaffBadge.tsx` | `StaffBadge` | Staff member + avatar + role |
| `components/cases/FlagBadge.tsx` | `FlagBadge` | Flag severity (critical/warning/info) |
| `components/ui/DeltaBadge.tsx` | `DeltaBadge` | Trend (faster/slower/on-pace) with arrow |
| `components/ui/ProfitBadge.tsx` | `ProfitBadge` | Margin rating (excellent/good/fair/poor) |
| `components/cases/ImplantBadge.tsx` | `ImplantBadge` | Implant type |
| `components/analytics/AnalyticsComponents.tsx:152-175` | `TrendPill` | Inline trend pill |
| **iOS:** `Components/StatusBadge.swift` | `StatusBadge` | Status with size variants |
| **iOS:** `Features/SurgeonHome/ORbitScoreCard.swift:122` | `TrendBadge` | Inline trend badge |

**What's identical:** Pill shape, small text (10-12px), color-coded background + text, optional icon/dot.
**What varies:** Text case (UPPERCASE vs Title), padding (px-2 to px-3), border (some have, some don't).

**Recommendation:** Group into 3 semantic badge types:
1. **Badge** (base) — keep existing
2. **StatusBadge** — consolidate `StatusBadge` + `StatusIndicator` + `PhaseBadge`
3. **MetricBadge** — consolidate `DeltaBadge` + `TrendPill` + `ProfitBadge`

Keep specialized: `StaffBadge`, `FlagBadge`, `ImplantBadge` (too different to generalize).

---

## 8. Table Column Renderers

### :green_circle: MINOR — No Significant Duplication

Most table rendering uses shared components or inline cells with minimal duplication. No action needed.

---

## 9. Chart Wrapper Components

### :yellow_circle: MODERATE — ResponsiveContainer + Chart Boilerplate (30+ instances)

Found 30+ files using Recharts with identical boilerplate:

**Repeated pattern in every chart file:**
```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <RechartsTooltip content={<CustomTooltip />} />
    ...
  </BarChart>
</ResponsiveContainer>
```

**Top files:** `app/analytics/block-utilization/PageClient.tsx`, `app/analytics/surgeons/PageClient.tsx`, `app/analytics/flags/PageClient.tsx`, `components/dashboard/DashboardKpiCard.tsx`

**What's identical:** ResponsiveContainer wrapper, tooltip config, axis styling (font size, colors), CartesianGrid dash pattern.
**What varies:** Chart type, height, color schemes, tooltip formatters.

**Recommendation:** Extract chart wrapper utilities with pre-configured defaults:

```typescript
// components/analytics/ChartWrapper.tsx
<ChartWrapper height={400} type="bar">
  {/* Only custom bars/lines — grid, axes, tooltip are pre-configured */}
</ChartWrapper>

// For sparklines in cards
<SparklineChart data={data} color="#3b82f6" />
```

---

## 10. Navigation Elements

### :green_circle: MINOR — Already Well-Consolidated

- `components/layouts/Header.tsx` — Main breadcrumb system
- `components/analytics/AnalyticsBreadcrumb.tsx` — Analytics-specific wrapper

These are complementary, not duplicates. No action needed.

---

## 11. Section Headers

### :yellow_circle: MODERATE — Section Header Pattern (20+ inline instances)

**Shared component exists:** `components/analytics/AnalyticsComponents.tsx:18-60` — `SectionHeader` (title + subtitle + icon + action + accent border)

**But NOT used in most PageClient files.** Instead, inline headers repeat this pattern:

```tsx
// Inline pattern found in 20+ PageClient files
<div className="flex items-center justify-between mb-6">
  <h2 className="text-lg font-semibold text-slate-900">Room Utilization</h2>
  <button>...</button>
</div>
```

**Recommendation:** Adopt the existing `SectionHeader` component across all PageClient files. No new component needed — just adoption.

---

## 12. Filter Bars

### :green_circle: MINOR — Possible Filename Duplicate

- `components/cases/CasesFilterBar.tsx` (569 LOC)
- `components/filters/CaseFilterBar.tsx` (825 LOC)

These may be duplicates or one may be deprecated. Verify and merge if overlapping.

---

## 13. Tooltip Patterns

### :white_check_mark: CONSOLIDATED — Model for Other Categories

`components/ui/Tooltip.tsx` exports 5 well-designed variants: `Tooltip`, `InfoTooltip`, `TooltipIconButton`, `TooltipHelp`, `TooltipTruncate`. No duplication detected. This is the gold standard for component consolidation.

---

## 14. Inline Helper Components in PageClient Files

### :red_circle: CRITICAL — 50+ Inline Helper Components

The largest source of duplication is helper components defined inside PageClient files rather than extracted as shared components.

**Highest-density files:**

| Route | LOC | Helpers | Helper Names |
|-------|-----|---------|-------------|
| `/analytics/block-utilization/` | 2,125 | 9 | UtilizationTooltip, HoursTooltip, UtilizationBar, BlockDayTimeline, WhatFitsPanel, SurgeonUtilizationRow, RoomUtilizationRow, CapacityInsightBanner, SkeletonBlockUtilization |
| `/analytics/` | 1,313 | 7 | ReportCard, QuickStatCard, CombinedTurnoverCard, SectionHeader, CaseVolumeTooltip, ComparisonTooltip, FlipRoomModal |
| `/analytics/orbit-score/` | ~900 | 6 | TrendIndicator, PillarBar, SurgeonCard, RecommendationCard, FacilitySummary, PillarLegend |
| `/admin/settings/hl7v2-test-harness/` | 1,308 | 6 | ScenarioTab, DatabaseScenarioPanel, AlgorithmicScenarioPanel, PreviewPanel, ResultsPanel, EntityPoolsTab |
| `/analytics/surgeons/` | 1,512 | 5 | CompactStat, StatDivider, MiniUptimeRing, CaseVolumeTooltip, ComparisonTooltip |
| `/admin/facilities/[id]/` | 1,656 | 4 | StatCardSkeleton, StatCard, UsageBar + other |
| `/checkin/` | 950 | 3 | CheckInRow, CheckInDetailModal + other |
| `/settings/closures/` | 902 | 4 | HolidayRow, ClosureRow + dialogs |

**Cross-page structural duplicates identified:**

| Pattern | Files Using It | Shared? |
|---------|---------------|---------|
| `StatCard` / `QuickStatCard` | 6+ PageClient files | No — all inline |
| `Tooltip` formatters (CaseVolumeTooltip, ComparisonTooltip) | 3+ analytics pages | No — duplicated |
| `Row` components (SurgeonRow, ClosureRow, HolidayRow) | 5+ settings pages | No — all inline |
| `Skeleton` loaders | 4+ PageClient files | No — all inline |

**Recommendation:**
1. **StatCard variants** → Already covered in Section 6 (KPICard consolidation)
2. **Recharts tooltip formatters** → Extract shared `ChartTooltip` components
3. **Settings row components** → Extract `SettingsRow` wrapper for list items with edit/delete actions
4. **Inline skeletons** → Move to existing `Skeleton.tsx` variant system

---

## 15. iOS-Specific Duplicates

### :yellow_circle: MODERATE — Card View Patterns (5+ instances)

**Identical modifier chain found in 10+ iOS files:**
```swift
.padding(OrbitSpacing.lg)
.background(Color(.secondarySystemGroupedBackground))
.cornerRadius(OrbitRadius.lg)
.shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
```

**Files using this pattern:** `ProgressCard.swift`, `ScheduledCard.swift`, `ORbitScoreCard.swift`, `RepCaseCard.swift`, `EnterpriseTimeCards.swift`, and more.

**Recommendation:** Extract `OrbitCard` wrapper view and `.orbitCardStyle()` view modifier:

```swift
// View modifier
extension View {
  func orbitCardStyle() -> some View {
    self
      .padding(OrbitSpacing.lg)
      .background(Color(.secondarySystemGroupedBackground))
      .cornerRadius(OrbitRadius.lg)
      .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
  }
}

// Generic wrapper
struct OrbitCard<Content: View>: View {
  let title: String?
  @ViewBuilder let content: () -> Content

  var body: some View {
    VStack(alignment: .leading, spacing: OrbitSpacing.lg) {
      if let title {
        Text(title)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.orbitSlate)
      }
      content()
    }
    .orbitCardStyle()
  }
}
```

### :yellow_circle: MODERATE — iOS Button Styling (8+ instances)

```swift
.font(OrbitFont.headline())
.foregroundColor(.white)
.padding(.horizontal, OrbitSpacing.xl)
.padding(.vertical, OrbitSpacing.md)
.background(Color.orbitPrimary)
.cornerRadius(OrbitRadius.md)
```

**Recommendation:** Extract `.orbitPrimaryButton()` and `.orbitSecondaryButton()` view modifiers.

### :yellow_circle: MODERATE — iOS Section Header (6+ instances)

```swift
.font(.system(size: 12, weight: .semibold))
.foregroundColor(.orbitSlate)
```

**Recommendation:** Extract `.orbitSectionHeader()` view modifier.

---

## Priority Summary

### Top 5 Extractions by Impact

| Priority | Pattern | Instances | Affected Files | Effort |
|----------|---------|-----------|---------------|--------|
| 1 | KPI/Metric Card unification | 8+ components | 6+ pages | L |
| 2 | Badge system consolidation | 10+ variants | 15+ files | M |
| 3 | PageClient helper extraction | 50+ helpers | 15+ pages | XL |
| 4 | Chart wrapper utilities | 30+ charts | 10+ pages | M |
| 5 | iOS view modifier extraction | 10+ chains | 20+ views | S |

### Cross-Platform Parity Issues

| Pattern | Web | iOS | Gap |
|---------|-----|-----|-----|
| Shared card wrapper | `Card` / `CardEnhanced` (exists) | None | iOS needs `OrbitCard` |
| Badge system | 10+ variants | 2 variants | Both need consolidation |
| Section headers | `SectionHeader` (exists, underused) | None shared | Both need adoption |
| Loading states | `Skeleton.tsx` (exists, inline bypassed) | `SkeletonView.swift` (exists, inline bypassed) | Both need enforcement |

---

*Generated by Phase 2A of ORbit Component Audit*
*Next: Phase 2B — Tailwind Pattern Duplication*
