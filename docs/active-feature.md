# Feature: Flag Settings Rebuild + Custom Rule Builder

**Branch:** `feature/flag-settings-custom-builder`
**Created:** 2026-02-19
**Design Reference:** `docs/flag-settings-custom-builder.jsx`

---

## Overview

Rebuild the flag settings page (`app/settings/flags/page.tsx`) from a simple expandable-card layout into a full-featured rule management interface. The centerpiece is a **Custom Rule Builder** that lets facility admins create their own flag rules from a catalog of 22+ metrics spanning timing, efficiency, financial, and quality categories.

### What Changes

| Area | Current State | Target State |
|------|--------------|--------------|
| Layout | Expandable card list, single section | Two-section table layout: Built-in Rules + Custom Rules |
| Categories | 4 (timing, efficiency, anesthesia, recovery) | 6 (+ financial, quality) |
| Custom rules | Not supported in UI | Full CRUD via metrics catalog browser |
| Metrics | ~9 timing/efficiency metrics | 22+ metrics (timing, efficiency, financial, quality) |
| Filtering | None | Category filter bar |
| Operators | Only `>` (implicit) | Explicit operator selector: `>`, `>=`, `<`, `<=` |
| Rule preview | None | Natural-language preview sentence |
| Data sources | `case_milestones` only | `case_milestones` + `case_completion_stats` + computed |

### What Doesn't Change

- `flag_rules` and `case_flags` DB schema (already supports `is_built_in = false`)
- Flag analytics page (`app/analytics/flags/page.tsx`)
- Case drawer flags display
- Delay type flags (separate settings page)
- Flag engine evaluation pipeline (extended, not replaced)
- `useSupabaseQuery` data fetching pattern

---

## Key Decisions

1. **Metrics catalog is a TypeScript constant, not a DB table.** The catalog defines what metrics are *available* for rule creation. The actual rules live in `flag_rules`. This avoids a migration for catalog changes and keeps the builder self-contained.

2. **Financial and quality metrics require flag engine extension.** The `flagEngine.ts` currently only evaluates timing-based metrics from `case_milestones`. Financial metrics need data from `case_completion_stats`. Quality metrics (missing milestones, sequence errors) need milestone analysis. This is Phase 5.

3. **Table layout replaces expandable cards.** The prototype uses a dense table grid (`grid-template-columns`) for both built-in and custom rules. Built-in rules are read-only for name/metric but editable for threshold, severity, and enable/disable. Custom rules add a delete button column.

4. **Two-step builder flow.** Step 1: Search/browse the metrics catalog grouped by category. Step 2: Configure the rule (name, threshold type, operator, value, severity, scope) with a live preview sentence.

5. **Scope: facility vs personal.** Personal scope means the flag compares a surgeon's case against their own historical data. Facility scope compares against all facility cases. This already exists in the DB schema.

---

## Metrics Catalog

22 metrics across 6 categories, as defined in the prototype:

### Timing (7 metrics)
| Metric ID | Name | Source | Milestone Pair |
|-----------|------|--------|---------------|
| `total_case_time` | Total Case Time | case_milestone_stats | patient_in → patient_out |
| `surgical_time` | Surgical Time | case_milestone_stats | incision → closing |
| `pre_op_time` | Pre-Op Time | case_milestone_stats | patient_in → incision |
| `anesthesia_time` | Anesthesia Induction | case_milestone_stats | anes_start → anes_end |
| `closing_time` | Closing Time | case_milestone_stats | closing → closing_complete |
| `emergence_time` | Emergence Time | case_milestone_stats | closing_complete → patient_out |
| `prep_to_incision` | Prep to Incision | case_milestone_stats | prep_drape_complete → incision |

### Efficiency (5 metrics)
| Metric ID | Name | Source |
|-----------|------|--------|
| `turnover_time` | Room Turnover | case_milestone_stats |
| `fcots_delay` | First Case Delay | case_milestone_stats |
| `surgeon_readiness_gap` | Surgeon Readiness Gap | case_milestone_stats |
| `callback_delay` | Callback Delay | case_milestone_stats |
| `room_idle_gap` | Room Idle Gap | computed |

