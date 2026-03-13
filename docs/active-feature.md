# Feature: Staff Schedule Home + Time-Off Management

## Goal
Build a staff-focused home page on iOS showing today's room assignments, cases (with rich detail including milestones and team), and time-off request capability. Create a web admin Staff Management page with staff directory, time-off calendar with approve/deny workflow, and per-user time-off totals. This gives OR staff a personalized daily view and gives admins proper workforce visibility.

## Platforms & Scope
- **iOS:** Staff Home page + time-off request form (primary deliverable)
- **Web:** Admin Staff Management page (Directory + Time-Off Calendar + per-user totals)
- **Database:** New `time_off_requests` table + migration + RLS policies

## Target Audience
- **Staff Home (iOS):** `access_level` in (`user`, `facility_admin`) — nurses, scrub techs, anesthesiologists, PAs, first assists, facility admins
- **NOT shown to:** Surgeons (keep `SurgeonHomeView`), Device Reps (keep `RepMainTabView`)
- **Admin Staff Management (web):** `facility_admin` and `global_admin` only

---

## Requirements

### iOS Staff Home Page

1. New "Home" tab added to `MainTabView` for `user` + `facility_admin` access levels
2. Tab order matches surgeon layout: Home, Rooms, Cases, Alerts, Profile
3. Today-only schedule view with two display modes:

**Mode A — Room schedule filled, no cases:**
```
Today's Schedule

  OR 3 — Dr. Smith
    No cases scheduled yet

  OR 7 — Dr. Jones
    No cases scheduled yet
```

**Mode B — Cases exist:**
```
Today's Schedule

  OR 3 — Dr. Smith
    8:00 AM — Total Hip Arthroplasty
      Status: In Progress | Est. 2h 15m
      Milestones: Patient In ✓ → Anesthesia ✓ → Prepping ● → Surgery ○ → Closing ○
      Team: RN J. Wilson, ST M. Brown, AN Dr. Patel

    10:30 AM — Total Knee Arthroplasty
      Status: Scheduled | Est. 1h 45m
      Team: RN J. Wilson, ST M. Brown, AN Dr. Patel
```

4. Rich case detail: start time, procedure, status badge, estimated duration, milestone timeline, team members with role badges
5. Empty state when no assignments: "No Schedule Today" with quick actions
6. **Quick Actions:** "Request Time Off" button on home page
7. Tapping a case → navigates to existing `CaseDetailView`

### Time-Off Request System

8. **Request form (iOS):** Type picker (PTO/Sick/Personal), start date, end date, partial day toggle (Full Day/AM Off/PM Off — only when single day), optional reason text
9. **Workflow:** Staff submits → status = `pending` → Admin reviews on web → approves or denies
10. **My Requests section** on iOS home: shows recent requests with status badges (Pending=yellow, Approved=green, Denied=red)
11. **Notifications:** When admin approves/denies → notification in staff's Alerts tab (reuse existing notification system)

### Web Admin Staff Management Page

12. New page at `/staff-management`, sidebar nav, admin-only access
13. **Tab 1 — Staff Directory:** Table of active staff, columns: Name, Role, Email, Phone, Status. Search + role filter. Click row for detail.
14. **Tab 2 — Time-Off Calendar:** Team-wide month calendar, requests color-coded by status. Click request → review modal (approve/deny with optional notes). Filter by role/status/staff.
15. **Per-user time-off totals:** Admin can see total days taken per user, broken down by type (PTO/Sick/Personal), for the current year. Displayed in both the directory view (column) and as a summary when reviewing individual requests.
16. **Coverage indicator:** Count of available staff per role per day on the calendar.

---

## Database Context

### New Table: `time_off_requests`
```sql
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  user_id UUID NOT NULL REFERENCES users(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('pto', 'sick', 'personal')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  partial_day_type TEXT CHECK (partial_day_type IN ('am', 'pm')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT partial_day_single_day CHECK (
    partial_day_type IS NULL OR start_date = end_date
  )
);

-- Indexes
CREATE INDEX idx_tor_facility_user ON time_off_requests(facility_id, user_id, status);
CREATE INDEX idx_tor_facility_dates ON time_off_requests(facility_id, start_date, end_date);

-- RLS: staff see own requests, facility_admin/global_admin see all facility requests
-- Soft delete: filter is_active = true
-- Trigger: sync_soft_delete_columns() pattern
```

### Existing Tables Used
- `room_date_staff` — staff room assignments by date
- `room_date_assignments` — surgeon room assignments by date
- `cases` — cases by room + date
- `case_milestones` + `facility_milestones` — milestone progress
- `case_staff` — team assigned to each case
- `or_rooms` — room names
- `users` + `user_roles` — staff/surgeon info
- `notifications` — reuse for time-off status change notifications

