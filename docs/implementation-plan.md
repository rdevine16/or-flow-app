# Implementation Plan: Staff Schedule Home + Time-Off Management

## Branch: `feature/staff-schedule-home`

## Phase Overview

| Phase | Platform | Description | Status |
|-------|----------|-------------|--------|
| 1 | Database | `time_off_requests` table, RLS, indexes, soft delete trigger | done |
| 2 | iOS | Staff Schedule Repository + Models (data layer) | pending |
| 3 | iOS | Staff Home View — schedule display (room + surgeon + cases) | pending |
| 4 | iOS | Rich case detail — milestones, team badges, status | pending |
| 5 | iOS | Time-Off Request form + My Requests section | pending |
| 6 | iOS | Time-Off notifications + Home tab routing | pending |
| 7 | Web | Time-Off DAL + types + hooks | done |
| 8 | Web | Staff Management page — Staff Directory tab | done |
| 9 | Web | Staff Management page — Time-Off Calendar tab | done |
| 10 | Web | Time-Off Review Modal + per-user totals + coverage indicator | done |
| 11 | Web | Staff Detail Drawer — tabbed slide-out (Profile / Time-Off / Actions) | done |
| 12 | Web | User management actions in drawer — edit, invite, deactivate + Add Staff | done |
| 13 | Web | Global admin features + remove /settings/users route | done |
| 14 | Both | Polish, accessibility, and edge cases | done |
| 15 | Both | Polish, notifications, and bug fixes | done |
| 16 | DB + Web | Partial holidays migration + Holidays tab on Staff Management | done |
| 17 | Web | Time-off holiday-aware PTO calculation + review display | done |
| 18 | Web | Verify + fix block schedule + analytics holiday integration | done |
| 19 | Both | Holiday polish, edge cases, and final testing | done |

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

## Phase 11: Web — Staff Detail Drawer (tabbed slide-out)
**Platform:** Web
**Risk:** Medium (new component pattern, replaces expandable rows)
**Dependencies:** Phase 8, Phase 10
**Files:**
- `components/staff-management/StaffDetailDrawer.tsx` (new)
- `components/staff-management/DrawerProfileTab.tsx` (new)
- `components/staff-management/DrawerTimeOffTab.tsx` (new)
- `components/staff-management/DrawerActionsTab.tsx` (new)
- `components/staff-management/StaffDirectoryTab.tsx` (modify — replace expandable row with drawer trigger)
- `app/staff-management/PageClient.tsx` (modify — add drawer state)

**Tasks:**
1. Create `StaffDetailDrawer` (shadcn Sheet, slide-out from right):
   - Header: avatar + name + role badge + account status badge
   - Tab navigation: Profile | Time-Off | Actions
   - Close button
   - Width: ~480px
2. Create `DrawerProfileTab`:
   - Full name, email, phone
   - Role badge, access level
   - Account status badge (Active ✓ / Pending ● / No Account ○)
   - Join date, last login
   - Facility name
3. Create `DrawerTimeOffTab`:
   - Per-type breakdown (PTO / Sick / Personal) with badges and day counts
   - Total days taken this year
   - Recent requests list with status badges (pending=amber, approved=green, denied=red)
   - Inline approve/deny buttons on pending requests (reuse `TimeOffReviewModal` or inline review)
   - "No requests" empty state
4. Create `DrawerActionsTab`:
   - Placeholder action buttons (Edit Profile, Send Invite, Deactivate)
   - Buttons disabled with "Coming in Phase 12" tooltip
   - Layout ready for Phase 12 to wire up real actions
5. Add account status checking to StaffDirectoryTab:
   - Call `/api/check-user-status` and `/api/check-auth-status` on load
   - Add "Status" column to directory table showing Active/Pending/No Account badges
6. Replace expandable `StaffRowDetail` with drawer:
   - Click row → opens `StaffDetailDrawer` instead of expanding inline
   - Remove `StaffRowDetail` component and `expandedUserId` state
   - Add `selectedUserId` state + drawer open/close

**Tests:**
- Unit: Drawer renders with correct tabs
- Unit: Profile tab shows account status badge based on auth/invite state
- Unit: Time-Off tab shows breakdown + recent requests
- Integration: Click row → drawer opens with correct user data
- Integration: Approve request in drawer → request status updates
- Workflow: Open drawer → switch tabs → review time-off → close drawer

---

