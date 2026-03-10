# Implementation Plan: Room Schedule — Daily Room Board with Staff Assignments

## Summary

Add a "Room Schedule" tab to the Block Schedule page. The Room Schedule is a date-specific, navigable week view showing rooms (rows) x days (columns). Schedulers assign surgeons and staff to room-day cells via drag-and-drop from a sidebar. A clone feature copies assignments from a previous week/day. When creating a case, selecting a room + date auto-populates the surgeon and staff with a "From room schedule" badge. Multiple surgeons per room per day are supported (no time ranges — just listed).

## Interview Notes

| Decision | Answer |
|---|---|
| Surgeons per room per day | Multiple (no time ranges, just listed) |
| Grid layout | Navigable week view (prev/next like block schedule) |
| Staff interaction | Drag-and-drop from sidebar (dnd-kit, matching existing pattern) |
| Case form pre-fill UX | Pre-fill with "From room schedule" badge |
| Edit scope | Date-specific (not recurring templates) |
| Clone behavior | Clone day or whole week from previous week, overwrites target |
| Sidebar content | Surgeon list (with block-time badge) + staff pool grouped by role |
| Surgeon block-time indicator | Badge (blue dot / "Block" tag) on surgeons with block time that day |

## Data Model

### New Tables

**`room_date_assignments`** — one row per surgeon per room per date
```sql
CREATE TABLE room_date_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  or_room_id uuid NOT NULL REFERENCES or_rooms(id) ON DELETE CASCADE,
  assignment_date date NOT NULL,
  surgeon_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Unique: one surgeon can only be in one room per date
CREATE UNIQUE INDEX idx_rda_surgeon_date ON room_date_assignments(facility_id, surgeon_id, assignment_date);
-- Lookup: all assignments for a room on a date
CREATE INDEX idx_rda_room_date ON room_date_assignments(facility_id, or_room_id, assignment_date);
```

**`room_date_staff`** — staff assigned to a room-date slot
```sql
CREATE TABLE room_date_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_date_assignment_id uuid REFERENCES room_date_assignments(id) ON DELETE CASCADE,
  -- Allow staff assigned to room+date without a surgeon assignment
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  or_room_id uuid NOT NULL REFERENCES or_rooms(id) ON DELETE CASCADE,
  assignment_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES user_roles(id),
  created_at timestamptz DEFAULT now()
);
-- One staff member per room per date
CREATE UNIQUE INDEX idx_rds_staff_room_date ON room_date_staff(facility_id, user_id, assignment_date);
-- Lookup by room + date
CREATE INDEX idx_rds_room_date ON room_date_staff(facility_id, or_room_id, assignment_date);
```

**Design note:** `room_date_staff` has both `room_date_assignment_id` (nullable FK) and direct `or_room_id` + `assignment_date` columns. This allows staff to be assigned to a room even if no surgeon is assigned yet. The FK cascades deletes when a surgeon assignment is removed.

---

## Phases

### Phase 1: Database Migration + RLS
**What:** Create `room_date_assignments` and `room_date_staff` tables with RLS policies, indexes, and constraints.

**Files:**
- `supabase/migrations/YYYYMMDD_room_date_assignments.sql` (new)

**RLS pattern:** Follow `block_schedules` three-tier pattern:
- Global admins: full access
- Facility admins: manage own facility
- Users: SELECT own facility only

**Commit:** `feat(room-schedule): phase 1 - database migration for room date assignments`

**Test gate:**
1. Unit: Verify tables exist, constraints work (unique surgeon per date, cascade deletes)
2. Integration: Insert room assignments, query by room + date, verify RLS blocks cross-facility access
3. Workflow: Create room → assign surgeon → assign staff → delete surgeon → verify staff cascade

**Complexity:** Small

---

### Phase 2: Data Hook + Audit Logger
**What:** Create `useRoomDateAssignments` hook with CRUD operations and `roomScheduleAudit` logger. This is the data layer that all UI components will consume.

**Files:**
- `hooks/useRoomDateAssignments.ts` (new)
- `lib/audit-logger.ts` (add `roomScheduleAudit` section)
- `types/room-scheduling.ts` (new — interfaces for RoomDateAssignment, RoomDateStaff, etc.)

