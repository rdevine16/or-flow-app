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
- **SSE streaming**: Separate `/api/demo-data/generate/route.ts` endpoint. Generator gets `onProgress` callback; API route creates ReadableStream writing SSE events. Phase-level + per-batch counts (~20-50 events total).
- **Surgeon speed profiles**: Fast surgeons → ~70% of template offsets, average → ~100%, slow → ~130%. Configured per surgeon in wizard.
- **Outlier sliders**: Each outlier type gets toggle + frequency slider (% of cases) + magnitude slider (how far from normal). 5 types: Late Starts, Long Turnovers, Extended Phases, Callback Delays, Fast Cases. Plus Bad Day frequency slider.
- **Rates (lowered per Q25)**: ~3% cancelled, ~5-8% delays, ~2% unvalidated. Demo should look well-run.
- **Device data**: Generate basic device records for joint cases — `case_device_companies` + `case_device_activity` linking to vendor.
- **Holidays**: Compute US federal holidays algorithmically (not hardcoded). Skip these days during generation.
- **Flag rules**: Check and warn if missing (don't auto-create). Show warning in SSE progress stream.
- **Config status panel**: Show Surgeons, Rooms, Procedures, Payers, Milestones, Flag Rules, Cancellation Reasons, Delay Types, Existing Cases. Highlight zeros in amber.
- **Cancelled cases**: Pre-day cancellations only — no milestones, no staff, no implants. Just case shell + cancelled_at + reason.
- **SSE error handling**: On failure, attempt purge of generated data, send error event. User gets clean slate to retry.
- **Success screen**: Per-case averages (milestones/case, staff/case, flags/case) + totals. Not raw totals alone.

---

## Phase 1: Types, Navigation, and Wizard Shell
**Complexity**: Medium

### What it does
- Create shared types file for the demo wizard with new data structures (per-day room assignments, outlier profiles, speed profiles, 6-step wizard state)
- Add "Demo Generator" link to admin sidebar navigation (Management group, global_admin only)
- Build the 6-step wizard shell using FacilityWizard.jsx sidebar layout pattern
- Implement Step 1 (Facility Selection) — select demo facility, months-of-history input, display facility details
- Config status panel showing: Surgeons, Rooms, Procedures, Payers, Milestones, Flag Rules, Cancellation Reasons, Delay Types, Existing Cases — zeros highlighted in amber as warnings
- US federal holiday computation (algorithmic, not hardcoded) — utility function for use by generator

### Files touched
- **NEW** `app/admin/demo/types.ts` — wizard types, constants, validation helpers, speed profile enum
- **NEW** `app/admin/demo/DemoWizardShell.tsx` — sidebar layout, step navigation, provision summary
- **NEW** `app/admin/demo/steps/FacilityStep.tsx` — Step 1: facility selection + config status panel
- **NEW** `lib/us-holidays.ts` — algorithmic US federal holiday computation
- **EDIT** `app/admin/demo/page.tsx` — replace monolithic page with new wizard shell import
- **EDIT** `components/layouts/navigation-config.tsx` — add "Demo Generator" to Management group (global_admin only)

### Commit message
`feat(demo): phase 1 - types, nav link, wizard shell with facility step and config status`

### 3-stage test gate
1. **Unit**: Types compile, validation helpers return correct results, holiday computation produces correct dates, wizard step state transitions work
2. **Integration**: Navigating to `/admin/demo` renders the sidebar wizard, facility selection loads demo facilities from API, config status panel fetches and displays counts
3. **Workflow**: Admin user opens admin sidebar → clicks "Demo Generator" → sees facility step → selects Riverwalk → config status shows counts with amber warnings for any zeros

---

## Phase 2: Surgeon Profiles Step + Block Schedule Integration
**Complexity**: Large

### What it does
- Implement Step 2 (Surgeon Profiles) — select surgeons, configure speed profile, specialty, vendor, closing workflow
- **Speed profile selector**: fast (~70% of template offsets), average (~100%), slow (~130%) — affects all milestone timing during generation
- Load block schedules via `get_blocks_for_date_range` RPC to auto-fill each surgeon's operating days (show as pre-checked, user can override)
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
- Implement Step 4 (Outlier Config) — per-surgeon outlier controls with dual sliders
  - 5 outlier types per surgeon, each with: toggle (on/off) + frequency slider (% of cases affected) + magnitude slider (how far from normal)
    1. Late Starts
    2. Long Turnovers
    3. Extended Phases
    4. Callback Delays
    5. Fast Cases (suspiciously quick — data quality concern)
  - "Bad Day" frequency slider per surgeon (0-3 bad days per month — all outlier types fire simultaneously with max severity)
  - Summary showing estimated outlier rates per surgeon
  - Preview: "Dr. Smith — 2 problems: Late Starts (30% freq, high magnitude) + Callback Delays (40% freq, medium magnitude)"

### Files touched
- **NEW** `app/admin/demo/steps/RoomScheduleStep.tsx` — Step 3: visual day/room grid
- **NEW** `app/admin/demo/steps/OutlierConfigStep.tsx` — Step 4: per-surgeon outlier checkboxes
- **EDIT** `app/admin/demo/types.ts` — add RoomSchedule and OutlierProfile types

### Commit message
`feat(demo): phase 3 - room schedule grid and outlier config steps`

### 3-stage test gate
1. **Unit**: Room grid toggle logic (max 2 per day, flip room detection), outlier profile serialization, slider value clamping
2. **Integration**: Clicking room cells toggles assignments, outlier toggles + sliders update surgeon profile state, validation blocks "Continue" if no rooms assigned
3. **Workflow**: User sets Mon: OR-1+OR-2, Tue: OR-1+OR-3 for Dr. Smith → enables Late Starts (30% freq, high magnitude) + Fast Cases (10% freq, low magnitude) → sees summary with frequency/magnitude breakdown

---

## Phase 4: Review + Running Steps + SSE Streaming Endpoint
**Complexity**: Large

### What it does
- Implement Step 5 (Review) — display all configuration with edit buttons per section
  - Facility details card (months, holiday count)
  - Compact per-surgeon summary cards: name, specialty, speed profile, operating days, rooms per day, procedure count, outlier badges (enabled types with freq/magnitude)
  - Read-only weekly OR schedule grid preview (combined view from all surgeons — spot room conflicts)
  - Estimated total cases at bottom
  - "Edit" buttons per section that jump back to the relevant step
- Implement Step 6 (Running) — SSE-powered progress indicator + results
  - Linear progress bar (0-100%) with current phase label below and running counts underneath
  - Vertical phase checklist with checkmarks for completed phases (Purging → Generating Cases → Inserting Milestones → Assigning Staff → Detecting Flags → Finalizing)
  - Real-time case count, milestone count, staff count, flag count
  - **Success screen**: per-case averages (milestones/case, staff/case, flags/case) + totals (total cases, cancelled count, delayed count, flagged count)
  - "Generate Again" / "View Facility" buttons on completion
  - **Error handling**: on failure, display error event + confirm purge completed. User gets clean slate to retry.
- **New SSE streaming endpoint** at `/api/demo-data/generate/route.ts`:
  - Accepts full wizard config via POST body
  - Creates ReadableStream, passes `onProgress` callback to generator that writes SSE events
  - Phase-level transitions + per-batch insert counts (~20-50 events total)
  - On error: attempt auto-rollback (purge generated data), send SSE error event
  - Keep existing `/api/demo-data/route.ts` for list/status/clear actions
- Generator gets `onProgress` callback parameter (prep for Phase 5 engine work)

### Files touched
- **NEW** `app/admin/demo/steps/ReviewStep.tsx` — Step 5: compact summary cards + combined schedule grid
- **NEW** `app/admin/demo/steps/RunningStep.tsx` — Step 6: SSE-powered progress + success screen
- **NEW** `app/api/demo-data/generate/route.ts` — SSE streaming endpoint with onProgress callback wiring
- **EDIT** `app/api/demo-data/route.ts` — keep for list/status/clear, update config shape
- **EDIT** `lib/demo-data-generator.ts` — add `onProgress` callback parameter to main generate function signature

### Commit message
`feat(demo): phase 4 - review step, running step with SSE streaming endpoint`

### 3-stage test gate
1. **Unit**: Review renders all surgeon configs with outlier badges correctly, progress state transitions work, SSE event parsing handles all event types
2. **Integration**: Clicking "Edit" on surgeon section navigates to Step 2, running step connects to SSE endpoint and shows real-time progress, error events trigger rollback display
3. **Workflow**: User reviews config → clicks Generate → sees SSE progress through all phases → gets success screen with per-case averages + totals → can navigate to facility

---

## Phase 5: Generator Engine — Per-Day Rooms, Surgeon Durations, Speed Profiles, Callback Timing
**Complexity**: Large

### What it does
- Refactor `SurgeonProfileInput` to support per-day room assignments (`Map<dayOfWeek, { rooms: string[] }>`)
- Update `generateSurgeonCases()` to use day-specific room assignments instead of fixed primary/flip
- Query `surgeon_procedure_duration` table for surgeon-specific durations (3-tier: surgeon override → procedure default → hardcoded)
- **Speed profile scaling**: Apply surgeon speed multiplier to all milestone offsets:
  - Fast surgeon: multiply all offsets by ~0.70 (cases finish quicker)
  - Average surgeon: multiply by ~1.00 (baseline)
  - Slow surgeon: multiply by ~1.30 (cases take longer)
- **US holiday skipping**: Use `lib/us-holidays.ts` to skip federal holidays during date generation
- Move callback timing from `prep_drape_complete` to PARTWAY THROUGH INCISION:
  - Good caller: callback at 20-40% through surgical time (optimal — room ready when surgeon arrives)
  - Average caller: callback at 50-70% through surgical time (slight idle)
  - Late caller: callback at 80-100% through surgical time (significant idle)
- Add transit + scrub gap: 3-8 min between `surgeon_left_at` in Room A and first action in Room B
- Ensure all milestone timing cascades: a delay at incision pushes closing, closing_complete, patient_out, room_cleaned
- Fix `surgeon_left_at` calculation to include transit gap for flip room surgeons
- Update `called_back_at` to use the new incision-relative timing
- Wire `onProgress` callback into generation loop (emit per-batch counts for SSE)
- **Staff assignment**: Use `case_staff` pattern (not dropped `anesthesiologist_id`). Pool anesthesiologists + CRNAs, assign round-robin to room-days.

### Files touched
- **EDIT** `lib/demo-data-generator.ts` — refactor SurgeonProfileInput, generateSurgeonCases, buildMilestones, add speed scaling + holiday skipping + onProgress + case_staff pattern
- **EDIT** `app/api/demo-data/route.ts` — add `list-surgeon-durations` action for bulk surgeon duration lookup

### Commit message
`feat(demo): phase 5 - per-day rooms, speed profiles, surgeon durations, incision-based callback timing`

### 3-stage test gate
1. **Unit**: Duration resolution follows 3-tier hierarchy, speed profile multiplier applies correctly, callback timing is within incision window, transit gap is applied, holidays are skipped
2. **Integration**: Generated cases use correct rooms per day, fast surgeon cases are shorter than slow surgeon cases for same procedure, callback times correlate with incision milestone, staff uses case_staff table
3. **Workflow**: Generate data for Riverwalk → verify Dr. Fast's Mon cases are in OR-1+OR-2 but Tue cases are in OR-1+OR-3 → fast surgeon cases visibly shorter → callback times during incision → transit gap between flip room cases → anesthesia assigned via case_staff

---

## Phase 6a: Outlier Engine + Cascading Delays
**Complexity**: Large

### What it does

**Outlier Engine** (`lib/demo-outlier-engine.ts` — standalone module with pure functions):
- Implement per-surgeon outlier profiles driven by wizard config (toggle + frequency slider + magnitude slider per type):
  - **Late Starts**: First case 15-45 min late (scaled by magnitude), subsequent cases cascade 5-15 min each. Frequency slider controls % of days affected.
  - **Long Turnovers**: 30-60 min turnovers (vs normal 15-20). Frequency slider controls % of turnovers affected.
  - **Extended Phases**: Surgical time 40-80% over median (scaled by magnitude) for frequency% of cases. Triggers critical flags.
  - **Callback Delays**: Surgeon calls back 10-25 min late in flip room. Frequency slider controls % of flip transitions affected.
  - **Fast Cases**: Cases finish 15-25% faster than median (scaled by magnitude). Frequency slider controls % of cases. Data quality concern.
- "Bad day" scenarios: on designated days (count from Bad Day slider), ALL enabled outlier types fire simultaneously with maximum magnitude
- **Cascading delays**: a late start pushes all subsequent milestones proportionally. Long turnover delays cascade to next case start. Extended phases push closing through room_cleaned.
- Hook into `generateSurgeonCases()` — modify milestone offsets inline as each case is built (cascading happens naturally)

### Files touched
- **NEW** `lib/demo-outlier-engine.ts` — standalone outlier profile logic: pure functions for each outlier type, bad day scheduler, cascade calculator
- **EDIT** `lib/demo-data-generator.ts` — integrate outlier engine into case generation loop, apply cascading delays

### Commit message
`feat(demo): phase 6a - outlier engine with per-surgeon profiles and cascading delays`

### 3-stage test gate
1. **Unit**: Outlier engine applies correct rates per profile (frequency slider respected), magnitude slider scales delay amounts, cascading delays shift all subsequent milestones, bad day scheduler picks correct day count
2. **Integration**: Surgeons with outlier profiles generate visibly different milestone timings, fast cases are shorter, late start days cascade through all cases
3. **Workflow**: Generate data for surgeon with Late Starts (50% freq, high magnitude) + Callback Delays → verify ~50% of days have late first case → subsequent cases on late days are also delayed → callback delays visible in flip room transitions

---

## Phase 6b: Missing Data, Device Data, Flag Detection, Purge Fixes
**Complexity**: Large

### What it does

**Cancelled Cases (~3%):**
- Pre-day cancellations only — no milestones, no staff, no implants
- Just case shell with `cancelled_at`, `cancellation_reason_id` (from facility's `cancellation_reasons`), status `cancelled`

**Case Delays (~5-8%):**
- Insert into `case_delays` with appropriate `delay_type_id` from facility's `delay_types`, duration 5-45 min

**Unvalidated Cases (~2%):**
- Leave ~2% of completed cases with `data_validated = false` for Data Quality page

**Case Complexities:**
- Joint cases get 'Standard' or 'Complex', spine cases get 'Complex', some get multiple factors
- Insert into `case_complexities` junction table

**Device Data (joint cases):**
- For cases with implants (joint specialty), create `case_device_companies` and `case_device_activity` records linking to the vendor configured per surgeon

**Flag Detection (both engines):**
- Check if `flag_rules` exist for facility — warn in SSE progress stream if missing (don't auto-create)
- Run `flagEngine.ts` for configurable rule-based `case_flags`
- Run `flag-detection.ts` for additional flag types it uniquely detects
- Insert all results into `case_flags` table

**Purge Fixes:**
- Add to `purgeCaseData()`: `case_flags`, `case_complexities`, `case_device_companies`, `case_device_activity`, `metric_issues`

### Files touched
- **EDIT** `lib/demo-data-generator.ts` — cancelled cases, delays, complexities, device data, flag detection calls, purge fix
- **EDIT** `app/api/demo-data/generate/route.ts` — add flag detection + missing data steps to SSE generation flow, load cancellation reasons + delay types

### Commit message
`feat(demo): phase 6b - cancelled cases, delays, device data, flag detection, purge fixes`

### 3-stage test gate
1. **Unit**: Cancelled case ratio ~3%, delay ratio ~5-8%, unvalidated ~2%, device records created for joint cases, purge cleans all new tables
2. **Integration**: Generated data has case_flags populated, case_delays exist with correct delay_types, cancelled cases have no milestones/staff, device records link to correct vendors
3. **Workflow**: Generate data → check `/analytics/flags` shows flagged cases → check `/data-quality` shows ~2% unvalidated → check cancellation rate visible in analytics → verify purge cleans case_flags + case_complexities + device tables

---

## Phase 7: Tests
**Complexity**: Medium

### What it does
- Unit tests for all new wizard step components (type validation, state management, slider clamping)
- Unit tests for `demo-outlier-engine.ts` (outlier rates per frequency/magnitude, cascading logic, bad day scenarios, fast cases)
- Unit tests for updated `demo-data-generator.ts` (per-day rooms, surgeon durations, speed profile scaling, callback timing, holiday skipping, case_staff assignment)
- Unit tests for `us-holidays.ts` (algorithmic holiday computation)
- Unit tests for SSE event parsing in RunningStep
- Integration test: full generation flow with outlier profiles → verify case_flags, case_delays, cancelled cases, device data created
- Run full `npm run typecheck` and fix any type errors

### Files touched
- **NEW** `app/admin/demo/__tests__/demo-wizard.test.tsx` — wizard step component tests
- **NEW** `lib/__tests__/demo-outlier-engine.test.ts` — outlier engine unit tests
- **NEW** `lib/__tests__/us-holidays.test.ts` — holiday computation tests
- **EDIT** `lib/__tests__/demo-data-generator.test.ts` — update existing tests for new config shape + speed profiles

### Commit message
`test(demo): phase 7 - wizard components, outlier engine, holiday utils, and generator tests`

### 3-stage test gate
1. **Unit**: All new tests pass, existing tests updated for new interfaces
2. **Integration**: Full typecheck passes with zero errors in new/changed files
3. **Workflow**: `npm run typecheck && npm run test` passes

---

## Phase Summary

| Phase | Description | Complexity | Key Deliverable |
|-------|-------------|------------|-----------------|
| 1 | Types, Navigation, Wizard Shell + Config Status | Medium | Sidebar wizard with facility step, config status panel, holiday util |
| 2 | Surgeon Profiles + Block Schedule + Speed Profiles | Large | Surgeon config with auto-populated days + speed selector |
| 3 | Room Schedule Grid + Outlier Config (dual sliders) | Large | Visual day/room grid + per-surgeon outlier toggle/freq/magnitude |
| 4 | Review + Running Steps + SSE Streaming Endpoint | Large | Complete wizard flow with SSE progress + success screen |
| 5 | Generator Engine Overhaul | Large | Per-day rooms, speed scaling, surgeon durations, incision callbacks |
| 6a | Outlier Engine + Cascading Delays | Large | Per-surgeon outlier profiles with frequency/magnitude + cascading |
| 6b | Missing Data, Device Data, Flag Detection, Purge | Large | Cancelled cases, delays, devices, both flag engines, purge fixes |
| 7 | Tests | Medium | Full test coverage for wizard + engine + holidays + outliers |

## Dependencies
- Phase 1 must be done first (foundation)
- Phases 2-4 are sequential (wizard steps build on each other)
- Phase 5 can start after Phase 1 (engine changes independent of UI)
- Phase 6a depends on Phase 5 (outlier engine hooks into updated generator)
- Phase 6b depends on Phase 6a (missing data + flags layer on top of outlier-aware cases)
- Phase 7 depends on all previous phases
