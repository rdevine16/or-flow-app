# Dependency & Import Analysis — ORbit Codebase Audit (Report 05 of 08)

## Executive Summary

| Metric | Value |
|--------|-------|
| Total component files analyzed | 245 (components/) + 196 (app/) |
| Shared UI components (ui/) | 46 files |
| Barrel files found | 4 |
| Barrel usage rate | **0%** — barrel exists but is completely bypassed |
| Components in ui/ missing from barrel | 27 of 46 (59%) |
| Directories without barrel files | 15 (housing 126 components) |
| Cross-feature dependencies | 1 (excellent) |
| Circular dependencies | 0 (excellent) |
| Components not using shared UI | 146 of 245 (60%) |

**Key finding:** The codebase has excellent dependency discipline — no circular imports and virtually no cross-feature coupling. However, the barrel file system is dead code (exists but unused), and 60% of components bypass the shared UI library entirely.

---

## Part A: Component Import Graph

### A1. Shared UI Library Usage

The 46 components in `components/ui/` are the intended shared library. Here's how they're actually consumed:

#### Most Imported UI Components

| Rank | Component | File | Import Count | Notes |
|------|-----------|------|-------------|-------|
| 1 | ToastProvider / useToast | `ui/Toast/ToastProvider` | 103 | Near-universal |
| 2 | ErrorBanner | `ui/ErrorBanner` | 63 | Standard error display |
| 3 | PageLoader / Spinner | `ui/Loading` | 51 | Loading states |
| 4 | ConfirmDialog | `ui/ConfirmDialog` | 42 | Destructive action gates |
| 5 | Modal | `ui/Modal` | 37 | Dialogs |
| 6 | Button / IconButton | `ui/Button` | 28 | Actions |
| 7 | Container | `ui/Container` | 21 | Page layout wrapper |
| 8 | Skeleton variants | `ui/Skeleton` | 14 | Placeholder loading |
| 9 | DateRangeSelector | `ui/DateRangeSelector` | 13 | Date filtering |
| 10 | AccessDenied | `ui/AccessDenied` | 13 | Permission guard |

#### Underutilized UI Components (< 5 imports)

| Component | Import Count | Severity |
|-----------|-------------|----------|
| Tooltip | 1 | :red_circle: 498 LOC, 1 consumer |
| TimePicker | 1 | :yellow_circle: |
| StatusBadge | 1 | :red_circle: Purpose-built but unused |
| ProfitBadge | 1 | :yellow_circle: |
| MarginGauge | 1 | :yellow_circle: |
| DatePickerCalendar | 2 | :yellow_circle: |
| CardEnhanced | 2 | :red_circle: 435 LOC, 2 consumers |
| Input | 2 | :red_circle: Forms built inline instead |
| FloatingActionButton | 2 | :green_circle: |
| SurgeonAvatar | 2 | :green_circle: |
| ProcedureIcon | 2 | :green_circle: |

**Finding:** 13 of 46 UI components (28%) have fewer than 5 consumers. Several large components (`Tooltip` at 498 LOC, `CardEnhanced` at 435 LOC) are barely used despite being purpose-built for reuse.

---

### A2. Feature Component Dependency Map

#### Cases Feature (37 files)

