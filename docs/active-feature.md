# Feature: Epic HL7v2 Surgical Case Scheduling Integration

## Goal

Build an HL7v2 SIU (Schedule Information Unsolicited) listener that receives **real-time push notifications** from Epic's OpTime module whenever a surgical case is created, modified, rescheduled, or canceled. This replaces the FHIR-based approach — Epic's FHIR APIs are patient-centric and do not expose surgical scheduling data (OR assignments, block times, procedure sequencing, surgeon-specific scheduling).

The integration includes:
1. **HL7v2 message parser** — decodes pipe-delimited SIU messages into typed TypeScript objects
2. **Case import service** — maps parsed messages to ORbit database operations with entity matching
3. **Edge Function listener** — HTTPS endpoint that receives messages from Epic integration engines (Mirth Connect, Rhapsody)
4. **Review queue** — admin UI for resolving unmatched entities (create inline or map to existing)
5. **Test harness** — generates realistic SIU messages for development/testing without Epic sandbox ($1,900/year)
6. **Admin UI** — integration configuration, monitoring, log viewing

---

## Why HL7v2 Instead of FHIR

### What Epic FHIR Gives You (Patient-Centric)
- Patient demographics, conditions, medications, encounters
- Practitioner lookup, organization data
- Generic Appointment/ServiceRequest resources (clinic visits, not surgical cases)
- **Does NOT include:** OR room assignments, surgical case IDs, block time allocations, procedure sequencing, surgeon-specific scheduling, case status events (wheels in, incision, wheels out)

### What Epic HL7v2 Gives You (Surgical Schedule)
- **Outgoing Surgical Case Scheduling** — sends SIU messages for new, rescheduled, updated, and canceled surgical cases
- Real-time push: Epic sends messages to our listener automatically when the schedule changes
- Contains: patient demographics, surgeon, procedure codes (CPT), OR room, scheduled date/time, case duration, diagnosis codes, case status — **exactly what ORbit needs to create cases**

### What Happens to Existing FHIR Code
- `lib/epic/` stays as-is — reusable for future ModMed FHIR integration
- Patterns preserved: OAuth2 token management, patient demographic mapping, error handling, credential storage
- Epic-specific FHIR REST logic is NOT reused (HL7v2 is fundamentally different — push-based, pipe-delimited, TCP/HTTP)
- HL7v2 integration is net-new code in `lib/hl7v2/` and `lib/integrations/`

---

## HL7v2 SIU Message Format

### Trigger Events ORbit Cares About

| Event | Meaning | ORbit Action |
|-------|---------|-------------|
| `SIU^S12` | New surgical case booked | Create new case in `cases` table |
| `SIU^S13` | Case rescheduled | Update case date/time/room |
| `SIU^S14` | Case modified (details changed) | Update case details (surgeon, procedure, etc.) |
| `SIU^S15` | Case canceled | Update case status to `cancelled` |
| `SIU^S16` | Case discontinued (in-progress stop) | Update case status to `cancelled` with reason |

### SIU Message Structure (Segments)

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
| `SCH-1` | Placer Appointment ID | `external_case_id` | Epic's internal case ID |
| `SCH-2` | Filler Appointment ID | `external_filler_id` (in parsed_data) | Secondary Epic ID |
| `SCH-7` | Appointment Reason | `notes` | Free text reason |
| `SCH-11.4` | Start Date/Time | `scheduled_date` + `start_time` | Format: YYYYMMDDHHMMSS |
| `SCH-11.5` | End Date/Time | Derive duration | End - Start = duration |
| `SCH-25` | Filler Status Code | Map to `status_id` | Booked/Cancelled/etc. |
| `PID-3` | Patient MRN | `patients.mrn` | Match or create patient |
| `PID-5` | Patient Name | `patients.first_name`, `last_name` | Format: LAST^FIRST^MIDDLE |
| `PID-7` | Date of Birth | `patients.date_of_birth` | Format: YYYYMMDD |
| `PID-8` | Gender | (in parsed_data) | M/F/O/U |
| `PV1-7` | Attending Doctor | `surgeon_id` | Match by NPI or name |
| `PV1-3` | Assigned Location | `or_room_id` | Match OR room by name |
| `DG1-3` | Diagnosis Code | `primary_diagnosis_code` | ICD-10 code |
| `DG1-4` | Diagnosis Description | `primary_diagnosis_desc` | Text description |
| `AIS-3` | Service/Procedure | `procedure_type_id` | Match by CPT code |
| `AIS-7` | Duration | Used for duration calculation | In minutes |
| `AIL-3` | Location | `or_room_id` | Confirm OR room |
| `AIP-3` | Personnel | `surgeon_id` / staff | Match provider by ID/NPI |
| `AIP-4` | Role | Staff role mapping | SURGEON, ANESTHESIOLOGIST, etc. |

---

## Database Changes

### New Tables

