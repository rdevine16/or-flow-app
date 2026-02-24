# Feature: Migrate Analytics from phase_definitions to Template-Based Phase Resolution

## Goal
Replace the `phase_definitions` table (which has no management UI since the dedicated phases page was removed) with template-based phase boundary resolution. Phase boundaries are derived from `facility_phases` + `milestone_template_items` (first/last item per phase = start/end boundary). This makes analytics template-aware: different procedures can have different phase structures based on their assigned template.

## Requirements
1. Add `milestone_template_id` to `cases` table to snapshot the template used at case creation (new cases only)
2. Create a SQL resolver function that derives phase boundaries from template items
3. Create a TypeScript adapter that returns `PhaseDefinitionWithMilestones[]` from template resolution (preserves existing utility function interfaces)
4. Rewrite `get_phase_medians` RPC to accept template_id and use template resolution
5. Update all frontend consumers (useMilestoneComparison, surgeons page, SurgeonDetail) to resolve phases from templates per case
6. Stop seeding `phase_definitions` for new facilities
7. Drop `phase_definitions` and `phase_definition_templates` tables

## Database Context
- Table: `facility_phases` — phase library (name, color, order, parent). NO start/end milestone IDs.
- Table: `milestone_template_items` — ordered milestones in template, with `facility_phase_id` assignment
- Table: `milestone_templates` — named templates per facility, `is_default` flag
- Table: `surgeon_template_overrides` — surgeon picks different template per procedure
- Table: `procedure_types.milestone_template_id` — procedure-level template assignment
- RPC: `get_phase_medians()` — currently queries `phase_definitions`, needs rewrite
- RPC: `create_case_with_milestones()` — already uses template cascade, needs to stamp template_id on case
- RPC: `finalize_draft_case()` — same

## Key Design Decisions
- **Per-template phase resolution**: Templates can have different phase structures (some surgeons track 4 phases, others 3 or 2). Each case's analytics uses the phase boundaries from its actual template. The resolver derives boundaries from `milestone_template_items` (first/last item per `facility_phase_id`).
- **Adapter pattern**: New resolver returns `PhaseDefinitionWithMilestones[]` (superset of `PhaseDefInput[]`) with derived start/end milestone IDs. All utility functions (computePhaseDurations, buildPhaseGroups, etc.) keep their existing interface. Smallest blast radius.
- **Subphase support**: Resolver returns both parent and child phases with `parent_phase_id`. Subphase boundaries are nested within parent phase boundaries. Existing UI code (buildPhaseTree, computeSubphaseOffsets) handles rendering.
- **Median scope**: `get_phase_medians` accepts a `p_milestone_template_id` parameter. Phase boundaries come from that template. Medians computed across ALL cases for a procedure (INNER JOIN naturally excludes cases missing boundary milestones).
- **Case template snapshot**: `cases.milestone_template_id` added to record template at creation time. Stamped on new cases only — no backfill. Existing cases use cascade resolution (surgeon override → procedure → facility default).
- **Template cascade for existing cases**: `resolveTemplateForCase` helper checks `cases.milestone_template_id` first, then falls back through cascade. Batch-fetches cascade data (3 queries) for efficiency on multi-case pages.
- **Flag detection exception**: `computeProcedureMedians` on surgeons page uses facility default template (heuristic — consistent phase boundaries for comparison).
- **Drop both tables**: `phase_definitions` AND `phase_definition_templates` (admin-level seeding table, redundant with `phase_templates`)
- **No transition period**: Stop seeding `phase_definitions` immediately; adapter handles everything.
- **Graceful degradation**: Cases with minimal templates that lack phase boundary milestones show a single "Total Case Time" bar instead of phase bars.

## Files Likely Involved
- `supabase/migrations/` — new migration for cases column, resolver function, RPC rewrites, table drops
- `lib/dal/phase-resolver.ts` — NEW: adapter functions (resolvePhaseDefsFromTemplate, resolveDefaultPhaseDefsForFacility)
- `lib/utils/milestoneAnalytics.ts` — unchanged (adapter preserves PhaseDefInput interface)
- `lib/analyticsV2.ts` — unchanged (same reason)
- `lib/hooks/useMilestoneComparison.ts` — update phase_definitions query to use adapter
- `app/analytics/surgeons/page.tsx` — update phase_definitions query to use adapter
- `components/analytics/financials/SurgeonDetail.tsx` — update phase_definitions query to use adapter
- `lib/dal/lookups.ts` — remove `lookupsDAL.phaseDefinitions()` and `PhaseDefinition` interface
- `lib/audit-logger.ts` — remove dead `phaseDefinitionAudit`
- `app/admin/facilities/new/actions.ts` — remove `phase_definitions` from template config
- `app/admin/facilities/new/page.tsx` — remove dead `facility_phase_definitions` count query

