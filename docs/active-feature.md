# Feature: Epic FHIR Integration + Patient Fields

## Goal
Two closely related features delivered together:

1. **Patient Fields on Cases** — Patient information (name, MRN, DOB) added to case creation, case list, and case detail views. Always visible — no toggle or feature flag. Uses the existing `patients` table and `cases.patient_id` FK. If any patient field is entered, first name + last name become required.

2. **Epic FHIR Integration** — Allows facility admins to connect their Epic EHR instance via SMART on FHIR, map Epic surgeons/rooms to ORbit entities, and import upcoming surgical cases on-demand. Global admin configures FHIR-to-ORbit field mappings (pre-built with sensible defaults). Architected to support future scheduled sync.

---

## Part 1: Patient Fields on Cases

### Why This Exists

ORbit already has a `patients` table (`first_name`, `last_name`, `date_of_birth`, `mrn`, `phone`, `email`, emergency contacts) and a `patient_id` FK on `cases`. But the app doesn't currently collect or display patient data anywhere in the UI. This feature adds patient fields directly to case workflows.

### Database Changes

#### Alter RPC: `create_case_with_milestones`

Add `p_patient_id UUID DEFAULT NULL` parameter to the existing RPC so patient linking is atomic (same transaction as case creation).

### Patient Field Behavior

- Case creation form shows an optional "Patient Information" section (first name, last name, MRN, DOB)
- **Validation:** If any patient field is entered, first name + last name become required. MRN and DOB remain optional.
- On submit with patient data: creates or finds patient record (MRN lookup within facility to avoid duplicates), links via `patient_id`
- Case list displays "Patient" column showing `Last, First`
- Case detail shows patient info card
- Analytics views NEVER show patient-identifiable data (hard rule)

### UI Changes

#### Case Creation Form (`CaseForm.tsx`)

- Add an optional "Patient Information" section below the existing fields
- Fields: First Name, Last Name, MRN (optional), Date of Birth (optional)
- On submit: create or find patient record, link via `patient_id`
- Patient lookup: if MRN is entered, check for existing patient in the facility first

#### Case List (`CasesTable.tsx`)

- Add "Patient" column showing `last_name, first_name`

#### Case Detail (`cases/[id]/PageClient.tsx`)

- Add patient info card showing name, MRN, DOB

---

## Part 2: Epic FHIR Integration

### How SMART on FHIR Works (Quick Reference)

SMART on FHIR is OAuth 2.0 for healthcare. The flow:

1. **User clicks "Connect to Epic"** in ORbit settings
2. **ORbit redirects to Epic's login page** (authorization endpoint)
3. **User authenticates with their Epic credentials** and grants access
4. **Epic redirects back to ORbit** with an authorization code
5. **ORbit's server exchanges the code for an access token** (using client_id + client_secret)
6. **ORbit uses the token to read FHIR resources** (appointments, patients, practitioners, locations)
7. **Token expires after ~60 minutes** — user must reconnect for another session

**The user enters nothing in ORbit.** They only authenticate with Epic directly. All client configuration (client ID, FHIR URL, redirect URI) is pre-configured in environment variables.

### App Registration Details

```
Client ID: 930fa123-246d-4aeb-9972-ddf3496ab292
FHIR Base URL: https://fhir.epic.com/interconnect-fhir-oauth
Redirect URI: https://genevie-emulsoidal-sagely.ngrok-free.dev/api/epic/auth/callback
Audience: Clinicians or Administrative Users
SMART Version: R4, SMART v2 scopes
Confidential Client: Yes
Persistent Access: No (v1 — on-demand only)
```

### FHIR Scopes (SMART v2 syntax)

```
user/Appointment.read
user/ServiceRequest.read
user/Patient.read
user/Practitioner.read
user/Location.read
user/Procedure.read
openid
fhirUser
```

