# Implementation Plan: Staff Schedule Home + Time-Off Management

## Branch: `feature/staff-schedule-home`

## Phase Overview

| Phase | Platform | Description | Status |
|-------|----------|-------------|--------|
| 1 | Database | `time_off_requests` table, RLS, indexes, soft delete trigger | pending |
| 2 | iOS | Staff Schedule Repository + Models (data layer) | pending |
| 3 | iOS | Staff Home View — schedule display (room + surgeon + cases) | pending |
| 4 | iOS | Rich case detail — milestones, team badges, status | pending |
| 5 | iOS | Time-Off Request form + My Requests section | pending |
| 6 | iOS | Time-Off notifications + Home tab routing | pending |
| 7 | Web | Time-Off DAL + types + hooks | pending |
| 8 | Web | Staff Management page — Staff Directory tab | pending |
| 9 | Web | Staff Management page — Time-Off Calendar tab | pending |
| 10 | Web | Time-Off Review Modal + per-user totals + coverage indicator | pending |
| 11 | Both | Polish, edge cases, accessibility, final testing | pending |

---

## Phase 1: Database — `time_off_requests` table
**Platform:** Database (migration)
**Risk:** Low
**Files:**
- `supabase/migrations/YYYYMMDD_time_off_requests.sql` (new)

**Tasks:**
1. Create `time_off_requests` table with all columns per spec
2. Add CHECK constraints: `valid_date_range`, `partial_day_single_day`, status enum, request_type enum
3. Create indexes: `idx_tor_facility_user`, `idx_tor_facility_dates`
4. Add RLS policies:
   - Staff (`access_level = 'user'`): SELECT/INSERT/UPDATE own requests (`user_id = auth.uid()`)
   - Admin (`access_level IN ('facility_admin', 'global_admin')`): SELECT/UPDATE all facility requests
   - All filtered by `facility_id` match
5. Add `sync_soft_delete_columns()` trigger (follow existing pattern)
6. Add `updated_at` trigger (auto-update on modification)
7. Apply migration: `supabase db push`

**Tests:**
- Verify table exists with correct columns
- Verify RLS: staff can only see own requests
- Verify RLS: admin can see all facility requests
- Verify constraints: end_date >= start_date, partial_day only on single-day

---

## Phase 2: iOS — Staff Schedule Repository + Models
**Platform:** iOS
**Risk:** Low
**Dependencies:** Phase 1 (table must exist)
**Files:**
- `Models/StaffSchedule.swift` (new)
- `Models/TimeOffRequest.swift` (new)
- `Repositories/StaffScheduleRepository.swift` (new)
- `Repositories/TimeOffRepository.swift` (new)

**Tasks:**
1. Create `StaffSchedule.swift` models:
   - `StaffRoomAssignment` (from `room_date_staff` join)
   - `StaffDaySchedule` (aggregated: date + room assignments + cases per room)
   - `StaffCaseDetail` (case + milestones + team)
2. Create `TimeOffRequest.swift` models:
   - `TimeOffRequest` (Codable, matches DB schema)
   - `TimeOffRequestType` enum (pto, sick, personal)
   - `TimeOffStatus` enum (pending, approved, denied)
   - `PartialDayType` enum (am, pm)
3. Create `StaffScheduleRepository`:
   - `fetchStaffSchedule(userId:facilityId:date:)` → queries `room_date_staff` with joins to rooms, surgeon assignments
   - `fetchCasesForRoom(roomId:facilityId:date:)` → queries `cases` with milestones and case_staff joins
4. Create `TimeOffRepository`:
   - `fetchMyRequests(userId:facilityId:)` → recent requests
   - `submitRequest(request:)` → INSERT
   - `cancelRequest(requestId:)` → soft delete

**Tests:**
- Unit: Model encoding/decoding
- Integration: Repository queries return expected structure
- Verify facility_id filtering on all queries

---

## Phase 3: iOS — Staff Home View (schedule display)
**Platform:** iOS
**Risk:** Medium (new tab routing)
**Dependencies:** Phase 2
**Files:**
- `Features/StaffHome/StaffHomeView.swift` (new)
- `Features/StaffHome/StaffHomeViewModel.swift` (new)
- `Features/StaffHome/Components/StaffScheduleCard.swift` (new)
- `Features/MainTabView.swift` (modify — add Home tab)

