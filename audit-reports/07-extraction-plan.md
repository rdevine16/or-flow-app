# Extraction Recommendations — ORbit Codebase Audit (Report 07 of 08)

## Summary

This report synthesizes findings from Reports 01-06 into a prioritized extraction plan. Every duplication, inline definition, and missing component is categorized by impact and effort.

### Extraction Counts by Tier

| Tier | Components | Occurrences Affected | Estimated Effort |
|------|-----------|---------------------|-----------------|
| **P0 — Extract Immediately** | 6 | 460+ | L (3-5 days) |
| **P1 — Extract Soon** | 8 | 320+ | M (2-3 days) |
| **P2 — Extract When Touched** | 7 | 150+ | S (1-2 days) |
| **P3 — Keep Inline** | 12 categories | — | None |
| **Total** | 21 new/consolidated components | 930+ occurrences | 6-10 days |

---

## P0 — Extract Immediately

> Used 5+ times, or duplicated with bugs/inconsistencies. These cause active inconsistency in the UI.

---

### P0-1. KPICard — Unified Metric/KPI Card

**Severity:** :red_circle: CRITICAL — 8+ variants, 6+ pages, most duplicated pattern in the codebase

**Current locations (all doing the same thing differently):**

| File | Component | LOC | Unique Feature |
|------|-----------|-----|----------------|
| `components/ui/MetricCard.tsx` | `MetricCard` | 187 | Gradient text, count-up animation |
| `components/ui/MetricCard.tsx:156` | `MetricCardCompact` | — | Horizontal layout |
| `components/dashboard/DashboardKpiCard.tsx` | `DashboardKpiCard` | 158 | Status dot, Recharts sparkline, target bar |
| `components/analytics/AnalyticsComponents.tsx:70-145` | `EnhancedMetricCard` | ~75 | Top accent bar, icon badge, radial progress |
| `app/analytics/PageClient.tsx:183-235` | `QuickStatCard` | ~52 | Inline, monospace font, sparkline |
| `app/admin/facilities/[id]/PageClient.tsx:174-218` | `StatCard` | ~44 | Inline, icon top-right, minimal |
| `components/analytics/flags/FlagDrillThrough.tsx:336-349` | `StatCard` | ~14 | Inline, highlight variant |
| `app/analytics/orbit-score/PageClient.tsx:229-378` | `SurgeonCard` | ~149 | Score gauge, complex layout |

**What's identical across ALL variants:**
- White background + rounded-xl + border + shadow-sm
- Small gray title text (text-xs/sm, text-slate-500)
- Large bold value (text-2xl font-bold text-slate-900)
- Optional subtitle/secondary value
- Optional trend indicator (up/down arrow with color)

**What varies (→ becomes props):**
- Trend display: badge vs inline text vs pill → `trendStyle` prop
- Icon placement: none vs top-right → `icon` prop
- Accent: none vs top bar vs gradient text → `accent` prop
- Data viz: none vs sparkline vs progress bar → `sparkline` / `progress` props
- Animation: count-up vs static → `animated` prop

**Proposed component API:**

```typescript
// components/ui/KPICard.tsx

interface KPICardProps {
  /** Small gray title above the value */
  title: string
  /** The main metric value */
  value: string | number
  /** Optional formatted subtitle below value */
  subtitle?: string
  /** Trend indicator */
  trend?: {
    value: number
    direction: 'up' | 'down' | 'unchanged'
    /** Whether increase is good (green) or bad (red) */
    improved?: boolean
    label?: string
  }
  /** Icon displayed in top-right corner */
  icon?: React.ReactNode
  /** Accent color for top bar or icon background */
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate'
  /** Sparkline data points rendered in top-right */
  sparkline?: number[]
  sparklineColor?: string
  /** Progress toward a target */
  progress?: { value: number; target: number; label?: string }
  /** Tooltip text on the title */
  tooltip?: string
  /** Enable count-up animation on value */
  animated?: boolean
  /** Compact horizontal layout */
  compact?: boolean
  /** Loading skeleton state */
  loading?: boolean
  /** Optional className override */
  className?: string
}

export function KPICard(props: KPICardProps): JSX.Element
export function KPICardCompact(props: Omit<KPICardProps, 'compact'>): JSX.Element
export function KPICardSkeleton(props: { compact?: boolean }): JSX.Element
export function KPICardGrid(props: { children: React.ReactNode; columns?: 2 | 3 | 4 }): JSX.Element
```

