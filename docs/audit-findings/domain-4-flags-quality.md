# AUDIT DOMAIN 4: Flag System & Data Quality

**Audited:** 2026-02-24
**Branch:** main (commit 7d64fac)
**Scope:** Flag rules configuration, detection engine, display layer, data quality pipeline, DB architecture

---

## Executive Summary

The flag system and data quality pipeline are **functionally complete but have critical gaps** preventing production readiness:

| Severity | Finding | Impact |
|----------|---------|--------|
| CRITICAL | Flag detection only runs during demo generation | Production cases never auto-flagged |
| CRITICAL | Missing `issue_types` rows for stale detection | Stale case detection silently disabled |
| CRITICAL | No unique constraint on `case_flags(case_id, flag_rule_id)` | Duplicate flags possible |
| HIGH | `seed_facility_flag_rules()` missing 3 columns | New facilities get incomplete rules |
| HIGH | Flag summary aggregation uses wrong column | Table flag indicators show wrong severity |
| MEDIUM | No server-side validation on rule thresholds | Bad data possible via API bypass |
| MEDIUM | 574 lines of duplicated stale detection code | Maintenance drift risk |
| LOW | Inconsistent severity naming (`critical` vs `error`) | Confusing but not breaking |

---

## A. Flag Rule Configuration

### How Rules Are Configured

**Two-tier architecture:** Global templates (`facility_id IS NULL`) + facility copies.

| Layer | Page | DAL Function |
|-------|------|-------------|
| Admin templates | [app/admin/settings/flag-rules/page.tsx](app/admin/settings/flag-rules/page.tsx) | `flagRulesDal.listActiveTemplates()` |
| Facility rules | [app/settings/flags/page.tsx](app/settings/flags/page.tsx) | `flagRulesDal.listActiveByFacility()` |

Both pages use identical CSS Grid inline editing pattern with debounced saves.

### Rule Field Definitions

| Field | Column | Type | Notes |
|-------|--------|------|-------|
| Metric | `metric` | text | ID from [lib/constants/metrics-catalog.ts](lib/constants/metrics-catalog.ts) (21 static + dynamic cost-category metrics) |
| Operator | `operator` | text | `gt`, `gte`, `lt`, `lte` |
| Threshold Type | `threshold_type` | text | `median_plus_sd`, `median_plus_offset`, `absolute`, `percentage_of_median`, `percentile`, `between` |
| Threshold Value | `threshold_value` | numeric | Primary threshold |
| Threshold Max | `threshold_value_max` | numeric | Upper bound for `between` type (added migration `20260219100000`) |
| Severity | `severity` | text | `info`, `warning`, `critical` |
| Scope | `comparison_scope` | text | `facility` or `personal` |
| Category | `category` | text | `timing`, `efficiency`, `financial`, `quality` |
| Cost Category | `cost_category_id` | uuid | For dynamic per-cost-category financial metrics |

### Template-to-Facility Copy

**RPC:** `seed_facility_flag_rules(p_facility_id)` (baseline.sql:3651-3680)
- Copies `is_built_in = true` templates where `facility_id IS NULL`
- Tracks lineage via `source_rule_id`
- Idempotent: skips if facility already has a rule from that template

### Findings

**HIGH: `seed_facility_flag_rules()` missing columns**
- Does NOT copy `threshold_value_max`, `cost_category_id`, or `is_active`
- These columns were added in migration `20260219100000` but seed function predates them
- New facilities get `NULL` for these columns even if template has values
- **Fix:** Update INSERT statement to include all columns

**MEDIUM: Only `is_built_in` templates copied**
- Admin page allows creating custom template rules (`is_built_in = false`)
- These custom templates are never copied to new facilities
- **Fix:** Either remove custom template feature or update seed function

