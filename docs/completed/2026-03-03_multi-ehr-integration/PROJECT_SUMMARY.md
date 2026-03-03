# Project: Multi-EHR Integration (Oracle Cerner + MEDITECH)
**Completed:** 2026-03-03
**Branch:** feature/multi-ehr-integration
**Duration:** 2026-03-02 → 2026-03-03
**Total Phases:** 9

## What Was Built
Expanded ORbit's HL7v2 SIU surgical scheduling integration beyond Epic to support Oracle Cerner and MEDITECH, covering ~75% of US hospitals. The existing Epic integration architecture (parser, entity matching, review queue, case creation) was ~90% reusable.

The feature added system-specific adapters for field preference differences (e.g., MEDITECH prefers PV1-7 for surgeon vs Epic/Cerner's AIP segment), per-system configuration pages with detailed hospital IT setup instructions, a multi-system-aware integrations landing page with a one-HL7v2-per-facility enforcement dialog, and parameterized test harness support for all three systems.

Key design decisions: one HL7v2 integration per facility (switch with confirmation dialog), separate routes per system (`/settings/integrations/epic|cerner|meditech`), renamed `lib/integrations/epic/` to `lib/integrations/ehr/` since the code was already generic, and specific `change_source` values per system for audit trail granularity.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Database migration + TypeScript types for Cerner/MEDITECH | `47e883f` |
| 2     | Rename epic/ to ehr/, dynamic import service | `c6a435a` |
| 3     | Edge function dynamic integration type support | `f7c9ed9` |
| 4     | Extract shared integration components | `e9c4696` |
| 5     | Integrations landing page with system switching | `e20d0e3` |
| 6     | Oracle Cerner integration page | `a7f32f0` |
| 7     | MEDITECH integration page | `b26e933` |
| 8     | Test harness parameterization + multi-system test coverage | `496965a` |
| 9     | Final verification and polish | `69e54e4` |
| fix   | Scope stats/logs/reviews to specific integration | `49cc31b` |
| fix   | Remove deprecated Epic Field Mapping page, dynamic test harness links | `513f39b` |

## Key Files Created/Modified

### New Files
- `app/settings/integrations/cerner/page.tsx` + `PageClient.tsx` — Cerner integration page
- `app/settings/integrations/cerner/mappings/page.tsx` + `PageClient.tsx` — Cerner entity mappings
- `app/settings/integrations/meditech/page.tsx` + `PageClient.tsx` — MEDITECH integration page
- `app/settings/integrations/meditech/mappings/page.tsx` + `PageClient.tsx` — MEDITECH entity mappings
- `components/integrations/IntegrationOverviewTab.tsx` — Shared overview tab
- `components/integrations/IntegrationReviewQueueTab.tsx` — Shared review queue tab
- `components/integrations/IntegrationMappingsTab.tsx` — Shared mappings tab
- `components/integrations/IntegrationLogsTab.tsx` — Shared logs tab
- `components/integrations/SwitchIntegrationDialog.tsx` — One-HL7v2-per-facility switch dialog
- `components/integrations/system-config.ts` — Per-system metadata, display names, setup instructions
- `lib/integrations/ehr/field-preferences.ts` — Surgeon field priority per system

### Renamed
- `lib/integrations/epic/` → `lib/integrations/ehr/` (entire folder)

### Modified
- `app/settings/integrations/PageClient.tsx` — Landing page with multi-system cards
- `app/settings/integrations/epic/PageClient.tsx` — Refactored to use shared components
- `app/admin/settings/hl7v2-test-harness/PageClient.tsx` — System type selector, dynamic links
- `lib/integrations/ehr/case-import-service.ts` — Dynamic integration_type
- `lib/integrations/shared/integration-types.ts` — New types and constants
- `supabase/functions/hl7v2-listener/import-service.ts` — Dynamic integration type
- `supabase/functions/hl7v2-listener/notification-helper.ts` — Dynamic display names
- `components/integrations/ReviewDetailPanel.tsx` — Dynamic system name in headers
- `components/settings/AdminSettingsLayout.tsx` — Removed deprecated Epic Field Mapping nav

### Deleted
- `app/admin/settings/epic-field-mapping/` — Deprecated FHIR-specific page (out of scope for HL7v2)

## Architecture Decisions
1. **One HL7v2 per facility**: Enforced via database EXCLUDE constraint and UI dialog. A facility can only have one active HL7v2 integration at a time.
2. **Shared components pattern**: Each integration page reuses the same tab components (`IntegrationOverviewTab`, `IntegrationReviewQueueTab`, etc.) with `integrationType` prop.
3. **Dynamic integration type throughout**: Backend (DAL, import service, edge function, notifications) all accept `integration_type` dynamically instead of hardcoding `'epic_hl7v2'`.
4. **Per-system field preferences**: `getFieldPreferences(integrationType)` returns surgeon field priority order (AIP vs PV1-7) and Z-segment handling rules per system.
5. **Separate routes, not tabs**: Each system has its own route (`/settings/integrations/epic`, `/cerner`, `/meditech`) rather than a single page with a system tab — enables deep linking and clearer URL semantics.

## Database Changes
- Migration: `20260302_multi_ehr_support.sql`
  - Expanded `ehr_integrations.integration_type` CHECK: added `'cerner_hl7v2'`, `'meditech_hl7v2'`
  - Expanded `case_history.change_source` CHECK: added `'cerner_hl7v2'`, `'meditech_hl7v2'`
  - Added one-HL7v2-per-facility EXCLUDE constraint

## Known Limitations / Future Work
- **Test coverage gaps**: Unit tests for `integrationId` parameter in DAL functions, integration tests verifying cross-system isolation (Epic vs Cerner data separation), and workflow tests for multi-integration scenarios are not yet written. Flagged for follow-up.
- **Cerner FHIR R4 integration**: Explicitly out of scope — different architecture, future feature.
- **Edge function deployment**: The updated edge function code was written but needs `supabase functions deploy hl7v2-listener` to apply changes to production.
- **Real Cerner/MEDITECH validation**: Implementation is based on HL7v2 spec analysis. Real-world message format variations from specific hospital installations may need field mapping adjustments.
