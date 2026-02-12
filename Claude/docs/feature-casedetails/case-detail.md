# Feature Audit Brief #002: Case Detail & Milestone Recording

## Purpose

This document provides a complete audit of the Case Detail page in ORbit — a surgical analytics platform for ambulatory surgery centers. It is designed to be handed to Claude Code so it can review the actual codebase, conduct a developer interview, and implement improvements across UI, data accessibility, and workflow.

**Claude Code: Read this entire document before reviewing any files. Then review the files listed in Section 3. Then conduct the interview in Section 8. Do not write any code until the interview is complete.**

---

## 1. What This Feature Does

The Case Detail page is the **most-used page in the entire platform**. It's where OR staff (nurses, techs, coordinators) actively record surgical milestones in real time during live cases, and where surgeons and admins review completed cases afterward. Every analytics metric, scorecard calculation, and financial report downstream depends on milestone data captured here being accurate and complete.

### The Page Has Two Modes

**In-Progress Mode** — A live surgical case is being tracked:
1. Staff open the case from the cases list or rooms view
2. A milestone timeline shows all expected milestones for this procedure (pre-created at case creation with `recorded_at = NULL`)
3. Staff tap/click milestones as they happen — this sets `recorded_at` to the current timestamp
4. Paired milestones (e.g., Anesthesia Start → Anesthesia End) show start/end together
5. A sidebar shows team roster, surgeon status, implants, notes, and flags/delays
6. Pace tracking compares elapsed time against surgeon's historical averages
7. When `Patient Out of Room` is recorded, the case transitions to completed

**Completed Mode** — A finished case is reviewed:
1. Delegates to `<CompletedCaseView>` component
2. Shows case info header (surgeon, procedure, room, total time)
3. Shows milestone timeline with all recorded times and duration badges
4. Shows staff, implants, notes, and flags sections
5. Shows pace comparison (actual vs surgeon average per milestone)
6. Threshold flags (auto-detected at completion) and delay flags (user-reported) displayed

### The Typical Milestone Flow

A standard surgical case records milestones in this order:

| Order | Milestone | Type | Notes |
|-------|-----------|------|-------|
| 1 | Patient In Room | Single | Case start — triggers status → in_progress |
| 2 | Anesthesia Start | Paired (start) | |
| 3 | Anesthesia End | Paired (end) | |
| 4 | Prep & Drape Start | Paired (start) | |
| 5 | Prep & Drape End | Paired (end) | |
| 6 | Timeout | Single | Safety checkpoint — should occur before incision |
| 7 | Incision | Single | Marks surgical start |
| 8 | Closing Start | Paired (start) | |
| 9 | Closing End | Paired (end) | |
| 10 | Patient Out of Room | Single | Case end — triggers completion logic |

Milestones are **configurable per facility and procedure** via `procedure_milestone_config`. Not all procedures use all milestones.

---

## 2. Database Tables Involved

### 2.1 Primary Table: `cases`

The central table. Every case is one row.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| case_number | text | Human-readable (e.g., "RW-00349") |
| facility_id | uuid (FK → facilities) | Scoped to a facility |
| surgeon_id | uuid (FK → users) | Primary surgeon |
| procedure_type_id | uuid (FK → procedure_types) | What procedure |
| or_room_id | uuid (FK → or_rooms) | Which OR room |
| status_id | uuid (FK → case_statuses) | scheduled → in_progress → completed |
| scheduled_date | date | Date of the case |
| start_time | time | Scheduled start time |
| patient_name | text | Patient identifier |
| data_validated | boolean | False until reviewed; true triggers stats pipeline |
| is_excluded_from_metrics | boolean | Flagged cases excluded from analytics |
| is_draft | boolean | Draft cases (not yet finalized) |
| created_by | uuid (FK → users) | Who created the case |
| created_at | timestamptz | When the case was created |
| updated_at | timestamptz | Auto-updated via trigger |

**Triggers on `cases` table:** 8 total (most of any table). These fire on INSERT and UPDATE. Notable: `trigger_update_patient_status_from_milestone` may auto-transition status.

