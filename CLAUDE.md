# CLAUDE.md — ORbit Surgical Analytics Platform

## Stack
- **Web:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel
- **iOS:** SwiftUI, MVVM, Repository pattern (at `apps/ios/`, has its own CLAUDE.md)
- **Components:** shadcn/ui, lucide-react icons
- **Auth:** Supabase Auth, middleware.ts, RLS on all tables

## Critical Patterns (violating these causes bugs)
- **Data fetching:** Always use `useSupabaseQuery` from `apps/web/or-flow-app/lib/hooks/useSupabaseQuery.ts`
- **Facility scoping:** Every query must filter by `facility_id` — RLS enforces this
- **Milestones v2.0:** `facility_milestones.facility_milestone_id` is the foreign key everywhere. Never use `milestone_type_id` directly in case_milestones.
- **Soft deletes:** 20 tables use `sync_soft_delete_columns()` — set `is_active = false`, never hard delete
- **Cases table:** Has 8 triggers — test changes carefully
- **Scoring:** MAD-based, not mean-based. 3 MAD bands, volume-weighted, graduated decay. See `apps/web/or-flow-app/docs/architecture.md` for details.
- **Logging:** Use `apps/web/or-flow-app/lib/logger.ts` (structured JSON in prod), never raw `console.log`
- **No `any` types.** TypeScript strict mode.

## Project Structure (all paths from monorepo root)
```
apps/web/or-flow-app/app/                    → Pages (App Router)
apps/web/or-flow-app/components/ui/          → shadcn base components
apps/web/or-flow-app/components/layouts/     → DashboardLayout (sidebar, nav)
apps/web/or-flow-app/lib/dal/               → Data access layer (core.ts, cases.ts, facilities.ts, users.ts, lookups.ts)
apps/web/or-flow-app/lib/hooks/             → useSupabaseQuery, useCurrentUser, useLookups
apps/web/or-flow-app/lib/                   → supabase client, logger, utils
apps/web/or-flow-app/docs/                  → Architecture, feature specs, implementation plans
apps/web/or-flow-app/.claude/commands/      → Workflow commands (/audit, /phase-start, /wrap-up, /fix, /migrate)
apps/web/or-flow-app/.claude/agents/        → Subagents (tester, reviewer, explorer)
```

## Code Quality
- TypeScript strict mode, no `any` types
- Structured logging via `apps/web/or-flow-app/lib/logger.ts` (not raw console.log)
- Commit after completing each phase of work

### 3-Stage Testing Gate (mandatory after every phase)
1. **Unit:** Does the new/changed code work in isolation?
2. **Integration:** Does it work with what CONSUMES it? Always test the downstream path — if you build creation, test what reads/uses the created data. Ask: "What does the user do NEXT with this output?" and test that.
3. **Workflow:** At least one end-to-end scenario: [user action before] → [this feature] → [user action after]
- Run via: `Use the tester agent to run the 3-stage test gate`
- Do not consider a phase complete until all three levels are addressed

## Phase Execution Rules
- **One phase per session.** Complete the phase, run tests, commit, report results, then STOP.
- **Do not auto-continue to the next phase.** Always stop and wait for the user to start a new session.
- **No compaction.** If context is getting heavy, recommend `/wrap-up` instead. The user will start a fresh session and run `/phase-start`.
- **If context exceeds ~60%, tell the user:** "Context is getting heavy. Recommend running /wrap-up and starting a fresh session."

## Git Workflow
- All feature work happens on a feature branch, never directly on main
- Commit after each completed phase with descriptive message: `feat(scope): phase N - description`
- To undo a phase: `git revert HEAD` (each phase is one commit, so this cleanly reverts it)
- Merge to main only when all phases are complete and verified

## Sub-Agent Routing Rules

**Parallel dispatch** (ALL conditions must be met):
- 3+ independent tasks or different file domains
- No shared state or file overlap between tasks
- Clear boundaries (e.g., different pages, different directories)

**Sequential dispatch** (ANY condition triggers):
- Task B needs output from Task A
- Shared files or state (merge conflict risk)
- Unclear scope — need to understand before proceeding

**Background dispatch:**
- Codebase exploration and analysis
- Research tasks where results aren't immediately blocking

**Model routing:**
- Main session: Opus (complex reasoning, coordination, implementation)
- Subagents: Sonnet (focused tasks — scanning, testing, reviewing)
- Set via: `export CLAUDE_CODE_SUBAGENT_MODEL="claude-sonnet-4-6-20250514"`

## Context Loading
- Always read `apps/web/or-flow-app/CLAUDE.md` (this file) at session start
- Read `apps/web/or-flow-app/docs/active-feature.md` when starting feature work
- Read `apps/web/or-flow-app/docs/implementation-plan.md` when resuming phases
- Read `apps/web/or-flow-app/docs/architecture.md` ONLY when the phase involves database work or scoring logic
- Do NOT preload everything — load on demand to preserve context
