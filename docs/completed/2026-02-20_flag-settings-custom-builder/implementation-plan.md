# Implementation Plan: Flag Settings Rebuild + Custom Rule Builder

**Feature:** Flag Settings Rebuild + Custom Rule Builder
**Branch:** `feature/flag-settings-custom-builder`
**Created:** 2026-02-19
**Phases:** 7

---

## Interview Notes

| # | Decision | Answer |
|---|----------|--------|
| 1 | Financial metric source | Aggregated columns from `case_completion_stats` PLUS dynamic per-cost-category metrics from `cost_categories` |
| 2 | Per-category metrics | Dynamically generated from facility's active cost categories. Appear in builder under Financial category. |
| 3 | `implant_cost_ratio` | Dropped. Replaced by dynamic per-category metrics. |
| 4 | Cost category → flag cascade | Auto-archive linked flag rules when a cost category is archived. App layer with confirmation dialog. |
| 5 | Per-category FK design | Add `cost_category_id` nullable FK column to `flag_rules` table. |
| 6 | Soft-delete pattern | Full pattern: `is_active`, `deleted_at`, `deleted_by` columns + `sync_soft_delete_columns()` trigger on `flag_rules`. |
| 7 | Baselines display | Use `get_milestone_interval_medians` RPC (actively used in codebase). |
| 8 | FlagRule type | Unify into single shared type in `types/flag-settings.ts`. Both settings page and flag engine import it. |
| 9 | Branch | `feature/flag-settings-custom-builder` from main. |
| 10 | Financial category color | Emerald (bg-emerald-100/text-emerald-600). |
| 11 | Quality category color | Indigo (bg-indigo-100/text-indigo-600). |
| 12 | Table layout | CSS Grid (prototype pattern). |
| 13 | Editing UX | All inline, no expand/collapse. |
| 14 | Builder UI | Slide-over drawer (like FlagDrillThrough). |
| 15 | Sections | Two separate sections: Built-in Rules + Custom Rules. |
| 16 | Category filter | Segmented control (shadcn Tabs). Category name only, no count. Includes "Archived" tab. |
| 17 | Delete vs archive | Archive (soft delete). No hard delete for custom rules. |
| 18 | Operators | Editable for all rules. Expand beyond 4 basic operators. |
| 19 | Threshold types | 5 types in MVP: `median_plus_sd`, `absolute`, `percentage_of_median`, `percentile`, `between`. |
| 20 | `between` storage | Add `threshold_value_max` numeric column to `flag_rules`. |
| 21 | Auto-save | Debounce number inputs (500ms). Immediate save for toggles and severity pills. |
| 22 | Audit logging | Match existing namespace pattern in `audit-logger.ts`: `flag_rule.created`, `flag_rule.updated`, `flag_rule.archived`, `flag_rule.restored`. |
| 23 | Scope selector | Always available for all metric categories. |
| 24 | Rule ordering | Creation order only. No drag-and-drop. |
| 25 | Keyboard | Basic: Escape closes drawer, Enter submits form. |
| 26 | Page title | "Flag Rules". |
| 27 | Static metric count | ~20 static metrics (7 timing + 5 efficiency + 5 aggregated financial + 2 quality + excess_time_cost). |
| 28 | Dynamic metrics | Per-cost-category metrics generated from facility's `cost_categories` table at runtime. |
| 29 | Phase 7 | Dedicated phase for cost category page changes and auto-archive cascade. |

---

## Phase 1: Types, Constants, Design Tokens & Migration

**Goal:** Lay the typed foundation — shared `FlagRule` type, metrics catalog, extended category colors, and DB schema changes.

**Complexity:** Medium

**New files:**
- `types/flag-settings.ts` — Shared `FlagRule` interface, `MetricCatalogEntry`, `MetricCategory`, `MetricDataType`, `Operator`, `ThresholdType`, `CustomRuleFormState`, `Severity`
- `lib/constants/metrics-catalog.ts` — `METRICS_CATALOG` (static ~20 entries), `OPERATORS`, `THRESHOLD_TYPES`, `METRIC_CATEGORIES` config
- `supabase/migrations/YYYYMMDD_flag_rules_soft_delete_and_threshold_max.sql` — Add `is_active`, `deleted_at`, `deleted_by`, `threshold_value_max`, `cost_category_id` to `flag_rules` + soft-delete trigger

