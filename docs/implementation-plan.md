# Implementation Plan: Unify Anesthesiologist as Staff Assignment

## Summary
Remove `cases.anesthesiologist_id` column and treat anesthesiologists as regular `case_staff` entries. Affects web app, iOS app, and database. 5 phases.

## Interview Notes
- Dashboard: drag-and-drop like other staff (AnesthesiaPopover is already dead code)
- Cardinality: allow multiple anesthesiologists per case
- Keep amber color theme, remove Dr. prefix
- Drop `get_anesthesiologist_block_stats` (dead code — nothing calls it in web or iOS)
- Update both web and iOS in same branch
- `StaffMultiSelect` already has an "Anesthesiologists" section — minimal form work

## Phases

| # | Phase | Complexity | Status |
|---|-------|-----------|--------|
| 1 | Data migration: copy anesthesiologist_id → case_staff | Small | pending |
| 2 | Web: remove dedicated form field, update validation | Medium | pending |
| 3 | Web: update display components, delete dead code | Medium | pending |
| 4 | iOS: update all readers to use case_staff | Medium | pending |
| 5 | DB cleanup: drop column, update RPCs | Medium | pending |

See `active-feature.md` for full phase details, file lists, and test gates.