> **Note:** Using `user/` prefix (not `system/`) because this is a clinician-facing app with interactive OAuth. `system/` scopes are for backend service accounts and would be rejected by Epic for this app type.

### Database Changes

#### New table: `epic_connections`

One per facility. Stores connection state and tokens.

```sql
CREATE TABLE epic_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- FHIR server config
  fhir_base_url TEXT NOT NULL DEFAULT 'https://fhir.epic.com/interconnect-fhir-oauth',
  client_id TEXT NOT NULL,

  -- OAuth tokens
  -- NOTE: For v1 (non-persistent), refresh_token will be NULL.
  -- Column exists for future persistent access upgrade.
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scopes TEXT[],

  -- Connection state
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'error', 'token_expired')),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,

  -- Future sync support (v1: always 'manual')
  sync_mode TEXT NOT NULL DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'scheduled')),
  sync_interval_minutes INTEGER,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,

  -- Metadata
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(facility_id)
);
```

**Token security consideration:** For v1, tokens are stored in the table with strict RLS (only the service role and facility admins can read). For production, consider migrating token storage to Supabase Vault or a separate encrypted-at-application-level table. The current approach is acceptable for sandbox/early development.

#### New table: `epic_entity_mappings`

Maps Epic FHIR resources to ORbit entities. Per-facility — facility admins map their Epic surgeons/rooms to ORbit entities. Uses a single `orbit_entity_id` instead of polymorphic nullable FKs.

```sql
CREATE TABLE epic_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES epic_connections(id) ON DELETE CASCADE,

  -- Mapping type determines what orbit_entity_id references
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('surgeon', 'room', 'procedure')),

  -- Epic side
  epic_resource_type TEXT NOT NULL,  -- 'Practitioner', 'Location', etc.
  epic_resource_id TEXT NOT NULL,
  epic_display_name TEXT,

  -- ORbit side (interpreted based on mapping_type)
  -- surgeon → surgeons.id, room → rooms.id, procedure → procedure_types.id
  orbit_entity_id UUID,

  -- Match metadata
  match_method TEXT NOT NULL DEFAULT 'manual' CHECK (match_method IN ('auto', 'manual')),
  match_confidence NUMERIC(3,2),  -- 0.00 to 1.00 for auto-matches

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(connection_id, mapping_type, epic_resource_id)
);
```

#### New table: `epic_field_mappings`

Global field mapping rules configured by the global admin. Maps FHIR field paths to ORbit table columns. Pre-seeded with sensible defaults.

```sql
CREATE TABLE epic_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR source
  fhir_resource_type TEXT NOT NULL,  -- 'Appointment', 'Patient', 'Practitioner', etc.
  fhir_field_path TEXT NOT NULL,     -- e.g., 'start', 'participant[0].actor', 'name.given'

  -- ORbit target
  orbit_table TEXT NOT NULL,         -- e.g., 'cases', 'patients'
  orbit_column TEXT NOT NULL,        -- e.g., 'start_time', 'first_name'

  -- Metadata
  label TEXT NOT NULL,               -- Human-readable label for admin UI
  description TEXT,                  -- Explanation of what this mapping does
  is_default BOOLEAN NOT NULL DEFAULT true,  -- Whether this is a system default
  is_active BOOLEAN NOT NULL DEFAULT true,   -- Soft disable without deleting

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(fhir_resource_type, fhir_field_path)
);

-- Seed with sensible defaults
INSERT INTO epic_field_mappings (fhir_resource_type, fhir_field_path, orbit_table, orbit_column, label, description) VALUES
  ('Appointment', 'start', 'cases', 'scheduled_date', 'Surgery Date', 'Maps appointment start date to case scheduled date'),
  ('Appointment', 'start', 'cases', 'start_time', 'Surgery Time', 'Maps appointment start time to case start time'),
  ('Appointment', 'minutesDuration', 'cases', 'estimated_duration_minutes', 'Duration', 'Maps appointment duration to estimated case duration'),
  ('Appointment', 'serviceType', 'cases', 'procedure_type_id', 'Procedure Type', 'Maps service type to ORbit procedure (via entity mapping)'),
  ('Patient', 'name.family', 'patients', 'last_name', 'Patient Last Name', 'Maps patient family name'),
  ('Patient', 'name.given', 'patients', 'first_name', 'Patient First Name', 'Maps patient given name'),
  ('Patient', 'birthDate', 'patients', 'date_of_birth', 'Date of Birth', 'Maps patient birth date'),
  ('Patient', 'identifier[MRN]', 'patients', 'mrn', 'Medical Record Number', 'Maps patient MRN identifier'),
  ('Practitioner', 'name', 'surgeons', 'id', 'Surgeon', 'Maps practitioner to ORbit surgeon (via entity mapping)'),
  ('Location', 'name', 'rooms', 'id', 'Operating Room', 'Maps location to ORbit room (via entity mapping)');
```