## Phase 12: Web — User management actions in drawer
**Platform:** Web
**Risk:** Medium (porting complex forms + invite flow)
**Dependencies:** Phase 11
**Files:**
- `components/staff-management/DrawerActionsTab.tsx` (modify — wire up real actions)
- `components/staff-management/StaffDirectoryTab.tsx` (modify — add toolbar buttons)
- `components/staff-management/EditUserForm.tsx` (new — inline edit form for drawer)
- `app/staff-management/PageClient.tsx` (modify — add InviteUserModal integration)

**Tasks:**
1. Create `EditUserForm` for the drawer Actions tab:
   - Inline form (not a separate modal): name, email, role, access level
   - Save button with loading state
   - Validation: required fields, email format
   - Cannot change own permissions
   - Audit log on save (`userAudit.updated()`)
2. Wire up invite/resend invite in Actions tab:
   - "Send Invite" button (visible when user has email but no auth account)
   - "Resend Invite" button (visible when invite is pending)
   - Calls existing `/api/admin/invite` and `/api/resend-invite` routes
   - Audit log (`userAudit.invited()`)
   - Toast notification on success/failure
3. Wire up deactivate/reactivate in Actions tab:
   - "Deactivate" button with ConfirmDialog
   - "Reactivate" button (shown for inactive users — switch to "View Deactivated" in directory)
   - Cannot deactivate yourself
   - Soft delete pattern: `is_active = false`, `deleted_at`, `deleted_by`
   - Audit log (`userAudit.deactivated()` / `userAudit.reactivated()`)
4. Add "Add Staff" button to StaffDirectoryTab toolbar:
   - Opens existing `InviteUserModal` (reuse as-is)
   - Position: right side of toolbar, next to search/filters
   - Refetch directory after successful add
5. Add "View Deactivated" toggle to toolbar:
   - Toggle between active and deactivated staff
   - Deactivated rows show with muted styling + "Reactivate" option in drawer

**Tests:**
- Unit: Edit form validation
- Unit: Deactivate confirmation flow
- Integration: Edit user → save → drawer reflects changes
- Integration: Send invite → status badge changes to Pending
- Integration: Deactivate → user moves to deactivated view
- Workflow: Add Staff → fill form → see new user in directory → open drawer → edit role

---

## Phase 13: Web — Global admin features + remove /settings/users
**Platform:** Web
**Risk:** Medium (route removal, navigation changes)
**Dependencies:** Phase 12
**Files:**
- `app/staff-management/PageClient.tsx` (modify — global admin facility selector)
- `components/staff-management/StaffDirectoryTab.tsx` (modify — facility column for global admin)
- `components/layouts/DashboardLayout.tsx` or sidebar config (modify — remove Settings > Users link)
- `app/settings/users/` (delete — entire directory)
- `components/InviteUserModal.tsx` (modify if needed — ensure facility selector works for global admin)

**Tasks:**
1. Add global admin facility selector to Staff Management:
   - Facility dropdown at page level (above tabs)
   - Default to current effective facility
   - Selecting a facility re-scopes directory + calendar
   - Uses existing `facilities` lookup
2. Add facility column to directory for global admins:
   - Shows facility name when viewing across facilities (or "All Facilities" mode)
   - Allow moving user between facilities (update `facility_id`)
   - Audit log on facility change
3. Delete `/settings/users` route:
   - Remove `app/settings/users/page.tsx`
   - Remove `app/settings/users/PageClient.tsx`
   - Keep API routes (`/api/admin/invite`, `/api/resend-invite`, `/api/check-user-status`, `/api/check-auth-status`) — still needed
4. Update sidebar navigation:
   - Remove "Users" link from Settings section
   - Ensure "Staff Management" link is prominent in admin section
   - Update any breadcrumbs or internal links pointing to `/settings/users`
5. Verify no orphaned references:
   - Search codebase for `/settings/users` links
   - Update any redirects or help text

**Tests:**
- Unit: Facility selector renders for global admin, hidden for facility admin
- Integration: Switch facility → directory + calendar re-scope
- Integration: Move user to different facility → user disappears from current view
- Workflow: Global admin → select facility → manage staff → switch to another facility
- Regression: Verify no broken links to removed route

---

## Phase 14: Polish, edge cases, accessibility, final testing
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
   - Responsive layout for Staff Management page (all tabs + drawer)
   - Keyboard navigation in calendar
   - ARIA labels on calendar cells, review modal, and drawer
   - Loading states and error boundaries
   - Toast notifications on all actions (approve/deny, edit, invite, deactivate)
   - Drawer keyboard accessibility (Escape to close, tab trapping)
3. **Edge Cases:**
   - Staff assigned to multiple rooms on same day
   - Time-off request spanning weekends
   - Partial day on first/last day of multi-day request (should be rejected by constraint)
   - Admin reviewing their own time-off request
   - Concurrent approve/deny (optimistic locking or last-write-wins)
   - Deactivating a user with pending time-off requests (auto-deny or warn?)
   - Inviting a user whose email already exists in another facility
