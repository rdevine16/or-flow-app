# Audit Domain 3: Financial Data — Pricing Setup to Case Costs to Analytics

**Date:** 2026-02-24
**Status:** Complete
**Verdict:** System is architecturally sound. Financial calculations are correct, median-based throughout, and properly scoped. Several low-priority cleanup items identified.

---

## Executive Summary

The financial data pipeline flows cleanly from configuration → case validation trigger → denormalized stats → analytics display. Key findings:

- **All calculations are correct** (profit, OR cost, margin per minute)
- **Median used consistently** throughout analytics and scoring (no accidental mean usage)
- **Numeric SQL types** used for all financial columns (no float/double precision issues)
- **Point-in-time capture** — pricing is snapshot at case validation, not retroactively recalculated
- **No manual per-case financial entry** — all financial data auto-calculated from facility config
- **3 legacy ghost columns** in case_completion_stats should eventually be dropped
- **No audit trail** for pricing changes (timestamps exist but no history of old values)

### Issue Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | Ghost columns, no pricing audit trail, no manual recalculation mechanism |
| Low | 4 | Materialized view double precision, missing CHECK constraints, no overlapping date exclusion, procedure pricing delete-then-insert pattern |
| Info | 3 | $0 profit handling correct, cost_source tracks origin, effective dating works |

---

## A. Financial Configuration

### Pages Reviewed

| Page | Tables Written | Pricing Model |
|------|---------------|---------------|
| `app/settings/financials/page.tsx` | `facilities.or_hourly_rate` | Per-facility OR rate |
| `app/settings/financials/procedure-pricing/page.tsx` | `procedure_cost_items`, `procedure_reimbursements` | Per-procedure defaults, per-payer reimbursement overrides |
| `app/settings/financials/cost-categories/page.tsx` | `cost_categories` | Facility-scoped, soft-delete with 30-day restore |
| `app/settings/financials/payers/page.tsx` | `payers` | Facility-scoped, soft-delete |
| `app/settings/financials/surgeon-variance/page.tsx` | `surgeon_cost_items` | Per-surgeon overrides with effective dating |
| `app/settings/financials/targets/page.tsx` | `financial_targets` | Per-facility/year/month profit targets |

### Pricing Structure

```
Reimbursement cascade:
  1. Payer-specific rate (procedure_reimbursements WHERE payer_id = case.payer_id)
  2. Default rate (procedure_reimbursements WHERE payer_id IS NULL)

Cost cascade:
  1. Surgeon override (surgeon_cost_items for surgeon + procedure)
  2. Procedure default (procedure_cost_items for procedure)

OR Cost:
  facilities.or_hourly_rate x (total_duration_minutes / 60)
```

### Versioning Strategy

| Table | Strategy | Details |
|-------|----------|---------|
| `procedure_cost_items` | **Effective dating columns exist but NOT used by UI** | Page uses delete-then-insert pattern (lines 214-273) |
| `procedure_reimbursements` | **effective_date column exists but NOT used by UI** | Page deletes all and recreates |
| `surgeon_cost_items` | **Effective dating PROPERLY used** | Sets `effective_to = yesterday` on old, inserts new with `effective_from = today` |
| `cost_categories` | Soft delete with `deleted_at`, `deleted_by` | 30-day restore window, cascade archives flag rules |
| `payers` | Soft delete with `deleted_at`, `deleted_by` | No versioning on rates |
| `financial_targets` | Direct CRUD (no versioning) | Planning data only, no impact on calculations |

### Finding: Versioning Inconsistency (LOW)

The procedure pricing page uses **delete-then-insert** (lines 214-273) despite `effective_from`/`effective_to` columns existing on `procedure_cost_items`. The surgeon variance page correctly uses effective dating. This means:
- Procedure-level pricing history is lost on each save
- Surgeon-level pricing history is preserved
- Not a bug (trigger uses effective dating when reading), but inconsistent

---

## B. Case-Level Financial Data Entry

### Finding: No Manual Financial Entry Exists

There are **zero** financial input fields in the case creation or editing UI:
- `CaseForm.tsx` (1,527 lines) — no financial fields
- `CompletedCaseView.tsx` (1,069 lines) — read-only financial display
- `CaseDrawerFinancials.tsx` (684 lines) — display-only

All financial data is **auto-calculated** by the `record_case_stats()` trigger when `data_validated` is set to TRUE.

### Data Flow