### 2.2 `case_milestones` — The Core of This Page

Pre-created when a case is created (via RPC `create_case_with_milestones`). Each row represents one expected milestone with `recorded_at = NULL` until staff records it.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| case_id | uuid (FK → cases) | Which case |
| facility_milestone_id | uuid (FK → facility_milestones) | **Primary key for all operations** |
| recorded_at | timestamptz | NULL = not yet recorded. Set = recorded |
| recorded_by | uuid (FK → users) | NULL until recorded |
| created_at | timestamptz | Row creation time |
| updated_at | timestamptz | Auto-updated via trigger |

**Critical context:** The system previously had a dual-ID pattern with both `facility_milestone_id` and `milestone_type_id`. As of the v2.0 milestone cleanup, `milestone_type_id` has been DROPPED. All queries must use `facility_milestone_id` exclusively. When global type info is needed for analytics, JOIN through `facility_milestones.source_milestone_type_id`.

**Unique constraint:** `(case_id, facility_milestone_id)` — one milestone per type per case.

**Realtime:** This table has a Supabase Realtime subscription. Changes propagate live across all devices viewing the same case.

**Claude Code should verify:**
- Does the page use functional updaters (`setCaseMilestones(prev => ...)`) for all state updates? Stale closures caused bugs previously.
- Does the `recordMilestone` function UPDATE existing rows (set `recorded_at`) or INSERT new ones? It should UPDATE.
- Does `undoMilestone` set `recorded_at` back to NULL or DELETE the row? It should set to NULL.
- Is the Realtime subscription properly cleaned up on unmount?

### 2.3 `facility_milestones` — Milestone Definitions

Defines what milestones exist at a facility.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Referenced by case_milestones.facility_milestone_id |
| facility_id | uuid (FK → facilities) | Which facility |
| name | text | Internal name (e.g., "anes_start") |
| display_name | text | Human-readable (e.g., "Anesthesia Start") |
| display_order | integer | Sort order for UI |
| pair_with_id | uuid (FK → facility_milestones) | For paired milestones: points to partner |
| pair_position | text | 'start' or 'end' (NULL for single milestones) |
| source_milestone_type_id | uuid | Bridge to global milestone_types for analytics |
| is_active | boolean | Can be disabled without deleting |

### 2.4 `procedure_milestone_config` — Which Milestones for Which Procedure

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| facility_id | uuid (FK → facilities) | |
| procedure_type_id | uuid (FK → procedure_types) | |
| facility_milestone_id | uuid (FK → facility_milestones) | |
| display_order | integer | Order for this procedure's milestones |
| is_enabled | boolean | Can disable milestones per procedure |

**Unique constraint:** `(facility_id, procedure_type_id, facility_milestone_id)`

### 2.5 `surgeon_milestone_averages` — Pace Tracking Data

Pre-computed averages for each surgeon's milestone durations, used for pace comparison during live cases.

| Column | Type | Notes |
|--------|------|-------|
| surgeon_id | uuid (FK → users) | |
| milestone_type_id | uuid | References global milestone_types via source_milestone_type_id |
| avg_minutes | numeric | Average time from case start to this milestone |
| procedure_type_id | uuid | Per-procedure averages |

**Claude Code should verify:** Is this data being surfaced during in-progress cases? Showing "you're X minutes ahead/behind pace" at each milestone is high-value.

### 2.6 `case_flags` — Flags & Delays (New System)

Unified flags system replacing the old delays-only approach.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| case_id | uuid (FK → cases) | |
| flag_type | text | 'threshold' (auto-detected) or 'delay' (user-reported) |
| severity | text | 'critical', 'warning', 'info' |
| rule_id | uuid (FK → flag_rules) | For threshold flags |
| metric_value | numeric | Actual measured value |
| threshold_value | numeric | What the threshold was |
| delay_type_id | uuid (FK → delay_types) | For delay flags |
| duration_minutes | integer | For delay flags |
| note | text | User notes |
| created_by | uuid (FK → users) | |
| created_at | timestamptz | |

