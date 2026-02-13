---
description: Quick targeted fix — skip planning overhead for small changes
argument-hint: <describe the fix needed>
---

This command is for small, well-scoped fixes that don't need a full audit/phase cycle.
Examples: fixing a type error, updating a label, fixing a broken import, small CSS tweaks.

## Step 1: Understand the Fix

Read the user's description: $ARGUMENTS

Identify the file(s) that need to change. If you're unsure which file, search:
```bash
grep -r "searchTerm" app/ components/ lib/ --include="*.tsx" --include="*.ts" -l
```

## Step 2: Make the Fix

Edit the file(s) directly. Keep changes minimal and focused.

## Step 3: Verify

```bash
npx tsc --noEmit 2>&1 | grep -i error | head -10
```

If the fix introduced new errors, resolve them.

## Step 4: Commit

```bash
git add -A
git commit -m "fix: $ARGUMENTS"
```

Report what was changed in 1-2 sentences.