#### New table: `epic_import_log`

Audit trail for every import. Required for HIPAA compliance.

```sql
CREATE TABLE epic_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES epic_connections(id) ON DELETE CASCADE,

  -- Source FHIR references
  fhir_appointment_id TEXT,
  fhir_service_request_id TEXT,

  -- Result
  orbit_case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'skipped', 'duplicate')),
  error_message TEXT,

  -- Audit snapshot (raw FHIR data at time of import + mapping decisions)
  fhir_resource_snapshot JSONB,
  field_mapping_applied JSONB,

  imported_by UUID NOT NULL REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Indexes

```sql
CREATE INDEX idx_epic_connections_facility ON epic_connections(facility_id);
CREATE INDEX idx_epic_entity_mappings_connection ON epic_entity_mappings(connection_id);
CREATE INDEX idx_epic_entity_mappings_lookup ON epic_entity_mappings(connection_id, mapping_type, epic_resource_id);
CREATE INDEX idx_epic_import_log_facility ON epic_import_log(facility_id);
CREATE INDEX idx_epic_import_log_appointment ON epic_import_log(fhir_appointment_id);
CREATE INDEX idx_epic_import_log_case ON epic_import_log(orbit_case_id);
```

#### RLS Policies

All Epic tables need RLS. Follow existing patterns:
- `epic_connections`: Facility-scoped reads/writes for facility admins. Read-only connection status for all facility users.
- `epic_entity_mappings`: Facility-scoped reads/writes for facility admins.
- `epic_field_mappings`: All authenticated users can read. Only global admins can write.
- `epic_import_log`: Visible to facility admins only.

#### Triggers

- `updated_at` trigger on `epic_connections`, `epic_entity_mappings`, `epic_field_mappings` (use existing `update_updated_at_column()`)

### Two Mapping Layers

| Mapping | Who configures | Where | Scope | Table |
|---------|---------------|-------|-------|-------|
| **Field mapping** (FHIR field → ORbit column) | Global admin | `/admin/settings/epic-field-mapping` | Platform-wide | `epic_field_mappings` |
| **Entity mapping** (Epic surgeon → ORbit surgeon) | Facility admin | `/settings/integrations/epic` | Per-facility | `epic_entity_mappings` |

### API Routes

All routes under `app/api/epic/`.

#### Auth Flow

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/epic/auth/connect` | GET | Initiates SMART on FHIR OAuth. Takes `facility_id` as query param. Fetches SMART config, generates state, redirects to Epic. |
| `/api/epic/auth/callback` | GET | Handles Epic OAuth redirect. Validates state, exchanges code for token, upserts `epic_connections`, redirects to Epic settings page. |
| `/api/epic/auth/disconnect` | POST | Clears tokens, sets status to disconnected. Takes `facility_id` in body. |