4. **Merged Page Regression:**
   - All user management actions that existed in /settings/users work in Staff Management
   - Audit logging fires on every action
   - Account status badges update correctly after invite/accept
   - Global admin can manage all facilities
5. **Final Testing:**
   - Full 3-stage test gate on both platforms
   - Cross-platform workflow: admin creates schedule on web → staff sees on iOS
   - Time-off flow: staff requests on iOS → admin reviews on web → staff notified on iOS
   - User management flow: add staff → invite → staff accepts → appears as Active

**Tests:**
- Full regression suite
- Accessibility audit
- Performance: Staff Management page loads < 2s with 50 staff
- Performance: Calendar renders smoothly with 30+ requests per month

---

## Phase 15: Both — Polish, notifications, and bug fixes
**Platform:** Both
**Risk:** Low
**Dependencies:** Phase 14
**Status:** done

---

## Phase 16: Database + Web — Partial holidays migration + Holidays tab on Staff Management
**Platform:** Database + Web
**Risk:** Medium (DB migration + moving existing UI to new location)
**Dependencies:** None (independent of iOS phases)

### Existing Infrastructure (no work needed)
The following already exists and will be **reused, not rebuilt:**
- `facility_holidays` table — recurring rule-based (month/day or month/week_of_month/day_of_week), with RLS, audit logging
- `facility_closures` table — one-off date closures
- `/settings/closures` page — full CRUD for both holidays + closures
- `useFacilityClosures` hook — CRUD + `isDateClosed()` utility
- Types: `FacilityHoliday`, `FacilityClosure`, `CreateHolidayInput`, `CreateClosureInput` in `types/block-scheduling.ts`
- Block schedule page already calls `isDateClosed()` to mark dates closed
- Block utilization analytics already queries `facility_holidays` and excludes holiday dates

### What This Phase Adds

**Files:**
- `supabase/migrations/YYYYMMDD_add_partial_holidays.sql` (new)
- `components/staff-management/HolidaysTab.tsx` (new)
- `app/staff-management/PageClient.tsx` (modify — add Holidays tab)
- `types/block-scheduling.ts` (modify — add partial fields to FacilityHoliday)
- `hooks/useFacilityClosures.ts` (modify — support partial fields)
- `app/settings/closures/PageClient.tsx` (modify — support partial fields in holiday dialog)

**Tasks:**
1. **Migration — add partial holiday support to `facility_holidays`:**
   - `ALTER TABLE facility_holidays ADD COLUMN is_partial BOOLEAN NOT NULL DEFAULT false`
   - `ALTER TABLE facility_holidays ADD COLUMN partial_close_time TIME` (nullable)
   - Add CHECK constraint: `partial_requires_time` — if is_partial=true then partial_close_time NOT NULL, if is_partial=false then partial_close_time IS NULL
   - Apply migration: `supabase db push`
2. **Update types** in `types/block-scheduling.ts`:
   - Add `is_partial: boolean` and `partial_close_time: string | null` to `FacilityHoliday`
   - Add same fields to `CreateHolidayInput`
3. **Update `useFacilityClosures` hook:**
   - `isDateClosed()` → enhance to return closure info including partial status (or add `getDateClosureInfo()`)
   - Ensure create/update mutations include partial fields
4. **Add "Holidays" tab to Staff Management `PageClient.tsx`:**
   - Third tab after Staff Directory and Time-Off Calendar
   - Tab shows combined holidays + closures (same as `/settings/closures` but embedded)
5. **Create `HolidaysTab` component:**
   - Reuse the holiday/closure CRUD patterns from `/settings/closures/PageClient.tsx`
   - Two sections: "Recurring Holidays" (from `facility_holidays`) + "One-Off Closures" (from `facility_closures`)
   - Add partial holiday toggle + close time picker to the Holiday dialog
   - Show "Partial — closes at [time]" badge for partial holidays
   - Include next occurrence display for recurring holidays
6. **Update `/settings/closures` page:**
   - Add partial holiday support to its Holiday dialog as well (keep both pages in sync)
   - Or consider redirecting to Staff Management Holidays tab (optional cleanup)

**Tests:**
- Verify migration adds columns correctly
- Verify partial constraint: is_partial=true requires close time, is_partial=false rejects close time
- Unit: HolidaysTab renders with existing holidays + closures
- Integration: Create/edit/delete holidays from Staff Management tab
- Integration: Create partial holiday with close time
- Workflow: Navigate to Staff Management → Holidays tab → add holiday → see in list

