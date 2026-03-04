# Implementation Plan: Milestone Flexibility & Analytics Transparency

> **Status:** Planned (execute after `feature/subscription-tier-system` merges to main)
> **Branch:** `feature/milestone-flexibility` (from main)
> **Feature spec:** `docs/milestone-flexibility-feature.md`

## Summary
Remove all hard locks from the milestone template builder, build a milestone-to-metric dependency registry, add informed-consent warnings when removing milestones, show actionable hints on analytics cards when milestones are missing, and surface case exclusion counts for transparency.

## Interview Notes
- **No locks at all.** Every milestone and phase is deletable in both facility and admin builders.
- **Pre-populated but flexible.** New templates still start with all milestones. All removable.
- **Shared registry.** One file maps metrics → required milestones. Powers template warnings + analytics hints.
- **Milestone hints.** Empty metrics show "Requires Incision milestone" not just "—".
- **Case count subtitles.** "Based on 45 of 50 cases" under KPI values.
- **Admin templates too.** Global admin templates fully flexible.
- **Warnings, not blocks.** Removing a milestone shows affected metrics, user can proceed.
- **Blank is OK.** Cards stay visible even when empty — shows what the platform can provide.
- **Execute after current feature.** Plan now, start after subscription-tier-system merges.

---

## Phase 1: Milestone-to-Metric Dependency Registry
**Complexity:** Small
**What:** Create `lib/metric-dependencies.ts` — a comprehensive registry mapping every metric/KPI to its required milestones, with display-friendly names and hint text. Expand the existing `METRIC_REQUIREMENTS` from `lib/dataQuality.ts` to cover all metrics used across dashboard, analytics, KPI, and scoring.

**Files touched:**
- `lib/metric-dependencies.ts` — NEW: the registry
- `lib/dataQuality.ts` — re-export from new registry (backward compat)

**Registry shape:**
```typescript
export const METRIC_DEPENDENCIES: Record<string, MetricDependency> = {
  or_utilization: {
    name: 'OR Utilization',
    requires: ['patient_in', 'patient_out'],
    hint: 'Requires Patient In and Patient Out milestones',
  },
  same_room_turnover: {
    name: 'Same-Room Turnover',
    requires: ['patient_in', 'patient_out'],
    hint: 'Requires Patient In and Patient Out milestones on consecutive cases',
  },
  surgical_turnover: {
    name: 'Surgical Turnover',
    requires: ['closing', 'incision'],
    hint: 'Requires Closing and Incision milestones',
  },
  fcots: {
    name: 'First Case On-Time Start',
    requires: ['patient_in'],
    hint: 'Requires Patient In milestone',
  },
  surgical_time: {
    name: 'Surgical Time',
    requires: ['incision', 'closing'],
    hint: 'Requires Incision and Closing milestones',
  },
  avg_case_time: {
    name: 'Average Case Time',
    requires: ['patient_in', 'patient_out'],
    hint: 'Requires Patient In and Patient Out milestones',
  },
  non_operative_time: {
    name: 'Non-Operative Time',
    requires: ['patient_in', 'incision', 'closing_complete', 'patient_out'],
    hint: 'Requires Patient In, Incision, Closing Complete, and Patient Out milestones',
  },
  surgeon_idle_time: {
    name: 'Surgeon Idle Time',
    requires: ['closing', 'incision'],
    hint: 'Requires Closing and Incision milestones',
  },
  closing_duration: {
    name: 'Closing Duration',
    requires: ['closing', 'closing_complete'],
    hint: 'Requires Closing and Closing Complete milestones',
  },
  pre_incision_time: {
    name: 'Pre-Incision Time',
    requires: ['patient_in', 'incision'],
    hint: 'Requires Patient In and Incision milestones',
  },
  anesthesia_duration: {
    name: 'Anesthesia Duration',
    requires: ['anes_start', 'anes_end'],
    hint: 'Requires Anesthesia Start and Anesthesia End milestones',
  },
  // ... etc
}

// Reverse lookup: milestone_name → metrics that depend on it
export function getAffectedMetrics(milestoneName: string): MetricDependency[]

// Check if facility template supports a given metric
export function templateSupportsMetric(metricKey: string, templateMilestoneNames: string[]): boolean
```

Also includes a `getAffectedMetrics(milestoneName)` reverse-lookup function so the template builder can show "Removing Incision will disable: Surgical Time, Surgical Turnover, Pre-Incision Time, Non-Operative Time."

**Commit:** `feat(milestones): phase 1 - metric dependency registry`

**Test gate:**
1. **Unit:** Registry returns correct dependencies for each metric. Reverse lookup returns correct affected metrics for each milestone.
2. **Integration:** `METRIC_REQUIREMENTS` in dataQuality.ts still works (re-export).
3. **Workflow:** Import registry from a component context — no circular deps.

