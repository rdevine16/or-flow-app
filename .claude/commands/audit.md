---
description: Analyze feature spec, interview user, create phased implementation plan. Start here for any new feature.
argument-hint: (no arguments needed — reads docs/active-feature.md)
---

## Step 1: Read the Feature Spec

Read `docs/active-feature.md`. Understand the goal, requirements, constraints, and acceptance criteria.

## Step 2: Parallel Codebase Scan

Spawn parallel subagents to analyze the codebase from different angles simultaneously. Each subagent should focus on a specific domain to avoid overlap:

```
Scan the codebase using parallel subagents:
- Subagent 1: Scan all files in app/ for [relevant patterns based on feature spec]
- Subagent 2: Scan all files in components/ for [relevant patterns]
- Subagent 3: Analyze configuration files and shared utilities in lib/ for [relevant patterns]
- Subagent 4: Check for related test coverage and existing patterns
```

Each subagent returns a structured summary. Collect and synthesize their findings.

## Step 3: Interview the User

Before proposing any plan, switch to interview mode. Use the ask tool to interview the user about everything discovered during the scan and anything ambiguous in the feature spec.

Cover these areas across multiple rounds (2-3 questions at a time):

**Audit Findings:**
- Conflicts or inconsistencies found — which pattern should win?
- Existing code that might be affected — is that intentional?
- Gaps between current state and the feature requirements

**Design Decisions:**
- Ambiguous requirements — what does the user actually want?
- Multiple valid approaches — which tradeoff does the user prefer?
- Visual/UX preferences that can't be inferred from the spec

**Technical Tradeoffs:**
- Performance vs complexity choices
- Scope boundaries — what's close to the line of "out of scope"?
- Existing code quality issues discovered — fix now or ignore?

**Workflow & User Context:**
- How do real users (nurses, coordinators, surgeons, admins) interact with this feature?
- Edge cases specific to surgical workflows
- Priority ordering if the feature is large

Continue interviewing until all ambiguities are resolved. Document answers as you go.

## Step 4: Create the Phased Plan

Based on the feature spec, codebase analysis, and interview answers, create `docs/implementation-plan.md` with:

1. **Summary** — what this plan accomplishes
2. **Interview Notes** — key decisions from the user interview
3. **Phases** — numbered, ordered, with dependencies noted

Each phase must include:
- What it does (specific, not vague)
- Which files it touches
- What the commit message will be
- What the 3-stage test gate should verify
- Estimated complexity (small / medium / large)

Also create Tasks (one per phase) with proper dependencies so `/phase-start` can auto-detect the next phase.

## Step 5: Present the Plan

Print the complete plan to the terminal. List every phase with a one-line summary. Then ask:

**"Does this plan look right? Want to change anything before I proceed?"**

Wait for explicit approval. If the user wants changes, revise and re-present.

## Step 6: On Approval — Create Feature Branch

Once the user approves the plan:

1. Derive a branch name from the feature spec title (e.g., `feature/design-system-cleanup`)
2. Create the branch from main:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/[derived-name]
   ```
3. Commit the implementation plan:
   ```bash
   git add docs/implementation-plan.md
   git commit -m "docs: add implementation plan for [feature name]"
   ```
4. Tell the user: **"Created branch `feature/[name]`. Run /phase-start to begin Phase 1."**

Then STOP. Do not begin Phase 1.
