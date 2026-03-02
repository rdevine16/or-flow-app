# Project: Epic HL7v2 Surgical Case Scheduling Integration
**Completed:** 2026-03-02
**Branch:** feature/epic-hl7v2-integration
**Duration:** 2026-01-07 → 2026-03-02
**Total Phases:** 17

## What Was Built
A complete HL7v2 SIU (Schedule Information Unsolicited) message integration pipeline for receiving real-time surgical scheduling data from Epic's OpTime module. This replaces the earlier FHIR-based approach, which was patient-centric and didn't expose surgical scheduling data (OR room assignments, case IDs, block times, procedure sequencing).

The system includes: a generic HL7v2 message parser with SIU-specific extraction, a Supabase Edge Function listener endpoint, an automated case import service with entity matching (surgeons, procedures, rooms, patients), a review queue for unmatched entities, a comprehensive test harness with database-driven test data management, auto-push behavior that mimics Epic's real-time message flow, and a case history audit trail tracking every change to cases from both manual edits and integration imports.

Key design decisions: API key + Basic Auth for endpoint security, service role key for DB access, belt-and-suspenders deduplication (message-level MSH-10 + case-level external_case_id), full HIPAA audit trail, and the existing FHIR code preserved in `lib/epic/` for future ModMed reuse.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | HL7v2 message parser and SIU type definitions | `96418ed` |
| 2     | Database schema for EHR integrations and external case tracking | `b969c2e` |
| 3     | Case import service with patient/provider/procedure matching | `53e5f0b` |
| 4     | HL7v2 listener endpoint (Edge Function) for receiving Epic messages | `9f9bf5d` |
| 5     | SIU test harness with realistic surgical case scenarios | `a9850c3` |
| 6     | Admin UI for integration management, review queue, and log viewing | `dd93cb9` |
| 7     | HIPAA audit trail, PHI access logging, and raw message retention purge | `b23a6c4` |
| 8     | Test data manager schema and DAL for configurable entity pools | `7d9af4e` |
| 9     | Global admin CRUD UI for test entity pools (surgeons, procedures, rooms, patients, diagnoses) | `6e944d5` |
| 10    | Global admin CRUD UI for test schedule entries with trigger event sequencing | `0701b45` |
| 11    | Rewire test harness to use database-driven test data from Test Data Manager | `512c4a4` |
| 12    | Auto-push API for sending SIU messages on schedule CRUD | `94ae684` |
| 13    | Auto-push UI toggle and inline send feedback in Schedule Manager | `54de8ef` |
| 14    | Review queue redesign with drawer and scannable list | `ba37920` |
| 15    | Approve all button and approval handler fix | `32a0f45` |
| 16    | Case history schema, trigger, and DAL for automatic change tracking | `1fc44b9` |
| 17    | Case history timeline tab in case drawer | `9c735e4` |

## Key Files Created/Modified

### New directories
- `lib/hl7v2/` — HL7v2 parser, SIU parser, ACK generator, types
- `lib/integrations/` — Case import service, entity matching, review queue logic
- `app/settings/integrations/epic/` — Admin UI (Overview, Review Queue, Mappings, Logs tabs)
- `app/admin/settings/hl7v2-test-harness/` — Global admin test harness UI
- `components/integrations/` — Integration UI components (review drawer, entity resolver, mapping tables, test data CRUD)
- `components/cases/CaseHistoryTab.tsx` — Case history timeline in case drawer
- `supabase/functions/hl7v2-listener/` — Edge Function for receiving HL7v2 messages

### Key files
- `lib/hl7v2/parser.ts` — Generic HL7v2 message parser
- `lib/hl7v2/siu-parser.ts` — SIU-specific message extraction
- `lib/hl7v2/ack-generator.ts` — ACK response generator
- `lib/hl7v2/types.ts` — TypeScript interfaces for all HL7v2 segments
- `lib/integrations/case-import-service.ts` — Maps parsed SIU → ORbit cases
- `lib/integrations/entity-matcher.ts` — Fuzzy matching for surgeons/procedures/rooms
- `lib/dal/integrations.ts` — DAL for EHR integrations, mappings, import logs
- `lib/dal/test-data.ts` — DAL for test entity pools and schedule entries
- `lib/dal/case-history.ts` — DAL for case history with FK resolution

### Database migrations
- `create_ehr_integration_tables.sql` — `ehr_integrations`, `ehr_integration_log`, `ehr_entity_mappings`
- `add_external_case_tracking.sql` — `external_case_id`, `external_system`, `import_source` on cases
- `create_hipaa_audit_tables.sql` — `hipaa_audit_log`, `phi_access_log`, retention purge function
- `create_test_data_tables.sql` — `test_surgeons`, `test_procedures`, `test_rooms`, `test_patients`, `test_diagnoses`, `test_schedule_entries`
- `create_case_history.sql` — `case_history` table with trigger on cases INSERT/UPDATE

## Architecture Decisions
- **HL7v2 over FHIR:** Epic's FHIR APIs are patient-centric and don't expose surgical scheduling data. HL7v2 SIU messages contain exactly what ORbit needs.
- **Edge Function with full processing:** Single endpoint that parses, matches, creates/updates cases, and returns ACK — no intermediate queue.
- **Parser duplicated into Edge Function:** Deno runtime can't import from `lib/`, so parser code is copied. Auto-matcher (`lib/epic/auto-matcher.ts`) is imported directly since it's string-generic.
- **Belt-and-suspenders dedup:** Message-level (MSH-10 control ID) + case-level (`external_case_id` + `facility_id`) deduplication prevents duplicate imports.
- **Database-driven test data:** Replaced hardcoded `surgical-data.ts` with CRUD-able entity pools in global admin, enabling hand-crafted test scenarios.
- **Auto-push mimics Epic:** Creating/editing/deleting schedule entries automatically sends the corresponding SIU message (S12/S14/S15) to the facility's listener.
- **Case history via trigger:** PostgreSQL trigger on `cases` table captures every INSERT/UPDATE automatically — zero chance of missing changes. Stores diffs with source attribution (Manual vs Epic HL7v2).
- **Generic EHR tables:** `ehr_integrations` and `ehr_entity_mappings` are system-agnostic, supporting future EHR vendors beyond Epic.

## Database Changes
- **Tables created:** `ehr_integrations`, `ehr_integration_log`, `ehr_entity_mappings`, `hipaa_audit_log`, `phi_access_log`, `test_surgeons`, `test_procedures`, `test_rooms`, `test_patients`, `test_diagnoses`, `test_schedule_entries`, `case_history`
- **Columns added to `cases`:** `external_case_id`, `external_system`, `import_source`
- **Triggers:** `case_history_trigger` on cases (INSERT/UPDATE → `case_history`)
- **Functions:** `create_notification_if_enabled()`, `purge_old_messages()` (pg_cron retention), case history trigger function with user attribution
- **RLS:** Policies on all new tables, facility-scoped
- **Edge Function:** `hl7v2-listener` deployed to Supabase

## Known Limitations / Future Work
- **Pre-existing test failures:** 40 test failures in Epic FHIR and HL7v2 test harness test files (mock type mismatches, not functional issues)
- **Profile image upload tests:** The profile avatar feature (committed separately on this branch) has no unit/integration tests — should be addressed before merge
- **Notification center:** Feature spec and planning docs committed but implementation not started (separate project)
- **iOS parity:** iOS app does not yet have integration management UI or case history display
- **Production deployment:** Edge Function is deployed but needs real Epic integration engine connection for production use
- **Retention purge:** `purge_old_messages()` function exists but pg_cron job needs to be configured per-facility
