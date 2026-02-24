# Feature: Milestone Template Cascade Fix & Existing Case Reconciliation

## Goal
Fix broken milestone display across the app where the 3-tier template cascade (surgeon override → procedure template → facility default) is not being applied consistently. The case creation RPCs already use the full cascade, but the case drawer, case detail page, and analytics RPC only use a 2-step cascade (procedure → default), ignoring surgeon overrides. Additionally, define behavior for when templates change on existing cases.

## Problem Statement

### The 3-Tier Template Cascade (expected everywhere):
```
1. surgeon_template_overrides (surgeon_id + procedure_type_id)   [MOST SPECIFIC]
   ↓ if null
2. procedure_types.milestone_template_id                          [PROCEDURE DEFAULT]
   ↓ if null
3. milestone_templates WHERE is_default = true                    [FACILITY DEFAULT]
```

### Current Status:
| Component | Surgeon Override | Procedure | Default | Status |
|---|---|---|---|---|
| `create_case_with_milestones()` RPC | ✅ | ✅ | ✅ | **CORRECT** |
| `finalize_draft_case()` RPC | ✅ | ✅ | ✅ | **CORRECT** |
| `resolveTemplateForCase()` (phase-resolver.ts) | ✅ | ✅ | ✅ | **CORRECT** |
| `batchResolveTemplatesForCases()` (phase-resolver.ts) | ✅ | ✅ | ✅ | **CORRECT** |
| Demo Generator | ✅ | ✅ | ✅ | **CORRECT** |
| Case Detail page (milestone resolution) | ❌ | ✅ | ✅ | **BROKEN** |
| `useMilestoneComparison` hook (`expectedNames` query) | ❌ | ✅ | ✅ | **BROKEN** |
| `get_milestone_interval_medians()` RPC | ❌ | ✅ | ✅ | **BROKEN** |

### Key Insight
`resolveTemplateForCase()` in `lib/dal/phase-resolver.ts` already implements the full 4-tier cascade (case snapshot → surgeon override → procedure → default). The `useMilestoneComparison` hook already uses it for `phaseDefinitions` and `phaseMedians` queries, but NOT for the `expectedNames` query — that one still has an inline 2-step cascade. The case detail page also has an inline 2-step cascade instead of using the shared resolver.

## Requirements
1. Case detail page must use `resolveTemplateForCase()` instead of inline 2-step cascade
2. `useMilestoneComparison` hook `expectedNames` query must use `resolveTemplateForCase()` instead of inline 2-step cascade
3. `get_milestone_interval_medians()` RPC must add surgeon override check (it already receives `p_surgeon_id`)
4. All reports/analytics pages must accurately reflect template-resolved milestones
5. Define and implement behavior when a template is applied/changed on a procedure type or surgeon that already has existing cases

## Database Context
- Table: `surgeon_template_overrides` — (facility_id, surgeon_id, procedure_type_id) → milestone_template_id
- Table: `procedure_types` — has `milestone_template_id` FK
- Table: `milestone_templates` — `is_default` flag for facility default
- Table: `milestone_template_items` — ordered milestones within a template
- Table: `case_milestones` — per-case milestone instances (created at case creation time)
- Column: `cases.milestone_template_id` — snapshot of which template was used at case creation
- RPC: `get_milestone_interval_medians(p_surgeon_id, p_procedure_type_id, p_facility_id)`
- Resolver: `resolveTemplateForCase()` in `lib/dal/phase-resolver.ts` — already correct

## Existing Case Impact When Templates Change
When a template is applied or changed on a procedure type or surgeon with existing cases:
- **Display (case drawer/detail page)**: Uses `cases.milestone_template_id` snapshot — already correct for stamped cases. Legacy cases fall back to cascade — will show new template.
- **Analytics**: `get_milestone_interval_medians` uses live cascade — reflects current template assignments
- **Case milestones**: Existing `case_milestones` rows are NOT modified. Cases keep their original milestones.
  - If new template has MORE milestones: old cases won't have rows for the new milestones (shows as "missing" in comparison)
  - If new template has FEWER milestones: old cases keep their extra milestone rows (no data lost)
  - This is correct behavior for historical integrity

## Files Likely Involved
- `app/cases/[id]/page.tsx` — replace inline cascade with `resolveTemplateForCase()`
- `lib/hooks/useMilestoneComparison.ts` — replace inline cascade in `expectedNames` with `resolveTemplateForCase()`
- `supabase/migrations/` — new migration to update `get_milestone_interval_medians()` RPC
- `lib/dal/phase-resolver.ts` — already correct, no changes needed
- Reports/analytics pages — audit for template awareness

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- `get_milestone_interval_medians()` already receives `p_surgeon_id` but ignores it for template resolution
- Pre-existing typecheck errors in test files (not blocking)
- Case detail page already has `milestone_template_id` in its select query (fixed in previous session)

## Out of Scope
- Retroactively updating `case_milestones` when templates change (historical integrity preserved)
- Adding a "re-apply template" button to individual cases
- Changing the `create_case_with_milestones` or `finalize_draft_case` RPCs (already correct)

## Acceptance Criteria
- [ ] Case detail page timeline shows correct milestones for surgeon override cases
- [ ] Case drawer milestones tab shows correct milestones for surgeon override cases
- [ ] `get_milestone_interval_medians()` RPC uses full 3-tier cascade including surgeon override
- [ ] `expectedNames` in case drawer matches what `create_case_with_milestones` would create
- [ ] All analytics reports accurately reflect template-resolved milestones
- [ ] Existing cases are NOT modified when templates change (historical integrity)
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