---

## UI/UX

### iOS
- Route: Home tab (index 0) in MainTabView for staff/admin roles
- Pull-to-refresh on schedule
- Time-off request via sheet modal
- My Requests section below schedule (collapsible)

### Web
- Route: `/staff-management`
- Two tabs: Staff Directory | Time-Off Calendar
- Staff Directory: data table with search, role filter, time-off totals column
- Time-Off Calendar: month grid with colored request blocks, click-to-review
- Review modal: staff details, request info, approve/deny buttons with notes

---

## Files Likely Involved

### iOS (new files)
- `Features/StaffHome/StaffHomeView.swift` — main home view
- `Features/StaffHome/StaffHomeViewModel.swift` — business logic
- `Features/StaffHome/Components/StaffScheduleCard.swift` — room assignment card
- `Features/StaffHome/Components/StaffCaseRow.swift` — case row with rich detail
- `Features/StaffHome/Components/StaffMilestoneTimeline.swift` — compact milestone progress
- `Features/StaffHome/Components/StaffTeamBadges.swift` — role-colored team badges
- `Features/StaffHome/Components/TimeOffRequestCard.swift` — request status display
- `Features/StaffHome/Components/TimeOffRequestForm.swift` — request submission sheet
- `Repositories/StaffScheduleRepository.swift` — room_date_staff + cases queries
- `Repositories/TimeOffRepository.swift` — time_off_requests CRUD
- `Models/StaffSchedule.swift` — schedule data models
- `Models/TimeOffRequest.swift` — time-off models

### iOS (modified files)
- `Features/MainTabView.swift` — add Home tab for staff/admin roles
- `ORbitApp.swift` — update role routing if needed

### Web (new files)
- `app/staff-management/page.tsx` — server component
- `app/staff-management/PageClient.tsx` — client component with tabs
- `components/staff-management/StaffDirectoryTab.tsx`
- `components/staff-management/TimeOffCalendarTab.tsx`
- `components/staff-management/TimeOffReviewModal.tsx`
- `components/staff-management/CoverageIndicator.tsx`
- `lib/dal/time-off.ts` — time-off DAL
- `hooks/useTimeOffRequests.ts` — data hook
- `types/time-off.ts` — TypeScript interfaces

### Database
- `supabase/migrations/YYYYMMDD_time_off_requests.sql`

---

## iOS Parity
- [x] iOS is the PRIMARY platform for staff home
- [ ] Web staff dashboard is future scope

---

## Known Issues / Constraints
- Room schedule data (`room_date_staff`, `room_date_assignments`) must be populated by admin on web first
- No push notifications yet — in-app notifications only via existing `notifications` table
- Partial day requests only valid for single-day requests (enforced by DB constraint)
- Time-off totals are calculated from approved requests only (pending/denied excluded from totals)

---

## Holiday Management

### Overview
Facility-level holidays configured by admins on the Staff Management page. Holidays affect block schedules (blocks hidden), room schedules (rooms closed), analytics (hours calculations), and time-off (holidays excluded from PTO counts).

### Requirements

#### Holiday Configuration (Staff Management → Holidays Tab)
17. **Holidays tab** on Staff Management page — admin CRUD for facility holidays
18. Holidays are **facility-scoped** (each facility defines its own)
19. Holidays are **one-time** (no recurrence — admin creates each year manually)
20. **Partial holidays supported** — e.g., "Christmas Eve — close at noon"
    - Full-day holidays: all rooms closed, all blocks hidden
    - Partial holidays: rooms close at specified time, blocks that fall entirely after close time are hidden
21. Holiday fields: name, date, is_partial, partial_close_time (time rooms close on partial days)

#### Block Schedule Impact
22. **Blocks hidden on holiday dates** — surgeon blocks do not appear on full-day holidays
23. On partial holidays, blocks that start at or after `partial_close_time` are hidden; blocks spanning the close time shown as shortened or hidden (simpler)
24. **Rooms shown as closed** on holiday dates — same visual treatment as existing room closures
25. Holiday dates render with a visual indicator (banner, background color, label) so admins see why blocks are absent

#### Analytics / Reporting Impact
26. **All analytics pages** (block utilization, room utilization — all tabs) must account for holidays when calculating hours for a selected period
27. Holiday dates excluded from available hours calculations — a holiday week has fewer available hours
28. Applies to whatever date range filters the user selects

#### Time-Off ↔ Holiday Interaction
29. **Holidays are NOT counted as PTO days.** If a time-off request spans Mon–Fri and Wednesday is a holiday, only 4 PTO days are used, not 5.
30. **Show this detail clearly** to both:
    - **Staff creating request:** "Your request covers 5 calendar days. 1 day is a holiday (Christmas). PTO days used: 4."
    - **Admin reviewing request:** Same breakdown visible in review modal
