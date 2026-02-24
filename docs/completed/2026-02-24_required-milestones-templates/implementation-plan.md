# Implementation Plan: Required Minimum Milestones & Phases for Templates

## Summary
Enforce a minimum set of 4 phases and 8 milestones on new templates. Pre-populate on creation, block removal in UI + hooks. Grandfather existing templates.

## Phase 1: Constants + Hook Logic (Facility)
**Complexity:** Medium
**Commit:** `feat(templates): phase 1 - required milestones constants, auto-populate + block removal`

### What it does
1. **Create `lib/template-defaults.ts`** — shared constants:
   - `REQUIRED_PHASE_NAMES`: `['pre_op', 'surgical', 'closing', 'post_op']`
   - `REQUIRED_MILESTONE_NAMES`: `['patient_in', 'prep_drape_start', 'prep_drape_complete', 'incision', 'closing', 'closing_complete', 'patient_out']`
   - `REQUIRED_PHASE_MILESTONES`: map of phase name → ordered milestone names (including shared boundaries)
   - `isRequiredMilestone(milestoneName: string): boolean`
   - `isRequiredPhase(phaseName: string): boolean`
   - `getRequiredPhaseForMilestone(milestoneName: string): string[]` — returns which phases require this milestone

2. **Update `hooks/useTemplateBuilder.ts`**:
   - **`createTemplate`**: After inserting the template, look up phase IDs from `phases` (match by `name`), look up milestone IDs from `milestones` (match by `name`), bulk-insert `milestone_template_items` for each required milestone in its required phase(s). Set `sub_phase_map` to `{}` (no nesting). Set `emptyPhaseIds` for the 4 phases. Update optimistic state.
   - **`removeMilestone`**: Before removing, check if the item's milestone `name` is in `REQUIRED_MILESTONE_NAMES` AND the template was created with required milestones (detect via a flag or by checking if all 8 exist). If required, show toast "This milestone is required and cannot be removed" and return early.
   - **`removePhaseFromTemplate`**: Same check — if phase `name` is in `REQUIRED_PHASE_NAMES` and template has required structure, block with toast.
   - **Export `requiredMilestoneItemIds` and `requiredPhaseIds`** — computed Sets of actual DB IDs for the current template's required items (used by UI to disable delete buttons).

3. **Approach for "grandfathering"**: A template is considered "has required structure" if it was created after this change. Simplest approach: check if the template contains ALL 8 required milestones in the correct phases. If it does → enforce. If it doesn't → don't enforce (existing template). This naturally grandfathers old templates without needing a DB flag.

### Files touched
- `lib/template-defaults.ts` (new)
- `hooks/useTemplateBuilder.ts` (modify)

### Test gate
1. **Unit:** `isRequiredMilestone` / `isRequiredPhase` return correct values; constants are complete
2. **Integration:** `createTemplate` auto-populates items; `removeMilestone` blocks required items; `removePhaseFromTemplate` blocks required phases
3. **Workflow:** Create new template → verify 4 phases + 8 milestones → try to remove required milestone → blocked → add extra milestone → remove it → works

---

## Phase 2: Admin Hook + UI Updates
**Complexity:** Medium
**Commit:** `feat(templates): phase 2 - admin hook, UI delete protection`

### What it does
1. **Update `hooks/useAdminTemplateBuilder.ts`**:
   - Same changes as facility hook but targeting admin tables (`milestone_template_types`, `milestone_template_type_items`, `milestone_types`, `phase_templates`)
   - Same `createTemplate` auto-population, `removeMilestone` blocking, `removePhaseFromTemplate` blocking
   - Export `requiredMilestoneItemIds` and `requiredPhaseIds`

2. **Update `components/settings/milestones/TemplateBuilder.tsx`**:
   - Accept `requiredMilestoneItemIds: Set<string>` and `requiredPhaseIds: Set<string>` from builder return value
   - Pass to `BuilderCanvas` → `PhaseGroupSegment` → `PhaseHeader` (disable X button) and `EdgeMilestone`/`InteriorMilestone` (disable X button)
   - Pass to `UnassignedSegment` → `UnassignedMilestone` (disable X button)

3. **Update `components/settings/milestones/FlowNode.tsx`**:
   - Add `isRequired?: boolean` prop to `EdgeMilestone`, `InteriorMilestone`, `UnassignedMilestone`
   - When `isRequired` is true: hide the X (delete) button entirely, show a small lock icon or "Required" badge on hover instead

4. **Update `components/settings/milestones/SubPhaseIndicator.tsx`**:
   - Same `isRequired` prop for milestones inside sub-phases

5. **Update `PhaseHeader` in `TemplateBuilder.tsx`**:
   - Add `isRequired?: boolean` prop
   - When true: hide X button, optionally show lock icon

### Files touched
- `hooks/useAdminTemplateBuilder.ts` (modify)
- `components/settings/milestones/TemplateBuilder.tsx` (modify)
- `components/settings/milestones/FlowNode.tsx` (modify)
- `components/settings/milestones/SubPhaseIndicator.tsx` (modify)

### Test gate
1. **Unit:** Admin `createTemplate` auto-populates; admin `removeMilestone` blocks required; FlowNode hides X when `isRequired=true`
2. **Integration:** Facility builder shows lock/no-X on required items; admin builder same
3. **Workflow:** Create template on admin page → verify pre-populated → try remove required → blocked → create on facility page → same behavior

---

## Phase 3: Bug Fix — Case Detail Page milestone_template_id
**Complexity:** Small (ALREADY DONE — just needs commit + test verification)
**Commit:** `fix(cases): use case.milestone_template_id for timeline resolution`

### What was done (this session)
- Added `milestone_template_id` to CaseData interface and select query in `app/cases/[id]/page.tsx`
- Template resolution now uses stamped `milestone_template_id` first, falls back to cascade only for legacy cases
- Root cause: page did 2-step cascade (procedure → default) while RPC uses 3-step (surgeon override → procedure → default)

### Files touched
- `app/cases/[id]/page.tsx` (already modified)

### Test gate
1. **Unit:** Page selects milestone_template_id from case
2. **Integration:** New scheduled case with surgeon override shows correct milestones in both drawer and timeline
3. **Workflow:** Open Case #CO-260129-S1451 → verify timeline matches drawer milestones

---

## Dependency Graph
```
Phase 1 (constants + facility hook) ──► Phase 2 (admin hook + UI)
Phase 3 (bug fix) — independent, already done
```

---

## Session Log
<!-- Entries added by /wrap-up -->

### Session — 2026-02-24, pre-plan
- **What was done:** Archived analytics-template-phase-resolution project. Fixed case detail page milestone_template_id bug. Explored template builder codebase. Wrote feature spec and implementation plan for required milestones.
- **Files changed:** `app/cases/[id]/page.tsx` (bug fix), `docs/active-feature.md`, `docs/implementation-plan.md`
- **Bug fix:** Case detail page now uses `cases.milestone_template_id` directly instead of re-resolving template cascade
- **Context usage:** high (93%)