### Financial (7 metrics)
| Metric ID | Name | Source | Data Type |
|-----------|------|--------|-----------|
| `case_profit` | Case Profit | case_completion_stats | currency |
| `case_margin` | Case Margin | case_completion_stats | percentage |
| `profit_per_minute` | Profit per Minute | case_completion_stats | currency |
| `implant_cost_ratio` | Implant Cost Ratio | case_completion_stats | percentage |
| `total_case_cost` | Total Case Cost | case_completion_stats | currency |
| `reimbursement_variance` | Reimbursement Variance | case_completion_stats | percentage |
| `excess_time_cost` | Excess Time Cost | computed | currency |

### Quality (2 metrics)
| Metric ID | Name | Source |
|-----------|------|--------|
| `missing_milestones` | Missing Milestones | case_milestones |
| `milestone_out_of_order` | Milestone Sequence Error | case_milestones |

---

## Implementation Plan

### Phase 1: Types, Constants & Design Tokens
**Goal:** Lay the typed foundation for the metrics catalog and extended categories.

**Files to create/modify:**
- `types/flag-settings.ts` — New file: `MetricCatalogEntry`, `MetricCategory`, `MetricDataType`, `Operator`, `CustomRuleFormState` interfaces
- `lib/constants/metrics-catalog.ts` — New file: typed `METRICS_CATALOG` array, `OPERATORS` array, `METRIC_CATEGORIES` config (labels, colors, icons)
- `lib/design-tokens.ts` — Add `financial` and `quality` to `categoryColors`

**Acceptance criteria:**
- All 22 metrics defined with full type safety
- Category config includes all 6 categories with colors and labels
- Operator definitions (gt, gte, lt, lte) with display labels
- `MetricCatalogEntry` type includes: id, name, description, category, dataType, unit, source, startMilestone, endMilestone, supportsMedian
- No runtime changes — types and constants only

**Tests:**
- Type-check passes (`npx tsc --noEmit`)
- Unit test: metrics catalog has no duplicate IDs
- Unit test: all metric categories have matching design token entries

---

### Phase 2: Settings Page Rebuild — Table Layout + Built-in Rules
**Goal:** Replace the expandable card layout with the table-based layout from the prototype. Built-in rules section only (no custom rules yet).

**Files to modify:**
- `app/settings/flags/page.tsx` — Complete rewrite of the render logic

**New sub-components (in `components/settings/flags/`):**
- `FlagRuleTable.tsx` — Table container with header row
- `FlagRuleRow.tsx` — Single rule row with inline editing
- `ThresholdInline.tsx` — Threshold type selector + value input + computed display
- `SeverityPills.tsx` — Inline severity selector (3 pill buttons)
- `ScopeBadge.tsx` — Facility/Personal badge
- `CategoryFilter.tsx` — Category filter bar

**Key behaviors:**
- Grid layout: Toggle | Name+Description | Threshold | Severity | Scope
- Category filter bar at top (All, Timing, Efficiency, etc.)
- Active rule counter in header (`N/M active`)
- Auto-save on every change (existing pattern, keep it)
- Disabled state dims the entire row (opacity)
- All editing is inline — no expand/collapse

**Acceptance criteria:**
- All existing built-in rules display in the new table layout
- Toggle, threshold, severity editing works with auto-save
- Category filter correctly filters displayed rules
- Active count updates in real-time
- No visual regressions on other settings pages

**Tests:**
- Component test: renders rules in table format
- Component test: category filter shows/hides rules
- Component test: toggle updates rule enabled state
- Component test: threshold edit persists

---

### Phase 3: Custom Rule Builder Component
**Goal:** Build the MetricSearchBuilder — the 2-step flow for creating custom rules from the metrics catalog.

**New files (in `components/settings/flags/`):**
- `MetricSearchBuilder.tsx` — Main builder with 2-step flow
- `MetricSearchStep.tsx` — Step 1: search + browse metrics by category
- `RuleConfigureStep.tsx` — Step 2: configure name, threshold, operator, severity, scope
- `RulePreviewSentence.tsx` — Natural-language preview of the configured rule

**Key behaviors:**
- Step 1: Text search across metric names/descriptions/categories. Results grouped by category with sticky headers. Click metric → advance to step 2.
- Step 2: Form with fields: Rule Name (required), Threshold Type (median+SD or absolute), Operator (>, >=, <, <=), Value, Severity (pills), Scope (facility/personal). Live preview sentence at bottom.
- "Add Rule" button disabled until name is filled.
- "← Back" returns to step 1, "Cancel" closes builder entirely.
- Builder appears between header and tables when "Add Rule" is clicked.