**Currently being integrated:** The `<CaseFlagsSection>` component replaces the old amber delays box. Delay flags display during in-progress cases; threshold flags appear after completion.

### 2.7 `case_staff` — Team Roster

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| case_id | uuid (FK → cases) | |
| user_id | uuid (FK → users) | |
| role_id | uuid (FK → roles) | Their role on this case |

**Unique constraint:** `(case_id, user_id)`

### 2.8 `case_implants` / `case_implant_companies` / `case_device_companies`

Implant and device tracking tables displayed in the sidebar.

### 2.9 `case_notes` — Freeform Notes

Notes attached to the case, displayed in sidebar.

### 2.10 `case_statuses` — Lookup Table

| Status | Description |
|--------|-------------|
| scheduled | Default for new cases |
| in_progress | First milestone recorded |
| completed | Patient Out recorded |
| cancelled | Case was cancelled |
| on_hold | Temporarily paused |

### 2.11 Tables Written To DOWNSTREAM (Not on This Page)

These tables are populated after the case progresses — but their schema requirements mean this page must record data correctly:

| Table | When Populated | Depends On |
|-------|---------------|------------|
| `case_completion_stats` | When `data_validated` = true (trigger) | Correct milestones, surgeon, room, procedure |
| `case_milestone_stats` | Materialized view refresh | Milestone timestamps |
| `surgeon_milestone_averages` | Recalculated via RPC | Milestone timestamps + facility_milestone_id |
| `surgeon_procedure_averages` | Recalculated via RPC | Complete case data |

---

## 3. Files to Review

Claude Code should examine these files in the codebase.

### Web App (Next.js)

| File | What It Does | Priority |
|------|-------------|----------|
| `app/cases/[id]/page.tsx` | **PRIMARY FILE** — case detail page. Handles both in-progress and completed modes. ~1300+ lines. | 🔴 Critical |
| `components/cases/CompletedCaseView.tsx` | Completed case summary component. Receives milestones, staff, flags as props. | 🔴 Critical |
| `components/cases/CaseFlagsSection.tsx` | Self-fetching flags & delays display. Used in both in-progress sidebar and completed view. Recently built. | 🟡 Important |
| `components/cases/CaseForm.tsx` | Case creation form — creates the milestones this page displays. Context for understanding pre-creation. | 🟡 Important |
| `app/cases/page.tsx` | Case list page — shows how cases are listed and navigated to. | 🟢 Reference |
| `lib/analyticsV2.ts` | Analytics calculation engine — may be used for completed case metrics. | 🟢 Reference |
| `lib/flagEngine.ts` | Flag evaluation engine — runs at case completion to detect threshold flags. | 🟢 Reference |
| `lib/UserContext.tsx` | Auth context — provides `userId`, `userFacilityId`, role info. | 🟢 Reference |

### iOS App (SwiftUI)

| File | What It Does | Priority |
|------|-------------|----------|
| `CaseDetailView.swift` | **iOS equivalent** of the case detail page. Milestone recording, team display, case info. | 🔴 Critical |
| `MilestoneCarouselView.swift` | Milestone recording carousel component used within CaseDetailView. | 🔴 Critical |
| `CaseDetailModels.swift` | Data models: `MilestoneGroup`, `CaseMilestone`, `FacilityMilestone`, etc. | 🟡 Important |
| `Milestone.swift` | Base milestone model definitions. | 🟡 Important |
| `RoomsView.swift` | Rooms view — shows active cases per room with milestone progress. Related context. | 🟢 Reference |
| `RoomComponents.swift` | Shared room/milestone display components. | 🟢 Reference |

### Shared / Data Layer

| File | What It Does | Priority |
|------|-------------|----------|
| `lib/dal/cases.ts` | Data access layer for cases — interfaces and query helpers. | 🟡 Important |
| `lib/validation/schemas.ts` | Zod validation schemas. | 🟢 Reference |
| Any Supabase types file | Auto-generated table types. | 🟢 Reference |

