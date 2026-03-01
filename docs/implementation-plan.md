# Implementation Plan: Epic FHIR Integration + Patient Fields

## Summary
Two features delivered together: (1) patient fields added to case creation, case list, and case detail — always visible, no feature flag toggle, and (2) Epic FHIR integration for on-demand surgical case import via SMART on FHIR OAuth. Patient data uses the existing `patients` table and `cases.patient_id` FK. The `create_case_with_milestones` RPC is extended with a `p_patient_id` parameter for atomic patient linking. The Epic integration is architected to support future scheduled sync but ships as manual import first.

## Interview Notes
- **Feature flags removed**: No `feature_flags` tables, no Global Settings page, no toggle. Patient fields are always visible on case pages.
- **Patient fields**: Always shown. First name + last name required if any patient field is entered. MRN and DOB optional.
- **RPC change**: Alter `create_case_with_milestones` to accept `p_patient_id` (atomic patient linking in same transaction).
- **Canonical spec**: `active-feature.md` is the source of truth. Use `epic_entity_mappings` for per-facility surgeon/room mapping.
- **Phase execution**: Strict sequential (Phase 1 → 2 → 3 → 4 → 5). No parallel phases.
- **Epic import page**: Separate sub-page at `/settings/integrations/epic/import` (full page width for preview table).
- **Epic badge**: Small text pill badge next to case number in case list for imported cases.
- **Epic scope**: Manual import first (non-persistent app), database ready for future sync.
- **FHIR scopes**: `user/` prefix (clinician-facing OAuth), not `system/`.
- **Token storage**: Table with strict RLS for v1. Vault migration for production later.
- **Entity mappings**: Simplified single `orbit_entity_id` column, not polymorphic FKs. Per-facility (facility admin maps their surgeons/rooms).
- **Field mapping**: Global admin configures which FHIR fields map to which ORbit columns. Pre-built with sensible defaults, overridable. Stored in `epic_field_mappings` table. Admin page under Configuration group.
- **Patient data in imports**: Always populated from FHIR Patient resources (no toggle gating).
- **Analytics**: NEVER include patient-identifiable data (hard rule, unchanged).

---

## Phase 1: Patient Fields on Case Pages
**Complexity:** Medium

### What it does
- Alters `create_case_with_milestones` RPC to accept `p_patient_id` parameter (atomic patient linking)
- Adds optional "Patient Information" section to CaseForm (first name, last name, MRN, DOB)
- Validation: if any patient field is entered, first name + last name become required
- On submit with patient data: creates or finds patient record (MRN lookup within facility), links via `patient_id`
- Adds "Patient" column to case list showing `Last, First`
- Adds patient info card to case detail view
- Includes patient join in case list/detail DAL queries

### Files touched
- `supabase/migrations/YYYYMMDD_add_patient_id_to_rpc.sql` (new — alter RPC)
- `components/cases/CaseForm.tsx` (modified — add patient fields section)
- `components/cases/CasesTable.tsx` (modified — add Patient column)
- `app/cases/[id]/PageClient.tsx` (modified — add patient info card)
- `lib/dal/cases.ts` (modified — include patient join in queries)

### Commit message
`feat(cases): add patient fields to case creation, list, and detail views`

### 3-stage test gate
1. **Unit:** CaseForm renders patient fields. Validation requires first+last name when any patient field entered. Empty patient fields = no patient record created.
2. **Integration:** Create case with patient data → verify patient record in `patients` table → verify `cases.patient_id` linked. Create case with MRN matching existing patient → verify reuse (no duplicate). Create case without patient data → verify `patient_id` is null.
3. **Workflow:** Create case with patient info → see patient in case list column → open case detail → see patient card → create another case with same MRN → verify same patient linked → edit case → verify patient fields populated

---

## Phase 2: Epic Database Schema + Auth Flow + Global Field Mapping
**Complexity:** Large

### What it does
- Creates `epic_connections`, `epic_entity_mappings`, `epic_import_log` tables with RLS, indexes, triggers
- Creates `epic_field_mappings` table for global field mapping rules (FHIR field path → ORbit table.column)
- Seeds `epic_field_mappings` with sensible defaults (e.g., `Appointment.start` → `cases.start_time`, `Patient.name.given` → `patients.first_name`, etc.)
- Builds global admin "Epic Field Mapping" page at `/admin/settings/epic-field-mapping` (under Configuration group)
  - Table showing FHIR fields on the left, ORbit fields on the right (dropdowns)
  - Pre-populated with defaults — global admin can review and adjust
  - "Reset to Defaults" button
