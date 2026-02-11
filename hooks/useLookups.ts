// hooks/useLookups.ts
// Reusable hooks for common lookup data (procedure types, rooms, delay types, etc.)

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

const log = logger('useLookups')

// ============================================
// Types
// ============================================

interface UseLookupOptions {
  facilityId: string | null | undefined
  includeGlobal?: boolean
  includeDeleted?: boolean
  orderBy?: string
  enabled?: boolean
}

interface UseLookupReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// ============================================
// Generic Lookup Hook
// ============================================

function useLookup<T>(
  tableName: string,
  options: UseLookupOptions,
  selectFields = 'id, name'
): UseLookupReturn<T> {
  const { 
    facilityId, 
    includeGlobal = false, 
    includeDeleted = false,
    orderBy = 'name',
    enabled = true 
  } = options

  const supabase = createClient()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled || !facilityId) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from(tableName)
        .select(selectFields)

      if (includeGlobal) {
        query = query.or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      } else {
        query = query.eq('facility_id', facilityId)
      }

      if (!includeDeleted) {
        query = query.is('deleted_at', null)
      }

      if (orderBy) {
        query = query.order(orderBy)
      }

      const { data: result, error: fetchError } = await query

      if (fetchError) throw fetchError
      setData((result || []) as T[])
    } catch (err) {
      log.error(`Error fetching ${tableName}:`, err)
      setError(`Failed to load ${tableName}`)
    } finally {
      setLoading(false)
    }
  }, [facilityId, enabled, tableName, selectFields, includeGlobal, includeDeleted, orderBy, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

// ============================================
// Specialized Hooks
// ============================================

export interface ProcedureType {
  id: string
  name: string
  body_region_id?: string
  procedure_category_id?: string
  expected_duration?: number
}

export function useProcedureTypes(facilityId: string | null | undefined) {
  return useLookup<ProcedureType>(
    'procedure_types',
    { facilityId, includeGlobal: true },
    'id, name, body_region_id, procedure_category_id'
  )
}

export interface Room {
  id: string
  name: string
  display_order?: number
}

export function useRooms(facilityId: string | null | undefined) {
  return useLookup<Room>(
    'or_rooms',
    { facilityId, orderBy: 'display_order' },
    'id, name, display_order'
  )
}

export interface DelayType {
  id: string
  name: string
  category?: string
}

export function useDelayTypes(facilityId: string | null | undefined) {
  return useLookup<DelayType>(
    'delay_types',
    { facilityId, includeGlobal: true },
    'id, name, category'
  )
}

export interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
}

export function useImplantCompanies(facilityId: string | null | undefined) {
  return useLookup<ImplantCompany>(
    'implant_companies',
    { facilityId, includeGlobal: true },
    'id, name, facility_id'
  )
}

export interface Surgeon {
  id: string
  first_name: string
  last_name: string
  email?: string
}

export function useSurgeons(facilityId: string | null | undefined) {
  const supabase = createClient()
  const [data, setData] = useState<Surgeon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!facilityId) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()

      if (!roleData) {
        setData([])
        setLoading(false)
        return
      }

      const { data: surgeons, error: fetchError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('facility_id', facilityId)
        .eq('role_id', roleData.id)
        .eq('is_active', true)
        .order('last_name')

      if (fetchError) throw fetchError
      setData((surgeons || []) as Surgeon[])
    } catch (err) {
      log.error('Error fetching surgeons:', err)
      setError('Failed to load surgeons')
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

export interface Payer {
  id: string
  name: string
}

export function usePayers(facilityId: string | null | undefined) {
  return useLookup<Payer>(
    'payers',
    { facilityId },
    'id, name'
  )
}

export interface CancellationReason {
  id: string
  name: string
  category?: string
}

export function useCancellationReasons(facilityId: string | null | undefined) {
  return useLookup<CancellationReason>(
    'cancellation_reasons',
    { facilityId, includeGlobal: true },
    'id, name, category'
  )
}

// ============================================
// Global Lookups (no facility filter)
// ============================================

function useGlobalLookup<T>(
  tableName: string,
  selectFields = 'id, name',
  orderBy = 'name'
): UseLookupReturn<T> {
  const supabase = createClient()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: result, error: fetchError } = await supabase
        .from(tableName)
        .select(selectFields)
        .order(orderBy)

      if (fetchError) throw fetchError
      setData((result || []) as T[])
    } catch (err) {
      log.error(`Error fetching ${tableName}:`, err)
      setError(`Failed to load ${tableName}`)
    } finally {
      setLoading(false)
    }
  }, [tableName, selectFields, orderBy, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

export interface CaseStatus {
  id: string
  name: string
  display_order: number
}

export function useCaseStatuses() {
  return useGlobalLookup<CaseStatus>(
    'case_statuses',
    'id, name, display_order',
    'display_order'
  )
}

export interface UserRole {
  id: string
  name: string
}

export function useUserRoles() {
  return useGlobalLookup<UserRole>('user_roles', 'id, name', 'name')
}

export interface BodyRegion {
  id: string
  name: string
  display_order?: number
}

export function useBodyRegions() {
  return useGlobalLookup<BodyRegion>(
    'body_regions',
    'id, name, display_order',
    'display_order'
  )
}

export interface ProcedureCategory {
  id: string
  name: string
  body_region_id?: string
}

export function useProcedureCategories() {
  return useGlobalLookup<ProcedureCategory>(
    'procedure_categories',
    'id, name, body_region_id',
    'name'
  )
}