**Before → After example:**

```tsx
// BEFORE: app/admin/facilities/[id]/PageClient.tsx (inline StatCard)
function StatCard({ label, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>{icon}</div>
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {trend && <span className="text-xs">↑ {trend.value}%</span>}
    </div>
  )
}

// AFTER: Shared import
import { KPICard } from '@/components/ui/KPICard'

<KPICard
  title="Active Cases"
  value={42}
  icon={<Activity className="w-4 h-4" />}
  accent="blue"
  trend={{ value: 12, direction: 'up', improved: true }}
/>
```

**Migration steps:**
1. Create `components/ui/KPICard.tsx` with the unified API
2. Add `KPICardSkeleton` to replace 4+ inline skeleton patterns
3. Migrate `DashboardKpiCard` consumers first (highest-traffic page)
4. Migrate `EnhancedMetricCard` consumers in analytics
5. Remove inline `StatCard`/`QuickStatCard` from 6+ PageClient files
6. Deprecate `MetricCard.tsx` and `DashboardKpiCard.tsx` (keep as re-exports for transition)
7. Update barrel file

**Effort:** L (8-12 hours) — many consumers to migrate

---

### P0-2. IconContainer — Colored Icon Wrapper

**Severity:** :red_circle: CRITICAL — 233+ inline occurrences across 20+ files

**Current inline pattern (repeated everywhere):**

```tsx
// Found in 233+ places with slight variations
<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
  <Clock className="w-4 h-4" />
</div>

// Variations: w-10/h-10, w-12/h-12, rounded-full, bg-green-100, etc.
```

**Top files:** `AnalyticsComponents.tsx` (15), `TemplateBuilder.tsx` (10), `CaseForm.tsx` (8), `analytics/PageClient.tsx` (7), `EnhancedRoomCard.tsx` (6)

**Proposed component API:**

```typescript
// components/ui/IconContainer.tsx

interface IconContainerProps {
  /** Icon size: xs=20px, sm=32px, md=40px, lg=48px */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Background + text color */
  variant?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate' | 'teal'
  /** Border radius: md, lg, xl, full */
  rounded?: 'md' | 'lg' | 'xl' | 'full'
  /** The icon element (lucide-react icon) */
  children: React.ReactNode
  className?: string
}
```

**Before → After:**

```tsx
// BEFORE
<div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
  <CheckCircle className="w-5 h-5" />
</div>

// AFTER
<IconContainer size="md" variant="green">
  <CheckCircle className="w-5 h-5" />
</IconContainer>
```

**Migration steps:**
1. Create `components/ui/IconContainer.tsx` with size/variant config objects using design tokens
2. Add to UI barrel file
3. Refactor top-5 files first (AnalyticsComponents, TemplateBuilder, CaseForm)
4. Grep for `rounded-lg flex items-center justify-center bg-` to find remaining instances

**Effort:** M (4-6 hours)

---

### P0-3. ChartWrapper — Recharts Boilerplate Elimination

**Severity:** :red_circle: CRITICAL — 30+ files with identical Recharts setup

**Current repeated pattern:**

```tsx
// Copied in 30+ chart files with minor variations
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <RechartsTooltip content={<CustomTooltip />} />
    {/* Only this part differs per chart */}
  </BarChart>
</ResponsiveContainer>
```

**Top files:** `block-utilization/PageClient.tsx`, `surgeons/PageClient.tsx`, `flags/PageClient.tsx`, `DashboardKpiCard.tsx`

**Proposed component API:**

