# Project: Demo Data Generator Redesign
**Completed:** 2026-02-22
**Branch:** feature/demo-generator-redesign
**Duration:** 2026-02-21 → 2026-02-22
**Total Phases:** 8 (1, 2, 3, 4, 5, 6a, 6b, 7)

## What Was Built
Complete overhaul of the ORbit demo data generator — both the wizard UI and the underlying generation engine. Replaced the monolithic 1,050-line demo page with a 6-step sidebar wizard using the FacilityWizard.jsx design language. The wizard walks admins through: facility selection with config status panel, surgeon profile configuration with block schedule integration and speed profiles, per-day room schedule grids, per-surgeon outlier configuration with dual frequency/magnitude sliders, a review summary, and an SSE-streamed running step with real-time progress.

The 990-line generator engine was overhauled to produce realistic surgical data: surgeon-specific procedure durations (3-tier resolution), speed profile scaling (fast/average/slow), per-day room assignments, incision-based callback timing with transit gaps, and a standalone outlier engine that generates late starts, long turnovers, extended phases, callback delays, and fast cases — all with configurable frequency and magnitude per surgeon, plus "bad day" scenarios where everything compounds. Cascading delays propagate naturally through subsequent milestones.

Post-generation, the system creates cancelled cases (~3%), delays (~5-8%), unvalidated cases (~2%), device data for joint cases, case complexities, and runs both flag detection engines. All with SSE streaming progress and automatic rollback on failure.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Types, nav link, wizard shell with facility step and config status | `b9dccdc` |
| 2     | Surgeon profiles step with block schedule and duration integration | `a2c7fea` |
| 3     | Room schedule grid and outlier config steps | `32460f1` |
| 4     | Review step, running step with SSE streaming endpoint | `52d0694` |
| 5     | Per-day rooms, speed profiles, surgeon durations, incision-based callback timing | `a35bdeb` |
| 6a    | Outlier engine with per-surgeon profiles and cascading delays | `e6dfc01` |
| 6b    | Cancelled cases, delays, device data, flag detection, purge fixes | `5bad0bf` |
| 7     | Wizard components, outlier engine, holiday utils, and generator tests | `4dea533` |

## Key Files Created/Modified
**New files:**
- `app/admin/demo/DemoWizardShell.tsx` — sidebar wizard layout with step navigation and provision summary
- `app/admin/demo/types.ts` — wizard types, constants, validation helpers, speed profile enum
- `app/admin/demo/steps/FacilityStep.tsx` — Step 1: facility selection + config status panel
- `app/admin/demo/steps/SurgeonProfilesStep.tsx` — Step 2: surgeon config with block schedules
- `app/admin/demo/steps/RoomScheduleStep.tsx` — Step 3: visual day/room grid
- `app/admin/demo/steps/OutlierConfigStep.tsx` — Step 4: per-surgeon outlier controls with dual sliders
- `app/admin/demo/steps/ReviewStep.tsx` — Step 5: compact summary cards + combined schedule grid
- `app/admin/demo/steps/RunningStep.tsx` — Step 6: SSE-powered progress + success screen
- `app/api/demo-data/generate/route.ts` — SSE streaming endpoint with onProgress callback wiring
- `lib/demo-outlier-engine.ts` — standalone outlier engine with pure functions for each outlier type
- `lib/us-holidays.ts` — algorithmic US federal holiday computation

**Modified files:**
- `app/admin/demo/page.tsx` — replaced monolithic page with new wizard shell
- `app/api/demo-data/route.ts` — updated config shape, added list-surgeon-durations action
- `lib/demo-data-generator.ts` — major refactor: per-day rooms, speed scaling, surgeon durations, incision callbacks, onProgress, case_staff pattern
- `components/layouts/navigation-config.tsx` — added "Demo Generator" to admin sidebar Management group

**Test files (257 tests):**
- `app/admin/demo/__tests__/demo-wizard.test.tsx` — wizard step component tests (25 tests)
- `app/admin/demo/__tests__/DemoWizardShell.test.tsx` — shell layout tests (15 tests)
- `app/admin/demo/__tests__/FacilityStep.test.tsx` — facility step tests (27 tests)
- `app/admin/demo/__tests__/SurgeonProfilesStep.test.tsx` — surgeon profiles tests (26 tests)
- `app/admin/demo/__tests__/phase3-steps.test.tsx` — room schedule + outlier config tests (30 tests)
- `app/admin/demo/__tests__/types.test.ts` — type validation tests (34 tests)
- `lib/__tests__/demo-data-generator.test.ts` — generator engine tests (59 tests)
- `lib/__tests__/demo-outlier-engine.test.ts` — outlier engine tests (41 tests)
- `lib/__tests__/us-holidays.test.ts` — holiday computation tests

## Architecture Decisions
- **Standalone outlier engine** (`lib/demo-outlier-engine.ts`): Kept as pure functions in a separate module to prevent the main generator from growing to 1,500+ lines. Types co-located.
- **SSE streaming via separate endpoint**: `/api/demo-data/generate/route.ts` handles generation with ReadableStream + SSE events. Original `/api/demo-data/route.ts` retained for list/status/clear actions.
- **Inline outlier application**: Outliers modify milestone offsets during case generation (not post-processing), so cascading delays happen naturally.
- **3-tier duration resolution**: surgeon_procedure_duration → procedure_types.expected_duration_minutes → hardcoded fallback.
- **Incision-based callback timing**: Callback happens partway through incision (20-100% depending on surgeon quality), not at prep_drape_complete.
- **case_staff pattern**: Uses the unified case_staff table for anesthesia assignment (not the dropped cases.anesthesiologist_id column).
- **Algorithmic holidays**: US federal holidays computed algorithmically in `lib/us-holidays.ts` (not hardcoded dates).
- **No new database tables**: All data populates existing tables only.

## Database Changes
No new tables, columns, views, triggers, or migrations. The generator populates existing tables:
- `cases`, `case_milestones`, `case_staff`, `case_flags`, `case_delays`
- `case_complexities`, `case_device_companies`, `case_device_activity`

Purge function extended to clean: `case_flags`, `case_complexities`, `case_device_companies`, `case_device_activity`, `metric_issues`.

## Known Limitations / Future Work
- **SSE integration tests missing**: No test for the SSE streaming endpoint or RunningStep ↔ SSE connection. Unit-level SSE event parsing is tested.
- **Post-generation validation tests missing**: No test that queries generated data to verify rates match configured targets (~3% cancelled, ~5-8% delayed, ~2% unvalidated).
- **Purge idempotency untested**: No test verifying purge + regenerate produces consistent results.
- **Flag rules dependency**: Generator warns (via SSE) if no flag_rules configured but doesn't auto-create them. Facility must have flag rules pre-configured for flag detection to work.