```
Case created (no financial data)
    ↓
Milestones recorded during surgery
    ↓
data_validated = TRUE → trigger fires
    ↓
calculate_case_stats() resolves:
  - Reimbursement from procedure_reimbursements (payer-specific or default)
  - Supply costs from procedure_cost_items / surgeon_cost_items
  - OR cost from duration x or_hourly_rate
  - Profit = reimbursement - debits + credits - or_time_cost
    ↓
Writes to case_completion_stats (denormalized snapshot)
```

### cost_source Values

| Value | Meaning |
|-------|---------|
| `procedure_default` | All costs from procedure_cost_items |
| `surgeon_override` | At least one cost from surgeon_cost_items |

Note: The UI code references additional values (`actual`, `projected`, `none`) in `financialAnalytics.ts` but these are not set by the current trigger function.

---

## C. Stats Pipeline — Financial Columns

### All 11 Financial Columns in case_completion_stats

| Column | SQL Type | Source | Populated By |
|--------|----------|--------|--------------|
| `reimbursement` | numeric | `procedure_reimbursements` | Trigger (payer-specific or default) |
| `total_debits` | numeric DEFAULT 0 | `procedure_cost_items` / `surgeon_cost_items` | Trigger (SUM of debit categories) |
| `total_credits` | numeric DEFAULT 0 | `procedure_cost_items` / `surgeon_cost_items` | Trigger (SUM of credit categories) |
| `net_cost` | numeric DEFAULT 0 | Computed | `total_debits - total_credits` |
| `or_time_cost` | numeric DEFAULT 0 | Computed | `total_duration_minutes * (or_hourly_rate / 60)` |
| `or_hourly_rate` | numeric | `facilities.or_hourly_rate` | Trigger (snapshot of rate at validation time) |
| `profit` | numeric | Computed | `reimbursement - total_debits + total_credits - or_time_cost` |
| `cost_source` | text | Computed | `'surgeon_override'` or `'procedure_default'` |
| `soft_goods_cost` | numeric | **LEGACY** = total_debits | Duplicate for backward compat |
| `hard_goods_cost` | numeric | **LEGACY** = total_credits | Duplicate for backward compat |
| `or_cost` | numeric | **LEGACY** = or_time_cost | Duplicate for backward compat |

### Profit Calculation — CORRECT

```sql
v_final_profit := COALESCE(v_stats.reimbursement, 0)
                  - v_total_debits
                  + v_total_credits
                  - COALESCE(v_or_time_cost, 0);
```

### OR Cost Calculation — CORRECT

```sql
v_or_time_cost := v_stats.total_time_minutes * (v_or_hourly_rate / 60);
```

### NULL Handling — CORRECT

All financial columns use COALESCE to default to 0 when data is missing. No NULLs propagate through calculations.

### Finding: 3 Legacy Ghost Columns (MEDIUM)

`soft_goods_cost`, `hard_goods_cost`, `or_cost` are exact duplicates of `total_debits`, `total_credits`, `or_time_cost`. The UI reads new columns first with fallback:
```typescript
totalDebits: data.caseStats.total_debits ?? data.caseStats.soft_goods_cost
```
**Recommendation:** Drop legacy columns in a future migration after confirming no direct queries.

### Triggers That Fire record_case_stats()

1. `trg_record_case_stats` — AFTER INSERT on `case_milestones`
2. `trg_record_stats_on_validation` — AFTER UPDATE of `data_validated` on `cases`
3. `trg_sync_exclusion_to_stats` — AFTER UPDATE of `is_excluded_from_metrics` on `cases`
4. `trg_update_case_stats` — AFTER UPDATE on `case_milestones`

---

## D. Financial Analytics Display

### Data Source

All financial analytics read exclusively from `case_completion_stats` — no recalculation from raw pricing tables.

### Metrics Displayed

**Overview (`/analytics/financials`):**
- Total profit, median profit/case, profit per OR hour, average margin
- Revenue breakdown (reimbursement, debits, credits, OR cost) via WaterfallChart
- Monthly targets with progress tracking (from `financial_targets` table)
- Payer mix (reimbursement, profit, margin by payer)
- Profit distribution histogram (500-dollar bins)
- Daily & cumulative profit trend

**Procedure Detail (`/analytics/financials/procedures/[id]`):**
- Total profit, median profit, typical duration, margin, profit/OR hour
- Volume & profit trend (monthly), profit distribution
- Average case economics, payer mix, surgeon breakdown, recent cases