**Acceptance criteria:**
- Search filters metrics in real-time
- All 22 metrics browsable by category
- Configuration form validates rule name is required
- Preview sentence accurately describes the rule
- Builder integrates into settings page layout
- Component is fully controlled — parent manages open/close state

**Tests:**
- Component test: search filters metrics
- Component test: selecting metric advances to step 2
- Component test: preview sentence updates with form changes
- Component test: Add Rule button disabled without name

---

### Phase 4: Custom Rule CRUD + Persistence
**Goal:** Wire the builder to the database. Custom rules can be created, displayed, toggled, and deleted.

**Files to modify:**
- `app/settings/flags/page.tsx` — Add custom rules section, integrate builder
- `components/settings/flags/FlagRuleRow.tsx` — Add delete button column for custom rules

**New DAL functions (in `lib/dal/flag-rules.ts`):**
- `createCustomFlagRule(facilityId, rule)` — Insert into `flag_rules` with `is_built_in = false`
- `deleteCustomFlagRule(ruleId)` — Hard delete (custom rules, not soft delete)
- `updateFlagRule(ruleId, updates)` — Generic update for threshold, severity, enabled

**Key behaviors:**
- "Add Rule" button in header and in custom rules empty state
- Custom rules section below built-in rules with its own header
- Custom rules get a `CUSTOM` badge and a delete (x) button
- Delete shows confirmation (or immediate with undo toast)
- Optimistic UI: add/delete instantly, rollback on error
- New custom rules get `display_order` = max + 1
- Category filter applies to both sections

**Acceptance criteria:**
- Can create a custom rule from the builder — appears in custom rules table
- Can delete a custom rule — removed from table and DB
- Can toggle enable/disable on custom rules
- Can edit threshold and severity on custom rules
- Custom rules persist across page refreshes
- Empty state shows "No custom rules yet" with CTA

**Tests:**
- Integration test: create custom rule → verify in DB
- Integration test: delete custom rule → verify removed
- Component test: custom rules section renders with CUSTOM badge
- Component test: empty state renders when no custom rules

---

### Phase 5: Flag Engine — Financial & Quality Metric Evaluation
**Goal:** Extend `flagEngine.ts` to evaluate financial and quality metrics so custom rules on these categories actually generate flags.

**Files to modify:**
- `lib/flagEngine.ts` — Add metric extraction for financial and quality categories

**New metric extractors:**
- Financial metrics: Read from `case_completion_stats` columns (total_cost, reimbursement, profit_margin, etc.)
- Quality metrics: Analyze `case_milestones` for missing entries and sequence violations
- Computed metrics: `excess_time_cost` (duration beyond median x cost/min), `room_idle_gap` (gap analysis)

**Mapping: metric_id → case_completion_stats column:**
| Metric | Column(s) |
|--------|-----------|
| `case_profit` | reimbursement - total_cost |
| `case_margin` | (reimbursement - total_cost) / reimbursement x 100 |
| `profit_per_minute` | profit / total_duration_minutes |
| `implant_cost_ratio` | implant_cost / reimbursement x 100 |
| `total_case_cost` | total_cost |
| `reimbursement_variance` | (actual - expected) / expected x 100 |
| `missing_milestones` | COUNT of milestones WHERE recorded_at IS NULL |
| `milestone_out_of_order` | COUNT of sequence violations |

**Key behaviors:**
- `extractMetricValue()` extended to handle all 22 metric IDs
- Financial metrics return currency/percentage values (not durations)
- Quality metrics return counts
- Operators `lt` and `lte` work correctly (already in DB, need engine support)
- Baselines for financial metrics use facility-wide stats (no per-surgeon median for financial)

**Acceptance criteria:**
- A custom rule on `case_profit < 0` correctly flags cases with negative profit
- A custom rule on `missing_milestones > 2` correctly flags cases with 3+ missing milestones
- Existing timing/efficiency rules continue to work unchanged
- All operators (gt, gte, lt, lte) evaluate correctly

**Tests:**
- Unit test: extractMetricValue for each financial metric
- Unit test: extractMetricValue for each quality metric
- Unit test: operator evaluation (gt, gte, lt, lte)
- Integration test: evaluateCase with financial rule
- Integration test: evaluateCase with quality rule