#### Status & Mappings

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/epic/status` | GET | Returns connection status + mapping stats for a facility. |
| `/api/epic/mappings` | GET | Returns all entity mappings for a facility. Optional `mapping_type` filter. |
| `/api/epic/mappings` | POST | Creates or updates a single entity mapping. |
| `/api/epic/mappings/[id]` | DELETE | Removes an entity mapping. |
| `/api/epic/mappings/auto-match` | POST | Triggers auto-matching algorithm. Returns results for review. |

#### Case Import

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/epic/cases/search` | GET | Searches Epic for appointments in a date range. Returns previews with mapping status. |
| `/api/epic/cases/import` | POST | Imports selected appointments as ORbit cases. Creates cases via `create_case_with_milestones` RPC with `p_patient_id`. |

### Library Modules

All under `lib/epic/`.

#### `lib/epic/types.ts`
TypeScript interfaces for FHIR resources (Appointment, Patient, Practitioner, Location, ServiceRequest, Bundle). Only model the fields ORbit consumes — not the full FHIR spec.

#### `lib/epic/token-manager.ts`
- `getEpicAccessToken(facilityId)` — returns valid token or throws if expired
- `epicFhirRequest<T>(facilityId, resourcePath)` — authenticated FHIR fetch with error handling
- For v1 (non-persistent): no refresh logic. If token is expired, update status to `token_expired` and surface "Reconnect" prompt.

#### `lib/epic/fhir-client.ts`
Typed FHIR resource fetching:
- `searchSurgicalAppointments(facilityId, { dateFrom, dateTo, practitionerId? })`
- `getPatient(facilityId, patientId)`
- `getPractitioner(facilityId, practitionerId)`
- `searchPractitioners(facilityId, { name? })`
- `searchLocations(facilityId)`
- `resolveAppointmentDetails(facilityId, appointment)` — fetches all referenced resources in parallel

#### `lib/epic/case-mapper.ts`
Transforms FHIR data into ORbit case creation payloads. Reads global field mappings from `epic_field_mappings` table at import time (not hardcoded).
- `mapAppointmentToPreview(facilityId, connectionId, resolvedAppointment)` — generates import preview
- `createCaseFromImport(facilityId, connectionId, preview, importedBy)` — creates case + patient + import log entry
- Uses `create_case_with_milestones` RPC with `p_patient_id` for case creation

#### `lib/epic/auto-matcher.ts`
Fuzzy name matching for surgeons and rooms:
- `autoMatchSurgeons(facilityId, connectionId)` — compares Epic practitioners to ORbit surgeons by name similarity
- `autoMatchRooms(facilityId, connectionId)` — compares Epic locations to ORbit rooms
- Auto-applies matches above 0.90 confidence, suggests others for manual review

#### `lib/dal/epic.ts`
DAL functions for Epic tables (following existing DAL patterns in `lib/dal/`).

### UI Components

#### Global Admin: Epic Field Mapping (`/admin/settings/epic-field-mapping`)

**New page** under Configuration group in admin navigation.

Content:
- Page header: "Epic Field Mapping" / "Configure how FHIR fields map to ORbit data"
- Table showing each mapping row:
  - FHIR Resource Type + Field Path (left side)
  - ORbit Table + Column (right side, editable dropdown)
  - Label + description
  - Active/inactive toggle
- "Reset to Defaults" button
- Ships pre-populated with sensible defaults — global admin can review and adjust

#### Integrations Page Update (`/settings/integrations`)

Transform the existing placeholder:
- Epic card changes from "Coming Soon Q2 2026" to an active card
- Shows current connection status (disconnected/connected/error)
- "Set Up" button (if disconnected) → navigates to `/settings/integrations/epic`
- "Manage" button (if connected) → navigates to `/settings/integrations/epic`

#### Epic Settings Page (`/settings/integrations/epic`)

**New page.** Two main states:

**State 1: Not Connected**
- Explanation of what connecting to Epic does
- "Connect to Epic" button (initiates OAuth flow)
- Requirements checklist (Epic admin credentials, network access to FHIR server)

