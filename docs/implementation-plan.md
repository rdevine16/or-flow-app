# Implementation Plan: Milestone Pages — Subphases, Edit/Archive UX, Intervals

## Summary

Enhance the three milestone settings pages (Milestones, Procedure Milestones, Surgeon Milestones) with:
1. **Edit icon** — pencil icon on each row (icon-only trigger, no row click)
2. **Archive UX** — replace Trash2 with Archive icon on rows; existing ArchivedMilestonesSection and modal archive button remain
3. **Subphases** — nested phases with `parent_phase_id` in the DB; visually rendered as bordered cards floating inside parent phase blocks
4. **Intervals** — show min/max validation range on milestone rows across all three pages

## Interview Notes

| Decision | Answer |
|----------|--------|
| Edit trigger | Icon only — pencil icon opens edit modal, row click does nothing |
| Archive location | Keep archive in edit modal. Replace Trash2 row icon with Archive icon (same soft-delete behavior) |
| Subphase DB | Add `parent_phase_id` FK column to `phase_definitions` (migration required) |
| Subphase visual | Nested card style — parent phase color fills background, subphase gets its own bordered card floating inside |
| Intervals | Show validation range (min/max minutes) on all three pages |
| Subphase scope | All three pages show subphase nesting |
| River Walk | Test facility — expect it to work correctly once subphase nesting is properly implemented |

---

## Phase 1: Database Migration — `parent_phase_id`

**What it does:** Add self-referencing `parent_phase_id` FK to `phase_definitions` table, enabling phase nesting (one level deep).

**Files:**
- `supabase/migrations/YYYYMMDD_add_parent_phase_id.sql` (new)
- `lib/dal/lookups.ts` — update `PhaseDefinition` interface and `phaseDefinitions()` query to include `parent_phase_id`

**Details:**
- Add `parent_phase_id UUID REFERENCES phase_definitions(id) ON DELETE SET NULL`
- Add index on `parent_phase_id` for lookup performance
- No data backfill needed — existing phases start as `NULL` (top-level)
- Update the `PhaseDefinition` TypeScript interface to include `parent_phase_id: string | null`

**Commit:** `feat(milestones): phase 1 - add parent_phase_id to phase_definitions`

**Test gate:**
1. **Unit:** Migration applies cleanly, column exists, FK constraint works
2. **Integration:** Existing phase queries return correct data with new nullable column
3. **Workflow:** Settings pages load normally with no regressions

**Complexity:** Small

---

## Phase 2: PhaseBlock UX Updates — Edit Icon, Archive Icon, Intervals

**What it does:** Update the shared `PhaseBlock` component to change row interactions and add interval display.

**Changes:**
- Replace `Trash2` import with `Archive` icon (lucide-react)
- Add `Pencil` icon (hover-reveal) on each row — calls `onEditMilestone(milestoneId)`
- Remove row-level `onClick` handler (no more click-to-edit on the row itself)
- Add interval badge on each milestone row showing "X–Y min" from `min_minutes`/`max_minutes`
- Extend `PhaseBlockMilestone` interface with `min_minutes: number | null` and `max_minutes: number | null`

**Row layout (table mode):** `[Grip] [#] [Name] [Interval badge] [...spacer...] [Pencil] [Archive]`
**Row layout (config mode):** `[Checkbox] [Name] [Interval badge] [Override badge]`

**Interval badge:** Subtle gray pill (`text-xs text-slate-500 bg-slate-100 rounded px-1.5`). Formats:
- Both set: "5–15 min"
- Only max: "≤15 min"
- Only min: "≥5 min"
- Neither: hidden

**Files:**
- `components/settings/milestones/PhaseBlock.tsx` — icon swap, add pencil, add interval badge, remove row onClick
- `app/settings/milestones/page.tsx` — pass `min_minutes`/`max_minutes` in milestone data to PhaseBlock

**Commit:** `feat(milestones): phase 2 - edit icon, archive icon, interval display on PhaseBlock`

**Test gate:**
1. **Unit:** PhaseBlock renders pencil + archive icons in table mode, interval badges in both modes
2. **Integration:** Milestones page: pencil opens edit modal, archive triggers soft-delete, interval shows correct range
3. **Workflow:** Add milestone with interval → see badge on row → click pencil → edit → click archive → see in archived section → restore

**Complexity:** Medium

---

## Phase 3: Subphase Nesting — PhaseBlock + Phase Tree

**What it does:** Enable PhaseBlock to render child phases as nested bordered cards inside a parent phase. Build phase tree utility. Update all three pages.

**Files:**
- `lib/milestone-phase-config.ts` — add `buildPhaseTree()` helper: takes flat `PhaseDefinition[]`, returns tree structure
- `components/settings/milestones/PhaseBlock.tsx` — add `childPhases` prop, render nested cards inside parent
- `app/settings/milestones/page.tsx` — build phase tree, render nested PhaseBlocks
- `app/settings/procedure-milestones/page.tsx` — integrate phase tree for subphase rendering
- `app/settings/surgeon-milestones/page.tsx` — integrate phase tree for subphase rendering

