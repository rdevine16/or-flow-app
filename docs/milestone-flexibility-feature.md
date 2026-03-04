# Feature: Milestone Flexibility & Analytics Transparency

## Goal
Make the milestone template system fully flexible — no locked milestones, no forced structure — so any facility can track exactly the milestones they care about. When a facility doesn't track milestones required by a particular metric, show actionable hints instead of blank dashes, and surface how many cases were excluded from each computation.

## Core Decisions (from user interview)
1. **No locks.** Remove all required milestone/phase locks from both facility and admin template builders. Every milestone is deletable.
2. **Pre-populated but flexible.** New templates still start with all milestones pre-populated. Users can remove any of them.
3. **Milestone hints.** When a metric can't compute (e.g., no Incision → no Surgical Time), show "Requires Incision milestone" instead of just "—".
4. **Case count subtitles.** Show "Based on 45 of 50 cases" under KPI values so users know when data was excluded.
5. **Shared registry.** One file (`lib/metric-dependencies.ts`) maps metrics → required milestones. Powers both template builder warnings and analytics hints.
6. **Warnings, not blocks.** When removing a milestone from a template, show a warning ("Removing Incision disables: Surgical Time, Consistency Score") but let them proceed.
7. **Admin templates too.** Global admin templates are also fully flexible.

## Requirements
1. Milestone-to-metric dependency registry as single source of truth
2. Template builder: remove all lock enforcement, replace with informed-consent warnings
3. Admin template builder: same treatment
4. Analytics empty states: show milestone requirement hints from registry
5. KPI cards: show "Based on X of Y cases" subtitle
6. No regressions — existing full-milestone facilities see no change in behavior

## Database Context
- No schema changes needed — this is purely UI/logic
- `milestone_template_items.is_required` column exists but will no longer be enforced in UI
- `METRIC_REQUIREMENTS` in `lib/dataQuality.ts` is the starting point for the registry (currently unused)

## Files Likely Involved
- `lib/metric-dependencies.ts` — NEW: dependency registry
- `lib/template-defaults.ts` — remove required constants, keep as "recommended" defaults for pre-population
- `hooks/useTemplateBuilder.ts` — remove lock enforcement, add warning system
- `hooks/useAdminTemplateBuilder.ts` — same treatment
- `components/settings/milestones/FlowNode.tsx` — remove lock icons, add warning tooltips
- `components/settings/milestones/TemplateBuilder.tsx` — remove phase lock icons
- `components/dashboard/DashboardKpiCard.tsx` — add hint + case count support
- `app/dashboard/PageClient.tsx` — wire hints and case counts
- `app/analytics/PageClient.tsx` — wire hints and case counts
- `app/analytics/kpi/PageClient.tsx` — wire hints and case counts
- `lib/analyticsV2.ts` — return excluded case counts from computations
- `lib/hooks/useDashboardKPIs.ts` — propagate excluded case counts

## Out of Scope
- Changing how analytics computations handle nulls (the silent-skip pattern stays)
- Data quality engine changes (it already uses templates correctly)
- Milestone coverage dashboard / historical analysis
- Real-time missing milestone alerts
- ORbit Score engine changes (it already handles missing data via min_case_threshold)

## Acceptance Criteria
- [ ] No milestones or phases are locked in facility template builder
- [ ] No milestones or phases are locked in admin template builder
- [ ] Removing a milestone shows warning listing affected metrics
- [ ] New templates still pre-populate with all milestones (all deletable)
- [ ] KPI cards show milestone hint when metric can't compute
- [ ] KPI cards show "Based on X of Y cases" when cases excluded
- [ ] Analytics page metrics show same hints and counts
- [ ] Existing facilities with full milestone templates see no behavior change
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
