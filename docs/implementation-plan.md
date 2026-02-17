# Implementation Plan: Flat Milestone List Redesign

## Summary

Replace the grouped collapsible PhaseBlock cards with a **single flat list** where phase membership is indicated by colored vertical rails, not by grouping milestones into separate cards. All milestones (including phase boundaries) are freely draggable — phase ranges update dynamically based on where boundaries sit.

**Previous feature (Subphases/Edit/Archive/Intervals) is COMPLETE** — all 5 phases merged. This plan builds on that work.

## Key Architecture

- **One flat list** — all milestones in a single scrollable container, no collapsing
- **Primary color rail** — 4px SVG bar on left edge, color matches the top-level phase
- **Sub-phase rails** — additional 4px colored bars for child phases
- **Boundary milestones are regular rows** — bold text, lock icon, phase tags, draggable
- **Order determined by display_order** — `buildFlatRows` sorts ALL milestones by display_order, then computes phase ranges dynamically from boundary positions (matching reference design `docs/orbit-flat-milestones.jsx`)
- **ROW_HEIGHT = 40px**

## Reference Design

`docs/orbit-flat-milestones.jsx` — standalone React component showing the target UX.

---

## Phase 1: Core component + utility ✅ COMPLETE

**Commit:** `69e456d feat(milestones): phase 1 - FlatMilestoneList component and buildFlatRows utility`

**Files created:**
- `lib/utils/buildFlatRows.ts` — pure function producing flat ordered `FlatRow[]`
- `components/settings/milestones/FlatMilestoneList.tsx` — renders legend, rails, brackets, rows
- `lib/utils/__tests__/buildFlatRows.test.ts` — 16 unit tests

---

## Phase 2: Wire up milestones page (table mode) ✅ COMPLETE

**Commit:** `74e1e49 feat(milestones): phase 2 - milestones page uses FlatMilestoneList`

**Files modified:**
- `app/settings/milestones/page.tsx` — replaced PhaseBlock/BoundaryMarker loop with single `<FlatMilestoneList>`
- `lib/utils/buildFlatRows.ts` — **rewritten** to sort ALL milestones by display_order and compute phase ranges dynamically (matching reference design approach)
- `components/settings/milestones/FlatMilestoneList.tsx` — all milestones (including boundaries) are draggable, no cross-phase constraint

**Key changes:**
- Removed `toBlockMilestones`, `phaseBlockData`, `unphasedMilestones`, `renderData` computed blocks (~240 lines)
- Removed `handleCrossPhaseMove` (free reorder across full list)
- `handleReorder` persists order for ALL milestones (boundaries included)
- `buildFlatRows` now sorts by display_order first, computes phase ranges from boundary positions (like reference `computePhaseRanges`)

---

## ⚠️ Verify Before Phase 3

**Left-side color rails need visual verification.** The primary rail SVG and sub-phase rail divs are implemented in `FlatMilestoneList.tsx` (lines 180-246) and data flows from `buildFlatRows`. However, the user has not confirmed they render correctly in the browser. Before starting Phase 3:
1. Load the milestones page for a facility WITH phase_definitions (e.g., River Walk)
2. Confirm the primary color rail (4px colored bar) appears on the left edge
3. Confirm sub-phase rails appear next to the primary rail for child phases
4. Confirm gradient transitions appear at shared boundary milestones
5. If rails are NOT visible, debug: check `primaryColor` values in rows, check CSS positioning/z-index, check `overflow-hidden` on container

---

## Phase 3: Wire up procedure + surgeon pages (config mode) — NEXT

**Replace PhaseBlock + BoundaryMarker on both config-mode pages with FlatMilestoneList.**

### Files to modify
- `app/settings/procedure-milestones/page.tsx`
- `app/settings/surgeon-milestones/page.tsx`

### Key changes (both pages)
1. Add `buildFlatRows()` call to produce `flatRows`
2. Remove `renderData` computation and PhaseBlock rendering loop
3. Adapt `handleReorder` signature to accept `FlatRow[]`
4. Replace render with `<FlatMilestoneList mode="config" .../>`
5. Remove PhaseBlock/BoundaryMarker/PairBracketOverlay imports

### Page-specific notes

**Procedure page:**
- `config={effectiveConfig}`, `parentConfig={defaultConfig}`, `overrideLabel="OVERRIDE"`
- `draggable={isCustomized}`, `onReorder` only when customized

**Surgeon page:**
- `config={effectiveConfig}`, `parentConfig={parentConfig}` (procedure-level), `overrideLabel="SURGEON"`
- `draggable={true}` (always)
- Uses `configOrderMap` for milestone sorting — pass to `buildFlatRows`
- InheritanceBreadcrumb stays above the list

### Commit
`feat(milestones): phase 3 - procedure and surgeon pages use FlatMilestoneList`

---

## Phase 4: Delete dead code ✅ COMPLETE

**Commit:** `15e8d70 refactor(milestones): phase 4 - remove PhaseBlock, BoundaryMarker, PairBracketOverlay`

**Remove PhaseBlock, BoundaryMarker, PairBracketOverlay, and their tests. Move bracket utilities to shared location.**

### Files to delete
- `components/settings/milestones/PhaseBlock.tsx`
- `components/settings/milestones/BoundaryMarker.tsx`
- `components/settings/milestones/PairBracketOverlay.tsx`
- `components/settings/milestones/__tests__/PhaseBlock.test.tsx`
- `components/settings/milestones/__tests__/BoundaryMarker.test.tsx`
- `components/settings/milestones/__tests__/PairBracketOverlay.test.tsx`

### Files to create/modify
- **Create `lib/utils/bracketUtils.ts`** — move `computeBracketData`, `computeBracketAreaWidth` from PairBracketOverlay.tsx before deleting
- **Update `FlatMilestoneList.tsx`** — change import path for bracket utilities

### Commit
`refactor(milestones): phase 4 - remove PhaseBlock, BoundaryMarker, PairBracketOverlay`

---

## Session Log

| Date | Session | What happened |
|------|---------|---------------|
| 2026-02-16 | Session 1 | Phase 1 complete. Created buildFlatRows + FlatMilestoneList + 16 tests. |
| 2026-02-16 | Session 2 | Phase 2 complete. Wired milestones page. Rewrote buildFlatRows to sort by display_order and compute phase ranges dynamically (matching reference design). Fixed boundary milestone draggability — all milestones now freely reorderable. |
| 2026-02-16 | Session 3 | Phase 3 complete. Replaced PhaseBlock/BoundaryMarker on procedure + surgeon pages with FlatMilestoneList. Removed ~380 lines of dead renderData/phaseBlockData/toBlockMilestones code. Added configOrderMap for customized procedures. |
| 2026-02-16 | Session 4 | Phase 4 complete. Deleted PhaseBlock, BoundaryMarker, PairBracketOverlay + tests (6 files, -2174 lines). Moved bracket utils to lib/utils/bracketUtils.ts. Inlined PhaseBlockMilestone into buildFlatRows.ts. Ported 14 bracket tests. |
