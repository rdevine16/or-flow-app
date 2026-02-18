# Feature: Dynamic Case Breakdown Phases

## Goal
The Surgeon Day Overview "Case Breakdown" table currently renders 4 hardcoded phases (Pre-Op, Surgical, Closing, Emergence) with fixed milestone-pair calculations. Replace this with dynamic phases pulled from `phase_definitions`, including subphase visualization as inset bands within parent phase segments.

## Requirements

### 1. Replace hardcoded phases with `phase_definitions`
- Fetch active `phase_definitions` for the facility (with `start_milestone_id` and `end_milestone_id`)
- Compute each phase duration from the case's actual `case_milestones` timestamps at those boundary milestones
- Use `display_name`, `color_key`, and `display_order` from the DB — no hardcoded labels or colors

### 2. Render subphases as inset bands (Option A)
- Subphases (`parent_phase_id IS NOT NULL`) render as a smaller nested band inside their parent phase segment
- Visual: parent segment fills full height; subphase appears as a narrower inset within it
- Subphases only appear when both boundary milestones have recorded timestamps in that case
- Multiple subphases within a parent are positioned proportionally

### 3. Surgeon-aware phase visibility
- Subphases whose boundary milestones aren't captured for a surgeon's cases (not in `surgeon_milestone_config` or no recorded timestamps) simply don't render
- Parent phases always show if their boundary milestones exist (boundary milestones are always enabled)

### 4. Update PhaseLegend to be dynamic
- Legend items derived from fetched `phase_definitions`
- Subphases shown with visual indicator of nesting (indented or with parent label)

## Current Implementation (to be replaced)
- **Hardcoded phases:** `PHASE_LEGEND_ITEMS` and `PHASE_COLORS` in `app/analytics/surgeons/page.tsx` (lines ~143-148)
- **Hardcoded durations:** `caseBreakdown` useMemo calls `getWheelsInToIncision()`, `getIncisionToClosing()`, `getClosingTime()`, `getClosedToWheelsOut()` from `lib/analyticsV2.ts`
- **Hardcoded bar segments:** `CasePhaseBar` in `components/analytics/AnalyticsComponents.tsx` receives fixed 4-element `phases` array
- **Hardcoded colors:** `chartHex.phases` in `lib/design-tokens.ts`

## Database Context
- **`phase_definitions`** — per-facility phases with `start_milestone_id`, `end_milestone_id`, `color_key`, `parent_phase_id`, `display_order`
- **`case_milestones`** — per-case milestone timestamps keyed by `facility_milestone_id`
- **`get_phase_medians()`** — existing RPC that already computes phase durations from `phase_definitions` boundaries
- **`surgeon_milestone_config`** — surgeon-level milestone overrides (affects which milestones are captured)

## Visual Design

Parent phases as full-height stacked bar segments with subphases as inset bands:

```
┌──────────── Pre-Op ────────────┬────── Surgical ──────┬── Closing ──┬── Post-Op ──┐
│    ┌── Anes ──┐                │                      │             │             │
└────┴──────────┴────────────────┴──────────────────────┴─────────────┴─────────────┘
```

## Files Likely Involved
- `app/analytics/surgeons/page.tsx` — replace hardcoded phase logic with dynamic fetch
- `components/analytics/AnalyticsComponents.tsx` — update `CasePhaseBar` and `PhaseLegend` to support dynamic phases + subphase insets
- `lib/analyticsV2.ts` — add generic phase duration calculator from boundary milestones
- `lib/design-tokens.ts` — add `color_key` → hex color mapping utility
- `lib/milestone-phase-config.ts` — may reuse `buildPhaseTree()` for parent/child grouping

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait

## Out of Scope
- Per-surgeon phase definition overrides (phases remain facility-level)
- Phase configuration UI changes (Settings → Phases page is already built)
- Other analytics pages (procedure page, facility page) — this is surgeon day overview only

## Acceptance Criteria
- [ ] Case Breakdown shows phases from `phase_definitions`, not hardcoded
- [ ] Phase count, labels, colors, and order match facility configuration
- [ ] Subphases render as inset bands within parent phase segments
- [ ] Subphases only appear when boundary milestone timestamps exist in the case
- [ ] PhaseLegend is dynamic and includes subphase indicators
- [ ] Tooltip on hover shows phase name and duration
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
