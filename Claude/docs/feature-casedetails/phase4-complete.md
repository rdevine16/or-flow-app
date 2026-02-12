# Phase 4: Out-of-Order Milestone Warning — Complete

**Completed:** 2026-02-11

---

## Files Modified

| File | Change |
|------|--------|
| `app/cases/[id]/page.tsx` | Imported `checkMilestoneOrder`. Renamed `recordMilestone` → `performRecord` (internal recording logic). New `recordMilestone` wrapper checks milestone order before recording — shows amber warning dialog via `showConfirm` if predecessors are unrecorded, calls `performRecord` directly if in order. 17 lines added. |

## Files Created

| File | Purpose |
|------|---------|
| `lib/milestone-order.ts` | Pure utility: `checkMilestoneOrder(milestoneTypeId, milestoneTypes, caseMilestones)` — compares `display_order` of target milestone against all predecessors. Returns `{ isOutOfOrder: boolean, skippedCount: number }`. Exported interfaces for testability. |
| `lib/__tests__/milestone-order.test.ts` | 22 tests — pure function unit tests, paired milestone integration, message pluralization, full case workflow scenarios. |
| `lib/__tests__/milestone-order-dialog.test.tsx` | 10 tests — renders lightweight wrapper component that mimics page's `recordMilestone` + `useConfirmDialog` interaction. Tests dialog appearance, confirm/cancel behavior, text content, and variant. |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| No Timeout→Incision special handling | No `timeout` milestone exists in the current facility milestone set. `timeout` only appears as a data quality issue type in `dataQuality.ts`. User confirmed: skip it. |
| Generic count warning text | User preference. Dialog shows "with N earlier milestones unrecorded" — does not list individual milestone names. |
| UI only — no DB schema changes | User preference. No `recorded_out_of_order` column added to `case_milestones`. Can be added later if analytics tracking is needed. |
| Always amber `warning` variant | User preference. No escalation by skip count or milestone type. All out-of-order warnings use the same amber dialog. |
| Wrapper function pattern | `recordMilestone` (sync check + dialog) wraps `performRecord` (async DB write). Both PiP panel and milestone grid call `recordMilestone` — both get the order check automatically with zero additional wiring. |
| Dialog integration test uses wrapper component | Full page rendering is impractical (1400+ lines, many dependencies). A lightweight `TestOrderWarning` component mimics the exact `checkMilestoneOrder` → `showConfirm` → `performRecord` flow from the page. |

## Unexpected Findings

1. **No Timeout milestone in the system.** The plan's "Special Timeout → Incision handling" scope item assumed a `timeout` facility milestone exists. It does not — the canonical milestone sequence goes `prep_drape_complete` → `incision` with no timeout step between them. The string `'timeout'` only exists as an issue type in the data quality detection engine (`lib/dataQuality.ts:748`).

2. **`useConfirmDialog` is single-instance.** Both undo confirmation and out-of-order warning use the same `showConfirm` from a single `useConfirmDialog()` call. Calling `showConfirm` replaces the current dialog options. This is safe because the dialog is modal (blocks interaction), so both can't fire simultaneously. If a future phase needs concurrent dialogs, a second `useConfirmDialog` instance would be required.

3. **PiP warning dialog renders on main page.** When a user records an out-of-order milestone from the PiP floating panel, the warning dialog appears on the main page (behind the PiP). This is the same behavior as the undo confirmation established in Phase 1 — known limitation, not new.

## Test Results

```
 Test Files  19 passed (19)
      Tests  307 passed (307)
   Duration  4.84s
```

All 32 new tests pass. Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm tests unchanged from Phase 3.

### Coverage by Level

| Level | Tests | What's Covered |
|-------|-------|----------------|
| Unit | 16 | `checkMilestoneOrder`: first milestone (no predecessors), all predecessors recorded, 1/3/5 skipped, `recorded_at === null` treated as unrecorded, unknown milestone ID, empty milestone types, empty case milestones, equal `display_order` edge case, last milestone with all recorded, type structure validation. |
| Integration | 11 | Paired end milestones included in predecessor check (4 scenarios). Dialog appears for out-of-order, hidden for in-order. Confirm fires callback, cancel blocks it. Singular/plural text ("1 earlier milestone" vs "3 earlier milestones"). Amber variant icon background. Correct skip counts across different scenarios. |
| Workflow | 5 | Sequential in-order full case recording (zero warnings). Skip-then-override-then-backfill sequence. Undo milestone then re-check order. In-order recording with partial predecessors. Cancel dialog then re-attempt and override. |

## Notes for Phase 5 (Flip Room Status Card)

- `recordMilestone` is now a sync wrapper around `performRecord`. Any code that calls `recordMilestone` gets the order check for free — no opt-in needed.
- `checkMilestoneOrder` is a pure function with no React or Supabase dependencies. It can be called from any context (including server-side if needed for flip room logic).
- The shared `useConfirmDialog` instance handles one dialog at a time. If flip room interactions need their own confirmation dialogs, add a second `useConfirmDialog()` call in the page component.
- The `{confirmDialog}` JSX element (line 985 in page.tsx) renders whichever dialog is currently active — undo or out-of-order. No changes needed to the render tree.
