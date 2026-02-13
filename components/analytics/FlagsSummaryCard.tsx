// components/analytics/FlagsSummaryCard.tsx
// Compact flags overview card for the analytics hub page.
// Fetches case_flags for the current facility/date range and shows:
//   - Total flagged cases count
//   - Breakdown by severity (critical/warning/info)
//   - Breakdown by type (threshold vs delay)
//   - Top 5 most-flagged cases with badge previews
//   - Link to full flags report

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  FlagIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

// =====================================================
// TYPES
// =====================================================

interface CaseFlag {
  id: string
  case_id: string
  flag_type: 'threshold' | 'delay'
  flag_rule_id: string | null
  delay_type_id: string | null
  severity: string
  metric_value: number | null
  threshold_value: number | null
  note: string | null
  created_at: string
  cases: {
    id: string
    case_number: string
    scheduled_date: string
    surgeon: { first_name: string; last_name: string } | null
    procedure_types: { name: string } | null
  } | null
  flag_rules: {
    name: string
    category: string
  } | null
  delay_types: {
    display_name: string
  } | null
}

interface FlagsSummaryCardProps {
  facilityId: string
  startDate?: string
  endDate?: string
}

// =====================================================
// SEVERITY CONFIG
// =====================================================

const SEVERITY = {
  critical: {
    label: 'Critical',
    icon: ExclamationCircleIcon,
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
  },
  warning: {
    label: 'Warning',
    icon: ExclamationTriangleIcon,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
  },
  info: {
    label: 'Info',
    icon: InformationCircleIcon,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
  },
}

// =====================================================
// COMPONENT
// =====================================================

export default function FlagsSummaryCard({ facilityId, startDate, endDate }: FlagsSummaryCardProps) {
  const supabase = createClient()
  const [flags, setFlags] = useState<CaseFlag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!facilityId) return

    async function fetchFlags() {
      setLoading(true)

      let query = supabase
        .from('case_flags')
        .select(`
          id,
          case_id,
          flag_type,
          flag_rule_id,
          delay_type_id,
          severity,
          metric_value,
          threshold_value,
          note,
          created_at,
          cases!case_flags_case_id_fkey (
            id,
            case_number,
            scheduled_date,
            surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
            procedure_types (name)
          ),
          flag_rules (name, category),
          delay_types (display_name)
        `)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false })

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

      const { data } = await query
      setFlags((data as unknown as CaseFlag[]) || [])
      setLoading(false)
    }

    fetchFlags()
  }, [facilityId, startDate, endDate])

  // =====================================================
  // COMPUTED STATS
  // =====================================================

  const stats = useMemo(() => {
    const uniqueCaseIds = new Set(flags.map(f => f.case_id))
    const bySeverity = { critical: 0, warning: 0, info: 0 }
    const byType = { threshold: 0, delay: 0 }

    flags.forEach(f => {
      if (f.severity in bySeverity) bySeverity[f.severity as keyof typeof bySeverity]++
      if (f.flag_type in byType) byType[f.flag_type as keyof typeof byType]++
    })

    // Top flagged cases (most flags per case)
    const caseFlagCounts = new Map<string, { count: number; flag: CaseFlag }>()
    flags.forEach(f => {
      const existing = caseFlagCounts.get(f.case_id)
      if (!existing || existing.count < flags.filter(ff => ff.case_id === f.case_id).length) {
        caseFlagCounts.set(f.case_id, {
          count: flags.filter(ff => ff.case_id === f.case_id).length,
          flag: f,
        })
      }
    })

    const topCases = Array.from(caseFlagCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([caseId, { count, flag }]) => ({
        caseId,
        count,
        caseNumber: flag.cases?.case_number || '—',
        surgeonName: flag.cases?.surgeon
          ? `Dr. ${flag.cases.surgeon.last_name}`
          : '—',
        procedure: flag.cases?.procedure_types?.name || '—',
        date: flag.cases?.scheduled_date || '',
        severities: flags
          .filter(f => f.case_id === caseId)
          .reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1
            return acc
          }, {} as Record<string, number>),
      }))

    return {
      totalFlags: flags.length,
      uniqueCases: uniqueCaseIds.size,
      bySeverity,
      byType,
      topCases,
    }
  }, [flags])

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="h-5 bg-slate-200 rounded w-32 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded w-48 mt-2 animate-pulse" />
        </div>
        <div className="p-6 flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // No flags at all
  if (stats.totalFlags === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FlagIcon className="w-5 h-5 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900">Case Flags</h3>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Auto-detected anomalies and reported delays</p>
        </div>
        <div className="p-8 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FlagIcon className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">No flags in this period</p>
          <p className="text-xs text-slate-400 mt-1">All cases within expected thresholds</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FlagIcon className="w-5 h-5 text-slate-400" />
              <h3 className="text-base font-semibold text-slate-900">Case Flags</h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">
                {stats.totalFlags}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats.uniqueCases} case{stats.uniqueCases !== 1 ? 's' : ''} flagged in this period
            </p>
          </div>
          <Link
            href="/analytics/flags"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Severity Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(['critical', 'warning', 'info'] as const).map((sev) => {
            const config = SEVERITY[sev]
            const count = stats.bySeverity[sev]
            return (
              <div key={sev} className={`rounded-lg px-3 py-2.5 ${config.bg} ring-1 ${config.ring}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${config.text}`}>
                    {config.label}
                  </span>
                </div>
                <p className={`text-xl font-semibold ${config.text}`}>{count}</p>
              </div>
            )
          })}
        </div>

        {/* Type Breakdown */}
        <div className="flex items-center gap-4 mb-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-violet-400" />
            Auto-detected: <span className="font-semibold text-slate-700">{stats.byType.threshold}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-orange-400" />
            Reported delays: <span className="font-semibold text-slate-700">{stats.byType.delay}</span>
          </span>
        </div>

        {/* Top Flagged Cases */}
        {stats.topCases.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Most Flagged Cases
            </p>
            <div className="space-y-1.5">
              {stats.topCases.map((c) => (
                <Link
                  key={c.caseId}
                  href={`/cases/${c.caseId}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-medium text-slate-700 shrink-0">
                      {c.caseNumber}
                    </span>
                    <span className="text-sm text-slate-500 truncate">
                      {c.surgeonName} · {c.procedure}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Severity dots */}
                    <div className="flex items-center gap-1">
                      {c.severities.critical && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold ring-1 ring-red-200">
                          {c.severities.critical}
                        </span>
                      )}
                      {c.severities.warning && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold ring-1 ring-amber-200">
                          {c.severities.warning}
                        </span>
                      )}
                      {c.severities.info && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold ring-1 ring-blue-200">
                          {c.severities.info}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {c.count} flag{c.count !== 1 ? 's' : ''}
                    </span>
                    <ArrowRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}