# Milestone Drawer Redesign — Phase-Level Timing

## Problem

The milestone drawer's interval column is misleading. It shows "time to arrive at this milestone from the previous one," which gets attributed to the wrong phase. Example: Incision shows 8m (the gap from Anesthesia Stop → Incision), but the actual incision duration (Incision → Close) is 45m and shows up on the Close row.

## Decision

Adopt the same 4-phase timing model the Surgeon Performance Daily Analysis page already uses, instead of showing every individual milestone with granular intervals.

### The 4 Phases

| Phase | From → To | Helper (analyticsV2.ts) |
|-------|-----------|------------------------|
| Pre-Op | patient_in → incision | `getWheelsInToIncision()` |
| Surgical | incision → closing | `getIncisionToClosing()` |
| Closing | closing → closing_complete | `getClosingTime()` |
| Emergence | closing_complete → patient_out | `getClosedToWheelsOut()` |

These helpers already exist in `lib/analyticsV2.ts` and are used by the Surgeon Performance page.

## What Changes

### 1. New DB Function: `get_phase_medians`

**Why:** No precomputed source for phase-level medians exists today. The existing `get_milestone_interval_medians` function computes per-milestone interval medians (too granular). The Surgeon Performance page computes phase timing client-side using averages (violates the "median over average" platform principle).

**What it does:** Computes the median duration of each of the 4 phases across completed+validated cases, returning both surgeon-level and facility-level medians.

**Signature:**
```sql
get_phase_medians(
  p_surgeon_id        UUID,
  p_procedure_type_id UUID,
  p_facility_id       UUID
)
RETURNS TABLE (
  phase_name             TEXT,       -- 'pre_op', 'surgical', 'closing', 'emergence'
  phase_from_milestone   TEXT,       -- e.g. 'incision'
  phase_to_milestone     TEXT,       -- e.g. 'closing'
  surgeon_median_minutes NUMERIC,
  surgeon_case_count     INT,
  facility_median_minutes NUMERIC,
  facility_case_count    INT
)
```

**Algorithm:**
1. For each case, compute the 4 phase durations directly from milestone timestamps (patient_in→incision, incision→closing, closing→closing_complete, closing_complete→patient_out)
2. Filter to completed + validated cases only
3. Use `PERCENTILE_CONT(0.5)` for medians (consistent with platform principle)
4. Return surgeon-level and facility-level medians for each phase

### 2. Milestone Drawer Display Change

Replace the current N-row milestone-by-milestone table with a 4-row phase table:

```
Phase          Duration    Median    Delta
─────────────────────────────────────────────
Pre-Op         20m         18m       +2m
Surgical       45m         40m       +5m
Closing        15m         12m       +3m
Emergence      10m         8m        +2m
─────────────────────────────────────────────
Total          90m         78m       +12m
```

Each row shows:
- Phase name
- This case's phase duration (from milestone timestamps)
- Median phase duration (from new DB function, togglable surgeon vs facility)
- Delta = duration - median, with severity badge

### 3. Files That Change

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: `get_phase_medians` DB function |
| `lib/hooks/useMilestoneComparison.ts` | Call `get_phase_medians` instead of (or in addition to) `get_milestone_interval_medians` |
| `lib/utils/milestoneAnalytics.ts` | Add phase-level interval calculation using existing `analyticsV2.ts` helpers |
| `components/cases/CaseDrawerMilestones.tsx` | Render 4 phase rows instead of N milestone rows |
| `components/cases/MilestoneDetailRow.tsx` | Simplify to 4-row phase table |
| `components/cases/MilestoneTimeline.tsx` | Swimlane segments become 4 phases |

### 4. Files That Do NOT Change

- `facility_milestones` table — no schema changes
- `case_milestones` table — untouched
- `procedure_milestone_config` — untouched
- `create_case_with_milestones()` RPC — untouched
- RLS policies — unaffected
- Existing triggers — unaffected
- Settings pages — no changes needed

## What We Considered But Deferred

### Milestone Hierarchy (phase vs detail milestones)

We discussed adding a `milestone_level` column ('phase' vs 'detail') to `facility_milestones` to support a collapsible hierarchy where phase rows (Incision) could expand to show detail milestones (Cup Placed, Stem Placed) underneath. This would allow facilities to add custom sub-milestones without breaking phase-level timing.

**Deferred because:** It adds schema complexity and the immediate need is just to match the Surgeon Performance page's 4-phase model. Can revisit if facilities need expandable detail views.

### Interval Shift (re-attributing intervals)

Original observation: intervals are shown on the "arrival" milestone row rather than the "departure" row. We discussed shifting intervals up so each milestone shows "how long were we in this state."

**Resolved by:** Moving to phase-level display eliminates this problem entirely. Phase duration is unambiguous — Surgical = Incision → Closing, period.

## Bug Found During Analysis

The Surgeon Performance Overview tab uses `calculateAverage()` for phase-level metrics, violating the platform-wide "median over average" principle documented in `architecture.md`. The new `get_phase_medians` DB function could be reused there to fix this.

## Implementation Order

1. Create `get_phase_medians` DB function (migration)
2. Update `useMilestoneComparison` hook to fetch phase medians
3. Add phase-level calculation logic to `milestoneAnalytics.ts`
4. Update drawer components (CaseDrawerMilestones, MilestoneDetailRow, MilestoneTimeline)
5. Update tests
6. (Future) Consider reusing `get_phase_medians` on Surgeon Performance Overview tab to fix averages→medians
