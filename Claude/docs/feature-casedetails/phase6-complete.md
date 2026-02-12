# Phase 6: Delay Timer Enhancement — Complete

**Completed:** 2026-02-11

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/delay-timer.ts` | Pure timer utilities: `startTimer`, `pauseTimer`, `resumeTimer`, `finalizeTimer`, `computeElapsedMs`, `computeDurationMinutes`. Exports `DelayTimerSnapshot` and `DelayTimerState` types. All functions are pure — no React or side-effect dependencies — for testability. |
| `lib/hooks/useDelayTimer.ts` | Custom hook wrapping pure timer functions. Manages `snapshot` state + `snapshotRef` for synchronous reads in `stop()`. Runs 1-second `setInterval` only while timer is running. Returns `state`, `elapsedMs`, `durationMinutes`, `isActive`, `start`, `pause`, `resume`, `stop`, `reset`. |
| `lib/__tests__/delay-timer.test.ts` | 31 tests — pure function unit tests, pause/resume integration, immutability checks, full workflow scenarios. |
| `components/cases/__tests__/CaseFlagsSection-timer.test.tsx` | 26 tests — segmented control rendering, timer control states, duration calculation integration, close warning dialog, full timer and manual workflow scenarios. |

## Files Modified

| File | Change |
|------|--------|
| `components/cases/CaseFlagsSection.tsx` | Added imports: `useDelayTimer`, `useConfirmDialog`, `formatElapsedMs`, lucide icons (`Pause`, `Play`, `Square`, `Timer`). Added `durationMode` state (`'manual' | 'timer'`), `delayTimer` hook, `showToast` moved to component level (fixed hooks-in-callback violation), `timerWarningDialog` from `useConfirmDialog`. Added `resetForm`, `handleCloseForm` (warns if timer active), `handleTimerStop` (stops timer, populates duration). Replaced inline form with: segmented control (Manual/Timer), conditional rendering for each mode, timer display with pulsing dot + `formatElapsedMs`, Start/Pause/Resume/Stop control buttons, "Duration: X min" after stop. Save button disabled while timer is active. `timerWarningDialog` rendered at component bottom. |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Toggle mode (segmented control) | User preference. Manual and Timer are mutually exclusive views. Only one active at a time. |
| Full controls: Start / Pause / Resume / Stop | User preference. Supports intermittent delays that pause and resume. |
| No default durations per delay type | User preference. Timer is the main enhancement — defaults can be added later. |
| Warn before close (via `useConfirmDialog`) | User preference. Confirmation dialog if timer is running or paused when user clicks X. |
| Manual tab disabled while timer active | Prevents accidental mode switch that would lose timer state. Re-enables after Stop. |
| Save disabled while timer active | Prevents saving with incomplete timer data. User must Stop before Save. |
| `computeDurationMinutes` minimum 1 minute | Very short delays (< 30 seconds) still record as 1 minute. Prevents confusing 0-minute delays. |
| Pure timer functions exported separately | Follows Phase 2 pattern (`mergeInsert`/`mergeUpdate`/`mergeDelete`). Enables thorough unit testing without mocking React. |
| `snapshotRef` for synchronous reads | `stop()` needs to read current timer state synchronously to return duration. React state updates are async, so a ref mirrors state for immediate access. |
| Own `useConfirmDialog` instance in CaseFlagsSection | Page's instance is for milestone operations (undo, out-of-order). CaseFlagsSection is a separate component — its own instance avoids conflicts. Both are modal so they can't overlap. |
| Fixed `useToast()` hooks violation | Moved from inside `handleReportDelay` callback to component body. Pre-existing bug — hooks must be called at the top level. |

## Unexpected Findings

1. **`useToast()` was called inside `handleReportDelay` callback.** This is a React hooks rule violation (hooks must be called at the top level of a component, not inside callbacks). The `showToast` reference was moved to the component body. This was a pre-existing bug, not introduced by Phase 6.

2. **`userEvent` + `vi.useFakeTimers()` causes test hangs.** When the component has async data fetching (Supabase queries via `useEffect`), `userEvent` with fake timers creates infinite waits. Solved by using synchronous `fireEvent` from `@testing-library/react` for click/change events, and `waitFor` for async state. Fake timers only used in tests that need `vi.advanceTimersByTime()` for timer duration verification.

3. **The delay timer's 1-second interval only runs while in `running` state.** When paused or idle, no interval fires. This means the component doesn't have unnecessary re-renders when the timer isn't actively counting.

4. **`formatElapsedMs` already existed in `lib/formatters.ts`.** Used by the FlipRoomCard (Phase 5) for flip room elapsed time display. Reused directly — no new formatting code needed. Timer display is visually consistent with milestone elapsed timers.

## Test Results

```
 Test Files  23 passed (23)
      Tests  414 passed (414)
   Duration  5.01s
```

All 57 new tests pass (31 pure utility + 26 component). Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm tests unchanged from Phase 5.

### Coverage by Level

| Level | Tests | What's Covered |
|-------|-------|----------------|
| Unit | 35 | `createIdleSnapshot` structure. `startTimer` sets running state. `pauseTimer` accumulates, ignores non-running, handles zero elapsed. `resumeTimer` preserves accumulated, ignores non-paused/idle. `computeElapsedMs` for idle/running/paused/clock-skew. `computeDurationMinutes` zero/negative/minimum/rounding/large. `finalizeTimer` for all states. Component: segmented control renders Manual/Timer. Default Manual mode. Timer idle shows 0:00:00 and Start. Running shows Pause+Stop. Paused shows Resume+Stop+"Paused". Save disabled while active. Manual tab disabled while active. Notes input in both modes. |
| Integration | 14 | Pause/resume accumulation across 1 cycle and multiple cycles. Duration calculation after pause/resume. Immutability of snapshots. Timer stop populates computed duration (5 min, 3 min with pause, 1 min minimum). Close warning fires `showConfirm` for running/paused timer. No warning for idle/stopped timer. Confirm callback resets form. Save enabled after stop. Manual tab re-enabled after stop. |
| Workflow | 8 | Pure: complete start→pause→resume→stop (8 min with pause). Immediate stop (1 min minimum). Straight run no pauses (10 min). Component: full timer flow (type→start→pause→resume→stop→save). Full manual flow (type→duration→note→save). Form reset after save re-opens in default Manual state. |

## iOS Implications

iOS delay reporting should support the same timer/manual options. The pure timer logic in `lib/delay-timer.ts` could be ported to Swift — it has no web dependencies.

## All Phases Complete

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Data Integrity & Foundation Fixes | **Complete** |
| Phase 2 | Realtime Sync | **Complete** |
| Phase 3 | Live Pace Tracking | **Complete** |
| Phase 4 | Out-of-Order Milestone Warning | **Complete** |
| Phase 5 | Flip Room Status Card | **Complete** |
| Phase 6 | Delay Timer Enhancement | **Complete** |