#### `ehr_integrations` — Per-facility integration configurations
```sql
id UUID PK DEFAULT gen_random_uuid(),
facility_id UUID NOT NULL FK(facilities) ON DELETE CASCADE,
integration_type TEXT NOT NULL CHECK (integration_type IN ('epic_hl7v2', 'modmed_fhir', 'csv_import')),
display_name TEXT,
config JSONB NOT NULL DEFAULT '{}',
  -- config contents: { api_key, endpoint_url, auth_type: 'api_key'|'basic_auth',
  --   basic_auth_user, basic_auth_pass, rate_limit_per_minute, field_overrides }
is_active BOOLEAN NOT NULL DEFAULT true,
last_message_at TIMESTAMPTZ,
last_error TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE(facility_id, integration_type)
```

#### `ehr_integration_log` — Audit trail for all inbound messages
```sql
id UUID PK DEFAULT gen_random_uuid(),
facility_id UUID NOT NULL FK(facilities) ON DELETE CASCADE,
integration_id UUID NOT NULL FK(ehr_integrations) ON DELETE CASCADE,
message_type TEXT NOT NULL,  -- 'SIU^S12', 'SIU^S13', etc.
message_control_id TEXT,      -- MSH-10 for dedup
raw_message TEXT,             -- Full HL7v2 message for debugging (PHI!)
parsed_data JSONB,            -- Structured extraction
processing_status TEXT NOT NULL DEFAULT 'received'
  CHECK (processing_status IN ('received', 'pending_review', 'processed', 'error', 'ignored')),
error_message TEXT,
external_case_id TEXT,
case_id UUID FK(cases) ON DELETE SET NULL,  -- NULL until case created
review_notes JSONB,           -- Unmatched entities + suggestions for review queue
  -- { unmatched_surgeon: { name, npi, suggestions: [...] },
  --   unmatched_procedure: { cpt, name, suggestions: [...] },
  --   unmatched_room: { name, suggestions: [...] } }
reviewed_by UUID FK(auth.users),
reviewed_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
processed_at TIMESTAMPTZ
```

### Altered Tables

#### `cases` — New columns
- `external_case_id TEXT` — Epic's internal case ID (from SCH-1)
- `external_system TEXT` — 'epic_hl7v2', 'epic_fhir', 'modmed', etc.
- `import_source TEXT` — 'hl7v2', 'fhir', 'csv', 'manual'
- `primary_diagnosis_code TEXT` — ICD-10 from DG1-3
- `primary_diagnosis_desc TEXT` — from DG1-4
- Update `source` CHECK constraint to include 'hl7v2' if needed

#### `patients` — New columns
- `external_patient_id TEXT` — Source system's patient ID

### Indexes
- `cases(external_case_id, external_system, facility_id)` — upsert deduplication
- `patients(mrn, facility_id)` — patient matching
- `patients(external_patient_id, facility_id)` — external ID lookup
- `ehr_integration_log(facility_id, processing_status)` — review queue queries
- `ehr_integration_log(external_case_id, facility_id)` — case lookup

### RLS Policies
Standard facility-scoped pattern using `get_my_facility_id()` and `get_my_access_level()`:
- Facility admins can manage own facility's integrations and view logs
- Global admins can manage all
- Regular users can view own facility's log entries (read-only)

---

## Listener Architecture

### Deployment: Supabase Edge Function
- Path: `supabase/functions/hl7v2-listener/`
- Accepts HTTP POST with HL7v2 message body
- Content-Types: `application/hl7-v2`, `text/plain`, `x-application/hl7-v2+er7`
- Returns HL7v2 ACK response (AA/AE/AR)

### Authentication
Plug-and-play with Epic integration engines:
- **API key**: `X-Integration-Key` header — per-facility key stored in `ehr_integrations.config`
- **Basic Auth**: `Authorization: Basic ...` — for integration engines that prefer Basic Auth
- Facility looked up from credentials → all operations scoped to that facility
- **No JWT** — Epic integration engines don't have Supabase accounts

### Message Processing Flow
```
Epic OpTime → Integration Engine (Mirth/Rhapsody) → HTTPS POST → Edge Function
  → Auth check (API key or Basic Auth)
  → Parse HL7v2 message (generic parser → SIU parser)
  → Log to ehr_integration_log (status: 'received')
  → Match entities (surgeon, procedure, room, patient)
  → If ALL matched: create/update/cancel case → status: 'processed'
  → If ANY unmatched: status: 'pending_review' with review_notes
  → Return HL7v2 ACK (AA for success, AE for error)
```

---

## Entity Resolution (Review Queue UX)

### When Entities Can't Be Matched

When an SIU message references a surgeon, procedure, or OR room that doesn't exist in ORbit, the message is held in `pending_review` status. The admin resolves it from the review queue.

### Review Queue Flow
1. Admin opens Settings → Integrations → Epic → Review Queue
2. Sees list of pending imports with colored badges showing which entities are unmatched
3. Clicks a row → expands to show detail panel with `EntityResolver` for each unmatched entity
4. **EntityResolver** shows:
   - (a) Suggested matches from fuzzy matching with confidence %
   - (b) Search bar to find existing ORbit entities
   - (c) "Create New" button → inline form (create surgeon/procedure/room without leaving the page)
5. After all entities resolved → "Approve Import" → case created, log updated to 'processed'
6. "Reject" → log marked 'ignored' with reason

