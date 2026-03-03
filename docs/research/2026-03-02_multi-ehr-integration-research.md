# Multi-EHR Integration Research Summary

> **Date**: 2026-03-02
> **Purpose**: Research findings for expanding HL7v2 SIU integration beyond Epic to Oracle Cerner and MEDITECH.
> **Next step**: Create `active-feature.md` and `implementation-plan.md`, then run `/audit` → `/phase-start`.

---

## 1. Market Context

### Why These Three Systems?

| EHR System | Hospital Market Share | OR Module | Integration Method |
|---|---|---|---|
| **Epic (OpTime)** | ~41% | Full OR scheduling | HL7v2 SIU (**already built**) |
| **Oracle Cerner (SurgiNet)** | ~22% | Full OR scheduling | HL7v2 SIU + FHIR R4 |
| **MEDITECH Expanse** | ~12% | Perioperative module | HL7v2 SIU (published spec) |

**Combined coverage: ~75% of US hospitals.**

### What We Ruled Out

- **Athenahealth**: Ambulatory/clinic EHR, NOT surgical scheduling. Creates "Surgery" appointment types but no actual OR room/time/staff data. Surgeon offices use it, but the surgery happens at a hospital running Epic/Cerner/MEDITECH.
- **SIS (Surgical Information Systems)**: #1 in ASCs but walled garden — no public API, requires sales partnership.
- **HST Pathways**: Major ASC platform, has "Data Stream" developer docs but gated behind partnership.

---

## 2. HL7v2 SIU Is a Universal Standard

### Key Insight: The Format Is Identical Across Systems

HL7v2 SIU (Scheduling Information Unsolicited) is a **standard**, not an Epic-specific protocol. The same message segments and field positions are used by Epic, Cerner, and MEDITECH:

```
MSH|^~\&|{SENDING_APP}|{SENDING_FACILITY}|ORBIT|...
SCH|{appointment_id}||...
PID|||{MRN}||{LAST}^{FIRST}||{DOB}|{SEX}|...
AIS|1||{CPT_CODE}^{PROCEDURE_DESC}^CPT|{START_DT}||{DURATION}|...
AIL|1||{ROOM_CODE}^{ROOM_DESC}|...
AIP|1||{ID}^{LAST}^{FIRST}^^^{DEGREE}^^^{NPI}|{ROLE}|...
DG1|1||{ICD10_CODE}^{DESC}^ICD10|...
```

### What Varies Between Systems (Minor)

| Aspect | Epic | Oracle Cerner | MEDITECH |
|---|---|---|---|
| MSH-3 (Sending App) | "EPIC" | "CERNER" or custom | "MEDITECH" or custom |
| Surgeon location | AIP segment (primary), PV1-7 (fallback) | AIP + PV1-7 (both common) | PV1-7 often primary |
| Date format | YYYYMMDDHHMMSS | YYYYMMDDHHMMSS | YYYYMMDDHHMMSS (same) |
| Optional segments | NTE for notes | May include ZSG custom segments | Follows spec closely |
| Trigger events | S12/S13/S14/S15 | S12/S13/S14/S15 (same) | S12/S13/S14/S15 (same) |

**Estimated code reuse: ~90%.** The parser, entity matching, review queue, and case creation logic are all generic.

---

## 3. Oracle Cerner (Oracle Health) Integration Details

### Integration Paths Available

**Path A: HL7v2 via Cerner Open Interface (COI)** — recommended, reuses existing engine
- Hospital configures outbound HL7v2 interface in Cerner admin
- Points to our Supabase edge function HTTPS endpoint
- Sends standard SIU_S12/S13/S14/S15 messages
- Same MLLP-over-HTTPS pattern as Epic

**Path B: FHIR R4 via Ignite APIs** — future option, more modern
- Public developer portal: https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/r4_overview.html
- Resources available: Appointment (read/search/create), Procedure (read/search), Patient, Encounter, Schedule, Slot
- OAuth 2.0 + SMART on FHIR auth
- Would require a new polling-based integration (not SIU listener)

### Developer Onboarding (Cerner)
1. Register on Oracle Health developer portal
2. Sandbox development (4-8 weeks)
3. Customer-specific testing (3-6 weeks)
4. Security review (2-4 weeks)
5. UAT (2-3 weeks)
6. Production go-live (1-2 weeks)

### Cerner-Specific SIU Considerations
- SurgiNet is their OR scheduling module
- COI (Cerner Open Interface) handles outbound HL7v2
- May include custom Z-segments (e.g., ZSG for surgical-specific data)
- PV1-7 (attending doctor) is commonly populated as surgeon fallback
- Documentation: https://www.tactionsoft.com/blog/cerner-oracle-health-integration-guide/

---

## 4. MEDITECH Integration Details

### Integration Path: HL7v2 SIU Outbound

