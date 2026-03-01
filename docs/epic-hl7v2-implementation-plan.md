# Epic HL7v2 Surgical Case Scheduling — Implementation Plan

## Executive Summary

ORbit is transitioning its Epic integration strategy from FHIR REST APIs to HL7v2 message-based interfaces for surgical case import. The existing Epic FHIR integration (patient lookup, OAuth2 auth) proved that Epic's FHIR APIs are **patient-centric** and do not expose surgical scheduling data (OR assignments, block times, procedure sequencing, surgeon assignments). Surgical scheduling lives in Epic's **OpTime** module, which only exposes data through **HL7v2 outbound interfaces** — specifically the "Outgoing Surgical Case Scheduling" interface.

This plan builds an HL7v2 SIU (Schedule Information Unsolicited) listener that receives real-time push notifications from Epic whenever a surgical case is created, modified, rescheduled, or canceled. We also build a test harness that generates realistic SIU messages mimicking Epic OpTime output, so we can develop and validate without needing Epic's paid sandbox ($1,900/year Vendor Services).

## Why the Transition

### What Epic FHIR Gives You (Patient-Centric)
- Patient demographics, conditions, medications, encounters
- Practitioner lookup, organization data
- Generic Appointment/ServiceRequest resources (clinic visits, not surgical cases)
- **Does NOT include:** OR room assignments, surgical case IDs, block time allocations, procedure sequencing, surgeon-specific scheduling, case status events (wheels in, incision, wheels out)

### What Epic HL7v2 Gives You (Surgical Schedule)
- **Outgoing Surgical Case Scheduling** — sends SIU messages for new, rescheduled, updated, and canceled surgical cases
- **Incoming Surgical Case Tracking** — receives case event timestamps (milestone data we could write back)
- Real-time push: Epic sends messages to our listener automatically when the schedule changes
- Contains: patient demographics, surgeon, procedure codes (CPT), OR room, scheduled date/time, case duration, diagnosis codes, case status — exactly what ORbit needs to create cases

### What's Transferable from Existing Epic FHIR Code

**KEEP and reuse for ModMed FHIR integration (not for Epic HL7v2):**
- OAuth2 token management patterns (ModMed uses OAuth2 password grant)
- FHIR R4 resource parsing logic (ModMed Proprietary API uses FHIR R4)
- Patient demographic mapping logic (name parsing, address formatting, phone normalization)
- Error handling and retry patterns
- Integration credential storage patterns (per-facility credential management)
- Any admin UI for managing integration connections

**DO NOT reuse for Epic HL7v2 (fundamentally different paradigm):**
- REST client / HTTP request logic (HL7v2 is TCP socket or HTTP POST of pipe-delimited messages, not REST)
- FHIR JSON parsing (HL7v2 is pipe-delimited text segments, not JSON)
- Pull-based polling logic (HL7v2 Outgoing is push-based — Epic sends to us)

**Action:** Audit existing Epic FHIR files. Identify reusable modules. Archive Epic-specific FHIR code but preserve patterns for ModMed. The HL7v2 listener is a net-new service.

---

## HL7v2 SIU Message Format Reference

### Trigger Events ORbit Cares About

| Event | Meaning | ORbit Action |
|-------|---------|-------------|
| `SIU^S12` | New surgical case booked | Create new case in `cases` table |
| `SIU^S13` | Case rescheduled | Update case date/time/room |
| `SIU^S14` | Case modified (details changed) | Update case details (surgeon, procedure, etc.) |
| `SIU^S15` | Case canceled | Update case status to `cancelled` |
| `SIU^S16` | Case discontinued (in-progress stop) | Update case status to `cancelled` with reason |

### SIU Message Structure (Segments)

All SIU trigger events share the same segment structure:

```
MSH — Message Header (sending app, receiving app, timestamp, message type, version)
SCH — Schedule Activity (case ID, duration, start/end time, status, requesting provider)
PID — Patient Identification (MRN, name, DOB, gender, address, phone)
PV1 — Patient Visit (attending physician, facility, visit type)
DG1 — Diagnosis (ICD-10 codes, diagnosis description) [optional, repeatable]
RGS — Resource Group (groups the following resource segments)
AIS — Appointment Information - Service (procedure/CPT code, start time, duration)
AIG — Appointment Information - General Resource (equipment, staff)
AIL — Appointment Information - Location (OR room, facility)
AIP — Appointment Information - Personnel (surgeon, anesthesiologist, nurses)
```

### Example: Epic OpTime SIU^S12 (New Surgical Case)

This is what Epic's Outgoing Surgical Case Scheduling interface sends. The test harness must generate messages matching this structure:

```
MSH|^~\&|EPIC|SURGERY_CENTER|||20260301143022||SIU^S12|MSG00001|P|2.3||||||
SCH|SC10001^SC10001|FL20001^FL20001|||SC10001|SURGERY^Surgical Case|Right knee total arthroplasty|SURGERY|120|min|^^120^20260315080000^20260315100000|||||1001^SMITH^JOHN^A^MD^^^^NPI^1234567890||||1001^SMITH^JOHN^A^MD^^^^|||||Booked
PID|1||MRN12345^^^^MR||DOE^JANE^M^^||19650415|F|||123 Main St^^Springfield^IL^62704^US||(217)555-0123^HOME|(217)555-0456^WORK||S||ACCT98765|987-65-4321||||||||||||||||||
PV1|1|O|OR3^^^SURGERY_CENTER^^^^^||||1001^SMITH^JOHN^A^MD^^^^||ORTHO||||||||||||12345||||||||||||||||||||||||||||V
DG1|1|I10|M17.11^Primary osteoarthritis, right knee^I10|Primary osteoarthritis, right knee||
RGS|1|A|RG001
AIS|1|A|27447^Total knee arthroplasty^CPT|20260315080000|15|min|120|min|Booked||
AIL|1|A|OR3^^^SURGERY_CENTER|^Operating Room 3||20260315080000|||120|min||Booked
AIP|1|A|1001^SMITH^JOHN^A^MD^^^^|SURGEON||20260315080000|||120|min||Booked
AIP|2|A|2001^JONES^MARIA^L^MD^^^^|ANESTHESIOLOGIST||20260315075500|||135|min||Booked
```

### Key Field Mappings: SIU → ORbit `cases` Table

| SIU Segment.Field | HL7 Field | ORbit Column | Notes |
|-------------------|-----------|-------------|-------|
| `SCH-1` | Placer Appointment ID | `external_case_id` (new) | Epic's internal case ID |
| `SCH-2` | Filler Appointment ID | `external_filler_id` (new) | Secondary Epic ID |
| `SCH-7` | Appointment Reason | `notes` or `procedure description` | Free text reason |
| `SCH-11.4` | Start Date/Time | `scheduled_date` + `scheduled_start_time` | Format: YYYYMMDDHHMMSS |
| `SCH-11.5` | End Date/Time | Derive `estimated_duration` | End - Start = duration |
| `SCH-25` | Filler Status Code | Map to `case_status_id` | Booked/Cancelled/etc. |
| `PID-3` | Patient MRN | `patients.mrn` | Match or create patient |
| `PID-5` | Patient Name | `patients.first_name`, `last_name` | Format: LAST^FIRST^MIDDLE |
| `PID-7` | Date of Birth | `patients.date_of_birth` | Format: YYYYMMDD |
| `PID-8` | Gender | `patients.gender` | M/F/O/U |
| `PV1-7` | Attending Doctor | `surgeon_id` | Match by NPI or name |
| `PV1-3` | Assigned Location | `or_room_id` | Match OR room by name |
| `DG1-3` | Diagnosis Code | `primary_diagnosis_code` (new) | ICD-10 code |
| `DG1-4` | Diagnosis Description | `primary_diagnosis_desc` (new) | Text description |
| `AIS-3` | Service/Procedure | `procedure_type_id` | Match by CPT code |
| `AIS-4` | Start Time | Confirm `scheduled_start_time` | Cross-reference with SCH-11 |
| `AIS-7` | Duration | `estimated_duration` | In minutes |
| `AIL-3` | Location | `or_room_id` | Confirm OR room |
| `AIP-3` | Personnel | `surgeon_id` / staff | Match provider by ID/NPI |
| `AIP-4` | Role | Staff role mapping | SURGEON, ANESTHESIOLOGIST, etc. |

