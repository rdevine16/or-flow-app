# Implementation Plan: Demo Data Generator Redesign

## Summary
Complete overhaul of the ORbit demo data generator — both the wizard UI and the underlying generation engine. Replaces the current monolithic 1,050-line demo page with a 6-step sidebar wizard using the FacilityWizard.jsx design language. Overhauls the 990-line generator to produce realistic outlier patterns, surgeon-specific durations, per-day room schedules, proper flip room callback timing, cancelled cases, delays, and flag detection — making demo environments showcase every feature of the application.

## Interview Notes
- **Callback timing**: Partway through incision milestone (not prep_drape_complete). Some surgeons call early (optimal), some call late (flip room idles).
- **Block schedules → days only**: Auto-fill operating days from block_schedules. Rooms assigned manually per day in visual grid.
- **Room assignments per day**: Mon: OR-1 + OR-2, Tue: OR-1 + OR-3. Visual day/room grid (matrix: days × rooms, click to toggle).
- **Outlier toggles**: Independent checkboxes per surgeon — Late Starts, Long Turnovers, Extended Phases, Callback Delays.
- **Wizard layout**: Sidebar from FacilityWizard.jsx with step nav + provision summary panel.
- **6 steps**: Facility → Surgeon Profiles → Room Schedule → Outlier Config → Review → Running.
- **Flag detection**: Run BOTH flag-detection.ts (simple) and flagEngine.ts (configurable rules) post-generation.
- **Surgeon durations**: Query `surgeon_procedure_duration` first → `procedure_types.expected_duration_minutes` → hardcoded fallback.
- **Transit gap**: 3-8 min between rooms for flip room surgeons.
- **`scheduled_duration_minutes`**: Column was dropped from cases table — skip it.
- **Pricing/blocks/targets**: Already established, do NOT create.

---

## Phase 1: Types, Navigation, and Wizard Shell
**Complexity**: Medium

### What it does
- Create shared types file for the demo wizard with new data structures (per-day room assignments, outlier profiles, 6-step wizard state)
- Add "Demo Data" link to admin sidebar navigation (Management group)
- Build the 6-step wizard shell using FacilityWizard.jsx sidebar layout pattern
- Implement Step 1 (Facility Selection) — select demo facility, show config status, display facility details

### Files touched
- **NEW** `app/admin/demo/types.ts` — wizard types, constants, validation helpers
- **NEW** `app/admin/demo/DemoWizardShell.tsx` — sidebar layout, step navigation, provision summary
- **NEW** `app/admin/demo/steps/FacilityStep.tsx` — Step 1: facility selection + status display
- **EDIT** `app/admin/demo/page.tsx` — replace monolithic page with new wizard shell import
- **EDIT** `components/layouts/navigation-config.tsx` — add Demo Data to Management group

### Commit message
`feat(demo): phase 1 - types, admin nav link, wizard shell with facility step`

### 3-stage test gate
1. **Unit**: Types compile, validation helpers return correct results, wizard step state transitions work
2. **Integration**: Navigating to `/admin/demo` renders the sidebar wizard, facility selection loads demo facilities from API
3. **Workflow**: Admin user opens admin sidebar → clicks "Demo Data" → sees facility step → selects Riverwalk → sees config status panel

---

## Phase 2: Surgeon Profiles Step + Block Schedule Integration
**Complexity**: Large

### What it does
- Implement Step 2 (Surgeon Profiles) — select surgeons, configure speed profile, specialty, vendor, closing workflow
- Load block schedules via `get_blocks_for_date_range` RPC to auto-fill each surgeon's operating days
- Display block schedule hours next to each surgeon (e.g., "Mon 7:00-15:00, Wed 7:00-15:00")
- Query `surgeon_procedure_duration` table to show surgeon-specific procedure durations in the profile card
- Auto-select procedure types based on specialty (joint → THA/TKA, hand → Carpal Tunnel/etc., spine → ACDF/etc.)

### Files touched
- **NEW** `app/admin/demo/steps/SurgeonProfilesStep.tsx` — Step 2: surgeon config cards with block schedule integration
- **EDIT** `app/admin/demo/types.ts` — add SurgeonProfile interface with per-day structure
- **EDIT** `app/api/demo-data/route.ts` — add `list-block-schedules` and `list-surgeon-durations` actions

### Commit message
`feat(demo): phase 2 - surgeon profiles step with block schedule and duration integration`

### 3-stage test gate
1. **Unit**: Block schedule parsing correctly maps days, surgeon duration resolution follows 3-tier hierarchy
2. **Integration**: Selecting a surgeon loads their block schedule, operating days auto-populate, procedure durations display correctly
3. **Workflow**: User selects 3 surgeons → block schedules auto-fill operating days → procedure types auto-select by specialty → durations show surgeon-specific overrides where they exist

---

## Phase 3: Room Schedule Grid + Outlier Config Steps
**Complexity**: Large

### What it does
- Implement Step 3 (Room Schedule) — visual day/room grid per surgeon
  - Matrix: operating days on rows, facility rooms on columns
  - Click to toggle room assignments (max 2 rooms per day for flip room pattern)
  - Visual indicator showing flip room vs single room days
  - Validation: at least 1 room per operating day