**Modified files:**
- `lib/design-tokens.ts` — Add `financial` (emerald) and `quality` (indigo) to `categoryColors`
- `app/settings/flags/page.tsx` — Import shared `FlagRule` type (remove inline definition)
- `lib/flagEngine.ts` — Import shared `FlagRule` type (remove inline definition)

**Migration details:**
```sql
ALTER TABLE flag_rules
  ADD COLUMN is_active boolean DEFAULT true NOT NULL,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN threshold_value_max numeric,
  ADD COLUMN cost_category_id uuid REFERENCES cost_categories(id);

-- Apply soft-delete trigger
CREATE TRIGGER sync_flag_rules_soft_delete
  BEFORE UPDATE ON flag_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_soft_delete_columns();
```

**Commit message:** `feat(flags): phase 1 - types, constants, design tokens & flag_rules migration`

**3-stage test gate:**
1. **Unit:** Type-check passes (`npx tsc --noEmit`). Metrics catalog has no duplicate IDs. All metric categories have matching design token entries.
2. **Integration:** Existing flag settings page still loads and works with the unified type. Flag engine still evaluates correctly.
3. **Workflow:** Open settings → flags page → verify all existing rules display correctly.

---

## Phase 2: Settings Page Rebuild — Table Layout + Built-in Rules

**Goal:** Replace the expandable card layout with CSS Grid table layout. Built-in rules section only. Segmented category filter with All + categories + Archived tab.

**Complexity:** Large

**New files (in `components/settings/flags/`):**
- `FlagRuleTable.tsx` — CSS Grid table container with header row
- `FlagRuleRow.tsx` — Single rule row with all inline editing
- `ThresholdInline.tsx` — Threshold type selector + value input(s) + operator selector + computed baseline display
- `SeverityPills.tsx` — Inline severity selector (3 pill buttons: info/warning/critical)
- `ScopeBadge.tsx` — Facility/Personal badge selector
- `CategoryFilter.tsx` — Segmented control (shadcn Tabs): All | Timing | Efficiency | Anesthesia | Recovery | Financial | Quality | Archived

**Modified files:**
- `app/settings/flags/page.tsx` — Complete rewrite: CSS Grid layout, category filter, debounced inputs, immediate toggles, query baselines via `get_milestone_interval_medians` RPC

**Key behaviors:**
- Grid columns: Toggle | Name+Description | Category | Threshold (type + operator + value) | Severity | Scope
- Category filter at top (segmented control)
- Active rule counter in header (`N/M active`)
- Auto-save: debounce 500ms for number inputs, immediate for toggle/severity/scope
- Disabled rule rows dim with opacity
- All editing inline — no expand/collapse
- Operator dropdown editable for all rules (gt, gte, lt, lte)
- Computed baseline display (≈ 90 min) next to median+SD thresholds via RPC
- "Archived" tab placeholder (shows empty state until Phase 4)

**Commit message:** `feat(flags): phase 2 - table layout rebuild with inline editing and category filter`

**3-stage test gate:**
1. **Unit:** Component renders rules in table format. Category filter shows/hides rules. Toggle updates enabled state. Threshold edit persists.
2. **Integration:** All existing built-in rules display correctly. Saving changes persists to DB. Computed baselines load from RPC.
3. **Workflow:** Open flags settings → filter by category → edit threshold → change severity → toggle rule → verify all changes persist on refresh.

---

## Phase 3: Custom Rule Builder — Slide-over Drawer

**Goal:** Build the MetricSearchBuilder as a slide-over drawer. Two-step flow: browse/search metrics → configure rule. Includes dynamic per-cost-category metrics.

**Complexity:** Large

**New files (in `components/settings/flags/`):**
- `MetricSearchBuilder.tsx` — Slide-over drawer (Radix Dialog/Sheet) with 2-step flow
- `MetricSearchStep.tsx` — Step 1: search input + category-grouped metrics list. Static metrics from catalog + dynamic metrics from facility cost categories.
- `RuleConfigureStep.tsx` — Step 2: form with name, threshold type (5 types), operator, value(s), severity, scope. Second value field appears for `between` type.
- `RulePreviewSentence.tsx` — Natural-language preview of configured rule. Handles all 5 threshold types and per-category data types (currency, percentage, minutes, count).

**Modified files:**
- `app/settings/flags/page.tsx` — Add "Add Rule" button in header, manage drawer open/close state, fetch facility cost categories for dynamic metrics