### Fuzzy Matching
Reuses `lib/epic/auto-matcher.ts` Levenshtein distance engine:
- >= 0.90 confidence: auto-suggest (shown first in suggestions)
- 0.70-0.89: suggest (shown below auto-suggestions)
- < 0.70: no suggestion

### Entity Mapping Persistence
When an admin maps "Dr. Smith" in Epic to "John Smith, MD" in ORbit, this mapping is saved. Future messages with the same identifier auto-resolve without review.

---

## Test Harness

### Purpose
Generates realistic SIU messages mimicking Epic OpTime output so the full pipeline can be developed and tested without Epic's paid sandbox.

### Access
- **Global admin only** — UI at `app/admin/settings/hl7v2-test-harness/`
- API endpoint at `app/api/integrations/test-harness/` (global admin auth required)
- Global admin selects a facility to test against

### Scenarios
1. **Full day** — 15 cases across 4 OR rooms, realistic 7:30am-5pm schedule
2. **Chaos** — Normal day + random reschedules, cancellations, add-on cases
3. **Multi-day** — Week of OR schedules

### Surgical Data Pools (by specialty)
- **Orthopedics**: Total knee (27447), Total hip (27130), ACL reconstruction (29888), Rotator cuff repair (29827), Carpal tunnel release (64721)
- **Ophthalmology**: Cataract surgery (66984), Vitrectomy (67036), Glaucoma surgery (66170)
- **GI**: Colonoscopy (45378), Upper endoscopy (43239), Lap cholecystectomy (47562)
- **Spine**: Lumbar fusion (22612), Cervical discectomy (63075), Laminectomy (63047)
- **General Surgery**: Lap hernia repair (49650), Lap appendectomy (44970)
- Each procedure paired with matching ICD-10 code and typical duration

---

## Admin UI Changes

### Integration Hub (replaces FHIR content at `app/settings/integrations/epic/`)

**Layout** — swap FHIR-specific sections with HL7v2, keep existing card-based layout:

- **Status card**: Active/inactive, last message received, message count today, error count
- **Quick actions**: Copy API key, Copy endpoint URL, Toggle active/inactive
- **Stats cards**: Total imported cases, Pending review count, Error count
- **Navigation tabs**: Overview | Review Queue | Mappings | Logs

### Subpages
- **Review Queue** (`/epic/review-queue`): Pending imports with inline EntityResolver
- **Mappings** (`/epic/mappings`): View/edit/delete entity mappings (surgeon, procedure, room)
- **Logs** (`/epic/logs`): Filterable log table, expandable rows showing raw HL7v2 + parsed data

---

## Security & Compliance

### HIPAA
- HL7v2 messages contain PHI (patient name, DOB, MRN, diagnosis)
- All transit encrypted (HTTPS/TLS 1.2+)
- All storage in Supabase (HIPAA-covered on appropriate plan)
- Audit log provides required access tracking via `ehr_integration_log`
- Consider configurable retention policy for `raw_message` purging

### Authentication
- Per-facility API keys (rotate-able, stored in `ehr_integrations.config`)
- Basic Auth support for integration engines that prefer it
- RLS enforces facility scoping on all tables

---

## Production Deployment Path

When a paying customer on Epic is ready:
1. Customer's IT team configures "Outgoing Surgical Case Scheduling" interface to point at our HTTPS endpoint
2. Epic sends via integration engine (Mirth Connect, Rhapsody) — standard HTTP POST
3. Work with customer to validate field mappings (admin field mapping UI handles facility customizations)
4. If customer requires TCP/MLLP: consider lightweight MLLP-to-HTTP proxy (many open-source options)
5. Sign up for Epic Vendor Services ($1,900/year) for exact field mapping specs and production validation

---

## Review Q&A

> Generated by planning interview on 2026-03-01

**Q1:** What should happen to the existing Epic FHIR code?
**A1:** Keep as-is in `lib/epic/` for potential ModMed FHIR reuse later.

**Q2:** Where should the HL7v2 listener live?
**A2:** Supabase Edge Function — decoupled from web app, scales independently.

**Q3:** Should new integration tables replace or coexist with existing Epic tables?
**A3:** New generic `ehr_integrations` + `ehr_integration_log` tables. Existing `epic_*` tables stay dormant.

**Q4:** Where should the admin UI live?
**A4:** Replace FHIR content at `app/settings/integrations/epic/` — swap content, keep layout.

**Q5:** Who can access the test harness?
**A5:** Global admin only — UI at `app/admin/settings/hl7v2-test-harness/`, API at `app/api/integrations/test-harness/`.

**Q6:** How should unmatched entities be handled?
**A6:** Async review queue — messages land as `pending_review`, admin resolves inline (create entity or map to existing without leaving the page), then approves import. Cases not created until approved.

**Q7:** What authentication should the listener use?
**A7:** API key + Basic Auth — plug-and-play with Epic integration engines like Mirth Connect.

**Q8:** How should the phases be structured?
**A8:** Keep 6 phases: Parser → Schema → Import Service → Listener → Test Harness → Admin UI.
