# Case Detail & Milestone Recording — Audit & Phased Plan

**Document created:** 2026-02-11
**Status:** PLAN PROPOSED — Awaiting approval before coding begins

---

## 1. Work Completed So Far

### 1.1 Feature Document Review
- Read [case-detail.md](./case-detail.md) in full (536 lines, 10 sections)
- Identified 35 interview questions across 8 categories
- Cataloged 15 edge cases, 8 downstream consumers, and the "fully baked" checklist

### 1.2 Codebase Audit

Audited all files listed in Section 3 of the feature doc:

| File | Lines | Status |
|------|-------|--------|
| `app/cases/[id]/page.tsx` | 1,291 | Audited — primary case detail page |
| `components/cases/CompletedCaseView.tsx` | 1,145 | Audited — completed case analytics dashboard |
| `components/cases/CaseFlagsSection.tsx` | 513 | Audited — flags & delays, self-fetching |
| `components/cases/CaseForm.tsx` | 1,496 | Audited — case creation, milestone pre-creation |
| `lib/dal/cases.ts` | 328 | Audited — **critical bugs found** (see below) |
| `lib/analyticsV2.ts` | 2,002 | Audited — analytics engine, reference only |
| `lib/flagEngine.ts` | 600 | Audited — flag evaluation engine |
| `lib/UserContext.tsx` | 207 | Audited — auth context, facility timezone |
| `components/cases/MilestoneCard.tsx` | 165 | Audited — milestone card UI component |
| `components/ui/MilestoneButton.tsx` | 205 | Audited — button components (single & paired) |
| `components/pip/PiPMilestoneWrapper.tsx` | 196 | Audited — PiP floating window wrapper |
| `components/pip/PiPMilestonePanel.tsx` | 508 | Audited — PiP milestone tracking panel |
| `types/pace.ts` | 131 | Audited — pace tracking type definitions |
| `lib/pace-utils.ts` | 239 | Audited — pace calculation utilities |
| `components/dashboard/PaceProgressBar.tsx` | 119 | Audited — pace visualization |
| Supabase migrations (6 files) | — | Audited — schema, triggers, RPCs |

**iOS app:** Confirmed to be in a separate repository. Web-only scope for this work.

### 1.3 Audit Findings

#### What's Working Correctly
| Item | Finding |
|------|---------|
| Functional updaters (stale closure fix) | Defensive closure escape pattern in place and correct |
| `recordMilestone` behavior | Correctly UPSERTs — updates existing rows, inserts if missing |
| `undoMilestone` behavior | Correctly sets `recorded_at = NULL`, does NOT delete the row |
| Paired milestone logic | Start/end relationships handled, elapsed timer between pairs |
| CaseFlagsSection integration | Properly integrated in both in-progress (delay flags only) and completed (all flags) views |
| Timezone storage | Timestamps stored as UTC (`timestamptz`) in database |
| Pace data loading | `surgeon_milestone_averages` and `surgeon_procedure_averages` loaded during case fetch |
| PiP panel | Actively used, functional floating window for milestone tracking |

#### Critical Issues Found

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **DAL uses dropped `milestone_type_id` column** | CRITICAL | `lib/dal/cases.ts` references `milestone_type_id` in interface, queries, and `recordMilestone()` upsert. This column was dropped from `case_milestones`. The case detail page bypasses the DAL and queries Supabase directly (correctly using `facility_milestone_id`), so the page works — but the DAL is broken. |
| 2 | **No Realtime subscription** | HIGH | No Supabase Realtime subscription on `case_milestones`. Changes from other devices do not propagate. Users must refresh to see updates. This is the **#1 user complaint**. |
| 3 | **Timezone display bug** | HIGH | Milestone timestamps sometimes display in UTC instead of facility local time. Users report "wrong times" on milestone display. |
| 4 | **No debounce on milestone recording** | MEDIUM | No protection against rapid double-tap. Each click fires `recordMilestone()` — risk of duplicate DB calls. |
| 5 | **No undo confirmation** | MEDIUM | Undoing a milestone happens immediately with no confirmation dialog. Accidental undo clears the timestamp. |
| 6 | **No out-of-order milestone warning** | MEDIUM | Milestones can be recorded in any order without warning. Recording Incision before Timeout is a patient safety concern. |
| 7 | **Pace tracking not surfaced in live cases** | MEDIUM | Surgeon averages are loaded into state but only displayed on the completed view. Not shown during in-progress cases. |
| 8 | **No generated Supabase types** | LOW | No `database.types.ts` file. Manual TypeScript interfaces risk schema drift. |

### 1.4 Developer Interview

Conducted 8 rounds of structured interview questions covering architecture, UX, edge cases, design, and priorities.