**Surgeon Detail (`/analytics/financials/surgeons/[id]`):**
- Total profit, typical/case, profit/OR hour, margin, cases, typical duration
- Facility comparison (procedure-adjusted), profit impact from efficiency
- Monthly trend, profit distribution, case economics, payer mix, procedure breakdown

### Median Usage — CORRECT

Median function used consistently throughout `useFinancialsMetrics.ts`:
```typescript
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}
```
Average is calculated but used only for: fallback when median is null, P&L totals (total/count), and margin percentage.

### Rounding — CORRECT

- Currency: `Intl.NumberFormat` with `maximumFractionDigits: 0` (whole dollars)
- Percentages: `toFixed(1)` (one decimal)
- Duration: `Math.round()` for minutes
- No floating-point precision issues at typical OR financial ranges

### WaterfallChart

Revenue → Costs → Profit cascade visualization:
1. Revenue (blue) — full height
2. Debits/Implants (red) — hangs from revenue
3. Credits (green) — grows upward
4. OR Cost (amber) — hangs from current position
5. Profit (green/red) — final bar from zero

### Column Evolution Handled

Dual support for legacy and new columns prevents breaking changes:
```typescript
function getCaseDebits(c): number { return c.total_debits ?? c.soft_goods_cost ?? 0 }
function getCaseCredits(c): number { return c.total_credits ?? c.hard_goods_cost ?? 0 }
function getCaseORCost(c): number { return c.or_time_cost ?? c.or_cost ?? 0 }
```

### Non-Database Metrics

- `or_hourly_rate` from `facilities` table (for cost-per-minute display)
- `profit_target` from `financial_targets` table (monthly target progress)
- Sparklines: monthly granularity, last 6 months

---

## E. ORbit Score — Profitability Pillar

### Weight: 30% of composite score

### Margin Per Minute Formula — CORRECT

```typescript
MPM = case_completion_stats.profit / (patient_out_at - patient_in_at in minutes)
```

Duration is milestone-derived (patient_in → patient_out), NOT `surgical_duration_minutes`. This is intentional — total case time.

### $0 Profit Handling — CORRECT (v2.0 fix)

```typescript
// Allow profit === 0 (break-even). Only skip null/undefined.
if (fin?.profit == null) continue
```

### MAD-Based Scoring — CORRECT

- Uses median MPM across peer surgeons in same procedure cohort
- 3 MAD bands: median = 50pts, +1 MAD = 67pts, +3 MAD = 100pts (capped)
- 5% minimum MAD floor (prevents hyper-sensitivity in tight clusters)
- Score range: 10 (floor) to 100 (ceiling)

### Volume Weighting — CORRECT

Scores are weighted by case volume per procedure:
```typescript
const totalVolume = scores.reduce((s, x) => s + x.volume, 0)
const final = Math.round(scores.reduce((s, x) => s + x.score * (x.volume / totalVolume), 0))
```

### Edge Cases — ALL HANDLED

| Edge Case | Handling |
|-----------|----------|
| NaN timestamps | Returns null, case skipped |
| Zero/negative duration | Case skipped |
| Division by zero | Duration check prevents |
| Zero peer median | Returns 50 (default) |
| Empty cohort | Returns 50 |
| Zero MAD | Range interpolation fallback |

### Finding: No Unit Tests for Scoring Engine

No test files found for `orbitScoreEngine.ts`. This is the most complex financial calculation in the system.

---

## DB Architecture Review

### SQL Types — CORRECT

All financial columns use `numeric` (arbitrary precision), not float/double/real:
- `procedure_cost_items.amount` — numeric DEFAULT 0
- `procedure_reimbursements.reimbursement` — numeric DEFAULT 0
- `surgeon_cost_items.amount` — numeric DEFAULT 0
- All 11 `case_completion_stats` financial columns — numeric
- `facilities.or_hourly_rate` — numeric(10,2)
- `financial_targets.profit_target` — numeric

**Exception:** Materialized views use `double precision` for PERCENTILE_CONT calculations. Acceptable for aggregate statistics.

### Audit Trail — PARTIAL