**State 2: Connected**
- Connection status card (green indicator, connected by, connected at, token expiry)
- Entity mapping summary (X/Y surgeons mapped, X/Y rooms mapped)
- Quick actions: "Import Cases", "Manage Mappings", "Disconnect"
- If token expired: amber warning with "Reconnect" button
- Entity mapping manager section:
  - Tabs: Surgeons | Rooms
  - Table per tab: Epic Entity (left) ↔ ORbit Entity (right, searchable dropdown)
  - Status indicators: Mapped (green), Suggested (yellow, with confidence %), Unmapped (red)
  - "Auto-Match" button to run the matching algorithm
  - Suggested matches show "Accept" / "Reject" buttons

#### Case Import Page (`/settings/integrations/epic/import`)

Separate sub-page (full page width for preview table).

1. **Filter bar:** Date range picker (default: today + 7 days), optional surgeon filter
2. **Case preview table:**
   - Date & Time
   - Patient Name (always shown)
   - Surgeon (with mapping status: green check or red warning)
   - Room (with mapping status)
   - Procedure
   - Duration
   - Status: Ready | Missing Mappings | Already Imported
   - Checkbox for selection
3. **Action bar:** "Import Selected (X)" button, warning summary
4. **Results:** Success/failure summary with links to created cases

**UX notes:**
- FHIR queries can be slow (2-5s) — show skeleton loading states
- Cache resolved FHIR data client-side during the session
- Imported cases tagged in case list with small "Epic" text badge

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Token expired | Update status to `token_expired`, show "Reconnect" prompt |
| FHIR server unreachable | Timeout after 10s, show clear error message |
| Rate limited (429) | Exponential backoff, surface error after 3 retries |
| Invalid FHIR data | Log raw response, skip the record, continue with others |
| Partial import failure | Import what succeeds, report failures clearly, no orphaned records |
| OAuth state mismatch | Reject callback, show "Authentication failed, please try again" |

### Security Checklist

- [ ] Client secret never exposed to frontend (server-side API routes only)
- [ ] OAuth state parameter validated to prevent CSRF
- [ ] RLS policies verified — users can only access their facility's Epic data
- [ ] Token storage access restricted (facility admins only, not regular users)
- [ ] Import log captures all operations with user attribution
- [ ] Patient data always populated from FHIR (no toggle gating)
- [ ] Analytics views NEVER include patient-identifiable data
- [ ] FHIR resource snapshots in import log scoped by RLS
- [ ] HTTPS enforced on all endpoints
- [ ] Global field mappings readable by all, writable only by global admins

---

## Environment Variables

Required in `.env.local`:

```
EPIC_CLIENT_ID=930fa123-246d-4aeb-9972-ddf3496ab292
EPIC_CLIENT_SECRET=<sandbox secret>
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth
EPIC_REDIRECT_URI=https://genevie-emulsoidal-sagely.ngrok-free.dev/api/epic/auth/callback
```

---

## Future Enhancements (Not in Scope)

- **Scheduled sync** — requires Epic persistent access registration. Database is architected for it (`sync_mode`, `sync_interval_minutes`, `next_sync_at` columns ready).
- **Bidirectional sync** — push ORbit milestone timestamps back to Epic as Procedure resources
- **Cerner / athenahealth** — similar SMART on FHIR pattern, different endpoint discovery
- **Patient search across cases** — search bar to find all cases for a patient by name or MRN
- **Token vault migration** — move tokens from plain table storage to Supabase Vault for production

## Acceptance Criteria