**Claude Code: Use `find` or `grep` to locate exact paths if the above are approximate. Search for filenames, component names, or key function names like `recordMilestone`, `undoMilestone`, `CompletedCaseView`.**

---

## 4. Known Issues & Gaps

### 4.1 Stale Closure Bug (Previously Fixed — Verify Still Fixed)
`recordMilestone` and `undoMilestone` previously read `caseMilestones` from closure scope instead of using functional updaters. This caused paired milestones to fail on certain procedure types (Mako THA specifically). Fixed by using `setCaseMilestones(prev => ...)` pattern. Claude Code should verify this fix is still in place and applied consistently.

### 4.2 Timezone Handling
All timestamps stored as UTC, displayed in facility local time. Previous bugs found in other pages (block utilization) where `toISOString().split('T')[0]` produced wrong dates due to UTC conversion. Claude Code should verify the case detail page handles timezone display correctly for milestone timestamps.

### 4.3 Flags Integration Partially Complete
The `<CaseFlagsSection>` component was recently built to replace the old amber delays box. Integration into the case detail page may or may not be complete. Claude Code should verify:
- Is the old `delays` state and fetch still present or fully removed?
- Is `<CaseFlagsSection>` wired into both in-progress sidebar and completed view?
- Does the flag evaluation engine (`evaluateCaseFlags`) fire when Patient Out is recorded?

### 4.4 Pace Tracking May Not Be Fully Surfaced
`surgeon_milestone_averages` data exists for pace comparison. The page may query it but not display it prominently during in-progress cases. "You're X minutes ahead/behind pace" at each milestone is extremely high-value for OR staff.

### 4.5 Completed View May Recalculate Client-Side
`case_milestone_stats` materialized view has pre-computed durations. The completed view may be recalculating these client-side instead of using the pre-computed values. This is redundant and could cause inconsistencies.

### 4.6 No Out-of-Order Milestone Warning
Milestones can be recorded in any order. Recording Incision before Timeout is a real patient safety concern. There's no warning when milestones are recorded out of sequence.

### 4.7 No Undo Confirmation
Undoing a milestone (clearing `recorded_at`) happens immediately. There's no confirmation dialog. In a live surgical setting, accidental undo of a correctly recorded milestone could affect data integrity.

### 4.8 Page Size (~1300+ Lines)
The main `page.tsx` is large. The in-progress and completed views could potentially be separated into distinct components for maintainability.

### 4.9 iOS-Web Parity
Both platforms recently aligned on the `facility_milestones` system (was previously using different milestone architectures). Claude Code should verify both platforms display the same milestones in the same order and that recording on one platform reflects on the other via Realtime.

---

## 5. What "Fully Baked" Looks Like

A production-ready case detail page should have:

### Data Integrity
- [ ] All milestone updates use functional updaters (no stale closures)
- [ ] Record = UPDATE existing row (set `recorded_at`), not INSERT
- [ ] Undo = set `recorded_at` back to NULL, not DELETE
- [ ] Realtime subscription keeps all devices in sync
- [ ] Timestamps stored as UTC, displayed in facility local time correctly
- [ ] Patient Out triggers completion logic (status transition, flag evaluation)

### Milestone UX
- [ ] Visual progress indicator showing where you are in the case flow
- [ ] Paired milestones clearly show start/end relationship
- [ ] When start is recorded, end becomes visually prominent / next action
- [ ] Elapsed time since last milestone visible (pace context)
- [ ] Pace comparison (actual vs surgeon average) displayed per milestone
- [ ] Out-of-order recording warning (especially Incision before Timeout)
- [ ] Undo confirmation dialog before clearing a recorded milestone
- [ ] Auto-scroll/focus to next unrecorded milestone after recording