- Implement Step 4 (Outlier Config) — per-surgeon outlier checkboxes
  - Independent checkboxes: Late Starts, Long Turnovers, Extended Phases, Callback Delays
  - "Bad day" frequency slider (0-3 bad days per month)
  - Summary showing estimated outlier rates per surgeon
  - Preview: "Dr. Smith — 2 problems: Late Starts + Callback Delays"

### Files touched
- **NEW** `app/admin/demo/steps/RoomScheduleStep.tsx` — Step 3: visual day/room grid
- **NEW** `app/admin/demo/steps/OutlierConfigStep.tsx` — Step 4: per-surgeon outlier checkboxes
- **EDIT** `app/admin/demo/types.ts` — add RoomSchedule and OutlierProfile types

### Commit message
`feat(demo): phase 3 - room schedule grid and outlier config steps`

### 3-stage test gate
1. **Unit**: Room grid toggle logic (max 2 per day, flip room detection), outlier profile serialization
2. **Integration**: Clicking room cells toggles assignments, outlier checkboxes update surgeon profile state, validation blocks "Continue" if no rooms assigned
3. **Workflow**: User sets Mon: OR-1+OR-2, Tue: OR-1+OR-3 for Dr. Smith → toggles Late Starts + Callback Delays → sees summary "2 outlier categories"

---

## Phase 4: Review + Running Steps
**Complexity**: Medium

### What it does
- Implement Step 5 (Review) — display all configuration with edit buttons per section
  - Facility details card
  - Per-surgeon summary cards (speed, specialty, rooms per day, procedures, outlier flags)
  - Weekly OR schedule grid preview
  - Estimated output (case count, milestone count, etc.)
  - "Edit" buttons that jump back to the relevant step
- Implement Step 6 (Running) — progress indicator + results
  - Phase-by-phase progress bar (Purging → Generating → Inserting → Detecting Flags → Finalizing)
  - Real-time case count, milestone count, flag count
  - Success/error result with detailed breakdown
  - "Generate Again" / "View Facility" buttons on completion
- Update API route to accept new config shape with per-day rooms and outlier profiles

### Files touched
- **NEW** `app/admin/demo/steps/ReviewStep.tsx` — Step 5: review all config
- **NEW** `app/admin/demo/steps/RunningStep.tsx` — Step 6: progress + results
- **EDIT** `app/api/demo-data/route.ts` — accept new config shape, add flag detection step

### Commit message
`feat(demo): phase 4 - review step and running step with progress tracking`

### 3-stage test gate
1. **Unit**: Review renders all surgeon configs correctly, progress state transitions work
2. **Integration**: Clicking "Edit" on surgeon section navigates to Step 2, running step shows real-time progress from API
3. **Workflow**: User reviews config → clicks Generate → sees progress through all phases → gets result with case count + flag count → can navigate to facility

---

## Phase 5: Generator Engine — Per-Day Rooms, Surgeon Durations, Callback Timing
**Complexity**: Large

### What it does
- Refactor `SurgeonProfileInput` to support per-day room assignments (`Map<dayOfWeek, { rooms: string[] }>`)
- Update `generateSurgeonCases()` to use day-specific room assignments instead of fixed primary/flip
- Query `surgeon_procedure_duration` table for surgeon-specific durations (3-tier: surgeon override → procedure default → hardcoded)
- Move callback timing from `prep_drape_complete` to PARTWAY THROUGH INCISION:
  - Good caller: callback at 20-40% through surgical time (optimal — room ready when surgeon arrives)
  - Average caller: callback at 50-70% through surgical time (slight idle)
  - Late caller: callback at 80-100% through surgical time (significant idle)
- Add transit + scrub gap: 3-8 min between `surgeon_left_at` in Room A and first action in Room B
- Ensure all milestone timing cascades: a delay at incision pushes closing, closing_complete, patient_out, room_cleaned
- Fix `surgeon_left_at` calculation to include transit gap for flip room surgeons
- Update `called_back_at` to use the new incision-relative timing

### Files touched
- **EDIT** `lib/demo-data-generator.ts` — refactor SurgeonProfileInput, generateSurgeonCases, buildMilestones
- **EDIT** `app/api/demo-data/route.ts` — add `list-surgeon-durations` action for bulk surgeon duration lookup

### Commit message
`feat(demo): phase 5 - per-day rooms, surgeon durations, incision-based callback timing`

### 3-stage test gate
1. **Unit**: Duration resolution follows 3-tier hierarchy, callback timing is within incision window, transit gap is applied
2. **Integration**: Generated cases use correct rooms per day, different surgeons get different durations for same procedure, callback times correlate with incision milestone
3. **Workflow**: Generate data for Riverwalk → verify Dr. Fast's Mon cases are in OR-1+OR-2 but Tue cases are in OR-1+OR-3 → verify callback times are during incision → verify transit gap exists between flip room cases

---

## Phase 6: Outlier Engine + Missing Data Generation + Purge Fixes
**Complexity**: Large

### What it does

