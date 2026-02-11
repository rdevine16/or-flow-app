# Phase 2: useSupabaseQuery Migration — Batch 1

## What Changed

### 1. `app/profile/page.tsx` — useSupabaseQuery migration
**Before (15 lines of boilerplate):**
```tsx
const [profile, setProfile] = useState<UserProfile | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  async function fetchProfile() {
    // ... 20 lines of try/catch/finally ...
    setProfile(data)
    setLoading(false)
  }
  fetchProfile()
}, [supabase, router])
```

**After (1 hook call):**
```tsx
const { data: profile, loading, error, refetch } = useSupabaseQuery<UserProfile>(
  async (sb) => {
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return { data: null, error: null } }
    return await sb.from('users').select(`*, facility:facilities(name), user_roles(name)`)
      .eq('id', user.id).single()
  },
  []
)
```

**Benefits:**
- Eliminated 3 useState declarations + 1 useEffect
- Automatic abort on unmount (prevents state updates on unmounted components)
- `refetch()` replaces manual re-fetch after save (no more stale local state)
- Type-safe error handling via PostgrestError

### 2. `app/settings/delay-types/page.tsx` — useSupabaseList migration
**Before:**
```tsx
const [delayTypes, setDelayTypes] = useState<DelayType[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  if (isGlobalAdmin) fetchData()
}, [isGlobalAdmin])

const fetchData = async () => { ... setDelayTypes(data || []) ... setLoading(false) ... }
```

**After:**
```tsx
const { data: delayTypes, loading, error, refetch } = useSupabaseList<DelayType>(
  async (sb) => {
    const { data, error } = await sb.from('delay_types').select('*')
      .is('facility_id', null).order('display_order')
    return { data: data || [], error }
  },
  [isGlobalAdmin],
  { enabled: isGlobalAdmin }
)
```

**Benefits:**
- `enabled` option replaces the `if (isGlobalAdmin)` guard in useEffect
- Returns `[]` instead of `null` while loading (no null checks in render)
- After CRUD operations, `refetch()` replaces manual array manipulation
- Removed redundant `useEffect` for admin redirect (now inline check)

### 3. `hooks/index.ts` — Updated barrel exports
Added `useSupabaseQuery`, `useSupabaseList`, `useSupabaseQueries` to barrel exports so pages can import from `@/hooks` directly.

## Files Included
```
app/profile/page.tsx          — migrated to useSupabaseQuery
app/settings/delay-types/page.tsx — migrated to useSupabaseList  
hooks/index.ts                — added useSupabaseQuery exports
```

## How to Apply
```bash
cp -R ~/Downloads/phase2-batch1/* .
npm run build
```

## Migration Pattern Reference

### For single-record fetches:
```tsx
const { data, loading, error, refetch } = useSupabaseQuery<MyType>(
  async (sb) => sb.from('table').select('*').eq('id', id).single(),
  [id]
)
```

### For list fetches:
```tsx
const { data, loading, error, refetch } = useSupabaseList<MyType>(
  async (sb) => {
    const { data, error } = await sb.from('table').select('*').order('name')
    return { data: data || [], error }
  },
  [dependency],
  { enabled: !!dependency }
)
```

### For parallel queries:
```tsx
const { data, loading, errors, refetch } = useSupabaseQueries({
  users: async (sb) => sb.from('users').select('*'),
  rooms: async (sb) => sb.from('rooms').select('*'),
}, [facilityId])
```

## Next Migration Candidates (by complexity)
1. `app/settings/implant-companies/page.tsx` (458 lines, same CRUD pattern)
2. `app/settings/flags/page.tsx` (487 lines, same CRUD pattern)
3. `app/settings/procedures/page.tsx` (874 lines, more queries)
4. `app/settings/rooms/page.tsx` (694 lines, 8 queries → useSupabaseQueries)
5. `app/settings/general/page.tsx` (694 lines, 6 queries → useSupabaseQueries)
