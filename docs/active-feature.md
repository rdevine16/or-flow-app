# Feature: Multi-EHR Integration (Oracle Cerner + MEDITECH)

## Goal
Expand ORbit's HL7v2 SIU surgical scheduling integration beyond Epic to support Oracle Cerner and MEDITECH. These three systems cover ~75% of US hospitals. The existing Epic integration architecture (parser, entity matching, review queue, case creation) is ~90% reusable — this feature adds system-specific adapters and a multi-system configuration UI.

## Requirements
1. Oracle Cerner HL7v2 SIU integration that receives and processes surgical scheduling messages identically to Epic
2. MEDITECH HL7v2 SIU integration that receives and processes surgical scheduling messages identically to Epic
3. Global admin settings UI to configure which EHR system a facility uses (Epic / Oracle Cerner / MEDITECH)
4. Identical frontend experience across all three systems (review queue, entity mapping, case creation)
5. Shared backend pipeline (parser, matcher, case creation) with per-system adapters for field preference differences
6. Per-system setup instructions/help text for hospital IT teams
7. Test message capability for all three systems

## Database Context
- Table: `ehr_integrations` — needs `integration_type` expanded to include `cerner_hl7v2`, `meditech_hl7v2`
- Table: `ehr_integration_log` — already generic, no changes expected
- Table: `ehr_entity_mappings` — already generic, no changes expected
- Table: `cases` — `external_system` column needs to support new values

## UI/UX
- Route: `/settings/integrations` (existing)
- Key interactions:
  - Facility admin selects EHR system type from dropdown/tabs
  - System-specific configuration form (endpoint URL, API key, etc.)
  - System-specific setup instructions for hospital IT
  - Shared review queue showing source system badge
  - Shared entity mapping UI (surgeon, procedure, room)
- Design: Mirror existing Epic integration UI, add system selector

## Files Likely Involved

### Backend (Edge Function + Libraries)
- `supabase/functions/hl7v2-listener/index.ts` — route by integration type
- `supabase/functions/hl7v2-listener/import-service.ts` — system-specific field preferences
- `lib/integrations/epic/` → rename to `lib/integrations/ehr/` with adapters
- `lib/integrations/ehr/adapters/epic.ts` — Epic-specific field preferences
- `lib/integrations/ehr/adapters/cerner.ts` — Cerner-specific field preferences (NEW)
- `lib/integrations/ehr/adapters/meditech.ts` — MEDITECH-specific field preferences (NEW)

### Frontend (Settings UI)
- `app/settings/integrations/` — add system type selector
- `components/` — integration config components, review queue

### Database
- New migration for `integration_type` constraint expansion

## iOS Parity
- [x] iOS can wait (integration config is admin-only, web-only)

## Known Issues / Constraints
- HL7v2 SIU message format is standardized but systems have minor field placement variations
- Cerner may include custom Z-segments that need to be handled gracefully (parse but don't fail)
- MEDITECH tends to use PV1-7 as primary surgeon field (vs Epic's AIP segment)
- Hospital IT must configure their outbound interface — this is a setup task on their end, not code
- The existing parser (`lib/hl7v2/parser.ts`) is already generic and handles any HL7v2 message

## Out of Scope
- Cerner FHIR R4 REST API integration (different architecture, future feature)
- Athenahealth integration (not a surgical scheduling system)
- SIS / HST Pathways integration (requires business partnerships, no public API)
- HL7v2 message sending (we only receive)
- Any changes to existing Epic integration behavior

## Acceptance Criteria
- [ ] Oracle Cerner HL7v2 SIU messages are parsed and create cases identically to Epic
- [ ] MEDITECH HL7v2 SIU messages are parsed and create cases identically to Epic
- [ ] Global admin settings allow selecting EHR system type per facility
- [ ] System-specific setup instructions are shown for each EHR type
- [ ] Review queue works for all three systems with source system badge
- [ ] Entity mapping (surgeon, procedure, room) works across all systems
- [ ] Test message panel works for all three systems
- [ ] Existing Epic integration is unaffected (no regression)
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced

## Research Reference
- Full research document: `docs/research/2026-03-02_multi-ehr-integration-research.md`
- Contains: market analysis, API docs, field mapping differences, Athenahealth sandbox findings, reference links