### Completed Case Review
- [ ] Case summary feels like a performance report, not a data dump
- [ ] Duration badges on each milestone (actual time between milestones)
- [ ] Sparkline or visual comparison: actual vs average per milestone
- [ ] Total case time, surgical time, anesthesia time prominently displayed
- [ ] Flags section shows both threshold (auto) and delay (manual) flags with context
- [ ] Uses pre-computed `case_milestone_stats` where possible (not client-side recalculation)
- [ ] Procedure name, CPT code, reimbursement info visible for admin users
- [ ] Case sequence context (1st, 3rd, 5th case of the day for this surgeon)

### Sidebar (In-Progress)
- [ ] Team roster with role labels
- [ ] Surgeon status (e.g., "In Room 2" for flip room awareness)
- [ ] Implants and device companies with edit capability
- [ ] Notes section with add/edit
- [ ] Flags & Delays section with "Report Delay" button
- [ ] Room name/number prominent for multi-room awareness

### Data Accessibility
- [ ] All data queried is actually displayed somewhere (no phantom fetches)
- [ ] Role-based visibility: nurses see operational data, admins see analytics/financial data
- [ ] Historical comparison available ("This surgeon's average Mako THA: X:XX")
- [ ] Flip room context: if surgeon has concurrent case in another room, show status
- [ ] Block position: what case number is this in today's schedule?

### Security & Access
- [ ] RLS policies restrict milestone recording to appropriate roles
- [ ] Milestone recording logs `recorded_by` correctly
- [ ] Case detail only accessible within user's facility
- [ ] Audit trail for all milestone changes

### iOS-Web Parity
- [ ] Same milestones displayed in same order on both platforms
- [ ] Same data visible on both platforms
- [ ] Recording on iOS reflects on web immediately (and vice versa)
- [ ] iOS uses native patterns (haptics, SF Symbols, swipe actions)
- [ ] Web uses appropriate web patterns (keyboard shortcuts, hover states)

### UI Quality
- [ ] Feels like a $50K/year enterprise surgical platform, not a side project
- [ ] Consistent color language (urgency/pace without being alarming in OR)
- [ ] Dark mode considerations (ORs are often dim)
- [ ] Subtle animations on milestone recording (confirmation feedback)
- [ ] iOS 18+ native feel (system materials, modern tab bar, SF Symbols)

---

## 6. Edge Cases to Test

Claude Code should verify how the system handles each of these:

1. **Recording milestones out of order** — Incision before Timeout, Closing before Prep complete
2. **Undoing a milestone and re-recording** — Does the new timestamp correctly overwrite?
3. **Multiple devices recording the same case simultaneously** — Does Realtime prevent double-recording the same milestone?
4. **Case cancelled mid-way** — What happens to partially recorded milestones? Can they be reviewed?
5. **Patient leaves and returns** — How do you handle re-recording Patient In Room?
6. **Staff changeover mid-case** — Can the team roster be updated during a live case?
7. **Milestone recorded on wrong case** — Undo/correction workflow
8. **A procedure with very few milestones** (e.g., just Patient In, Incision, Patient Out) — Does the UI adapt?
9. **A procedure with custom milestones** (no `source_milestone_type_id`) — Does pace tracking handle missing averages?
10. **Viewing a completed case months later** — Does all data still load correctly? Any missing JOINs?
11. **Recording the final milestone (Patient Out)** — Does completion trigger fire? Flags evaluate? Status update?
12. **Fast double-tap on a milestone button** — Does it record twice or debounce?
13. **Network interruption during milestone recording** — Does the optimistic update roll back? Error handling?
14. **Viewing the page as different roles** — Surgeon, nurse, facility admin, global admin — what should each see?
15. **Case with no staff assignments** — Does the sidebar handle empty state gracefully?

---

## 7. Downstream Consumers of This Page's Data

The case detail page's milestone recordings feed into these downstream systems. If milestones are recorded incorrectly, these break:

