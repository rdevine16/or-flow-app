# Implementation Plan: Milestone Settings Pages Redesign

## Summary

Redesign all three milestone settings pages (Milestones, Procedure Milestones, Surgeon Milestones) to match the reference UI in `docs/orbit-milestones-combined.jsx`. This is a full visual and structural overhaul: the milestones page gets phase blocks with boundary markers and SVG pair brackets; the procedure and surgeon pages get master/detail layouts with sidebars, search/filter, inheritance breadcrumbs, and cross-page navigation.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Procedure page layout | Full master/detail split (280px sidebar + detail panel) |
| Surgeon page layout | Full master/detail split (surgeon list sidebar + detail panel) |
| Milestones page | Full redesign (phase blocks, boundary markers, SVG brackets) |
| Phase source | Dynamic from `phase_definitions` DB table, but must match reference visual treatment |
| Boundary milestones | Derived from `phase_definitions.start_milestone_id` / `end_milestone_id` |
| Add modal fields | Reference fields (name, phase, pair-with, pair-role) + validation range (min/max minutes) |
| SVG pair brackets | Must have — signature visual element |
| Cross-page navigation | Must have — surgeon override banner on procedure page, links between pages |
| Archived milestones | Keep the section (not in reference but useful functionality) |
| Pair issue detection | Build it — red warnings for split phases or wrong order |
| Surgeon DnD | Keep reorder ability (diverge from reference) |
| Phase count | 5 phases: Pre-Op, Anesthesia (sub-phase of Pre-Op), Surgical, Closing, Post-Op |
| Anesthesia sub-phase | Shown via SVG bracket visualization inside Pre-Op, not as a separate top-level block |

## Reference File

**Always read** `apps/web/or-flow-app/docs/orbit-milestones-combined.jsx` when implementing any phase of this plan.

---

## Phase 1: Shared Components — PhaseBlock, BoundaryMarker, InheritanceBreadcrumb

**What it does:** Build the three core shared components that all three pages will use. These are the visual building blocks of the redesign.

**Components to create:**
1. **`PhaseBlock`** — Collapsible phase section with:
   - Left color border (dynamic from `resolveColorKey`)
   - Phase label + milestone count in header
   - Collapsible with chevron animation
   - Configurable modes: `table` (numbered rows, grip + delete), `config` (checkbox rows with override badges)
   - Accepts `children` or renders milestone rows from data

2. **`BoundaryMarker`** — Pill between phase blocks:
   - Colored dot (solid or split gradient for shared boundaries)
   - Vertical color line connecting to adjacent phase blocks
   - Lock icon indicating immutability
   - Derives boundary status from `phase_definitions` start/end milestone IDs

3. **`InheritanceBreadcrumb`** — Horizontal chain:
   - Array of `{ label: string, active: boolean }` levels
   - Arrow separators between levels
   - Active level highlighted blue

**Files touched:**
- `components/settings/milestones/PhaseBlock.tsx` (new)
- `components/settings/milestones/BoundaryMarker.tsx` (new)
- `components/settings/milestones/InheritanceBreadcrumb.tsx` (new)

**Also update:**
- `lib/milestone-phase-config.ts` — Add hex color values alongside Tailwind classes (needed for SVG rendering and boundary dot gradients)

**Commit:** `feat(milestones): phase 1 - shared components (PhaseBlock, BoundaryMarker, InheritanceBreadcrumb)`

**Test gate:**
1. **Unit:** Each component renders correctly with mock data. BoundaryMarker handles solid vs gradient dots. InheritanceBreadcrumb highlights active level.
2. **Integration:** PhaseBlock collapses/expands. PhaseBlock renders in both `table` and `config` modes.
3. **Workflow:** Components render inside a test page wrapper with real phase config data.

**Complexity:** Medium

---

## Phase 2: SVG Pair Bracket System & Pair Issue Detection

**What it does:** Build the SVG bracket visualization that connects START/END paired milestones, and the pair issue detection system.

