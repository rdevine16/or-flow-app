---
description: End the current session cleanly. Commits work, logs state, archives completed projects.
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

## Step 3: Determine Project Status

Read `apps/web/or-flow-app/docs/implementation-plan.md` and check git log to determine if ALL phases are complete.

```bash
git log --oneline --all | head -30
```

Match commit messages to phases. If every phase has a matching commit → **project is complete**, go to Step 4A.
If phases remain → **project is in progress**, go to Step 4B.

---

## Step 4A: Project Complete — Archive & Clean Up

When all phases are done, archive the entire project for historical reference.

### 4A.1: Create the Archive Directory

```bash
mkdir -p apps/web/or-flow-app/docs/completed
```

Generate the archive folder name from the feature branch name and today's date:
```bash
# Example: apps/web/or-flow-app/docs/completed/2026-02-13_facility-admin-dashboard/
BRANCH=$(git branch --show-current | sed 's|feature/||')
DATE=$(date +%Y-%m-%d)
ARCHIVE_DIR="apps/web/or-flow-app/docs/completed/${DATE}_${BRANCH}"
mkdir -p "$ARCHIVE_DIR"
```

### 4A.2: Generate Project Summary

Create a `PROJECT_SUMMARY.md` inside the archive folder. This is the permanent record of what was built:

```markdown
# Project: [Feature Name from active-feature.md title]
**Completed:** [today's date]
**Branch:** [branch name]
**Duration:** [first commit date] → [last commit date]
**Total Phases:** [N]

## What Was Built
[2-3 paragraph summary of the feature — what it does, why it was built, key design decisions]

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | [description] | [short hash] |
| 2     | [description] | [short hash] |
| ...   | ... | ... |

## Key Files Created/Modified
[List the primary files this project touched — new components, new hooks, modified pages, new routes]

## Architecture Decisions
[List any significant decisions made during implementation that future developers should know about — data model choices, component patterns, query strategies, things that were explicitly NOT done and why]

## Database Changes
[List any new tables, columns, views, triggers, migrations, or RPC functions created. Include migration file names.]

## Known Limitations / Future Work
[Anything explicitly deferred, stubbed, or flagged for follow-up]
```

### 4A.3: Archive the Files

```bash
# Copy feature spec and implementation plan into the archive
cp apps/web/or-flow-app/docs/active-feature.md "$ARCHIVE_DIR/active-feature.md"
cp apps/web/or-flow-app/docs/implementation-plan.md "$ARCHIVE_DIR/implementation-plan.md"
# PROJECT_SUMMARY.md was already created in the archive dir
```

### 4A.4: Clean Up for Next Project

Replace `active-feature.md` with a clean template:

```markdown
# Feature: [Title]

## Goal
[One paragraph describing what this feature does and why it matters]

## Requirements
1. [Specific requirement]
2. [Specific requirement]

## Database Context
- Table: `table_name` — relevant columns: col1, col2
- View: `view_name` — how it's used

## UI/UX
- Route: /path
- Key interactions
- Design references

## Files Likely Involved
- `path/to/file.tsx` — description

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait

## Known Issues / Constraints
- [constraint]

## Out of Scope
- [excluded item]

## Acceptance Criteria
- [ ] [criterion]
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
```

Delete the old implementation plan:
```bash
rm apps/web/or-flow-app/docs/implementation-plan.md
```

Commit the archive:
```bash
git add -A
git commit -m "docs: archive completed project - [feature name]"
```

### 4A.5: Print Project Complete Summary

```
## ✅ Project Complete & Archived

**Feature:** [name]
**Branch:** [branch name]
**Archived to:** apps/web/or-flow-app/docs/completed/[archive folder name]/
**Files archived:**
  - PROJECT_SUMMARY.md (generated overview)
  - active-feature.md (original spec)
  - implementation-plan.md (phase breakdown + session logs)

**Workspace cleaned:**
  - apps/web/or-flow-app/docs/active-feature.md → reset to blank template
  - apps/web/or-flow-app/docs/implementation-plan.md → removed

### Next steps:
1. Merge this branch to main:
   git checkout main
   git pull origin main
   git merge [branch name]
   git push origin main
   git branch -d [branch name]

2. Start your next project:
   - Edit apps/web/or-flow-app/docs/active-feature.md with your new feature spec
   - Run /audit to generate the implementation plan

### To undo this session's work:
git revert HEAD
```

Then STOP. Project is done.

---

## Step 4B: Project In Progress — Session Log Only

When phases remain, log the session and prepare for the next one.

### 4B.1: Append Session Log

Add an entry to the bottom of `apps/web/or-flow-app/docs/implementation-plan.md` under the `## Session Log` section:

```markdown
### Session — [date, time]
- **Phase:** [N] — [completed | partial]
- **What was done:** [1-2 sentence summary]
- **Files changed:** [list key files modified/created]
- **Commit:** [short hash]
- **Test results:** [pass/fail summary]
- **If partial — remaining work:** [what's left in this phase]
- **Known issues discovered:** [anything found but not fixed]
- **Context usage:** [approximate — low/medium/high]
```

### 4B.2: Print Session Summary

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
- ✅ Phase 1 — [description]
- ✅ Phase 2 — [description]
- 🔄 Phase 3 — [partial / in progress]
- ⬜ Phase 4 — [pending]
- ⬜ Phase 5 — [pending]
```

Then STOP. Session is over.
