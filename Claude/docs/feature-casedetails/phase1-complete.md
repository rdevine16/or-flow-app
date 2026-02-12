# Phase 1: Data Integrity & Foundation Fixes — Complete

**Completed:** 2026-02-11

---

## Files Modified

| File | Change |
|------|--------|
| `lib/formatters.ts` | Added `timeZone?: string` option to `formatTimestamp()` and `formatTimestamp24()`. Added `isNaN(date.getTime())` guard for invalid date strings. Backward-compatible. |
| `app/cases/[id]/page.tsx` | Added debounce state (`recordingMilestoneIds` Set), optimistic UI with rollback, undo confirmation via `useConfirmDialog`, timezone passthrough to all components, fixed broken `milestone_types` join. |
| `components/cases/MilestoneCard.tsx` | Added `loading` and `timeZone` props. Buttons disable during in-flight writes. Shows "Recording..."/"Completing..." feedback. |
| `components/ui/MilestoneButton.tsx` | Removed duplicate `formatTime()`. Now uses shared `formatTimestamp()`. Added `loading` and `timeZone` props. Removed unused `name` prop. |
| `components/pip/PiPMilestonePanel.tsx` | Removed duplicate `formatTime()`. Now uses shared `formatTimestamp()`. Added `timeZone` prop. |
| `components/pip/PiPMilestoneWrapper.tsx` | Added `timeZone` prop, passes through to `PiPMilestonePanel`. |

## Files Created

| File | Purpose |
|------|---------|
| `lib/__tests__/formatters-timestamp.test.ts` | 16 tests — null/empty input, 12h/24h format, 4 timezone conversions, DST, invalid strings |
| `components/cases/__tests__/MilestoneCard.test.tsx` | 14 tests — not-started/completed/in-progress states, loading/debounce, timezone display, undo button disable |
| `components/ui/__tests__/MilestoneButton.test.tsx` | 13 tests — single + paired buttons, loading states, timezone, disabled states |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Optimistic UI + disable (not spinner) | User preference. Milestone card transitions to recorded state immediately; buttons disabled until DB confirms. Rollback + error toast on failure. |
| Simple undo confirmation | User preference. "Are you sure you want to undo this milestone?" — no milestone name or status warning. Uses existing `ConfirmDialog` with `warning` variant. |
| Local time only (no TZ abbreviation) | User preference. Users are always at their own facility. |
| Consolidate `formatTime()` into shared `formatTimestamp()` | User preference. Single source of truth. Three duplicate functions removed (MilestoneButton, PiPMilestonePanel). |
| `timeZone` param is optional with no default | Backward-compatible. Existing callers without `timeZone` still work (uses browser local time). Only case detail page and PiP panel explicitly pass `userData.facilityTimezone`. |

## Unexpected Findings

1. **DAL was already correct.** The audit report flagged `lib/dal/cases.ts` as using `milestone_type_id`, but it already uses `facility_milestone_id` throughout. The fix must have been applied before this phase.

2. **Broken surgeon averages query (line 370).** The case detail page had a query joining `case_milestones` → `milestone_types` via the dropped `milestone_type_id` FK. This silently returned null data, meaning surgeon averages (Total Time / Surgical Time comparisons in the timer hero cards) were always empty. Fixed to join through `facility_milestones` instead.

3. **`MilestoneButton.tsx` may be dead code.** Neither the case detail page nor the PiP panel imports it — `MilestoneCard` and inline PiP buttons are used instead. Updated it anyway per plan scope, but worth verifying if anything else references it.

4. **`toLocaleTimeString` with `hour12: false` outputs leading zeros** (e.g., `09:30` not `9:30`). This is standard 24-hour format behavior. Test expectations adjusted accordingly.

## Test Results

```
 Test Files  14 passed (14)
      Tests  213 passed (213)
   Duration  4.62s
```

All 3 new test files pass. Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm tests are unrelated.

### Coverage by level

| Level | Tests | What's covered |
|-------|-------|----------------|
| Unit | 29 | `formatTimestamp`/`formatTimestamp24` with timezones, null handling, invalid input. Button/card rendering in each state. |
| Integration | 11 | Loading prop disables buttons and prevents `onRecord`/`onUndo` callbacks. Timezone prop flows through to rendered time strings. |
| Workflow | 3 | Record click → callback fires. Undo click → callback fires. Loading state → click blocked. |

## Notes for Phase 2 (Realtime Sync)

- `caseMilestones` state now uses optimistic IDs (`optimistic-${milestoneTypeId}`) for new milestones before DB confirms. Realtime subscription handlers must handle merging incoming rows that replace optimistic entries.
- `recordingMilestoneIds` Set tracks in-flight writes. Realtime updates from other devices should NOT be blocked by this — only local writes are guarded.
- The `undoMilestone` function now shows a confirmation dialog before executing. The PiP panel passes `undoMilestone` as `onUndoMilestone` — the dialog renders in the main page, not the PiP window. This should still work since `useConfirmDialog` state lives in the parent component.
- `timeZone` is now threaded through MilestoneCard, MilestoneButton, and PiP. Realtime-updated timestamps will automatically display in the correct timezone.
