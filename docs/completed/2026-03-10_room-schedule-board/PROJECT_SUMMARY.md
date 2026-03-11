# Project: Room Schedule — Daily Room Board with Staff Assignments
**Completed:** 2026-03-10
**Branch:** feature/room-schedule-board
**Duration:** 2026-03-10 → 2026-03-10
**Total Phases:** 10 + post-phase polish

## What Was Built
A "Room Schedule" tab on the Block Schedule page that provides a navigable weekly grid view of rooms (rows) x days (columns). Schedulers assign surgeons and staff to room-day cells via drag-and-drop from a sidebar. The sidebar shows all facility surgeons (with block-time day badges) and staff grouped by role. A clone feature copies assignments from a previous week or individual day.

When creating a case, selecting a room + date auto-populates the surgeon and staff with a "From room schedule" badge, providing seamless workflow from scheduling to case creation. The feature supports multiple surgeons per room per day, keyboard-accessible click-to-assign fallback, closed room detection, and PDF export of the weekly room schedule.

Role badges use a shared styling module (`roleStyles.ts`) with consistent color-coding across the UI and PDF export: nurses (emerald), scrub techs (violet), anesthesiologists (amber), PAs (sky), first assists (teal), and device reps (orange).

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Database migration + RLS | c99f9dd |
| 2     | Data hook + audit logger | c9f7e19 |
| 3     | Tab navigation on block schedule page | 75313ec |
| 4     | Room schedule grid layout with week navigation | 5661c87 |
| 5     | Sidebar with surgeon list and staff pool | 38554de |
| 6     | Drag-and-drop surgeon and staff assignment | 4893672 |
| 7     | Cell interactions and visual polish | 6b3785a |
| 8     | Clone day and week from previous week | a123a39 |
| 9     | Case form pre-fill from room schedule | 57ccdf7 |
| 10    | Polish, accessibility, and edge cases | 30b10fa |
| Post  | Role styles, PDF export, multi-room support | be4bd14 |

## Key Files Created/Modified
### New Files
- `components/block-schedule/RoomScheduleGrid.tsx` — Main grid component (rooms x days)
- `components/block-schedule/RoomDayCell.tsx` — Individual cell with surgeon/staff badges
- `components/block-schedule/RoomScheduleSidebar.tsx` — Sidebar with mini calendar, surgeons, staff pool
- `components/block-schedule/DraggableSurgeonCard.tsx` — Draggable surgeon card with block-day badges
- `components/block-schedule/DraggableStaffCard.tsx` — Draggable staff card with role badge
- `components/block-schedule/AssignedSurgeonBadge.tsx` — Surgeon chip in cell with remove button
- `components/block-schedule/AssignedStaffBadge.tsx` — Staff chip with colored role badge
- `components/block-schedule/RoomScheduleDragOverlay.tsx` — Drag preview overlay
- `components/block-schedule/AssignPersonDialog.tsx` — Click-to-assign dialog (accessibility fallback)
- `components/block-schedule/CloneConfirmModal.tsx` — Clone confirmation dialog
- `hooks/useRoomDateAssignments.ts` — CRUD hook for room-date assignments
- `types/room-scheduling.ts` — TypeScript interfaces for room scheduling
- `lib/roleStyles.ts` — Shared role color/abbreviation mapping (UI + PDF)
- `lib/exportRoomSchedulePdf.ts` — PDF export utility for weekly room schedule
- `lib/dal/room-schedule.ts` — DAL functions for room assignment queries

### Modified Files
- `app/block-schedule/PageClient.tsx` — Tab navigation, DnD context, Room Schedule tab
- `components/cases/CaseForm.tsx` — Pre-fill surgeon/staff from room schedule
- `components/cases/StaffMultiSelect.tsx` — "From room schedule" badge support

### Test Files
- `components/block-schedule/__tests__/AssignedStaffBadge.test.tsx`
- `components/block-schedule/__tests__/AssignedSurgeonBadge.test.tsx`
- `components/block-schedule/__tests__/DraggableSurgeonCard.test.tsx`
- `components/block-schedule/__tests__/RoomDayCell.test.tsx`
- `components/block-schedule/__tests__/RoomScheduleGrid.test.tsx`
- `components/block-schedule/__tests__/RoomScheduleGrid-integration.test.tsx`
- `components/block-schedule/__tests__/RoomScheduleSidebar.test.tsx`
- `components/block-schedule/__tests__/clone-workflow.test.tsx`
- `components/block-schedule/__tests__/AssignPersonDialog.test.tsx`

## Architecture Decisions
- **Date-specific, not template-based:** Assignments are per-date (not day-of-week templates) to give maximum flexibility. Clone feature makes recurring patterns easy to replicate.
- **Decoupled from block_schedules:** Room assignments are independent of block schedules. Block-time badges are informational only — surgeons without blocks can still be assigned.
- **Staff can exist without surgeon:** `room_date_staff` has direct room+date columns alongside optional FK to `room_date_assignments`, so staff can be assigned to a room even before a surgeon is.
- **Shared roleStyles module:** Centralized color/abbreviation mapping ensures consistency between UI badges and PDF export.
- **Multi-room surgeons allowed:** Initially had unique constraint (one room per surgeon per day), relaxed via migration to support surgeons working in multiple rooms on the same date.
- **Click-to-assign fallback:** AssignPersonDialog provides keyboard-accessible alternative to drag-and-drop.

## Database Changes
### New Tables
- `room_date_assignments` — surgeon per room per date (with RLS)
- `room_date_staff` — staff per room per date with role (with RLS)

### Migrations
- `supabase/migrations/*_room_date_assignments.sql` — Phase 1: tables, indexes, RLS policies
- `supabase/migrations/20260311013220_allow_multi_room_surgeon_assignments.sql` — Post-phase: relax unique constraint to allow multi-room assignments

### Indexes
- `idx_rda_room_date` — fast lookup by facility + room + date
- `idx_rds_staff_room_date` — fast lookup for staff by facility + room + date

## Known Limitations / Future Work
- **No PTO/day-off tracking** — deferred to Phase 2
- **No date-specific overrides** — clone + manual edit is the current workflow
- **No notifications** for schedule changes
- **iOS display-only view** — "My Schedule" view for iOS deferred
- **No time ranges** — surgeons are listed per room per day without specific time slots
- **PDF export** is basic (no print-preview, no landscape auto-detection)