**Tasks:**
1. Create `StaffHomeViewModel`:
   - `@Published var daySchedule: StaffDaySchedule?`
   - `@Published var isLoading: Bool`
   - `loadTodaySchedule()` — fetch room assignments, then cases per room
   - Handle empty state (no assignments)
2. Create `StaffHomeView`:
   - Greeting header (time-based, like SurgeonHomeView pattern)
   - ScrollView with schedule cards
   - Pull-to-refresh
   - Empty state view with quick action buttons
3. Create `StaffScheduleCard`:
   - Room name + surgeon name header
   - "No cases scheduled yet" when no cases
   - List of cases when present (basic: time + procedure + status)
4. Modify `MainTabView`:
   - Add Home tab at index 0 for non-surgeon, non-device-rep users
   - Shift existing tab indices accordingly
   - Pass required environment objects

**Tests:**
- Unit: ViewModel state transitions (loading → loaded → empty)
- Integration: View renders with mock data
- Workflow: Staff user sees Home tab, taps through to case detail

---

## Phase 4: iOS — Rich case detail (milestones, team, duration)
**Platform:** iOS
**Risk:** Medium (milestone data complexity)
**Dependencies:** Phase 3
**Files:**
- `Features/StaffHome/Components/StaffCaseRow.swift` (new)
- `Features/StaffHome/Components/StaffMilestoneTimeline.swift` (new)
- `Features/StaffHome/Components/StaffTeamBadges.swift` (new)
- `Features/StaffHome/StaffHomeViewModel.swift` (modify)

**Tasks:**
1. Create `StaffCaseRow`:
   - Start time + procedure name (primary)
   - Status badge (Scheduled/In Progress/Completed/Cancelled)
   - Estimated duration
   - Expandable detail section OR always-visible detail
2. Create `StaffMilestoneTimeline`:
   - Compact horizontal timeline
   - Dots/icons for each facility milestone
   - States: completed (✓), current (●), upcoming (○)
   - Reuse milestone ordering from facility_milestones.display_order
3. Create `StaffTeamBadges`:
   - Horizontal scroll of role-colored badges
   - Format: "RN J. Wilson" with role-color dot
   - Port role styling from web `roleStyles.ts` to Swift
4. Update `StaffHomeViewModel`:
   - Fetch case_milestones + facility_milestones per case
   - Fetch case_staff with user/role joins per case
   - Assemble into `StaffCaseDetail` model

**Tests:**
- Unit: Milestone timeline renders correct states
- Unit: Role style mapping covers all roles
- Integration: Full case row renders with real-shaped data
- Workflow: Tap case row → navigates to CaseDetailView

---

## Phase 5: iOS — Time-Off Request form + My Requests
**Platform:** iOS
**Risk:** Low
**Dependencies:** Phase 2 (TimeOffRepository)
**Files:**
- `Features/StaffHome/Components/TimeOffRequestForm.swift` (new)
- `Features/StaffHome/Components/TimeOffRequestCard.swift` (new)
- `Features/StaffHome/StaffHomeView.swift` (modify — add section)
- `Features/StaffHome/StaffHomeViewModel.swift` (modify — add time-off state)

**Tasks:**
1. Create `TimeOffRequestForm` (sheet modal):
   - Request type picker (segmented: PTO / Sick / Personal)
   - Start date picker
   - End date picker (defaults to start date)
   - Partial day toggle (only visible when start == end): Full Day / AM Off / PM Off
   - Reason text editor (optional, placeholder text)
   - Submit button with loading state
   - Validation: end >= start, at least type + dates required
2. Create `TimeOffRequestCard`:
   - Shows: type badge, date range, status badge (color-coded)
   - Partial day indicator if applicable
   - Pending requests show "Awaiting review"
   - Approved/denied show reviewer notes if present
3. Add "My Requests" section to `StaffHomeView`:
   - Below schedule section
   - Shows 3 most recent requests
   - "View All" link if more exist
   - "Request Time Off" button (opens form sheet)
