# Project: Voice Command Settings UI
**Completed:** 2026-03-04
**Branch:** feature/voice-command-settings
**Total Phases:** 5 + 2 fix commits

## What Was Built
A two-column settings page for managing voice command aliases used by the iOS Room Mode. The left column lists objectives (milestones and utility actions) with filter tabs and search. The right column shows aliases for the selected objective, grouped by action type (Record, Cancel), with inline add/delete functionality and duplicate detection.

A separate global admin page at `/admin/voice-templates` allows global admins to manage default voice command templates (facility_id=NULL) that serve as defaults for new facilities. The facility-scoped page at `/settings/voice-commands` shows both facility-specific and inherited global aliases, with global aliases protected from deletion at the facility level.

An AdminConfigTabLayout shared component was also introduced to standardize the admin configuration page layout across all admin settings pages.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Database migration + DAL | f834c8a |
| 2     | Settings nav + page scaffolding | 5e4886a |
| 3     | Alias detail panel with add and delete | b268faf |
| 4     | Global admin templates page | 609e6c7 |
| 5     | Polish, permissions, and test suite | f16e1f1 |
| fix   | Use facility_milestone_id for facility alias filtering | ad180bb |
| fix   | Protect global aliases from deletion + aligned tag columns | 49576d1 |
| fix   | Test fixes + admin config tab layout | c8dc9ab |

## Key Files Created/Modified
**New files:**
- `app/settings/voice-commands/page.tsx` + `PageClient.tsx` — facility voice commands settings
- `app/admin/voice-templates/page.tsx` + `PageClient.tsx` — global admin templates
- `lib/dal/voice-commands.ts` — data access layer for voice command aliases
- `components/settings/voice-commands/AliasGroupSection.tsx` — action type group component
- `components/settings/voice-commands/AliasRow.tsx` — individual alias row
- `components/settings/voice-commands/AddAliasInput.tsx` — inline add with duplicate detection
- `components/admin/AdminConfigTabLayout.tsx` — shared admin config layout
- `lib/admin-config-nav-config.ts` — centralized admin navigation config
- `supabase/migrations/20260304000000_create_voice_command_aliases.sql`
- `supabase/migrations/20260304100000_fix_voice_command_facility_cascade.sql`

**Modified files:**
- `lib/settings-nav-config.ts` — added Voice Commands to Operations tab
- `lib/breadcrumbs.ts` — added admin/voice-templates breadcrumb
- `components/layouts/navigation-config.tsx` — added admin configuration nav
- All admin config PageClient files (15) — migrated to AdminConfigTabLayout

**Test files (6):**
- `app/settings/voice-commands/__tests__/PageClient.test.tsx` (15 tests)
- `app/settings/voice-commands/__tests__/voice-commands-workflow.test.tsx` (6 tests)
- `components/settings/voice-commands/__tests__/AddAliasInput.test.tsx` (15 tests)
- `components/settings/voice-commands/__tests__/AliasGroupSection.test.tsx`
- `components/settings/voice-commands/__tests__/AliasRow.test.tsx`
- Updated: `lib/__tests__/settings-nav-config.test.ts`, `lib/__tests__/breadcrumb-resolver.test.ts`

## Architecture Decisions
- **Two scopes:** Facility-specific aliases (facility_id = UUID) vs global templates (facility_id = NULL). Global templates are managed on a separate admin page, not inline.
- **Admin page location:** Moved to `/admin/voice-templates` (under Configuration) rather than `/settings/voice-commands/global` as originally planned. Better matches the admin navigation structure.
- **AdminConfigTabLayout:** Extracted a shared layout component for all admin config pages, enabling consistent tab navigation across the admin configuration section.
- **Facility alias filtering:** Uses `facility_milestone_id` (v2.0 pattern) for facility-scoped aliases, not `milestone_type_id` directly.
- **Global alias protection:** Global template aliases are shown with a "Global" badge on the facility page but cannot be deleted from there. Only editable on the admin templates page.
- **Hard delete:** Aliases use hard delete (row removal) rather than soft delete, despite the table having `is_active`/`deleted_at` columns. This was an explicit design choice from the feature spec.

## Database Changes
- Migration `20260304000000_create_voice_command_aliases.sql` — formalizes existing `voice_command_aliases` table with `CREATE TABLE IF NOT EXISTS`, RLS policies, and indexes
- Migration `20260304100000_fix_voice_command_facility_cascade.sql` — fixes cascade behavior for facility aliases

## Known Limitations / Future Work
- No test coverage for `app/admin/voice-templates/PageClient.tsx` (global admin page)
- No test for admin config landing → voice templates card navigation
- Template-to-facility propagation workflow not tested end-to-end
- Voice command analytics/usage dashboard deferred
- Auto-learning configuration deferred (auto_learned flag is set by iOS only)
- Bulk import/export of aliases deferred