- [ ] `create_case_with_milestones` RPC accepts `p_patient_id` parameter
- [ ] Case creation form shows patient fields (first name, last name, MRN, DOB) — always visible
- [ ] If any patient field entered, first name + last name are required
- [ ] Case list shows "Patient" column with `Last, First`
- [ ] Case detail shows patient info card
- [ ] Patient lookup by MRN avoids duplicates within facility
- [ ] Global admin field mapping page at `/admin/settings/epic-field-mapping` shows pre-built mappings
- [ ] Global admin can override field mappings
- [ ] Epic OAuth connect flow works with Epic sandbox
- [ ] Epic connection status shown on integrations page and Epic settings page
- [ ] Entity mapping manager allows manual + auto-matching of surgeons and rooms (per-facility)
- [ ] Case import preview shows Epic appointments with mapping status
- [ ] Selected cases import correctly via `create_case_with_milestones` RPC with `p_patient_id`
- [ ] Imported cases tagged with small "Epic" text badge in case list
- [ ] Import log entries created for all import operations
- [ ] Patient data always populated from Epic FHIR Patient resources during import
- [ ] Case mapper reads global field mappings from `epic_field_mappings` table (not hardcoded)
- [ ] All existing tests pass (`npm run typecheck && npm run lint && npm run test`)

---

## Review Q&A

> Generated by /review on 2026-02-28

**Q1:** CaseForm layout — where should the patient fields section go in the form?
**A1:** After surgeon/procedure/room. Patient info is logically tied to case identity — place it right after the core case identity fields.

**Q2:** CasesTable — where should the Patient column go, and how should the Epic badge appear?
**A2:** Patient column after Surgeon column (groups the "who" columns together). Epic badge as small pill inside the Procedure+CaseNumber cell.

