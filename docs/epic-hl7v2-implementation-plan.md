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

## Review Decisions Summary

> Decisions from /review on 2026-03-01 — incorporated into phases below

- **Primary goal:** Test harness to validate Epic HL7v2 field mappings without $1,900/year sandbox
- **Database:** New generic `ehr_integrations` + `ehr_integration_log` + `ehr_entity_mappings` tables. Existing `epic_*` tables stay untouched.
- **Listener:** Supabase Edge Function with full processing (parse → match → create cases → ACK). Parser code duplicated into Edge Function directory.
- **DB access:** Service role key, facility scoping in application code
- **Dedup:** Belt-and-suspenders — message-level (`message_control_id`) + case-level (`external_case_id + facility_id`)
- **Patient matching:** Flag for review if MRN matches but demographics differ (cautious HIPAA approach)
- **Triggers:** Imported cases fire full trigger pipeline (first-class citizens)
- **Auto-matcher:** Import `lib/epic/auto-matcher.ts` directly (string-generic Levenshtein)
- **Admin UI:** Replace FHIR pages at `app/settings/integrations/epic/` with HL7v2 tab-based layout (Overview | Review Queue | Mappings | Logs)
- **Review queue:** Expandable rows with inline EntityResolver, minimal "Create New" forms pre-filled from HL7v2 data
- **Mappings tab:** Same pattern as FHIR mappings (3 sub-tabs: Surgeons | Rooms | Procedures)
- **Logs tab:** Side-by-side raw + parsed view, Supabase Realtime for live streaming
- **Overview tab:** Prominent setup instructions card (endpoint URL, API key, curl example)
- **Test harness:** Separate page at `app/admin/settings/hl7v2-test-harness/`, global admin only, full control panel with message preview
- **API keys:** Auto-generated UUID on setup, shown once, rotatable
- **Audit:** Full HIPAA trail — message log + admin actions + PHI access tracking
- **Retention:** Build raw message purge mechanism now (pg_cron, configurable retention period)
- **`cases` columns:** Keep existing `source` as-is, add `external_system` + `import_source` + `external_case_id` + `primary_diagnosis_code` + `primary_diagnosis_desc`
- **`patients` columns:** `mrn` already exists, add `external_patient_id`
- **FHIR pages:** Remove completely, clean break. `lib/epic/` code stays for future ModMed reuse.

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

**Schema verified:** `cases.source` already exists (CHECK: 'manual', 'epic', 'cerner'). `patients.mrn` already exists. Six new columns needed.

**Tasks:**
1. Create `ehr_integrations` table — stores per-facility integration configurations
   ```sql
   id UUID PK DEFAULT gen_random_uuid(),
   facility_id UUID NOT NULL FK(facilities) ON DELETE CASCADE,
   integration_type TEXT NOT NULL CHECK (integration_type IN ('epic_hl7v2', 'modmed_fhir', 'csv_import')),
   display_name TEXT,
   config JSONB NOT NULL DEFAULT '{}',
     -- config: { api_key, endpoint_url, auth_type, basic_auth_user, basic_auth_pass,
     --   rate_limit_per_minute, field_overrides, retention_days (default 90) }
   is_active BOOLEAN NOT NULL DEFAULT true,
   last_message_at TIMESTAMPTZ,
   last_error TEXT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(facility_id, integration_type)
   ```
2. Create `ehr_integration_log` table — audit trail for all inbound messages
   ```sql
   id UUID PK DEFAULT gen_random_uuid(),
   facility_id UUID NOT NULL FK(facilities) ON DELETE CASCADE,
   integration_id UUID NOT NULL FK(ehr_integrations) ON DELETE CASCADE,
   message_type TEXT NOT NULL,  -- 'SIU^S12', 'SIU^S13', etc.
   message_control_id TEXT,      -- MSH-10 for dedup
   raw_message TEXT,             -- Full HL7v2 message (PHI! Subject to retention purge)
   parsed_data JSONB,            -- Structured extraction
   processing_status TEXT NOT NULL DEFAULT 'received'
     CHECK (processing_status IN ('received', 'pending_review', 'processed', 'error', 'ignored')),
   error_message TEXT,
   external_case_id TEXT,
   case_id UUID FK(cases) ON DELETE SET NULL,
   review_notes JSONB,           -- Unmatched entities + suggestions
   reviewed_by UUID FK(auth.users),
   reviewed_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   processed_at TIMESTAMPTZ
   ```