**Components to create:**
1. **`PairBracketOverlay`** — SVG overlay rendered inside PhaseBlock:
   - Computes bracket data from milestones (group pairs by `pair_with_id` + `pair_position`)
   - Lane allocation algorithm to prevent overlapping brackets
   - Renders vertical line + horizontal ticks + filled dots at endpoints
   - Small dots for milestones between a pair (opacity 0.35)
   - Color per pair group (from pair color config or auto-assigned)
   - Red coloring for pairs with issues

2. **Pair issue detection utility** (`lib/utils/pairIssues.ts`):
   - Detects pairs split across phases (start and end in different phase_groups)
   - Detects END appearing before START in display order
   - Returns `Record<string, string>` mapping pair IDs to issue descriptions
   - Used by PhaseBlock (red alert in header) and page header (global count)

**Files touched:**
- `components/settings/milestones/PairBracketOverlay.tsx` (new)
- `lib/utils/pairIssues.ts` (new)

**Commit:** `feat(milestones): phase 2 - SVG pair brackets and pair issue detection`

**Test gate:**
1. **Unit:** Lane allocation handles 0, 1, 2, 3+ overlapping pairs. Issue detection catches split phases and wrong order. Correctly handles unpaired milestones.
2. **Integration:** PairBracketOverlay renders inside PhaseBlock with correct positioning. Red coloring applied to issue pairs.
3. **Workflow:** Test with mock data matching reference's Pre-Op phase (Anesthesia, Table Setup, Prep/Drape pairs).

**Complexity:** Large

---

## Phase 3: Milestones Page Redesign (Facility Level)

**What it does:** Replace the current table-based milestones page with the new phase block layout.

**Changes:**
- Replace `MilestonesTable` usage with `PhaseBlock` components (mode: `table`)
- Insert `BoundaryMarker` components between phase blocks (derived from `phase_definitions`)
- Numbered rows with grip handle + milestone name + delete button (on hover)
- Drag-and-drop reorder within phases (keep existing @dnd-kit pattern)
- Summary footer: "{total} total · {boundary} boundary · {optional} optional"
- Pair issue count banner in page header
- Keep existing Add Milestone button → update modal (add pair-with and pair-role fields)
- Keep Archived Milestones section below the main list

**Files touched:**
- `app/settings/milestones/page.tsx` (rewrite layout section)
- `components/settings/milestones/MilestonesTable.tsx` (major rewrite or replace)
- `components/settings/milestones/MilestoneRow.tsx` (update to new row format)
- `components/settings/milestones/MilestoneFormModal.tsx` (add pairing fields)
- `components/settings/milestones/PhaseGroupHeader.tsx` (may be removed, replaced by PhaseBlock)

**Commit:** `feat(milestones): phase 3 - milestones page redesign with phase blocks and boundary markers`

**Test gate:**
1. **Unit:** New milestone rows render correctly. Add modal includes pair fields. Boundary markers render between phases.
2. **Integration:** Drag-and-drop works within phase blocks. Add milestone inserts at correct position. Delete removes milestone and unpairs partner.
3. **Workflow:** Full flow: view milestones → add new → pair it → reorder → delete → check archived.

**Complexity:** Large

---

## Phase 4: Procedure Milestones Page — Master/Detail Layout

**What it does:** Replace the accordion layout with a master/detail split. Left panel: searchable/filterable procedure list. Right panel: selected procedure's milestone configuration.

**Changes:**
- **Left panel (280px):**
  - Search input with magnifying glass icon
  - Filter tabs: All, Customized, Default, Surg. Overrides (with counts)
  - Procedure list with selection state (blue highlight)
  - Each row: name, override count or "Default", surgeon override indicator (purple)
  - Status dots: amber = customized, purple = has surgeon overrides

