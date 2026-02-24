# Project: Required Minimum Milestones & Phases for Templates
**Completed:** 2026-02-24
**Branch:** feature/analytics-template-phase-resolution
**Duration:** 2026-02-24 → 2026-02-24
**Total Phases:** 3

## What Was Built
Enforced a minimum set of 4 phases and 8 milestones on every newly created milestone template, for both facility and admin settings pages. New templates are auto-populated with the required structure on creation. The template builder UI disables delete buttons on required items (showing a lock icon instead), and the hooks block removal with toast warnings. Existing templates are grandfathered — no backfill, no enforcement on legacy templates.

Also fixed a bug where the case detail page was re-resolving the template cascade instead of using the stamped `cases.milestone_template_id`, which could cause timeline mismatches between the drawer and the detail page.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Constants + facility hook: `lib/template-defaults.ts`, auto-populate on `createTemplate`, block removal of required items | `4e78c74` |
| 2     | Admin hook + UI: `useAdminTemplateBuilder` same enforcement, FlowNode/SubPhaseIndicator lock icons, PhaseHeader delete protection | `f185366` |
| 3     | Bug fix: case detail page uses `case.milestone_template_id` for timeline resolution | `bff2b10` |

## Key Files Created/Modified
- `lib/template-defaults.ts` (NEW) — shared constants: `REQUIRED_PHASE_NAMES`, `REQUIRED_MILESTONE_NAMES`, `REQUIRED_PHASE_MILESTONES`, helper functions
- `hooks/useTemplateBuilder.ts` — auto-populate on create, block removal, export `requiredMilestoneItemIds`/`requiredPhaseIds`
- `hooks/useAdminTemplateBuilder.ts` — same changes for admin tables
- `components/settings/milestones/TemplateBuilder.tsx` — passes required IDs to canvas, phases, and nodes
- `components/settings/milestones/FlowNode.tsx` — `isRequired` prop hides X button, shows lock icon
- `components/settings/milestones/SubPhaseIndicator.tsx` — same required protection for sub-phase milestones
- `app/cases/[id]/page.tsx` — uses `milestone_template_id` from case data

## Architecture Decisions
- **Match by `name`, not ID** — milestone/phase IDs differ per facility, but `name` is consistent (seeded from `milestone_types`/`phase_templates`). This makes the constants portable across facilities.
- **Grandfather existing templates** — enforcement only applies to templates that contain ALL 8 required milestones in the correct phases. If a template is missing any, it's treated as legacy and no restrictions apply. No DB flag needed.
- **UI + hook validation only** — no DB-level constraints. The hooks are the enforcement layer, with the UI providing visual feedback (lock icons, hidden delete buttons).
- **Both pages share TemplateBuilder** — UI changes in FlowNode/SubPhaseIndicator automatically apply to both facility and admin pages. Only the hooks are separate.

## Database Changes
- No new tables, columns, or migrations
- Bug fix only: added `milestone_template_id` to the case detail page's select query

## Known Limitations / Future Work
- Required set is hardcoded in `template-defaults.ts` — no per-facility customization
- No DB-level enforcement (could add CHECK constraints or triggers in the future)
- No backfill of existing templates — they keep whatever structure they have
- If a facility has custom milestone names that don't match standard `name` values, required enforcement won't apply (graceful degradation)
