# Feature: Demo Data Generator Redesign

## Goal
Rebuild the demo data generator into a professional-grade tool for creating client demo environments. The current generator produces statistically flat data that fails to showcase the application's anomaly detection, flag system, financial analytics, and data quality features. The redesign adds realistic outlier generation, per-surgeon problem profiles, per-day room assignments, surgeon-specific procedure durations, proper flip room callback timing, and a polished wizard UI integrated into the global admin pages.

## Requirements

### Wizard UI
- 6-step sidebar wizard modeled after `docs/FacilityWizard.jsx` layout
- Steps: Facility → Surgeon Profiles → Room Schedule → Outlier Config → Review → Running
- Integrated into admin sidebar navigation (Management group)
- Visual day/room grid for per-day room assignments (Mon: OR-1 + OR-2, Tue: OR-1 + OR-3)
- Block schedule integration: auto-fill operating days from `block_schedules` table
- Per-surgeon independent outlier checkboxes (Late Starts, Long Turnovers, Extended Phases, Callback Delays)

### Generator Engine
- Surgeon-specific procedure durations: query `surgeon_procedure_duration` first, fall back to `procedure_types.expected_duration_minutes`
- Callback timing happens PARTWAY THROUGH INCISION (not at prep_drape_complete)
- Transit + scrub gap (3-8 min) between rooms for flip room surgeons
- Per-day room assignments (different rooms on different days of the week)
- All outliers CASCADE through subsequent milestones

### Outlier Engine
- Late starts / FCOTS violations: 15-45 min late, cascading through day
- Long turnovers: 30-60 min vs normal 15-20 min
- Extended surgical phases: 40-80% over median, trigger critical flags
- Callback delays: surgeon called back 10-25 min late, flip room idles
- "Bad day" scenarios: 1-2 days per month where everything compounds
- Fast outliers: suspiciously quick cases

### Missing Data Generation
- Run BOTH flag engines post-generation (flag-detection.ts + flagEngine.ts)
- Generate cancelled cases (~5-8% with cancellation_reasons)
- Generate case delays (~10-15% with delay_types)
- Leave ~10% of cases unvalidated for Data Quality page
- Assign case complexities to joint/spine cases

### Purge Fixes
- Add missing tables: case_flags, case_complexities, case_device_companies, case_device_activity, metric_issues

## Database Context
- Table: `surgeon_procedure_duration` — surgeon-specific expected_duration_minutes overrides
- Table: `block_schedules` — recurring surgeon availability by day of week
- RPC: `get_blocks_for_date_range` — expands recurring blocks into daily instances
- Table: `case_flags` — auto-detected and rule-based flags
- Table: `case_delays` — user-reported delays with delay_type_id
- Table: `case_complexities` — junction table linking cases to complexity factors
- Table: `cancellation_reasons` — facility-specific cancellation reason codes

## UI/UX
- Route: `/admin/demo`
- Sidebar wizard layout (FacilityWizard.jsx pattern)
- Visual day/room grid for room assignments
- Per-surgeon outlier checkboxes
- Real-time progress during generation

## Files Likely Involved
- `app/admin/demo/page.tsx` — rebuild with wizard shell
- `lib/demo-data-generator.ts` — engine overhaul
- `app/api/demo-data/route.ts` — API updates
- `components/layouts/navigation-config.tsx` — admin nav link
- `docs/FacilityWizard.jsx` — layout reference

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- `scheduled_duration_minutes` column was dropped — do not reference
- Block schedules don't include room assignments — rooms are case-level
- Do NOT create block schedules, pricing, or financial targets (already established)

## Out of Scope
- Block schedule creation
- Pricing/reimbursement data creation
- Financial targets creation
- Patient demographic data

## Acceptance Criteria
- [ ] Demo wizard accessible from admin sidebar → Management group
- [ ] 6-step wizard with sidebar layout matches FacilityWizard.jsx design
- [ ] Block schedules auto-fill surgeon operating days
- [ ] Visual day/room grid allows per-day room assignments
- [ ] Per-surgeon outlier checkboxes produce visibly different metrics
- [ ] Callback timing during incision (not prep_drape_complete)
- [ ] Transit gap (3-8 min) between flip rooms
- [ ] Case flags populated post-generation (both engines)
- [ ] ~5-8% cancelled cases, ~10-15% delays, ~10% unvalidated
- [ ] Purge cleans all related tables
- [ ] All tests pass (`npm run typecheck && npm run test`)
- [ ] No TypeScript `any` types introduced
