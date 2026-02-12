# Migration Guide: Adopting the Data Access Layer & useSupabaseQuery

## Overview

Two powerful abstractions exist but have zero adoption:
- **`lib/dal/`** — Centralized data access layer (cases, users, facilities, lookups)
- **`hooks/useSupabaseQuery`** — Eliminates duplicated loading/error/data boilerplate

This guide shows how to incrementally migrate pages from the old pattern to the new one.

---

## The Old Pattern (76 pages)

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const [data, setData] = useState<ProcedureType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('procedure_types')
        .select('*')
        .eq('facility_id', facilityId)
        .order('name')

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setData(data ?? [])
      setLoading(false)
    }
    if (facilityId) fetchData()
  }, [facilityId])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} />

  return <div>...</div>
}
```

**Problems:** 15+ lines of boilerplate per query, inconsistent error handling, no abort on unmount, no typed results.

---

## The New Pattern

### Option A: useSupabaseQuery (simplest migration)

```tsx
'use client'
import { createClient } from '@/lib/supabase'
import { useSupabaseQueryList } from '@/hooks/useSupabaseQuery'

export default function SettingsPage() {
  const supabase = createClient()

  const { data, loading, error, refetch } = useSupabaseQueryList(
    () => supabase
      .from('procedure_types')
      .select('*')
      .eq('facility_id', facilityId)
      .order('name'),
    [facilityId]  // Re-fetches when facilityId changes
    // Automatically skips when facilityId is null/undefined
  )

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} />

  return <div>...</div>
}
```

**Wins:** 15 lines → 5 lines, automatic null-dep skipping, abort on unmount, typed.

### Option B: DAL + useSupabaseQuery (best for shared queries)

```tsx
'use client'
import { createClient } from '@/lib/supabase'
import { useSupabaseQueryList } from '@/hooks/useSupabaseQuery'
import { lookups } from '@/lib/dal'

export default function SettingsPage() {
  const supabase = createClient()

  const { data, loading, error } = useSupabaseQueryList(
    () => lookups.procedureTypes(supabase, facilityId!),
    [facilityId]
  )
  // ...
}
```

**Wins:** Centralized query logic, single source of truth for "how do we fetch procedure types."

---

## Migration Steps

### Step 1: Pick a page
Start with simple pages that have 1-3 queries. Good candidates:
- `app/profile/page.tsx` (2 queries)
- `app/cases/page.tsx` (3 queries)
- `app/settings/closures/page.tsx` (2 queries)

### Step 2: Identify the fetch pattern
Look for:
```tsx
const [data, setData] = useState(...)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  const fetch = async () => { ... }
  fetch()
}, [deps])
```

### Step 3: Replace with useSupabaseQuery
```tsx
// Before
const [rooms, setRooms] = useState<Room[]>([])
const [roomsLoading, setRoomsLoading] = useState(true)
const [roomsError, setRoomsError] = useState<string | null>(null)

useEffect(() => {
  const fetch = async () => {
    setRoomsLoading(true)
    const { data, error } = await supabase.from('or_rooms').select('*').eq('facility_id', fid)
    if (error) { setRoomsError(error.message); return }
    setRooms(data ?? [])
    setRoomsLoading(false)
  }
  if (fid) fetch()
}, [fid])

// After
const { data: rooms, loading: roomsLoading, error: roomsError } = useSupabaseQueryList(
  () => supabase.from('or_rooms').select('*').eq('facility_id', fid).order('display_order'),
  [fid]
)
```

### Step 4: Extract repeated queries to DAL
If you find yourself writing the same query in 3+ pages, add it to the DAL:

```ts
// lib/dal/rooms.ts
export async function listByFacility(supabase: SupabaseParam, facilityId: string) {
  return query('rooms.listByFacility', () =>
    supabase.from('or_rooms').select('*').eq('facility_id', facilityId).order('display_order')
  )
}
```

---

## Multiple Queries on One Page

```tsx
const supabase = createClient()

const { data: cases, loading: casesLoading } = useSupabaseQueryList(
  () => supabase.from('cases').select('*').eq('facility_id', fid).eq('scheduled_date', date),
  [fid, date]
)

const { data: rooms, loading: roomsLoading } = useSupabaseQueryList(
  () => supabase.from('or_rooms').select('*').eq('facility_id', fid),
  [fid]
)

const { data: surgeons, loading: surgeonsLoading } = useSupabaseQueryList(
  () => supabase.from('users').select('*').eq('facility_id', fid).eq('role', 'surgeon'),
  [fid]
)

const loading = casesLoading || roomsLoading || surgeonsLoading
```

---

## Conditional Queries

```tsx
// Only fetch when a case is selected
const { data: milestones } = useSupabaseQueryList(
  () => supabase.from('case_milestones').select('*').eq('case_id', selectedCaseId!),
  [selectedCaseId],
  { enabled: !!selectedCaseId }
)
```

---

## Priority Migration Order

1. **Dashboard** (`app/dashboard/page.tsx`) — Most-used page
2. **Cases list** (`app/cases/page.tsx`) — Core workflow
3. **Analytics pages** (`app/analytics/*.tsx`) — Many shared queries
4. **Settings pages** (`app/settings/*.tsx`) — Simple, good practice targets
5. **Admin pages** (`app/admin/*.tsx`) — Lower priority, internal

---

## Adding to the DAL

When adding new DAL functions, follow this pattern:

```ts
// lib/dal/[entity].ts
import { query, mutate, type SupabaseParam, type DalResult } from './core'

export async function listByFacility(
  supabase: SupabaseParam,
  facilityId: string
): Promise<DalResult<EntityRow[]>> {
  return query('entity.listByFacility', () =>
    supabase
      .from('table_name')
      .select('*')
      .eq('facility_id', facilityId)
      .order('name')
  )
}
```

Key rules:
- Always accept `supabase` as first param (works with both client and server clients)
- Always wrap with `query()` or `mutate()` from core
- Name the operation descriptively (appears in error logs)
- Return typed `DalResult<T>`