| Consumer | What It Needs | Failure Mode |
|----------|--------------|--------------|
| `case_completion_stats` trigger | All milestones with correct timestamps | Incomplete stats, wrong durations |
| `case_milestone_stats` matview | `recorded_at` values on case_milestones | Missing milestone data in analytics |
| `surgeon_milestone_averages` RPC | Accurate milestone timestamps | Skewed pace tracking for future cases |
| `surgeon_procedure_averages` RPC | Complete case data | Wrong scorecard calculations |
| Analytics Overview page | Turnover times (Patient Out → next Patient In) | Incorrect utilization metrics |
| Block Utilization page | Patient In / Patient Out times | Wrong block utilization percentages |
| ORbit Score (Scorecard) | All of the above | Wrong surgeon scores |
| Flag Engine | Milestone durations vs thresholds | Missed or false flags |

---

## 8. Claude Code Interview Questions

**Claude Code: After reviewing the codebase against this brief, interview the developer using these questions. Adapt based on what you find — skip questions you can answer from the code, add new ones based on issues you discover. Use the ask_user_input tool for bounded questions. Ask open-ended questions in prose.**

### Architecture & Data Flow
1. Walk me through exactly what happens when a staff member taps a milestone. What function fires? What DB call is made? How does the UI update?
2. Is the Realtime subscription on `case_milestones` filtering by `case_id` or receiving all changes?
3. When Patient Out is recorded, what completion logic fires? Is it a trigger, app code, or both?
4. Is `case_milestone_stats` (materialized view) used on the completed view, or does the page recalculate durations client-side?

### Milestone Recording UX
5. When Anesthesia Start is recorded, how does the UI indicate that Anesthesia End is the next expected action?
6. Is there any sequential enforcement or warning? Can a user record Incision before Timeout?
7. What happens if you undo the first milestone (Patient In) after several milestones are already recorded?
8. Is there a debounce on milestone recording to prevent double-taps?
9. After recording a milestone, does the view auto-scroll or move focus to the next unrecorded milestone?

### Pace Tracking
10. How is `surgeon_milestone_averages` surfaced during in-progress cases? Is there a visual indicator showing ahead/behind pace?
11. If a surgeon has no historical data for a procedure (first time doing it), what does the pace tracker show?
12. Does the pace tracker account for paired milestone durations (e.g., Anesthesia duration = end - start)?

### Completed View
13. What data does the completed view show that the in-progress view doesn't?
14. Can admins add post-hoc notes or flags after the case is complete?
15. Is there a way to annotate or dispute a flag? ("This delay was equipment failure, not surgeon")
16. Is there an export or share function (PDF, link)?
17. Does the completed view show the case's position in the day's schedule (1st case, 3rd case)?

### Sidebar Data
18. How is the team roster populated? Is it from `case_staff` or somewhere else?
19. Can staff be added/removed from the roster during a live case?
20. For flip room surgeons — is there any indication of what's happening in the other room?
21. How are implants entered? Free text, dropdown, or linked to a catalog?

### Role-Based Differences
22. What should a circulating nurse see vs a surgeon vs a facility admin reviewing a completed case?
23. Are there any fields or sections that should only be visible to certain roles?
24. Who should be able to undo a milestone? Anyone, or only the person who recorded it?

### iOS-Specific
25. Does the iOS `CaseDetailView` display the same sections as the web page?
26. Is there haptic feedback when recording milestones on iOS?
27. Does iPad use a different layout (NavigationSplitView)?
28. Are there any features on web that are missing on iOS (or vice versa)?

### UI & Design Vision
29. What's the visual feeling you want for this page? Clinical/sterile? Warm/modern? Dashboard-like?
30. Are there any existing surgical software UIs (Epic, Cerner, TrayROI) you admire or want to differentiate from?
31. How important is dark mode? Is the app used in dimly lit ORs?
32. What's the most common complaint from actual users about this page?

### Testing & Quality
33. Are there any existing tests for the case detail page?
34. What test data setup is needed? A case with pre-created milestones, a surgeon with averages, staff assignments?
35. Have you experienced any data corruption from this page (wrong timestamps, missing milestones, orphaned records)?

---

## 9. Rules of Engagement

### Phase Structure

This project will be done in phases. Before writing any code:

