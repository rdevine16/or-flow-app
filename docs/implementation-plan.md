# Implementation Plan: Case Detail Page V2 Redesign

> **Feature branch:** `feature/case-detail-v2`
> **Reference mockup:** `Examples/case-details-v2.jsx`
> **Current file:** `app/cases/[id]/page.tsx` (~1690 lines)
> **Approach:** Incremental rewrite — restructure layout first, then replace sections one at a time

---

## Context & Goals

The current case detail page (`/cases/[id]`) uses a "command center" design with dark-gradient timer cards, a milestone card grid, and a cluttered sidebar. The v2 mockup introduces:

- A clean two-column layout (main + sidebar)
- Light-themed timer chips with progress bars vs median
- A vertical milestone timeline (replaces the card grid)
- Inline delay logging and flag display per milestone
- A tabbed view with Milestones and Implants tabs
- Implant editing directly on the page (not just display badges)
- A streamlined sidebar with a Case Activity summary

### Key Clarifications

**Flags:** Two types exist in `case_flags`:
- **System threshold flags** — auto-detected by `flagEngine.ts` (e.g., long turnover). These are read-only and display as badges on the associated milestone.
- **User delay flags** — manually reported via inline form. These use `delay_types` (facility-specific lookup) and write to `case_flags` with `flag_type = 'delay'`.

**Implants:** The existing `ImplantSection.tsx` component handles implant data entry (auto-save, brand + templated/final size fields for hip/knee components). It needs to be integrated as a tab in the main content area so users can add/edit implants directly from the case detail page.

---

## Phase 1: Layout Restructure & Case Header

**Goal:** Change the page layout from 3-column grid to a 2-column layout (main + ~330px sidebar). Replace the QuickInfo card with an inline case header matching the mockup.

### Files to Modify

- `app/cases/[id]/page.tsx` — Restructure grid, rewrite header section

### Steps

