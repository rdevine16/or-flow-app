# Executive Summary — ORbit Component Audit (Report 00 of 08)

## Purpose

This audit analyzed the entire ORbit codebase — 515 files across the Next.js web app and SwiftUI iOS app — to identify inline component definitions, duplicated patterns, and missing shared components. The goal: zero unnecessary inline definitions, one source of truth per UI pattern.

---

## 1. Metrics at a Glance

### Codebase Scale

| Metric | Web (components/) | Web (app/) | iOS | Total |
|--------|-------------------|------------|-----|-------|
| Files | 217 .tsx | 192 .tsx | 106 .swift | **515** |
| LOC | ~56,150 | ~57,127 | ~15,000+ | **~128,000+** |
| Components/Views | 350+ exports | 87 pages + helpers | 140+ View structs | **575+** |

### Shared Library Health

| Metric | Value | Rating |
|--------|-------|--------|
| Web shared components (`ui/`) | 45 files | :green_circle: Good foundation |
| iOS shared components | 10 files | :red_circle: Significant gap (vs web's 45) |
| Barrel files | 4 exist, **0% usage** | :red_circle: Dead infrastructure |
| UI components missing from barrel | 27 of 46 (59%) | :red_circle: |
| Components bypassing shared UI | 146 of 245 (60%) | :red_circle: |
| Circular dependencies | **0** | :green_circle: Excellent |
| Cross-feature dependencies | **1** | :green_circle: Excellent |

### Duplication & Inline Findings

| Metric | Count |
|--------|-------|
| Total inline component definitions found | **89 instances across 15 categories** |
| Inline badge patterns (bypassing existing `Badge.tsx`) | **124+** |
| Inline icon container patterns | **233+** |
| Inline info/alert boxes (bypassing existing `Alert.tsx`) | **55+** |
| Recharts boilerplate duplications | **30+ files** |
| KPI/metric card variants doing the same thing | **8+** |
| Inline PageClient helper components | **50+** |
| iOS repeated modifier chains | **10+ files** |
| Total Tailwind pattern duplications analyzed | **13,297 className occurrences** |
| **Total duplicate/inline occurrences to address** | **930+** |

### Estimated New Shared Components Needed

| Tier | New Components | Occurrences Affected | Effort |
|------|---------------|---------------------|--------|
| P0 — Extract Immediately | 6 | 460+ | L (3-5 days) |
| P1 — Extract Soon | 8 | 320+ | M (2-3 days) |
| P2 — Extract When Touched | 7 | 150+ | S (1-2 days) |
| P3 — Keep Inline | 12 categories | — | None |
| **Total** | **21 new/consolidated** | **930+** | **6-10 days** |

### Component Quality Compliance

| Dimension | Web `ui/` (45) | Web `shared/` (12) | iOS (10) |
|-----------|---------------|-------------------|----------|
| Props Interface | 93% :green_circle: | 100% :green_circle: | 100% :green_circle: |
| Composition | 96% :green_circle: | 92% :green_circle: | 100% :green_circle: |
| Accessibility | 62% :yellow_circle: | 17% :red_circle: | 20% :red_circle: |
| Design Tokens | 60% :yellow_circle: | 42% :red_circle: | 80% :green_circle: |

**Critical quality issues:** 15 total (13 web, 2 iOS) — see Report 06 for details.

---

## 2. Top 10 Highest-Impact Extractions

Ranked by (frequency of duplication) × (complexity of the pattern) × (number of files affected):

| Rank | Extraction | Occurrences | Files | Effort | Impact Score |
|------|-----------|-------------|-------|--------|-------------|
| **1** | **IconContainer** — colored icon wrapper | 233+ | 20+ | M | :red_circle: Highest — single most repeated inline pattern |
| **2** | **Badge Adoption** — enforce existing `Badge.tsx` | 124+ | 15+ | M | :red_circle: Component exists but is bypassed 80% of the time |
| **3** | **KPICard** — unified metric card | 8 variants | 6+ pages | L | :red_circle: Most duplicated *component* pattern (8 separate implementations) |
| **4** | **Alert/InfoBox Adoption** — enforce existing `Alert.tsx` | 55+ | 15+ | M | :yellow_circle: Component exists but is bypassed |
| **5** | **ChartWrapper** — Recharts boilerplate elimination | 30+ files | 10+ pages | M | :yellow_circle: 15+ lines of identical setup per chart |
| **6** | **AnalyticsComponents.tsx Decomposition** | 1 file, 2,193 LOC | 15+ consumers | L | :yellow_circle: Largest structural debt — 37 exports in one file |
| **7** | **SectionHeader Adoption** — enforce existing component | 20+ inline | 20+ pages | S | :yellow_circle: Pattern exists, adoption is ~0% |
| **8** | **iOS OrbitCard + .orbitCardStyle()** | 10+ files | 10+ views | S | :yellow_circle: Most repeated iOS modifier chain |
| **9** | **SettingsRow** — settings list item | 5+ inline | 5+ pages | M | :green_circle: Growing pattern across settings pages |
| **10** | **iOS .orbitBadge() + .orbitPrimaryButton()** | 8+ files each | 16+ views | S | :green_circle: Two iOS modifier patterns combined |

### Key Insight

**Items #2, #4, and #7 are adoption problems, not missing components.** The shared library already has `Badge`, `Alert`, and `SectionHeader` — but 60% of the codebase bypasses them. Enforcement (via code review, linting, or codemod) would address 200+ occurrences without writing any new components.

---

## 3. Architecture Recommendations

### 3.1 Proposed Component Directory Structure

```
components/
├── ui/                          ← Shared primitives (existing, expand)
│   ├── Badge.tsx                   Add missing variants (dot, icon)
│   ├── Button.tsx                  ✅ Exemplary
│   ├── Card.tsx                    Keep (alias to CardEnhanced)
│   ├── CardEnhanced.tsx            ✅ Exemplary compound pattern
│   ├── ConfirmDialog.tsx           ✅ Exemplary
│   ├── IconContainer.tsx           NEW — replaces 233+ inline patterns
│   ├── Input.tsx                   ✅ Exemplary
│   ├── KPICard.tsx                 NEW — replaces 8 metric card variants
│   │   └── KPICard.test.tsx
│   ├── Loading.tsx                 ✅ Exemplary
│   ├── Modal.tsx                   ✅ Exemplary
│   ├── SectionHeader.tsx           MOVED from AnalyticsComponents.tsx
│   ├── SettingsRow.tsx             NEW — settings list item pattern
│   ├── Skeleton.tsx                Existing (add inline skeleton variants)
│   ├── Toggle.tsx                  ✅ Exemplary
│   ├── Toast/                      ✅ Exemplary
│   └── Tooltip.tsx                 ✅ Exemplary
│
├── analytics/                   ← Analytics-specific components
│   ├── charts/                     NEW directory
│   │   ├── ChartWrapper.tsx        NEW — Recharts boilerplate elimination
│   │   ├── ChartTooltip.tsx        NEW — shared tooltip formatters
│   │   ├── SparklineChart.tsx      NEW — card-embedded sparklines
│   │   └── index.ts
│   ├── filters/                    EXTRACTED from AnalyticsComponents.tsx
│   │   ├── SurgeonSelector.tsx
│   │   ├── DateQuickFilter.tsx
│   │   └── index.ts
│   ├── layout/                     EXTRACTED from AnalyticsComponents.tsx
│   │   ├── PageGrid.tsx
│   │   ├── AnalyticsLayout.tsx
│   │   └── index.ts
│   ├── trend/                      EXTRACTED from AnalyticsComponents.tsx
│   │   ├── TrendPill.tsx           → Eventually merge into DeltaBadge
│   │   ├── ComparisonRow.tsx
│   │   └── index.ts
│   ├── financials/                 Existing (well-organized)
│   │   └── shared/                 Existing (100% barrel coverage)
│   ├── flags/                      Existing
│   └── index.ts                    NEW barrel
│
├── cases/                       ← Existing (add barrel)
│   └── index.ts                    NEW barrel
│
├── dashboard/                   ← Existing
├── settings/                    ← Existing
├── integrations/                ← Existing
├── layouts/                     ← Existing (add barrel)
│   └── index.ts                    NEW barrel
└── global/                      ← Existing
```

### 3.2 Naming Conventions

| Convention | Rule | Example |
|-----------|------|---------|
| **Component files** | PascalCase, matches primary export | `KPICard.tsx` exports `KPICard` |
| **Test files** | Co-located, `.test.tsx` suffix | `KPICard.test.tsx` |
| **Barrel files** | `index.ts` per directory | `components/ui/index.ts` |
| **Props interfaces** | `{ComponentName}Props` | `KPICardProps` |
| **Utility classes** | kebab-case in `globals.css` | `.label-uppercase`, `.metric-value-lg` |
| **iOS modifiers** | `.orbit{Purpose}()` | `.orbitCardStyle()`, `.orbitBadge()` |
| **iOS components** | `Orbit{Purpose}` or `{Purpose}View` | `OrbitCard`, `ORbitProgressBar` |

### 3.3 File Organization Patterns

**Each shared component should follow this structure:**

```
components/ui/KPICard.tsx          ← Component + props interface + variants
components/ui/KPICard.test.tsx     ← Co-located tests
```

**Rules:**
1. One primary component per file (variants like `KPICardCompact`, `KPICardSkeleton` co-locate with the base)
2. Props interface defined in the same file as the component (not in a separate `types.ts`)
3. Tests co-located with the component (`.test.tsx` sibling)
4. No Storybook stories for now (add when/if Storybook is adopted)
5. Design tokens imported from `lib/design-tokens.ts` — never hardcode colors
6. Accessibility attributes required on all interactive and data-visualization components

### 3.4 Import Strategy Decision

**Recommendation: Standardize on direct imports** (Option A from Report 05).

The barrel file at `ui/index.ts` has **0 consumers** — it's dead code. Rather than migrating 808+ imports to use a barrel nobody uses:

1. Delete `components/ui/index.ts` (dead barrel)
2. Keep `Toast/index.ts` — standardize all 109 Toast imports to `@/components/ui/Toast`
3. Keep `financials/index.ts` and `financials/shared/index.ts` (actively used)
4. Add barrel files to `analytics/charts/`, `analytics/filters/`, `analytics/layout/`, `analytics/trend/` (new directories from AnalyticsComponents decomposition)
5. Document in CLAUDE.md: "Import from the specific file, not from barrel"

---

## 4. Effort Estimates

### P0 — Extract Immediately

| # | Component | What | T-Shirt | Hours | Dependencies |
|---|-----------|------|---------|-------|-------------|
| P0-1 | KPICard | Unified metric card replacing 8 variants | **L** | 8-12 | None |
| P0-2 | IconContainer | Colored icon wrapper replacing 233+ inline patterns | **M** | 4-6 | None |
| P0-3 | ChartWrapper + SparklineChart | Recharts boilerplate elimination | **M** | 4-6 | None |
| P0-4 | Badge Adoption | Add missing variants, migrate 124+ inline badges | **M** | 3-5 | None |
| P0-5 | AnalyticsComponents.tsx Decomposition | Split 2,193 LOC into 10+ focused files | **L** | 6-8 | P0-1 (merge EnhancedMetricCard) |
| P0-6 | iOS OrbitCard + .orbitCardStyle() | Shared card modifier for 10+ iOS files | **S** | 2-3 | None |

### P1 — Extract Soon

| # | Component | What | T-Shirt | Hours |
|---|-----------|------|---------|-------|
| P1-1 | SectionHeader Adoption | Extract from AnalyticsComponents, adopt across 20+ pages | **S** | 1-2 |
| P1-2 | MetricBadge Consolidation | Merge TrendPill into DeltaBadge | **S** | 1 |
| P1-3 | SettingsRow | Settings list item pattern for 5+ pages | **M** | 3-4 |
| P1-4 | ChartTooltip | Shared Recharts tooltip formatters | **S** | 2 |
| P1-5 | Alert/InfoBox Adoption | Token migration + adopt across 55+ occurrences | **M** | 3-4 |
| P1-6 | iOS .orbitBadge() | Badge/pill modifier for 8+ iOS files | **S** | 1 |
| P1-7 | iOS .orbitPrimaryButton() / .orbitSecondaryButton() | Button modifiers for 8+ iOS files | **S** | 1 |
| P1-8 | Sparkline Consolidation | Merge Sparkline + SparklineLight, fix a11y | **S** | 1 |

### P2 — Extract When Touched

| # | Component | T-Shirt |
|---|-----------|---------|
| P2-1 | Filter Bar Deduplication (CasesFilterBar vs CaseFilterBar) | **S** |
| P2-2 | Tailwind Typography Utility Classes | **S** |
| P2-3 | Dead Code Removal (Breadcrumb, Pagination, Navbar — 0 consumers) | **S** |
| P2-4 | Card/Input Adoption Sweep | **S** per file |
| P2-5 | iOS .orbitSectionHeader() | **S** |
| P2-6 | iOS ORbitProgressBar | **S** |
| P2-7 | StatusBadge Consolidation (token migration) | **S** |

### Total Effort Summary

| Phase | Components | Effort | Calendar Time |
|-------|-----------|--------|---------------|
| P0 — Extract Immediately | 6 | ~28-40 hours | Sprint 1 (5 days) |
| P1 — Extract Soon | 8 | ~13-16 hours | Sprint 2 (4 days) |
| P2 — Extract When Touched | 7 | ~6-10 hours | Ongoing (incremental) |
| Quality fixes (Report 06) | 15 critical issues | ~8-10 hours | Parallel with P0/P1 |
| **Grand Total** | **21 + 15 fixes** | **~55-76 hours** | **~2-3 weeks** |

---

## 5. Expected Impact

### Before vs. After

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Metric card variants | 8+ separate implementations | 1 unified `KPICard` | -87% |
| Inline icon containers | 233+ copy-pasted divs | 1 `IconContainer` component | -99% |
| Inline badge patterns | 124+ bypassing `Badge.tsx` | ~90% using shared `Badge` | -90% |
| Inline info/alert boxes | 55+ bypassing `Alert.tsx` | ~90% using shared `Alert` | -90% |
| Chart boilerplate | 30+ files, 15+ lines each | 4 lines via `ChartWrapper` | -75% |
| AnalyticsComponents.tsx | 1 file, 2,193 LOC, 37 exports | 10+ focused files | Deleted |
| iOS files without shared card | 10+ | 0 (via `.orbitCardStyle()`) | -100% |
| Shared UI adoption rate | 40% | ~75% (estimated) | +35pp |
| Accessibility compliance | 47% average | ~80% (estimated) | +33pp |
| Design token compliance | 61% average | ~85% (estimated) | +24pp |
| **Total LOC reduction** | — | **~2,500-3,500 lines** | — |

### Qualitative Improvements

1. **Visual consistency** — Single source of truth per UI pattern eliminates subtle differences (border radius, shadow, padding, colors) between pages
2. **Developer velocity** — New pages compose from shared components instead of copy-pasting 50+ lines of Tailwind classes
3. **Accessibility** — Fixing shared components once propagates ARIA patterns to all consumers
4. **Design system evolution** — Token changes in `design-tokens.ts` cascade through the entire UI instead of requiring 233 inline edits
5. **Onboarding** — New developers learn one `KPICard` API instead of 8 different metric card patterns

---

## 6. Strengths to Preserve

The audit found several areas of excellence that should not be disrupted:

| Strength | Evidence |
|----------|----------|
| **Zero circular dependencies** | All import chains are strictly unidirectional |
| **Minimal cross-feature coupling** | Only 1 cross-feature import across 245 component files |
| **Exemplary shared components** | Button, Modal, ConfirmDialog, Toggle, Toast, Loading, Input — these are reference implementations |
| **Compound component patterns** | CardEnhanced, Modal, ConfirmDialog use proper React composition |
| **Hook-based APIs** | `useToast`, `useConfirmDialog`, `useDrillDownUrl` — clean consumer APIs |
| **iOS design token adoption** | 80% compliance (OrbitFont, OrbitSpacing, OrbitRadius, Color extensions) |
| **Feature isolation** | Each feature directory is effectively an isolated module |
| **Consistent path aliasing** | Universal `@/` prefix across all web imports |

---

## 7. Implementation Roadmap

### Sprint 1: Foundation (Days 1-5)

**Goal:** Create the 6 P0 components and complete the highest-impact migrations.

| Day | Task | Deliverables |
|-----|------|-------------|
| 1 | Create `KPICard.tsx` + tests | 1 new component |
| 1-2 | Migrate 8 existing metric card consumers to `KPICard` | 8 files updated |
| 2 | Create `IconContainer.tsx` + tests | 1 new component |
| 2-3 | Create `ChartWrapper.tsx` + `SparklineChart.tsx` + tests | 2 new components |
| 3 | Add missing Badge variants (dot, icon, colors) | 1 file updated |
| 3-4 | Badge adoption sweep (top 15 files) | 15 files updated |
| 4-5 | AnalyticsComponents.tsx decomposition → 10+ focused files | 1 deleted, 10+ new |
| 5 | iOS `OrbitCard.swift` + `.orbitCardStyle()` | 1 new, 10 updated |

### Sprint 2: Polish (Days 6-9)

**Goal:** Complete P1 extractions and accessibility fixes.

| Day | Task | Deliverables |
|-----|------|-------------|
| 6 | Extract SectionHeader, adopt across pages | 1 new, 20 updated |
| 6 | MetricBadge consolidation (DeltaBadge + TrendPill) | 1 updated |
| 7 | SettingsRow component + ChartTooltip formatters | 2 new, 8 updated |
| 7 | Alert token migration + adoption sweep | 1 updated, 15 updated |
| 8 | Sparkline consolidation + accessibility fixes | 1 updated, 1 deleted |
| 8 | iOS `.orbitBadge()` + `.orbitPrimaryButton()` modifiers | 1 new, 16 updated |
| 9 | Quality fixes: SortTH keyboard a11y, InfoTip a11y, iOS VoiceOver labels | 5 files fixed |
| 9 | Quality fixes: Token migration for DateFilter, DatePickerCalendar, etc. | 5 files fixed |

### Ongoing: P2 Items

- Add utility classes to `globals.css` on day 1
- Dead code audit (Breadcrumb, Pagination, Navbar) after Sprint 1
- Card/Input adoption: refactor when touching a file
- StatusBadge token consolidation: when next modified

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Migration breaks existing pages | Each extraction maintains backward compatibility via re-exports during transition |
| Large number of files touched | Mechanical refactoring — low logic risk, high surface area. Review file-by-file. |
| Scope creep during extraction | Strict P0/P1/P2 tiers. P2 items only done when touching the file for other reasons. |
| AnalyticsComponents.tsx decomposition conflicts | Create barrel file (`analytics/index.ts`) that re-exports everything from new locations — zero breaking changes |
| iOS modifier adoption | View modifiers are additive — existing code continues to work during gradual migration |

---

## Report Index

| Report | File | Phase | Content |
|--------|------|-------|---------|
| 00 | `00-executive-summary.md` | 6 | This file — metrics, top 10, architecture, roadmap |
| 01 | `01-component-inventory.md` | 1A | Complete file-by-file inventory (web + iOS) |
| 02 | *Not generated* | 1B | Inline definitions (findings merged into Reports 03-04) |
| 03 | `03-duplication-analysis.md` | 2A | Near-duplicate detection across 15 categories |
| 04 | `04-tailwind-patterns.md` | 2B | Tailwind class duplication (13,297 occurrences analyzed) |
| 05 | `05-dependency-analysis.md` | 3 | Import graph, barrel audit, UI adoption rates |
| 06 | `06-quality-assessment.md` | 4 | Props, composition, accessibility, design tokens |
| 07 | `07-extraction-plan.md` | 5 | Prioritized extraction plan with proposed APIs |

---

*Generated by Phase 6 of ORbit Component Audit*
*All 8 audit reports complete.*
