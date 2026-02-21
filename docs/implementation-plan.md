# Implementation Plan: Facility Creation Wizard Redesign

## Summary
Rebuild the facility creation wizard from a 1,555-line monolithic page into a decomposed 5-step wizard with full shadcn/ui integration. Extend the `seed_facility_with_templates()` RPC to accept a JSONB config parameter, consolidating all 13+ template categories into a single atomic database call. Remove inline template copying from the frontend entirely.

## Interview Notes
- **Backend strategy**: Single RPC with JSONB config — `seed_facility_with_templates(facility_id, template_config)`. Atomic transaction, single source of truth.
- **OR Rooms**: Removed from wizard. Will be handled by a separate "get started" section on the new facility dashboard.
- **Template previews**: Count only (e.g., "Flag Rules (32)"). No expandable item lists.
- **Wizard steps**: 5 steps — Facility Details → Administrator → Clinical Templates → Operational Templates → Review & Create.
- **Admin user**: Required. Cannot skip the administrator step.
- **Default state**: All template categories selected by default. Admin can deselect what they don't want.
- **UI framework**: Full shadcn/ui — Input, Select, Checkbox, Card, Badge, Button, etc.
- **Architecture**: Step components — each step is its own file with a parent WizardShell managing state and navigation.
- **RPC design**: Extend existing function with `template_config JSONB` parameter. Each section wrapped in `IF (template_config->>'key')::boolean THEN ... END IF`.

---

## Phase 1: Database — Extend `seed_facility_with_templates()` RPC
**Complexity**: Medium

### What it does
Extend the `seed_facility_with_templates()` function to:
1. Accept a `template_config JSONB` parameter (with sensible defaults so existing callers still work)
2. Add missing template categories that the frontend currently handles but the RPC doesn't:
   - Delay types (from `delay_types` where `facility_id IS NULL`)
   - Cost categories (from `cost_category_templates`)
   - Implant companies (from `implant_companies` where `facility_id IS NULL`)
   - Complexities (from `complexity_templates`)
   - Cancellation reasons (from `cancellation_reason_templates`)
   - Pre-op checklist fields (from `preop_checklist_field_templates`)
3. Wrap each section in a conditional: `IF COALESCE((template_config->>'milestones')::boolean, true) THEN ... END IF`
4. Include phase definitions seeding (call `seed_facility_phases()`) as a conditional section
5. Remove any facility creation trigger that auto-calls this function (the wizard will call it explicitly)
6. Ensure permissions seeding still works (separate trigger or include in RPC)

### Files touched
- `supabase/migrations/YYYYMMDD_extend_seed_facility_templates.sql` (new migration)

### Commit message
`feat(db): extend seed_facility_with_templates with JSONB config and missing template categories`

### 3-stage test gate
1. **Unit**: Call the RPC with various config combinations via SQL — verify correct tables are populated/skipped
2. **Integration**: Create a facility via RPC, then query each target table to confirm data was seeded correctly
3. **Workflow**: Create facility with all templates → verify all 13 categories populated. Create with some disabled → verify those tables are empty

---

## Phase 2: Wizard Scaffold — WizardShell, Types, Step Stubs
**Complexity**: Medium

