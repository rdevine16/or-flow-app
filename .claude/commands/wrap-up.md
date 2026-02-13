---
description: End the current session cleanly. Commits work, logs state, prepares for next session.
argument-hint: (no arguments needed)
---

## Step 1: Run Full 3-Stage Verification

Use the tester subagent to run the complete 3-stage test gate:

```
Use the tester agent to run the 3-stage test gate on this session's changes
```

If Stage 1 (compilation/lint) or Stage 2 (test suite) has failures introduced by this session's work, fix them now.

If Stage 3 (coverage analysis) identifies missing tests:
- Write any missing unit tests before wrapping up
- Write integration tests for downstream consumers
- At minimum, ensure every changed file has unit coverage
- Flag any missing workflow tests in the session log for the next session to address

## Step 2: Commit All Work

If there are uncommitted changes:

**If the current phase is complete:**
```bash
git add -A
git commit -m "feat(scope): phase N - [description]"
```

**If the current phase is partial (interrupted mid-work):**
```bash
git add -A
git commit -m "wip: phase N partial - [what's done, what's remaining]"
```

## Step 3: Update Implementation Plan

Append a session log entry to `docs/implementation-plan.md`:

```markdown
---
## Session Log — [date]
- **Phase:** [N] — [status: completed | partial]
- **What was done:** [brief summary]
- **Files changed:** [list key files]
- **Commit:** [hash]
- **Test results:** [pass/fail summary]
- **If partial — remaining work:** [what's left to do in this phase]
- **Known issues discovered:** [anything found but not fixed]
- **Next action:** Start new session, run /phase-start
```

## Step 4: Print Session Summary

```
## Session Complete

**Branch:** [current branch name]
**Last commit:** [hash]
**Phase [N]:** [completed | partial]
**Tests:** [pass/fail]

### To resume:
1. Open a new Claude Code session
2. Run /phase-start

### To undo this session's work:
git revert HEAD

### Current progress:
- ✅ Phase 1 — [done]
- ✅ Phase 2 — [done]
- 🔄 Phase 3 — [partial / next up]
- ⬜ Phase 4 — [pending]
```

Then STOP. Session is over.