**Key behaviors:**
- Step 1: Text search across metric names/descriptions. Results grouped by category with section headers. Static metrics + dynamic cost-category metrics under "Financial". Click metric → advance to step 2.
- Step 2: Auto-populates defaults based on metric type. Form fields: Rule Name (required), Threshold Type (dropdown, 5 options), Operator (dropdown), Value (number input), Value Max (for `between` only), Severity (pills), Scope (facility/personal). Live preview sentence at bottom.
- "Add Rule" disabled until name is filled
- "← Back" returns to step 1, Escape closes drawer
- Component is fully controlled — parent manages open/close state
- Per-cost-category metrics set `cost_category_id` on the form state

**Commit message:** `feat(flags): phase 3 - custom rule builder slide-over drawer with metrics catalog`

**3-stage test gate:**
1. **Unit:** Search filters metrics. Selecting metric advances to step 2. Preview sentence updates with form changes. Add Rule button disabled without name. Dynamic cost-category metrics appear.
2. **Integration:** Builder opens from settings page. Facility cost categories load correctly. Form state resets on close/reopen.
3. **Workflow:** Click "Add Rule" → search for metric → select → configure rule → verify preview → cancel → reopen → verify clean state.

---

## Phase 4: Custom Rule CRUD + Audit + Archive

**Goal:** Wire the builder to the database. Custom rules can be created, displayed, toggled, edited, and archived. Full audit logging.

**Complexity:** Large

**New files:**
- `lib/dal/flag-rules.ts` — `listByFacility()`, `createCustomRule()`, `updateRule()`, `archiveRule()`, `restoreRule()`, `getBaselines()` (wraps `get_milestone_interval_medians` RPC)

**Modified files:**
- `lib/audit-logger.ts` — Add `flagRuleAudit` namespace: `flag_rule.created`, `flag_rule.updated`, `flag_rule.archived`, `flag_rule.restored`
- `app/settings/flags/page.tsx` — Integrate builder submission, custom rules section with CUSTOM badge, archive/restore actions, "Archived" tab now functional
- `components/settings/flags/FlagRuleRow.tsx` — Add archive button (x icon) for custom rules, restore button for archived rules

**Key behaviors:**
- "Add Rule" button in header and in custom rules empty state
- Custom rules section below built-in rules with its own header and counter
- Custom rules show `CUSTOM` badge
- Archive button (custom rules only) shows confirmation with rule name
- "Archived" tab in category filter shows archived custom rules with "Restore" action
- Built-in rules: can toggle, edit threshold/severity/operator/scope. Cannot archive.
- Optimistic UI: mutations update local state immediately, rollback on error
- New custom rules get `display_order = max(existing) + 1`
- All create/update/archive/restore operations logged to `audit_log`
- DAL replaces all direct Supabase queries in the page

**Commit message:** `feat(flags): phase 4 - custom rule CRUD with audit logging and archive`

**3-stage test gate:**
1. **Unit:** DAL functions create/update/archive/restore correctly. Audit logger writes correct action types. Custom rules section renders with CUSTOM badge. Empty state renders when no custom rules.
2. **Integration:** Create custom rule via builder → appears in table. Archive rule → moves to Archived tab. Restore → returns to active. Audit log entries created for each action.
3. **Workflow:** Create rule → edit threshold → archive → switch to Archived tab → restore → verify rule is back in active list → refresh page → verify persistence.

---

## Phase 5: Flag Engine — Financial, Quality & New Threshold Types

**Goal:** Extend `flagEngine.ts` to evaluate financial metrics (aggregated + per-category), quality metrics, computed metrics, and new threshold types.

**Complexity:** Large

**Modified files:**
- `lib/flagEngine.ts` — Extend `extractMetricValue()` for financial/quality/computed metrics. Add `percentage_of_median`, `percentile`, `between` threshold evaluation. Support `cost_category_id` metric resolution.
- `types/flag-settings.ts` — Extend `CaseWithMilestones` (or equivalent) with optional financial fields from `case_completion_stats`

**New metric extractors:**
- **Aggregated financial:** `case_profit` (profit), `case_margin` ((profit/reimbursement)*100), `profit_per_minute` (profit/total_duration_minutes), `total_case_cost` (total_debits + or_time_cost), `reimbursement_variance` ((reimbursement - expected)/expected*100), `or_time_cost` (or_time_cost column)
- **Per-category financial:** Resolve `cost_category_id` → look up the case's cost for that category from `procedure_cost_items`/`surgeon_cost_items` (matching case date effective dating)
- **Quality:** `missing_milestones` (count of expected milestones without `recorded_at`), `milestone_out_of_order` (count of sequence violations)
- **Computed:** `excess_time_cost` (minutes beyond median × OR hourly rate / 60), `room_idle_gap` (gap between patient_out of prev case and patient_in of next in same room)