### What it does
Create the decomposed wizard architecture:
1. `types.ts` — shared interfaces: `FacilityData`, `AdminData`, `TemplateConfig`, `WizardState`
2. `page.tsx` — WizardShell component with:
   - 5-step progress indicator (numbered steps with labels, active/completed/upcoming states)
   - Step navigation (Back/Continue/Create buttons)
   - Shared state management via `useState` lifted to shell
   - Step validation gating (can't advance past invalid steps)
   - shadcn Card wrapper for each step content area
3. Stub step components that render placeholder content:
   - `FacilityStep.tsx`
   - `AdminStep.tsx`
   - `ClinicalTemplatesStep.tsx`
   - `OperationalTemplatesStep.tsx`
   - `ReviewStep.tsx`
4. `actions.ts` — submission logic skeleton (facility creation + RPC call + invite API)

### Files touched
- `app/admin/facilities/new/page.tsx` (rewrite)
- `app/admin/facilities/new/types.ts` (new)
- `app/admin/facilities/new/actions.ts` (new)
- `app/admin/facilities/new/FacilityStep.tsx` (new)
- `app/admin/facilities/new/AdminStep.tsx` (new)
- `app/admin/facilities/new/ClinicalTemplatesStep.tsx` (new)
- `app/admin/facilities/new/OperationalTemplatesStep.tsx` (new)
- `app/admin/facilities/new/ReviewStep.tsx` (new)

### Commit message
`feat(wizard): scaffold 5-step facility creation wizard with step components`

### 3-stage test gate
1. **Unit**: Each stub renders without crashing, WizardShell renders progress indicator
2. **Integration**: Step navigation works — clicking Continue advances, Back goes back, disabled states work
3. **Workflow**: Navigate through all 5 steps and back — verify progress indicator updates correctly

---

## Phase 3: Steps 1 & 2 — Facility Details + Administrator
**Complexity**: Medium

### What it does
Implement the full UI for the first two wizard steps using shadcn/ui:

**Step 1 — Facility Details:**
- Facility name (shadcn Input, required)
- Facility type (shadcn Select: ASC, Hospital, etc.)
- Phone number (shadcn Input, auto-formatted)
- Address fields: Street, Suite/Building, City, State (Select), ZIP
- Timezone (shadcn Select with all US timezones, required)
- Subscription status (radio group: Trial / Active)
- Trial length (Select, conditional on Trial selected)

**Step 2 — Administrator:**
- First name, Last name (shadcn Input, required)
- Email (shadcn Input, email validation, required)
- Role (shadcn Select, auto-populated from `user_roles`, required)
- Info banner about invite email
- Send Welcome Email toggle (shadcn Checkbox)

**Validation:**
- Step 1: name + timezone required to advance
- Step 2: firstName + lastName + email (with @) + roleId required to advance

### Files touched
- `app/admin/facilities/new/FacilityStep.tsx` (implement)
- `app/admin/facilities/new/AdminStep.tsx` (implement)
- `app/admin/facilities/new/types.ts` (finalize interfaces)

### Commit message
`feat(wizard): implement facility details and administrator steps with shadcn/ui`

### 3-stage test gate
1. **Unit**: Each field renders, accepts input, validates correctly
2. **Integration**: Validation prevents advancing when required fields are empty, allows advancing when valid
3. **Workflow**: Fill Step 1 → advance → fill Step 2 → advance → go back → data persists

---

## Phase 4: Steps 3 & 4 — Clinical Templates + Operational Templates
**Complexity**: Large

### What it does
Implement the template selection steps with grouped category cards:

**Step 3 — Clinical Templates:**
- Section: "Clinical Data" — Milestones, Procedures, Procedure-Milestone Config (auto-linked note)
- Section: "Workflow & Policies" — Delay Types, Cancellation Reasons, Complexities, Pre-Op Checklist Fields

**Step 4 — Operational Templates:**
- Section: "Financial" — Cost Categories, Implant Companies, Payers
- Section: "Analytics & Alerts" — Analytics Settings, Flag Rules, Phase Definitions, Notification Settings

**Each template card shows:**
- shadcn Checkbox (checked by default)
- Icon (lucide-react)
- Category name
- Item count fetched from the template table
- Disabled state when count is 0

**Features:**
- "Select All" / "Deselect All" toggle per section
- Master "Select All" / "Deselect All" at the top of each step
- Counts fetched on mount via parallel Supabase queries
- Loading skeleton while counts load
- Procedure-Milestone Config auto-toggles with both Milestones and Procedures

### Files touched
- `app/admin/facilities/new/ClinicalTemplatesStep.tsx` (implement)
- `app/admin/facilities/new/OperationalTemplatesStep.tsx` (implement)
- `app/admin/facilities/new/types.ts` (add TemplateCategory type)

### Commit message
`feat(wizard): implement clinical and operational template selection steps`

### 3-stage test gate
1. **Unit**: Template cards render with counts, checkboxes toggle, select all works
2. **Integration**: Template config state propagates to parent WizardShell, persists across step navigation
3. **Workflow**: Select all → deselect a few → advance to review → go back → selections persist

---

## Phase 5: Step 5 — Review & Create + Full Submission
**Complexity**: Large

### What it does
Implement the review step and complete submission flow:

**Review Step:**
- Facility summary card (name, type, address, timezone, subscription badge)
- Administrator summary card (name, email, role)
- Clinical templates summary (grouped, with checkmarks + counts for enabled, gray for disabled)
- Operational templates summary (same pattern)
- Edit buttons on each section that jump back to the relevant step

**Submission Flow (in `actions.ts`):**
1. Create facility via `INSERT INTO facilities`
2. Call `seed_facility_with_templates(facility_id, template_config)` RPC
3. Send invite email via `POST /api/admin/invite` (if enabled)
4. Log audit event via `facilityAudit.created()`
5. Show success toast + redirect to `/admin/facilities/{id}`

**Error handling:**
- Facility creation failure: show error, don't proceed
- RPC failure: show error, option to retry
- Invite failure: show warning toast, facility still created
- Loading state with disabled button + spinner

### Files touched
- `app/admin/facilities/new/ReviewStep.tsx` (implement)
- `app/admin/facilities/new/actions.ts` (implement full submission)
- `app/admin/facilities/new/page.tsx` (wire submission)

### Commit message
`feat(wizard): implement review step and RPC-based facility creation submission`

### 3-stage test gate
1. **Unit**: Review step renders all sections correctly, edit buttons target correct steps
2. **Integration**: Submission calls RPC with correct config, handles errors gracefully
3. **Workflow**: Complete full wizard → create facility → verify facility exists with correct templates in DB → verify admin invite sent

---

## Phase 6: Tests
**Complexity**: Medium

### What it does
Add comprehensive test coverage for the new wizard:

1. **WizardShell tests**: Step navigation, progress indicator, validation gating
2. **FacilityStep tests**: Field rendering, validation, phone formatting
3. **AdminStep tests**: Field rendering, validation, role loading
4. **ClinicalTemplatesStep tests**: Card rendering, counts, toggle behavior
5. **OperationalTemplatesStep tests**: Same pattern as clinical
6. **ReviewStep tests**: Summary rendering, edit button navigation
7. **Submission tests**: Mock RPC call, error handling, success redirect

### Files touched
- `app/admin/facilities/new/__tests__/page.test.tsx` (new)
- `app/admin/facilities/new/__tests__/FacilityStep.test.tsx` (new)
- `app/admin/facilities/new/__tests__/AdminStep.test.tsx` (new)
- `app/admin/facilities/new/__tests__/ClinicalTemplatesStep.test.tsx` (new)
- `app/admin/facilities/new/__tests__/OperationalTemplatesStep.test.tsx` (new)
- `app/admin/facilities/new/__tests__/ReviewStep.test.tsx` (new)

### Commit message
`test(wizard): add comprehensive test coverage for facility creation wizard`

### 3-stage test gate
1. **Unit**: All individual component tests pass
2. **Integration**: Full wizard flow test (step through all 5 steps)
3. **Workflow**: Submission mock test verifies correct RPC payload

---

## Phase 7: Cleanup & Polish
**Complexity**: Small

### What it does
1. Remove any dead code from the old wizard (check for imports referencing old patterns)
2. Verify no existing trigger auto-calls `seed_facility_with_templates` on facility INSERT (remove if exists, since the wizard now calls it explicitly)
3. Verify permissions seeding still works after facility creation
4. Polish UI: loading states, transitions between steps, mobile responsiveness
5. Update the facilities list page if any links/references changed
6. Final typecheck + lint pass

### Files touched
- `supabase/migrations/YYYYMMDD_remove_facility_creation_trigger.sql` (new, if trigger exists)
- Various files for cleanup

### Commit message
`chore(wizard): cleanup old facility creation code and verify trigger behavior`

### 3-stage test gate
1. **Unit**: No dead imports, no unused variables, typecheck passes
2. **Integration**: Create a facility end-to-end, verify all templates seeded, admin invited
3. **Workflow**: Full regression — create facility, log in as admin, verify all settings present

---

## Dependencies
- Phase 1 (DB) must complete before Phase 5 (submission uses the new RPC)
- Phase 2 (scaffold) must complete before Phases 3, 4, 5
- Phases 3 and 4 are independent of each other (but both needed before Phase 5)
- Phase 6 (tests) depends on all implementation phases (1-5)
- Phase 7 (cleanup) is last
