// app/analytics/flags/page.tsx
// Full flags report page — all flagged cases with filtering, pagination, and detail.
// Links from: analytics hub summary card "View all", analytics hub report card "Case Flags"

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import DateRangeSelector from '@/components/ui/DateRangeSelector'

import {
  FlagIcon,
  FunnelIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  ClockIcon,
  XMarkIcon,
  UserIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// =====================================================
// TYPES
// =====================================================

interface CaseFlag {
  id: string
  case_id: string
  facility_id: string
  flag_type: 'threshold' | 'delay'
  flag_rule_id: string | null
  delay_type_id: string | null
  severity: string
  metric_value: number | null
  threshold_value: number | null
  comparison_scope: string | null
  duration_minutes: number | null
  note: string | null
  created_by: string | null
  created_at: string
}

interface CaseFlagWithJoins extends CaseFlag {
  cases: {
    id: string
    case_number: string
    scheduled_date: string
    surgeon: { first_name: string; last_name: string } | null
    procedure_types: { name: string; procedure_categories: { display_name: string } | null } | null
    or_rooms: { name: string } | null
  } | null
  flag_rules: {
    name: string
    category: string
    metric: string
    start_milestone: string | null
    end_milestone: string | null
    threshold_type: string
  } | null
  delay_types: {
    display_name: string
  } | null
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
type TypeFilter = 'all' | 'threshold' | 'delay'
type CategoryFilter = 'all' | 'timing' | 'efficiency' | 'anesthesia' | 'recovery'

// Grouped row: one row per case, with all its flags
interface CaseFlagGroup {
  caseId: string
  caseNumber: string
  scheduledDate: string
  surgeonName: string
  procedureName: string
  categoryName: string
  roomName: string
  flags: CaseFlagWithJoins[]
  maxSeverity: 'critical' | 'warning' | 'info'
  flagCount: number
}

// =====================================================
// CONSTANTS
// =====================================================

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: ExclamationCircleIcon,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  warning: {
    label: 'Warning',
    icon: ExclamationTriangleIcon,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  info: {
    label: 'Info',
    icon: InformationCircleIcon,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
} as const

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  timing: { label: 'Timing', color: 'text-blue-700 bg-blue-50 ring-blue-200' },
  efficiency: { label: 'Efficiency', color: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
  anesthesia: { label: 'Anesthesia', color: 'text-violet-700 bg-violet-50 ring-violet-200' },
  recovery: { label: 'Recovery', color: 'text-orange-700 bg-orange-50 ring-orange-200' },
  delay: { label: 'Delay', color: 'text-rose-700 bg-rose-50 ring-rose-200' },
}

// =====================================================
// DATE FILTER (reused pattern)
// =====================================================

interface DateFilterProps {
  selectedFilter: string
  onFilterChange: (filter: string, startDate?: string, endDate?: string) => void
}

function DateFilterWithCustom({ selectedFilter, onFilterChange }: DateFilterProps) {
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(selectedFilter === 'custom')

  const presets = [
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      const { startDate, endDate } = getDateRangeFromPreset(value)
      onFilterChange(value, startDate, endDate)
    }
  }

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onFilterChange('custom', customStart, customEnd)
    }
  }

  const getDateRangeFromPreset = (preset: string) => {
    const today = new Date()
    let startDate: Date

    switch (preset) {
      case 'week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
        break
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'quarter': {
        const currentQuarter = Math.floor(today.getMonth() / 3)
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1)
        break
      }
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={showCustom ? 'custom' : selectedFilter}
        onChange={(e) => handlePresetChange(e.target.value)}
        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        {presets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function FlagsReportPage() {
  const supabase = createClient()
  const router = useRouter()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()

  // Facility resolution
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)

  // Data
  const [flags, setFlags] = useState<CaseFlagWithJoins[]>([])
  const [loading, setLoading] = useState(true)

  // Date filter
  const [dateFilter, setDateFilter] = useState('month')
  const [currentStartDate, setCurrentStartDate] = useState<string | undefined>()
  const [currentEndDate, setCurrentEndDate] = useState<string | undefined>()

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [surgeonFilter, setSurgeonFilter] = useState<string>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Expanded row
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)

  // =====================================================
  // FACILITY RESOLUTION
  // =====================================================

  useEffect(() => {
    if (userLoading) return

    if (isGlobalAdmin || userData.accessLevel === 'global_admin') {
      const impersonation = getImpersonationState()
      if (impersonation?.facilityId) {
        setEffectiveFacilityId(impersonation.facilityId)
      } else {
        setNoFacilitySelected(true)
      }
    } else if (userData.facilityId) {
      setEffectiveFacilityId(userData.facilityId)
    }

    setFacilityCheckComplete(true)
  }, [userLoading, isGlobalAdmin, userData.accessLevel, userData.facilityId])

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchFlags = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return

    setLoading(true)

    let query = supabase
      .from('case_flags')
      .select(`
        id,
        case_id,
        facility_id,
        flag_type,
        flag_rule_id,
        delay_type_id,
        severity,
        metric_value,
        threshold_value,
        comparison_scope,
        duration_minutes,
        note,
        created_by,
        created_at,
        cases (
          id,
          case_number,
          scheduled_date,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_types (
            name,
            procedure_categories (display_name)
          ),
          or_rooms (name)
        ),
        flag_rules (
          name,
          category,
          metric,
          start_milestone,
          end_milestone,
          threshold_type
        ),
        delay_types (display_name)
      `)
      .eq('facility_id', effectiveFacilityId)
      .order('created_at', { ascending: false })

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

    const { data } = await query
    setFlags((data as unknown as CaseFlagWithJoins[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const start = monthStart.toISOString().split('T')[0]
    const end = today.toISOString().split('T')[0]
    setCurrentStartDate(start)
    setCurrentEndDate(end)
    fetchFlags(start, end)
  }, [effectiveFacilityId])

  const handleDateFilterChange = (filter: string, startDate: string, endDate: string) => {
    setDateFilter(filter)
    setCurrentStartDate(startDate)
    setCurrentEndDate(endDate)
    setCurrentPage(1)
    fetchFlags(startDate, endDate)
  }

  // =====================================================
  // COMPUTED DATA
  // =====================================================

  // Summary stats
  const stats = useMemo(() => {
    const bySeverity = { critical: 0, warning: 0, info: 0 }
    const byType = { threshold: 0, delay: 0 }
    const byCategory: Record<string, number> = {}
    const uniqueCases = new Set<string>()
    const surgeons = new Map<string, string>()

    flags.forEach(f => {
      uniqueCases.add(f.case_id)
      if (f.severity in bySeverity) bySeverity[f.severity as keyof typeof bySeverity]++
      if (f.flag_type in byType) byType[f.flag_type as keyof typeof byType]++

      const cat = f.flag_type === 'threshold'
        ? (f.flag_rules?.category || 'timing')
        : 'delay'
      byCategory[cat] = (byCategory[cat] || 0) + 1

      // Collect unique surgeons
      const surgeon = f.cases?.surgeon
      if (surgeon) {
        const name = `Dr. ${surgeon.last_name}`
        const key = name
        if (!surgeons.has(key)) surgeons.set(key, name)
      }
    })

    return {
      totalFlags: flags.length,
      uniqueCases: uniqueCases.size,
      bySeverity,
      byType,
      byCategory,
      surgeons: Array.from(surgeons.entries())
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [flags])

  // Filtered flags
  const filteredFlags = useMemo(() => {
    return flags.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false
      if (typeFilter !== 'all' && f.flag_type !== typeFilter) return false

      if (categoryFilter !== 'all') {
        const cat = f.flag_type === 'threshold'
          ? (f.flag_rules?.category || 'timing')
          : 'delay'
        if (cat !== categoryFilter) return false
      }

      if (surgeonFilter !== 'all') {
        const surgeon = f.cases?.surgeon
        if (!surgeon || `Dr. ${surgeon.last_name}` !== surgeonFilter) return false
      }

      return true
    })
  }, [flags, severityFilter, typeFilter, categoryFilter, surgeonFilter])

  // Group by case
  const groupedCases = useMemo(() => {
    const groups = new Map<string, CaseFlagGroup>()

    filteredFlags.forEach(f => {
      const caseId = f.case_id
      if (!groups.has(caseId)) {
        const caseData = f.cases
        const procType = caseData?.procedure_types
        const procData = Array.isArray(procType) ? procType[0] : procType
        const catData = procData?.procedure_categories
        const catDisplay = Array.isArray(catData) ? catData[0] : catData
        const roomData = caseData?.or_rooms
        const room = Array.isArray(roomData) ? roomData[0] : roomData

        groups.set(caseId, {
          caseId,
          caseNumber: caseData?.case_number || '—',
          scheduledDate: caseData?.scheduled_date || '',
          surgeonName: caseData?.surgeon
            ? `Dr. ${caseData.surgeon.last_name}`
            : '—',
          procedureName: procData?.name || '—',
          categoryName: catDisplay?.display_name || '—',
          roomName: room?.name || '—',
          flags: [],
          maxSeverity: 'info',
          flagCount: 0,
        })
      }

      const group = groups.get(caseId)!
      group.flags.push(f)
      group.flagCount++

      // Escalate max severity
      const sevOrder = { critical: 3, warning: 2, info: 1 }
      const currentMax = sevOrder[group.maxSeverity] || 0
      const newSev = sevOrder[f.severity as keyof typeof sevOrder] || 0
      if (newSev > currentMax) {
        group.maxSeverity = f.severity as 'critical' | 'warning' | 'info'
      }
    })

    // Sort by max severity desc, then date desc
    return Array.from(groups.values()).sort((a, b) => {
      const sevOrder = { critical: 3, warning: 2, info: 1 }
      const sevDiff = (sevOrder[b.maxSeverity] || 0) - (sevOrder[a.maxSeverity] || 0)
      if (sevDiff !== 0) return sevDiff
      return b.scheduledDate.localeCompare(a.scheduledDate)
    })
  }, [filteredFlags])

  // Pagination
  const totalItems = groupedCases.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedCases = groupedCases.slice(startIndex, endIndex)

  // Reset to page 1 on filter change
  const resetPagination = () => setCurrentPage(1)

  const handleSeverityChange = (v: SeverityFilter) => { setSeverityFilter(v); resetPagination() }
  const handleTypeChange = (v: TypeFilter) => { setTypeFilter(v); resetPagination() }
  const handleCategoryChange = (v: CategoryFilter) => { setCategoryFilter(v); resetPagination() }
  const handleSurgeonChange = (v: string) => { setSurgeonFilter(v); resetPagination() }
  const handlePageSizeChange = (v: number) => { setPageSize(v); resetPagination() }

  const clearFilters = () => {
    setSeverityFilter('all')
    setTypeFilter('all')
    setCategoryFilter('all')
    setSurgeonFilter('all')
    resetPagination()
  }

  const hasActiveFilters = severityFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' || surgeonFilter !== 'all'

  // Page numbers
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('ellipsis')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getFlagLabel = (flag: CaseFlagWithJoins): string => {
    if (flag.flag_type === 'threshold') {
      return flag.flag_rules?.name || 'Threshold Flag'
    }
    const dt = flag.delay_types
    const dtData = Array.isArray(dt) ? dt[0] : dt
    return dtData?.display_name || 'Delay'
  }

  const getFlagDetail = (flag: CaseFlagWithJoins): string => {
    if (flag.flag_type === 'threshold') {
      const actual = flag.metric_value !== null ? Math.round(flag.metric_value) : null
      const threshold = flag.threshold_value !== null ? Math.round(flag.threshold_value) : null
      if (actual !== null && threshold !== null) {
        return `${actual} min (threshold: ${threshold} min)`
      }
      return ''
    }
    if (flag.duration_minutes) {
      return `${flag.duration_minutes} min delay`
    }
    return flag.note || ''
  }

  const getFlagCategory = (flag: CaseFlagWithJoins): string => {
    if (flag.flag_type === 'threshold') {
      return flag.flag_rules?.category || 'timing'
    }
    return 'delay'
  }

  // =====================================================
  // RENDER
  // =====================================================

  // Loading
  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading flags report...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // No facility
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FlagIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view case flags.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50/50">
        <Container className="py-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/analytics"
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Case Flags</h1>
                <p className="text-slate-500 mt-1">
                  Auto-detected anomalies and reported delays
                </p>
              </div>
            </div>
<DateRangeSelector value={dateFilter} onChange={handleDateFilterChange} />          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading flags...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* ================================ */}
              {/* SUMMARY CARDS                   */}
              {/* ================================ */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Total Flags */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Flags</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalFlags}</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.uniqueCases} case{stats.uniqueCases !== 1 ? 's' : ''} flagged</p>
                </div>

                {/* Severity cards */}
                {(['critical', 'warning', 'info'] as const).map((sev) => {
                  const config = SEVERITY_CONFIG[sev]
                  const count = stats.bySeverity[sev]
                  return (
                    <button
                      key={sev}
                      onClick={() => handleSeverityChange(severityFilter === sev ? 'all' : sev)}
                      className={`rounded-xl border p-5 text-left transition-all ${
                        severityFilter === sev
                          ? `${config.bg} ${config.border} ring-2 ${config.ring}`
                          : `${config.bg} ${config.border} hover:ring-1 ${config.ring}`
                      }`}
                    >
                      <p className={`text-sm font-medium ${config.text} mb-1`}>{config.label}</p>
                      <p className={`text-2xl font-bold ${config.text}`}>{count}</p>
                    </button>
                  )
                })}

                {/* Auto-detected */}
                <button
                  onClick={() => handleTypeChange(typeFilter === 'threshold' ? 'all' : 'threshold')}
                  className={`bg-white rounded-xl border p-5 text-left transition-all ${
                    typeFilter === 'threshold'
                      ? 'border-violet-300 ring-2 ring-violet-200'
                      : 'border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-500 mb-1">Auto-Detected</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.byType.threshold}</p>
                  <p className="text-xs text-slate-400 mt-1">Threshold rules</p>
                </button>

                {/* Reported Delays */}
                <button
                  onClick={() => handleTypeChange(typeFilter === 'delay' ? 'all' : 'delay')}
                  className={`bg-white rounded-xl border p-5 text-left transition-all ${
                    typeFilter === 'delay'
                      ? 'border-orange-300 ring-2 ring-orange-200'
                      : 'border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-500 mb-1">Reported Delays</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.byType.delay}</p>
                  <p className="text-xs text-slate-400 mt-1">User-reported</p>
                </button>
              </div>

              {/* ================================ */}
              {/* FILTER BAR                      */}
              {/* ================================ */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <FunnelIcon className="w-4 h-4" />
                    <span className="font-medium">Filters:</span>
                  </div>

                  {/* Category filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => handleCategoryChange(e.target.value as CategoryFilter)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="timing">Timing</option>
                    <option value="efficiency">Efficiency</option>
                    <option value="anesthesia">Anesthesia</option>
                    <option value="recovery">Recovery</option>
                    <option value="delay">Delay</option>
                  </select>

                  {/* Surgeon filter */}
                  <select
                    value={surgeonFilter}
                    onChange={(e) => handleSurgeonChange(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all">All Surgeons</option>
                    {stats.surgeons.map(s => (
                      <option key={s.key} value={s.name}>{s.name}</option>
                    ))}
                  </select>

                  {/* Active filter indicator + clear */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Clear filters
                    </button>
                  )}

                  {/* Results count */}
                  <div className="ml-auto text-sm text-slate-500">
                    {totalItems} case{totalItems !== 1 ? 's' : ''} · {filteredFlags.length} flag{filteredFlags.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* ================================ */}
              {/* FLAGS TABLE                     */}
              {/* ================================ */}
              {groupedCases.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                  {/* Table header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {hasActiveFilters ? 'Filtered Cases' : 'All Flagged Cases'}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">Click a row to expand flag details · Click case number to view case</p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case #</th>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surgeon</th>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Procedure</th>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                          <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Flags</th>
                          <th className="px-6 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedCases.map((group) => (
                          <>
                            {/* Case Row */}
                            <tr
                              key={group.caseId}
                              onClick={() => setExpandedCaseId(expandedCaseId === group.caseId ? null : group.caseId)}
                              className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                            >
                              <td className="px-6 py-3.5 text-sm text-slate-600">{formatDate(group.scheduledDate)}</td>
                              <td className="px-6 py-3.5">
                                <Link
                                  href={`/cases/${group.caseId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  {group.caseNumber}
                                </Link>
                              </td>
                              <td className="px-6 py-3.5 text-sm text-slate-900">{group.surgeonName}</td>
                              <td className="px-6 py-3.5 text-sm text-slate-600 max-w-[180px] truncate">{group.procedureName}</td>
                              <td className="px-6 py-3.5 text-sm text-slate-600">{group.roomName}</td>
                              <td className="px-6 py-3.5">
                                {/* Multi-flag badges */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {group.flags.map((flag) => {
                                    const sevConfig = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info
                                    const catKey = getFlagCategory(flag)
                                    const catConfig = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.timing
                                    return (
                                      <span
                                        key={flag.id}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${sevConfig.badgeBg} ${sevConfig.badgeText} ${sevConfig.ring}`}
                                        title={`${getFlagLabel(flag)} — ${getFlagDetail(flag)}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${sevConfig.dot}`} />
                                        {getFlagLabel(flag).length > 20
                                          ? getFlagLabel(flag).substring(0, 18) + '…'
                                          : getFlagLabel(flag)
                                        }
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <ChevronRightIcon className={`w-4 h-4 text-slate-400 transition-transform ${
                                  expandedCaseId === group.caseId ? 'rotate-90' : ''
                                }`} />
                              </td>
                            </tr>

                            {/* Expanded Detail Row */}
                            {expandedCaseId === group.caseId && (
                              <tr key={`${group.caseId}-detail`}>
                                <td colSpan={7} className="bg-slate-50/50 px-6 py-4">
                                  <div className="space-y-2">
                                    {group.flags.map((flag) => {
                                      const sevConfig = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info
                                      const catKey = getFlagCategory(flag)
                                      const catConfig = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.timing
                                      return (
                                        <div
                                          key={flag.id}
                                          className={`flex items-start gap-3 p-3 rounded-lg bg-white border ${sevConfig.border}`}
                                        >
                                          <div className={`p-1.5 rounded-lg ${sevConfig.bg}`}>
                                            <sevConfig.icon className={`w-4 h-4 ${sevConfig.text}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-medium text-slate-900">
                                                {getFlagLabel(flag)}
                                              </span>
                                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ${catConfig.color}`}>
                                                {CATEGORY_CONFIG[catKey]?.label || catKey}
                                              </span>
                                              {flag.comparison_scope && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                                                  {flag.comparison_scope}
                                                </span>
                                              )}
                                              {flag.flag_type === 'delay' && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 ring-1 ring-orange-200">
                                                  Reported
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-0.5">
                                              {getFlagDetail(flag)}
                                            </p>
                                            {flag.note && (
                                              <p className="text-sm text-slate-400 mt-1 italic">
                                                &ldquo;{flag.note}&rdquo;
                                              </p>
                                            )}
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${sevConfig.badgeBg} ${sevConfig.badgeText}`}>
                                              {sevConfig.label}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                    <div className="flex justify-end pt-1">
                                      <Link
                                        href={`/cases/${group.caseId}`}
                                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                                      >
                                        View full case
                                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                      </Link>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                      {/* Page size */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Show:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <span className="text-sm text-slate-500">per page</span>
                      </div>

                      {/* Showing X-Y of Z */}
                      <div className="text-sm text-slate-500">
                        Showing <span className="font-medium text-slate-700">{startIndex + 1}</span> to{' '}
                        <span className="font-medium text-slate-700">{endIndex}</span> of{' '}
                        <span className="font-medium text-slate-700">{totalItems}</span>
                      </div>

                      {/* Page navigation */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className={`p-2 rounded-lg transition-colors ${
                            currentPage === 1
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <ChevronLeftIcon className="w-5 h-5" />
                        </button>

                        {getPageNumbers().map((page, index) =>
                          page === 'ellipsis' ? (
                            <span key={`ellipsis-${index}`} className="px-2 text-slate-400">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        )}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className={`p-2 rounded-lg transition-colors ${
                            currentPage === totalPages
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state */
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-12 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FlagIcon className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {hasActiveFilters ? 'No Matching Flags' : 'No Flags Detected'}
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {hasActiveFilters
                      ? 'Try adjusting your filters to see other flag types.'
                      : 'All cases are within expected thresholds for this period.'
                    }
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {/* ================================ */}
              {/* INFO CARD                       */}
              {/* ================================ */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-6">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">How Flags Work</h4>
                    <div className="text-sm text-slate-600 space-y-2">
                      <p>
                        <strong>Auto-detected flags</strong> fire when a case metric exceeds its configured threshold. Thresholds are
                        calculated from historical medians + standard deviations, adjustable in{' '}
                        <Link href="/settings/flags" className="text-blue-600 hover:underline">Settings → Case Flags</Link>.
                      </p>
                      <p>
                        <strong>Delay flags</strong> are reported by staff from the case page when a delay occurs. These include
                        a delay type and optional notes.
                      </p>
                      <div className="flex flex-wrap gap-3 mt-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Critical — significantly exceeds threshold
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Warning — moderately exceeds threshold
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Info — slightly above or notable
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}