#### Key Decisions from Interview

| Topic | Decision |
|-------|----------|
| **Platform scope** | Web only. Flag iOS implications but don't modify iOS code. |
| **Device usage** | Both iOS and web. Roughly at parity. |
| **Realtime need** | Critical gap — must fix. #1 user pain point. |
| **Milestone feedback** | Card visual change + toast is sufficient for now. |
| **Out-of-order recording** | Soft warning — show dialog but allow override. |
| **Undo workflow** | Add confirmation dialog. Any authorized user can undo. |
| **Auto-advance after recording** | No — show full timeline. Users know what to tap. |
| **Live pace tracking** | Show prominently during in-progress cases. High coaching value. |
| **No pace data** | Show "Insufficient data (need 10+ cases)" message. |
| **Completed view** | Good as-is. Polish over new features. |
| **Delay reporting** | Timer OR manual entry option. Timer start/stop plus manual minutes. |
| **Delay type defaults** | Allow default duration per delay type. |
| **Team roster** | Staff can be added/removed during live cases. |
| **Flip room status** | Show card with current milestone + elapsed time for surgeon's other room. Show call-back status. |
| **Implant entry** | Staff enters on web; device rep enters on iOS-only restricted screen. |
| **Case sequence** | "Case 3 of 5 today" — not shown currently, would be valuable. |
| **Role visibility** | Everyone sees everything. No role-based restrictions. |
| **Completion flow** | Auto-completes on Patient Out. No manual validation step. |
| **Known timestamp bug** | Wrong display timezone (UTC instead of local). |
| **Double-tap** | Realistic risk. Disable button after tap (not just debounce). |
| **PiP panel** | Actively used and important. Must keep working. |
| **Design vision** | Linear/Notion aesthetic — modern SaaS dashboard. No dark mode for this version. |
| **Test framework** | Vitest. No existing tests for case detail page. |

#### Priority Ranking (from interview)
1. Realtime sync
2. Pace tracking in live cases
3. Data integrity fixes (DAL, debounce, undo, timezone)
4. Flip room status card

---

## 2. Proposed Phased Plan

Phases are ordered with data integrity first (foundational), then by user-stated priority. Each phase is a cohesive unit that can be tested independently.

### Phase 1: Data Integrity & Foundation Fixes
> *Fixes the plumbing everything else depends on.*

**Scope:**
- [ ] Fix or remove `lib/dal/cases.ts` — update to use `facility_milestone_id`, or confirm it's dead code and remove
- [ ] Timezone display fix — audit all timestamp display points on the case detail page; ensure facility timezone is used consistently
- [ ] Debounce milestone recording — disable button after tap, re-enable after DB response (prevents double-tap)
- [ ] Undo confirmation dialog — add confirmation modal before clearing `recorded_at`
- [ ] Verify Supabase types are consistent with schema

**Tests (Vitest):**
- Unit: `recordMilestone()` sets correct `recorded_at`, uses `facility_milestone_id`
- Unit: `undoMilestone()` sets `recorded_at` to NULL, not DELETE
- Unit: Debounce prevents duplicate calls within threshold
- Unit: Timezone formatting outputs facility local time
- Integration: Record milestone → undo → re-record produces correct final state
- Workflow: Full milestone recording flow with debounce and undo confirmation

**iOS implications:** None — web-only changes. DAL fix benefits any future shared code.

---

### Phase 2: Realtime Sync
> *Fixes the #1 user complaint.*

**Scope:**
- [ ] Add Supabase Realtime subscription on `case_milestones` filtered by `case_id`
- [ ] Handle incoming changes — update local state when another device records/undoes a milestone
- [ ] Cleanup on unmount — unsubscribe from channel when component unmounts
- [ ] PiP sync — ensure PiP panel receives realtime updates (inherits from parent or own subscription)
- [ ] Optimistic updates — local device sees immediate change; remote changes merge without conflicts
- [ ] Handle edge case: two devices record the same milestone simultaneously

**Tests (Vitest):**
- Unit: Subscription setup creates channel with correct filter
- Unit: Cleanup function removes channel
- Integration: Simulated remote change updates local state correctly
- Integration: Optimistic update + remote confirmation doesn't duplicate
- Workflow: Device A records milestone → Device B sees update without refresh

**iOS implications:** iOS app should add equivalent Supabase Realtime subscription. Flag for iOS team.

---

### Phase 3: Live Pace Tracking
> *Surfaces coaching data during active cases.*