---

## Phase 2: Remove Template Builder Locks
**Complexity:** Medium
**What:** Remove all lock enforcement from both facility and admin template builders. No milestone or phase is locked. All items are removable and movable.

**Files touched:**
- `lib/template-defaults.ts` — keep constants as "recommended defaults" for pre-population, but remove "required" semantics
- `hooks/useTemplateBuilder.ts` — remove `templateHasRequiredStructure`, `requiredMilestoneItemIds`, `requiredPhaseIds` computations. Remove blocks in `removeMilestone()`, `removePhaseFromTemplate()`, `moveItemToPhase()`, `moveItemToPhaseLocal()`. Keep pre-population in `createTemplate()` using all milestones.
- `hooks/useAdminTemplateBuilder.ts` — same changes as above
- `components/settings/milestones/FlowNode.tsx` — remove Lock icon rendering for `isRequired`, always show X delete button
- `components/settings/milestones/TemplateBuilder.tsx` — remove phase Lock icon, remove `requiredPhaseIds` prop threading
- `components/settings/milestones/SubPhaseIndicator.tsx` — remove Lock icon for required milestones

**Key changes in useTemplateBuilder.ts:**
- Delete the `templateHasRequiredStructure` memo (~lines 277-293)
- Delete `requiredMilestoneItemIds` memo (~lines 296-311)
- Delete `requiredPhaseIds` memo (~lines 313-322)
- In `removeMilestone()`: remove the `requiredMilestoneItemIds.has()` check and toast (~lines 632-635)
- In `removePhaseFromTemplate()`: remove the `requiredPhaseIds.has()` check and toast (~lines 658-660)
- In `moveItemToPhase()`: remove the `requiredMilestoneItemIds.has()` check and toast (~lines 734-736)
- In `moveItemToPhaseLocal()`: remove the check (~line 798)
- In `createTemplate()`: keep pre-population logic but use ALL milestones (not just tier-required ones)
- Remove `isRequired` from the return value / propagated props

**Commit:** `feat(milestones): phase 2 - remove template builder locks`

**Test gate:**
1. **Unit:** `removeMilestone()` succeeds for every milestone including patient_in. `removePhaseFromTemplate()` succeeds for every phase.
2. **Integration:** Creating a new template still pre-populates all milestones. Deleting all milestones from a template works without errors.
3. **Workflow:** Open template builder → remove incision → confirm it's gone → save → reopen → incision is still gone.

---

## Phase 3: Template Builder Removal Warnings
**Complexity:** Medium
**What:** When a user removes a milestone, show a warning toast listing which metrics will be affected. Uses the registry from Phase 1. Warning is informational only — does not block the removal.

**Files touched:**
- `hooks/useTemplateBuilder.ts` — import `getAffectedMetrics()`, show warning toast after removal succeeds
- `hooks/useAdminTemplateBuilder.ts` — same
- Potentially `components/settings/milestones/FlowNode.tsx` — optional: tooltip on milestone showing "Used by: Surgical Time, Turnover" on hover

**Behavior:**
- User clicks X to remove "Incision" → milestone is removed → toast appears:
  "Incision removed. The following metrics will no longer compute: Surgical Time, Surgical Turnover, Pre-Incision Time, Non-Operative Time, Surgeon Idle Time."
- Toast uses `warning` variant (amber), not `error` (red)
- If milestone has no metric dependencies (e.g., `room_cleaned`), no warning toast — just success
- Optional: hover tooltip on each milestone showing "Powers: Surgical Time, Turnover" so users can see impact before removing

**Commit:** `feat(milestones): phase 3 - informed consent warnings on milestone removal`

**Test gate:**
1. **Unit:** Removing a milestone with dependencies shows warning toast with correct metric names. Removing a milestone without dependencies shows no warning.
2. **Integration:** Warning text matches registry. Multiple removals show separate warnings.
3. **Workflow:** Remove incision → see warning listing 5 metrics → remove patient_in → see warning listing 4 different metrics → both removals succeed.

---

## Phase 4: Analytics Empty State Hints
**Complexity:** Medium
**What:** When a metric can't compute because the facility doesn't track required milestones, show the hint text from the registry instead of just "—". This requires knowing which milestones the facility's active template includes.

**Files touched:**
- `lib/hooks/useFacilityTemplate.ts` — NEW or extend existing: hook that returns the facility's default template milestone names (for cross-referencing against registry)
- `components/dashboard/DashboardKpiCard.tsx` — add optional `hint` prop, render hint text when value is "—" or "--"
- `app/dashboard/PageClient.tsx` — pass `hint` prop to KPI cards using registry + template
- `app/analytics/PageClient.tsx` — same for analytics overview metrics
- `app/analytics/kpi/PageClient.tsx` — same for KPI detail page
- `components/analytics/RoomUtilizationCard.tsx` — show hint for hidden turnover section