---

## Implementation Phases

### Phase 1: HL7v2 Parser & Message Models

**Goal:** Build a robust HL7v2 message parser that can decode pipe-delimited SIU messages into structured TypeScript objects.

**Tasks:**
1. Create `lib/hl7v2/parser.ts` — generic HL7v2 message parser
   - Parse MSH (Message Header) to identify message type and trigger event
   - Parse pipe-delimited segments into typed objects
   - Handle field separators (`|`), component separators (`^`), subcomponent separators (`&`), repetition separators (`~`), escape character (`\`)
   - Handle optional/missing fields gracefully (many fields will be empty)
2. Create `lib/hl7v2/types.ts` — TypeScript interfaces for all SIU segments
   - `MSHSegment`, `SCHSegment`, `PIDSegment`, `PV1Segment`, `DG1Segment`, `RGSSegment`, `AISSegment`, `AIGSegment`, `AILSegment`, `AIPSegment`
   - `SIUMessage` — composite type containing all parsed segments
3. Create `lib/hl7v2/siu-parser.ts` — SIU-specific parser that uses the generic parser
   - Extract surgical case data from SIU messages
   - Map trigger events (S12, S13, S14, S15, S16) to action types
   - Validate required fields are present
4. Create `lib/hl7v2/ack-generator.ts` — generates ACK response messages
   - HL7v2 protocol requires an ACK (acknowledgment) response for each message received
   - Generate AA (Application Accept), AE (Application Error), AR (Application Reject)

**Tests:**
- Parse a valid SIU^S12 message and verify all fields extracted correctly
- Parse messages with missing optional segments (no DG1, no AIG)
- Parse messages with repeating segments (multiple AIP for surgeon + anesthesiologist)
- Handle malformed messages gracefully (return error, don't crash)
- Verify ACK generation with correct message control ID

### Phase 2: Database Schema Extensions

**Goal:** Extend the existing database to support EHR integration metadata and external case tracking.

**Tasks:**
1. Create `ehr_integrations` table — stores per-facility integration configurations
   ```
   id, facility_id, integration_type ('epic_hl7v2', 'modmed_fhir', 'csv_import'),
   display_name, config (jsonb — connection details, credentials, mappings),
   is_active, created_at, updated_at
   ```
2. Create `ehr_integration_log` table — audit trail for all inbound messages
   ```
   id, facility_id, integration_id (FK to ehr_integrations),
   message_type ('SIU^S12', 'SIU^S13', etc.), message_control_id,
   raw_message (text — full HL7v2 message for debugging),
   parsed_data (jsonb — structured extraction),
   processing_status ('received', 'processed', 'error', 'ignored'),
   error_message, external_case_id,
   case_id (FK to cases, NULL until matched/created),
   created_at, processed_at
   ```
3. Add columns to `cases` table:
   - `external_case_id` (text, nullable) — the source system's case identifier
   - `external_system` (text, nullable) — 'epic', 'modmed', 'csv', etc.
   - `import_source` (text, nullable) — 'hl7v2', 'fhir', 'csv', 'manual'
   - `primary_diagnosis_code` (text, nullable) — ICD-10
   - `primary_diagnosis_desc` (text, nullable) — description
4. Add columns to `patients` table (if not already present):
   - `mrn` (text, nullable) — medical record number from source system
   - `external_patient_id` (text, nullable) — source system's patient ID
5. Add index: `cases(external_case_id, external_system, facility_id)` — for upsert matching
6. Add index: `patients(mrn, facility_id)` — for patient matching
7. RLS policies on new tables — facility-scoped, same pattern as existing tables

**Important:** Claude Code has direct database access. Let it inspect the current schema for `cases` and `patients` tables before adding columns — some of these may already exist or need to be named differently to match existing conventions.

### Phase 3: Case Import Service

**Goal:** Build the business logic layer that maps parsed SIU messages to ORbit database operations.

**Tasks:**
1. Create `lib/integrations/epic/case-import-service.ts`
   - `handleSIUMessage(message: SIUMessage, facilityId: string)` — main entry point
   - Route by trigger event: S12 → create, S13 → reschedule, S14 → update, S15 → cancel, S16 → discontinue
2. Implement patient matching/creation:
   - Search `patients` by `mrn` + `facility_id` first
   - If not found, search by `first_name` + `last_name` + `date_of_birth` + `facility_id`
   - If still not found, create new patient record from PID segment
   - Update patient demographics if existing record found (demographics may change)
3. Implement surgeon matching:
   - Match by NPI from AIP segment against `users` table
   - Fall back to name matching if NPI not available
   - If no match found, log warning and leave `surgeon_id` null (admin resolves manually)
4. Implement procedure matching:
   - Match CPT code from AIS segment against `procedure_types` table for the facility
   - If no match, log warning and create case with procedure description as notes
5. Implement OR room matching:
   - Match location name from AIL segment against `or_rooms` table for the facility
   - Handle room name variations (e.g., "OR3" vs "OR 3" vs "Operating Room 3")
6. Implement case creation (S12):
   - Create case record with all mapped fields
   - Set `import_source = 'hl7v2'`, `external_system = 'epic'`
   - Set `external_case_id` from SCH-1
   - Status = 'scheduled'
   - Pre-create milestone rows via existing trigger pipeline
7. Implement case update (S13, S14):
   - Look up existing case by `external_case_id` + `facility_id`
   - Update changed fields only
   - Log what changed for audit trail
8. Implement case cancellation (S15, S16):
   - Look up existing case by `external_case_id` + `facility_id`
   - Update status to 'cancelled'
   - Preserve cancellation reason if provided
9. Write all operations to `ehr_integration_log` for audit trail

**Important considerations:**
- All operations must be idempotent — receiving the same S12 twice should not create duplicates
- Use `external_case_id` + `facility_id` as the deduplication key
- Wrap create/update in a transaction
- Do NOT trigger `data_validated = true` on import — that's for after milestones are recorded during the actual surgery

### Phase 4: HL7v2 Listener Endpoint

**Goal:** Build the HTTP endpoint that receives HL7v2 messages from Epic (or from our test harness).

**Context:** In production, Epic can send HL7v2 messages over TCP (MLLP — Minimum Lower Layer Protocol) or HTTP(S). For ASC environments and modern deployments, **HTTP(S) is preferred** — it's firewall-friendly, works with Vercel/Edge Functions, and doesn't require a persistent TCP socket server. Many Epic customers use an integration engine (Mirth Connect, Rhapsody) that can POST HL7v2 messages over HTTP.

**Tasks:**
1. Create Supabase Edge Function: `supabase/functions/hl7v2-listener/index.ts`
   - Accepts HTTP POST with HL7v2 message in request body
   - Content-Type: `application/hl7-v2` or `text/plain`
   - Authenticates via API key in header (per-facility key stored in `ehr_integrations.config`)
   - Parses message using SIU parser from Phase 1
   - Routes to case import service from Phase 3
   - Returns HL7v2 ACK message in response body
   - Handles errors gracefully — always return an ACK (AA for success, AE for error)
2. Alternative: Create Next.js API route `app/api/integrations/hl7v2/route.ts`
   - Same logic as Edge Function but runs on Vercel
   - Evaluate which deployment model is better for ORbit's architecture
   - Edge Function is better if you want it decoupled from the web app
   - API route is better if you want it in the same codebase and deployment
3. Implement authentication:
   - Each facility gets a unique API key stored in `ehr_integrations.config`
   - Header: `X-Integration-Key: <facility_api_key>`
   - Look up facility from API key
   - Reject unauthorized requests
4. Implement rate limiting and basic DDoS protection
5. Implement request logging (every message logged to `ehr_integration_log`)

### Phase 5: Test Harness — SIU Message Generator

**Goal:** Build a test tool that generates realistic SIU messages mimicking Epic OpTime output. This lets us develop and test the full pipeline without Epic sandbox access.

**Tasks:**
1. Create `lib/hl7v2/test-harness/siu-generator.ts`
   - Generate SIU^S12 (new case) with realistic surgical data
   - Generate SIU^S13 (reschedule) referencing an existing case
   - Generate SIU^S14 (modify) changing surgeon, room, or procedure
   - Generate SIU^S15 (cancel) with cancellation reason
   - Uses ORbit's existing demo data profiles for realistic values
2. Create `lib/hl7v2/test-harness/surgical-data.ts` — realistic surgical case data pool
   - Orthopedic procedures: Total knee arthroplasty (27447), Total hip arthroplasty (27130), ACL reconstruction (29888), Rotator cuff repair (29827), Carpal tunnel release (64721)
   - Ophthalmology procedures: Cataract surgery (66984), Vitrectomy (67036), Glaucoma surgery (66170)
   - GI procedures: Colonoscopy (45378), Upper endoscopy (43239), Laparoscopic cholecystectomy (47562)
   - Spine procedures: Lumbar fusion (22612), Cervical discectomy (63075), Laminectomy (63047)
   - General surgery: Laparoscopic hernia repair (49650), Laparoscopic appendectomy (44970)
   - Realistic OR room names (OR-1 through OR-8, Endo Suite 1-2, Cath Lab)
   - Realistic surgeon names with NPIs
   - Realistic patient demographics
   - Appropriate diagnosis codes (ICD-10) paired with procedures
   - Realistic scheduling patterns (8am-5pm, 15-min setup gaps, case durations by procedure type)
3. Create `lib/hl7v2/test-harness/scenario-runner.ts`
   - "Full day scenario" — generates a complete OR day schedule (10-15 cases across 4 rooms)
   - "Chaos scenario" — generates normal day then fires reschedules, cancellations, and add-on cases
   - "Multi-day scenario" — generates a week of OR schedules
   - Each scenario outputs an ordered sequence of SIU messages with realistic timestamps
4. Create admin page or API endpoint to trigger test scenarios:
   - `POST /api/integrations/test-harness` with scenario name and facility ID
   - Sends generated SIU messages to the HL7v2 listener endpoint
   - Reports results (cases created, updated, errors)

### Phase 6: Admin UI for Integration Management

**Goal:** Build the facility admin interface for configuring and monitoring EHR integrations.

**Tasks:**
1. Create integration settings page (under facility admin):
   - List configured integrations for the facility
   - Add/edit Epic HL7v2 integration (generates API key, shows endpoint URL)
   - Toggle integration active/inactive
   - Show connection status (last message received, last error)
2. Create integration log viewer:
   - Filterable by message type, status, date range
   - Show raw message and parsed data side-by-side
   - Show which case was created/updated
   - Error details for failed messages
3. Create field mapping configuration (stretch goal):
   - Some facilities may send non-standard field positions
   - Admin UI to map which HL7v2 fields map to which ORbit fields
   - Store custom mappings in `ehr_integrations.config` jsonb
4. Test harness controls (admin/dev only):
   - Trigger test scenarios from the UI
   - Review generated test messages before sending
   - Clear test data

---

## File Structure

```
lib/
  hl7v2/
    parser.ts                    — Generic HL7v2 message parser
    types.ts                     — TypeScript interfaces for all segments
    siu-parser.ts                — SIU-specific message parser
    ack-generator.ts             — ACK response message builder
    test-harness/
      siu-generator.ts           — Generates realistic SIU messages
      surgical-data.ts           — Procedure/surgeon/patient data pools
      scenario-runner.ts         — Orchestrates multi-message test scenarios
  integrations/
    epic/
      case-import-service.ts     — Maps SIU → ORbit database operations
      patient-matcher.ts         — Patient matching/creation logic
      provider-matcher.ts        — Surgeon/staff matching logic
      procedure-matcher.ts       — Procedure type matching by CPT
      room-matcher.ts            — OR room matching by name
    shared/
      integration-types.ts       — Shared types across all integrations
      integration-logger.ts      — Writes to ehr_integration_log

app/
  api/
    integrations/
      hl7v2/
        route.ts                 — HL7v2 listener endpoint
      test-harness/
        route.ts                 — Test scenario trigger endpoint

app/
  admin/                         — or wherever facility admin lives
    integrations/
      page.tsx                   — Integration list/management page
      [id]/
        page.tsx                 — Integration detail/config page
        logs/
          page.tsx               — Integration log viewer
```

---

## Testing Strategy

### Unit Tests (Vitest)
- HL7v2 parser: valid messages, edge cases, malformed input
- SIU parser: all trigger events, missing segments, repeating segments
- ACK generator: success, error, reject responses
- Field mapping: each SIU field → ORbit column mapping
- Patient matcher: exact match, fuzzy match, no match → create
- Provider matcher: NPI match, name match, no match
- Procedure matcher: CPT match, no match
- Room matcher: exact name, variations, no match

### Integration Tests
- Full pipeline: SIU message → parser → import service → database
- Idempotency: same S12 sent twice → only one case created
- Lifecycle: S12 (create) → S14 (modify) → S15 (cancel) — verify case state at each step
- Error handling: invalid message → error logged, no case created, AE response returned

### Scenario Tests
- Full day scenario: 15 cases → 15 rows in `cases`, all with correct data
- Chaos scenario: creates + reschedules + cancellations → final state matches expected
- Verify `ehr_integration_log` has complete audit trail for every message

---

## Production Deployment Considerations

### When a Paying Customer on Epic is Ready
1. Sign up for Epic Vendor Services ($1,900/year) to get exact field mapping specs
2. Customer's IT team configures "Outgoing Surgical Case Scheduling" interface to point at our HTTPS endpoint
3. Epic sends via integration engine (Mirth Connect, Rhapsody, etc.) — standard HTTP POST
4. If customer requires TCP/MLLP: consider a lightweight MLLP-to-HTTP proxy (many open-source options)
5. Work with customer to validate field mappings against their specific Epic configuration
6. Some facilities customize which fields are populated — our admin field mapping UI (Phase 6) handles this

### Security
- HTTPS only (TLS 1.2+)
- Per-facility API keys (rotate-able)
- All messages logged for HIPAA audit trail
- PHI in `ehr_integration_log.raw_message` — ensure table has appropriate RLS and encryption considerations
- Consider purging raw messages after X days (configurable retention policy)

### HIPAA Compliance
- HL7v2 messages contain PHI (patient name, DOB, MRN, diagnosis)
- All transit encrypted (HTTPS)
- All storage in Supabase (already HIPAA-covered if on appropriate plan)
- Audit log provides required access tracking
- Retention policy for raw messages

---

## Estimated Effort by Phase

| Phase | Description | Complexity | Claude Code Sessions |
|-------|-------------|------------|---------------------|
| 1 | HL7v2 Parser & Message Models | Medium | 1 session |
| 2 | Database Schema Extensions | Light | 1 session (inspect existing schema first) |
| 3 | Case Import Service | Heavy | 2 sessions (matching logic is nuanced) |
| 4 | HL7v2 Listener Endpoint | Medium | 1 session |
| 5 | Test Harness | Medium | 1-2 sessions |
| 6 | Admin UI | Medium-Heavy | 2 sessions |

**Total: ~8-9 Claude Code sessions**

**Commit after each phase:**
1. `feat: HL7v2 message parser and SIU type definitions`
2. `feat: database schema for EHR integrations and external case tracking`
3. `feat: Epic case import service with patient/provider/procedure matching`
4. `feat: HL7v2 listener endpoint for receiving Epic surgical case messages`
5. `feat: SIU test harness with realistic surgical case scenarios`
6. `feat: admin UI for integration management and log viewing`
