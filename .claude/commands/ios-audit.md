---
description: Analyze feature spec, interview user, create phased implementation plan for iOS app. Start here for any new iOS feature.
argument-hint: (no arguments needed — reads apps/ios/docs/active-feature.md)
---

## Step 1: Read the Feature Spec

Read `apps/ios/docs/active-feature.md`. Understand the goal, requirements, constraints, and acceptance criteria.

Also read `apps/ios/docs/ios-architecture.md` for current iOS app structure and feature gap matrix.

## Step 2: Parallel Codebase Scan

Spawn parallel subagents to analyze the iOS codebase:

```
Scan the codebase using parallel subagents:
- Subagent 1: Scan apps/ios/ORbit/Features/ and apps/ios/ORbit/Components/ for relevant UI patterns
- Subagent 2: Scan apps/ios/ORbit/Repositories/ and apps/ios/ORbit/Models/ for data layer patterns
- Subagent 3: Scan apps/ios/ORbit/ViewModels/ and apps/ios/ORbit/Core/ for state management and auth patterns
- Subagent 4: Check apps/ios/ORbitTests/ for existing test coverage and patterns
```

**Also check the web app equivalent** if this feature already exists on web:
```
- Subagent 5: Scan apps/web/or-flow-app/ for how this feature is implemented on web (for reference, not direct porting)
```

Each subagent returns a structured summary. Collect and synthesize.

## Step 3: Interview the User

Before proposing any plan, switch to interview mode. Cover these areas (2-3 questions at a time):

**Web Parity Decisions:**
- Does this need to match the web app exactly, or can we take a mobile-native approach?
- Which web features are out of scope for mobile?
- Any mobile-specific interactions (swipe gestures, haptics, pull-to-refresh)?

**Audit Findings:**
- Conflicts or inconsistencies found
- Existing code that might be affected
- Gaps between current state and requirements

**SwiftUI-Specific Decisions:**
- Navigation approach (NavigationStack, sheets, full-screen covers)?
- State management (new ViewModel vs extend existing)?
- Should this use the Repository pattern or is it simple enough for direct queries?
- Offline considerations?

**Design & UX:**
- Use existing Theme tokens or need new ones?
- Dark mode behavior?
- iPad layout considerations?
- Accessibility requirements?

Continue interviewing until all ambiguities are resolved.

## Step 4: Create the Phased Plan

Create `apps/ios/docs/implementation-plan.md` with:

1. **Summary** — what this plan accomplishes
2. **Interview Notes** — key decisions
3. **Web Reference** — how the web app handles this (for context, not direct porting)
4. **Phases** — numbered, ordered, with dependencies

Each phase must include:
- What it does (specific)
- Which files it touches (apps/ios/ORbit/Features/*, apps/ios/ORbit/Repositories/*, etc.)
- What the commit message will be: `feat(ios/scope): phase N - description`
- What the 3-stage test gate should verify
- Estimated complexity (small / medium / large)

## Step 5: Present the Plan

Print the complete plan. Ask:

**"Does this plan look right? Want to change anything before I proceed?"**

Wait for explicit approval.

## Step 6: On Approval — Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/ios-[derived-name]
git add apps/ios/docs/implementation-plan.md
git commit -m "docs: add iOS implementation plan for [feature name]"
```

Tell the user: **"Created branch `feature/ios-[name]`. Run /ios-phase-start to begin Phase 1."**

Then STOP.