**Q3:** Case detail — where should patient info appear?
**A3:** Header metadata row. Add patient name inline to the existing metadata row (Case# • Room • Side • Surgeon • Time • Patient). MRN/DOB visible on hover or tooltip. No separate card.

**Q4:** MRN conflict — what happens when MRN matches an existing patient but the name differs?
**A4:** Show warning, let user decide. Display a confirmation dialog: "MRN 12345 already exists for John Smith. Link to this patient or create a new record?" User explicitly chooses.

**Q5:** Case edit mode — should patient fields be editable when editing an existing case?
**A5:** Populate + editable, clear unlinks. Pre-populate patient fields from the linked patient record. User can edit them (updates the patient record). Clearing all fields unlinks the patient from the case.

**Q6:** Duration mapping from Epic — where should `Appointment.minutesDuration` map to?
**A6:** Skip duration mapping in v1. The existing `surgeon_procedure_duration` table handles per-surgeon duration overrides via a 3-tier cascade. Don't map Epic duration at all in v1 to avoid complexity. Facility admins can manually set surgeon durations. Revisit in v2.

**Q7:** Should the case list search bar support patient name/MRN search?
**A7:** Yes, add patient search in Phase 1. Extend the search input to match patient first_name, last_name, and MRN.

**Q8:** Should patient data be included in the CSV export?
**A8:** Yes, include patient name and MRN in the CSV export. The case list is operational, not analytics.

**Q9:** How to track which cases were imported from Epic (for the Epic badge)?
**A9:** Add a `source TEXT DEFAULT 'manual'` column to the cases table with CHECK constraint ('manual', 'epic', 'cerner'). Add `p_source` parameter to the RPC in Phase 1 alongside `p_patient_id`.

**Q10:** Validation approach for patient fields?
**A10:** Extend existing useForm validators. Use the same manual validation pattern CaseForm already uses. Consistent with existing code.

**Q11:** Should legacy `patient_dob` and `patient_phone` fields be cleaned up from the CaseDetail type?
**A11:** Yes. Remove legacy fields, add patient join. Delete the ghost fields from CaseDetail type. Add `patient?: { first_name, last_name, mrn, date_of_birth } | null` via join.

**Q12:** Where to store OAuth state parameter for CSRF protection?
**A12:** HTTP-only cookie. Short-lived (5 min), stateless, no DB overhead. Industry standard for OAuth state. Cookie validated on callback and cleared.

**Q13:** Epic field mapping admin page — editing UX?
**A13:** Full-page editable table. All rows editable at once with a single "Save Changes" button at the bottom. Batch editing.

**Q14:** Entity mapping display — how to show mapped vs unmapped entities?
**A14:** Always show all, with status indicators. Each row has status: Mapped (green), Suggested (yellow), Unmapped (red). Filter tabs for All/Mapped/Unmapped. Matches the spec.

**Q15:** Should cases with missing mappings be importable?
**A15:** Block import until mapped. Cases with missing mappings cannot be selected for import. Checkbox disabled. User must resolve mappings first.

**Q16:** How should case numbers be generated for Epic-imported cases?
**A16:** Auto-generate: EPIC-{sequence}. E.g., EPIC-001, EPIC-002 (facility-scoped sequence). Clearly identifies imported cases.

**Q17:** Token expiry UX — proactive or reactive?
**A17:** Proactive: show expiry countdown. Display "Token expires in X minutes" on Epic settings page. Amber warning when <10 min remaining. Red "Reconnect" when expired.

**Q18:** How should batch import work — sequential or batch?
**A18:** Sequential with live progress. Import cases one at a time. Show progress bar (3/10 imported). If one fails, continue with the rest. User sees success/failure per case in real-time.

**Q19:** Should procedure type mapping be included in v1?
**A19:** Yes, include procedure mapping tab. Add a third tab "Procedures" to the entity mapping manager alongside Surgeons and Rooms.

**Q20:** Should each facility be able to configure a different FHIR base URL?
**A20:** Yes, per-facility FHIR URL. Allow each facility to specify their FHIR base URL during Epic setup. Client ID stays in env vars (shared app registration). Allows connecting to different Epic instances.

**Q21:** Fuzzy matching algorithm for auto-matcher?
**A21:** Simple Levenshtein distance. No external dependency. Normalized to 0-1 score. Threshold at 0.90 for auto-apply.

**Q22:** Search filtering on Epic import page?
**A22:** Server-side FHIR date filter with Epic practitioner filter. Pass date range to FHIR API. Surgeon filter uses Epic practitioner IDs. Only show practitioners with ORbit mappings in the dropdown.

**Q23:** Epic settings page layout — single page or split?
**A23:** Split into three subpages: Overview (/epic), Mappings (/epic/mappings), Import (/epic/import). Each has focused purpose.

**Q24:** UNIQUE constraint on epic_field_mappings — how to handle Appointment.start mapping to both date and time?
**A24:** Widen UNIQUE constraint to `(fhir_resource_type, fhir_field_path, orbit_table, orbit_column)`. Allows one FHIR field to map to multiple ORbit columns.

**Q25:** Should Epic-imported cases come in as drafts or regular cases?
**A25:** Import as regular cases. Not drafts. Milestones auto-created from template cascade. Cases appear in full case list immediately.

**Q26:** "Reset to Defaults" behavior on field mapping page?
**A26:** Confirm + wipe and re-seed. Show confirmation dialog. On confirm, DELETE all rows and re-INSERT default seed data. Clean slate.

**Q27:** How dynamic should the case mapper be?
**A27:** Fully dynamic mapper. Loads all active field mappings from DB, iterates over them, extracts FHIR values by field path, writes to target ORbit columns. Admin changes a mapping and the next import reflects it.

**Q28:** Should Epic import support backward-looking date ranges?
**A28:** Forward only for v1. Default next 7 days, allow extending forward up to 30 days. No backward search. Past case data entry stays manual.

**Q29:** What case status should imported cases get?
**A29:** "Scheduled". Imported cases are upcoming appointments — Scheduled is the natural status.

**Q30:** Phase 2 scope — keep as-is or split?
**A30:** Split Phase 2: schema+auth (2a) and field mapping UI (2b). Two commits, two test gates. Reduces per-phase risk. Total phases: 6.
