# Project: Flag Settings Rebuild + Custom Rule Builder
**Completed:** 2026-02-20
**Branch:** feature/flag-settings-custom-builder
**Duration:** 2026-02-19 → 2026-02-20
**Total Phases:** 7

## What Was Built
Rebuilt the flag settings page from a simple expandable-card layout into a full-featured rule management interface with inline editing, category filtering, and a custom rule builder. The centerpiece is a two-step slide-over drawer that lets facility admins create flag rules from a catalog of 22+ metrics spanning timing, efficiency, financial, and quality categories.

The flag engine was extended to evaluate financial metrics (from `case_completion_stats`), quality metrics (missing milestones, sequence errors), and three new threshold types (percentage_of_median, percentile, between). A DAL layer was added for all flag rule CRUD operations with full audit logging.

Cost category cross-referencing was added so archiving a cost category automatically cascades to archive linked flag rules, with a confirmation dialog listing affected rules.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Types, constants, design tokens & flag_rules migration | e377e38 |
| 2     | Table layout rebuild with inline editing and category filter | 1464633 |
| 2t    | Phase 2 tests | 341d6f5 |
| 3     | Custom rule builder slide-over drawer with metrics catalog | ba69949 |
| 4     | Custom rule CRUD with audit logging and archive | c2aeb0b |
| 5     | Flag engine extension for financial, quality & new threshold types | b914dad |
| 6     | Analytics updates, legend section & polish | 74848fb |
| 7     | Cost category cross-reference and auto-archive cascade | 103db77 |

## Key Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `types/flag-settings.ts` | Shared FlagRule type, MetricCatalogEntry, builder form types |
| `lib/constants/metrics-catalog.ts` | METRICS_CATALOG (22 static metrics), OPERATORS, THRESHOLD_TYPES, METRIC_CATEGORIES |
| `lib/dal/flag-rules.ts` | Flag rule CRUD, baselines, cost-category cross-reference |
| `components/settings/flags/FlagRuleTable.tsx` | CSS Grid table container with header row |
| `components/settings/flags/FlagRuleRow.tsx` | Single rule row with all inline editing |
| `components/settings/flags/ThresholdInline.tsx` | Inline threshold editor (type + operator + value + computed display) |
| `components/settings/flags/SeverityPills.tsx` | Cycling severity button (info → warning → critical) |
| `components/settings/flags/ScopeBadge.tsx` | Facility/Personal badge selector |
| `components/settings/flags/CategoryFilter.tsx` | Segmented control filter bar |
| `components/settings/flags/MetricSearchBuilder.tsx` | Slide-over drawer with 2-step builder flow |
| `components/settings/flags/MetricSearchStep.tsx` | Step 1: search + category-grouped metrics |
| `components/settings/flags/RuleConfigureStep.tsx` | Step 2: rule configuration form |
| `components/settings/flags/RulePreviewSentence.tsx` | Natural-language rule preview |
| `supabase/migrations/20260219000000_flag_rules_soft_delete_and_threshold_max.sql` | Soft-delete + threshold_value_max + cost_category_id |

### Modified Files
| File | Changes |
|------|---------|
| `app/settings/flags/page.tsx` | Complete rewrite: CSS Grid layout, builder integration, CRUD, legend |
| `lib/design-tokens.ts` | Added financial (emerald) and quality (indigo) to categoryColors |
| `lib/flagEngine.ts` | Extended for financial/quality extractors + 3 new threshold types |
| `lib/audit-logger.ts` | Added flagRuleAudit namespace |
| `app/analytics/flags/page.tsx` | Handle financial/quality categories |
| `app/settings/financials/cost-categories/page.tsx` | Cascade archive confirmation |

## Architecture Decisions
- **Metrics catalog is a TypeScript constant, not a DB table.** Avoids migration for catalog changes and keeps the builder self-contained. 22 metrics defined in `lib/constants/metrics-catalog.ts`.
- **SeverityPills is a single cycling button** (not 3 separate pills). Cycles info → warning → critical on click. More compact for the inline table layout.
- **CSS Grid for table layout** (not HTML `<table>` or flex). Exact column alignment across rows via `grid-template-columns`.
- **Slide-over drawer for builder** (not modal or inline). Matches existing FlagDrillThrough pattern.
- **Archive instead of delete** for custom rules. Full soft-delete pattern with `is_active`, `deleted_at`, `deleted_by` columns and `sync_soft_delete_columns()` trigger.
- **Cost category cascade is app-layer only.** Confirmation dialog lists affected rules before archiving. Restoring a cost category does NOT auto-restore linked flag rules.
- **Financial metric source** uses aggregated columns from `case_completion_stats` plus dynamic per-cost-category metrics from `cost_categories`.

## Database Changes
| Migration | Changes |
|-----------|---------|
| `20260219000000_flag_rules_soft_delete_and_threshold_max.sql` | Added `is_active` (boolean, default true), `deleted_at` (timestamptz), `deleted_by` (uuid FK auth.users), `threshold_value_max` (numeric), `cost_category_id` (uuid FK cost_categories) to `flag_rules`. Added `sync_flag_rules_soft_delete` trigger. |

## Known Limitations / Future Work
- Per-cost-category financial metrics resolve costs from `procedure_cost_items`/`surgeon_cost_items` with effective dating — may need optimization for large datasets
- `percentile` threshold type requires full dataset scan per evaluation — consider pre-computing percentile boundaries
- No drag-and-drop rule ordering (creation order only, by design)
- `room_idle_gap` computed metric requires adjacent case data in the same room — gap analysis may miss cases not loaded in the current batch
- Dynamic cost category metrics vary per facility — empty state handled gracefully when no cost categories exist