4. Update `StaffHomeViewModel`:
   - `@Published var recentRequests: [TimeOffRequest]`
   - `loadRecentRequests()`, `submitRequest()`, `cancelRequest()`

**Tests:**
- Unit: Form validation (date range, required fields)
- Integration: Submit request → appears in recent requests
- Workflow: Open form → fill → submit → see pending status

---

## Phase 6: iOS — Notifications + Home tab routing finalization
**Platform:** iOS
**Risk:** Low
**Dependencies:** Phase 5
**Files:**
- `Features/StaffHome/StaffHomeView.swift` (modify — notification badge)
- `Repositories/TimeOffRepository.swift` (modify — add notification check)
- `Features/MainTabView.swift` (verify routing)
- `ORbitApp.swift` (verify routing)

**Tasks:**
1. Add notification integration:
   - When time-off request status changes → check for new notifications
   - Show badge/indicator on home page if unread time-off notifications exist
   - Tapping notification → navigates to relevant request
2. Verify tab routing:
   - Staff (`user` access_level) → Home tab visible and is default
   - Facility admin → Home tab visible and is default
   - Surgeon → still sees SurgeonHomeView (no change)
   - Device rep → still sees RepMainTabView (no change)
3. Test role-based routing thoroughly
4. Add Realtime subscription for time_off_requests changes (optional, if existing Realtime pattern supports it)

**Tests:**
- Unit: Notification badge logic
- Integration: Request status change → notification appears
- Workflow: Full flow — admin approves on web → staff sees notification on iOS

---

## Phase 7: Web — Time-Off DAL + types + hooks
**Platform:** Web
**Risk:** Low
**Dependencies:** Phase 1 (table must exist)
**Files:**
- `types/time-off.ts` (new)
- `lib/dal/time-off.ts` (new)
- `hooks/useTimeOffRequests.ts` (new)

**Tasks:**
1. Create TypeScript interfaces in `types/time-off.ts`:
   - `TimeOffRequest`, `TimeOffRequestType`, `TimeOffStatus`, `PartialDayType`
   - `TimeOffRequestInput` (for creation)
   - `TimeOffReviewInput` (for approve/deny)
   - `UserTimeOffSummary` (per-user totals by type)
2. Create DAL in `lib/dal/time-off.ts`:
   - `fetchFacilityRequests(facilityId, dateRange?, status?, userId?)` — admin view
   - `reviewRequest(requestId, status, reviewedBy, notes?)` — approve/deny
   - `fetchUserTimeOffTotals(facilityId, year)` — per-user totals by type
   - `calculateBusinessDays(startDate, endDate, partialDay?)` — helper for totals
3. Create hook in `hooks/useTimeOffRequests.ts`:
   - Uses `useSupabaseQuery` pattern
   - Exposes: requests, loading, error, reviewRequest, refetch
   - Filter state for status, role, user

**Tests:**
- Unit: DAL query builders
- Unit: Business day calculation (handles partial days as 0.5)
- Integration: Hook fetches and filters correctly

---

## Phase 8: Web — Staff Management page, Staff Directory tab
**Platform:** Web
**Risk:** Medium (new page + sidebar nav)
**Dependencies:** Phase 7
**Files:**
- `app/staff-management/page.tsx` (new)
- `app/staff-management/PageClient.tsx` (new)
- `components/staff-management/StaffDirectoryTab.tsx` (new)
- `components/layouts/` (modify — add sidebar nav item)

**Tasks:**
1. Create page route `/staff-management`:
   - Server component with auth check (admin only)
   - Client component with tab navigation
2. Create `StaffDirectoryTab`:
   - Data table (shadcn Table or DataTable pattern)
   - Columns: Name (avatar + name), Role, Email, Phone, Time-Off (total days this year), Status
   - Search bar (filters by name/email)
   - Role filter dropdown
   - Time-off totals column: "PTO: 5d | Sick: 2d | Personal: 1d" format
   - Click row → expandable detail or sheet with full profile
3. Add sidebar navigation:
   - "Staff Management" item under admin section
   - Icon: Users or UserCog from lucide-react
   - Only visible to facility_admin / global_admin
4. Fetch staff data using existing users DAL + new time-off DAL for totals