- **Right panel:**
  - Header: procedure name + CUSTOMIZED/DEFAULT badge + active milestone count + Reset button
  - `InheritanceBreadcrumb`: Facility Default → Procedure Name
  - Surgeon override banner (purple): shows surgeons who override this procedure with clickable links
  - `PhaseBlock` components (mode: `config`) with checkboxes
  - Override indicators: amber "OVERRIDE" badge, "was on/off" text, amber row background
  - `BoundaryMarker` components between phases (locked, no checkbox)
  - Drag-and-drop reorder within phases
  - Keep existing bulk enable/disable actions

**Data changes:**
- Query `surgeon_milestone_config` to find which surgeons override each procedure
- Query `procedure_milestone_config` to determine customized vs default status

**Files touched:**
- `app/settings/procedure-milestones/page.tsx` (major rewrite)
- `components/settings/procedure-milestones/ProcedureMilestoneList.tsx` (rewrite for PhaseBlock integration)
- `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx` (update for override badges)
- `components/settings/procedure-milestones/PhaseSection.tsx` (may be replaced by PhaseBlock)

**Commit:** `feat(milestones): phase 4 - procedure milestones master/detail layout with search, filter, override badges`

**Test gate:**
1. **Unit:** Left panel search filters procedures. Filter tabs show correct counts. Override badges render correctly.
2. **Integration:** Selecting procedure loads its config. Toggling milestone updates state. Reset clears overrides. Surgeon override banner shows correct surgeons.
3. **Workflow:** Search → select procedure → toggle milestones → see override badges → reset → verify. Click surgeon link → navigates to surgeon page.

**Complexity:** Large

---

## Phase 5: Surgeon Milestones Page — Master/Detail Layout

**What it does:** Replace the dropdown-based layout with a master/detail split. Left panel: searchable surgeon list with avatars. Right panel: surgeon's procedure overrides with add/remove functionality.

**Changes:**
- **Left panel (280px):**
  - Search input
  - Surgeon list with avatars (initials), name, specialty, override count
  - Purple avatar background if has overrides, gray if not
  - Selected state: blue highlight

- **Right panel:**
  - Header: avatar + surgeon name + specialty
  - Procedure overrides section: chips/tabs for each overridden procedure
  - Each chip: procedure name + purple dot (if has diff) or "no diff" + X button to remove
  - "Add Procedure Override" button (dashed border, full width) → dropdown with search
  - When procedure selected:
    - `InheritanceBreadcrumb`: Facility Default → Procedure Name → Surgeon Last Name
    - Active milestone count + override count
    - Reset button
    - Green info banner when matching parent config
    - `PhaseBlock` components (mode: `config`) with checkboxes
    - "SURGEON" override badges (amber)
    - "was on/off" showing procedure config parent value
    - Drag-and-drop reorder within phases (keep, diverge from reference)
  - Empty state when no procedure selected

**Files touched:**
- `app/settings/surgeon-milestones/page.tsx` (major rewrite)
- `components/settings/surgeon-milestones/SurgeonMilestoneRow.tsx` (update for new badge format)
- `components/settings/surgeon-milestones/AddProcedureDropdown.tsx` (new)

**Commit:** `feat(milestones): phase 5 - surgeon milestones master/detail layout with procedure chips and add/remove`

**Test gate:**
1. **Unit:** Surgeon list renders with avatars and override counts. Add procedure dropdown filters correctly. Procedure chips render with X button.
2. **Integration:** Select surgeon → see their overrides. Add procedure override → creates config. Remove procedure override → deletes config. Toggle milestone → override badge appears. Reset → clears overrides.
3. **Workflow:** Full flow: search surgeon → add procedure override → toggle milestones → see inheritance breadcrumb → reset → remove procedure.

**Complexity:** Large

---

## Phase 6: Cross-Page Navigation & Polish

**What it does:** Wire up cross-page links, polish visual details, and ensure consistency across all three pages.