---

### Phase 6: Testing, Polish & Legend
**Goal:** Full test coverage, visual polish, and the informational legend section.

**Tasks:**
- Add the legend/info section at bottom of settings page (threshold types explanation, custom rules description) — matches prototype
- Keyboard navigation in builder (Escape closes, Enter submits)
- Responsive behavior at narrower widths
- Run full 3-stage test gate
- Verify flag analytics page still works with new rule categories
- Verify case drawer flags display works with financial/quality flags

**Acceptance criteria:**
- All tests pass
- No TypeScript errors
- Legend section renders below rules
- Page handles edge cases: no rules, all disabled, many custom rules, long rule names

---

## File Inventory

### New Files
| File | Purpose |
|------|---------|
| `types/flag-settings.ts` | Metric catalog and builder types |
| `lib/constants/metrics-catalog.ts` | METRICS_CATALOG, OPERATORS, METRIC_CATEGORIES |
| `lib/dal/flag-rules.ts` | Custom rule CRUD functions |
| `components/settings/flags/FlagRuleTable.tsx` | Table container |
| `components/settings/flags/FlagRuleRow.tsx` | Single rule row |
| `components/settings/flags/ThresholdInline.tsx` | Inline threshold editor |
| `components/settings/flags/SeverityPills.tsx` | Inline severity selector |
| `components/settings/flags/ScopeBadge.tsx` | Scope badge |
| `components/settings/flags/CategoryFilter.tsx` | Category filter bar |
| `components/settings/flags/MetricSearchBuilder.tsx` | 2-step builder |
| `components/settings/flags/MetricSearchStep.tsx` | Step 1: metric search |
| `components/settings/flags/RuleConfigureStep.tsx` | Step 2: rule config |
| `components/settings/flags/RulePreviewSentence.tsx` | Preview sentence |

### Modified Files
| File | Changes |
|------|---------|
| `app/settings/flags/page.tsx` | Complete rewrite — table layout, builder integration, custom rules section |
| `lib/design-tokens.ts` | Add `financial` and `quality` category colors |
| `lib/flagEngine.ts` | Extend metric extraction for financial + quality categories |

### Reference (read-only)
| File | Why |
|------|-----|
| `docs/flag-settings-custom-builder.jsx` | Design prototype — UI reference |
| `types/flag-analytics.ts` | Existing flag analytics types |
| `lib/flagEngine.ts` | Existing flag evaluation engine |
| `lib/dal/cases.ts` | Case flag query patterns |

---

## Database Impact

**No new migrations required for Phases 1-4.** The `flag_rules` table already supports:
- `is_built_in = false` for custom rules
- `category` as text (accepts any string including 'financial', 'quality')
- All needed columns (metric, operator, threshold_type, threshold_value, comparison_scope, severity)

**Phase 5 may need a migration** if `case_completion_stats` is missing columns needed for financial metric calculations (e.g., `implant_cost`, `total_cost`). Verify column availability before starting Phase 5.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Financial metrics depend on case_completion_stats columns that may not exist | Verify columns in Phase 5 before building extractors; stub with null if missing |
| Custom rules could create many flags, overwhelming the UI | Phase 6: consider rate/count display in analytics |
| Metric catalog changes require code deploys | Acceptable tradeoff vs. DB-managed catalog complexity |
| Built-in rules have computed_median/computed_sd in prototype but not in current DB | These are display-only values computed at render time from facility stats, not stored |

---

## Phase Dependency Chain
```
Phase 1 (types/constants) → Phase 2 (table layout) → Phase 3 (builder component)
                                                    → Phase 4 (CRUD persistence)
                                                    → Phase 5 (flag engine extension)
                                                    → Phase 6 (polish + legend)
```

Phase 3 and Phase 4 are tightly coupled (builder produces rules, CRUD persists them) but split for commit granularity. Phase 5 is independent of the UI work and can be done in parallel if needed.

---

## Review Q&A

> Generated by /review on 2026-02-19

