---
description: Quick targeted fix for iOS — skip planning overhead for small changes
argument-hint: <describe the fix needed>
---

This command is for small, well-scoped iOS fixes that don't need a full audit/phase cycle.
Examples: fixing a compiler error, updating a label, fixing a broken import, Theme token update, fixing a model CodingKey.

## Step 1: Understand the Fix

Read the user's description: $ARGUMENTS

Identify the file(s) that need to change. If unsure:
```bash
cd apps/ios
grep -rn "searchTerm" ORbit/ --include="*.swift" -l
```

## Step 2: Make the Fix

Edit the file(s) directly. Keep changes minimal and focused.

## Step 3: Verify

```bash
cd apps/ios
xcodebuild -project ORbit.xcodeproj -scheme ORbit -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | grep -E '(error:|BUILD)'
```

If the fix introduced new errors, resolve them.

## Step 4: Commit

```bash
git add -A
git commit -m "fix(ios): $ARGUMENTS"
```

Report what was changed in 1-2 sentences.