**Outlier Engine:**
- Implement per-surgeon outlier profiles based on wizard checkboxes:
  - **Late Starts**: First case 15-45 min late, subsequent cases cascade 5-15 min each. 30-50% of days affected.
  - **Long Turnovers**: 30-60 min turnovers (vs normal 15-20). Affects 20-40% of turnovers.
  - **Extended Phases**: Surgical time 40-80% over median for 15-25% of cases. Triggers critical flags.
  - **Callback Delays**: Surgeon calls back 10-25 min late in flip room. Affects 30-50% of flip transitions.
- "Bad day" scenarios: on designated days, ALL outlier types fire simultaneously with maximum severity
- Fast outliers: ~5% of cases finish 15-25% faster than median (data quality concern)
- Cascading delays: a late start pushes all subsequent milestones proportionally

**Missing Data:**
- Generate cancelled cases (~5-8%): pick random future + some completed cases, assign cancellation reason from facility's `cancellation_reasons`, set `cancelled_at`, `cancellation_reason_id`, status to `cancelled`
- Generate case delays (~10-15%): insert into `case_delays` with appropriate `delay_type_id` from facility's `delay_types`, duration 5-45 min
- Leave ~10% of completed cases with `data_validated = false` for Data Quality page
- Assign `case_complexities`: joint cases get 'Standard' or 'Complex', spine cases get 'Complex', some get multiple
- Run BOTH flag engines post-generation:
  1. Simple detection (`flag-detection.ts`) for surgeon day analysis
  2. Advanced engine (`flagEngine.ts`) for configurable rule-based flags
  - Insert results into `case_flags` table

**Purge Fixes:**
- Add to purgeCaseData(): `case_flags`, `case_complexities`, `case_device_companies`, `case_device_activity`, `metric_issues`

### Files touched
- **EDIT** `lib/demo-data-generator.ts` — outlier engine, cancelled cases, delays, complexities, flag detection calls
- **EDIT** `app/api/demo-data/route.ts` — add flag detection step to generation flow, load cancellation reasons + delay types
- **NEW** `lib/demo-outlier-engine.ts` — standalone outlier profile logic (keeps main generator clean)

### Commit message
`feat(demo): phase 6 - outlier engine, cancelled cases, delays, flag detection, purge fixes`

### 3-stage test gate
1. **Unit**: Outlier engine applies correct rates per profile, cascading delays shift all subsequent milestones, cancelled case ratio is within target
2. **Integration**: Generated data has case_flags populated, case_delays exist with correct delay_types, ~5-8% cancelled cases with reasons, ~10% unvalidated
3. **Workflow**: Generate data → check `/analytics/flags` shows flagged cases with severity breakdown → check `/data-quality` shows unvalidated cases → check `/analytics` shows non-zero cancellation rate → verify surgeons with outlier profiles have visibly worse metrics

---

## Phase 7: Tests
**Complexity**: Medium

### What it does
- Unit tests for all new wizard step components (type validation, state management)
- Unit tests for demo-outlier-engine.ts (outlier rates, cascading logic, bad day scenarios)
- Unit tests for updated demo-data-generator.ts (per-day rooms, surgeon durations, callback timing)
- Integration test: full generation flow with outlier profiles → verify case_flags, case_delays, cancelled cases created
- Run full `npm run typecheck` and fix any type errors

### Files touched
- **NEW** `app/admin/demo/__tests__/demo-wizard.test.tsx` — wizard step component tests
- **NEW** `lib/__tests__/demo-outlier-engine.test.ts` — outlier engine unit tests
- **EDIT** `lib/__tests__/demo-data-generator.test.ts` — update existing tests for new config shape

### Commit message
`test(demo): phase 7 - wizard components, outlier engine, and generator tests`

### 3-stage test gate
1. **Unit**: All new tests pass, existing tests updated for new interfaces
2. **Integration**: Full typecheck passes with zero errors in new/changed files
3. **Workflow**: `npm run typecheck && npm run test` passes

---

## Phase Summary

| Phase | Description | Complexity | Key Deliverable |
|-------|-------------|------------|-----------------|
| 1 | Types, Navigation, Wizard Shell | Medium | Sidebar wizard with facility step visible in admin nav |
| 2 | Surgeon Profiles + Block Schedule | Large | Surgeon config with auto-populated operating days |
| 3 | Room Schedule Grid + Outlier Config | Large | Visual day/room grid + per-surgeon outlier checkboxes |
| 4 | Review + Running Steps | Medium | Complete wizard flow from config to generation |
| 5 | Generator Engine Overhaul | Large | Per-day rooms, surgeon durations, incision-based callbacks |
| 6 | Outlier Engine + Missing Data + Purge | Large | Realistic outliers, flags, cancellations, delays |
| 7 | Tests | Medium | Full test coverage for wizard + engine |

## Dependencies
- Phase 1 must be done first (foundation)
- Phases 2-4 are sequential (wizard steps build on each other)
- Phase 5 can start after Phase 1 (engine changes independent of UI)
- Phase 6 depends on Phase 5 (outlier engine needs the updated generator)
- Phase 7 depends on all previous phases