```typescript
// components/analytics/ChartWrapper.tsx

interface ChartWrapperProps {
  /** Chart height in pixels */
  height?: number
  /** Data array for the chart */
  data: Record<string, unknown>[]
  /** X-axis data key */
  xKey?: string
  /** Chart type determines wrapper component */
  type?: 'bar' | 'line' | 'area' | 'composed'
  /** Custom tooltip component */
  tooltip?: React.ReactElement
  /** Show grid lines */
  grid?: boolean
  /** Custom Y-axis formatter */
  yFormatter?: (value: number) => string
  /** The chart-specific children (Bar, Line, Area elements) */
  children: React.ReactNode
  /** Loading state */
  loading?: boolean
  /** Empty state message */
  emptyMessage?: string
  className?: string
}

// For inline sparklines in cards
interface SparklineChartProps {
  data: number[]
  color?: string
  height?: number
  width?: number
  showArea?: boolean
}

export function ChartWrapper(props: ChartWrapperProps): JSX.Element
export function SparklineChart(props: SparklineChartProps): JSX.Element
```

**Before → After:**

```tsx
// BEFORE: 15+ lines of Recharts boilerplate per chart
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
    <RechartsTooltip content={<CustomTooltip />} />
    <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} />
  </BarChart>
</ResponsiveContainer>

// AFTER: 4 lines — only the custom parts
<ChartWrapper data={data} xKey="date" tooltip={<CustomTooltip />}>
  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
</ChartWrapper>
```

**Migration steps:**
1. Create `components/analytics/ChartWrapper.tsx` with pre-configured defaults
2. Create `components/analytics/SparklineChart.tsx` for card-embedded sparklines
3. Migrate analytics pages first (highest density of charts)
4. Migrate dashboard charts
5. Add to analytics barrel file

**Effort:** M (4-6 hours)

---

### P0-4. Badge Adoption Enforcement

**Severity:** :red_circle: CRITICAL — 124+ inline badge patterns bypassing existing `Badge.tsx`

**Current state:** `components/ui/Badge.tsx` exists with `badgeVariants` from design tokens, but 124+ files use inline class strings instead.

**Inline pattern found 124+ times:**

```tsx
// Inline badge (8+ color variants)
<span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-green-50 text-green-700">
  Active
</span>
```

**Top files:** `AnalyticsComponents.tsx` (12), `ReviewDetailPanel.tsx` (8), `CaseFlagsSection.tsx` (6), `surgeons/PageClient.tsx` (5)

**This is NOT a new component — it's an adoption problem.** The existing `Badge` component needs:
1. Any missing color variants added (verify: green, orange, blue, red, amber, violet, slate, teal)
2. Optional `dot` prop for StatusBadgeDot pattern
3. Optional `icon` prop for leading icon

**Proposed additions to existing Badge:**

```typescript
// Additions to existing components/ui/Badge.tsx

interface BadgeProps {
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'violet' | 'teal'
  size?: 'sm' | 'md'
  /** Show colored dot before text */
  dot?: boolean
  /** Leading icon element */
  icon?: React.ReactNode
  children: React.ReactNode
}
```

**Migration steps:**
1. Audit `Badge.tsx` for missing variants — add any missing colors
2. Add `dot` and `icon` props if not present
3. Grep for `rounded-full.*text-xs.*font-semibold` and `rounded-full.*font-medium` to find all inline badges
4. Refactor file-by-file, starting with highest-density files
5. Add ESLint disable comment or codemod note for enforcement

**Effort:** M (3-5 hours)

---

### P0-5. AnalyticsComponents.tsx Decomposition

**Severity:** :red_circle: CRITICAL — 2,193 LOC, 37 exports, largest single file

**Current state:** A mega-file containing 37 exported components that should each be individual files. This is the single biggest structural debt in the codebase.

**Components to extract (grouped by purpose):**

| Group | Components | Target Directory |
|-------|-----------|-----------------|
| Layout | `SectionHeader`, `PageGrid`, `AnalyticsLayout` | `components/analytics/layout/` |
| Metric Cards | `EnhancedMetricCard`, `MetricRow` | Merge into P0-1 KPICard |
| Selectors | `SurgeonSelector`, `DateQuickFilter` | `components/analytics/filters/` |
| Trend | `TrendPill`, `TrendArrow`, `ComparisonRow` | `components/analytics/trend/` |
| Data Viz | `MiniChart`, `HorizontalBar`, `DonutChart` | `components/analytics/charts/` |
| Utility | Remaining helpers | `components/analytics/shared/` |

