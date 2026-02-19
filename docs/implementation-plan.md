# Implementation Plan: Case & Flag Analytics Page + Tremor-to-Recharts Migration

## Summary

Replace the current `analytics/flags` page (which incorrectly shows a copy of the general analytics overview) with a dedicated **Case & Flag Analytics** dashboard matching the design spec in `docs/case-flags-analytics-light.jsx`. The new page provides KPIs with sparklines, severity breakdowns, computed pattern detection, trend charts, a day-of-week heatmap, flag rule/delay type breakdowns, surgeon flag distribution, room analysis, recent flagged cases, and drill-through panels.

Additionally, migrate all remaining analytics pages from `@tremor/react` to **Recharts** for library consistency, then remove the Tremor dependency entirely.

## Interview Notes

| # | Decision | Answer |
|---|---|---|
| 1 | Chart library | Recharts — build new page with it, then migrate all analytics pages from Tremor |
| 2 | Pattern insights | Computed from real flag data (day spikes, cascades, trends, concentrations) |
| 3 | Heatmap categories | Map by `flag_rules.category` → FCOTS / Timing / Turnover / Delay buckets |
| 4 | Row click behavior | Drill-through slide-over panels (surgeon detail, case detail, room detail) |
| 5 | Current flags page | Full replace — was a copy/paste mistake of the analytics overview |
| 6 | KPI card pattern | Custom `FlagKPICard` component matching design spec (not reuse DashboardKpiCard) |
| 7 | Migration scope | Same feature branch, split by page (one phase per page) |
| 8 | Branch scope | Flags analytics + Tremor migration together: `feature/flags-analytics-recharts-migration` |

## Design Reference

`docs/case-flags-analytics-light.jsx` — Static React prototype with mock data showing the complete page layout, color system, and component structure.

## Phases

| # | Phase | Complexity | Status |
|---|-------|-----------|--------|
| 1 | Data layer: useFlagAnalytics hook + TypeScript interfaces | Medium | pending |
| 2 | Page shell + custom KPI cards + severity strip | Medium | pending |
| 3 | Charts: flag trend area chart + day-of-week heatmap | Medium | pending |
| 4 | Breakdowns + surgeon table + room analysis cards | Large | pending |
| 5 | Pattern detection engine + recent cases + drill-through panels | Large | pending |
| 6 | Tremor → Recharts: analytics hub page | Small | pending |
| 7 | Tremor → Recharts: surgeons page | Small | pending |
| 8 | Tremor → Recharts: block utilization page | Small | pending |
| 9 | Remove @tremor/react dependency | Small | pending |

See `active-feature.md` for full phase details, file lists, and test gates.