- Adds nav entry to admin Configuration group
- Implements OAuth connect/callback/disconnect API routes
- Builds token manager utility (`lib/epic/token-manager.ts`)
- Creates FHIR type definitions (`lib/epic/types.ts`)
- Creates Epic DAL module (`lib/dal/epic.ts`)
- Adds Epic environment variables to `lib/env.ts` validation

### Files touched
- `supabase/migrations/YYYYMMDD_epic_integration.sql` (new — all Epic tables + field mapping defaults seed)
- `app/api/epic/auth/connect/route.ts` (new)
- `app/api/epic/auth/callback/route.ts` (new)
- `app/api/epic/auth/disconnect/route.ts` (new)
- `app/admin/settings/epic-field-mapping/page.tsx` (new)
- `app/admin/settings/epic-field-mapping/PageClient.tsx` (new)
- `components/layouts/navigation-config.tsx` (modified — add Epic Field Mapping to Configuration group)
- `lib/epic/token-manager.ts` (new)
- `lib/epic/types.ts` (new)
- `lib/dal/epic.ts` (new)
- `lib/env.ts` (modified — add Epic env vars)

### Commit message
`feat(epic): add database schema, global field mapping admin page, and SMART on FHIR OAuth flow`

### 3-stage test gate
1. **Unit:** Token manager correctly identifies expired tokens. FHIR request builder formats correct URL and headers. Field mapping defaults seeded correctly. Type interfaces compile.
2. **Integration:** OAuth flow with Epic sandbox — manual test: Connect → authenticate → callback stores token → status = 'connected'. Disconnect → tokens cleared. Global admin can view/edit field mappings. Verify field mapping changes persist.
3. **Workflow:** Global admin reviews default field mappings → adjusts one mapping → saves → verify stored in DB. Connect facility to Epic → verify `epic_connections` row → disconnect → verify status updated.

---

## Phase 3: FHIR Client + Entity Mapping
**Complexity:** Large

### What it does
- Builds typed FHIR client service (`lib/epic/fhir-client.ts`)
- Implements auto-matching algorithm for surgeons and rooms (`lib/epic/auto-matcher.ts`)
- Creates mapping CRUD and auto-match API routes
- Creates connection status API route
- Builds Epic settings page (`/settings/integrations/epic`) with connection status + entity mapping manager
  - Entity mapping is per-facility (facility admin maps their Epic surgeons/rooms to ORbit entities)
  - This is separate from the global field mapping (which the global admin controls)
- Updates integrations page to activate Epic card (remove "Coming Soon", add "Set Up" / "Manage" buttons)
- Mapping manager UI: tabs for Surgeons/Rooms, auto-match button, manual dropdown assignment

### Files touched
- `lib/epic/fhir-client.ts` (new)
- `lib/epic/auto-matcher.ts` (new)
- `app/api/epic/mappings/route.ts` (new)
- `app/api/epic/mappings/[id]/route.ts` (new)
- `app/api/epic/mappings/auto-match/route.ts` (new)
- `app/api/epic/status/route.ts` (new)
- `app/settings/integrations/epic/page.tsx` (new)
- `app/settings/integrations/epic/PageClient.tsx` (new)
- `app/settings/integrations/PageClient.tsx` (modified — activate Epic card)

### Commit message
`feat(epic): add FHIR client, auto-matching, and entity mapping UI`

### 3-stage test gate
1. **Unit:** FHIR client parses various response shapes (complete data, missing optional fields, empty bundles). Auto-matcher scores name similarity correctly (exact match = 1.0, close match > 0.8, no match < 0.5). Threshold at 0.90 for auto-apply.
2. **Integration:** Fetch practitioners from Epic sandbox → auto-match against ORbit surgeons → verify high-confidence matches auto-applied, low-confidence shown as suggestions. Manually map one via API → verify mapping stored.
3. **Workflow:** Connect to Epic → navigate to mapping manager → run auto-match → review suggestions → accept one, reject one, manually map one → verify all reflected in mapping table → navigate back to status → verify mapping counts updated

---

