---
description: End the current iOS session cleanly. Commits work, logs state, archives completed projects.
argument-hint: (no arguments needed)
---

## Step 1: Run Full 3-Stage Verification

```
Use the tester agent to run the 3-stage test gate on this session's changes
```

If Stage 1 (build) or Stage 2 (tests) have failures from this session, fix them now.
If Stage 3 identifies missing tests, write them before wrapping up.

## Step 2: Commit All Work

If there are uncommitted changes:

**If the current phase is complete:**
```bash
git add -A
git commit -m "feat(ios/scope): phase N - [description]"
```

**If the current phase is partial:**
```bash
git add -A
git commit -m "wip(ios): phase N partial - [what's done, what's remaining]"
```

## Step 3: Determine Project Status

```bash
git log --oneline --all | head -30
```

Match commit messages to phases. All phases done → Step 4A. Phases remain → Step 4B.

---

## Step 4A: Project Complete — Archive & Clean Up

### 4A.1: Create Archive

```bash
mkdir -p apps/ios/docs/completed
BRANCH=$(git branch --show-current | sed 's|feature/||')
DATE=$(date +%Y-%m-%d)
ARCHIVE_DIR="apps/ios/docs/completed/${DATE}_${BRANCH}"
mkdir -p "$ARCHIVE_DIR"
```

### 4A.2: Generate PROJECT_SUMMARY.md

Create `PROJECT_SUMMARY.md` in the archive folder:

```markdown
# Project: [Feature Name]
**Platform:** iOS (SwiftUI)
**Completed:** [date]
**Branch:** [branch]
**Duration:** [first commit] → [last commit]
**Total Phases:** [N]

## What Was Built
[2-3 paragraph summary]

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | [description] | [hash] |

## Key Files Created/Modified
[List primary Swift files]

## Architecture Decisions
[MVVM patterns chosen, Repository design, navigation approach]

## Web Parity Notes
[What matches web app, what diverges and why]

## Known Limitations / Future Work
[Deferred items]
```

### 4A.3: Archive & Clean

```bash
cp apps/ios/docs/active-feature.md "$ARCHIVE_DIR/active-feature.md"
cp apps/ios/docs/implementation-plan.md "$ARCHIVE_DIR/implementation-plan.md"
```

Reset `active-feature.md` to blank template. Remove `implementation-plan.md`.

```bash
rm apps/ios/docs/implementation-plan.md
git add -A
git commit -m "docs: archive completed iOS project - [feature name]"
```

### 4A.4: Print Summary

```
## Project Complete & Archived (iOS)

**Feature:** [name]
**Branch:** [branch]
**Archived to:** apps/ios/docs/completed/[folder]/

### Next steps:
1. Merge: git checkout main && git merge [branch]
2. Start next project: edit apps/ios/docs/active-feature.md → /ios-audit
```

STOP.

---

## Step 4B: Project In Progress — Session Log

### 4B.1: Append Session Log

Add to `apps/ios/docs/implementation-plan.md` under `## Session Log`:

```markdown
### Session — [date, time]
- **Phase:** [N] — [completed | partial]
- **What was done:** [summary]
- **Files changed:** [key Swift files]
- **Commit:** [hash]
- **Test results:** [build + test pass/fail]
- **If partial — remaining:** [what's left]
- **Known issues:** [anything found but not fixed]
```

### 4B.2: Print Summary

```
## Session Complete (iOS)

**Branch:** [branch]
**Last commit:** [hash]
**Phase [N]:** [completed | partial]

### To resume:
1. New session → /ios-phase-start

### Current progress:
- Phase 1 — [description]
- Phase 2 — [in progress]
- Phase 3 — [pending]
```

STOP.