**MEDIUM: No server-side validation**
- Only HTML5 `min`/`max`/`step` attributes on inputs
- No CHECK constraints on `flag_rules` table (confirmed: zero constraints found)
- No validation in [lib/dal/flag-rules.ts](lib/dal/flag-rules.ts) DAL functions
- Users can bypass via API calls — negative thresholds, percentile > 100, etc.
- **Fix:** Add CHECK constraints or DAL-level validation

**LOW: No rule versioning**
- Rules can be edited at any time; existing flags don't track which version created them
- Can't reconstruct "why was this flagged?" if rule changed after flag creation

### Deactivation Behavior

When a rule is archived (`is_active = false`):
- Soft-delete trigger sets `deleted_at = now()`, `deleted_by = auth.uid()`
- **Existing `case_flags` remain untouched** — no cleanup mechanism
- FK behavior: `case_flags.flag_rule_id` uses `ON DELETE SET NULL` (hard delete would null it out)
- No stale-flag cleanup or invalidation logic exists

---

## B. Flag Detection Engine

### Architecture: Two Separate Systems

| File | Purpose | Writes to DB? |
|------|---------|--------------|
| [lib/flagEngine.ts](lib/flagEngine.ts) (794 lines) | Threshold-based rule engine | Only via demo generator |
| [lib/flag-detection.ts](lib/flag-detection.ts) (304 lines) | Real-time anomaly detector for surgeon day views | NO |
| [lib/flagPatternDetection.ts](lib/flagPatternDetection.ts) (259 lines) | Client-side pattern aggregator for analytics | NO |

### When Detection Runs