**Hook interface:**
```typescript
useRoomDateAssignments({ facilityId })
→ {
  assignments: RoomDateAssignment[]  // All assignments for current week
  staffAssignments: RoomDateStaff[]  // All staff for current week
  loading, error,
  fetchWeek(startDate, endDate),
  assignSurgeon(roomId, date, surgeonId),
  removeSurgeon(assignmentId),
  assignStaff(roomId, date, userId, roleId),
  removeStaff(staffId),
  cloneDay(sourceDate, targetDate),
  cloneWeek(sourceWeekStart, targetWeekStart),
}
```

**Commit:** `feat(room-schedule): phase 2 - data hook and audit logger`

**Test gate:**
1. Unit: Hook returns correct state, CRUD operations call Supabase correctly
2. Integration: Create assignments → fetch → verify data shape matches types
3. Workflow: Assign surgeon + staff → clone day → verify clone creates correct records

**Complexity:** Medium

---

### Phase 3: Tab Navigation on Block Schedule Page
**What:** Add tab switching between "Surgeon Blocks" and "Room Schedule" on the existing block schedule page. Room Schedule tab renders a placeholder initially.

**Files:**
- `app/block-schedule/PageClient.tsx` (add tab state + navigation)
- `components/block-schedule/BlockScheduleTabs.tsx` (new — inline tab component)

**Pattern:** Follow `CasesStatusTabs` inline tab pattern (buttons with `role="tab"`, active underline).

**Commit:** `feat(room-schedule): phase 3 - tab navigation on block schedule page`

**Test gate:**
1. Unit: Tab component renders both tabs, active state toggles
2. Integration: Clicking tabs switches content, URL doesn't change (client-side state)
3. Workflow: Navigate to /block-schedule → see Surgeon Blocks (default) → click Room Schedule → see placeholder → click back

**Complexity:** Small

---

### Phase 4: Room Schedule Grid Layout
**What:** Build the room schedule grid: rooms as rows, days of the week as columns, with week navigation (prev/next/today). Each cell is a droppable target. Week navigation reuses the same header pattern as the block schedule tab.

**Files:**
- `components/block-schedule/RoomScheduleGrid.tsx` (new — main grid)
- `components/block-schedule/RoomDayCell.tsx` (new — individual cell)
- `app/block-schedule/PageClient.tsx` (wire grid into Room Schedule tab)

**Layout:**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│          │  Sun 3/8 │  Mon 3/9 │ Tue 3/10 │ Wed 3/11│ Thu 3/12 │  Fri 3/13│
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  OR 1    │          │ Dr.Smith │          │ Dr.Smith │          │          │
│          │          │ Nurse J  │          │ Nurse J  │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  OR 2    │          │ Dr.Jones │          │          │          │          │
│          │          │ Tech B   │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Commit:** `feat(room-schedule): phase 4 - room schedule grid layout with week navigation`

**Test gate:**
1. Unit: Grid renders correct number of rows (rooms) and columns (days), week nav changes dates
2. Integration: Fetch rooms + assignments → grid populates cells correctly
3. Workflow: Navigate weeks → see assignments update → empty cells show drop targets

**Complexity:** Medium

---

### Phase 5: Sidebar — Surgeon List + Staff Pool
**What:** Build the Room Schedule sidebar with two sections: surgeons (with block-time badge indicator for the selected day) and staff pool grouped by role. Both are draggable sources. Mini calendar at top for week navigation.

**Files:**
- `components/block-schedule/RoomScheduleSidebar.tsx` (new)
- `components/block-schedule/DraggableSurgeonCard.tsx` (new)
- `components/block-schedule/DraggableStaffCard.tsx` (new)

**Sidebar sections:**
1. Mini calendar (reuse from BlockSidebar)
2. **Surgeons** — all active surgeons, with blue "Block" badge if they have block time on the focused day. Draggable.
3. **Staff** — grouped by role (Nurses, Techs, Anesthesiologists, etc.). Draggable.

**Commit:** `feat(room-schedule): phase 5 - sidebar with surgeon list and staff pool`

**Test gate:**
1. Unit: Sidebar renders surgeons and staff, block-time badge appears correctly
2. Integration: Fetch block schedules for current week → surgeons with matching blocks show badge
3. Workflow: Scroll through staff list → see role groupings → drag a staff card (drag preview appears)

