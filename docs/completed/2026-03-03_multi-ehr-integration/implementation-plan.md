# Implementation Plan: Multi-EHR Integration (Oracle Cerner + MEDITECH)

## Summary
Expand ORbit's HL7v2 SIU integration beyond Epic to support Oracle Cerner and MEDITECH, covering ~75% of US hospitals. The existing architecture is ~90% reusable — this feature adds system-specific adapters, per-system configuration pages, and a multi-system-aware landing page. One HL7v2 integration per facility (switch with confirmation dialog).

## Interview Notes

### Architecture Decisions
- **One HL7v2 per facility**: A facility can only have one active HL7v2 integration (Epic OR Cerner OR MEDITECH). Switching requires confirmation dialog.
- **Separate per-system routes**: `/settings/integrations/epic`, `/settings/integrations/cerner`, `/settings/integrations/meditech` — each its own Next.js page.
- **Rename `lib/integrations/epic/` → `lib/integrations/ehr/`**: Code is already 100% generic, folder name is misleading.
- **Specific change_source per system**: Use `'epic_hl7v2'`, `'cerner_hl7v2'`, `'meditech_hl7v2'` in `case_history.change_source` and notification metadata for audit trail granularity.

### UX Decisions
- **Card layout on landing page**: Move Cerner/MEDITECH from "Planned" to "Active Integrations" section.
- **Switch with warning**: If a facility has Epic and tries to add Cerner, show confirmation dialog ("Switching from Epic to Cerner will disconnect your current integration. Entity mappings will be preserved.").
- **Detailed setup instructions per system**: System-specific steps for hospital IT (e.g., "In Cerner admin, configure COI outbound interface...").
- **Test harness parameterized**: Dropdown to select system type when generating test messages (changes MSH-3 sending app field).

### Out of Scope
- Epic Field Mapping admin page (FHIR-specific, unrelated to HL7v2)
- Cerner FHIR R4 integration (future feature, different architecture)
- Any changes to existing Epic integration behavior

---

## Phase 1: Database Migration + TypeScript Types
**Complexity: Small**

### What it does
Expand database CHECK constraints and TypeScript types to support `'cerner_hl7v2'` and `'meditech_hl7v2'` as valid integration types.

### Files touched
- `supabase/migrations/[timestamp]_multi_ehr_support.sql` (NEW)
- `lib/integrations/shared/integration-types.ts`
- `supabase/functions/hl7v2-listener/types.ts`

### Details
1. New migration:
   - Expand `ehr_integrations.integration_type` CHECK: add `'cerner_hl7v2'`, `'meditech_hl7v2'`
   - Expand `case_history.change_source` CHECK: add `'cerner_hl7v2'`, `'meditech_hl7v2'`
   - Add one-HL7v2-per-facility constraint: `EXCLUDE` or trigger that prevents two HL7v2 types for same facility
2. Update TypeScript types:
   - `EhrIntegrationType`: add `'cerner_hl7v2' | 'meditech_hl7v2'`
   - `CaseHistoryChangeSource`: add `'cerner_hl7v2' | 'meditech_hl7v2'`
   - Add `EHR_SYSTEM_DISPLAY_NAMES` map: `{ epic_hl7v2: 'Epic', cerner_hl7v2: 'Oracle Cerner', meditech_hl7v2: 'MEDITECH' }`
   - Add `HL7V2_INTEGRATION_TYPES` array constant for UI iteration

### Commit message
`feat(multi-ehr): phase 1 - database migration and TypeScript types for Cerner/MEDITECH`

### 3-stage test gate
1. **Unit**: TypeScript types compile, constants are correct
2. **Integration**: Migration applies cleanly, constraints accept new values, one-HL7v2-per-facility constraint works
3. **Workflow**: Existing Epic integration still works after migration (no regression)

---

## Phase 2: Backend Refactor — Rename Folder + Dynamic Import Service
**Complexity: Medium**

### What it does
Rename `lib/integrations/epic/` → `lib/integrations/ehr/`, make the import service and notification helper dynamic (use `integration.integration_type` instead of hardcoded `'epic_hl7v2'`), add surgeon field preference logic.

### Files touched
- `lib/integrations/epic/` → `lib/integrations/ehr/` (RENAME entire folder)
- `lib/integrations/ehr/case-import-service.ts` (update 6 hardcoded strings)
- `lib/integrations/ehr/field-preferences.ts` (NEW — small adapter for surgeon field priority)
- All files that import from `lib/integrations/epic/` (update import paths)
- All test files in `lib/integrations/epic/__tests__/` → `lib/integrations/ehr/__tests__/`