## Phase 4: Case Import Pipeline
**Complexity:** Large

### What it does
- Builds case mapping engine (`lib/epic/case-mapper.ts`) that reads global field mappings from `epic_field_mappings` table at import time (not hardcoded)
- Creates case search/preview API route
- Creates case import API route (uses `create_case_with_milestones` RPC with `p_patient_id`)
- Builds case import UI at `/settings/integrations/epic/import` (separate page, full width)
- Creates patient records during import from FHIR Patient resources
- Logs all imports to `epic_import_log`
- Adds small "Epic" text badge to imported cases in case list
- Duplicate detection (same FHIR appointment ID → skipped)

### Files touched
- `lib/epic/case-mapper.ts` (new)
- `app/api/epic/cases/search/route.ts` (new)
- `app/api/epic/cases/import/route.ts` (new)
- `app/settings/integrations/epic/import/page.tsx` (new)
- `app/settings/integrations/epic/import/PageClient.tsx` (new)
- `components/cases/CasesTable.tsx` (modified — add Epic badge for imported cases)

### Commit message
`feat(epic): add case import pipeline with preview, mapping, and audit logging`

### 3-stage test gate
1. **Unit:** Case mapper transforms FHIR Appointment + resolved references into correct ORbit case payload using global field mappings. Duplicate detection identifies already-imported appointments. Patient data always included in import payload.
2. **Integration:** Search Epic sandbox for appointments → preview shows cases with mapping status → import one case → verify case created via RPC → verify import log entry created → verify patient record created and linked. Verify case mapper respects custom field mapping overrides set by global admin.
3. **Workflow:** Full end-to-end: connect to Epic → map surgeons/rooms → search upcoming cases → select 3 cases → import → view imported cases in case list (Epic badge visible) → view case detail → verify all fields populated → try importing same cases again → verify "duplicate" status returned

---

## Phase 5: Polish + Testing
**Complexity:** Medium

### What it does
- Adds loading skeleton components for Epic pages (FHIR queries take 2-5s)
- Adds error boundary components for Epic-related failures
- Implements retry logic for transient FHIR errors (exponential backoff, 3 retries)
- Comprehensive unit tests for all `lib/epic/` modules
- Integration tests for API routes with mocked FHIR responses
- Verifies security checklist items
- Manual end-to-end walkthrough with Epic sandbox

### Files touched
- `lib/epic/__tests__/` (new — test files for all epic modules)
- `app/api/epic/__tests__/` (new — API route tests)
- Epic page components (modified — add loading skeletons, error states)
- Security verification (review RLS policies, token access, client secret exposure)

### Commit message
`feat(epic): add error handling, loading states, and comprehensive tests`

### 3-stage test gate
1. **Unit:** All `lib/epic/` modules have >80% test coverage. Edge cases covered: expired tokens, malformed FHIR data, network timeouts, empty search results.
2. **Integration:** All API routes tested with mocked FHIR responses. Auth flow tested with invalid state, expired codes, network failures.
3. **Workflow:** Manual walkthrough of complete flow with Epic sandbox: connect → map → search → import → verify → disconnect. Verify all security checklist items pass.

---

## Dependency Graph
```
Phase 1 (Patient Fields) → Phase 2 (Epic Schema + Auth + Field Mapping) → Phase 3 (FHIR Client + Entity Mapping) → Phase 4 (Case Import) → Phase 5 (Polish + Tests)
```
Strict sequential execution. One phase per session.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Epic sandbox rate limiting during development | Cache FHIR responses locally during development. Use mock responses for automated tests. |
| OAuth redirect URI changes (ngrok) | Use stable ngrok subdomain. Document how to update Epic app registration. |
| Token expiry during active import session | Check token validity before each FHIR request. Surface "Reconnect" prompt immediately. |
| FHIR data shape varies between Epic instances | Only model fields ORbit uses. Gracefully handle missing optional fields. Log raw responses for debugging. |
| Patient data leaking into analytics | Hard rule: analytics queries NEVER join patient data. Patient fields only on case-level UI. |
| Auto-match false positives | High threshold (0.90) for auto-apply. All suggested matches require manual confirmation. |
| Global field mapping misconfigured | Ship with validated defaults. Admin UI shows preview of what each mapping does. Reset to defaults button available. |

---

## Session Log
<!-- Append phase completion entries here -->
