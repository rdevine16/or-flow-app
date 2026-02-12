# Phase 5: Flip Room Status Card — Complete

**Completed:** 2026-02-11

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/flip-room.ts` | Pure utilities: `findNextCase()` finds surgeon's next sequential case, determines flip room vs same room. `getCurrentMilestoneStatus()` returns highest-display-order recorded milestone with elapsed time. Exports `SurgeonDayCase`, `FlipRoomMilestoneData`, `CurrentMilestoneStatus`, `FlipRoomResult` types for testability. |
| `lib/hooks/useFlipRoom.ts` | Custom hook: queries surgeon's same-day cases, finds next flip room via `findNextCase`, fetches flip room milestones joined through `facility_milestones`. Two Realtime subscriptions — `case_milestones` (refetch on any change) and `cases` (inline update for `called_back_at`). Uses `useRef` for fetch callback to prevent subscription churn. Returns `flipRoom`, `nextSameRoomCaseNumber`, `setCalledBackAt`. |
| `components/cases/FlipRoomCard.tsx` | Card component: indigo ArrowRightLeft icon + "Flip Room" header, room name badge, procedure + case number, current milestone with pulsing dot + elapsed time via `formatElapsedMs`, "Call Patient Back" gradient button or "Patient Called" confirmation with undo. |
| `lib/__tests__/flip-room.test.ts` | 30 tests — `findNextCase` unit tests (14), `getCurrentMilestoneStatus` unit tests (5), integration (5), workflow (3 scenarios with 6 assertions). |
| `components/cases/__tests__/FlipRoomCard.test.tsx` | 20 tests — rendering (10), interaction/integration (7), workflow (3). |

## Files Modified

| File | Change |
|------|--------|
| `app/cases/[id]/page.tsx` | Imported `useFlipRoom` + `FlipRoomCard`. Added hook call after milestone Realtime subscription. Added `flipRoomCallingBack` state. Added `callBackFlipRoom` function (optimistic update → DB `called_back_at` → notification insert → push notification → audit log → rollback on error). Added `undoCallBackFlipRoom` function (optimistic clear → DB clear → delete recent notifications → cancellation push → audit log → rollback on error). Reordered sidebar: Flip Room → Surgeon Left → Team → Trays → Implants → Notes → Flags. Added "Next: Case #X (same room)" inline note when next case is same room. |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Next sequential case only (not all other rooms) | User preference. Shows the surgeon's next case by `start_time` order, not all in-progress cases across rooms. |
| `called_back_at` / `called_back_by` (not `call_time`) | `called_back_at` is the established pattern from `CallNextPatientModal`. `call_time` is a separate pre-op patient call concept. |
| Direct one-click callback (no modal) | User preference. Full flow matches `CallNextPatientModal` output (notification + push + audit) but skips room selection UI. |
| Refetch on Realtime milestone events | Simpler than merge functions for a secondary display card. Acceptable latency for a non-primary UI element. |
| `useRef` for fetch callback in Realtime handlers | Prevents subscription teardown/recreation when `fetchFlipRoom` callback identity changes. Subscription effect depends only on `flipCaseId` and `enabled`. |
| Filter out cancelled + completed cases | Only `scheduled`, `in_progress`, and `on_hold` cases are valid flip room candidates. |
| Null both rooms → no card | Can't determine "flip" vs "same" room if either case has no `or_room_id`. Card hidden entirely. |
| Sidebar order: Flip Room → Surgeon Left → Team | User preference. Flip room is most actionable during surgery. Surgeon Left moved above Team for grouping. |

## Unexpected Findings

1. **`called_back_at` / `called_back_by` already exist on `cases` table.** No schema migration needed. These fields were added for the `CallNextPatientModal` feature and the flip room card reuses them directly.

2. **`CallNextPatientModal` uses the _current_ room's `or_room_id` for notification `room_id`.** The notification routes to the room where the staff is (sending the call), not the flip room. The flip room card follows this same pattern.

3. **This is the second Realtime subscription type in the app.** Phase 2 added `case_milestones` subscription. Phase 5 adds `cases` table subscription (for `called_back_at` changes). Both coexist without issue — separate channel names prevent conflicts.

4. **`elapsedMs` updates via the page's existing `currentTime` tick.** The page already has a 1-second `setInterval` for `currentTime`. The `FlipRoomCard` receives this as a prop, so the flip room elapsed time updates live without a separate timer.

## Test Results

```
 Test Files  21 passed (21)
      Tests  357 passed (357)
   Duration  5.02s
```

All 50 new tests pass. Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm tests unchanged from Phase 4.

### Coverage by Level

| Level | Tests | What's Covered |
|-------|-------|----------------|
| Unit | 26 | `findNextCase`: empty array, single case, different room, same room, cancelled skip, completed skip, not found, sort order, null `start_time` sorted to end, null rooms, `on_hold` valid, immutability, last case in sequence, `called_back_at` preserved. `getCurrentMilestoneStatus`: empty array, no recorded, single recorded, highest `display_order` wins, unrecorded ignored, elapsed calculation. Component: header title, room badge, procedure, case number, not started state, milestone name, elapsed time, call-back button, called confirmation, undo button. |
| Integration | 14 | 3-room surgeon finds correct flip room from middle. Same-room-then-flip-room sequence. Skip multiple cancelled/completed to find next valid. Data preservation (procedure, callback, room name). Click callbacks fire handlers. Loading state disables buttons and shows "Calling...". Mutual exclusivity: call-back button hidden when called, called state hidden when not called. Full milestone set returns correct current status. |
| Workflow | 10 | Full surgeon day (3 cases, 2 rooms — flip room resolves correctly at each position). Case completion mid-day (completed case skipped, new next case found). Milestone progression tracking (patient_in → incision → closing with correct elapsed at each step). Full context display (room + procedure + milestone + call-back). Called-back state with undo option. Not-started case waiting for flip room. |

## Notes for Phase 6 (Delay Timer Enhancement)

- The sidebar now has 7 sections (flip room, surgeon left, team, trays, implants, notes, flags). If delay timer adds a new section, consider whether the sidebar is getting too tall on smaller screens.
- `CaseFlagsSection` (the "Flags & Delays" card at sidebar bottom) is where delay reporting currently lives. The timer enhancement should modify this component, not add a new sidebar section.
- The `useConfirmDialog` single-instance limitation noted in Phase 4 still applies. If delay timer needs a confirmation dialog, it can reuse the existing `showConfirm` since it's modal (no concurrent dialogs possible).
- The `currentTime` state (1-second tick) is available for delay timer display. No need to add another interval.