**DashboardKpiCard changes:**
```typescript
interface DashboardKpiCardProps {
  // ... existing props
  /** Hint shown when value is '--' or '—', explaining what's needed */
  hint?: string
}
```
When `value` is `'—'` or `'--'` and `hint` is provided, render hint below the dash in small slate-400 text.

**How hints are resolved:**
1. Dashboard/analytics page fetches facility's default template milestone names (via hook)
2. For each KPI, calls `templateSupportsMetric(metricKey, templateMilestoneNames)`
3. If false, passes `METRIC_DEPENDENCIES[metricKey].hint` as the `hint` prop
4. If true (template has the milestones), no hint — the "—" means no cases yet, not a config issue

**Commit:** `feat(milestones): phase 4 - analytics empty state milestone hints`

**Test gate:**
1. **Unit:** DashboardKpiCard renders hint text when value is "—" and hint is provided. No hint rendered when value is a real number.
2. **Integration:** With a minimal template (patient_in + patient_out only), Surgical Time card shows "Requires Incision and Closing milestones." OR Utilization card shows no hint (it has the milestones).
3. **Workflow:** Full template → all cards show real values, no hints. Minimal template → appropriate cards show hints, volume/cancellation cards show real values.

---

## Phase 5: Case Count Subtitles (Data Transparency)
**Complexity:** Medium-Large
**What:** Show "Based on X of Y cases" under KPI values when some cases were excluded from the computation due to missing milestone data.

**Files touched:**
- `lib/analyticsV2.ts` — modify computation functions to track and return excluded case counts alongside metric values
- `lib/hooks/useDashboardKPIs.ts` — propagate excluded counts from analytics engine to KPI results
- `components/dashboard/DashboardKpiCard.tsx` — render case count subtitle (uses existing `subtitle` prop)
- `app/dashboard/PageClient.tsx` — wire excluded counts into subtitle
- `app/analytics/PageClient.tsx` — same
- `app/analytics/kpi/PageClient.tsx` — same

**analyticsV2.ts changes:**
- Each computation function (FCOTS, turnover, utilization) currently does `if (x === null) continue`. Add a counter: `excludedCount++` at each skip point.
- Return shape changes from `{ value, displayValue }` to `{ value, displayValue, totalCases, includedCases }`.
- Existing consumers that don't use the new fields are unaffected (additive change).

**Subtitle format:**
- When `includedCases < totalCases`: "Based on {includedCases} of {totalCases} cases"
- When `includedCases === totalCases`: no subtitle (all cases included)
- When `includedCases === 0`: subtitle not shown (hint from Phase 4 takes over)

**Commit:** `feat(milestones): phase 5 - case count subtitles for data transparency`

**Test gate:**
1. **Unit:** Analytics functions return correct `totalCases` and `includedCases` counts. Excluded count matches number of null-skip operations.
2. **Integration:** KPI card subtitle shows correct ratio. Full-milestone facility shows no subtitle (all included). Partial-milestone facility shows "Based on X of Y cases."
3. **Workflow:** Add 10 cases with full milestones + 5 with only patient_in/patient_out → Utilization shows "Based on 15 of 15 cases", Surgical Time shows "Based on 10 of 15 cases."

---

## Phase 6: Polish & Edge Cases
**Complexity:** Small
**What:** Handle edge cases, clean up unused exports, run full test suite, verify no regressions for existing full-milestone facilities.

**Files touched:**
- Various — depends on issues found in testing
- `lib/template-defaults.ts` — clean up exports: rename "REQUIRED_*" constants to "DEFAULT_*" or "RECOMMENDED_*" to match new semantics
- `lib/dataQuality.ts` — update to import from new registry

**Tasks:**
1. Rename `REQUIRED_PHASE_NAMES` → `DEFAULT_PHASE_NAMES`, `REQUIRED_MILESTONE_NAMES` → `DEFAULT_MILESTONE_NAMES` etc. across all importers
2. Verify data quality engine still works (uses templates, not locks)
3. Test empty template edge case (no milestones at all) — all cards show hints, no crashes
4. Test single-milestone template (patient_in only) — partial hints
5. Verify ORbit Score engine handles gracefully (already uses min_case_threshold)
6. Run full `npm run typecheck && npm run lint && npm run test`
7. Manual smoke test on dashboard, analytics, KPI pages

**Commit:** `feat(milestones): phase 6 - polish, rename required to default, edge cases`

**Test gate:**
1. **Unit:** All renamed imports resolve. No TypeScript errors.
2. **Integration:** Data quality alerts still fire for missing milestones based on template expectations.
3. **Workflow:** Create facility with empty template → dashboard loads without errors, all cards show appropriate hints → add milestones one by one → cards progressively show real data.
