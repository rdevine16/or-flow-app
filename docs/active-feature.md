# Feature: Voice Command Settings UI

## Goal
Build a two-column settings page for managing voice command aliases. The iOS app reads these aliases to map spoken phrases to actions during Room Mode. The web UI lets facility admins view, add, and delete voice command aliases grouped by objective (milestone or utility action). Global admins manage default templates that cascade to new facilities via a separate admin page.

## Requirements
1. Two-column master-detail layout in settings
2. Left column: list of objectives with Milestones / Actions filter tabs
3. Right column: aliases grouped by action_type (Record, Cancel) with add/delete
4. Duplicate phrase detection on add (across all objectives)
5. Hard delete for alias removal
6. AI-learned aliases tagged with badge
7. Global admin page for managing default templates (facility_id=NULL)
8. Facility-scoped page for facility-specific aliases

## Database Context
- Table: `voice_command_aliases` — 709 rows, 12 columns (id, facility_id, milestone_type_id, facility_milestone_id, alias_phrase, source_alias_id, is_active, deleted_at, created_at, updated_at, action_type, auto_learned)
- Table: `milestone_types` — 10 milestone types (patient_in through room_cleaned)
- Table: `facility_milestones` — facility-specific milestone instances
- Table: `voice_command_logs` — 23 rows of voice command usage history
- No local migration exists for voice_command_aliases — needs to be created

## UI/UX
- Route: /settings/voice-commands (facility-scoped)
- Route: /settings/voice-commands/global (global admin only)
- Nav: Operations tab in settings sidebar
- Pattern: Two-column master-detail (follows Procedures page pattern)
- Left column: ~280px wide, search + filter tabs (Milestones / Actions)
- Right column: flexible, grouped sections by action_type

## Files Likely Involved
- `supabase/migrations/` — new migration for voice_command_aliases
- `lib/dal/voice-commands.ts` — new DAL module
- `lib/settings-nav-config.ts` — add nav item to Operations
- `app/settings/voice-commands/page.tsx` — server page
- `app/settings/voice-commands/PageClient.tsx` — main client component
- `app/settings/voice-commands/global/page.tsx` — global admin page
- `app/settings/voice-commands/global/PageClient.tsx` — global admin client

## iOS Parity
- [x] iOS already reads voice_command_aliases — this is the management UI for it

## Known Issues / Constraints
- voice_command_aliases table exists in prod but has no migration file
- Many aliases have facility_id=NULL (global templates) — these are the defaults
- Some aliases appear duplicated across facilities (expected — each facility gets its own copy)
- The `facility_milestone_id` column exists but is mostly NULL — aliases link via `milestone_type_id`

## Out of Scope
- Voice recognition testing/preview in the web UI
- Voice command analytics dashboard
- Auto-learning configuration (the auto_learned flag is set by iOS, not web)
- Bulk import/export of aliases

## Acceptance Criteria
- [ ] Migration formalizes voice_command_aliases table in version control
- [ ] Settings nav shows "Voice Commands" in Operations tab
- [ ] Left column lists milestones (10) and utility actions (5) with filter tabs
- [ ] Selecting an objective shows aliases grouped by action type
- [ ] Users can add new aliases with duplicate detection
- [ ] Users can delete aliases
- [ ] AI-learned aliases show a distinct badge
- [ ] Global admin page manages default templates (facility_id=NULL)
- [ ] Facility page shows facility-specific aliases
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