3. Create `ehr_entity_mappings` table — persistent entity mappings for auto-resolution
   ```sql
   id UUID PK DEFAULT gen_random_uuid(),
   facility_id UUID NOT NULL FK(facilities) ON DELETE CASCADE,
   integration_id UUID NOT NULL FK(ehr_integrations) ON DELETE CASCADE,
   mapping_type TEXT NOT NULL CHECK (mapping_type IN ('surgeon', 'room', 'procedure')),
   external_identifier TEXT NOT NULL,  -- Epic name/ID/NPI
   external_display_name TEXT,
   orbit_entity_id UUID,               -- FK to surgeons/rooms/procedure_types
   match_method TEXT CHECK (match_method IN ('auto', 'manual')),
   match_confidence NUMERIC(3,2),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(integration_id, mapping_type, external_identifier)
   ```
4. Add columns to `cases` table (keep existing `source` as-is):
   - `external_case_id` TEXT — Epic's internal case ID (from SCH-1)
   - `external_system` TEXT — 'epic_hl7v2', 'modmed', etc.
   - `import_source` TEXT — 'hl7v2', 'fhir', 'csv', 'manual'
   - `primary_diagnosis_code` TEXT — ICD-10 from DG1-3
   - `primary_diagnosis_desc` TEXT — from DG1-4
5. Add column to `patients` table:
   - `external_patient_id` TEXT — source system's patient ID