**Complexity:** Medium

---

### Phase 6: Drag-and-Drop Integration
**What:** Wire up dnd-kit context: drag surgeons/staff from sidebar, drop into room-day cells. Handle assignment creation on drop. Show drag overlay, drop indicators, and feedback.

**Files:**
- `app/block-schedule/PageClient.tsx` (wrap Room Schedule tab in DndContext)
- `components/block-schedule/RoomDayCell.tsx` (add useDroppable)
- `components/block-schedule/DraggableSurgeonCard.tsx` (add useDraggable)
- `components/block-schedule/DraggableStaffCard.tsx` (add useDraggable)
- `components/block-schedule/RoomScheduleDragOverlay.tsx` (new — drag preview)
- `hooks/useRoomDateAssignments.ts` (called on drop)

**Drag data types:**
```typescript
interface SurgeonDragData { type: 'surgeon'; surgeonId: string; surgeon: SurgeonInfo }
interface StaffDragData { type: 'staff'; userId: string; roleId: string; user: StaffInfo }
interface RoomDayDropData { type: 'room-day'; roomId: string; date: string }
```

**Drop behavior:**
- Surgeon → room-day cell: calls `assignSurgeon(roomId, date, surgeonId)`
- Staff → room-day cell: calls `assignStaff(roomId, date, userId, roleId)`
- Already assigned: show toast "Already assigned to this room"

**Commit:** `feat(room-schedule): phase 6 - drag-and-drop surgeon and staff assignment`

**Test gate:**
1. Unit: Drag data types are correct, drop handler calls correct hook methods
2. Integration: Drag surgeon → drop on cell → assignment appears in cell → DB record created
3. Workflow: Drag surgeon to Room 1 Mon → drag 2 staff to same cell → see full assignment → drag surgeon to different room → first room updates

**Complexity:** Large

---

### Phase 7: Cell Interactions — Remove, Edit, Visual Polish
**What:** Add ability to remove surgeons/staff from cells (click X on badge), show empty state, visual indicators for assigned vs unassigned rooms, and staff role labels.

**Files:**
- `components/block-schedule/RoomDayCell.tsx` (enhance with remove buttons, empty state)
- `components/block-schedule/AssignedSurgeonBadge.tsx` (new — surgeon chip with remove)
- `components/block-schedule/AssignedStaffBadge.tsx` (new — staff chip with role + remove)
- `hooks/useRoomDateAssignments.ts` (remove methods)

**Cell states:**
- Empty: light gray background, "Drop here" hint on hover
- Has surgeon only: surgeon chip, "Add staff" hint
- Fully staffed: surgeon chip + staff badges with role labels

**Commit:** `feat(room-schedule): phase 7 - cell interactions and visual polish`

**Test gate:**
1. Unit: Remove button calls correct hook method, cell renders correct state per assignments
2. Integration: Assign → remove surgeon → verify cascade removes staff → cell returns to empty
3. Workflow: Build full room assignment → remove one staff → re-add → remove surgeon → cell empties

**Complexity:** Medium

---

### Phase 8: Clone Day / Clone Week
**What:** Add clone functionality — "Clone from previous week" button for entire week, and per-day clone (right-click or button on day header). Clone overwrites target.

**Files:**
- `components/block-schedule/RoomScheduleGrid.tsx` (add clone buttons to header)
- `components/block-schedule/CloneConfirmModal.tsx` (new — confirmation dialog)
- `hooks/useRoomDateAssignments.ts` (cloneDay, cloneWeek methods)

**Clone logic (in hook):**
1. Delete all assignments for target day/week
2. Fetch all assignments from source day/week
3. Insert copies with updated dates
4. Refresh grid

**UI:**
- Week header: "Clone from previous week" button (copies Sun-Sat of previous week to current week)
- Day header: "Clone from last [Monday]" link/button (copies that day from previous week)
- Confirmation modal: "This will replace all assignments for [target]. Continue?"

**Commit:** `feat(room-schedule): phase 8 - clone day and week from previous week`