```
components/cases/
├── CaseDrawer.tsx ──────────────────────────── imports: Toast, Modal
│   ├── → CaseDrawerFlags.tsx                   imports: (none from ui/)
│   ├── → CaseDrawerFinancials.tsx              imports: MarginGauge, ProfitBadge, DeltaBadge
│   ├── → CaseDrawerMilestones.tsx              imports: (none from ui/)
│   │   ├── → MilestoneComparisonToggle.tsx     imports: (none from ui/)
│   │   ├── → MilestoneTimeline.tsx             imports: (none from ui/)
│   │   ├── → MilestoneDetailRow.tsx            imports: DeltaBadge
│   │   └── → TimeAllocationBar.tsx             imports: (none from ui/)
│   ├── → CaseDrawerValidation.tsx              imports: (none from ui/)
│   └── → CaseDrawerHistory.tsx                 imports: (none from ui/)
│       └── → CaseHistoryTimeline.tsx           imports: (none from ui/)
├── CaseForm.tsx (1,856 LOC) ─────────────────  imports: Toast
├── CasesTable.tsx ────────────────────────────  imports: ProcedureIcon, EmptyState, Loading
├── CaseFlagsSection.tsx ──────────────────────  imports: Toast, ConfirmDialog
├── CaseComplexitySelector.tsx ────────────────  imports: Toast
├── CompletedCaseView.tsx (1,068 LOC) ─────────  imports: (none from ui/)
├── MilestoneTimelineV2.tsx ───────────────────  imports: (none from ui/)
├── ImplantSection.tsx ────────────────────────  imports: (none from ui/)
└── ... 24 more files (mostly no UI imports)
```

**UI adoption: 30%** — Only 11 of 37 files import from `ui/`.

#### Analytics Feature (52 files)

```
components/analytics/
├── AnalyticsComponents.tsx (2,193 LOC) ────────  imports: Skeleton (internal analytics primitives)
├── InsightSlideOver.tsx ──────────────────────   imports: (none from ui/)
│   ├── → InsightPanelCallback.tsx               imports: (none from ui/)
│   ├── → InsightPanelFCOTS.tsx                  imports: (none from ui/)
│   ├── → InsightPanelUtilization.tsx            imports: (none from ui/)
│   ├── → InsightPanelNonOpTime.tsx              imports: (none from ui/)
│   ├── → InsightPanelScheduling.tsx             imports: (none from ui/)
│   ├── → InsightPanelTurnover.tsx               imports: (none from ui/)
│   └── → InsightPanelCancellation.tsx           imports: (none from ui/)
├── flags/ (10 files) ─────────────────────────   imports: (none from ui/)
└── financials/ (17 files)
    ├── SurgeonDetail.tsx (1,305 LOC) ──────────  imports: DateRangeSelector
    ├── ProcedureDetail.tsx (1,197 LOC) ────────  imports: (none from ui/)
    ├── OverviewTab.tsx (853 LOC) ──────────────  imports: Skeleton
    └── shared/ (12 micro-components) ──────────  imports: (none from ui/ — self-contained)
```

**UI adoption: 8%** — Only 4 of 52 files import from `ui/`. Analytics builds its own component ecosystem.

#### Settings Feature (31 files)

```
components/settings/
├── SettingsLanding.tsx ────────────────────────  imports: CardEnhanced
├── EditableList.tsx ──────────────────────────  imports: Toast, ConfirmDialog
├── SortableList.tsx ──────────────────────────  imports: ConfirmDialog
├── milestones/
│   ├── AdminPhaseLibrary.tsx ─────────────────  imports: 7 UI components (most in codebase)
│   ├── PhaseLibrary.tsx ──────────────────────  imports: 7 UI components
│   ├── AdminProcedureTypeAssignment.tsx ──────  imports: 4 UI components
│   ├── ProcedureTemplateAssignment.tsx ───────  imports: 4 UI components
│   ├── TemplateList.tsx ──────────────────────  imports: 3 UI components
│   ├── MilestoneFormModal.tsx ────────────────  imports: Modal, Button
│   └── TemplateBuilder.tsx (1,437 LOC) ──────  imports: Toast
├── flags/
│   ├── FlagRuleRow.tsx ──────────────────────  imports: Toggle
│   └── ... 9 more (mostly no UI imports)
└── procedures/
    ├── ProcedureDetailPanel.tsx ──────────────  imports: 4 UI components
    └── SurgeonOverrideList.tsx ───────────────  imports: Toast, Loading
```

**UI adoption: 46%** — Best of any feature directory, driven by milestones/ subdirectory.

#### Dashboard Feature (21 files)