MEDITECH publishes an explicit scheduling outbound specification:
- **Spec PDF**: https://ehr.meditech.com/sites/default/files/documents/20240613/scheduling-outbound-24.pdf
- **Full outbound message list**: https://ehr.meditech.com/meditech-greenfield/hl7-outbound-list-for-greenfield
- Version: HL7 2.4
- One patient per SIU message (same as Epic)
- Standard SIU_S12 trigger events

### MEDITECH-Specific Considerations
- MEDITECH Expanse is the current generation (replacing MEDITECH 6.x and C/S)
- Their perioperative module handles OR scheduling
- Tends to follow HL7v2 spec more strictly than Epic (fewer custom extensions)
- PV1-7 (attending doctor) may be the primary surgeon field (vs AIP)
- Smaller hospitals and community hospitals are the primary market
- Budget-friendly option — many smaller surgical facilities use MEDITECH

---

## 5. Existing ORbit Epic HL7v2 Architecture

### File Structure (Current)

```
supabase/functions/hl7v2-listener/
  index.ts          — HTTP endpoint, auth, rate limiting, ACK generation
  parser.ts         — Generic HL7v2 message parser (segments, fields, components)
  siu-parser.ts     — SIU-specific parsing (extracts all segment types)
  import-service.ts — Case import orchestration, entity matching, field mapping
  types.ts          — TypeScript interfaces for all HL7v2 segments

lib/hl7v2/
  parser.ts         — Same parser (duplicated for web app test harness)
  siu-parser.ts     — Same SIU parser
  types.ts          — Same types

lib/integrations/epic/
  provider-matcher.ts  — Surgeon matching (NPI → entity mapping → fuzzy name)
  procedure-matcher.ts — Procedure matching (CPT → entity mapping → fuzzy name)
  room-matcher.ts      — Room matching (code → entity mapping → fuzzy name)
  case-import-service.ts — Case creation orchestration
```

### Database Tables

```sql
-- Per-facility integration config
ehr_integrations (
  id, facility_id,
  integration_type TEXT,  -- currently only 'epic_hl7v2'
  config JSONB,           -- api_key, endpoint_url, rate_limit, field_overrides
  is_active, last_message_at, last_error
)

-- Audit trail for all inbound messages
ehr_integration_log (
  message_type, message_control_id, raw_message,
  parsed_data JSONB,
  processing_status: received | pending_review | processed | error | ignored,
  external_case_id, case_id,
  review_notes JSONB  -- unmatched entities + suggestions
)

-- Persistent entity resolution
ehr_entity_mappings (
  entity_type: 'surgeon' | 'procedure' | 'room',
  external_identifier,  -- NPI, CPT code, room code
  orbit_entity_id,      -- FK to surgeon/procedure_type/or_room
  match_method: 'auto' | 'manual',
  match_confidence DECIMAL
  -- UNIQUE(integration_id, entity_type, external_identifier)
)

-- Cases table relevant columns
cases (
  external_case_id,    -- SCH-1 placer appointment ID
  external_system,     -- 'epic_hl7v2' (needs to support cerner/meditech)
  import_source,       -- 'hl7v2'
  primary_diagnosis_code,
  primary_diagnosis_desc
)
```

### Entity Matching Strategy (Already Generic)

Three-tier matching for surgeon, procedure, and room:
1. **Entity mapping lookup** (NPI/CPT/room code → `ehr_entity_mappings`)
2. **Normalized exact match** (for rooms: "OR3" = "or 3" = "Operating Room 3")
3. **Fuzzy name match** (Jaro-Winkler similarity, auto-match ≥0.90, suggest ≥0.70)

### Trigger Event Handling

| Event | HL7v2 Code | Action |
|---|---|---|
| New appointment | SIU_S12 | Create case |
| Rescheduled | SIU_S13 | Update case |
| Modified | SIU_S14 | Update case |
| Cancelled | SIU_S15 | Update status → cancelled |
| Discontinued | SIU_S16 | Update status → cancelled |

---

## 6. What Needs to Change for Multi-EHR Support

### Backend Changes (Estimated ~30% new code)

1. **`integration_type` expansion**: Add `'cerner_hl7v2'` and `'meditech_hl7v2'` as valid types
2. **System-specific config layer**: Small adapter per system for field preferences:
   - Which segment to prefer for surgeon (AIP vs PV1-7 priority)
   - How to handle custom Z-segments (Cerner)
   - Date format edge cases
3. **Rename `lib/integrations/epic/` → `lib/integrations/ehr/`**: The matcher code is already generic — just the folder name is Epic-specific
4. **Edge function updates**: Accept `integration_type` from the `ehr_integrations` config, route to appropriate adapter
5. **`external_system` values**: Support `'cerner_hl7v2'` and `'meditech_hl7v2'` in cases table

### Frontend Changes (Settings UI)