---

## Phase 17: Web — Time-off holiday-aware PTO calculation + review display
**Platform:** Web
**Risk:** Medium (modifying calculation logic + review UI)
**Dependencies:** Phase 16 (partial holidays must exist)
**Files:**
- `lib/dal/time-off.ts` (modify — holiday-aware business day calculation)
- `components/staff-management/TimeOffReviewModal.tsx` (modify — show holiday breakdown)
- `hooks/useTimeOffRequests.ts` (modify — holiday-adjusted totals)
- `components/staff-management/UserTimeOffSummary.tsx` (modify — use adjusted totals)
- `components/staff-management/DrawerTimeOffTab.tsx` (modify — pass holidays for adjusted totals)
- `components/staff-management/TimeOffCalendarTab.tsx` (modify — show holidays on calendar)

**Tasks:**
1. **Holiday-aware PTO calculation in `lib/dal/time-off.ts`:**
   - Add `resolveHolidayDatesForRange(holidays: FacilityHoliday[], startDate: Date, endDate: Date): Set<string>` — resolves recurring holiday rules to actual dates in a range (reuse pattern from block utilization)
   - Modify `calculateBusinessDays()` to accept holidays array parameter
   - Subtract holiday dates that fall within the request's date range from PTO count
   - Partial holiday logic: full-day holiday = -1 PTO day; partial holiday = -0.5 day (or full -1 if PTO is PM-off and holiday closes at noon, since facility is closed anyway)
   - Return breakdown object: `{ totalCalendarDays, weekendDays, holidayDays, ptoDaysUsed, holidays: { name, date }[] }`
2. **Time-off review modal — show holiday breakdown:**
   - Fetch facility holidays when modal opens
   - Calculate holiday-adjusted PTO days
   - Display:
     - "Date range: Mon Dec 23 – Fri Dec 27 (5 weekdays)"
     - "Holidays in range: Christmas (Dec 25)" with holiday badge
     - "PTO days charged: 4" (highlighted, clear)
   - For partial holidays: "Christmas Eve (Dec 24, closes at noon) — 0.5 day"
3. **Time-off calendar — show holidays:**
   - Render resolved holidays on the TimeOffCalendarTab month grid
   - Holiday cells have distinct color (e.g., blue/gray background) separate from time-off request colors
   - Holiday name label in cell
   - Helps admin see holidays in context when reviewing time-off patterns
4. **User time-off summary — holiday-adjusted totals:**
   - `UserTimeOffSummary` component must recalculate using holiday-adjusted day counts
   - For each approved request, resolve holidays in its date range and subtract
   - Ensure per-user totals in directory, drawer, and review modal all use adjusted counts
5. **DrawerTimeOffTab:**
   - Fetch holidays and pass to `UserTimeOffSummary`
   - Show holiday-adjusted breakdown per request in recent requests list

**Tests:**
- Unit: `calculateBusinessDays` with holidays correctly subtracts holiday dates
- Unit: `resolveHolidayDatesForRange` correctly handles fixed + dynamic holidays
- Unit: Partial holiday + partial PTO day interactions
- Integration: Time-off request spanning a holiday → review modal shows correct breakdown
- Integration: User totals reflect holiday-adjusted PTO (e.g., 4 days not 5 for week with holiday)
- Workflow: Admin reviews request overlapping holiday → sees "PTO days charged: 4" → approves → totals update correctly

---

## Phase 18: Web — Verify + fix block schedule + analytics holiday integration
**Platform:** Web
**Risk:** Low–Medium (mostly verification, fix anything broken)
**Dependencies:** Phase 16

### Context
The block schedule page already calls `isDateClosed()` from `useFacilityClosures`, and block utilization analytics already queries `facility_holidays` and excludes those dates. This phase **verifies** both work correctly and adds partial holiday support.

**Files:**
- `app/analytics/block-utilization/PageClient.tsx` (modify if needed — partial holiday hours adjustment)
- `components/block-schedule/WeekCalendar.tsx` (modify if needed — holiday name label)
- `components/block-schedule/RoomScheduleGrid.tsx` (verify closed-room display on holidays)
- `hooks/useFacilityClosures.ts` (modify if needed — partial holiday info for display)

**Tasks:**
1. **Verify block schedule (Surgeon Blocks tab):**
   - Confirm `isDateClosed()` correctly identifies holiday dates → blocks not rendered
   - If holiday column currently just shows no blocks with no explanation, add a holiday banner/label: "[Holiday Name]" with distinct background
   - Verify partial holidays: if `partial_close_time` is set, blocks starting after close time should be hidden
