// hooks/useFacilityClosures.ts

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { facilityHolidayAudit, facilityClosureAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { getLocalDateString } from '@/lib/date-utils'

const log = logger('useFacilityClosures')
import {
  FacilityHoliday,
  FacilityClosure,
  CreateHolidayInput,
  CreateClosureInput,
  getHolidayDateDescription,
} from '@/types/block-scheduling'

/** Rich closure info for a specific date */
export interface DateClosureInfo {
  /** true for full-day closure (full holiday or one-off closure) */
  isClosed: boolean
  /** true for a partial holiday (facility closes early) */
  isPartialHoliday: boolean
  /** Holiday name, if the date matches a holiday */
  holidayName: string | null
  /** Reason text for one-off closures */
  closureReason: string | null
  /** Close time for partial holidays, e.g. "12:00:00" */
  partialCloseTime: string | null
}

interface UseFacilityClosuresOptions {
  facilityId: string | null
}

export function useFacilityClosures({ facilityId }: UseFacilityClosuresOptions) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<FacilityHoliday[]>([])
  const [closures, setClosures] = useState<FacilityClosure[]>([])

  // =====================================================
  // HOLIDAYS
  // =====================================================

  const fetchHolidays = useCallback(async () => {
    if (!facilityId) return []

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('facility_holidays')
        .select('*')
        .eq('facility_id', facilityId)
        .order('month')
        .order('day')

      if (fetchError) throw fetchError

      setHolidays(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch holidays'
      setError(message)
      log.error('Failed to fetch holidays', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  const createHoliday = useCallback(
    async (input: CreateHolidayInput): Promise<FacilityHoliday | null> => {
      if (!facilityId) return null

      setLoading(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('facility_holidays')
          .insert({
            facility_id: facilityId,
            ...input,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Audit log
        const dateDescription = getHolidayDateDescription(data)
        await facilityHolidayAudit.created(
          supabase,
          data.id,
          input.name,
          dateDescription,
          facilityId
        )

        // Update local state
        setHolidays(prev => [...prev, data].sort((a, b) => a.month - b.month))

        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create holiday'
        setError(message)
        log.error('Failed to create holiday', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  const updateHoliday = useCallback(
    async (
      holidayId: string,
      input: Partial<CreateHolidayInput>,
      oldHoliday: FacilityHoliday
    ): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { data, error: updateError } = await supabase
          .from('facility_holidays')
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq('id', holidayId)
          .select()
          .single()

        if (updateError) throw updateError

        // Audit log
        const oldDescription = getHolidayDateDescription(oldHoliday)
        const newDescription = getHolidayDateDescription(data)
        await facilityHolidayAudit.updated(
          supabase,
          holidayId,
          data.name,
          { name: oldHoliday.name, date_rule: oldDescription },
          { name: data.name, date_rule: newDescription },
          facilityId
        )

        // Update local state
        setHolidays(prev =>
          prev.map(h => (h.id === holidayId ? data : h)).sort((a, b) => a.month - b.month)
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update holiday'
        setError(message)
        log.error('Failed to update holiday', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  const deleteHoliday = useCallback(
    async (holidayId: string, holidayName: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('facility_holidays')
          .delete()
          .eq('id', holidayId)

        if (deleteError) throw deleteError

        await facilityHolidayAudit.deleted(supabase, holidayId, holidayName, facilityId)

        // Update local state
        setHolidays(prev => prev.filter(h => h.id !== holidayId))

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete holiday'
        setError(message)
        log.error('Failed to delete holiday', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  const toggleHoliday = useCallback(
    async (holidayId: string, holidayName: string, isActive: boolean): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: updateError } = await supabase
          .from('facility_holidays')
          .update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', holidayId)

        if (updateError) throw updateError

        await facilityHolidayAudit.toggled(supabase, holidayId, holidayName, isActive, facilityId)

        // Update local state
        setHolidays(prev =>
          prev.map(h => (h.id === holidayId ? { ...h, is_active: isActive } : h))
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle holiday'
        setError(message)
        log.error('Failed to toggle holiday', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =====================================================
  // ONE-OFF CLOSURES
  // =====================================================

  const fetchClosures = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!facilityId) return []

      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('facility_closures')
          .select('*')
          .eq('facility_id', facilityId)
          .order('closure_date')

        if (startDate) {
          query = query.gte('closure_date', startDate)
        }
        if (endDate) {
          query = query.lte('closure_date', endDate)
        }

        const { data, error: fetchError } = await query

        if (fetchError) throw fetchError

        setClosures(data || [])
        return data || []
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch closures'
        setError(message)
        log.error('Failed to fetch closures', err)
        return []
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  const createClosure = useCallback(
    async (input: CreateClosureInput): Promise<FacilityClosure | null> => {
      if (!facilityId) return null

      setLoading(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('facility_closures')
          .insert({
            facility_id: facilityId,
            ...input,
          })
          .select()
          .single()

        if (insertError) throw insertError

        await facilityClosureAudit.created(
          supabase,
          data.id,
          input.closure_date,
          input.reason || null,
          facilityId
        )

        // Update local state
        setClosures(prev =>
          [...prev, data].sort(
            (a, b) => new Date(a.closure_date).getTime() - new Date(b.closure_date).getTime()
          )
        )

        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create closure'
        setError(message)
        log.error('Failed to create closure', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  const deleteClosure = useCallback(
    async (closureId: string, closureDate: string): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('facility_closures')
          .delete()
          .eq('id', closureId)

        if (deleteError) throw deleteError

        await facilityClosureAudit.deleted(supabase, closureId, closureDate, facilityId)

        // Update local state
        setClosures(prev => prev.filter(c => c.id !== closureId))

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete closure'
        setError(message)
        log.error('Failed to delete closure', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // =====================================================
  // UTILITY: Check if date is closed
  // =====================================================

  /** Find the matching holiday for a given date, if any */
  const findMatchingHoliday = useCallback(
    (date: Date): FacilityHoliday | null => {
      const month = date.getMonth() + 1
      const day = date.getDate()
      const dow = date.getDay()
      const weekOfMonth = Math.ceil(day / 7)

      const nextWeek = new Date(date)
      nextWeek.setDate(nextWeek.getDate() + 7)
      const isLastOfMonth = nextWeek.getMonth() !== date.getMonth()

      return holidays.find(h => {
        if (!h.is_active) return false
        if (h.month !== month) return false

        // Fixed date
        if (h.day !== null) {
          return h.day === day
        }

        // Dynamic date
        if (h.week_of_month !== null && h.day_of_week !== null) {
          if (h.day_of_week !== dow) return false
          if (h.week_of_month === 5) return isLastOfMonth
          return h.week_of_month === weekOfMonth
        }

        return false
      }) ?? null
    },
    [holidays]
  )

  /** Returns true only for FULL closures (one-off closures or non-partial holidays) */
  const isDateClosed = useCallback(
    (date: Date): boolean => {
      const dateStr = getLocalDateString(date)

      // Check one-off closures
      if (closures.some(c => c.closure_date === dateStr)) {
        return true
      }

      // Check holidays — only full-day holidays count as "closed"
      const holiday = findMatchingHoliday(date)
      if (holiday && !holiday.is_partial) {
        return true
      }

      return false
    },
    [closures, findMatchingHoliday]
  )

  /** Rich closure info including holiday name, partial status, and close time */
  const getDateClosureInfo = useCallback(
    (date: Date): DateClosureInfo => {
      const dateStr = getLocalDateString(date)

      // Check one-off closures first
      const closure = closures.find(c => c.closure_date === dateStr)
      if (closure) {
        return {
          isClosed: true,
          isPartialHoliday: false,
          holidayName: null,
          closureReason: closure.reason ?? null,
          partialCloseTime: null,
        }
      }

      // Check holidays
      const holiday = findMatchingHoliday(date)
      if (holiday) {
        return {
          isClosed: !holiday.is_partial,
          isPartialHoliday: holiday.is_partial,
          holidayName: holiday.name,
          closureReason: null,
          partialCloseTime: holiday.is_partial ? (holiday.partial_close_time ?? null) : null,
        }
      }

      return {
        isClosed: false,
        isPartialHoliday: false,
        holidayName: null,
        closureReason: null,
        partialCloseTime: null,
      }
    },
    [closures, findMatchingHoliday]
  )

  return {
    holidays,
    closures,
    loading,
    error,
    // Holidays
    fetchHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    toggleHoliday,
    // Closures
    fetchClosures,
    createClosure,
    deleteClosure,
    // Utility
    isDateClosed,
    getDateClosureInfo,
  }
}