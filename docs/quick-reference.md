# ORbit Claude Code — Quick Reference

## One-Time Setup

```bash
# Set subagent model (add to your shell profile)
export CLAUDE_CODE_SUBAGENT_MODEL="claude-sonnet-4-5-20250929"
```

## The Flow

```
1. Write apps/web/or-flow-app/docs/active-feature.md   ← your input (the only file you edit)
2. /audit                                               ← scans codebase, interviews you, proposes plan
3. Review & approve plan                                ← branch created automatically
4. /phase-start                                         ← executes Phase 1, tests, commits, STOPS
5. Start new session → /phase-start                     ← executes Phase 2, tests, commits, STOPS
6. Repeat until all phases done
7. Merge feature branch to main
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/audit` | Reads feature spec → parallel codebase scan → interviews you → proposes phased plan → creates branch on approval |
| `/phase-start` | Auto-detects next phase → loads minimal context → implements → 3-stage tests → commits → STOPS |
| `/wrap-up` | Commits work → logs session state → prints resume instructions → STOPS |
| `/fix` | Quick targeted fix (type errors, labels, imports, CSS) — no planning overhead |
| `/migrate` | Database migration with proper naming, RLS policies, rollback instructions |

## Subagents

| Agent | When to Use | What It Does |
|-------|------------|-------------|
| "Use the tester agent to run the 3-stage test gate" | After every phase, before committing | Stage 1: typecheck + lint. Stage 2: test suite. Stage 3: coverage gap analysis (finds untested downstream paths) |
| "Use the reviewer agent to review changes" | Before merging to main | Reviews code against ORbit standards in a fresh context |
| "Use the explorer agent to investigate [topic]" | Understanding existing code | Searches codebase, returns structured summary |

Subagents run on Sonnet (focused tasks). Main session runs on Opus (reasoning + implementation).

## Session Management

| Situation | What to Do |
|-----------|-----------|
| Starting a new feature | Write `apps/web/or-flow-app/docs/active-feature.md` → `/audit` |
| Starting the next phase | New session → `/phase-start` |
| Context getting heavy (~60%) | `/wrap-up` → new session → `/phase-start` |
| Terminal crashed mid-phase | `claude --continue` → say "keep going" |
| Ended session cleanly | New session → `/phase-start` (reads implementation plan automatically) |
| Want to undo a phase | `git revert HEAD` |
| All phases done | `/wrap-up` → merge branch to main |

## Git Safety

```bash
# Undo the last phase (clean single-commit revert)
git revert HEAD

# See what changed in the last phase
git diff HEAD~1

# Check current branch
git branch

# Merge completed feature to main
git checkout main
git pull origin main
git merge feature/[name]
git push origin main

# Delete feature branch after merge
git branch -d feature/[name]
```

## Key Rules

- **One phase per session.** Phase completes → STOP → new session for next phase.
- **No compaction.** If context is heavy, `/wrap-up` and start fresh.
- **active-feature.md is your only input.** Everything else is generated.
- **Every phase gets its own commit.** Makes `git revert HEAD` safe.
- **3-stage testing is mandatory.** Unit → Integration → Workflow.
- **Parallel subagents for independent work.** Sequential for dependent work.

## File Locations

```
apps/web/or-flow-app/docs/active-feature.md       ← YOU write this (feature spec)
apps/web/or-flow-app/docs/implementation-plan.md   ← /audit generates this (phased plan + session logs)
apps/web/or-flow-app/docs/architecture.md          ← Reference (loaded on-demand, not every session)
apps/web/or-flow-app/docs/ios-architecture.md      ← Reference (iOS only)
apps/web/or-flow-app/CLAUDE.md                     ← Web-specific rules
apps/web/or-flow-app/.claude/commands/*.md          ← Workflow commands
apps/web/or-flow-app/.claude/agents/*.md            ← Subagent definitions
CLAUDE.md                                          ← Root routing file (loaded every session)
```