**Tests:**
- Unit: Table renders with mock data
- Integration: Search/filter works correctly
- Workflow: Navigate to page → see staff → filter by role → see time-off totals

---

## Phase 9: Web — Time-Off Calendar tab
**Platform:** Web
**Risk:** Medium (calendar UI complexity)
**Dependencies:** Phase 7, Phase 8
**Files:**
- `components/staff-management/TimeOffCalendarTab.tsx` (new)
- `components/staff-management/CalendarDayCell.tsx` (new)

**Tasks:**
1. Create `TimeOffCalendarTab`:
   - Month calendar grid (7 columns × 4-6 rows)
   - Month/year navigation (prev/next/today)
   - Color-coded request blocks per day:
     - Pending: amber/yellow background
     - Approved: green background
     - Denied: gray/strikethrough
   - Each block shows: staff name + request type badge
   - Filter controls: by role, by status, by specific staff member
2. Create `CalendarDayCell`:
   - Day number
   - Stacked request badges (max 3 visible, "+N more" overflow)
   - Click badge → opens review modal
   - Background shade if coverage is low for that day
3. Coverage indicator per day:
   - Small count showing "8/12 staff available" or similar
   - Red highlight when available staff drops below room count

**Tests:**
- Unit: Calendar renders correct days for any month
- Unit: Request blocks positioned correctly for multi-day ranges
- Integration: Filter changes update displayed requests
- Workflow: Navigate months → see requests → click to review

---

## Phase 10: Web — Review Modal + per-user totals + coverage
**Platform:** Web
**Risk:** Low
**Dependencies:** Phase 9
**Files:**
- `components/staff-management/TimeOffReviewModal.tsx` (new)
- `components/staff-management/CoverageIndicator.tsx` (new)
- `components/staff-management/UserTimeOffSummary.tsx` (new)

**Tasks:**
1. Create `TimeOffReviewModal` (shadcn Dialog):
   - Header: Staff name + role
   - Request details: Type badge, date range, partial day indicator, reason text
   - User's time-off summary for the year (PTO: Xd, Sick: Yd, Personal: Zd)
   - Coverage impact: "If approved, OR coverage on [date] drops to X nurses, Y scrub techs"
   - Action buttons: Approve (green) / Deny (red)
   - Optional notes textarea for review response
   - Loading state on submit
2. Create `CoverageIndicator`:
   - Small badge showing available staff count per role
   - Compares total active staff minus approved time-off for that date
   - Warning state when coverage is thin
3. Create `UserTimeOffSummary`:
   - Reusable component showing per-user totals
   - Used in both directory tab (inline) and review modal
   - Calculates from approved requests, current year
   - Handles partial days as 0.5

**Tests:**
- Unit: Coverage calculation logic
- Unit: Time-off total calculation (handles partial days)
- Integration: Approve request → updates calendar + totals
- Workflow: Click request → review details → approve → see updated calendar

---

## Phase 11: Polish, edge cases, accessibility, final testing
**Platform:** Both
**Risk:** Low
**Dependencies:** All previous phases
**Files:** Various (modifications only)

**Tasks:**
1. **iOS Polish:**
   - Loading skeletons for schedule cards
   - Error states with retry
   - Haptic feedback on actions
   - VoiceOver accessibility labels
   - Dynamic Type support
   - Landscape layout (iPad)
   - Empty state animations
2. **Web Polish:**
   - Responsive layout for Staff Management page
   - Keyboard navigation in calendar
   - ARIA labels on calendar cells and review modal
   - Loading states and error boundaries
   - Toast notifications on approve/deny actions
3. **Edge Cases:**
   - Staff assigned to multiple rooms on same day
   - Time-off request spanning weekends
   - Partial day on first/last day of multi-day request (should be rejected by constraint)
   - Admin reviewing their own time-off request
   - Concurrent approve/deny (optimistic locking or last-write-wins)
4. **Final Testing:**
   - Full 3-stage test gate on both platforms
   - Cross-platform workflow: admin creates schedule on web → staff sees on iOS
   - Time-off flow: staff requests on iOS → admin reviews on web → staff notified on iOS

**Tests:**
- Full regression suite
- Accessibility audit
- Performance: home page loads < 2s with 10 cases