**New threshold types in engine:**
- `percentage_of_median` — flag if value exceeds N% above/below facility median
- `percentile` — flag if value is above/below Nth percentile
- `between` — flag if value falls within `threshold_value` and `threshold_value_max` range

**Pre-join for `reimbursement_variance`:**
- Join `procedure_reimbursements` (matching procedure_type_id, payer_id, facility_id) to get expected reimbursement
- Compare actual `case_completion_stats.reimbursement` vs expected

**Commit message:** `feat(flags): phase 5 - flag engine extension for financial, quality & new threshold types`

**3-stage test gate:**
1. **Unit:** `extractMetricValue` for each financial metric. `extractMetricValue` for each quality metric. Operator evaluation for all operators. New threshold type evaluation (percentage_of_median, percentile, between).
2. **Integration:** `evaluateCase` with a financial rule correctly flags cases. `evaluateCase` with a quality rule correctly flags cases. Per-category cost metric resolves correctly.
3. **Workflow:** Create a custom financial rule (e.g., `case_profit < 0`) → run flag evaluation → verify flag generated on appropriate cases. Create quality rule → verify detection.

---

## Phase 6: Analytics Updates, Computed Baselines & Polish

**Goal:** Update flag analytics page for new categories. Visual polish, legend, keyboard nav, responsive behavior. Full test gate.

**Complexity:** Medium

**Modified files:**
- `app/analytics/flags/page.tsx` — Handle financial/quality flag categories in analytics display
- `components/analytics/flags/` — Update chart colors and category handling for financial (emerald) and quality (indigo)
- `lib/design-tokens.ts` — Add financial/quality to `flagChartColors` if needed
- `app/settings/flags/page.tsx` — Add legend section at bottom, keyboard navigation (Escape/Enter), responsive grid breakpoints

**Tasks:**
- Flag analytics page: financial/quality categories display with correct colors
- Legend section below rules: explains threshold types (median+SD, absolute, percentage_of_median, percentile, between), custom rules, scope
- Keyboard: Escape closes drawer, Enter submits builder form
- Responsive: table collapses gracefully at narrower widths (stack or scroll)
- Edge cases: no rules, all disabled, many custom rules, long rule names, no baselines available
- Verify case drawer flags display works with financial/quality flags (no changes needed per spec)

**Commit message:** `feat(flags): phase 6 - analytics updates, legend section & polish`

**3-stage test gate:**
1. **Unit:** Legend section renders. Analytics page handles new categories. Responsive breakpoints work.
2. **Integration:** Financial/quality flags appear correctly on analytics page. Computed baselines display in settings.
3. **Workflow:** Full flow: create timing rule + financial rule + quality rule → view flags in analytics → filter by category → verify all sections display correctly → test at narrow viewport.

---

## Phase 7: Cost Category Cross-Reference & Auto-Archive Cascade

**Goal:** Add cross-reference validation between cost categories and flag rules. When archiving a cost category, auto-archive linked flag rules with confirmation.

**Complexity:** Medium

**Modified files:**
- `app/settings/financials/cost-categories/page.tsx` — Add warning when archiving a category that has linked flag rules. Confirmation dialog lists affected rules. On confirm, archive both the category and linked flag rules.
- `lib/dal/flag-rules.ts` — Add `getRulesByCostCategory(costCategoryId)` query, `archiveByCostCategory(costCategoryId)` batch archive

**Key behaviors:**
- When user clicks archive on a cost category, check `flag_rules` for any rules with `cost_category_id = category.id`
- If linked rules exist: show confirmation dialog listing rule names and explaining they will also be archived
- On confirm: archive the cost category (existing behavior) + archive all linked flag rules (set `is_active = false`) + audit log both
- On cancel: no action
- If no linked rules: proceed with existing archive behavior unchanged
- Restoring a cost category does NOT auto-restore linked flag rules (user must restore those separately from the Archived tab on flags settings)

**Commit message:** `feat(flags): phase 7 - cost category cross-reference and auto-archive cascade`

**3-stage test gate:**
1. **Unit:** `getRulesByCostCategory` returns correct rules. `archiveByCostCategory` archives all linked rules. Confirmation dialog renders with rule names.
2. **Integration:** Archive cost category with linked rules → both archived. Archive cost category without linked rules → normal behavior. Audit log entries created.
3. **Workflow:** Create per-category financial rule → go to cost categories settings → archive that category → confirm cascade → verify rule archived on flags page → restore category → verify rule stays archived → manually restore rule from Archived tab.