**Q1:** The prototype uses rose/red (#e11d48) for Financial and slate/gray for Quality. The existing `categoryColors` in design-tokens.ts uses Tailwind classes. What colors for the new categories?
**A1:** Follow the Tailwind class formatting already established. Financial → emerald (matching financials analytics page). Quality → needs its own color.

**Q2:** For the Quality category color, the prototype uses slate/gray which blends with neutral UI. What color?
**A2:** Violet/Purple.

**Q3:** Anesthesia currently uses bg-violet-100/text-violet-600. Quality also chosen as violet. How to handle the overlap?
**A3:** Shift Quality to indigo (bg-indigo-100/text-indigo-600). Visually close to violet but distinguishable.

**Q4:** Table layout approach: CSS Grid (prototype), HTML `<table>` (existing SurgeonFlagTable), or keep flex (current settings)?
**A4:** CSS Grid (prototype). Exact column alignment across rows.

**Q5:** Editing UX: All inline (prototype, no expand/collapse), expand for editing (current), or hybrid?
**A5:** All inline (prototype). No expand/collapse. Threshold selector, severity pills, scope badge all visible in every row.

**Q6:** Computed values (≈ 90 min) under Median+SD thresholds require knowing facility medians. Approach?
**A6:** Query `facility_milestone_stats` table for display-only computed values.

**Q7:** Builder UI: inline between header/tables (prototype), slide-over drawer, or modal dialog?
**A7:** Slide-over drawer (like FlagDrillThrough pattern).

**Q8:** Table sections: two separate sections (Built-in + Custom) or unified single table?
**A8:** Two sections (prototype). Separate headers, counters, and tables for built-in and custom rules.

**Q9:** Category filter bar style?
**A9:** Segmented control (shadcn Tabs component). Category name only (no count in tab).

**Q10:** Delete UX for custom rules?
**A10:** **No delete — use archive instead.** Archive (soft delete with `is_active` column). Also add an "Archived" tab to the segmented control. All create, modify, and archive operations must be logged to audit_log.

**Q11:** Archive implementation: `is_active` column (consistent with ORbit soft-delete pattern) or `is_archived`?
**A11:** Add `is_active` boolean column to `flag_rules` table (new migration). Consistent with the 20-table soft-delete pattern.

**Q12:** Archived rules display: collapsible section, filter toggle, or separate drawer?
**A12:** Add "Archived" as a tab in the segmented control alongside category filters. Clicking it shows archived rules with restore action.

**Q13:** Should built-in rules be archivable?
**A13:** Custom rules only. Built-in rules can only be disabled (toggled off), not archived.

**Q14:** Operator editing: editable for all rules, read-only for built-in, or editable with lock icon?
**A14:** Editable for all rules. Also expand beyond 4 basic operators.

**Q15:** Additional threshold types beyond gt/gte/lt/lte + median_plus_sd + absolute?
**A15:** Add three new threshold types: percentage above/below median (`percentage_of_median`), percentile-based (`percentile`), and range (`between`). All included in MVP.

**Q16:** Phasing for new threshold types — ship with MVP or iterate later?
**A16:** Ship with MVP. All 5 threshold types in initial build.

**Q17:** Auto-save pattern: debounce number inputs or immediate save?
**A17:** Debounce number inputs (500ms). Immediate save for toggles and severity pills.

**Q18:** Financial metric column mappings (case_completion_stats doesn't have `implant_cost` or `total_cost`)?
**A18:** Need to verify with real data before implementing. Check trigger function for exact calculations.

**Q19:** Flag engine data flow for financial metrics?
**A19:** Extend CaseWithMilestones type to include optional financial fields. Flag engine extracts from the same object.

**Q20:** Computed metrics (excess_time_cost, room_idle_gap) — include in MVP or defer?
**A20:** Include both. Full 22 metrics as specced.

**Q21:** Role-based UI gating for non-admin users?
**A21:** Rely on existing navigation guards and RLS enforcement. No extra role checking in the component.

**Q22:** Metric search in builder: flat search + category groups, suggested section, or category tabs?
**A22:** Search + category groups (prototype). 22 metrics is small enough to browse.

**Q23:** Legend section at bottom of page?
**A23:** Include (matches prototype).

**Q24:** Analytics page impact — update for new categories in Phase 6?
**A24:** Yes, update analytics page in Phase 6 to properly display financial/quality flags.

**Q25:** DAL structure?
**A25:** CRUD + baselines together in a single `flag-rules.ts` DAL file.

**Q26:** Scope selector for financial/quality metrics?
**A26:** Always available. Let admin decide. No restrictions by metric category.

**Q27:** Rule ordering / drag-and-drop?
**A27:** Creation order only. No drag-and-drop reorder.

**Q28:** Case drawer flags display — add category badges?
**A28:** No changes to case drawer flags display.

**Q29:** Preview sentence component?
**A29:** Full RulePreviewSentence component handling all 5 threshold types with proper formatting per data type.

**Q30:** Keyboard accessibility?
**A30:** Basic: Escape closes drawer, Enter submits form. No custom arrow-key navigation.

**Q31:** `reimbursement_variance` metric — expected reimbursement data available?
**A31:** Yes, `procedure_reimbursements` table exists. Pre-join expected reimbursement when loading cases for flag evaluation.

**Q32:** Range operator (`between`) storage — how to store the second value?
**A32:** Add `threshold_value_max` numeric column to flag_rules table (migration).

**Q33:** Audit logging pattern?
**A33:** Match existing entity patterns (e.g., delayTypeAudit): `flag_rule.created`, `flag_rule.updated`, `flag_rule.archived`, `flag_rule.restored`. Use old_values/new_values JSON.

**Q34:** Phase ordering with expanded scope?
**A34:** Phase 1: Types, constants, design tokens, migration (is_active + threshold_value_max). Phase 2: Table layout + built-in rules. Phase 3: Custom rule builder drawer. Phase 4: CRUD + audit + archive. Phase 5: Flag engine extension. Phase 6: Analytics updates + computed baselines + legend + polish.

**Q35:** Page title?
**A35:** "Flag Rules" — compromise between "Auto-Detection Rules" (prototype) and "Case Flags" (current).

**Q36:** Branch strategy?
**A36:** Continue on current branch (`feature/flags-analytics-recharts-migration`).

---

## Revised Phase Plan (Post-Review)

### Phase 1: Types, Constants, Design Tokens & Migration
- `types/flag-settings.ts` — MetricCatalogEntry, Operator, ThresholdType (5 types), CustomRuleFormState
- `lib/constants/metrics-catalog.ts` — METRICS_CATALOG (22 metrics), OPERATORS (4 + between), THRESHOLD_TYPES (5), METRIC_CATEGORIES
- `lib/design-tokens.ts` — Add financial (emerald) and quality (indigo) to categoryColors
- Migration: Add `is_active DEFAULT true` and `threshold_value_max numeric` to flag_rules

### Phase 2: Settings Page Rebuild — Table Layout + Built-in Rules
- Complete rewrite of `app/settings/flags/page.tsx` with CSS Grid table layout
- Segmented control filter (All | categories... | Archived)
- Inline editing: toggle, threshold, operator, severity pills, scope badge
- Debounced number inputs, immediate toggle/severity save
- Query facility_milestone_stats for computed value display

### Phase 3: Custom Rule Builder — Slide-over Drawer
- MetricSearchBuilder as a slide-over drawer (Radix Dialog)
- Step 1: Search + category-grouped metrics list
- Step 2: Configure rule — name, threshold type (5 types), operator, value(s), severity, scope
- RulePreviewSentence component (handles all 5 threshold types)
- Escape to close, Enter to submit

### Phase 4: Custom Rule CRUD + Audit + Archive
- `lib/dal/flag-rules.ts` — CRUD + baselines + audit integration
- `lib/audit-logger.ts` — Add flagRuleAudit (created, updated, archived, restored)
- Custom rules section with CUSTOM badge
- Archive (is_active=false) instead of delete
- "Archived" tab shows archived custom rules with Restore action
- Optimistic UI with rollback

### Phase 5: Flag Engine — Financial, Quality & New Threshold Types
- Extend CaseWithMilestones with financial fields
- Financial metric extraction (case_completion_stats columns)
- Quality metric extraction (missing milestones, sequence errors)
- Computed metrics: excess_time_cost, room_idle_gap
- Pre-join procedure_reimbursements for reimbursement_variance
- New threshold types in engine: percentage_of_median, percentile, between
- Verify financial column mappings with real data

### Phase 6: Analytics Updates, Computed Baselines & Polish
- Update flag analytics page for financial/quality categories
- Computed baselines display in settings (facility_milestone_stats query)
- Legend section at bottom of page
- Keyboard navigation, responsive behavior
- Full 3-stage test gate