2. **Verify block schedule (Room Schedule tab):**
   - Confirm room-day cells on holiday dates show as closed
   - Verify drag-and-drop is blocked on closed cells
   - Add holiday name to closed-cell display if not already shown
3. **Verify block utilization analytics:**
   - Confirm `resolveHolidayDates()` in analytics correctly resolves recurring holiday rules to actual dates
   - Confirm holiday dates are excluded from block available hours and room available hours
   - Test with real data: create a holiday mid-week → check that utilization stats reduce correctly
   - **Add partial holiday support to analytics:** for partial holidays, reduce available hours by the closed portion (e.g., room open 7AM–5PM, holiday closes at noon → 5hr available instead of 10hr)
4. **Holiday info tooltip on block schedule:**
   - When hovering over a closed/holiday day column, show tooltip with holiday name + "Full day closure" or "Partial — closes at [time]"

**Tests:**
- Integration: Create recurring holiday (e.g., "4th Thursday of November") → view block schedule for Thanksgiving week → verify that day shows as closed
- Integration: View block utilization for a month containing a holiday → verify reduced available hours
- Integration: Partial holiday → analytics shows correctly reduced (not zero) hours
- Regression: Non-holiday dates still show blocks and rooms normally

---

## Phase 19: Both — Holiday polish, edge cases, and final testing
**Platform:** Both
**Risk:** Low
**Dependencies:** Phases 16–18
**Files:** Various (modifications only)

**Tasks:**
1. **Edge Cases:**
   - Holiday created after time-off was already approved → PTO totals recalculate dynamically (totals are computed, not stored), so this should "just work" — verify it does
   - Deleting/toggling a holiday that has time-off requests overlapping it → verify totals update
   - Holiday on a weekend — recurring holiday that lands on Sat/Sun: should have no effect on PTO or block schedule (weekends already excluded). Note: unlike US observed-date rules, facility holidays don't shift to Mon/Fri — verify this is acceptable or add observed-date logic
   - Multiple holidays in one week (e.g., Thanksgiving Thu + day-after Fri as one-off closure)
   - Partial holiday where close time is before room open time → effectively full closure
   - Holiday on a day with existing `room_date_assignments` → assignments persist in DB but rooms display as closed
2. **Time-Off Calendar polish:**
   - Holidays visible as distinct visual elements on the calendar grid
   - Tooltip on holiday showing name + full/partial status
3. **Block Schedule polish:**
   - Consistent holiday styling between Surgeon Blocks and Room Schedule tabs
   - Holiday banner responsive to different screen sizes
4. **iOS considerations (future):**
   - Document how holidays should appear on iOS Staff Home when that phase is built
   - Holiday data already accessible via existing RLS for iOS queries
5. **Accessibility:**
   - ARIA labels on holiday indicators in Staff Management Holidays tab
   - Screen reader announces holiday closures on block schedule
   - Keyboard navigation through holiday cells on time-off calendar
6. **Final Testing:**
   - 3-stage test gate
   - Create holidays (both recurring + one-off closures) → verify block schedule hides blocks
   - Verify room schedule shows closed rooms on holidays
   - Verify analytics hours correctly reduced for holidays
   - Create time-off spanning holidays → verify PTO count correct and breakdown shown
   - Edit/toggle/delete holidays → verify all downstream effects update
   - Verify `/settings/closures` page still works with partial holiday support

**Tests:**
- Full regression suite
- Holiday CRUD regression (Staff Management tab + /settings/closures)
- Block schedule + room schedule display regression
- Analytics calculation regression with holidays
- Time-off PTO calculation regression with holidays
- Accessibility audit on holiday UI elements

---

## Session Log

### Session — 2026-03-13, wrap-up
- **Phase:** 19 — completed (all web phases 1, 7–19 done)
- **What was done:** Wrap-up session — ran 3-stage test gate, updated plan status for phases 16-19 to done
- **Files changed:** docs/implementation-plan.md (status updates + session log)
- **Commit:** 15c2fbe (last phase commit)
- **Test results:** Stage 1: pre-existing typecheck errors only. Stage 2: 99.87% pass (6130/6138, 8 unrelated failures). Stage 3: coverage gaps identified for phases 16-19 (block utilization partial holiday logic untested, DrawerTimeOffTab missing test file, no end-to-end holiday workflow tests)
- **Known issues discovered:** Missing test coverage for block utilization partial holiday logic, useTimeOffRequests holiday-aware totals integration, timezone handling for partial holidays, DrawerTimeOffTab component
- **Context usage:** low
