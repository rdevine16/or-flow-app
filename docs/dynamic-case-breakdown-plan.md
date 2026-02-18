# Implementation Plan: Dynamic Case Breakdown Phases

## Summary
Replace the hardcoded 4-phase Case Breakdown on the Surgeon Day Overview with dynamic phases pulled from `phase_definitions`. Subphases render as 60%-height inset bands within parent phase segments. Missing milestone data shows a striped/hatched warning indicator. Colors use parent's color family with lighter shades for subphases.

## Interview Notes
- **Color logic:** Same color family, different shades — parent gets primary shade (e.g. blue-500), subphases get lighter variant (e.g. blue-300)
- **Missing data:** Show striped/hatched placeholder with tooltip explaining which milestone is missing
- **Scope:** Surgeon page only (only page that currently uses CasePhaseBar). The component is built generically so other pages can adopt it later.
- **Inset height:** ~60% of parent segment height — prominent but clearly nested
- **Tooltip:** Subphase name + duration only (e.g. "Anesthesia: 12 min")
- **Medians:** Case durations only, no comparison overlay

---

## Phase 1: Generic Phase Duration Engine + Color Utilities
**Complexity:** Medium

### What it does
Add a generic function to compute any phase's duration from case milestone timestamps, using `phase_definitions` boundary IDs instead of hardcoded milestone name pairs. Add a color shade utility that derives parent/subphase hex colors from a `color_key`.

### Files touched
- `lib/analyticsV2.ts` — add `computePhaseDurations()` that takes a milestone map + phase definitions array, returns duration per phase
- `lib/milestone-phase-config.ts` — add `resolvePhaseHex()` and `resolveSubphaseHex()` utilities that derive parent and lighter-shade hex colors from a `color_key`
- `lib/analyticsV2.test.ts` (or new test file) — unit tests for the duration engine

### Commit message
`feat(analytics): phase 1 - generic phase duration engine and color utilities`

### Test gate
1. **Unit:** `computePhaseDurations()` correctly computes durations from boundary milestone IDs; returns null for missing milestones; handles subphases
2. **Integration:** Feed real-shaped case_milestones data through the engine, verify output matches what the old hardcoded helpers produce for the same data
3. **Workflow:** Import and call the new function in a test that simulates the surgeon page data flow

---

## Phase 2: Enhanced CasePhaseBar with Subphase Insets
**Complexity:** Medium

### What it does
Update `CasePhaseBar` to accept a nested phase structure (parent phases with optional subphases). Render subphases as 60%-height inset bands within parent segments. Add striped/hatched pattern for phases with missing milestone data. Update `PhaseLegend` to show subphase indicators.

### Files touched
- `components/analytics/AnalyticsComponents.tsx` — update `CasePhaseBarProps` interface to support nested phases with subphases; update rendering logic for inset bands; add CSS hatched pattern for missing data; update `PhaseLegend` for subphase nesting indicators
- `lib/design-tokens.ts` — remove or deprecate `chartHex.phases` (no longer needed once dynamic)

### Commit message
`feat(analytics): phase 2 - CasePhaseBar with subphase insets and missing data indicators`

### Test gate
1. **Unit:** Component renders correct number of phase segments; subphase insets have correct height/positioning; missing data shows hatched pattern
2. **Integration:** Feed a mix of complete and partial phase data, verify rendering handles all edge cases (0 subphases, 1 subphase, multiple subphases, missing boundary milestone)
3. **Workflow:** Render in a test harness with realistic phase_definitions data structure

---

## Phase 3: Wire Surgeon Page to Dynamic Phases
**Complexity:** Medium

### What it does
Replace all hardcoded phase logic on the Surgeon Day Overview page with dynamic `phase_definitions` fetching. The page fetches phases from the DB, computes durations using the Phase 1 engine, and passes the Phase 2 component structure to `CasePhaseBar`.

### Files touched
- `app/analytics/surgeons/page.tsx` — remove `PHASE_COLORS`, `PHASE_LEGEND_ITEMS` constants; add Supabase query for `phase_definitions` (with `start_milestone_id`, `end_milestone_id`, `color_key`, `parent_phase_id`); update `caseBreakdown` useMemo to use `computePhaseDurations()`; update `CasePhaseBar` and `PhaseLegend` usage to pass dynamic data; remove imports of hardcoded duration helpers
- `lib/analyticsV2.ts` — keep old helper functions (they may be used elsewhere) but mark with `@deprecated` comment

### Commit message
`feat(analytics): phase 3 - wire surgeon page to dynamic phase_definitions`

### Test gate
1. **Unit:** caseBreakdown memo produces correct phase durations from mocked phase_definitions + case_milestones
2. **Integration:** Full page render with mocked Supabase responses returns dynamic phases matching the facility's configuration
3. **Workflow:** Simulate changing phase_definitions (adding/removing a phase) and verify the Case Breakdown reflects the change without code changes

---

## Phase 4: Facility Milestone ID Resolution + Edge Cases
**Complexity:** Small

### What it does
Handle the mapping from `phase_definitions.start_milestone_id` / `end_milestone_id` (which are `facility_milestone_id` UUIDs) to the actual milestone timestamps in `case_milestones`. Ensure the system works when: a case has no milestones at all, a phase's boundary milestone wasn't recorded, subphase milestones are absent for a surgeon who doesn't capture them.

### Files touched
- `lib/analyticsV2.ts` — ensure `computePhaseDurations()` handles all edge cases with proper null returns
- `app/analytics/surgeons/page.tsx` — handle loading/error states for the phase_definitions query; handle edge case where facility has no phase_definitions configured (show empty state or fallback)
- Tests — edge case coverage

### Commit message
`feat(analytics): phase 4 - milestone ID resolution and edge case handling`

### Test gate
1. **Unit:** Engine returns proper nulls for missing milestones; hatched indicator renders for null phase durations
2. **Integration:** A case with partial milestones renders some phases normally and others with the warning pattern
3. **Workflow:** A surgeon whose cases don't capture anesthesia milestones sees parent phases but no anesthesia subphase inset

---

## Dependencies
- Phase 2 depends on Phase 1 (needs the duration engine types)
- Phase 3 depends on Phase 1 + Phase 2 (needs both the engine and the updated component)
- Phase 4 depends on Phase 3 (edge cases on the wired page)

## Architecture Notes
- `phase_definitions` are facility-level — all surgeons at a facility see the same phase structure
- Subphase visibility is data-driven: if a case's milestones don't include the subphase boundaries, the inset simply doesn't render
- The `buildPhaseTree()` function in `lib/milestone-phase-config.ts` already handles parent/child grouping — reuse it
- The `resolveColorKey()` function already maps `color_key` → hex — extend it for shade variants
- Old hardcoded helpers in `analyticsV2.ts` are kept (marked deprecated) to avoid breaking any other consumers