31. Time-off totals (per-user summary) must use holiday-adjusted day counts
32. No notifications sent when admin creates a holiday

### Database

#### Existing Table: `facility_holidays` (already in production)
```sql
-- Existing schema — recurring rule-based holidays
CREATE TABLE facility_holidays (
  id UUID PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  name VARCHAR(100) NOT NULL,
  month INTEGER,         -- 1-12
  day INTEGER,           -- for fixed dates (e.g., Dec 25)
  week_of_month INTEGER, -- for dynamic dates (1-5, 5=last)
  day_of_week INTEGER,   -- for dynamic dates (0=Sun, 6=Sat)
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS, indexes, audit logging already in place
-- Managed via /settings/closures page + useFacilityClosures hook
```

#### Existing Table: `facility_closures` (one-off date closures)
Already exists and is used alongside holidays for date-specific closures.

#### Migration Needed: Add partial holiday support
```sql
ALTER TABLE facility_holidays ADD COLUMN is_partial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facility_holidays ADD COLUMN partial_close_time TIME;
ALTER TABLE facility_holidays ADD CONSTRAINT partial_requires_time CHECK (
  (is_partial = false AND partial_close_time IS NULL) OR
  (is_partial = true AND partial_close_time IS NOT NULL)
);
```

### Holiday Files Likely Involved

#### Existing (modify)
- `types/block-scheduling.ts` (modify — add `is_partial`, `partial_close_time` to `FacilityHoliday`)
- `hooks/useFacilityClosures.ts` (modify — partial holiday support in CRUD + isDateClosed)
- `app/settings/closures/PageClient.tsx` (modify — partial holiday toggle in dialog)
- `app/analytics/block-utilization/PageClient.tsx` (verify + fix — partial holiday hours)
- `components/block-schedule/WeekCalendar.tsx` (verify — holiday display labels)
- `components/block-schedule/RoomScheduleGrid.tsx` (verify — rooms closed on holidays)

#### New
- `supabase/migrations/YYYYMMDD_add_partial_holidays.sql` (new — add partial columns)
- `components/staff-management/HolidaysTab.tsx` (new — holidays + closures tab on Staff Management)

#### Time-Off Integration (modify)
- `lib/dal/time-off.ts` (modify — holiday-aware PTO calculation)
- `components/staff-management/TimeOffReviewModal.tsx` (modify — show holiday breakdown)
- `components/staff-management/TimeOffCalendarTab.tsx` (modify — show holidays on calendar)
- `components/staff-management/UserTimeOffSummary.tsx` (modify — holiday-adjusted totals)
- `hooks/useTimeOffRequests.ts` (modify — holiday-adjusted totals)

---

## Out of Scope
- Web staff dashboard (staff viewing own schedule on web)
- Shift management / shift patterns / auto-scheduling
- Swap requests between staff members
- Push notifications (in-app only)
- Time-off accrual / PTO balance tracking
- Coverage optimization / auto-fill suggestions
- Recurring holidays (admin creates manually each year)
- Holiday notifications to staff/surgeons

---

## Acceptance Criteria
- [ ] iOS staff/admin users see Home tab with today's room assignments
- [ ] When only room schedule exists: shows room + surgeon, "no cases" indicator
- [ ] When cases exist: shows full detail with milestones, team, status, duration
- [ ] Staff can submit time-off requests (type, dates, partial day, reason)
- [ ] Staff sees their recent requests with pending/approved/denied status
- [ ] Staff receives in-app notification when request is reviewed
- [ ] Web admin page shows staff directory with search, role filter, time-off totals
- [ ] Web admin page shows team-wide time-off calendar with color-coded requests
- [ ] Admin can approve/deny requests with optional notes
- [ ] Per-user time-off totals (by type, current year) visible to admin
- [ ] Admin can create/edit/delete facility holidays from Holidays tab
- [ ] Partial holidays supported (close at specified time)
- [ ] Block schedule hides surgeon blocks on holiday dates
- [ ] Room schedule shows rooms as closed on holiday dates
- [ ] Analytics exclude holiday dates from available hours calculations
- [ ] Time-off requests exclude holiday dates from PTO day counts
- [ ] Holiday breakdown shown to staff on request creation and admin on review
- [ ] All queries filter by facility_id (RLS compliance)
- [ ] Soft delete pattern followed for facility_holidays and time_off_requests
- [ ] No TypeScript `any` types introduced (web)
- [ ] No force unwraps (iOS)
- [ ] All tests pass
