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
  flag_rule_id: string | null
  flag_rules?: { category?: string } | null
}

export function useFlagCounts(
  facilityId: string | undefined,
  startDate?: string,
  endDate?: string,
  canSeeFinancialFlags: boolean = true
): { data: FlagCounts | null; loading: boolean } {
  const supabase = createClient()
  const [rawFlags, setRawFlags] = useState<FlagRow[]>([])
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
        .select('severity, flag_rule_id, flag_rules(category)')
        .eq('facility_id', facilityId!)

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

      const { data } = await query
      setRawFlags((data as FlagRow[]) || [])
      setLoading(false)
    }

    fetchFlags()
  }, [facilityId, startDate, endDate, supabase])

  // Filter financial flags if user doesn't have permission
  const flags = useMemo(() => {
    if (canSeeFinancialFlags) return rawFlags
    return rawFlags.filter((f) => {
      const flagRule = Array.isArray(f.flag_rules) ? f.flag_rules[0] : f.flag_rules
      return !flagRule || flagRule.category !== 'financial'
    })
  }, [rawFlags, canSeeFinancialFlags])

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
