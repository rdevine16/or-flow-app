---
description: Create a database migration for the described change
argument-hint: <describe the schema change needed>
---

## Step 1: Understand the Change

Read the user's description: $ARGUMENTS

If the change involves tables referenced in the analytics pipeline or trigger system,
read `apps/web/or-flow-app/docs/architecture.md` sections 2 (Trigger System) and 3 (Stats Pipeline) first.

## Step 2: Check Current Schema

Look at existing migrations to understand the current state:
```bash
ls -la apps/web/or-flow-app/supabase/migrations/ | tail -20
```

If relevant, read the most recent migration that touches the same tables.

## Step 3: Generate Migration

Create the migration file with proper naming:
```bash
# Format: YYYYMMDDHHMMSS_description.sql
TIMESTAMP=$(date +%Y%m%d%H%M%S)
```

Write the SQL to `apps/web/or-flow-app/supabase/migrations/${TIMESTAMP}_description.sql`

Follow these rules:
- Wrap in `BEGIN; ... COMMIT;` for transactional safety
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent operations
- Add comments explaining WHY, not just what
- Include rollback instructions in a comment block at the top
- Add indexes for any new foreign keys
- Add RLS policies for any new tables
- Check if soft-delete trigger needs to be applied (`sync_soft_delete_columns`)

## Step 4: Verify

Read the migration back and check for:
- Correct foreign key references
- Missing indexes on FK columns
- Missing RLS policies
- Conflicts with the 8 triggers on the `cases` table (if touching cases)
- Proper handling of the `facility_milestone_id` pattern (not `milestone_type_id`)

## Step 5: Report

Show the migration file path and a summary of what it does.

Remind the user: "Apply this with `supabase db push` or paste into the Supabase SQL Editor. Test locally first if using Supabase CLI."