**Scope:**
- [ ] Display pace per milestone — after recording, show "X min (avg: Y min) — Z min ahead/behind"
- [ ] Overall case pace indicator — running comparison of total elapsed vs surgeon's typical total time
- [ ] Insufficient data state — show "Need 10+ cases for pace tracking" when baseline missing
- [ ] Paired milestone duration — show pace for paired durations (e.g., anesthesia duration vs average)
- [ ] Case sequence context — show "Case 3 of 5 today" from surgeon's scheduled cases for the day
- [ ] Visual design consistent with Linear/Notion aesthetic

**Tests (Vitest):**
- Unit: Pace calculation with known inputs produces correct ahead/behind values
- Unit: Insufficient data detection (< 10 cases)
- Unit: Paired duration calculation (end - start vs average)
- Unit: Case sequence counting from day's schedule
- Integration: Record milestone → pace display updates with correct comparison
- Workflow: Full case with pace tracking from Patient In through Patient Out

**iOS implications:** iOS should surface the same pace data. Types and calculation logic could be shared.

---

### Phase 4: Out-of-Order Milestone Warning
> *Patient safety enhancement.*

**Scope:**
- [ ] Detect out-of-order recording — compare `display_order` of milestone being recorded vs already-recorded milestones
- [ ] Soft warning dialog — "You're recording [Incision] before [Timeout]. Continue anyway?"
- [ ] Allow override — user dismisses warning and proceeds
- [ ] Special Timeout → Incision handling — strongest warning for this specific safety case
- [ ] Log out-of-order recordings for analytics (optional flag on the milestone)

**Tests (Vitest):**
- Unit: Order detection correctly identifies out-of-order scenarios
- Unit: In-order recording produces no warning
- Unit: Timeout → Incision triggers strongest warning variant
- Integration: Warning dialog → override → milestone records correctly
- Workflow: Record milestones out of order → warning → override → completed case shows correct data

**iOS implications:** iOS should implement equivalent warnings. Order detection logic could be shared.

---

### Phase 5: Flip Room Status Card
> *Unique, powerful cross-room awareness.*

**Scope:**
- [ ] Query surgeon's other active cases — find in-progress cases for same surgeon in different rooms
- [ ] Display status card in sidebar — room name, current milestone, elapsed time
- [ ] Show call-back status — whether next patient has been called for the flip room
- [ ] Live updates — use Realtime (from Phase 2) to keep flip room card current
- [ ] Handle edge cases: surgeon has 0 other rooms, surgeon has 2+ other rooms
- [ ] Empty state when surgeon has no other active cases

**Tests (Vitest):**
- Unit: Query correctly finds other active cases for the same surgeon
- Unit: Handles 0, 1, and 2+ other rooms gracefully
- Integration: Flip room milestone recorded → card updates via Realtime
- Integration: Call-back status change reflects on card
- Workflow: Surgeon with flip room → view case in Room 1 → see Room 2 status → Room 2 records milestone → card updates

**iOS implications:** iOS should show equivalent flip room card. Requires same cross-room query.

---

### Phase 6: Delay Timer Enhancement
> *Improved delay reporting workflow.*

**Scope:**
- [ ] Add timer option to delay report form — "Start Timer" button alongside manual minutes entry
- [ ] Timer state management — start/stop with live elapsed display
- [ ] Default duration per delay type — pre-fill common durations when delay type is selected
- [ ] Persist timer across interactions — timer survives if user interacts with other parts of the page
- [ ] Save delay with timer-calculated or manually-entered duration
- [ ] Visual timer display consistent with milestone elapsed timers

**Tests (Vitest):**
- Unit: Timer start/stop calculates correct duration
- Unit: Default duration populates from delay type config
- Unit: Manual entry overrides timer value
- Integration: Start timer → stop → save delay → case_flags row has correct duration
- Workflow: Report delay via timer during live case → delay appears in flags section → visible in completed view

**iOS implications:** iOS delay reporting should support same timer/manual options.

---

## 3. Rules of Engagement (from feature doc)

- Execute one phase at a time
- Write tests at 3 levels per phase: unit, integration, workflow
- Present test results in specified format after each phase
- Do not proceed to next phase until current phase is confirmed
- Web-only code changes; flag iOS implications
- Test framework: Vitest
- No dark mode for this version
- Design target: Linear/Notion aesthetic

---

## 4. Phase Status Tracker

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| Phase 1 | Data Integrity & Foundation Fixes | NOT STARTED | Awaiting plan approval |
| Phase 2 | Realtime Sync | NOT STARTED | |
| Phase 3 | Live Pace Tracking | NOT STARTED | |
| Phase 4 | Out-of-Order Milestone Warning | NOT STARTED | |
| Phase 5 | Flip Room Status Card | NOT STARTED | |
| Phase 6 | Delay Timer Enhancement | NOT STARTED | |