| Table | Tracking | Gap |
|-------|----------|-----|
| `cost_categories` | `created_at`, `updated_at`, `deleted_at`, `deleted_by` | No old-value capture |
| `payers` | `created_at`, `deleted_at`, `deleted_by` | No update tracking |
| `procedure_cost_items` | `created_at`, `updated_at`, `effective_from/to` | No who-changed tracking |
| `procedure_reimbursements` | `created_at`, `updated_at`, `effective_date` | No who-changed tracking |
| `surgeon_cost_items` | `created_at`, `effective_from` | No who-changed tracking |

**No immutable history tables exist.** Cannot answer: "Who changed THA reimbursement from $5,000 to $6,000 on Jan 15?"

### Retroactive Pricing — NOT POSSIBLE (by design)

- Pricing is captured at case validation (point-in-time snapshot)
- Changing pricing does NOT retroactively update existing case_completion_stats
- No trigger on pricing tables that recalculates stats
- This is **correct behavior** — financial stats should reflect pricing at time of service
- **Gap:** No admin function to manually recalculate if pricing was entered incorrectly

### Foreign Keys — CORRECT

| Relationship | On Delete |
|-------------|-----------|
| procedure_reimbursements → facilities | CASCADE |
| procedure_reimbursements → payers | CASCADE |
| procedure_reimbursements → procedure_types | CASCADE |
| procedure_cost_items → cost_categories | CASCADE |
| case_completion_stats → payers | SET NULL (preserves stats) |

### RLS — CORRECT

All financial tables enforce `facility_id` scoping with appropriate role-based policies (user read, admin manage, global admin full access).

### Indexes — COMPREHENSIVE

All query patterns covered, including:
- `idx_pci_effective_range` for effective dating lookups
- `idx_procedure_cost_items_active` for current-price queries
- `idx_ccs_facility_surgeon_procedure` for analytics aggregations
- `idx_financial_targets_facility_year_month` for target lookups

---

## Recommendations (Priority Ordered)

### Medium Priority

1. **Drop legacy ghost columns** — `soft_goods_cost`, `hard_goods_cost`, `or_cost` in case_completion_stats. After confirming no direct queries remain, create migration to drop them.

2. **Add manual recalculation function** — `recalculate_case_stats(case_id UUID)` for admin use when pricing was entered incorrectly. Currently no way to fix a validated case's financial data without invalidating and re-validating.

3. **Add pricing audit trail** — Create `pricing_history` table capturing who changed what, when, and old/new values.

### Low Priority

4. **Fix procedure pricing versioning** — Change delete-then-insert pattern to use existing `effective_from`/`effective_to` columns (match surgeon variance page behavior).

5. **Add CHECK constraint** — `effective_to IS NULL OR effective_to >= effective_from` on procedure_cost_items and surgeon_cost_items.

6. **Add exclusion constraint** — Prevent overlapping effective date ranges for same procedure+facility combination.

7. **Add orbit score engine tests** — Critical financial calculation with zero test coverage.

---

## Files Audited

### Configuration Pages
- `app/settings/financials/page.tsx`
- `app/settings/financials/procedure-pricing/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/financials/surgeon-variance/page.tsx`
- `app/settings/financials/targets/page.tsx`

### Case Entry
- `components/cases/CaseForm.tsx`
- `components/cases/CompletedCaseView.tsx`
- `components/cases/CaseDrawerFinancials.tsx`
- `lib/hooks/useCaseFinancials.ts`
- `lib/financials.ts`

### Stats Pipeline
- `supabase/migrations/20260101000000_baseline.sql` (calculate_case_stats, record_case_stats)
- `supabase/migrations/20260222200006_fix_function_lint_errors_and_unused_indexes.sql`

### Analytics Display
- `app/analytics/financials/page.tsx`
- `app/analytics/financials/procedures/[id]/page.tsx`
- `app/analytics/financials/surgeons/[id]/page.tsx`
- `components/analytics/financials/SurgeonDetail.tsx`
- `components/analytics/financials/ProcedureDetail.tsx`
- `components/analytics/financials/WaterfallChart.tsx`
- `components/analytics/financials/useFinancialsMetrics.ts`
- `components/analytics/financials/utils.ts`
- `components/analytics/financials/types.ts`
- `lib/utils/financialAnalytics.ts`

### Scoring
- `lib/orbitScoreEngine.ts`
- `supabase/functions/compute-surgeon-scorecard/index.ts`

### Database
- `supabase/migrations/20260101000000_baseline.sql`
- `supabase/migrations/20260220100000_financial_targets.sql`
- `supabase/migrations/20260219000008_add_kpi_target_columns.sql`
