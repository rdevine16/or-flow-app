'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

export interface FlagCounts {
  total: number
  critical: number
  warning: number
  info: number
}

interface FlagRow {
  severity: string
}

export function useFlagCounts(
  facilityId: string | undefined,
  startDate?: string,
  endDate?: string
): { data: FlagCounts | null; loading: boolean } {
  const supabase = createClient()
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!facilityId) {
      setLoading(false)
      return
    }

    async function fetchFlags() {
      setLoading(true)

      let query = supabase
        .from('case_flags')
        .select('severity')
        .eq('facility_id', facilityId!)

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

      const { data } = await query
      setFlags((data as FlagRow[]) || [])
      setLoading(false)
    }

    fetchFlags()
  }, [facilityId, startDate, endDate, supabase])

  const data = useMemo<FlagCounts | null>(() => {
    if (loading || !facilityId) return null
    const counts: FlagCounts = { total: 0, critical: 0, warning: 0, info: 0 }
    flags.forEach(f => {
      counts.total++
      if (f.severity === 'critical') counts.critical++
      else if (f.severity === 'warning') counts.warning++
      else counts.info++
    })
    return counts
  }, [flags, loading, facilityId])

  return { data, loading }
}