```
components/dashboard/
├── ScheduleAdherenceTimeline.tsx (567 LOC) ───  imports: (none from ui/)
├── EnhancedRoomCard.tsx (549 LOC) ────────────  imports: (none from ui/)
├── CaseListView.tsx ──────────────────────────  imports: (none from ui/)
├── RoomOrderModal.tsx ────────────────────────  imports: (none from ui/)
├── StaffAssignmentPanel.tsx ──────────────────  imports: (none from ui/)
├── DashboardKpiCard.tsx ──────────────────────  imports: (none from ui/)
└── ... 15 more (mostly no UI imports)
```

**UI adoption: 15%** — Dashboard widgets are largely self-contained with custom rendering.

#### Integrations Feature (16 files)

```
components/integrations/
├── IntegrationOverviewTab.tsx ────────────────  imports: (none from ui/)
├── IntegrationReviewQueueTab.tsx ─────────────  imports: (none from ui/)
│   ├── → ReviewDetailPanel.tsx (1,152 LOC) ──  imports: (none from ui/)
│   │   └── → HL7MessageViewer.tsx ───────────  imports: (none from ui/)
│   └── → ImportReviewDrawer.tsx ─────────────  imports: (none from ui/)
├── SwitchIntegrationDialog.tsx ───────────────  imports: ConfirmDialog
└── test-data/ (6 pool editors)
    ├── SurgeonPool.tsx ──────────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
    ├── ProcedurePool.tsx ────────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
    ├── RoomPool.tsx ─────────────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
    ├── PatientPool.tsx ──────────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
    ├── DiagnosisPool.tsx ────────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
    └── ScheduleManager.tsx ──────────────────  imports: Toast, Modal, ConfirmDialog, Card, Badge, Loading
```

**UI adoption: 44%** — Split personality: test-data/ files are model UI citizens; production integration tabs use nothing.

---

### A3. Cross-Feature Dependencies

:green_circle: **Excellent architectural discipline.** Only **1 cross-feature import** detected:

| Source | Target | Import |
|--------|--------|--------|
| `data-quality/DataQualityPage.tsx` | `layouts/DashboardLayout` | Layout wrapper |

All other inter-component references stay within the same feature directory. Feature directories are effectively isolated modules.

#### Internal Composition Patterns (within features — healthy)

| Feature | Composition Root | Sub-components |
|---------|-----------------|----------------|
| cases | `CaseDrawer.tsx` | 5 sub-panels (Flags, Financials, Milestones, Validation, History) |
| analytics | `InsightSlideOver.tsx` | 7 insight panels |
| settings/flags | `MetricSearchBuilder.tsx` | MetricSearchStep → RuleConfigureStep → SeverityPills + RulePreviewSentence |
| integrations | `IntegrationReviewQueueTab.tsx` | ReviewDetailPanel → HL7MessageViewer |

---

### A4. Circular Dependencies

:green_circle: **None detected.** All import chains are strictly unidirectional.

---

### A5. Unused Imports

Static analysis for unused imports requires ESLint. Recommend running:

```bash
npx eslint components/ --ext .tsx --rule '{"no-unused-vars": "error"}' --no-eslintrc
```

**Structural observations suggesting potential dead imports:**
- `Breadcrumb` component in `ui/` — exported from barrel, 0 consumers
- `Pagination` component in `ui/` — exported from barrel, 0 consumers
- `StatusBadge` — 1 consumer despite being purpose-built
- `Tooltip` — 498 LOC, 1 consumer

---

### A6. UI Adoption by Feature

| Feature | Files | Using UI | % | Severity |
|---------|-------|----------|---|----------|
| analytics/ | 52 | 4 | 8% | :red_circle: |
| data-quality/ | 10 | 1 | 10% | :red_circle: |
| dashboard/ | 21 | 3 | 15% | :red_circle: |
| cases/ | 37 | 11 | 30% | :yellow_circle: |
| integrations/ | 16 | 7 | 44% | :yellow_circle: |
| settings/ | 31 | 14 | 46% | :yellow_circle: |
| **Overall** | **245** | **99** | **40%** | :yellow_circle: |