---

## Phase Dependency Chain

```
Phase 1 (types, constants, migration)
  ↓
Phase 2 (table layout + built-in rules)
  ↓
Phase 3 (builder drawer)
  ↓
Phase 4 (CRUD + audit + archive)
  ↓
Phase 5 (flag engine extension)    ← can run parallel to Phase 6
  ↓
Phase 6 (analytics + polish)
  ↓
Phase 7 (cost category cascade)    ← depends on Phase 4 DAL
```

## File Inventory

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `types/flag-settings.ts` | 1 | Shared FlagRule type, metric catalog types, builder form types |
| `lib/constants/metrics-catalog.ts` | 1 | METRICS_CATALOG (~20 static), OPERATORS, THRESHOLD_TYPES, METRIC_CATEGORIES |
| `supabase/migrations/YYYYMMDD_flag_rules_soft_delete_and_threshold_max.sql` | 1 | Add is_active, deleted_at, deleted_by, threshold_value_max, cost_category_id |
| `components/settings/flags/FlagRuleTable.tsx` | 2 | CSS Grid table container |
| `components/settings/flags/FlagRuleRow.tsx` | 2 | Single rule row with inline editing |
| `components/settings/flags/ThresholdInline.tsx` | 2 | Inline threshold editor (type + operator + value + computed display) |
| `components/settings/flags/SeverityPills.tsx` | 2 | Inline severity selector |
| `components/settings/flags/ScopeBadge.tsx` | 2 | Scope badge selector |
| `components/settings/flags/CategoryFilter.tsx` | 2 | Segmented control filter bar |
| `components/settings/flags/MetricSearchBuilder.tsx` | 3 | Slide-over drawer with 2-step flow |
| `components/settings/flags/MetricSearchStep.tsx` | 3 | Step 1: search + category-grouped metrics |
| `components/settings/flags/RuleConfigureStep.tsx` | 3 | Step 2: rule configuration form |
| `components/settings/flags/RulePreviewSentence.tsx` | 3 | Natural-language rule preview |
| `lib/dal/flag-rules.ts` | 4 | Flag rule CRUD, baselines, cost-category cross-reference |

### Modified Files
| File | Phase(s) | Changes |
|------|----------|---------|
| `lib/design-tokens.ts` | 1, 6 | Add financial (emerald) + quality (indigo) to categoryColors. Add to flagChartColors. |
| `app/settings/flags/page.tsx` | 1, 2, 3, 4, 6 | Phase 1: import shared type. Phase 2: complete rewrite. Phase 3-4: builder + CRUD integration. Phase 6: legend + polish. |
| `lib/flagEngine.ts` | 1, 5 | Phase 1: import shared type. Phase 5: financial/quality extractors + new threshold types. |
| `lib/audit-logger.ts` | 4 | Add flagRuleAudit namespace |
| `app/analytics/flags/page.tsx` | 6 | Handle financial/quality categories |
| `components/analytics/flags/` | 6 | Update chart colors for new categories |
| `app/settings/financials/cost-categories/page.tsx` | 7 | Add cascade archive confirmation |

### Database Changes (Phase 1 Migration)
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_active` | boolean | true | Soft-delete flag |
| `deleted_at` | timestamptz | null | Soft-delete timestamp |
| `deleted_by` | uuid (FK auth.users) | null | Who archived |
| `threshold_value_max` | numeric | null | Upper bound for `between` threshold type |
| `cost_category_id` | uuid (FK cost_categories) | null | Links per-category financial metrics |

### Trigger Addition
| Trigger | Table | Function |
|---------|-------|----------|
| `sync_flag_rules_soft_delete` | `flag_rules` | `sync_soft_delete_columns()` |

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Per-category financial metrics need case-level cost breakdown (not stored in case_completion_stats) | Resolve from procedure_cost_items/surgeon_cost_items with effective dating at evaluation time |
| `get_milestone_interval_medians` RPC may be slow for computed baseline display | Cache baselines at page level, refresh on demand |
| 5 threshold types increase engine complexity | Thorough unit tests in Phase 5 for each type |
| Cost category cascade could archive rules unexpectedly | Explicit confirmation dialog listing affected rules |
| Dynamic metrics count varies per facility | Builder handles empty state gracefully (no cost categories = no per-category metrics) |
