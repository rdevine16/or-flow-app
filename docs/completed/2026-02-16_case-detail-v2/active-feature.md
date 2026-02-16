# Feature: Case Detail Page V2 Redesign

## Goal
Redesign the full-page case detail view (`/cases/[id]`) to match the `Examples/case-details-v2.jsx` mockup. Transform the current command-center layout (dark timer cards, milestone grid, cluttered sidebar) into a clean two-column design with light timer chips, a vertical milestone timeline with inline delay/flag logging, a tabbed implant editing panel, and a streamlined sidebar.

## Requirements
1. Two-column layout: main content area + fixed-width sidebar
2. Inline case header with procedure name, status pill, metadata row
3. Light-themed timer chips (total, surgical, progress) with progress bars vs median
4. Vertical milestone timeline with connected nodes (replaces card grid)
5. Inline delay logging per milestone (uses existing `case_flags` delay system)
6. Inline flag display per milestone (system-generated threshold flags shown on their associated milestones)
7. Tab switcher: Milestones | Implants (with progress dots)
8. Implant editing panel using existing `ImplantSection` component (users can add/edit implants)
9. Streamlined sidebar: flip room, surgeon status, team, case activity summary
10. Remove PiP, FAB, PaceProgressBar

## Database Context
- Table: `case_flags` — unified flags table (threshold + delay types), `flag_type`, `severity`, `delay_type_id`, `duration_minutes`, `note`
- Table: `delay_types` — categorized delay reasons (facility-specific lookup)
- Table: `case_implants` — per-case implant sizing (cup, stem, head, liner for hip; femur, tibia, poly, patella for knee)
- Table: `case_milestones` — recorded milestones with timestamps
- Table: `facility_milestones` — milestone configuration per facility
- View: `surgeon_procedure_stats` — median durations for timer comparisons
- View: `surgeon_milestone_stats` — per-milestone medians

## UI/UX
- Route: `/cases/[id]`
- Reference mockup: `Examples/case-details-v2.jsx`
- Key interactions: record milestones, log delays, view flags, edit implants, call flip room patient

## Files Likely Involved
- `app/cases/[id]/page.tsx` — Main page (heavy rewrite)
- `components/cases/ImplantSection.tsx` — Existing implant editing component (integrate as tab)
- `components/cases/CaseFlagsSection.tsx` — Existing delay reporting (adapt for inline timeline)
- `components/cases/MilestoneCard.tsx` — Will be replaced by timeline
- `components/cases/FlipRoomCard.tsx` — Keep, minor style updates
- `components/cases/TeamMember.tsx` — Keep, minor style updates
- `components/cases/CompletedCaseView.tsx` — May unify with active view

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- Existing `ImplantSection` uses auto-save with debounce — keep this behavior
- Flags are both system-generated (threshold) and user-created (delay) — both show on timeline
- Delay types are facility-specific lookups from `delay_types` table
- Completed cases currently render a separate `CompletedCaseView` — need to decide on unification

## Out of Scope
- Breadcrumb nav redesign (keep DashboardLayout)
- Cmd+K search bar (mockup feature not in current app)
- "Pop Out" button (mockup feature)
- Modifying the CaseDrawer (already revamped separately)
- Implant catalog/SKU system (keep existing free-text approach)

## Acceptance Criteria
- [ ] Page matches v2 mockup layout and visual style
- [ ] All existing functionality preserved (record, undo, surgeon left, flip room, staff management)
- [ ] Implants can be added/edited directly from the case detail page
- [ ] Flags and delays display inline on milestone timeline
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
