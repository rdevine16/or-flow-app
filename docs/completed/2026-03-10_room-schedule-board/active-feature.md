# Feature: Room Schedule — Daily Room Board with Staff Assignments

## Goal
Add a "Room Schedule" tab to the existing Block Schedule page that lets schedulers assign surgeons and staff to rooms by day of week. This gives simpler facilities a complete product (staff know where they're working each day) while also feeding into case creation for full facilities (selecting a room auto-populates surgeon and staff). Phase 2 (future) adds PTO/day-off tracking with scheduling conflict detection.

## Requirements
1. New tab on Block Schedule page: "Room Schedule" alongside existing "Surgeon Blocks"
2. Room Schedule layout: days of week across top, rooms down the left side
3. Surgeons with block time on a given day auto-appear as available for assignment
4. Non-block surgeons can be manually added to rooms (ad-hoc / add-on days)
5. Staff can be dragged or assigned to room-day slots (same roles as case_staff)
6. When creating a case: selecting a room + date pre-fills surgeon and staff from the room schedule template
7. Pre-filled values are suggestions, not constraints — user can override
8. Recurring weekly template (day-of-week based), no date-specific overrides in phase 1

## Database Context
- Table: `block_schedules` — surgeon availability by day of week (no room association)
- Table: `or_rooms` — facility rooms with operating hours
- Table: `room_schedules` — existing room open/close hours per day of week
- Table: `case_staff` — staff assigned to individual cases (role-based)
- Table: `user_roles` — role definitions (circulating nurse, scrub tech, anesthesiologist, etc.)
- NEW Table: `room_day_assignments` — surgeon + room + day_of_week template
- NEW Table: `room_day_staff` — staff assigned to room-day slots

## UI/UX
- Route: /block-schedule (existing page, add tab navigation)
- Tab 1: "Surgeon Blocks" — existing WeekCalendar view (unchanged)
- Tab 2: "Room Schedule" — grid with rooms (rows) x days of week (columns)
  - Each cell shows assigned surgeon + staff list
  - Drag-and-drop staff into room-day cells
  - Sidebar shows available surgeons (from block schedule) and staff pool
- Case form: on room selection, query room_day_assignments for pre-fill

## Files Likely Involved
- `app/block-schedule/PageClient.tsx` — add tab navigation
- `components/block-schedule/` — new RoomScheduleGrid, RoomDayCell components
- `hooks/useBlockSchedules.ts` — reference for patterns
- `hooks/useRoomSchedules.ts` — existing room schedule hook (operating hours)
- NEW `hooks/useRoomDayAssignments.ts` — CRUD for room-day assignments + staff
- `components/cases/CaseForm.tsx` — add pre-fill logic on room selection
- `lib/dal/` — potential DAL functions for room assignments
- `supabase/migrations/` — new tables, RLS policies

## iOS Parity
- [ ] iOS equivalent needed (Phase 2 — display-only "My Schedule" view)
- [x] iOS can wait for initial web implementation

## Known Issues / Constraints
- `block_schedules` has no `or_room_id` — room assignment is intentionally separate
- `room_schedules` (126 rows) is for room operating hours, not staff — different concept
- Drag-and-drop needs accessible fallback (dropdown/multi-select)
- Essential tier facilities use this as their primary product; must work without case management

## Out of Scope (Phase 1)
- Date-specific overrides (e.g., "this Monday only" exceptions)
- PTO / day-off tracking and scheduling conflicts
- iOS display
- Notifications for schedule changes
- Print/export of room board

## Acceptance Criteria
- [ ] Tab navigation between "Surgeon Blocks" and "Room Schedule" on /block-schedule
- [ ] Room Schedule grid: rooms (rows) x days of week (columns)
- [ ] Surgeons with block time auto-appear as assignable for their block days
- [ ] Non-block surgeons can be manually assigned to room-day slots
- [ ] Staff can be assigned to room-day slots via drag-and-drop or multi-select
- [ ] Case form pre-fills surgeon + staff when room + date are selected
- [ ] Pre-filled values are editable (not locked)
- [ ] RLS policies enforce facility scoping on new tables
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
