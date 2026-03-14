# Implementation Plan: Consolidate Time-Off Types + Relocate PTO to Profile

## Branch: `feature/consolidate-pto-profile`

## Summary
Remove the redundant "Personal" time-off type (merging into PTO), leaving just **PTO** and **Sick**. Move the time-off request UI from the iOS StaffHomeView to the iOS ProfileView, giving users full CRUD (submit, view, cancel) from their profile. Keep a small nudge on the Home page for upcoming approved time off. Clean up all admin-facing web components to reflect the two-type system.

## Interview Notes
- **Scope:** iOS-only for the profile relocation. Web stays admin-only on Staff Management.
- **Home nudge:** Keep a small banner/chip on iOS Home showing next upcoming approved time off.
- **Profile actions:** Full CRUD in Profile — submit new requests, view history, cancel pending.
- **Admin cleanup:** Remove 'personal' from all web admin views (review modal, calendar badges, user totals).
- **Migration strategy:** Auto-migrate existing 'personal' rows to 'pto', then drop the option.
- **Zero 'personal' rows exist in production** — migration is safe.

## Phase Overview

| Phase | Platform | Description | Complexity |
|-------|----------|-------------|------------|
| 1 | Database | Remove 'personal' type — migrate data, update constraint + triggers | Small |
| 2 | Web | Remove 'personal' from types, labels, admin UI, and tests | Medium |
| 3 | iOS | Remove 'personal' from models, form, card, and tests | Small |
| 4 | iOS | Add "My Time Off" section to ProfileView (full CRUD) | Large |
| 5 | iOS | Slim down StaffHomeView + add upcoming PTO nudge | Medium |
| 6 | Both | Update feature spec, verify no orphaned references, final testing | Small |

---

## Phase 1: Database — Remove 'personal' type
**Platform:** Database (migration)
**Complexity:** Small
**Dependencies:** None

**What it does:**
- UPDATE any `request_type = 'personal'` rows to `'pto'` (currently 0 rows, but safe)
- DROP and recreate the CHECK constraint on `time_off_requests.request_type` to only allow `('pto', 'sick')`
- Update notification trigger functions that map 'personal' → 'Personal Day' to remove that branch

**Files touched:**
- `supabase/migrations/YYYYMMDD_consolidate_time_off_types.sql` (new)

**Commit:** `feat(time-off): phase 1 - consolidate personal into pto, update db constraint`

**Test gate:**
1. **Unit:** Verify constraint rejects 'personal', accepts 'pto' and 'sick' via SQL INSERT
2. **Integration:** Insert a new request with type 'pto' — succeeds; 'personal' — fails with constraint error
3. **Workflow:** Existing approved 'pto' requests still queryable after migration

---

## Phase 2: Web — Remove 'personal' from types, labels, and admin UI
**Platform:** Web
**Complexity:** Medium
**Dependencies:** Phase 1

**What it does:**
- Remove `'personal'` from `TimeOffRequestType` union type
- Remove `personal` from `REQUEST_TYPE_LABELS` and all badge variant maps
- Remove `personal_days` from `UserTimeOffSummary` interface (merge into `pto_days`)
- Update `fetchUserTimeOffTotals` DAL aggregation — remove 'personal' branch (any old 'personal' rows are now 'pto')
- Update all admin components: TimeOffReviewModal, DrawerTimeOffTab, CalendarDayCell, UserTimeOffSummary, StaffDirectoryTab
- Update web tests for types and DAL

**Files touched:**
- `types/time-off.ts` — remove 'personal' from union type, labels map, and `UserTimeOffSummary` interface
- `lib/dal/time-off.ts` — remove 'personal' branch in `fetchUserTimeOffTotals` aggregation
- `components/staff-management/TimeOffReviewModal.tsx` — remove personal from `REQUEST_TYPE_BADGE_VARIANTS`
- `components/staff-management/DrawerTimeOffTab.tsx` — remove personal from `REQUEST_TYPE_BADGE_VARIANTS`
- `components/staff-management/UserTimeOffSummary.tsx` — remove `personal_days` display, update inline/detail variants
- `components/staff-management/CalendarDayCell.tsx` — no change needed (uses labels map dynamically)
- `types/__tests__/time-off.test.ts` — update type/label tests
- `lib/dal/__tests__/time-off.test.ts` — update aggregation tests

**Commit:** `feat(time-off): phase 2 - remove personal type from web types and admin UI`

**Test gate:**
1. **Unit:** TypeScript compiles, label map has 2 entries (pto/sick), summary only has `pto_days` + `sick_days`
2. **Integration:** Admin review modal renders correctly with only PTO/Sick badges; UserTimeOffSummary shows 2 categories
3. **Workflow:** Staff directory → click user → drawer time-off tab → totals show PTO and Sick only

---

## Phase 3: iOS — Remove 'personal' from models and form
**Platform:** iOS
**Complexity:** Small
**Dependencies:** Phase 1

**What it does:**
- Remove `.personal` case from `TimeOffRequestType` enum
- Remove personal displayName and color mapping from `TimeOffRequestForm` and `TimeOffRequestCard`
- Type picker now shows only PTO and Sick buttons
- Update iOS tests

**Files touched:**
- `Models/TimeOffRequest.swift` — remove `.personal` case from enum + `displayName` switch
- `Features/StaffHome/Components/TimeOffRequestForm.swift` — remove personal from `typeColor()` function
- `Features/StaffHome/Components/TimeOffRequestCard.swift` — remove personal from `typeColor` computed property
- `ORbitTests/Models/TimeOffRequestTests.swift` — update enum count, allCases, displayName, rawValue tests
- `ORbitTests/Features/StaffHome/StaffHomeViewModelTests.swift` — update personal displayName assertion