**Migration steps:**
1. Create subdirectory structure under `components/analytics/`
2. Extract each component to its own file, preserving all imports and types
3. Create `components/analytics/index.ts` barrel that re-exports everything (maintains backward compatibility)
4. Update the 15+ files that import from `AnalyticsComponents.tsx` to use new paths
5. Delete `AnalyticsComponents.tsx` once all consumers migrated
6. Merge `EnhancedMetricCard` and `TrendPill` into KPICard (P0-1) if that runs in parallel

**Effort:** L (6-8 hours) — many files to touch, but mechanical work

---

### P0-6. iOS OrbitCard + .orbitCardStyle() Modifier

**Severity:** :red_circle: CRITICAL — 10+ files with identical modifier chain, no shared card wrapper

**Current repeated pattern in 10+ iOS files:**

```swift
.frame(maxWidth: .infinity, alignment: .leading)
.padding(OrbitSpacing.lg)
.background(Color(.secondarySystemGroupedBackground))
.cornerRadius(OrbitRadius.lg)
.padding(.horizontal, OrbitSpacing.lg)
```

**Files using this pattern:** `ProgressCard.swift`, `ScheduledCard.swift`, `ORbitScoreCard.swift`, `RepCaseCard.swift`, `EnterpriseTimeCards.swift`, `InsightSection.swift`, and more.

**Proposed implementation:**

```swift
// Components/OrbitCard.swift

// View modifier for existing views
extension View {
    func orbitCardStyle(padding: CGFloat = OrbitSpacing.lg) -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(Color(.secondarySystemGroupedBackground))
            .cornerRadius(OrbitRadius.lg)
    }
}

// Wrapper component for new views
struct OrbitCard<Content: View>: View {
    let title: String?
    let padding: CGFloat
    @ViewBuilder let content: () -> Content

    init(title: String? = nil, padding: CGFloat = OrbitSpacing.lg, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.padding = padding
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OrbitSpacing.md) {
            if let title {
                Text(title)
                    .font(OrbitFont.caption())
                    .foregroundColor(.orbitSlate)
            }
            content()
        }
        .orbitCardStyle(padding: padding)
    }
}
```

**Before → After:**

```swift
// BEFORE
VStack(alignment: .leading, spacing: OrbitSpacing.md) {
    Text("Progress")
        .font(OrbitFont.caption())
        .foregroundColor(.orbitSlate)
    // content...
}
.frame(maxWidth: .infinity, alignment: .leading)
.padding(OrbitSpacing.lg)
.background(Color(.secondarySystemGroupedBackground))
.cornerRadius(OrbitRadius.lg)

// AFTER
OrbitCard(title: "Progress") {
    // content...
}
```

**Migration steps:**
1. Create `Components/OrbitCard.swift` with modifier + wrapper
2. Migrate SurgeonHome views first (ProgressCard, ScheduledCard, ORbitScoreCard)
3. Migrate DeviceRep views
4. Grep for `.cornerRadius(OrbitRadius.lg)` to find remaining instances

**Effort:** S (2-3 hours)

---

## P1 — Extract Soon

> Used 3-4 times, or growing pattern. Should be addressed in the next sprint.

---

### P1-1. SectionHeader Adoption

**Severity:** :yellow_circle: — Component exists at `AnalyticsComponents.tsx:18-60` but 20+ PageClient files use inline headers instead

**Existing component pattern:**
```tsx
<SectionHeader title="Room Utilization" subtitle="Last 30 days" icon={<BarChart />} accentColor="blue" />
```

**Inline pattern found 20+ times:**
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-lg font-semibold text-slate-900">Room Utilization</h2>
  <button>...</button>
