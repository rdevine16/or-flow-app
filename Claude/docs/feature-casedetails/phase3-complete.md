# Phase 3: Live Pace Tracking — Complete

**Completed:** 2026-02-11

---

## Files Modified

| File | Change |
|------|--------|
| `lib/pace-utils.ts` | Added `MilestonePaceInfo` interface and `computeMilestonePace()` function. Pure calculation: takes expected/actual minutes + sample size, returns rounded values with variance (positive = ahead). |
| `components/cases/MilestoneCard.tsx` | Added `paceInfo` prop. Renders "Xm vs Ym exp — Zm ahead/behind" below timestamp for completed milestones. Color-coded: emerald (>5m ahead), blue (0–5m ahead/on pace), amber (1–5m behind), red (>5m behind). Hidden when `sampleSize < MIN_SAMPLE_SIZE`. |
| `app/cases/[id]/page.tsx` | **Data migration:** Replaced deprecated `surgeon_procedure_averages` / `surgeon_milestone_averages` queries with `surgeon_procedure_stats` / `surgeon_milestone_stats` (median-based materialized views). Removed raw 30-day average computation (lines 372–412 old). **New state:** `procedureStats`, `milestoneStats`, `caseSequence` replace `surgeonAverages`, `surgeonProcedureAverage`, `milestoneAverages`. **Hero section:** Added `PaceProgressBar` below timer cards (wrapped in `flex flex-col` container). Insufficient data message when sample < 10. **Hero cards:** `medianTotalMinutes` / `medianSurgicalMinutes` replace raw averages. **Quick Info:** "Case X of Y today" from runtime query. **Milestone grid:** Each `MilestoneCard` receives computed `paceInfo` — time-from-start for single milestones, duration for paired. **CompletedCaseView:** Props transformed to match existing interface (`medianDuration` → `avgTotalMinutes`, `median_minutes_from_start` → `avgMinutesFromStart`). |

## Files Created

| File | Purpose |
|------|---------|
| `lib/__tests__/pace-utils-milestone.test.ts` | 17 tests — `computeMilestonePace` unit tests, `MIN_SAMPLE_SIZE` threshold, paired duration calculation, full case workflow (ahead + behind scenarios). |
| `components/cases/__tests__/MilestoneCard-pace.test.tsx` | 14 tests — pace display rendering, color coding (4 tiers), insufficient data guard, boundary (exactly 10), null/undefined/omitted paceInfo, paired milestone pace, in-progress guard. |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Pace measured from `patient_in`, not scheduled start | Better for coaching — measures surgical efficiency. Before patient_in, no pace shown. |
| Paired milestones show duration pace | "Anesthesia took 15m vs 18m" is more useful than "anesthesia ended at 30m vs 33m from start." |
| Case sequence computed at runtime (no schema change) | Queries surgeon's cases for same date + facility, filters cancelled, finds position by `start_time` order. |
| Hero cards keep "Avg:" label | Minimal UI disruption. Underlying value is now median but label is familiar to users. |
| CompletedCaseView receives transformed data | Passes `medianDuration` as `avgTotalMinutes` and `median_minutes_from_start` as `avgMinutesFromStart`. Avoids touching CompletedCaseView internals. |
| `PaceProgressBar` reused from dashboard | Same component, same styling. Wrapped in white card below hero timer cards. |

## Unexpected Findings

1. **Raw 30-day average computation was redundant.** The page computed `surgeonAverages` by fetching all surgeon cases from the last 30 days and manually averaging patient_in→patient_out and incision→closing times. The `surgeon_procedure_stats` and `surgeon_milestone_stats` materialized views already provide this (with medians). Removed the expensive multi-case query entirely.

2. **`surgeon_milestone_stats` uses `milestone_type_id` (canonical), not `facility_milestone_id`.** Matching requires going through `facility_milestones.source_milestone_type_id`. Some facility milestones may not have a `source_milestone_type_id` set — those milestones won't show pace data.

3. **Surgical time median requires two milestone lookups.** No single stat gives "surgical time" directly. Computed as `closing.median_minutes_from_start - incision.median_minutes_from_start` from milestone stats.

## Test Results

```
 Test Files  17 passed (17)
      Tests  275 passed (275)
   Duration  5.08s
```

All 31 new tests pass. Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm unchanged from Phase 2.

### Coverage by Level

| Level | Tests | What's Covered |
|-------|-------|----------------|
| Unit | 21 | `computeMilestonePace` ahead/behind/zero/fractional/large/zero-expected values. `MIN_SAMPLE_SIZE` threshold (below, at, above). `MilestonePaceInfo` type structure. Pace text hidden for: not-started milestone, null paceInfo, undefined paceInfo, insufficient sample size. |
| Integration | 7 | Color coding: emerald (>5m ahead), blue (0–5m), amber (1–5m behind), red (>5m behind). Sample size boundary (exactly 10 shows, 5 hides). Paired milestone duration pace display with timestamps. |
| Workflow | 3 | Full case ahead of schedule: Patient In → Incision → Closing → Patient Out with variance checks at each step + surgical duration. Full case behind schedule: two milestones with negative variance. In-progress paired milestone correctly suppresses pace display. |

## Notes for Phase 4 (Out-of-Order Milestone Warning)

- `milestoneTypes` array has `display_order` on each `FacilityMilestone`. Out-of-order detection should compare the `display_order` of the milestone being recorded against already-recorded milestones.
- `recordMilestone(milestoneTypeId)` is the function that handles recording. The warning dialog should intercept before the DB write, similar to how `undoMilestone` uses `showConfirm()` from `useConfirmDialog`.
- `milestoneCards` are filtered to exclude `pair_position === 'end'` milestones (they render as part of their start partner). Out-of-order checks should consider both start and end milestones in the raw `milestoneTypes` array.
- The `useConfirmDialog` hook is already imported and active. A second concurrent dialog may conflict — verify that `showConfirm` handles sequential calls correctly, or queue the warning before the undo confirmation.