**Test gate:**
1. Unit: Clone methods calculate correct source/target dates, delete + insert sequence is correct
2. Integration: Set up week 1 → clone to week 2 → verify all assignments copied → verify week 1 unchanged
3. Workflow: Build week 1 → navigate to week 2 → clone week → modify one cell → clone single day from week 1 → verify only that day reverted

**Complexity:** Medium

---

### Phase 9: Case Form Pre-Fill from Room Schedule
**What:** When creating/editing a case, selecting a room + date queries `room_date_assignments` and `room_date_staff` for that room+date. Pre-fills surgeon and staff with "From room schedule" badge. User can modify freely.

**Files:**
- `components/cases/CaseForm.tsx` (add pre-fill logic in room/date change handler)
- `components/cases/StaffMultiSelect.tsx` (add badge support for pre-filled items)
- `lib/dal/room-schedule.ts` (new — DAL function to fetch assignments for room+date)

**Pre-fill logic:**
```typescript
// In CaseForm, when or_room_id or scheduled_date changes:
const assignments = await fetchRoomDateAssignments(roomId, date)
if (assignments.surgeons.length > 0 && !formData.surgeon_id) {
  setFormData({ ...formData, surgeon_id: assignments.surgeons[0].id })
}
if (assignments.staff.length > 0 && selectedStaff.length === 0) {
  setSelectedStaff(assignments.staff.map(s => ({
    user_id: s.user_id, role_id: s.role_id, fromRoomSchedule: true
  })))
}
```

**Badge:** Staff items with `fromRoomSchedule: true` show a small blue "Room schedule" tag. Badge disappears if user manually changes the selection.

**Commit:** `feat(room-schedule): phase 9 - case form pre-fill from room schedule`

**Test gate:**
1. Unit: Pre-fill function returns correct data shape, badge renders on pre-filled items
2. Integration: Create room assignment → open case form → select same room + date → verify pre-fill
3. Workflow: Set Room 3 Monday with Dr. Smith + Nurse Jane → create case for Room 3 on Monday → see pre-fill with badges → change surgeon → badge remains on staff → save case → verify case_staff records

**Complexity:** Medium

---

### Phase 10: Final Polish + Edge Cases
**What:** Handle edge cases, keyboard accessibility, loading states, error boundaries, and empty states. Ensure drag-and-drop has keyboard fallback (click-to-assign via dropdown in cell).

**Files:**
- Various component files from previous phases
- `components/block-schedule/RoomDayCell.tsx` (add click-to-assign fallback)

**Edge cases:**
- Room is closed on a day (from room_schedules) → gray out cell, prevent drops
- Surgeon already assigned to different room on same date → show warning, prevent duplicate
- Staff already assigned to different room on same date → show warning, prevent duplicate
- No rooms configured → show "Configure rooms in Settings" link
- No staff in facility → show "Add staff in Settings" link

**Commit:** `feat(room-schedule): phase 10 - polish, accessibility, and edge cases`

**Test gate:**
1. Unit: Closed rooms reject drops, duplicate assignment prevention works
2. Integration: Assign surgeon to Room 1 → try to assign same surgeon to Room 2 same date → see warning
3. Workflow: Full end-to-end: create rooms → define block schedule → build room schedule → clone week → create case with pre-fill → verify all data flows

**Complexity:** Medium

---

## Phase Summary

| Phase | Description | Complexity | Dependencies |
|-------|-------------|------------|--------------|
| 1 | Database migration + RLS | Small | None |
| 2 | Data hook + audit logger | Medium | Phase 1 |
| 3 | Tab navigation | Small | None |
| 4 | Room schedule grid layout | Medium | Phase 2, 3 |
| 5 | Sidebar — surgeons + staff pool | Medium | Phase 2 |
| 6 | Drag-and-drop integration | Large | Phase 4, 5 |
| 7 | Cell interactions — remove, edit, polish | Medium | Phase 6 |
| 8 | Clone day / clone week | Medium | Phase 7 |
| 9 | Case form pre-fill | Medium | Phase 2 |
| 10 | Final polish + edge cases | Medium | Phase 7, 9 |

**Total: 10 phases** (1 small + 1 large + 8 medium)

**Parallelizable:** Phases 3+5 can run in parallel (no file overlap). Phase 9 can start after Phase 2 (independent of grid UI).