**Commit:** `feat(time-off): phase 3 - remove personal type from iOS models and form`

**Test gate:**
1. **Unit:** Enum has 2 cases (pto, sick), displayNames match, raw values match DB
2. **Integration:** TimeOffRequestForm renders 2 type buttons, default is .pto, form submits correctly
3. **Workflow:** iOS build succeeds clean, type picker works

---

## Phase 4: iOS — Add "My Time Off" section to ProfileView
**Platform:** iOS
**Complexity:** Large
**Dependencies:** Phase 3

**What it does:**
- Create a new "TIME OFF" section in ProfileView between Information and Appearance
- Show YTD PTO summary: approved days used (PTO count, Sick count)
- List recent requests with status badges (reuse existing `TimeOffRequestCard`)
- Add "Request Time Off" button that opens `TimeOffRequestForm` sheet
- Add cancel functionality for pending requests (reuse existing cancel logic)
- Create `ProfileTimeOffViewModel` to manage state independently from StaffHomeViewModel

**Files touched:**
- `Features/Profile/ProfileView.swift` — add TIME OFF section between Information and Appearance
- `Features/Profile/ProfileTimeOffSection.swift` (new) — extracted section component with summary + request list + submit button
- `Features/Profile/ProfileTimeOffViewModel.swift` (new) — manages time-off data (load requests, submit, cancel, compute YTD totals)
- `Repositories/TimeOffRepository.swift` — add `fetchYearTotals(userId:facilityId:year:)` method for YTD summary

**Commit:** `feat(time-off): phase 4 - add My Time Off section to iOS Profile`

**Test gate:**
1. **Unit:** ProfileTimeOffViewModel loads requests, computes YTD totals (pto_days, sick_days), submit returns success
2. **Integration:** ProfileView renders TIME OFF section with summary card, request list, and submit button; cancel sets is_active=false
3. **Workflow:** Open Profile → see PTO summary → tap "Request Time Off" → fill form → submit → see new pending request in list

---

## Phase 5: iOS — Slim down StaffHomeView + add PTO nudge
**Platform:** iOS
**Complexity:** Medium
**Dependencies:** Phase 4

**What it does:**
- Remove "Request Time Off" button from StaffHomeView
- Remove "My Requests" section from StaffHomeView
- Remove time-off related state/methods from StaffHomeViewModel (`recentRequests`, `isLoadingRequests`, `showTimeOffForm`, `loadRecentRequests()`, `submitRequest()`, `cancelRequest()`)
- Add a small nudge banner: if user has upcoming approved time off, show compact chip like "PTO: Mar 20–21"
- The nudge queries next upcoming approved request where `start_date >= today`, limited to 1

**Files touched:**
- `Features/StaffHome/StaffHomeView.swift` — remove request button, My Requests section, cancel confirm dialog, sheet; add nudge banner
- `Features/StaffHome/StaffHomeViewModel.swift` — remove time-off CRUD methods and state; add `upcomingTimeOff: TimeOffRequest?` property + lightweight load
- `Features/StaffHome/Components/TimeOffNudgeBanner.swift` (new) — small chip/banner component showing next PTO date range
- `Features/StaffHome/Components/TimeOffRequestForm.swift` — no changes (still used by Profile)
- `Features/StaffHome/Components/TimeOffRequestCard.swift` — no changes (still used by Profile)

**Commit:** `feat(time-off): phase 5 - slim down Home page, add upcoming PTO nudge`

**Test gate:**
1. **Unit:** StaffHomeViewModel no longer exposes `recentRequests`/`submitRequest`; `upcomingTimeOff` returns next approved request or nil
2. **Integration:** Home page renders without request section; nudge banner appears when approved PTO exists, hidden when none
3. **Workflow:** User with approved PTO → sees nudge on Home → taps avatar → Profile → sees full time-off section with all requests

---

## Phase 6: Both — Update docs + verify no orphaned references
**Platform:** Both
**Complexity:** Small
**Dependencies:** Phases 2–5

**What it does:**
- Update `active-feature.md` to reflect PTO/Sick only (remove all 'personal' references from spec)
- Update request_type CHECK constraint references in spec
- Grep across entire codebase for any remaining 'personal' type references
- Final cross-platform build verification

**Files touched:**
- `docs/active-feature.md` — update request_type references, remove 'Personal' from all lists

**Commit:** `docs: phase 6 - update feature spec for pto/sick consolidation`

**Test gate:**
1. **Unit:** `grep -r "personal" --include="*.ts" --include="*.tsx" --include="*.swift"` returns zero time-off-related hits
2. **Integration:** Full iOS build succeeds; web `npm run typecheck` passes clean
3. **Workflow:** End-to-end — staff submits PTO from Profile on iOS → admin reviews on web with PTO/Sick only → notification delivered

---

## Dependency Graph
```
Phase 1 (DB) ──→ Phase 2 (Web cleanup) ──────────────→ Phase 6 (Docs)
             ──→ Phase 3 (iOS cleanup) → Phase 4 (Profile) → Phase 5 (Home slim) → Phase 6
```

Phases 2 and 3 can run in parallel after Phase 1. Phase 4 depends on Phase 3. Phase 5 depends on Phase 4. Phase 6 is last.

---

## Session Log
(empty — will be populated as phases are completed)
