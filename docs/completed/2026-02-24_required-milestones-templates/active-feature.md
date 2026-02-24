# Feature: Required Minimum Milestones & Phases for Templates

## Goal
Enforce a minimum set of milestones and phases on every milestone template. New templates are pre-populated with 4 phases and 8 milestones. Existing templates are grandfathered. Users can add milestones/phases but cannot remove the required ones.

## Requirements
1. New templates (facility + admin) auto-populate with 4 phases and 8 required milestones pre-placed
2. Template builder UI disables delete (X button) on required milestones and required phases
3. `removeMilestone` and `removePhaseFromTemplate` hooks block removal of required items (with toast warning)
4. Existing templates are grandfathered — no backfill, no enforcement on old templates
5. Works on both facility settings (`/settings/milestones`) and admin settings (`/admin/settings/milestones`)

## Required Structure

**Pre-Op Phase** (name: `pre_op`):
- Patient In (name: `patient_in`)
- Prep/Drape Start (name: `prep_drape_start`)
- Prep/Drape Complete (name: `prep_drape_complete`)

**Surgical Phase** (name: `surgical`):
- Incision (name: `incision`)
- Closing (name: `closing`) — shared boundary with Closing phase

**Closing Phase** (name: `closing`):
- Closing (name: `closing`) — shared boundary with Surgical phase
- Closing Complete (name: `closing_complete`)

**Post-Op Phase** (name: `post_op`):
- Closing Complete (name: `closing_complete`) — shared boundary with Closing phase
- Patient Out (name: `patient_out`)

**8 unique milestones, 4 phases, 2 shared boundaries** (closing, closing_complete).

## Database Context
- Milestones matched by `name` field on `facility_milestones` (facility) or `milestone_types` (admin)
- Phases matched by `name` field on `facility_phases` (facility) or `phase_templates` (admin)
- Template items table: `milestone_template_items` (facility) or `milestone_template_type_items` (admin)
- No new DB tables or migrations needed — this is purely UI + hook logic

## Key Design Decisions
- **Match by `name`, not ID** — milestone/phase IDs differ per facility, but `name` is consistent (seeded from `milestone_types`/`phase_templates`)
- **Grandfather existing** — only new templates get the required minimums. No retroactive enforcement.
- **UI + hook validation** — template builder grays out delete on required items, hooks block removal with toast. No DB-level constraint.
- **Both pages** — facility settings and admin settings share the same `TemplateBuilder` component, so UI changes apply to both. Hooks are separate (`useTemplateBuilder` vs `useAdminTemplateBuilder`).
- **Sub-phase map** — the 4 required phases are top-level (no nesting). Users can add sub-phases freely.

## Files Likely Involved
- `lib/template-defaults.ts` — NEW: constants defining required phases/milestones, helper functions
- `hooks/useTemplateBuilder.ts` — update `createTemplate`, `removeMilestone`, `removePhaseFromTemplate`
- `hooks/useAdminTemplateBuilder.ts` — same updates for admin version
- `components/settings/milestones/TemplateBuilder.tsx` — pass `requiredItemIds`/`requiredPhaseIds`, disable delete
- `components/settings/milestones/FlowNode.tsx` — accept `isRequired` prop, hide X button when true
- `components/settings/milestones/SubPhaseIndicator.tsx` — same for sub-phase milestone delete buttons

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- Requires phases and milestones to exist in facility library before creating template (they should — seeded by `seed_facility_with_templates`)
- If a facility has custom milestone names that don't match the standard `name` values, required enforcement won't apply (graceful degradation)

## Out of Scope
- DB-level enforcement (triggers/constraints)
- Backfilling existing templates
- Changing the required set per facility (hardcoded for now)

## Acceptance Criteria
- [ ] New template created on facility page has 4 phases + 8 milestones pre-placed
- [ ] New template created on admin page has 4 phases + 8 milestones pre-placed
- [ ] Cannot remove required milestones (X button hidden, hook blocks with toast)
- [ ] Cannot remove required phases (X button hidden, hook blocks with toast)
- [ ] Can still add additional milestones and phases freely
- [ ] Can still reorder milestones within phases (including required ones)
- [ ] Existing templates are unaffected (can still remove anything)
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