---

## Part B: Barrel File Audit

### B1. Existing Barrel Files (4)

#### 1. `components/ui/index.ts` — Main UI barrel

**Exports 33 named exports** from 12 source files:

```
Loading        → Spinner, PageLoader, LoadingOverlay
Skeleton       → Skeleton, SkeletonText, SkeletonMetricCard, SkeletonMetricGrid,
                 SkeletonTableRow, SkeletonTable, SkeletonCaseCard, SkeletonCaseList,
                 SkeletonChart, SkeletonProfile, SkeletonPage, ErrorState
StatusBadge    → StatusBadge, StatusBadgeDot
ErrorBanner    → ErrorBanner
EmptyState     → EmptyState, EmptyStateIcons
NoFacility     → NoFacilitySelected
Alert          → Alert
SearchInput    → SearchInput
TableActions   → TableActions
Tooltip        → Tooltip
CardEnhanced   → Card (default), StatsCard, ListCard, ProfileCard
ConfirmDialog  → ConfirmDialog, DeleteConfirm
Modal          → Modal
Toggle         → Toggle
Badge          → Badge (default)
Button         → Button, IconButton
Input          → Input, Textarea, Select, Label, FormField
DatePicker     → DatePickerCalendar (default)
```

**Usage: 0 imports.** No file in the codebase imports from `@/components/ui` (the barrel path).

#### 2. `components/ui/Toast/index.ts`

```
ToastProvider → useToast, ToastProvider, useToastHelpers
```

**Usage:** 6 files import via `@/components/ui/Toast`; 103 files import via `@/components/ui/Toast/ToastProvider` (bypassing barrel).

#### 3. `components/analytics/financials/index.ts`

```
types              → * (all type exports)
utils              → * (all utility exports)
useFinancialsMetrics → hook
DateRangeSelector  → re-exported from ui/
OverviewTab, ProcedureTab, ProcedureDetail → tab components
CaseEconomicsCard, PayerMixCard → card components
SurgeonTab, SurgeonDetail, SurgeonHero → surgeon components
```

**Not exported:** `SurgeonByProcedure`, `SurgeonDailyActivity`, `WaterfallChart`

#### 4. `components/analytics/financials/shared/index.ts`

```
Sparkline, SparklineLight, MicroBar
MarginBadge, MarginDot
ComparisonPill, PhasePill
ConsistencyBadge, RankBadge
AnimatedNumber, InfoTip, SortTH
```

**Coverage: 100%** — All 12 files in the directory are exported. :green_circle:

---

### B2. Components Missing from UI Barrel

**27 of 46 UI components (59%) are NOT exported from the barrel:**

