---
description: Execute the next pending phase from the iOS implementation plan. One phase per session — stops after completion.
argument-hint: (no arguments needed — auto-detects next phase from implementation plan)
---

## Step 1: Identify the Next Phase

Read `apps/ios/docs/implementation-plan.md`. Check which phases are done:

```bash
git log --oneline --all | head -20
```

Match commit messages (e.g., `feat(ios/scope): phase 1 - ...`) to phases in the plan. Also check the Session Log section.

If `apps/ios/docs/implementation-plan.md` doesn't exist: **"No implementation plan found. Run /ios-audit first."**
If all phases complete: **"All phases complete. Run /ios-wrap-up for final verification, then merge to main."**

## Step 2: Load Minimal Context

Read only what this phase needs:
- `apps/ios/docs/active-feature.md` — the feature spec
- The section in `apps/ios/docs/implementation-plan.md` for the current phase ONLY
- The specific files listed for this phase
- `apps/ios/docs/ios-architecture.md` if this phase involves new Views/ViewModels

Do NOT read `apps/web/or-flow-app/docs/architecture.md` unless this phase involves database or scoring logic.
Do NOT read files for future phases.

## Step 3: Verify Clean State

```bash
git status
git diff --stat HEAD
cd apps/ios && xcodebuild -project ORbit.xcodeproj -scheme ORbit -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | grep -E '(error:|BUILD)'
```

If there are uncommitted changes from an interrupted session:
- Review what's there
- Either commit as WIP or stash
- Then proceed

## Step 4: Execute the Phase

Implement the phase as described in the plan.

Rules:
- Follow all patterns in CLAUDE.md (MVVM, Repository boundary, Theme tokens, facility scoping, etc.)
- Views are pure UI — no Supabase queries, no PostgREST imports
- ViewModels are `@MainActor` with `@Published` properties
- Repositories are stateless, contain ALL Supabase queries
- New Models must be `Codable` with `CodingKeys` for snake_case mapping
- If you encounter something unexpected, STOP and explain
- Do not modify files outside this phase's scope
- Do not start the next phase

## Step 5: Run the 3-Stage Test Gate

Delegate to the tester subagent:

```
Use the tester agent to run the 3-stage test gate on this phase's changes
```

If Stage 1 (build) fails:
- Fix compiler errors introduced by this phase

If Stage 2 (tests) fails:
- Fix failing tests caused by this phase's changes

If Stage 3 identifies gaps:
- Write missing unit tests (XCTest)
- Write integration tests for downstream consumers
- Verify architecture boundary compliance

## Step 6: Commit

```bash
git add -A
git commit -m "feat(ios/scope): phase N - [description from plan]"
```

## Step 7: Report and STOP

```
## Phase [N] Complete (iOS)

**What was done:** [1-2 sentence summary]
**Files changed:** [list]
**Commit:** [hash]

### Test Results
- Stage 1 (build): ✅ BUILD SUCCEEDED
- Stage 2 (test suite): ✅ X/Y passing
- Stage 3 (coverage): ✅ All gaps addressed / ⚠️ [notes]

**Next phase:** Phase [N+1] — [one-line description]
**To continue:** Start a new session and run /ios-phase-start
**To undo this phase:** git revert HEAD
```

**STOP HERE. Do not start the next phase.**