### Details
1. Rename folder and update all import paths
2. In `case-import-service.ts`:
   - Accept `integration_type` parameter (from the `ehr_integrations` record)
   - Replace all `.eq('external_system', 'epic_hl7v2')` with `.eq('external_system', integrationType)`
   - Replace `external_system: 'epic_hl7v2'` with `external_system: integrationType`
   - Replace `p_change_source: 'epic_hl7v2'` with `p_change_source: integrationType`
3. Create `field-preferences.ts`:
   - Surgeon field priority: Epic/Cerner prefer AIP → PV1-7 fallback; MEDITECH prefers PV1-7 → AIP fallback
   - Z-segment handling: Cerner may include ZSG segments (parse gracefully, don't fail)
   - Export a `getFieldPreferences(integrationType)` function

### Commit message
`feat(multi-ehr): phase 2 - rename epic/ to ehr/, dynamic import service`

### 3-stage test gate
1. **Unit**: All renamed imports resolve, field-preferences returns correct priority per system
2. **Integration**: case-import-service correctly uses dynamic `integration_type` for case creation/lookup
3. **Workflow**: Process a mock SIU message end-to-end with each integration type

---

## Phase 3: Edge Function Update
**Complexity: Medium**

### What it does
Mirror the backend dynamic changes in the Supabase edge function (which runs on Deno, separate from the web app). Make `import-service.ts` and `notification-helper.ts` use the integration type dynamically.

### Files touched
- `supabase/functions/hl7v2-listener/import-service.ts` (update ~6 hardcoded strings)
- `supabase/functions/hl7v2-listener/notification-helper.ts` (update 8 hardcoded "Epic" strings)
- `supabase/functions/hl7v2-listener/index.ts` (pass integration_type through the pipeline)

### Details
1. In `import-service.ts`:
   - Accept `integration_type` from the authenticated integration record
   - Replace hardcoded `'epic_hl7v2'` with dynamic value (same pattern as Phase 2)
   - Add surgeon field preference routing based on integration_type
2. In `notification-helper.ts`:
   - Replace `"via Epic HL7v2"` with dynamic `"via ${displayName} HL7v2"`
   - Replace `"via Epic:"` with `"via ${displayName}:"`
   - Replace `source: 'epic_hl7v2'` with `source: integrationType`
   - Use `EHR_SYSTEM_DISPLAY_NAMES` map (inline or import)
3. In `index.ts`:
   - Pass `integration.integration_type` to the import service when processing messages

### Commit message
`feat(multi-ehr): phase 3 - edge function dynamic integration type support`

### 3-stage test gate
1. **Unit**: notification-helper produces correct display names per system, import-service uses correct values
2. **Integration**: Edge function processes messages with different integration_type values correctly
3. **Workflow**: Send test SIU message → verify case created with correct `external_system` and `change_source`

---

## Phase 4: Frontend — Shared Integration Components Extraction
**Complexity: Large**

### What it does
Extract reusable components from the Epic integration page so that Cerner and MEDITECH pages can share the same UI without code duplication. This is preparation for Phases 5-6.

### Files touched
- `components/integrations/IntegrationOverviewTab.tsx` (NEW — extracted from Epic page)
- `components/integrations/IntegrationReviewQueueTab.tsx` (NEW — extracted)
- `components/integrations/IntegrationMappingsTab.tsx` (NEW — extracted)
- `components/integrations/IntegrationLogsTab.tsx` (NEW — extracted)
- `components/integrations/SetupInstructionsCard.tsx` (update to accept system-specific content as props)
- `components/integrations/ReviewDetailPanel.tsx` (replace "Epic (Incoming)" with dynamic system name)
- `components/integrations/system-config.ts` (NEW — per-system display names, descriptions, setup instructions)
- `app/settings/integrations/epic/PageClient.tsx` (refactor to use shared components)

### Details
1. Extract each tab (Overview, Review Queue, Mappings, Logs) into reusable components that accept `integrationType` and `integration` as props
2. Create `system-config.ts` with per-system metadata:
   - Display names, descriptions, icons
   - Detailed setup instructions (per user's request)
   - Endpoint configuration help text
3. Update `ReviewDetailPanel.tsx`: replace hardcoded "Epic (Incoming)" column header with dynamic `${systemDisplayName} (Incoming)`, rename `epicSurgeon` etc. variables
4. Update `SetupInstructionsCard.tsx`: accept system-specific instructional content via props
5. Refactor Epic page to use the new shared components (regression test!)

### Commit message
`feat(multi-ehr): phase 4 - extract shared integration components`

### 3-stage test gate
1. **Unit**: All extracted components render correctly with Epic props, ReviewDetailPanel shows correct system name
2. **Integration**: Epic integration page works identically after refactor (no visual/behavioral regression)
3. **Workflow**: Navigate to Epic settings → configure → review queue → approve → verify all tabs work

---

## Phase 5: Frontend — Integrations Landing Page + Switch Dialog
**Complexity: Medium**

### What it does
Update the integrations landing page to show all three HL7v2 systems as "Active Integrations" cards. Add one-HL7v2-per-facility enforcement with a switch confirmation dialog.

### Files touched
- `app/settings/integrations/PageClient.tsx` (major update)
- `components/integrations/SwitchIntegrationDialog.tsx` (NEW)

### Details
1. Move Oracle Cerner and MEDITECH from "Planned Integrations" to "Active Integrations" section
2. Each card shows:
   - System name + logo/icon
   - Connection status (Connected / Not Configured)
   - Navigate to `/settings/integrations/[type]`
3. One-HL7v2 enforcement:
   - If facility has an active HL7v2 integration, other HL7v2 cards show "Switch" button instead of "Configure"
   - Clicking "Switch" opens confirmation dialog: "Switching from {current} to {new} will disconnect your current integration. Entity mappings will be preserved."
   - On confirm: deactivate current integration, navigate to new system's config page
4. Non-HL7v2 integrations (modmed_fhir, csv_import) are unaffected

### Commit message
`feat(multi-ehr): phase 5 - integrations landing page with system switching`

### 3-stage test gate
1. **Unit**: Landing page renders 3 HL7v2 cards, switch dialog renders correctly
2. **Integration**: Switch dialog deactivates old integration, navigates to new page
3. **Workflow**: Have Epic configured → click Cerner card → confirm switch → verify Epic deactivated and Cerner page loads

---

## Phase 6: Frontend — Oracle Cerner Integration Page
**Complexity: Medium**

### What it does
Create the Cerner HL7v2 integration page at `/settings/integrations/cerner` with Cerner-specific setup instructions and help text.

### Files touched
- `app/settings/integrations/cerner/page.tsx` (NEW)
- `app/settings/integrations/cerner/PageClient.tsx` (NEW — uses shared components from Phase 4)
- `app/settings/integrations/cerner/mappings/page.tsx` (NEW)
- `app/settings/integrations/cerner/mappings/PageClient.tsx` (NEW — uses shared components)

### Details
1. Page structure mirrors Epic page exactly (Overview, Review Queue, Mappings, Logs tabs)
2. Uses shared components with `integrationType='cerner_hl7v2'`
3. Cerner-specific setup instructions:
   - "Configure your Cerner Open Interface (COI) to send outbound HL7v2 SIU messages"
   - Step-by-step: COI admin → Outbound Interfaces → Create New → HL7v2 over HTTPS
   - Note about SurgiNet OR scheduling module
   - Custom Z-segment handling info
4. Display name: "Oracle Cerner" throughout

### Commit message
`feat(multi-ehr): phase 6 - Oracle Cerner integration page`

### 3-stage test gate
1. **Unit**: Cerner page renders with correct system name, setup instructions display
2. **Integration**: Can create Cerner integration, generate API key, view endpoint URL
3. **Workflow**: Configure Cerner integration → send test message → verify review queue populates

---

## Phase 7: Frontend — MEDITECH Integration Page
**Complexity: Medium**

### What it does
Create the MEDITECH HL7v2 integration page at `/settings/integrations/meditech` with MEDITECH-specific setup instructions.

### Files touched
- `app/settings/integrations/meditech/page.tsx` (NEW)
- `app/settings/integrations/meditech/PageClient.tsx` (NEW — uses shared components from Phase 4)
- `app/settings/integrations/meditech/mappings/page.tsx` (NEW)
- `app/settings/integrations/meditech/mappings/PageClient.tsx` (NEW — uses shared components)

### Details
1. Page structure mirrors Epic/Cerner pages (shared components)
2. Uses shared components with `integrationType='meditech_hl7v2'`
3. MEDITECH-specific setup instructions:
   - "Configure your MEDITECH Expanse perioperative module to send outbound HL7v2 SIU messages"
   - Note about PV1-7 as primary surgeon field
   - Reference to MEDITECH's published scheduling outbound spec
   - Note about HL7 2.4 version compliance
4. Display name: "MEDITECH" throughout

### Commit message
`feat(multi-ehr): phase 7 - MEDITECH integration page`

### 3-stage test gate
1. **Unit**: MEDITECH page renders with correct system name, setup instructions display
2. **Integration**: Can create MEDITECH integration, generate API key, view endpoint URL
3. **Workflow**: Configure MEDITECH integration → send test message → verify review queue populates

---

## Phase 8: Test Harness Parameterization + Test Coverage
**Complexity: Medium**

### What it does
Add system type selector to the test harness and expand test coverage for all three EHR systems.

### Files touched
- `lib/hl7v2/test-harness/siu-generator.ts` (parameterize sending application)
- `lib/hl7v2/test-harness/shared.ts` (support all integration types)
- `components/integrations/test-data/ScheduleManager.tsx` (add system type dropdown)
- `lib/integrations/ehr/__tests__/*.test.ts` (add Cerner/MEDITECH test cases)
- `supabase/functions/hl7v2-listener/__tests__/*.test.ts` (add multi-system test cases)
- `lib/hl7v2/__tests__/siu-parser.test.ts` (add Cerner/MEDITECH message variants)

### Details
1. Test harness UI: add dropdown for "System Type" (Epic / Oracle Cerner / MEDITECH)
   - Changes MSH-3 sending application field in generated messages
   - Placeholder text updates per system
2. Test coverage additions:
   - Parser tests: Cerner message with Z-segments, MEDITECH message with PV1-7 primary surgeon
   - Import service tests: Verify correct `external_system` value per integration type
   - Notification tests: Verify correct display names ("via Oracle Cerner", "via MEDITECH")
   - Field preference tests: Verify surgeon field priority per system
   - Round-trip test: Generate → Parse → Import for each system

### Commit message
`feat(multi-ehr): phase 8 - test harness parameterization and multi-system test coverage`

### 3-stage test gate
1. **Unit**: All new tests pass, generator produces correct MSH-3 per system
2. **Integration**: Round-trip test for each system (generate → parse → import → verify case)
3. **Workflow**: Use test harness UI → select Cerner → send test message → verify case created with `external_system: 'cerner_hl7v2'`

---

## Phase 9: Final Verification + Polish
**Complexity: Small**

### What it does
Full regression test, typecheck, lint, and any final polish across all three systems.

### Files touched
- Various files for minor fixes discovered during testing
- `docs/active-feature.md` (update acceptance criteria checkboxes)

### Details
1. Run full test suite: `npm run typecheck && npm run lint && npm run test`
2. Manual verification of all acceptance criteria:
   - [ ] Cerner messages parsed and create cases
   - [ ] MEDITECH messages parsed and create cases
   - [ ] Admin settings allow selecting EHR system
   - [ ] System-specific setup instructions shown
   - [ ] Review queue works for all three systems with source badge
   - [ ] Entity mapping works across all systems
   - [ ] Test message panel works for all three systems
   - [ ] Epic integration unaffected (no regression)
3. Fix any issues discovered
4. Verify no `any` types introduced

### Commit message
`feat(multi-ehr): phase 9 - final verification and polish`

### 3-stage test gate
1. **Unit**: `npm run test` passes
2. **Integration**: `npm run typecheck && npm run lint` passes
3. **Workflow**: Full end-to-end: configure each system → send test message → review queue → approve → case created → verify case history source

---

## Dependency Graph

```
Phase 1 (DB + Types)
  ├── Phase 2 (Backend refactor)
  │     └── Phase 3 (Edge function)
  └── Phase 4 (Shared components)
        ├── Phase 5 (Landing page + switch dialog)
        ├── Phase 6 (Cerner page)
        └── Phase 7 (MEDITECH page)
              └── Phase 8 (Test harness + coverage)
                    └── Phase 9 (Final verification)
```

Phases 2-3 (backend) and Phase 4 (frontend) can run in parallel after Phase 1.
Phases 5, 6, 7 can run in parallel after Phase 4.