| Component | File | Import Count | Priority to Add |
|-----------|------|-------------|-----------------|
| Container | `Container.tsx` | 21 | :red_circle: High |
| DateRangeSelector | `DateRangeSelector.tsx` | 13 | :red_circle: High |
| AccessDenied | `AccessDenied.tsx` | 13 | :red_circle: High |
| ScoreRing | `ScoreRing.tsx` | 6 | :yellow_circle: Medium |
| DeltaBadge | `DeltaBadge.tsx` | 5 | :yellow_circle: Medium |
| Sparkline | `Sparkline.tsx` | 5 | :yellow_circle: Medium |
| FloatingActionButton | `FloatingActionButton.tsx` | 4 | :yellow_circle: Medium |
| SearchableDropdown | `SearchableDropdown.tsx` | 4 | :yellow_circle: Medium |
| SurgeonAvatar | `SurgeonAvatar.tsx` | 4 | :yellow_circle: Medium |
| StaffAvatar | `StaffAvatar.tsx` | 4 | :yellow_circle: Medium |
| ProcedureIcon | `ProcedureIcon.tsx` | 4 | :yellow_circle: Medium |
| MarginGauge | `MarginGauge.tsx` | 3 | :green_circle: Low |
| ProfitBadge | `ProfitBadge.tsx` | 3 | :green_circle: Low |
| MetricCard | `MetricCard.tsx` | 2 | :green_circle: Low |
| MilestoneButton | `MilestoneButton.tsx` | 2 | :green_circle: Low |
| StaffPopover | `StaffPopover.tsx` | 2 | :green_circle: Low |
| TimePicker | `TimePicker.tsx` | 1 | :green_circle: Low |
| DateFilter | `DateFilter.tsx` | 1 | :green_circle: Low |
| ViewToggle | `ViewToggle.tsx` | 1 | :green_circle: Low |
| StatusIndicator | `StatusIndicator.tsx` | 1 | :green_circle: Low |
| DrillDownLink | `DrillDownLink.tsx` | 1 | :green_circle: Low |
| StaffBadge | `StaffBadge.tsx` | 1 | :green_circle: Low |
| Breadcrumb | `Breadcrumb.tsx` | 0 | :red_circle: Dead code? |
| Pagination | `Pagination.tsx` | 0 | :red_circle: Dead code? |
| Navbar | `Navbar.tsx` | 0 | :red_circle: Dead code? |
| Card.tsx | `Card.tsx` | 0 | :red_circle: Shadcn legacy, superseded by CardEnhanced |
| CardEnhanced.tsx | `CardEnhanced.tsx` | 2 | Already exported as `Card` |

---

### B3. Directories Missing Barrel Files

