# Phase 2: Realtime Sync — Complete

**Completed:** 2026-02-11

---

## Files Modified

| File | Change |
|------|--------|
| `app/cases/[id]/page.tsx` | Added `useMilestoneRealtime` import. Added hook call after data-fetch effect — subscribes when `!loading && !!caseData`, unsubscribes on unmount. Two lines of integration code. |

## Files Created

| File | Purpose |
|------|---------|
| `lib/hooks/useMilestoneRealtime.ts` | Custom hook: Supabase Realtime subscription on `case_milestones` filtered by `case_id`. Exports pure merge functions (`mergeInsert`, `mergeUpdate`, `mergeDelete`) for testability. Handles optimistic ID replacement, simultaneous recording dedup, and cleanup on unmount. |
| `lib/hooks/__tests__/useMilestoneRealtime.test.ts` | 31 tests across unit, integration, and workflow levels. |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Pure merge functions exported separately | Enables thorough unit testing without mocking React or Supabase. The hook delegates all state logic to these functions. |
| Subscribe to `event: '*'` (INSERT, UPDATE, DELETE) | Covers all mutation types. DELETE included for future-proofing even though current undo uses UPDATE (`recorded_at = null`). |
| PiP sync via props — no separate subscription | PiP already receives `caseMilestones` as props from parent page. When Realtime updates `setCaseMilestones`, React re-renders PiP automatically. Zero additional code needed. |
| Simultaneous recording: keep earlier `recorded_at` | When two devices INSERT for the same `facility_milestone_id`, `mergeInsert` keeps whichever was recorded first. Deterministic, no data loss. |
| `enabled: !loading && !!caseData` | Subscription starts only after initial fetch completes. Prevents subscription from firing before state is initialized. |
| Channel name `case-milestones:{caseId}` | Namespaced per case. Multiple tabs with different cases get independent channels. |

## Unexpected Findings

1. **No existing Realtime subscriptions anywhere in the codebase.** This is the first. The only `.subscribe()` call was `supabase.auth.onAuthStateChange()` in `session-manager.ts` — not a database channel.

2. **`createBrowserClient` is a singleton.** The `supabase` reference from `createClient()` is stable across renders, so the hook's dependency array works correctly without a ref.

3. **No unique constraint on `(case_id, facility_milestone_id)`.** Two devices recording the same milestone simultaneously can create duplicate DB rows. The merge logic handles this in the UI (keeps earlier timestamp), but a DB migration adding a unique constraint + upsert would be the proper long-term fix.

## Test Results

```
 Test Files  15 passed (15)
      Tests  244 passed (244)
   Duration  4.86s
```

All 31 new tests pass. Full suite passes with zero regressions. Pre-existing `act(...)` warnings in StaffMultiSelect and CaseForm unchanged from Phase 1.

### Coverage by Level

| Level | Tests | What's Covered |
|-------|-------|----------------|
| Unit | 20 | `mergeInsert` (9): add new, dedup by ID, optimistic replace, simultaneous recording keep-earlier, null handling. `mergeUpdate` (5): update recorded_at, undo to null, skip unknown, skip identical, no side effects. `mergeDelete` (3): remove by ID, skip unknown, empty state. Hook setup (3): correct channel/filter, disabled guard, empty caseId guard. |
| Integration | 7 | INSERT → setCaseMilestones updater adds row. UPDATE → undo propagated. DELETE → row removed. INSERT replaces optimistic entry. Optimistic + remote confirmation → no duplicate. DELETE with missing ID → no-op. Re-subscribe on caseId change. |
| Workflow | 3 | Full multi-event sequence (record → record → undo → re-record). Simultaneous recording from two devices → resolves to earlier timestamp. Local optimistic → DB confirm → Realtime → no duplicate. |

## Notes for Phase 3 (Live Pace Tracking)

- Realtime updates now flow into `caseMilestones` state automatically. Any pace calculations derived from `caseMilestones` will update in real time without additional work.
- The merge functions are pure and exported — if pace tracking needs to react to specific Realtime events (e.g., flash a "milestone just recorded" indicator), the hook could be extended with an `onEvent` callback, but this isn't needed for pace display.
- `milestoneAverages` and `surgeonProcedureAverage` are fetched once during `fetchData()` and don't change during a live case. No Realtime subscription needed for averages.