</div>
```

**Action:** Extract `SectionHeader` from AnalyticsComponents (part of P0-5) into its own file at `components/ui/SectionHeader.tsx`. Add optional `action` prop for right-side buttons. Then adopt across all PageClient files.

**Proposed additions:**

```typescript
interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  accentColor?: 'blue' | 'green' | 'amber' | 'red' | 'violet'
  /** Right-side action button or element */
  action?: React.ReactNode
  /** HTML heading level */
  as?: 'h2' | 'h3' | 'h4'
  className?: string
}
```

**Effort:** S (1-2 hours)

---

### P1-2. MetricBadge — Consolidated Trend/Metric Badges

**Severity:** :yellow_circle: — 3 separate badge components doing the same thing with different APIs

**Consolidation targets:**

| Current | Unique Feature | Keep? |
|---------|---------------|-------|
| `components/ui/DeltaBadge.tsx` | Format options, severity auto-detection, `aria-label` | **Keep as base** |
| `AnalyticsComponents.tsx` → `TrendPill` | Simpler, inline badge | Merge into DeltaBadge |
| `components/ui/ProfitBadge.tsx` | Margin rating (excellent/good/fair/poor) | Keep separate — domain-specific |

**Action:** Add `TrendPill`'s compact rendering mode to `DeltaBadge` via a `compact` prop. Remove `TrendPill` from AnalyticsComponents.

```typescript
// Addition to existing DeltaBadge
interface DeltaBadgeProps {
  // ... existing props ...
  /** Compact mode: smaller text, tighter padding (replaces TrendPill) */
  compact?: boolean
}
```

**Effort:** S (1 hour)

---

### P1-3. SettingsRow — Settings List Item Pattern

**Severity:** :yellow_circle: — 5+ settings pages use inline row components with edit/delete actions

**Pattern found in:** `/settings/closures/` (HolidayRow, ClosureRow), `/settings/rooms/`, `/settings/surgeons/`, `/checkin/` (CheckInRow)

**Proposed component API:**

```typescript
interface SettingsRowProps {
  /** Primary label text */
  label: string
  /** Secondary description */
  description?: string
  /** Right-side metadata (e.g., "3 procedures") */
  meta?: string
  /** Status badge */
  status?: React.ReactNode
  /** Row actions */
  onEdit?: () => void
  onDelete?: () => void
  onToggle?: (enabled: boolean) => void
  /** Whether the row is currently active/enabled */
  enabled?: boolean
  /** Left icon or color indicator */
  icon?: React.ReactNode
  /** Whether the row is draggable */
  draggable?: boolean
  className?: string
}
```

**Before → After:**

```tsx
// BEFORE: settings/closures/PageClient.tsx
function HolidayRow({ holiday, onEdit, onDelete }: { ... }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-slate-100">
      <div>
        <p className="text-sm font-medium text-slate-900">{holiday.name}</p>
        <p className="text-xs text-slate-500">{holiday.date}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

// AFTER
<SettingsRow
  label={holiday.name}
  description={holiday.date}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

**Effort:** M (3-4 hours)

---

### P1-4. ChartTooltip — Shared Recharts Tooltip Formatters

**Severity:** :yellow_circle: — Same tooltip components duplicated across 3+ analytics pages

**Duplicated components:**
- `CaseVolumeTooltip` — found in `analytics/PageClient.tsx` and `analytics/surgeons/PageClient.tsx`
- `ComparisonTooltip` — found in `analytics/PageClient.tsx` and `analytics/surgeons/PageClient.tsx`
- `UtilizationTooltip` — found in `analytics/block-utilization/PageClient.tsx`

**Proposed component API:**

```typescript
// components/analytics/ChartTooltip.tsx

interface ChartTooltipProps {
  /** Tooltip title (usually the X-axis label) */
  title?: string
  /** Array of metric rows to display */
  items: Array<{
    label: string
    value: string | number
    color?: string
    format?: 'number' | 'time' | 'percentage' | 'currency'
  }>
  /** Comparison period label */
  comparisonLabel?: string
  className?: string
}

// Pre-built formatters
export function CaseVolumeTooltip(props: RechartsTooltipProps): JSX.Element
export function TimeTooltip(props: RechartsTooltipProps): JSX.Element
export function PercentTooltip(props: RechartsTooltipProps): JSX.Element
```

**Effort:** S (2 hours)

---

### P1-5. Alert/InfoBox Adoption

**Severity:** :yellow_circle: — 55+ inline info/alert boxes bypassing existing `Alert.tsx`

**Current inline pattern:**
```tsx
<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <p className="text-sm text-blue-800">Info message here</p>
</div>
```

**Action:** This is an adoption problem, not a new component. `Alert.tsx` exists but needs:
1. Token migration (currently hardcoded colors — flagged in Report 06 as :red_circle:)
2. Migrate to `alertColors` from `lib/design-tokens.ts`
3. Then grep for `bg-blue-50 border border-blue-200` and `bg-amber-50 border border-amber-200` patterns and refactor to `<Alert>`

**Effort:** M (3-4 hours)

---

### P1-6. iOS .orbitBadge() Modifier

**Severity:** :yellow_circle: — Badge/pill modifier pattern repeated 8+ times in iOS

**Current repeated pattern:**
```swift
.padding(.horizontal, OrbitSpacing.sm)
.padding(.vertical, OrbitSpacing.xs)
.background(Color.orbitPrimary.opacity(0.1))
.cornerRadius(OrbitRadius.full)
```

**Found in:** `ProcedureGroupBadge`, `TrendBadge`, `InsightRow`, and inline badges across SurgeonHome and DeviceRep views.

**Proposed implementation:**

```swift
extension View {
    func orbitBadge(color: Color = .orbitPrimary) -> some View {
        self
            .font(OrbitFont.caption())
            .padding(.horizontal, OrbitSpacing.sm)
            .padding(.vertical, OrbitSpacing.xs)
            .background(color.opacity(0.1))
            .foregroundColor(color)
            .cornerRadius(OrbitRadius.full)
    }
}
```

**Effort:** S (1 hour)

---

### P1-7. iOS .orbitPrimaryButton() / .orbitSecondaryButton() Modifiers

**Severity:** :yellow_circle: — 8+ files with identical button styling chains

**Current repeated pattern:**
```swift
.font(OrbitFont.headline())
.foregroundColor(.white)
.padding(.horizontal, OrbitSpacing.xl)
.padding(.vertical, OrbitSpacing.md)
.background(Color.orbitPrimary)
.cornerRadius(OrbitRadius.md)
```

**Proposed implementation:**

```swift
extension View {
    func orbitPrimaryButton() -> some View {
        self
            .font(OrbitFont.headline())
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, OrbitSpacing.md)
            .background(Color.orbitPrimary)
            .cornerRadius(OrbitRadius.md)
    }

    func orbitSecondaryButton() -> some View {
        self
            .font(OrbitFont.headline())
            .foregroundColor(.orbitPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, OrbitSpacing.md)
            .background(Color.orbitPrimary.opacity(0.1))
            .cornerRadius(OrbitRadius.md)
    }
}
```

**Effort:** S (1 hour)

---

### P1-8. Sparkline Consolidation (shared/)

**Severity:** :yellow_circle: — Two nearly identical components + accessibility violations

**Current state:**
- `components/analytics/financials/shared/Sparkline.tsx` — default blue color
- `components/analytics/financials/shared/SparklineLight.tsx` — white color for dark backgrounds
- Both flagged :red_circle: in Report 06 for missing `role="img"` and `aria-label`

**Action:** Merge into single `Sparkline` with `theme` prop:

```typescript
interface SparklineProps {
  data: number[]
  color?: string
  theme?: 'default' | 'light'  // NEW: replaces SparklineLight
  width?: number
  height?: number
}
```

Add `role="img"` and `aria-label` to fix accessibility violations. Delete `SparklineLight.tsx`.

**Effort:** S (1 hour)

---

## P2 — Extract When Touched

> Used 2 times, or potential future reuse. Fix when you're already editing the file.

---

### P2-1. Filter Bar Deduplication

**Severity:** :yellow_circle: — Two similarly-named filter components may overlap

- `components/cases/CasesFilterBar.tsx` (569 LOC)
- `components/filters/CaseFilterBar.tsx` (825 LOC)

**Action:** Compare the two components. If one is deprecated, delete it. If they serve different audiences (cases list vs analytics), rename for clarity. If significant overlap, merge.

**Effort:** S (1-2 hours to investigate + merge)

---

### P2-2. Utility Classes for Tailwind Typography

**Severity:** :green_circle: — Reduces visual inconsistency across 550+ occurrences

**Add to `app/globals.css`:**

```css
/* Typography utilities */
.label-uppercase   { @apply text-xs font-medium text-slate-500 uppercase tracking-wide; }
.heading-section   { @apply text-lg font-semibold text-slate-900; }
.metric-value-md   { @apply text-xl font-bold text-slate-900 tabular-nums; }
.metric-value-lg   { @apply text-2xl font-bold text-slate-900 tabular-nums; }
.metric-value-xl   { @apply text-3xl font-bold text-slate-900 tabular-nums; }

/* Dividers */
.divider           { @apply border-t border-slate-200; }
.divider-light     { @apply border-t border-slate-100; }
```

**Effort:** S (30 min to add classes, then adopt file-by-file when touched)

---

### P2-3. Dead Code Removal (0-import UI components)

**Severity:** :yellow_circle: — Maintenance burden with no consumers

**Candidates (from Report 05):**
- `components/ui/Breadcrumb.tsx` — 0 consumers
- `components/ui/Pagination.tsx` — 0 consumers
- `components/ui/Navbar.tsx` — 0 consumers, also flagged :red_circle: in Report 06 (no props, hardcoded data)

**Action:** Verify with `git log` whether these are unused legacy or planned future components. If unused for 3+ months, delete. If planned, add a `// @planned` comment.

**Effort:** S (30 min)

---

### P2-4. Card/Input Adoption Sweep

**Severity:** :green_circle: — 33+ inline card containers and 241+ inline input patterns

**Action:** When touching a file that has inline `rounded-lg border border-slate-200 bg-white` card patterns, refactor to use `<Card>` from `CardEnhanced.tsx`. Similarly, refactor inline input patterns to use `<Input>` from `Input.tsx`.

No new components needed — this is purely adoption work.

**Effort:** Varies per file (5-10 min each, done incrementally)

---

### P2-5. iOS .orbitSectionHeader() Modifier

**Severity:** :green_circle: — 6+ instances of identical section header styling

**Current pattern:**
```swift
.font(.system(size: 12, weight: .semibold))
.foregroundColor(.orbitSlate)
```

**Proposed:**
```swift
extension View {
    func orbitSectionHeader() -> some View {
        self
            .font(OrbitFont.caption())
            .foregroundColor(.orbitSlate)
    }
}
```

**Effort:** S (30 min)

---

### P2-6. iOS ORbitProgressBar Component

**Severity:** :green_circle: — 2 instances with slightly different heights

**Found in:** `ProgressCard.swift` (8pt height), `PillarBar` in `ORbitScoreCard.swift` (6pt height)

**Proposed:**
```swift
struct ORbitProgressBar: View {
    let progress: Double  // 0.0 - 1.0
    var color: Color = .orbitPrimary
    var height: CGFloat = 6
    var trackColor: Color = Color(.systemGray5)

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(trackColor)
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(color)
                    .frame(width: geo.size.width * min(max(progress, 0), 1))
            }
        }
        .frame(height: height)
    }
}
```

**Effort:** S (30 min)

---

### P2-7. StatusBadge Consolidation

**Severity:** :green_circle: — 3 overlapping status components

**Current state:**
- `StatusBadge.tsx` — Case status (scheduled/in_progress/completed)
- `StatusIndicator.tsx` — Room status with glowing dot
- `PhaseBadge.tsx` — Surgical phase

**Action:** These are semantically different enough to keep separate, but `StatusIndicator` should use `statusColors` from design tokens instead of inline colors (flagged in Report 06). Consolidate when either is next modified.

**Effort:** S (30 min)

---

## P3 — Keep Inline

> Truly one-off, tightly coupled to parent, or too specialized to generalize.

These components are correctly inline and should NOT be extracted:

| Component | Location | Justification |
|-----------|----------|---------------|
| `UtilizationBar` | `block-utilization/PageClient.tsx` | Block-schedule-specific SVG — no reuse |
| `BlockDayTimeline` | `block-utilization/PageClient.tsx` | Complex schedule-specific visualization |
| `WhatFitsPanel` | `block-utilization/PageClient.tsx` | Feature-specific capacity planner |
| `CheckInDetailModal` | `checkin/PageClient.tsx` | Check-in workflow specific |
| `FlipRoomModal` | `analytics/PageClient.tsx` | Single-use analytics modal |
| `ScenarioTab panels` | `hl7v2-test-harness/PageClient.tsx` | Admin-only test harness internals |
| `DemoWizard steps` | `admin/demo/` co-located files | Wizard steps are correctly co-located |
| `FacilityWizard steps` | `admin/facilities/new/` co-located files | Wizard steps are correctly co-located |
| `EnterpriseTimeCard` | iOS `EnterpriseTimeCards.swift` | Premium gradient card — too specialized |
| `MilestoneCarouselView` modifiers | iOS inline `SpinningAnimation`, `CardButtonStyle` | Feature-specific animation |
| `SlideoutPanel` | `spd/PageClient.tsx` | SPD feature-specific panel |
| `PillarBar`, `FacilitySummary` | `orbit-score/PageClient.tsx` | ORbit Score-specific visualizations |

**Rationale:** These are either feature-specific visualizations with no reuse potential, or co-located wizard/flow steps that are correctly organized near their parent.

---

## Implementation Roadmap

### Sprint 1: Foundation (P0 items 1-4)

| Day | Task | Files Created/Modified |
|-----|------|----------------------|
| 1 | Create `KPICard.tsx` with unified API | 1 new + tests |
| 1-2 | Migrate 8 existing metric card consumers | 8 modified |
| 2 | Create `IconContainer.tsx` | 1 new + tests |
| 2-3 | Create `ChartWrapper.tsx` + `SparklineChart.tsx` | 2 new + tests |
| 3 | Add missing variants to `Badge.tsx` | 1 modified |
| 3-4 | Badge adoption sweep (top 15 files) | 15 modified |
| 4-5 | AnalyticsComponents.tsx decomposition | 1 deleted, 10+ new |

### Sprint 2: Polish (P0-6 + P1 items)

| Day | Task | Files Created/Modified |
|-----|------|----------------------|
| 1 | iOS `OrbitCard.swift` + `.orbitCardStyle()` | 1 new, 10 modified |
| 1 | iOS `.orbitBadge()` + `.orbitPrimaryButton()` | 1 new, 8 modified |
| 2 | Extract `SectionHeader` to own file, adopt across pages | 1 new, 20 modified |
| 2 | `MetricBadge` consolidation (DeltaBadge + TrendPill) | 1 modified |
| 3 | `SettingsRow` component | 1 new, 5 modified |
| 3 | `ChartTooltip` shared formatters | 1 new, 3 modified |
| 4 | Alert token migration + adoption | 1 modified, 15 modified |
| 4 | Sparkline consolidation | 1 modified, 1 deleted |

### Ongoing: P2 items

- Adopt incrementally when touching files
- Add utility classes to `globals.css` on day 1 of Sprint 1
- Dead code audit: delete after Sprint 1

---

## Expected Impact

### Before Extraction

| Metric | Value |
|--------|-------|
| Inline metric card variants | 8+ |
| Inline icon containers | 233+ |
| Inline badge patterns | 124+ |
| Inline chart boilerplate | 30+ |
| Inline section headers | 20+ |
| Files in AnalyticsComponents.tsx | 1 (2,193 LOC) |
| iOS files without shared card | 10+ |

### After Extraction

| Metric | Value |
|--------|-------|
| Unified KPICard component | 1 (replaces 8 variants) |
| IconContainer component | 1 (replaces 233 inline patterns) |
| ChartWrapper component | 1 (replaces 30+ boilerplate blocks) |
| Badge adoption rate | 90%+ (from ~30%) |
| AnalyticsComponents.tsx | Deleted (split into 10+ focused files) |
| iOS OrbitCard usage | 10+ files (new shared wrapper) |
| Total LOC reduced | ~2,500-3,500 estimated |
| Visual consistency | Significant improvement (single source of truth per pattern) |

---

*Generated by Phase 5 of ORbit Component Audit*
*Next: Phase 6 — Executive Summary*