**Changes:**
1. **Cross-page navigation:**
   - Procedure page surgeon override banner → clicking surgeon chip navigates to `/settings/surgeon-milestones?surgeon={id}&procedure={id}`
   - Surgeon page reads URL params to pre-select surgeon + procedure on load
   - Sidebar notification dot on Surgeon Milestones nav item when any surgeon has overrides

2. **Visual polish:**
   - Consistent row height (34px) across all pages
   - Hover states matching reference
   - Disabled milestone styling (line-through, 0.4 opacity)
   - Loading skeletons for all panels
   - Pair bracket colors consistent with pair group identity

3. **Edge cases:**
   - Handle procedures with 0 milestones configured
   - Handle surgeons with 0 overrides gracefully
   - Ensure pair issue warnings update in real-time as milestones are reordered

**Files touched:**
- `app/settings/procedure-milestones/page.tsx` (add surgeon query + banner)
- `app/settings/surgeon-milestones/page.tsx` (add URL param handling)
- Various component files (visual polish)
- Settings nav config (notification dot logic)

**Commit:** `feat(milestones): phase 6 - cross-page navigation, URL params, visual polish`

**Test gate:**
1. **Unit:** URL params parsed correctly. Notification dot logic works. Loading skeletons render.
2. **Integration:** Clicking surgeon link on procedure page navigates to surgeon page with correct pre-selection. Pair issue warnings update on reorder.
3. **Workflow:** Full cross-page flow: procedure page → click surgeon override link → arrive at surgeon page with correct context → make changes → navigate back.

**Complexity:** Medium

---

## Phase 7: Cleanup & Test Coverage

**What it does:** Remove dead code from old implementations, update existing tests, add missing test coverage.

**Changes:**
1. **Dead code removal:**
   - Remove or archive unused old components (if any were fully replaced)
   - Remove unused imports and types
   - Clean up any temporary compatibility code

2. **Test updates:**
   - Update `MilestonesTable.test.tsx` for new PhaseBlock-based structure
   - Update `ProcedureMilestoneRow.test.tsx` for new override badge rendering
   - Add tests for new components: BoundaryMarker, InheritanceBreadcrumb, PairBracketOverlay, AddProcedureDropdown
   - Add test for pair issue detection utility

3. **TypeScript:**
   - Ensure no `any` types introduced
   - Type-check passes clean

**Files touched:**
- Test files in `__tests__/` directories
- Old component files (removal)
- Various files (import cleanup)

**Commit:** `feat(milestones): phase 7 - cleanup dead code, update and expand test coverage`

**Test gate:**
1. **Unit:** All new component tests pass. Pair issue utility has full coverage.
2. **Integration:** Existing tests updated and passing. No regressions.
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` all pass clean.

**Complexity:** Medium

---

## Dependency Graph

```
Phase 1 (Shared Components)
  ├── Phase 2 (SVG Brackets + Pair Detection)
  │     └── Phase 3 (Milestones Page) ──┐
  │                                      ├── Phase 6 (Cross-Page + Polish)
  ├── Phase 4 (Procedure Page) ─────────┤      │
  │                                      │      └── Phase 7 (Cleanup + Tests)
  └── Phase 5 (Surgeon Page) ───────────┘
```

Phases 1→2→3 are sequential (brackets depend on shared components, milestones page uses both).
Phases 4 and 5 depend on Phase 1 but are independent of each other.
Phase 6 depends on all page phases (3, 4, 5).
Phase 7 depends on Phase 6.

## Estimated Scope

| Phase | Complexity | Files | Description |
|-------|-----------|-------|-------------|
| 1 | Medium | 4 | Shared components (PhaseBlock, BoundaryMarker, Breadcrumb) |
| 2 | Large | 2 | SVG pair brackets + pair issue detection |
| 3 | Large | 5 | Milestones page full redesign |
| 4 | Large | 4 | Procedure page master/detail layout |
| 5 | Large | 3 | Surgeon page master/detail layout |
| 6 | Medium | 4+ | Cross-page nav, URL params, polish |
| 7 | Medium | 5+ | Dead code cleanup, test coverage |