1. **Integration type selector**: Dropdown/tabs to choose Epic / Oracle Cerner / MEDITECH when configuring a facility's integration
2. **System-specific help text**: Each system has slightly different setup instructions for the hospital IT team
3. **Endpoint URL display**: Show the facility-specific webhook URL that the hospital should configure
4. **Test message panel**: Allow sending test SIU messages (already exists for Epic, needs to work for all three)
5. **Review queue**: Already generic — just needs to display the source system name

### Database Migration

```sql
-- Expand integration_type check constraint
ALTER TABLE ehr_integrations
  DROP CONSTRAINT IF EXISTS ehr_integrations_type_check,
  ADD CONSTRAINT ehr_integrations_type_check
    CHECK (integration_type IN ('epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2'));

-- Expand external_system on cases
-- (may already be TEXT with no constraint)
```

---

## 7. Planned Feature Scope

### In Scope
- Oracle Cerner HL7v2 SIU integration (via COI)
- MEDITECH HL7v2 SIU integration
- Multi-system selector in global admin settings
- System-specific configuration and help text
- Shared entity matching, review queue, and case creation pipeline
- Per-system SIU field preference adapters

### Out of Scope
- Cerner FHIR R4 integration (future phase — different architecture)
- Athenahealth integration (not a surgical scheduler)
- SIS / HST Pathways (requires business partnerships)
- HL7v2 message SENDING (we only receive)
- Changes to the existing Epic integration behavior

### User's Design Requirements (from conversation)
- "Mimic everything we have for Epic" — identical frontend experience per system
- Global admin settings page should let you switch between the three systems
- "Reuse what we can on the backend" — shared parser, matcher, review queue
- "If it's better to separate some backend stuff to be specific to each system, we can" — adapter pattern is acceptable

---

## 8. Key Reference Links

### Oracle Cerner
- FHIR R4 API Docs: https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/r4_overview.html
- Integration Guide: https://www.tactionsoft.com/blog/cerner-oracle-health-integration-guide/
- Cerner FHIR GitHub: https://github.com/cerner/fhir.cerner.com

### MEDITECH
- HL7v2 Scheduling Outbound Spec (PDF): https://ehr.meditech.com/sites/default/files/documents/20240613/scheduling-outbound-24.pdf
- HL7 Outbound Message List: https://ehr.meditech.com/meditech-greenfield/hl7-outbound-list-for-greenfield
- Surgical Services: https://ehr.meditech.com/ehr-solutions/meditech-surgical-services

### HL7v2 Standard
- SIU Message Reference: https://www.interfaceware.com/hl7-siu
- SIU_S12 Spec: https://hl7-definition.caristix.com/v2/HL7v2.7/TriggerEvents/SIU_S12
- SIU Overview (Rhapsody): https://rhapsody.health/resources/hl7-siu-message/
- SIU/SRM Tutorial: https://datica-2019.netlify.app/academy/hl7-204-the-hl7-scheduling-messages-siu-and-srm/

### Market Context
- Hospital EHR Market Share: https://www.definitivehc.com/blog/most-common-inpatient-ehr-systems
- OR Management Market: https://www.marketsandmarkets.com/ResearchInsight/operating-room-management-market.asp
- Epic OpTime: https://digitalhealth.folio3.com/blog/epic-optime-features-uses-benefits/

### Athenahealth (Ruled Out for Surgical Scheduling)
- API Overview: https://docs.athenahealth.com/api/guides/overview
- Sandbox Practice ID: 195900
- Auth: OAuth2 client_credentials → `https://api.preview.platform.athenahealth.com/oauth2/v1/token`
- Has appointment notes with procedure descriptions, surgery documents with diagnosis codes, and surgical history with CPT codes — but no actual OR scheduling
- Could be a future "lite" integration for surgeon office case pre-creation

---

## 9. Athenahealth Sandbox Credentials (for future reference)

> **WARNING**: Rotate these — they were used in a research session.
- Client ID: `0oa11ckjb2m7j33DH298`
- Secret: `FykTzxASDCsJ2yTn84A6m980sogKyPG2uAtiV-SLeFkVJ5mRSsgd_wNkOLguWia6`
- Sandbox Base: `https://api.preview.platform.athenahealth.com/v1/195900`
- Token endpoint: `https://api.preview.platform.athenahealth.com/oauth2/v1/token`
- Scope: `athena/service/Athenanet.MDP.*`

### Useful Athenahealth Endpoints Discovered
```
GET /appointments/booked?appointmenttypeid=6  — Surgery appointments
GET /appointments/{id}/notes                  — Structured procedure notes
GET /patients/{id}/documents/surgery          — Surgery orders with diagnosis codes
GET /chart/{id}/surgicalhistory               — CPT procedure codes post-surgery
GET /patients/{id}                            — Demographics
GET /providers/{id}                           — Surgeon details + NPI
GET /departments                              — Facility locations
GET /appointments/changed                     — Polling for new/modified appointments
POST /appointments/changed/subscription       — Subscribe to changes
```
