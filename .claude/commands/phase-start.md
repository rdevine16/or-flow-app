---
description: Execute the next pending phase from the implementation plan. One phase per session — stops after completion.
argument-hint: (no arguments needed — auto-detects next phase from Tasks)
---

## Step 1: Identify the Next Phase

Read `docs/implementation-plan.md`. This is the single source of truth for what phases exist and what each one does.

Then check which phases are already done by reading git history:

```bash
git log --oneline --all | head -20
```

Match commit messages (e.g., `feat(scope): phase 1 - ...`) to phases in the plan. The next phase is the first one without a matching commit.

Also check the Session Log section at the bottom of the implementation plan — it tracks completed and partial phases from `/wrap-up`.

If `docs/implementation-plan.md` doesn't exist, tell the user: **"No implementation plan found. Run /audit first."**

If all phases have matching commits, tell the user: **"All phases complete. Run /wrap-up for final verification, then merge to main."**

## Step 2: Load Minimal Context

Read only what this phase needs:
- `docs/active-feature.md` — the feature spec
- The section in `docs/implementation-plan.md` for the current phase ONLY
- The specific files listed for this phase in the plan

Do NOT read `docs/architecture.md` unless this phase involves database work.
Do NOT read files for future phases.

## Step 3: Verify Clean State

```bash
git status
git diff --stat HEAD
npm run typecheck
```

If there are uncommitted changes from an interrupted session:
- Review what's there
- Either commit as WIP (`git commit -m "wip: phase N partial"`) or stash (`git stash`)
- Then proceed

If typecheck fails on pre-existing errors, note them but don't fix unless they're blocking this phase.

## Step 4: Execute the Phase

Update the Task status to "in_progress" and implement the phase as described in the plan.

Rules:
- Follow all patterns in CLAUDE.md (useSupabaseQuery, facility_id filtering, structured logging, etc.)
- If you encounter something unexpected, STOP and explain before continuing
- Do not modify files outside this phase's scope
- Do not start the next phase under any circumstances

## Step 5: Run the 3-Stage Test Gate

After completing the phase work, delegate to the tester subagent:

```
Use the tester agent to run the 3-stage test gate on this phase's changes
```

The tester runs:
- **Stage 1:** TypeScript compilation + lint (does it build?)
- **Stage 2:** Full test suite (do existing tests still pass?)
- **Stage 3:** Coverage analysis (are there untested downstream paths?)

If Stage 1 or 2 fails:
- Fix type errors and lint issues introduced by this phase
- Fix failing tests caused by this phase's changes
- Do NOT fix pre-existing issues unless they're directly blocking

If Stage 3 identifies gaps:
- Write the missing unit tests for changed code
- Write integration tests for downstream consumers (what READS the data you created/changed?)
- Write at least one workflow test that covers: [user action before] → [this feature] → [user action after]
- The draft→case lesson: always test the NEXT step in the user's journey, not just the step you built

## Step 6: Commit

```bash
git add -A
git commit -m "feat(scope): phase N - [description from plan]"
```

Use the commit message specified in the implementation plan for this phase.

## Step 7: Report and STOP

Mark the Task as "completed." Then report:

```
## Phase [N] Complete

**What was done:** [1-2 sentence summary]
**Files changed:** [list]
**Commit:** [hash]

### Test Results
- Stage 1 (compile/lint): ✅ PASS
- Stage 2 (test suite): ✅ X/Y passing
- Stage 3 (coverage): ✅ All gaps addressed / ⚠️ [any notes]

**Next phase:** Phase [N+1] — [one-line description]
**To continue:** Start a new session and run /phase-start
**To undo this phase:** git revert HEAD
```

**STOP HERE. Do not start the next phase. Do not ask if the user wants to continue.**

The user will start a fresh session and run `/phase-start` to pick up the next phase. This ensures a clean context window for every phase.