1. **Read this document fully**
2. **Read all files listed in Section 3**
3. **Conduct the interview in Section 8** — do not skip this
4. **Audit the data flow** — what's queried, what's displayed, what's missing
5. **Propose a phased plan** — break the work into discrete phases, ordered by impact. Each phase should be a cohesive unit that can be tested independently. Present the plan and **wait for approval** before starting.
6. **Execute one phase at a time** — implement, test, confirm with me, then move to the next.

---

### Mandatory Testing After Every Phase

**This rule applies to every phase you create and execute, no exceptions. Do not consider a phase complete until all three test levels are written and passing.**

After completing the code for each phase, write tests at these three levels:

#### Level 1: Unit Tests
Does the new code work in isolation? Test individual functions, components, and helpers.
- Example: "Does `recordMilestone()` correctly set `recorded_at` on the right `case_milestone` row?"
- Example: "Does the pace tracker correctly calculate minutes ahead/behind?"

#### Level 2: Integration Tests
Does the new code work with the components that **consume its output** or **feed into it**? Always test the downstream path — if you build creation, test what reads/uses the created data.
- Example: "Record all milestones → does `CompletedCaseView` render the correct durations and pace comparisons?"
- Example: "Record Patient Out → does the flag engine evaluate and insert threshold flags?"
- Example: "Record a milestone on web → does the Realtime subscription update the iOS view?"
- **Key question to always ask: "What does the user do NEXT with this output?" — test that path.**

#### Level 3: Workflow / Scenario Tests
Write at least one end-to-end scenario test per phase that walks through the **real user journey** this feature lives inside. Start from the user action that **precedes** this feature and end at the user action that **follows** it.
- Example: "Staff opens in-progress case → records Patient In Room → sees pace tracker update → records Anesthesia Start → paired End card becomes prominent → records out of order → warning appears → completes all milestones → Patient Out triggers flag evaluation → completed view renders with flags, durations, and averages."
- Example: "Admin opens completed case → sees flag for long turnover → adds annotation explaining equipment delay → annotation persists on reload → flag no longer counts against surgeon in analytics."

#### What to Watch For
- **Downstream consumers**: If you build or modify data creation, always test what READS that data. Test the consumption path, not just the creation path.
- **State transitions**: Test what happens when data moves between states (in-progress → completed, unrecorded → recorded, NULL → timestamp → NULL again).
- **Cross-platform implications**: If a change affects the data layer, note whether the other platform (iOS or web) would be affected and flag it.
- **Realtime sync**: If the feature involves `recorded_at` or milestone changes, verify the Realtime subscription picks up the change.
- **Role-based visibility**: If the feature surfaces new data, test that the right roles can see it and the wrong roles can't.
- **Stale closures**: Any new state-dependent functions must use functional updaters.

#### Test Output Format
After each phase, present:
```
## Phase [N] Test Results

### Unit Tests: [X passed / Y total]
- ✅ test description
- ✅ test description

### Integration Tests: [X passed / Y total]
- ✅ test description (tests downstream: [what consumes this])
- ✅ test description

### Workflow Tests: [X passed / Y total]
- ✅ scenario description (covers: [user action before] → [this feature] → [user action after])

### Cross-Platform Notes:
- [any iOS/web implications flagged]
```

**Do not proceed to the next phase until I confirm the test results are acceptable.**

---

## 10. Related Features (Out of Scope for This Brief)

These features interact with the case detail page but have their own audit briefs or development tracks:

- **Case Creation** (Feature Audit #001 — how milestones get pre-created)
- **Case Editing** (modifying surgeon, procedure, room after creation)
- **Case Cancellation** (status change + analytics impact)
- **Data Validation** (the workflow that triggers `record_case_stats()`)
- **Block Scheduling** (how blocks relate to surgeon room assignments)
- **Analytics Engine** (how `analyticsV2.ts` consumes case data)
- **ORbit Score / Scorecards** (how milestone data feeds surgeon scoring)
- **Flag Configuration** (admin settings for flag thresholds — separate from displaying flags)