| Trigger | Engine | DB Write? |
|---------|--------|-----------|
| Demo data generation | `flagEngine.evaluateCasesBatch()` | YES ([lib/demo-data-generator.ts:987](lib/demo-data-generator.ts#L987)) |
| Surgeon day view render | `flag-detection.ts` | NO (UI-only) |
| User reports delay | `CaseFlagsSection.tsx:270` | YES (`flag_type='delay'`) |
| Case save/complete | **NOTHING** | **NO** |
| Scheduled job | **NOTHING** | **NO** |

### CRITICAL: No Production Flag Detection

**`evaluateCasesBatch()` is only called from `demo-data-generator.ts:980`.** There is:
- No database trigger on case completion
- No scheduled job for flag evaluation
- No API endpoint for on-demand detection
- No webhook on milestone recording

**Production cases never get auto-flagged.** All `flag_type='threshold'` records in production are from demo data or manual entry.

### Detection Logic

**Metric extraction** ([flagEngine.ts:681](lib/flagEngine.ts#L681)):
- Timing metrics: Computed from `case_milestones` milestone pairs
- Financial metrics: Read from `case_completion_stats`
- Quality metrics: Count missing/out-of-order milestones
- Efficiency metrics: Cross-case calculations (turnover, FCOTS delay)

**Baseline calculation** ([flagEngine.ts:260-348](lib/flagEngine.ts#L260)):
- Requires >= 3 historical cases (hardcoded threshold)
- Facility scope: `metric:procedure` -> `metric` fallback
- Personal scope: `metric:surgeon:procedure` -> `metric:surgeon` fallback
- No outlier filtering before median/stdDev calculation

**Threshold resolution** ([flagEngine.ts:456-499](lib/flagEngine.ts#L456)):
- `median_plus_sd`: threshold = median +/- (N * stdDev)
- `percentage_of_median`: threshold = median * (1 +/- N/100)
- `absolute`: threshold = raw value (no baseline needed)
- `percentile`: Nth percentile from sorted historical values
- `between`: value >= min AND value <= max

### CRITICAL: Not Idempotent

- No unique constraint on `case_flags(case_id, flag_rule_id)`
- Running detection twice creates **duplicate flags**
- Demo generator works around this by deleting all flags before regenerating
- **Fix:** Add `UNIQUE(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL`

### Edge Cases and False Positive Risks

1. **Missing milestones**: Returns `null`, skipped (correct)
2. **Zero/negative durations**: Skipped for timing, allowed for financial (correct)
3. **Turnover 3-hour cap**: Silently drops turnovers > 180 min (overnight gaps)
4. **New procedures**: No baselines (<3 cases), no flags generated
5. **Personal scope fallback**: Falls back to facility-wide if surgeon has insufficient history
6. **Baseline includes outliers**: Extreme values skew median/stdDev

---

## C. Flag Display

### Display Contexts

| Context | Component | Severity Colors |
|---------|-----------|----------------|
| Case detail page | [CaseFlagsSection.tsx](components/cases/CaseFlagsSection.tsx) | Red/Amber/Blue dots + cards |
| Case drawer | [CaseDrawerFlags.tsx](components/cases/CaseDrawerFlags.tsx) | Severity-coded cards |
| Cases table | `FlagIndicator` in [CasesTable.tsx:186-200](components/cases/CasesTable.tsx#L186) | Color dot + count |
| Analytics page | [app/analytics/flags/page.tsx](app/analytics/flags/page.tsx) | Full dashboard |

### Analytics Page Sections

The `get_flag_analytics` RPC (migration `20260219000018`) returns 9 sections:
1. Summary KPIs (flagged cases %, delay rate, severity counts)
2. Severity strip (critical/warning/info breakdown)
3. Weekly trend (stacked area: auto vs. user-reported)
4. Day-of-week heatmap (7 days x 6 categories)
5. Flag rule breakdown (horizontal bars by rule name)
6. Delay type breakdown (bars with avg duration)
7. Surgeon flag table (sortable, drill-through)
8. Room analysis cards (flag rate per room)
9. Recent flagged cases

### Manual Dismissal: NOT IMPLEMENTED

`case_flags` table has **no** `is_dismissed`, `dismissed_at`, or `dismissed_by` columns. Flags are permanent audit records. All flags count in analytics (filtered only by case exclusion: `is_excluded_from_metrics`).

### Analytics Filtering

The RPC filters cases as: `completed AND data_validated AND NOT is_draft AND NOT is_excluded_from_metrics`. Cases excluded from metrics have their flags hidden from analytics but still visible on the individual case.

### HIGH: Flag Summary Aggregation Bug

**Location:** [lib/dal/cases.ts:530-532](lib/dal/cases.ts#L530)

```typescript
const rank = severityRank[flag.flag_type] ?? 0  // BUG: should be flag.severity
```

`flag.flag_type` is `'threshold'` or `'delay'`, not a severity level. Should be `flag.severity` to correctly rank `critical`/`warning`/`info`. **Impact:** Table flag indicators may show wrong max severity color.

### Other Display Concerns

- **Delay flags dual-write:** `CaseFlagsSection.tsx:269-289` writes to both `case_flags` AND `case_delays` (backward compatibility). Risk of partial failure.
- **In-progress cases:** Only delay flags shown during in-progress; threshold flags appear after completion. Not documented in UI.
- **No analytics export:** Rich drill-through UI but no CSV/PDF download.
- **No severity filtering:** Cannot filter analytics by severity level.

---

## D. Data Quality Detection

### Detection Architecture

| Mode | Trigger | Scope | Checks |
|------|---------|-------|--------|
| Real-time | DB trigger on case/milestone change | Single case | Milestone issues only |
| Nightly | Edge function cron job | All facilities, last 7 days | Milestone + stale |

### Issue Types Detected

**Milestone-based** (via `detect_case_issues()` RPC):
- `missing` — Required milestone not recorded for completed cases
- `timeout` — Duration between milestone pair exceeds `max_minutes`
- `too_fast` — Duration below `min_minutes`
- `impossible` — Total case time > 24 hours
- `negative_duration` — End milestone before start milestone
- `out_of_sequence` — Milestones in wrong order
- `incomplete_case` — Missing critical milestones

**Stale case** (batch only):
- `stale_in_progress` — In-progress > 24 hours
- `abandoned_scheduled` — Scheduled 2+ days past date
- `no_activity` — In-progress, no milestone activity for 4+ hours

### Storage: `metric_issues` Table

**NOT stored in `case_flags`.** Separate table with:
- Unique constraint: `(case_id, facility_milestone_id, issue_type_id)` — prevents duplicates
- Soft expiration: `expires_at DEFAULT now() + '30 days'`
- Resolution tracking: `resolution_type_id`, `resolved_at`, `resolved_by`, `resolution_notes`
- Resolution types: `approved`, `excluded`, `expired`

### Resolution Paths

1. **Validate & Resolve:** Edit milestones -> resolve all issues -> mark `data_validated = true`
2. **Exclude:** Set `is_excluded_from_metrics = true` -> resolve with type `excluded`
3. **Bulk Exclude:** Multiple cases at once -> exclude + validate
4. **Auto-Expire:** `expire_old_issues()` RPC resolves issues where `expires_at < NOW()`

### CRITICAL: Missing Stale Case Issue Types

**Location:** [lib/dataQuality.ts:524-535](lib/dataQuality.ts#L524), [lib/stale-case-detection.ts:42-47](lib/stale-case-detection.ts#L42), edge function:424-429

The code queries `issue_types` for names `stale_in_progress`, `abandoned_scheduled`, `no_activity`. **No migration creates these rows.** The code checks for empty results and silently returns:

```typescript
if (issueTypeMap.size === 0) {
  log.info('Stale case issue types not found in database - skipping stale detection')
  return results  // SILENTLY RETURNS EMPTY
}
```

**Impact:** Stale case detection has **never run** in production. Edge function logs "0 stale cases detected" nightly.

**Fix required:**
```sql
INSERT INTO issue_types (name, display_name, description, severity) VALUES
  ('stale_in_progress', 'Stale In-Progress', 'Case in progress for over 24 hours', 'warning'),
  ('abandoned_scheduled', 'Abandoned Scheduled', 'Scheduled case is 2+ days overdue', 'warning'),
  ('no_activity', 'No Activity', 'In-progress case with no milestone activity for 4+ hours', 'info');
```

### MEDIUM: Duplicated Stale Detection Code (574 lines)

Identical `detectStaleCases()` logic exists in 3 files:
1. [lib/dataQuality.ts:514-600](lib/dataQuality.ts#L514) (87 lines)
2. [lib/stale-case-detection.ts:32-275](lib/stale-case-detection.ts#L32) (244 lines) — **UNUSED/DEAD**
3. `supabase/functions/run-data-quality-detection/index.ts:414-656` (243 lines)

`lib/stale-case-detection.ts` is never imported anywhere. Should be deleted or made the single source of truth.

---

## E. Nightly Detection Edge Function

**File:** `supabase/functions/run-data-quality-detection/index.ts` (656 lines)

### Processing Flow

1. Fetch ALL facilities (no `is_active` filter)
2. For each facility:
   a. Expire old issues (30 days)
   b. Fetch cases from last 7 days
   c. Run milestone checks per case
   d. Run stale case detection (currently non-functional)
   e. Aggregate results

### Error Handling

- **Per-facility:** try/catch continues to next facility on failure
- **Per-case:** No individual try/catch — one bad case crashes facility processing
- **No alerting:** Errors logged to console only, no admin notification
- **No retry logic:** Failed facilities not retried

### Timeout Risk

- Sequential facility processing: O(facilities x cases)
- 10 facilities x 1000 cases/facility = potential 3500+ seconds
- Deno edge function default: 60s timeout
- **Vulnerable at scale** — needs batching or per-facility scheduling

---

## F. DB Architecture Review

### Table Schemas

**`case_flags`** (baseline.sql:4735):
```
id, case_id, facility_id, flag_type, flag_rule_id, metric_value,
threshold_value, comparison_scope, delay_type_id, duration_minutes,
severity, note, created_by, created_at, facility_milestone_id
```
- CHECK: `flag_type IN ('threshold', 'delay')`
- CHECK: `severity IN ('info', 'warning', 'critical')`
- 9 indexes (case_id, facility_id, flag_rule_id, flag_type, severity, etc.)
- **NO unique constraint on (case_id, flag_rule_id)**

**`flag_rules`** (baseline.sql:5257):
```
id, facility_id (nullable), name, description, category, metric,
start_milestone, end_milestone, operator, threshold_type, threshold_value,
threshold_value_max, comparison_scope, severity, display_order, is_built_in,
is_enabled, is_active, source_rule_id, cost_category_id, deleted_at, deleted_by,
created_at, updated_at
```
- `facility_id IS NULL` = global template
- `source_rule_id` tracks template lineage (FK, NO CASCADE)
- 3 indexes (facility_id, is_enabled, metric)

**`metric_issues`** (baseline.sql:5359):
```
id, facility_id, case_id, issue_type_id, facility_milestone_id,
detected_value, expected_min, expected_max, details (jsonb),
resolution_type_id, resolved_at, resolved_by, resolution_notes,
detected_at, expires_at, milestone_id
```
- UNIQUE: `(case_id, facility_milestone_id, issue_type_id)`
- 4 indexes including partial index on unresolved issues
- Proper ON CONFLICT handling in detection RPCs

### RLS Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `flag_rules` | Users: own facility + global | Admins only | Admins only | Admins only |
| `case_flags` | Users: own facility | Users: delay only | Users: notes only | - |
| `metric_issues` | Users: own facility; GA: all | GA + system | Facility admins | GA only |

### Foreign Key Behavior

| FK | ON DELETE |
|----|----------|
| `case_flags.flag_rule_id -> flag_rules.id` | SET NULL |
| `case_flags.case_id -> cases.id` | CASCADE |
| `case_flags.facility_id -> facilities.id` | CASCADE |
| `flag_rules.facility_id -> facilities.id` | CASCADE |
| `flag_rules.source_rule_id -> flag_rules.id` | **NONE** (orphan risk) |
| `metric_issues.case_id -> cases.id` | CASCADE |

### Severity Inconsistency

- `case_flags.severity`: `info`, `warning`, `critical`
- `issue_types.severity`: `info`, `warning`, `error`
- Different top-level names: `critical` vs `error`

---

## Prioritized Action Items

### P0 — Critical (blocks production readiness)

1. **Integrate flag detection into case completion workflow**
   - Add trigger or API call after case validation/completion
   - Requires baseline precomputation strategy (can't recompute all historical cases per detection)

2. **Add missing `issue_types` rows for stale detection**
   - Migration: INSERT `stale_in_progress`, `abandoned_scheduled`, `no_activity`

3. **Add unique constraint on `case_flags`**
   - `CREATE UNIQUE INDEX idx_case_flags_unique_rule ON case_flags(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL`
   - Also add partial unique for delay flags if needed

### P1 — High (data integrity)

4. **Update `seed_facility_flag_rules()` to copy all columns**
   - Add `threshold_value_max`, `cost_category_id`, `is_active` to INSERT

5. **Fix flag summary aggregation bug**
   - [lib/dal/cases.ts:530](lib/dal/cases.ts#L530): Change `flag.flag_type` to `flag.severity`

6. **Add per-case try/catch in edge function**
   - One malformed case currently crashes entire facility processing

### P2 — Medium (code quality)

7. **Add server-side validation for rule thresholds**
   - CHECK constraints or DAL-level validation

8. **Consolidate stale detection code**
   - Delete unused [lib/stale-case-detection.ts](lib/stale-case-detection.ts)
   - Extract shared module for dataQuality.ts and edge function

9. **Add `ON DELETE SET NULL` to `flag_rules.source_rule_id`**
   - Prevent FK violation if global template ever hard-deleted

10. **Batch stale detection queries**
    - Replace N+1 per-case queries with bulk operations

### P3 — Low (nice-to-have)

11. **Unify severity naming** (`critical` vs `error`)
12. **Add flag acknowledgment/dismissal feature**
13. **Add analytics CSV export**
14. **Add rule versioning / flag snapshot**
15. **Consolidate `case_delays` dual-write** with DB trigger
16. **Add configurable stale detection thresholds** per facility

---

## Files Audited

### Flag Rules Configuration
- [app/settings/flags/page.tsx](app/settings/flags/page.tsx) — Facility flag rules (800 lines)
- [app/admin/settings/flag-rules/page.tsx](app/admin/settings/flag-rules/page.tsx) — Admin templates (780 lines)
- [lib/dal/flag-rules.ts](lib/dal/flag-rules.ts) — DAL (259 lines, 13 functions)
- [components/settings/flags/FlagRuleRow.tsx](components/settings/flags/FlagRuleRow.tsx) — Row component (180 lines)
- [components/settings/flags/ThresholdInline.tsx](components/settings/flags/ThresholdInline.tsx) — Threshold editor (192 lines)
- [components/settings/flags/MetricSearchBuilder.tsx](components/settings/flags/MetricSearchBuilder.tsx) — Builder drawer (160 lines)
- [components/settings/flags/RuleConfigureStep.tsx](components/settings/flags/RuleConfigureStep.tsx) — Builder step 2 (339 lines)
- [lib/constants/metrics-catalog.ts](lib/constants/metrics-catalog.ts) — 21 metrics (351 lines)
- [types/flag-settings.ts](types/flag-settings.ts) — Type definitions (143 lines)

### Flag Detection Engine
- [lib/flagEngine.ts](lib/flagEngine.ts) — Threshold rule engine (794 lines)
- [lib/flag-detection.ts](lib/flag-detection.ts) — Real-time anomaly detector (304 lines)
- [lib/flagPatternDetection.ts](lib/flagPatternDetection.ts) — Pattern aggregator (259 lines)
- [lib/demo-data-generator.ts](lib/demo-data-generator.ts) — Only caller of evaluateCasesBatch

### Flag Display
- [app/analytics/flags/page.tsx](app/analytics/flags/page.tsx) — Analytics dashboard
- [components/analytics/flags/](components/analytics/flags/) — 11 visualization components
- [components/cases/CaseFlagsSection.tsx](components/cases/CaseFlagsSection.tsx) — Case detail flags (694 lines)
- [components/cases/CaseDrawerFlags.tsx](components/cases/CaseDrawerFlags.tsx) — Drawer tab
- [lib/dal/cases.ts](lib/dal/cases.ts) — getFlagSummaries (lines 510-552)

### Data Quality Detection
- [lib/dataQuality.ts](lib/dataQuality.ts) — Main library (864 lines)
- [lib/stale-case-detection.ts](lib/stale-case-detection.ts) — **UNUSED** duplicate (295 lines)
- [components/data-quality/DataQualityPage.tsx](components/data-quality/DataQualityPage.tsx) — Main page (1460 lines)
- [components/data-quality/ReviewDrawer.tsx](components/data-quality/ReviewDrawer.tsx) — Review drawer (288 lines)
- [components/data-quality/FilterBar.tsx](components/data-quality/FilterBar.tsx) — Filters (109 lines)
- `supabase/functions/run-data-quality-detection/index.ts` — Edge function (656 lines)

### Migrations
- `20260101000000_baseline.sql` — Initial schema (case_flags, flag_rules, metric_issues, issue_types)
- `20260216100000_add_facility_milestone_id_to_case_flags.sql` — facility_milestone_id column
- `20260219100000_flag_rules_soft_delete_and_threshold_max.sql` — is_active, threshold_value_max, cost_category_id
- `20260219000018_flag_analytics_add_room_id_to_recent_cases.sql` — get_flag_analytics RPC
- `20260220200000_skip_validated_cases_in_detection.sql` — Skip validated cases in detection
- `20260222200004_fix_all_remaining_advisor_issues.sql` — 109 indexes including flag table FKs