6. Add indexes:
   - `cases(external_case_id, external_system, facility_id)` — upsert dedup
   - `patients(mrn, facility_id)` — patient matching (verify doesn't already exist)
   - `patients(external_patient_id, facility_id)` — external ID lookup
   - `ehr_integration_log(facility_id, processing_status)` — review queue queries
   - `ehr_integration_log(message_control_id, integration_id)` — message dedup
   - `ehr_integration_log(external_case_id, facility_id)` — case lookup
7. RLS policies on all new tables — facility-scoped using `get_my_facility_id()` and `get_my_access_level()`
   - Facility admins: full CRUD on own facility's integrations, mappings, and logs
   - Global admins: full CRUD on all
   - Regular users: read-only on own facility's log entries

**Important:** Inspect current schema before running migration. `patients.mrn` already exists. Verify index naming conventions match existing patterns.

### Phase 3: Case Import Service

**Goal:** Build the business logic layer that maps parsed SIU messages to ORbit database operations.

**Tasks:**
1. Create `lib/integrations/epic/case-import-service.ts`
   - `handleSIUMessage(message: SIUMessage, facilityId: string, integrationId: string)` — main entry point
   - Route by trigger event: S12 → create, S13 → reschedule, S14 → update, S15 → cancel, S16 → discontinue
2. Implement patient matching/creation:
   - Search `patients` by `mrn` + `facility_id` first
   - If not found, search by `first_name` + `last_name` + `date_of_birth` + `facility_id`
   - If still not found, create new patient record from PID segment
   - **If MRN matches but demographics differ: flag message as `pending_review`** (HIPAA cautious approach)
3. Implement surgeon matching:
   - Check `ehr_entity_mappings` first for existing mapping
   - Match by NPI from AIP segment against `users` table
   - Fall back to fuzzy name matching using `lib/epic/auto-matcher.ts` (Levenshtein distance)
   - If no match found: add to `review_notes` in log, set status `pending_review`
   - If match found with >=0.90 confidence: auto-map and save to `ehr_entity_mappings`
4. Implement procedure matching:
   - Check `ehr_entity_mappings` first for existing mapping
   - Match CPT code from AIS segment against `procedure_types` table for the facility
   - Fall back to fuzzy name matching
   - If no match: add to `review_notes`, set status `pending_review`
5. Implement OR room matching:
   - Check `ehr_entity_mappings` first for existing mapping
   - Match location name from AIL segment against `or_rooms` table for the facility
   - Handle room name variations (e.g., "OR3" vs "OR 3" vs "Operating Room 3")
   - If no match: add to `review_notes`, set status `pending_review`
6. Implement case creation (S12):
   - Create case record with all mapped fields
   - Set `import_source = 'hl7v2'`, `external_system = 'epic_hl7v2'`
   - Set `external_case_id` from SCH-1
   - Status = 'scheduled'
   - **Full trigger pipeline fires** — milestones pre-created, stats computed (imported cases are first-class)
7. Implement case update (S13, S14):
   - Look up existing case by `external_case_id` + `facility_id`
   - Update changed fields only
   - Log what changed in `ehr_integration_log.parsed_data`
8. Implement case cancellation (S15, S16):
   - Look up existing case by `external_case_id` + `facility_id`
   - Update status to 'cancelled'
   - Preserve cancellation reason if provided
9. Write all operations to `ehr_integration_log` for audit trail

**Deduplication (belt-and-suspenders):**
- **Message-level:** Check `message_control_id` (MSH-10) in `ehr_integration_log`. If already processed, return cached ACK immediately.
- **Case-level:** Check `external_case_id + facility_id` on `cases` table before INSERT.

**Important considerations:**
- All operations must be idempotent
- Wrap create/update in a transaction
- Do NOT trigger `data_validated = true` on import
- Messages with ANY unmatched entity go to `pending_review` — case not created until admin approves

### Phase 4: HL7v2 Listener (Supabase Edge Function)

**Goal:** Build the production-ready HTTP endpoint that receives HL7v2 messages from Epic integration engines (or our test harness). Same code path for test and production — zero rework when a customer connects.

**Architecture:** Supabase Edge Function (Deno runtime) with full processing. Parser code duplicated into Edge Function directory. Uses service role key to bypass RLS, enforces facility scoping in application code.

**Tasks:**
1. Create `supabase/functions/hl7v2-listener/index.ts`
   - Accepts HTTP POST with HL7v2 message in request body
   - Content-Types: `application/hl7-v2`, `text/plain`, `x-application/hl7-v2+er7`
   - Full processing pipeline: auth → parse → match entities → create/update case → log → return ACK
   - Returns HL7v2 ACK response (AA for success, AE for error, AR for reject)
   - Handles errors gracefully — always return an ACK, never crash
2. Duplicate parser code into Edge Function:
   - Copy `parser.ts`, `types.ts`, `siu-parser.ts`, `ack-generator.ts` into `supabase/functions/hl7v2-listener/`
   - Copy entity matching logic (or simplified version) into Edge Function
   - Use Supabase client with service role key for DB operations
3. Implement authentication:
   - **API key:** `X-Integration-Key` header → look up `ehr_integrations` by API key in config JSONB
   - **Basic Auth:** `Authorization: Basic ...` → decode and match against `ehr_integrations.config`
   - Facility determined from credentials → all operations scoped to that facility
   - **No JWT** — Epic integration engines don't have Supabase accounts
4. Implement rate limiting (per-facility, configurable in `ehr_integrations.config`)
5. Log every request to `ehr_integration_log` (even auth failures → status: 'error')
6. Error responses: malformed message → AE ACK + log with 'error' status + error_message describing parse failure

### Phase 5: Test Harness — SIU Message Generator

**Goal:** Build a development tool that generates realistic SIU messages mimicking Epic OpTime output. Validates the full pipeline end-to-end without Epic sandbox ($1,900/year).

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
4. Create API endpoint `app/api/integrations/test-harness/route.ts`
   - `POST` — trigger scenario with config (facility, scenario type, advanced options)
   - Sends generated SIU messages to the HL7v2 listener Edge Function endpoint
   - Returns results summary (cases created, updated, errors)
   - Global admin auth required
5. Create test harness admin page at `app/admin/settings/hl7v2-test-harness/`
   - **Full control panel UI:**
     - Scenario picker dropdown (Full Day, Chaos, Multi-Day)
     - Facility selector dropdown
     - Advanced options: number of cases, date range, specialties to include, specific surgeon names
     - **Message preview** — view generated messages before sending
     - 'Run Scenario' button with progress bar
     - Results summary: X cases created, Y updated, Z pending review, W errors
     - Link to integration Logs tab to see details

### Phase 6: Admin UI for Integration Management

**Goal:** Replace the existing FHIR pages at `app/settings/integrations/epic/` with HL7v2 integration management.

**Architecture:** Single page with 4 tabs using `SettingsTabLayout`. Remove all FHIR PageClient/subpage components. `lib/epic/` code stays for future ModMed reuse.

**Tasks:**
1. **Remove existing FHIR UI pages:**
   - Remove `app/settings/integrations/epic/PageClient.tsx` (FHIR overview)
   - Remove `app/settings/integrations/epic/mappings/` (FHIR entity mappings)
   - Remove `app/settings/integrations/epic/import/` (FHIR case import)
   - Keep `lib/epic/` code intact (auto-matcher reused, rest preserved for ModMed)

2. **Create new `app/settings/integrations/epic/PageClient.tsx`** — tab-based HL7v2 layout:

   **Overview Tab:**
   - Prominent setup instructions card at top: endpoint URL (copy button), API key (masked, click to reveal + copy), supported content types, example curl command
   - Status card: active/inactive toggle, last message timestamp, message count today, error count
   - Stats cards: total imported cases, pending review count, error count
   - Auto-generate UUID API key on first setup, show once in copy dialog
   - 'Rotate Key' button (generates new key, old one immediately invalid)

   **Review Queue Tab:**
   - Table of `ehr_integration_log` rows with `processing_status = 'pending_review'`
   - Colored badges showing which entities are unmatched (surgeon, procedure, room, patient demographics)
   - **Expandable rows** — click to expand inline EntityResolver for each unmatched entity:
     - Fuzzy match suggestions from `lib/epic/auto-matcher.ts` with confidence %
     - Search bar to find existing ORbit entities
     - **Minimal "Create New" button** → inline form pre-filled from HL7v2 data:
       - Surgeon: name + NPI + specialty dropdown
       - Procedure: name + CPT code
       - Room: name
     - After all entities resolved → "Approve Import" → case created, log updated to 'processed'
     - "Reject" → log marked 'ignored' with reason

   **Mappings Tab:**
   - Same pattern as existing FHIR mappings page
   - 3 sub-tabs: Surgeons | Rooms | Procedures
   - Filter pills: All | Mapped | Unmapped
   - Auto-Match button with fuzzy matching
   - Suggestion UI: Accept/Reject with confidence %
   - Data from `ehr_entity_mappings` table

   **Logs Tab:**
   - Table of all `ehr_integration_log` entries for facility
   - Filterable by message type, processing status, date range
   - Status badges: received (blue), processed (green), pending_review (yellow), error (red), ignored (gray)
   - **Expandable rows with side-by-side view:**
     - Left panel: raw HL7v2 message in monospace code block
     - Right panel: parsed data as structured key-value table
   - **Supabase Realtime** — subscribe to `ehr_integration_log` INSERTs, new messages appear live
   - PHI access audit event recorded when raw message is expanded

3. **Data fetching:**
   - Create `lib/dal/integrations.ts` — DAL functions for `ehr_integrations`, `ehr_integration_log`, `ehr_entity_mappings`
   - Use `useSupabaseQuery` for all data fetching
   - Use `useSupabaseQueries` for parallel loading (stats + logs + mappings)

### Phase 7: HIPAA Compliance & Audit Trail

**Goal:** Implement full HIPAA audit trail and raw message retention/purge mechanism.

**Tasks:**
1. **PHI access tracking:**
   - Create `ehr_phi_access_log` table or extend existing audit log
   - Log every time a user views raw HL7v2 message content (contains PHI)
   - Record: user_id, log_entry_id, access_type ('view_raw_message'), timestamp, IP address
   - Integrate with existing audit log system at `app/settings/audit-log/`

2. **Admin action auditing:**
   - Log when admin approves/rejects a pending import
   - Log when admin creates entity mappings
   - Log when admin rotates API key
   - Log when admin toggles integration active/inactive
   - Log when admin runs test harness scenarios

3. **Raw message retention/purge:**
   - `retention_days` config in `ehr_integrations.config` (default: 90 days)
   - Implement pg_cron job: daily purge of `raw_message` column content older than retention period
   - Purge nullifies `raw_message` but preserves `parsed_data` and all other columns
   - Admin UI: show retention policy setting on Overview tab
   - Log purge events in audit trail

4. **Security hardening:**
   - Verify RLS policies prevent cross-facility data access
   - Verify service role key is stored as Edge Function secret (not in code)
   - Add rate limiting per-facility on Edge Function
   - Input validation: reject messages exceeding max size (configurable, default 1MB)

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
      provider-matcher.ts        — Surgeon/staff matching (reuses lib/epic/auto-matcher.ts)
      procedure-matcher.ts       — Procedure type matching by CPT
      room-matcher.ts            — OR room matching by name
    shared/
      integration-types.ts       — Shared types across all integrations
      integration-logger.ts      — Writes to ehr_integration_log
  dal/
    integrations.ts              — DAL for ehr_integrations, ehr_integration_log, ehr_entity_mappings

supabase/
  functions/
    hl7v2-listener/
      index.ts                   — Edge Function entry point (full processing)
      parser.ts                  — Duplicated parser (Deno-compatible)
      types.ts                   — Duplicated types
      siu-parser.ts              — Duplicated SIU parser
      ack-generator.ts           — Duplicated ACK generator

app/
  settings/
    integrations/
      epic/
        page.tsx                 — Server component (metadata)
        PageClient.tsx           — HL7v2 tab-based UI (Overview | Review Queue | Mappings | Logs)
  admin/
    settings/
      hl7v2-test-harness/
        page.tsx                 — Server component
        PageClient.tsx           — Full control panel test harness UI
  api/
    integrations/
      test-harness/
        route.ts                 — Test scenario trigger endpoint (global admin)
```

---

## Testing Strategy

### Unit Tests (Vitest)
- HL7v2 parser: valid messages, edge cases, malformed input
- SIU parser: all trigger events, missing segments, repeating segments
- ACK generator: success, error, reject responses
- Field mapping: each SIU field → ORbit column mapping
- Patient matcher: exact match, fuzzy match, no match → create, demographics mismatch → pending_review
- Provider matcher: NPI match, name match, no match → pending_review, auto-map at >=0.90
- Procedure matcher: CPT match, no match → pending_review
- Room matcher: exact name, variations, no match → pending_review
- Dedup: message-level (MSH-10) and case-level (external_case_id)

### Integration Tests
- Full pipeline: SIU message → Edge Function → parser → import service → database → case created
- Idempotency: same S12 sent twice → only one case created, second returns cached ACK
- Lifecycle: S12 (create) → S14 (modify) → S15 (cancel) — verify case state at each step
- Error handling: invalid message → error logged, no case created, AE response returned
- Auth: invalid API key → rejected, correct API key → processed for correct facility
- Entity mapping persistence: map once → auto-resolves on next message

### Scenario Tests
- Full day scenario: 15 cases → 15 rows in `cases`, all with correct data
- Chaos scenario: creates + reschedules + cancellations → final state matches expected
- Verify `ehr_integration_log` has complete audit trail for every message
- Verify triggers fire correctly (milestones pre-created, stats updated)

---

## Production Deployment Considerations

### When a Paying Customer on Epic is Ready
1. Customer's IT team configures "Outgoing Surgical Case Scheduling" interface to point at our Edge Function HTTPS endpoint
2. Epic sends via integration engine (Mirth Connect, Rhapsody, etc.) — standard HTTP POST
3. Admin enables integration → API key auto-generated → copies to IT team
4. Test with a few messages, verify field mappings in Review Queue
5. Resolve any unmatched entities via Mappings tab
6. If customer requires TCP/MLLP: consider lightweight MLLP-to-HTTP proxy (many open-source options)
7. Sign up for Epic Vendor Services ($1,900/year) for exact field mapping specs if needed

### Security
- HTTPS only (TLS 1.2+)
- Per-facility API keys (auto-generated UUID, rotate-able)
- Basic Auth support for integration engines that prefer it
- Service role key stored as Edge Function secret
- Rate limiting per-facility
- All messages logged for HIPAA audit trail
- PHI access tracking on raw message views
- Configurable retention policy with automated purge

### HIPAA Compliance
- HL7v2 messages contain PHI (patient name, DOB, MRN, diagnosis)
- All transit encrypted (HTTPS)
- All storage in Supabase (HIPAA-covered on appropriate plan)
- Full audit trail: message processing, admin actions, PHI access
- Raw message purge after configurable retention period
- RLS enforces facility scoping on all tables

---

## Estimated Effort by Phase

| Phase | Description | Complexity | Claude Code Sessions | Status |
|-------|-------------|------------|---------------------|--------|
| 1 | HL7v2 Parser & Message Models | Medium | 1 session | Done |
| 2 | Database Schema Extensions | Light | 1 session | Done |
| 3 | Case Import Service | Heavy | 2 sessions | Done |
| 4 | HL7v2 Listener (Edge Function) | Medium-Heavy | 1-2 sessions | Done |
| 5 | Test Harness (generator + UI) | Medium-Heavy | 2 sessions | Done |
| 6 | Admin UI (tabs, review queue, mappings, logs) | Heavy | 2-3 sessions | Done |
| 7 | HIPAA Compliance & Audit Trail | Medium | 1 session | Done |
| 8 | Test Data Manager — Schema & DAL | Medium | 1 session | Pending |
| 9 | Global Admin CRUD UI — Entity Pools | Medium-Heavy | 2 sessions | Pending |
| 10 | Global Admin CRUD UI — Schedule Entries | Medium-Heavy | 2 sessions | Pending |
| 11 | Rewire Test Harness to Database-Driven Data | Medium | 1-2 sessions | Pending |

**Total: ~14-17 Claude Code sessions** (Phases 1-7 complete, Phases 8-11 pending)

**Commit after each phase:**
1. `feat(hl7v2): phase 1 - message parser and SIU type definitions`
2. `feat(hl7v2): phase 2 - database schema for EHR integrations and external case tracking`
3. `feat(hl7v2): phase 3 - case import service with entity matching and review queue`
4. `feat(hl7v2): phase 4 - Edge Function listener with full processing pipeline`
5. `feat(hl7v2): phase 5 - test harness with SIU generator and admin control panel`
6. `feat(hl7v2): phase 6 - admin UI for integration management and monitoring`
7. `feat(hl7v2): phase 7 - HIPAA audit trail and raw message retention purge`
8. `feat(hl7v2): phase 8 - test data manager schema and DAL`
9. `feat(hl7v2): phase 9 - global admin CRUD UI for test entity pools`
10. `feat(hl7v2): phase 10 - global admin CRUD UI for test schedule entries`
11. `feat(hl7v2): phase 11 - rewire test harness to use database-driven test data`