**Subphase nested card visual:**
- Parent PhaseBlock has its normal left color border and background
- Child phase renders as a card inside the parent with:
  - Its own left color border (child phase's color)
  - Subtle border on all sides (`border border-slate-200 rounded-md`)
  - Its own collapsible header with child phase label + count
  - Child phase milestones listed inside
  - Slightly indented from parent milestones (e.g., `ml-4`)
- Parent milestones that are NOT in a subphase render normally above/below/between subphase cards
- Phase assignment: milestones with `phase_group` matching a child phase's `name` go into the subphase card; milestones matching the parent phase go into the parent (outside any subphase card)

**Phase tree builder:**
```typescript
interface PhaseTreeNode {
  phase: PhaseDefinition
  children: PhaseTreeNode[]
  milestones: PhaseBlockMilestone[]  // milestones assigned to THIS phase (not children)
}
function buildPhaseTree(phases: PhaseDefinition[]): PhaseTreeNode[]
```
- Top-level nodes: phases where `parent_phase_id` is null
- Children: phases where `parent_phase_id` matches a top-level phase's `id`
- Only 1 level of nesting supported (children cannot have children)

**Commit:** `feat(milestones): phase 3 - subphase nesting with nested card visuals`

**Test gate:**
1. **Unit:** `buildPhaseTree()` correctly nests phases; handles no children, multiple children, orphaned children
2. **Integration:** PhaseBlock renders nested cards with correct colors; milestones sort into correct parent vs child phase
3. **Workflow:** On the phases settings page, set a phase's parent → milestones page shows that phase nested inside its parent → procedure + surgeon pages show same nesting

**Complexity:** Large

---

## Phase 4: Procedure + Surgeon Page Interval Integration

**What it does:** Ensure intervals and subphase nesting fully work on Procedure Milestones and Surgeon Milestones pages.

**Files:**
- `app/settings/procedure-milestones/page.tsx` — pass `min_minutes`/`max_minutes` in milestone data
- `app/settings/surgeon-milestones/page.tsx` — pass `min_minutes`/`max_minutes` in milestone data
- Potentially `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx` — add interval if this component is still used independently

**Details:**
- Both pages already use PhaseBlock in config mode — subphase nesting from Phase 3 propagates automatically
- Ensure milestone data queries on both pages include `min_minutes` and `max_minutes` from `facility_milestones`
- Verify override detection works with milestones inside subphases
- Verify inheritance breadcrumb renders correctly with subphase context
- Test that toggling a milestone inside a subphase correctly creates/removes override records

**Commit:** `feat(milestones): phase 4 - intervals and subphases on procedure + surgeon pages`

**Test gate:**
1. **Unit:** Config mode PhaseBlock shows interval badges inside subphase cards
2. **Integration:** Toggle milestone in subphase → override badge appears → reset restores parent value
3. **Workflow:** Navigate Milestones → Procedure Milestones → Surgeon Milestones — intervals and subphases consistent across all three

**Complexity:** Medium

---

## Phase 5: Cross-Page Verification + Polish

**What it does:** End-to-end verification across all three pages. Fix visual inconsistencies, edge cases, and River Walk facility data.

**Files:**
- Any files from prior phases needing fixes
- `lib/utils/pairIssues.ts` — ensure pair detection works within subphases
- `components/settings/milestones/PairBracketOverlay.tsx` — verify brackets render inside nested subphase cards

**Details:**
- Test with River Walk facility — verify milestones appear in correct phases/subphases after proper `parent_phase_id` setup
- Verify pair brackets render correctly inside subphase nested cards
- Verify drag-and-drop reorder works within subphases (table mode)
- Verify boundary markers between parent and child phases render correctly
- Ensure phases settings page allows setting `parent_phase_id` (dropdown to select parent phase)
- Edge cases: empty subphases, subphase with 0 milestones, phase with only boundary milestones
- Limit nesting to 1 level (child cannot be a parent)

**Commit:** `feat(milestones): phase 5 - cross-page verification and polish`

**Test gate:**
1. **Unit:** Edge cases render cleanly (empty subphases, no intervals, no pairs)
2. **Integration:** River Walk facility shows correct phase/subphase assignments
3. **Workflow:** Full flow — configure subphase on phases page → see nesting on milestones page → view on procedure/surgeon pages → toggle overrides → verify consistency

**Complexity:** Medium

---

## Dependency Graph

```
Phase 1 (Migration: parent_phase_id)
  └── Phase 2 (PhaseBlock UX: edit/archive icons, intervals)
        └── Phase 3 (Subphase nesting: phase tree, nested cards)
              └── Phase 4 (Procedure + Surgeon page integration)
                    └── Phase 5 (Cross-page verification + polish)
```

All phases are sequential — each builds on the previous.

## Estimated Scope

| Phase | Complexity | Files | Description |
|-------|-----------|-------|-------------|
| 1 | Small | 2 | DB migration + TypeScript interface update |
| 2 | Medium | 2 | Edit/archive icons, interval badges on PhaseBlock |
| 3 | Large | 5 | Phase tree builder, nested card rendering, all 3 pages |
| 4 | Medium | 2-3 | Interval data on procedure + surgeon pages |
| 5 | Medium | 3+ | E2E verification, edge cases, River Walk fix |