1. **Restructure the main grid:**
   - Current: `grid-cols-1 lg:grid-cols-3` with timers spanning 2 cols + QuickInfo in 1 col, then milestones in 2 cols + sidebar in 1 col
   - New: Single `grid grid-cols-[1fr_330px]` wrapper. Left = main content area (header, timers, tabs, content). Right = sidebar.
   - Keep `DashboardLayout` wrapper (we're not changing nav)

2. **Build the inline case header:**
   - Layout: Left side has procedure name (h1, ~21px, bold), status pill, flag count badge, delay count badge — all on one line
   - Below: metadata row with case number chip (mono font, muted bg), room, side, surgeon, start time, case sequence ("Case 1 of 4")
   - Dots between metadata items
   - Remove the separate QuickInfo card entirely

3. **Create `StatusPill` component (or reuse `StatusBadgeDot`):**
   - Match mockup style: colored dot + text in a rounded pill
   - States: Scheduled (indigo), In Progress (green, pulsing dot), Completed (gray)

4. **Move "back to cases" link:**
   - Current: ChevronLeft inside the QuickInfo card
   - New: Keep as a subtle back link or browser-native behavior (the DashboardLayout sidebar already has Cases nav)

5. **Run 3-stage test gate**

### Acceptance

- [ ] Page uses 2-column layout (main + 330px sidebar)
- [ ] Case header shows: procedure name, status pill, flag/delay counts, metadata row
- [ ] QuickInfo card removed
- [ ] All existing functionality still works (record milestones, etc.)
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 1 - layout restructure and case header`

---

## Phase 2: Timer Chips

**Goal:** Replace dark-gradient timer cards with light-themed TimerChip components. Add a Progress chip.

### Files to Create

- `components/cases/TimerChip.tsx` — Reusable light-themed timer with progress bar

### Files to Modify

- `app/cases/[id]/page.tsx` — Replace timer card section

### Steps

1. **Build `TimerChip` component:**
   - Props: `label`, `seconds` (or `formattedTime`), `medianFormatted`, `isRunning`, `color` (indigo/cyan)
   - Layout: label (uppercase, tiny), large time display (mono font, tabular-nums), "/ median" suffix
   - Below: thin progress bar showing ratio of actual vs median
   - Progress bar colors: normal = color prop, >85% = amber, >100% = red
   - Running indicator: small pulsing green dot next to label
   - Background: subtle gradient tint of the color prop (`{color}08` → `{color}03`)
   - Border: 1px solid `{color}15`, rounded-xl

2. **Build Progress chip:**
   - Shows completion percentage (large number) + "%" suffix
   - Below: "N/M milestones" text
   - Green-tinted background
   - No progress bar needed

3. **Replace timer section in page:**
   - Current: Two dark `bg-gradient-to-br from-slate-800` cards + PaceProgressBar
   - New: Three TimerChips in a row: Total Time (indigo), Surgical Time (cyan), Progress (green)
   - Remove PaceProgressBar component usage
   - Keep the existing time calculation logic (totalTimeMs, surgicalTimeMs) — just change the display

4. **Run 3-stage test gate**

### Acceptance

- [ ] Three timer chips render: Total Time, Surgical Time, Progress
- [ ] Progress bars show ratio vs median, color changes at thresholds
- [ ] Running indicator pulses for active timers
- [ ] Dark timer cards and PaceProgressBar removed
- [ ] Time calculations unchanged (same values, new display)
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 2 - light timer chips with progress bars`

---

## Phase 3: Milestone Timeline

**Goal:** Replace the milestone card grid with a vertical timeline. Each milestone is a row with a connected node, name, recorded time, and action buttons.

### Files to Create

- `components/cases/MilestoneTimelineV2.tsx` — Vertical timeline component for the case detail page

### Files to Modify

- `app/cases/[id]/page.tsx` — Replace milestone grid with timeline

### Steps

1. **Build `MilestoneTimelineV2` component:**
   - Props: milestones array (with type info + recorded data), callbacks (onRecord, onUndo), loading state, permissions
   - Layout: vertical list, each milestone is a flex row with:
     - **Left column (40px):** Timeline track — circle node + vertical connecting line
     - **Right column:** Milestone name, recorded time, action buttons

2. **Node states:**
   - **Completed:** Green filled circle (bg-emerald-500) with white checkmark SVG
   - **Next (first pending):** Larger indigo circle with pulsing white dot center, indigo box-shadow glow
   - **Pending:** Dashed-border gray circle with tiny gray dot center

3. **Connecting lines:**
   - Between completed nodes: solid green line
   - Between completed → next: gradient from green to gray
   - Between pending nodes: faint gray line (`rgba(148,163,184,0.1)`)

4. **Content per milestone:**
   - **Completed:** Name (medium weight, dark), recorded time (mono font, muted)
   - **Next:** Name (bold, dark indigo), "Next milestone — ready to record" subtitle in indigo
   - **Next** gets a highlighted container (indigo tint bg, subtle border)
   - **Pending:** Name (light weight, gray)

5. **Action buttons (appear on hover or always for "next"):**
   - **Record button** (next milestone): Primary gradient button "Record" with record icon
   - **Record button** (other pending, on hover): Ghost outline button "Record"
   - **Undo button** (completed, on hover): Amber icon button with undo SVG

6. **Wire into page:**
   - Replace the `milestoneCards.map()` grid with `MilestoneTimelineV2`
   - Pass existing `recordMilestone`, `undoMilestone` callbacks
   - Keep milestone order confirmation dialog (out-of-order warning)
   - Keep optimistic updates and debounce protection

7. **Keep existing milestone data flow:**
   - `milestoneTypes` (config) + `caseMilestones` (recorded) stay as-is
   - Remove `MilestoneCard` import and `milestoneCards` computation (no longer needed)
   - Keep the paired milestone logic if still relevant, or simplify to single-milestone rows

8. **Run 3-stage test gate**

### Acceptance

- [ ] Vertical timeline renders all milestones with correct node states
- [ ] Connecting lines change color based on completion
- [ ] "Next" milestone highlighted with primary Record button
- [ ] Completed milestones show time and undo on hover
- [ ] Pending milestones show ghost Record on hover
- [ ] Out-of-order milestone warning still works
- [ ] Optimistic updates and debounce protection preserved
- [ ] MilestoneCard grid completely replaced
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 3 - vertical milestone timeline`

---

## Phase 4: Inline Flags & Delay Logging

**Goal:** Display flags and delays inline on the milestone timeline. Add per-milestone delay logging via popover form.

### Files to Create

- `components/cases/DelayNode.tsx` — Inline delay display in timeline (dashed-border node between milestones)
- `components/cases/AddDelayForm.tsx` — Popover form for logging a delay (reason, duration, note)
- `components/cases/FlagBadge.tsx` — Inline flag badge on milestone row

### Files to Modify

- `components/cases/MilestoneTimelineV2.tsx` — Add flag badges, delay nodes, and delay/flag action buttons
- `app/cases/[id]/page.tsx` — Fetch flags and delays for the case, pass to timeline

### Steps

1. **Fetch flags and delays:**
   - Add a query in `fetchData()` to load `case_flags` for this case
   - Include `delay_types` join for delay flag display names
   - Group flags by associated milestone (need to determine how flags map to milestones — may need `milestone_id` on `case_flags` or map by timestamp proximity)

2. **Build `FlagBadge` component:**
   - Display system-generated threshold flags as small severity-colored badges on the milestone row
   - Props: `severity`, `label` (flag rule name), `onRemove` (optional, only for user-created)
   - Colors: critical = red, warning = amber, info = blue

3. **Build `DelayNode` component:**
   - Appears between milestones in the timeline
   - Shows: delay type icon/emoji, delay type label, duration ("15m"), optional note
   - Timeline node: amber circle with clock icon, amber dashed connecting line
   - Removable via X button (for user-created delays only)

4. **Build `AddDelayForm` component:**
   - Popover content (reuse the Popover pattern from existing UI or use Radix Popover)
   - Grid of delay type buttons (from `delay_types` table)
   - Duration input (minutes)
   - Note input (optional text)
   - "Log Delay" submit button
   - On submit: write to `case_flags` with `flag_type = 'delay'`, `delay_type_id`, `duration_minutes`, `note`

5. **Add action buttons to timeline milestones:**
   - Flag icon button: Shows popover or badge for existing flags
   - Clock icon button (completed/next milestones): Opens AddDelayForm popover
   - Buttons appear on hover alongside existing Record/Undo buttons

6. **Wire into timeline:**
   - After each milestone row, render any delays associated with that milestone
   - On milestone rows, render flag badges inline after the milestone name
   - State management: delays and flags in page state, update on create/remove

7. **Remove `CaseFlagsSection` from sidebar** (delay logging moves to timeline)

8. **Run 3-stage test gate**

### Acceptance

- [ ] System threshold flags display as colored badges on milestone rows
- [ ] User delay flags display as DelayNode between milestones
- [ ] AddDelayForm popover works: select type, enter duration, submit
- [ ] Delays write to `case_flags` table correctly
- [ ] Delay removal works for user-created delays
- [ ] CaseFlagsSection removed from sidebar
- [ ] Delay types loaded from `delay_types` table (facility-specific)
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 4 - inline flags and delay logging`

---

## Phase 5: Tab Switcher & Implant Panel

**Goal:** Add a tab system (Milestones | Implants) above the main content area. Integrate the existing `ImplantSection` component so users can add/edit implants directly.

### Files to Modify

- `app/cases/[id]/page.tsx` — Add tab state, tab bar UI, conditionally render milestone timeline or implant panel
- `components/cases/ImplantSection.tsx` — Minor adjustments if needed for standalone context (currently may assume an edit page context)

### Steps

1. **Add tab state:**
   - `const [activeTab, setActiveTab] = useState<'milestones' | 'implants'>('milestones')`

2. **Build tab bar:**
   - Two tab buttons: "Milestones" and "Implants"
   - Active tab: white bg, border, shadow, bold text
   - Inactive tab: transparent, muted text
   - Implants tab: show count badge when implants have data (e.g., "3" in cyan)
   - Milestones tab: progress dots on the right (one per milestone, colored by status)

3. **Milestones tab content:**
   - Render the MilestoneTimelineV2 (from Phase 3) wrapped in a white card
   - This is the default tab

4. **Implants tab content:**
   - Render the existing `ImplantSection` component
   - Pass: `caseId`, `procedureTypeId`, implant category detection
   - ImplantSection already auto-saves — no additional save button needed
   - If no implant category (procedure doesn't track implants): show empty state "This procedure type doesn't track implants"
   - If implant category exists: show the full editing form (brand, templated size, final size per component)

5. **Update implant data flow:**
   - Currently the page fetches `case_implants` and `implantCategory` but only displays `ImplantBadge` in sidebar
   - Remove `ImplantBadge` from sidebar
   - Pass `implants` and `implantCategory` to the implants tab content
   - ImplantSection handles its own data fetching/saving internally — verify it works in this context

6. **Run 3-stage test gate**

### Acceptance

- [ ] Tab bar renders with Milestones (default) and Implants tabs
- [ ] Tab switching works correctly
- [ ] Progress dots show milestone completion status
- [ ] Implant count badge shows on Implants tab when data exists
- [ ] ImplantSection renders and allows editing implant data
- [ ] Auto-save works for implant changes
- [ ] Procedures without implant_category show appropriate empty state
- [ ] ImplantBadge removed from sidebar
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 5 - tab switcher and implant editing panel`

---

## Phase 6: Sidebar Cleanup & Case Activity

**Goal:** Streamline the sidebar to match the mockup. Remove sections that moved elsewhere, add a Case Activity summary card.

### Files to Create

- `components/cases/CaseActivitySummary.tsx` — Summary card showing milestone/implant/delay/flag counts

### Files to Modify

- `app/cases/[id]/page.tsx` — Restructure sidebar sections

### Steps

1. **Build `CaseActivitySummary` component:**
   - 4 rows: Milestones (N/M), Implants (N/M), Delays (count), Flags (count)
   - Each row: label (left, muted) + value (right, mono font, bold)
   - Delay count: amber text when > 0
   - Flag count: red text when > 0
   - Card with border, rounded

2. **Restructure sidebar order (top to bottom):**
   - Flip Room card (keep existing `FlipRoomCard`, conditional)
   - Next same-room case note (keep existing, conditional)
   - Surgeon Status (keep existing)
   - Team section (keep existing, minor style updates)
   - Case Activity Summary (new)
   - Notes section (keep if case has notes)

3. **Remove from sidebar:**
   - `DeviceRepSection` (tray tracking — out of scope for v2, or move to a future tab)
   - `ImplantBadge` grid (moved to Implants tab in Phase 5)
   - `CaseFlagsSection` (moved to inline timeline in Phase 4)

4. **Style updates for Team section:**
   - Add colored avatar circles with initials (match mockup)
   - Role displayed on the right side of each row in role-appropriate color
   - Keep add/remove staff functionality

5. **Run 3-stage test gate**

### Acceptance

- [ ] Case Activity Summary card shows accurate counts
- [ ] Sidebar order matches: Flip Room → Surgeon Status → Team → Activity → Notes
- [ ] DeviceRepSection, ImplantBadge, CaseFlagsSection removed from sidebar
- [ ] Team section has colored avatars with initials
- [ ] Add/remove staff still works
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 6 - sidebar cleanup and case activity summary`

---

## Phase 7: Completed Case View & Cleanup

**Goal:** Handle the completed case state, remove unused components/imports, and clean up the page.

### Files to Modify

- `app/cases/[id]/page.tsx` — Unify completed/active views or update completed rendering
- Various component files — Remove unused imports

### Steps

1. **Decide on completed case view:**
   - Option A: Unify — completed cases use the same timeline (all nodes green, no action buttons, times locked)
   - Option B: Keep separate `CompletedCaseView` but restyle to match v2 layout
   - **Recommendation: Option A** — the timeline works for both states, just disable interactions

2. **Completed case adjustments:**
   - All timeline nodes show as completed (green checkmarks)
   - No Record/Undo buttons
   - Timer chips show final values (not ticking)
   - No "next milestone" highlighting
   - Flags/delays are read-only (no add buttons)
   - Implants tab: read-only mode (ImplantSection supports this)

3. **Remove unused imports and components:**
   - Remove `PiPMilestoneWrapper` / `PiPButton` import and usage
   - Remove `FloatingActionButton` import and usage
   - Remove `CallNextPatientModal` import and usage
   - Remove `PaceProgressBar` import (already done in Phase 2)
   - Remove `MilestoneCard` import (already done in Phase 3)
   - Remove `ImplantBadge` import (already done in Phase 5/6)
   - Clean up any unused state variables

4. **Handle IncompleteCaseModal:**
   - Keep this — it's important for data quality (prompts users to fill missing fields)
   - Ensure it still renders correctly over the new layout

5. **Run 3-stage test gate**

### Acceptance

- [ ] Completed cases render using the same timeline (read-only mode)
- [ ] No Record/Undo buttons on completed cases
- [ ] Timers show final values without ticking
- [ ] PiP, FAB, CallNextPatientModal fully removed
- [ ] No unused imports remain
- [ ] IncompleteCaseModal still works
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 7 - completed view unification and cleanup`

---

## Phase 8: Polish & Accessibility

**Goal:** Add animations, loading states, accessibility attributes, and handle edge cases.

### Steps

1. **Animations (CSS only):**
   - Timeline nodes: staggered fade-in on mount (50ms delay per node)
   - Timer chips: slide-in from left on mount
   - Tab content: fade transition on switch
   - Progress bar: smooth width transition (1s linear)
   - Delay node: slide-in animation when added

2. **Loading states:**
   - Skeleton for case header (title bar + metadata pills)
   - Skeleton for timer chips (3 rectangular placeholders)
   - Skeleton for timeline (vertical line + circle placeholders)
   - Tab-level: only active tab's content loads

3. **Accessibility:**
   - Timeline nodes: `aria-label="{name} milestone, {status}, recorded at {time}"`
   - Timer chips: `aria-label="{label}: {time}, median {median}"`
   - Progress bar: `role="progressbar"` with `aria-valuenow`, `aria-valuemax`
   - Tab bar: `role="tablist"`, `role="tab"`, `aria-selected`
   - Record button: `aria-label="Record {milestone name}"`
   - Color never the only indicator — status uses icons + text alongside color

4. **Edge cases:**
   - Zero milestones configured: "No milestones configured" empty state
   - No surgeon assigned: Timer chips show "—" for median, no variance display
   - No procedure assigned: Implant tab disabled with message
   - Case with only 1 milestone: Timeline renders single node without lines
   - Very long milestone names: truncate with ellipsis

5. **Responsive behavior:**
   - Below lg breakpoint: stack to single column (sidebar below main)
   - Timer chips: flex-wrap to stack on narrow screens
   - Timeline: always vertical, no special narrow handling needed

6. **Run 3-stage test gate**

### Acceptance

- [ ] Animations smooth (60fps, no layout shifts)
- [ ] Loading skeletons match content shapes
- [ ] Screen reader can navigate all interactive elements
- [ ] Color-blind safe: all statuses readable without color alone
- [ ] Edge cases handled gracefully
- [ ] Responsive layout works on all breakpoints
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 8 - polish and accessibility`

---

## Phase 9: Integration Testing

**Goal:** Verify the full page works correctly across all case states, procedure types, and data scenarios.

### Steps

1. **Test matrix — Case states:**
   | Scenario | Expected |
   |----------|----------|
   | Scheduled case, 0 milestones | Header shows "Scheduled", timers at 0:00:00, empty timeline |
   | In-progress, 3/8 milestones | Active timers, partial timeline, "next" highlighted |
   | In-progress with delays logged | Delay nodes visible between milestones |
   | In-progress with system flags | Flag badges on flagged milestones |
   | Completed case, all milestones | Read-only timeline, final times, no action buttons |
   | Completed case, 2 missing milestones | Missing shown as pending (gray), flag if applicable |
   | Case with no surgeon | Medians unavailable, timer shows time only |
   | Case with no procedure | Implants tab disabled, no implant category |
   | Incomplete case (missing required fields) | IncompleteCaseModal shows |

2. **Test matrix — Implants tab:**
   | Scenario | Expected |
   |----------|----------|
   | Hip procedure | Cup, Stem, Head, Liner fields |
   | Knee procedure | Femur, Tibia, Poly, Patella fields |
   | Non-implant procedure | "No implants for this procedure" empty state |
   | Edit and save | Auto-save works, data persists on reload |

3. **Test matrix — Sidebar:**
   | Scenario | Expected |
   |----------|----------|
   | Surgeon with flip room case | FlipRoomCard shows, call-back works |
   | No flip room | FlipRoomCard hidden |
   | Staff management | Add/remove staff works |
   | Surgeon left | Surgeon Status reflects correctly |

4. **Cross-feature consistency:**
   - Timer values match milestone timestamps
   - Case Activity summary counts match actual data
   - Milestone count matches timeline node count

5. **Performance:**
   - Page load < 2s
   - Milestone record < 500ms perceived (optimistic update)
   - Tab switch instant (no data refetch needed)
   - Delay logging < 1s

### Acceptance

- [ ] All test matrix scenarios pass
- [ ] Cross-feature data consistent
- [ ] Performance meets thresholds
- [ ] No console errors or warnings
- [ ] Run `npm run typecheck && npm run lint && npm run test`

**Commit:** `feat(case-detail): phase 9 - integration testing`

---

## Phase Map

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| Phase 1 | Layout restructure & case header | 1 session | None |
| Phase 2 | Timer chips | 1 session | Phase 1 |
| Phase 3 | Milestone timeline | 1-2 sessions | Phase 1 |
| Phase 4 | Inline flags & delay logging | 1-2 sessions | Phase 3 |
| Phase 5 | Tab switcher & implant panel | 1 session | Phase 3 |
| Phase 6 | Sidebar cleanup & case activity | 1 session | Phases 4, 5 |
| Phase 7 | Completed view & cleanup | 1 session | Phases 3-6 |
| Phase 8 | Polish & accessibility | 1 session | Phase 7 |
| Phase 9 | Integration testing | 1 session | Phase 8 |

**Total: ~9-12 sessions**

---

## Component Dependency Map

```
app/cases/[id]/page.tsx (restructured)
├── Case Header (inline, not a separate component)
│   └── StatusPill (new or reuse StatusBadgeDot)
│
├── Timer Chips (3x)
│   └── TimerChip (new component)
│
├── Tab Switcher (inline)
│   ├── Milestones Tab (default)
│   │   └── MilestoneTimelineV2 (new component)
│   │       ├── FlagBadge (new, inline on milestone rows)
│   │       ├── DelayNode (new, between milestones)
│   │       └── AddDelayForm (new, popover)
│   │
│   └── Implants Tab
│       └── ImplantSection (existing component, integrated)
│
├── Sidebar
│   ├── FlipRoomCard (existing, kept)
│   ├── Surgeon Status (existing inline section, kept)
│   ├── Team Section (existing, styled)
│   │   └── TeamMember (existing, kept)
│   ├── CaseActivitySummary (new component)
│   └── Notes (existing inline, kept)
│
└── Modals
    ├── IncompleteCaseModal (existing, kept)
    └── ConfirmDialog (existing, kept for undo/out-of-order)
```

## Files Removed / No Longer Imported

| File | Reason |
|------|--------|
| `PiPMilestoneWrapper` | Feature removed from v2 |
| `FloatingActionButton` | Feature removed from v2 |
| `CallNextPatientModal` | Replaced by flip room inline |
| `MilestoneCard` | Replaced by MilestoneTimelineV2 |
| `ImplantBadge` | Replaced by ImplantSection tab |
| `PaceProgressBar` | Replaced by TimerChip progress bars |
| `DeviceRepSection` | Removed from sidebar |
| `CaseFlagsSection` | Moved to inline timeline |

---

## Out of Scope

- Breadcrumb nav (keep DashboardLayout)
- Cmd+K search bar
- "Pop Out" button
- Real-time WebSocket for multi-device sync (existing realtime subscription stays)
- Implant catalog/SKU system (keep free-text approach)
- Dark mode
- iOS parity