| Directory | Files | Most Imported Components | Recommendation |
|-----------|-------|------------------------|----------------|
| `cases/` | 37 | CaseDrawer (12), CasesTable (8), CaseForm (5) | :red_circle: Add barrel — largest feature |
| `settings/` | 31 | EditableList, SortableList, milestones/* | :yellow_circle: Add barrel per subdirectory |
| `dashboard/` | 21 | EnhancedRoomCard, RoomGridView, DashboardKpiCard | :yellow_circle: Add barrel |
| `analytics/` | 17 | AnalyticsComponents (15), InsightSlideOver (5) | :yellow_circle: Add barrel |
| `analytics/flags/` | 10 | FlagDrillThrough, FlagKPICard | :green_circle: Low priority |
| `data-quality/` | 10 | DataQualityPage, IssuesTable | :green_circle: Feature-scoped |
| `integrations/` | 9 | ReviewDetailPanel, tabs | :green_circle: Feature-scoped |
| `layouts/` | 6 | DashboardLayout (87+), Sidebar, Header | :red_circle: Add barrel — universal import |
| `block-schedule/` | 6 | WeekCalendar, BlockPopover | :green_circle: Feature-scoped |
| `global/` | 4 | Notification components | :green_circle: Small directory |
| `permissions/` | 2 | PermissionMatrix, PermissionGuard | :green_circle: Small directory |
| `pip/` | 2 | PiPMilestonePanel | :green_circle: Small directory |
| `modals/` | 1 | DeleteFacilityModal | :green_circle: Small directory |
| `filters/` | 1 | CaseFilterBar | :green_circle: Single file |
| `icons/` | 1 | OrbitLogo | :green_circle: Single file |

---

### B4. Import Pattern Analysis

#### The Dominant Pattern: Direct Path Imports (100% of actual usage)

Every import in the codebase uses direct file paths:

```typescript
// This is how EVERY import works today
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
```

**Nobody imports from the barrel:**
```typescript
// This pattern exists in index.ts but is NEVER used
import { Button, Modal, ErrorBanner } from '@/components/ui'
```

#### Import Count by Pattern

| Pattern | Example | Count |
|---------|---------|-------|
| Direct UI import | `from '@/components/ui/Button'` | ~808 |
| Direct feature import | `from '@/components/cases/CaseDrawer'` | ~1,226 |
| Barrel import (ui/) | `from '@/components/ui'` | **0** |
| Barrel import (financials/) | `from '@/components/analytics/financials'` | ~12 |
| Barrel import (shared/) | `from '@/components/analytics/financials/shared'` | ~45 |

The only barrels seeing actual use are `financials/index.ts` and `financials/shared/index.ts`.

#### Toast Import Inconsistency

| Path | Count | Notes |
|------|-------|-------|
| `@/components/ui/Toast/ToastProvider` | 103 | Dominant pattern |
| `@/components/ui/Toast` | 6 | Uses Toast barrel |

:yellow_circle: **6 files use the Toast barrel while 103 bypass it.** This is the only component where both paths coexist.

---

### B5. Import Strategy Recommendation

:red_circle: **Decision Required: Commit to one strategy.**

The current state is the worst of both worlds — barrel files exist (maintenance cost) but aren't used (no benefit).

#### Option A: Standardize on Direct Imports (Recommended)

**Rationale:**
- Already the universal pattern (0 migration cost)
- Better tree-shaking (bundler only processes imported files)
- Clearer dependency tracking (explicit file references)
- IDE "Go to Definition" works directly

**Actions:**
1. Delete `components/ui/index.ts` (dead code)
2. Keep `Toast/index.ts` but standardize all 103+6 imports to one path
3. Keep `financials/index.ts` and `financials/shared/index.ts` (actively used)
4. Document "always import from the specific file" in CLAUDE.md

#### Option B: Enforce Barrel Imports

**Rationale:**
- Cleaner import statements
- Single source of truth for what's "public API"
- Easier refactoring (change file structure without updating consumers)

**Actions:**
1. Add all 27 missing components to `components/ui/index.ts`
2. Update ~808 import statements across the codebase
3. Add barrel files to `cases/`, `layouts/`, `dashboard/`
4. Add ESLint rule: `no-restricted-imports` to block direct `ui/*.tsx` imports
5. Document "always import from barrel" in CLAUDE.md

---

## Cross-Reference: Web vs. iOS

| Aspect | Web | iOS |
|--------|-----|-----|
| Shared component count | 46 | 10 |
| Barrel/index files | 4 (unused) | 0 (N/A for Swift) |
| Cross-feature coupling | 1 import | Not yet analyzed |
| Circular dependencies | 0 | Not yet analyzed |
| Largest monolithic file | AnalyticsComponents.tsx (2,193 LOC) | CaseManagementSections.swift (1,543 LOC) |

**Pattern parity:** Both platforms suffer from the same issue — large monolithic files containing many components that should be extracted. The web app's analytics ecosystem and iOS's CaseManagementSections are structural mirrors of the same problem.

---

## Summary of Findings

### Strengths :green_circle:
1. **Zero circular dependencies** — Clean unidirectional import chains
2. **Minimal cross-feature coupling** — Only 1 cross-feature import
3. **Consistent path aliasing** — Universal use of `@/` prefix
4. **Good internal composition** — Features compose sub-components within boundaries

### Issues :red_circle:
1. **Dead barrel file** — `ui/index.ts` has 0 consumers (59% of components missing anyway)
2. **60% of components bypass shared UI** — Reimplementing patterns inline
3. **Toast import inconsistency** — Two paths to the same component
4. **Zero-consumer components** — Breadcrumb, Pagination, Navbar may be dead code
5. **28% of UI components are underutilized** (< 5 imports) despite being purpose-built

### Action Items (Priority Order)
1. **Decide barrel strategy** — Commit to direct imports (delete barrel) or barrel imports (migrate 808 imports)
2. **Audit zero-consumer components** — Breadcrumb, Pagination, Navbar — remove or adopt
3. **Fix Toast inconsistency** — Pick one import path
4. **Increase UI adoption** — Analytics (8%) and dashboard (15%) are severely underleveraged
5. **Add barrels to active feature dirs** — `cases/`, `layouts/` if Option B is chosen

---

*Generated by Phase 3 of ORbit Component Audit*
*Next: Phase 4 — Component Quality Assessment*