## iOS Parity
- [x] iOS can wait (iOS doesn't query phase_definitions directly)

## Known Issues / Constraints
- Shared boundaries (same milestone in 2 adjacent phases) are handled naturally by the resolver
- Cases without a procedure_type (edge case) fall back to facility default template
- The `phase_group` column on `facility_milestones` is a separate legacy field, untouched by this work

## Out of Scope
- Changing the utility function interfaces (computePhaseDurations, buildPhaseGroups, etc.)
- Modifying the template builder UI
- Touching `phase_group` on `facility_milestones`
- Analytics settings or analytics_settings_template tables
- **Interval highlighting within phase bars** — milestones tracked within a phase (e.g., anes_start/anes_end within Pre-Op without a subphase) show in the milestone interval table but not as visual marks within the phase bar. Future enhancement: add translucent interval marks or tooltip data within phase bars to surface within-phase timing data.

## Acceptance Criteria
- [ ] `phase_definitions` and `phase_definition_templates` tables dropped
- [ ] `cases.milestone_template_id` stamped on new cases (no backfill; cascade for existing)
- [ ] Phase durations computed correctly from per-template resolution
- [ ] `get_phase_medians` RPC returns correct data using template resolver (4-param: + `p_milestone_template_id`)
- [ ] All analytics pages (surgeons, financials, case drawer) render phase data per template
- [ ] Minimal templates gracefully degrade to single "Total Case Time" bar
- [ ] Subphases resolve correctly (parent + child boundaries, nested rendering)
- [ ] New facility creation works without `phase_definitions` seeding
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced

## Review Q&A

> Generated by /review on 2026-02-23

**Q1:** The plan calls for both a SQL function `resolve_template_phase_boundaries(p_template_id)` AND a TypeScript adapter `resolvePhaseDefsFromTemplate()`. Should the TypeScript adapter call the SQL function via RPC, or do its own client-side query?
**A1:** TS calls SQL function via RPC. Single source of truth for boundary resolution — any fix to the SQL function automatically fixes both server-side and client-side.

**Q2:** `useMilestoneComparison` needs `PhaseDefinitionWithMilestones[]` with nested `start_milestone`/`end_milestone` objects. The SQL function returns flat IDs. Should we expand the SQL return type, do a follow-up query, or simplify the interface?
**A2:** Expand SQL function return type. Add `start_milestone_name`, `start_milestone_display_name`, `start_milestone_display_order` (and same for end) to the RETURNS TABLE. The TS adapter reshapes flat columns into nested objects.

**Q3:** Shared phase boundaries — two `milestone_template_items` rows for the same milestone (one per phase). MIN/MAX display_order per phase produces correct start/end boundaries. Is this the correct model?
**A3:** Yes, confirmed. Phase A's end_milestone = Phase B's start_milestone for shared boundaries.

**Q4:** The facility creation wizard (`page.tsx:157`) queries `facility_phase_definitions` — a table that doesn't exist in any migration. This query silently returns 0. Should we delete it or replace it?
**A4:** Delete entirely. Remove the query, the `phaseDefinitions` count state, and any UI that displays it.

**Q5:** (Initial question) Do surgeons customize phase boundaries (where phases start/end), or just which milestones are tracked within the standard phases?
**A5 (initial):** Same boundaries, different milestones within.
**A5 (REVISED after follow-up discussion):** Templates CAN have different phase structures. A surgeon who doesn't care about closing time might have 3 phases (Pre-Op, Surgical, Post-Op) instead of 4. The template builder allows this — phases with no assigned items simply don't appear in the resolver output. **Per-template phase resolution is needed for display consumers.**

**Q6:** Do we still need `cases.milestone_template_id`?
**A6:** Yes — add column, stamp on new cases, no backfill. For existing cases, cascade resolution at query time (surgeon override → procedure → facility default). The `resolveTemplateForCase` helper batch-fetches cascade data (3 queries) for efficiency.

**Q7:** `get_phase_medians` RPC — keep existing 3-param signature or add template_id?
**A7 (REVISED):** DROP + recreate with 4 params: `(p_facility_id, p_procedure_type_id, p_surgeon_id, p_milestone_template_id)`. Caller passes the case's template ID. RPC uses `resolve_template_phase_boundaries(p_milestone_template_id)` for phase boundaries. Medians computed across ALL cases for the procedure (INNER JOIN naturally excludes cases missing boundary milestones).

**Q8:** Surgeons page — how should it resolve phases?
**A8 (REVISED):** Per-case template resolution. Collect unique `milestone_template_id` values from the day's cases, call `resolve_template_phase_boundaries` once per unique template (client-side dedup + N RPC calls), build a Map<templateId, PhaseDefInput[]>, then look up per case.

**Q9:** `computeProcedureMedians` on the surgeons page — per-procedure or facility default?
**A9:** Facility default for flag detection. Flag detection is a heuristic — consistent phase boundaries across all procedures is fine.

**Q10:** Batch-resolve approach for surgeons page?
**A10 (REVISED):** Client-side dedup + N RPC calls. Collect unique template IDs from day's cases (2-3 max), resolve each once. Build Map for lookup. For cases without `milestone_template_id`, batch-fetch cascade data (surgeon overrides, procedure templates, facility default) in 3 queries and resolve per case in memory.

**Q11:** PART 14 in `seed_facility_with_templates` calls `seed_facility_phases()`. Should we remove just the PART 14 block, or also DROP the `seed_facility_phases()` function?
**A11:** Remove PART 14 block + DROP function + drop `on_facility_created_seed_phases` trigger (if it still exists). Clean removal in Phase 1.

**Q12:** Where should the TypeScript adapter functions live?
**A12:** New file: `lib/dal/phase-resolver.ts`. Clean separation from the already-large `lookups.ts`.

**Q13:** The `actions.ts` passes `phase_definitions` in template_config. Once PART 14 is removed, should we clean up the TS config too?
**A13:** Remove from TS config. Remove key from `actions.ts`, the `phaseDefinitions` field from the type, and the toggle/count in the wizard UI.

**Q14:** `useMilestoneComparison` needs template ID for phases. Should we add a `milestoneTemplateId` prop or fetch inside the hook?
**A14 (REVISED):** Add `milestoneTemplateId` prop. Parent component (case drawer) already has the case object and can pass `case.milestone_template_id`. If not provided, the hook resolves via cascade.

**Q15:** The `expectedNames` query in `useMilestoneComparison` resolves the case's actual template for milestone presence. Should it also switch to facility default?
**A15:** Keep per-procedure resolution for `expectedNames`. Milestone PRESENCE is about which milestones the case's template expects — different from phase BOUNDARIES. A minimal template should only flag its own milestones as expected.

**Q16:** Test files reference `phase_definitions` in comments. Should we update?
**A16:** Leave tests unchanged. Tests test pure utility functions with `PhaseDefInput[]` mock data. Valid regardless of where phases come from. Adapter gets its own tests.

**Q17:** Should we consolidate the 3 phases given the simplifications?
**A17:** Keep 3 phases. Each is independently committable and revertable. Follows established project patterns.

**Q18:** Should the adapter return `PhaseDefInput[]` or `PhaseDefinitionWithMilestones[]`?
**A18:** Return `PhaseDefinitionWithMilestones[]` always. It's a superset — TypeScript structural typing means it satisfies both interfaces. One function, one return type.

**Q19:** Should we provide a convenience function `resolveDefaultPhaseDefsForFacility(supabase, facilityId)` or require consumers to find the default template themselves?
**A19:** Convenience function. Also export the lower-level `resolvePhaseDefsFromTemplate(supabase, templateId)` for direct use.

**Q20:** Should the adapter also have a hook wrapper (e.g., `usePhaseDefinitions`)?
**A20:** Standalone async function only. Each consumer calls it inside their existing data-fetching pattern.

**Q21:** Edge case: facility has no default milestone template. What should happen?
**A21:** Return empty phases, no error. Analytics pages gracefully degrade — no phase bars, just interval-level data. Existing code already handles `phaseDefinitions.length === 0` with fallback rendering.

**Q22:** `get_phase_medians` — should it DROP + recreate or use CREATE OR REPLACE?
**A22:** DROP + recreate. Same 3-param signature but new implementation. Clean — no orphaned overloads.

**Q23:** SQL config cleanup — should we add a comment noting the removed PART 14, or just delete it?
**A23:** Remove the PART 14 block entirely. No comment needed — migration history tells the story.

**Q24:** `SurgeonDetail` component — facility default or per-case template resolution?
**A24 (REVISED):** Per-case template resolution (consistent with surgeons page and case drawer after Q5 revision).

**Q25:** Backfill strategy for existing cases' `milestone_template_id`?
**A25:** No backfill. Always cascade at query time for cases without `milestone_template_id`. The `resolveTemplateForCase` helper batch-fetches cascade data (surgeon overrides, procedure templates, facility default) in 3 queries and resolves per case in memory.

**Q26:** Subphases — how do they work with the resolver?
**A26:** Subphases work naturally. `milestone_template_items` can assign items to child phases. The resolver groups by `facility_phase_id` and returns both parent and child phases with `parent_phase_id`. Parent phase boundaries span the full range, subphase boundaries are nested within. Existing UI code (buildPhaseTree, computeSubphaseOffsets) handles rendering.

**Q27:** Surgeons page phase legend — how to handle varying phase structures across cases on the same day?
**A27:** Union of all phases from the day's cases. Collect all unique phases across all resolved templates. Legend shows all of them. Cases without a particular phase simply have no bar for it.

**Q28:** Cases with minimal templates (e.g., patient_in → patient_out only) — phase bars show nothing. What should happen?
**A28:** Show a single "Total Case Time" bar synthesized from first to last recorded milestone. Small UI addition when all phase durations are null.

**Q29:** Revised overall approach confirmation — per-template resolution for display, facility default for flag detection, 4-param get_phase_medians, milestoneTemplateId prop, forward-only case column, no backfill with cascade fallback?
**A29:** Confirmed. Proceed with this approach.

**Q30:** Milestones tracked within a phase without a subphase (e.g., anes_start/anes_end in Pre-Op) — anesthesia time shows in milestone interval table but not as a phase bar. Should we add interval highlighting within phase bars?
**A30:** Yes, but deferred to a follow-up feature. This migration is about replacing phase_definitions with template resolution. Interval highlighting is a new analytics enhancement — added to Out of Scope section as a noted future item.
