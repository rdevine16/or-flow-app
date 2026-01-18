'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'

// Tremor components
import {
  BarChart,
  DonutChart,
  AreaChart,
  Legend,
  type Color,
} from '@tremor/react'

// Analytics functions
import {
  calculateAnalyticsOverview,
  formatMinutes,
  type CaseWithMilestones,
  type FlipRoomAnalysis,
} from '@/lib/analyticsV2'

// Icons
import { 
  ClockIcon, 
  ChartBarIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowRightIcon,
  XMarkIcon,
  UserIcon,
  BuildingOffice2Icon,
  BeakerIcon,
  ArrowPathIcon,
  DocumentChartBarIcon,
  PresentationChartLineIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'

// ============================================
// TYPES
// ============================================

interface KPIData {
  value: number
  displayValue: string
  subtitle: string
  target?: number
  targetMet?: boolean
  delta?: number
  deltaType?: 'increase' | 'decrease' | 'unchanged'
  dailyData?: Array<{ color: Color; tooltip: string }>
}

interface ProcedureCategory {
  id: string
  name: string
  display_name: string
}

interface ProcedureTechnique {
  id: string
  name: string
  display_name: string
}

// ============================================
// DATE FILTER WITH CUSTOM OPTION
// ============================================

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
      // Don't trigger filter change yet - wait for dates
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
    let endDate = today

    switch (preset) {
      case 'week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
        break
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1)
        break
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
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

// ============================================
// REPORT NAVIGATION CARD
// ============================================

interface ReportCardProps {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan'
  badge?: string
  stats?: { label: string; value: string }[]
}

function ReportCard({ title, description, href, icon: Icon, accentColor, badge, stats }: ReportCardProps) {
  const colorClasses = {
    blue: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      hoverBorder: 'hover:border-blue-300',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
    },
    emerald: {
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      hoverBorder: 'hover:border-emerald-300',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
    },
    violet: {
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      hoverBorder: 'hover:border-violet-300',
      badgeBg: 'bg-violet-50',
      badgeText: 'text-violet-700',
    },
    amber: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      hoverBorder: 'hover:border-amber-300',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
    },
    rose: {
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      hoverBorder: 'hover:border-rose-300',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
    },
    cyan: {
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      hoverBorder: 'hover:border-cyan-300',
      badgeBg: 'bg-cyan-50',
      badgeText: 'text-cyan-700',
    },
  }

  const colors = colorClasses[accentColor]

  return (
    <Link
      href={href}
      className={`
        group block bg-white rounded-xl border border-slate-200/60 
        shadow-sm hover:shadow-md transition-all duration-200
        ${colors.hoverBorder}
      `}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${colors.iconBg}`}>
            <Icon className={`w-5 h-5 ${colors.iconColor}`} />
          </div>
          {badge && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors.badgeBg} ${colors.badgeText}`}>
              {badge}
            </span>
          )}
        </div>
        
        <h3 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-slate-700">
          {title}
        </h3>
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">
          {description}
        </p>

        {stats && stats.length > 0 && (
          <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
            {stats.map((stat, i) => (
              <div key={i}>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="text-sm font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center text-sm font-medium text-slate-600 group-hover:text-blue-600 mt-3">
          View report
          <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  )
}

// ============================================
// QUICK STAT CARD (for overview row)
// ============================================

function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  trendType?: 'up' | 'down'
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="p-1.5 rounded-lg bg-slate-100">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        {trend !== undefined && trendType && (
          <div className={`
            flex items-center gap-0.5 text-xs font-medium
            ${trendType === 'up' ? 'text-emerald-600' : 'text-rose-600'}
          `}>
            {trendType === 'up' ? (
              <ArrowTrendingUpIcon className="w-3 h-3" />
            ) : (
              <ArrowTrendingDownIcon className="w-3 h-3" />
            )}
            {trend}%
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  )
}

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ============================================
// FLIP ROOM MODAL (kept for surgeon idle time)
// ============================================

function FlipRoomModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean
  onClose: () => void
  data: FlipRoomAnalysis[]
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <SparklesIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Flip Room Analysis</h2>
                <p className="text-sm text-slate-500">Surgeon idle time between room transitions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            {data.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarDaysIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No flip room patterns detected</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Flip rooms occur when a surgeon operates in multiple rooms on the same day.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.map((analysis, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                          {analysis.surgeonName.replace('Dr. ', '').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{analysis.surgeonName}</p>
                          <p className="text-sm text-slate-500">{analysis.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Idle</p>
                        <p className="text-2xl font-semibold text-amber-600">{Math.round(analysis.totalIdleTime)} min</p>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Room Sequence</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {analysis.cases.map((c, i) => (
                          <div key={c.caseId} className="flex items-center">
                            <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                              <span className="font-semibold text-slate-900">{c.roomName}</span>
                              <span className="text-slate-400 ml-2 text-sm">{c.scheduledStart}</span>
                            </div>
                            {i < analysis.cases.length - 1 && (
                              <ArrowRightIcon className="w-4 h-4 mx-2 text-slate-300" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {analysis.idleGaps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Transition Gaps</p>
                        <div className="space-y-2">
                          {analysis.idleGaps.map((gap, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700">{gap.fromCase}</span>
                                <ArrowRightIcon className="w-4 h-4 text-slate-300" />
                                <span className="font-medium text-slate-700">{gap.toCase}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">Idle</p>
                                  <p className={`font-semibold ${gap.idleMinutes > 10 ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {Math.round(gap.idleMinutes)} min
                                  </p>
                                </div>
                                {gap.optimalCallDelta > 0 && (
                                  <div className="text-right pl-4 border-l border-slate-200">
                                    <p className="text-xs text-blue-600">Call earlier</p>
                                    <p className="font-semibold text-blue-600">
                                      {Math.round(gap.optimalCallDelta)} min
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsHubPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()
  
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)
  
  const [cases, setCases] = useState<CaseWithMilestones[]>([])
  const [previousPeriodCases, setPreviousPeriodCases] = useState<CaseWithMilestones[]>([])
  const [procedureCategories, setProcedureCategories] = useState<ProcedureCategory[]>([])
  const [procedureTechniques, setProcedureTechniques] = useState<ProcedureTechnique[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('month')
  
  const [showFlipRoomModal, setShowFlipRoomModal] = useState(false)

  // Determine effective facility ID
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

  // Fetch procedure categories and techniques
  useEffect(() => {
    async function fetchLookups() {
      const [categoriesRes, techniquesRes] = await Promise.all([
        supabase.from('procedure_categories').select('id, name, display_name').order('display_order'),
        supabase.from('procedure_techniques').select('id, name, display_name').order('display_order'),
      ])
      
      if (categoriesRes.data) setProcedureCategories(categoriesRes.data)
      if (techniquesRes.data) setProcedureTechniques(techniquesRes.data)
    }
    fetchLookups()
  }, [])

  // Fetch data
  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        facility_id,
        scheduled_date,
        start_time,
        surgeon_id,
        or_room_id,
        status_id,
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        procedure_types (
          id, 
          name,
          procedure_category_id,
          technique_id,
          procedure_categories (id, name, display_name),
          procedure_techniques (id, name, display_name)
        ),
        or_rooms (id, name),
        case_statuses (name),
        case_milestones (
          milestone_type_id,
          recorded_at,
          milestone_types (name)
        )
      `)
      .eq('facility_id', effectiveFacilityId)
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data: casesData } = await query
    setCases((casesData as unknown as CaseWithMilestones[]) || [])
    
    // Fetch previous period for comparison
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodLength = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - periodLength)
      
      const { data: prevData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          facility_id,
          scheduled_date,
          start_time,
          surgeon_id,
          or_room_id,
          status_id,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_types (
            id, 
            name,
            procedure_category_id,
            technique_id,
            procedure_categories (id, name, display_name),
            procedure_techniques (id, name, display_name)
          ),
          or_rooms (id, name),
          case_statuses (name),
          case_milestones (
            milestone_type_id,
            recorded_at,
            milestone_types (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', prevStart.toISOString().split('T')[0])
        .lte('scheduled_date', prevEnd.toISOString().split('T')[0])
      
      setPreviousPeriodCases((prevData as unknown as CaseWithMilestones[]) || [])
    }
    
    setLoading(false)
  }

  useEffect(() => {
    if (!effectiveFacilityId) return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    fetchData(monthStart.toISOString().split('T')[0], today.toISOString().split('T')[0])
  }, [effectiveFacilityId])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchData(startDate, endDate)
  }

  // Calculate all analytics
  const analytics = useMemo(() => {
    return calculateAnalyticsOverview(cases, previousPeriodCases)
  }, [cases, previousPeriodCases])

  // ============================================
  // NEW CHART DATA CALCULATIONS
  // ============================================

  // Daily Case Volume Trend Data
  const dailyCaseTrendData = useMemo(() => {
    const byDate: { [key: string]: number } = {}
    
    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name === 'completed') {
        const date = c.scheduled_date
        byDate[date] = (byDate[date] || 0) + 1
      }
    })

    return Object.entries(byDate)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Completed Cases': count,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [cases])

  // Procedure Category Volume Data
  const procedureCategoryData = useMemo(() => {
    const byCategoryId: { [key: string]: { count: number; name: string } } = {}
    
    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name !== 'completed') return
      
      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return
      
      const category = procType.procedure_categories
      if (category) {
        const catData = Array.isArray(category) ? category[0] : category
        if (catData) {
          if (!byCategoryId[catData.id]) {
            byCategoryId[catData.id] = { count: 0, name: catData.display_name || catData.name }
          }
          byCategoryId[catData.id].count++
        }
      }
    })

    return Object.values(byCategoryId)
      .map(cat => ({ name: cat.name, cases: cat.count }))
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 8) // Top 8 categories
  }, [cases])

  const categoryChartColors: Color[] = ['blue', 'cyan', 'indigo', 'violet', 'fuchsia', 'pink', 'emerald', 'amber']

// Helper to get surgical time from milestones
const getSurgicalTimeMinutes = (caseData: CaseWithMilestones): number | null => {
  const milestones = caseData.case_milestones || []
  let incisionTimestamp: number | null = null
  let closingTimestamp: number | null = null

  milestones.forEach(m => {
    const mType = Array.isArray(m.milestone_types) ? m.milestone_types[0] : m.milestone_types
    if (mType?.name === 'incision') {
      incisionTimestamp = new Date(m.recorded_at).getTime()
    } else if (mType?.name === 'closing' || mType?.name === 'closing_complete') {
      closingTimestamp = new Date(m.recorded_at).getTime()
    }
  })

  if (incisionTimestamp !== null && closingTimestamp !== null) {
    return Math.round((closingTimestamp - incisionTimestamp) / (1000 * 60))
  }
  return null
}

  // Robotic vs Traditional Comparison Data for Total Knee
  const kneeComparisonData = useMemo(() => {
    const totalKneeCategoryId = procedureCategories.find(c => c.name === 'total_knee')?.id
    const roboticTechniqueId = procedureTechniques.find(t => t.name === 'robotic')?.id
    const manualTechniqueId = procedureTechniques.find(t => t.name === 'manual')?.id

    if (!totalKneeCategoryId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name !== 'completed') return

      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      const category = procType.procedure_categories
      const catData = Array.isArray(category) ? category[0] : category
      if (catData?.id !== totalKneeCategoryId) return

      const surgicalTime = getSurgicalTimeMinutes(c)
      if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return // Filter outliers

      const date = c.scheduled_date
      if (!byDate[date]) {
        byDate[date] = { robotic: [], traditional: [] }
      }

      if (procType.technique_id === roboticTechniqueId) {
        byDate[date].robotic.push(surgicalTime)
      } else if (procType.technique_id === manualTechniqueId) {
        byDate[date].traditional.push(surgicalTime)
      }
    })

    return Object.entries(byDate)
      .map(([date, times]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Robotic (Mako)': times.robotic.length > 0 
          ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length) 
          : null,
        'Traditional': times.traditional.length > 0 
          ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length) 
          : null,
      }))
      .filter(d => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [cases, procedureCategories, procedureTechniques])

  // Robotic vs Traditional Comparison Data for Total Hip
  const hipComparisonData = useMemo(() => {
    const totalHipCategoryId = procedureCategories.find(c => c.name === 'total_hip')?.id
    const roboticTechniqueId = procedureTechniques.find(t => t.name === 'robotic')?.id
    const manualTechniqueId = procedureTechniques.find(t => t.name === 'manual')?.id

    if (!totalHipCategoryId) return []

    const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}

    cases.forEach(c => {
      const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
      if (status?.name !== 'completed') return

      const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
      if (!procType) return

      const category = procType.procedure_categories
      const catData = Array.isArray(category) ? category[0] : category
      if (catData?.id !== totalHipCategoryId) return

      const surgicalTime = getSurgicalTimeMinutes(c)
      if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return

      const date = c.scheduled_date
      if (!byDate[date]) {
        byDate[date] = { robotic: [], traditional: [] }
      }

      if (procType.technique_id === roboticTechniqueId) {
        byDate[date].robotic.push(surgicalTime)
      } else if (procType.technique_id === manualTechniqueId) {
        byDate[date].traditional.push(surgicalTime)
      }
    })

    return Object.entries(byDate)
      .map(([date, times]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        'Robotic (Mako)': times.robotic.length > 0 
          ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length) 
          : null,
        'Traditional': times.traditional.length > 0 
          ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length) 
          : null,
      }))
      .filter(d => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [cases, procedureCategories, procedureTechniques])

  // Report cards configuration
  const reportCards: ReportCardProps[] = [
    {
      title: 'KPI Overview',
      description: 'Complete dashboard with all key performance indicators, targets, and daily trends',
      href: '/analytics/overview',
      icon: PresentationChartLineIcon,
      accentColor: 'blue',
      badge: 'Full Report',
    },
    {
      title: 'Surgeon Performance',
      description: 'Compare surgeon metrics, case times, and efficiency across procedures',
      href: '/analytics/surgeons',
      icon: UserIcon,
      accentColor: 'emerald',
    },
    {
      title: 'Room Utilization',
      description: 'OR room efficiency, turnover times, and daily utilization rates',
      href: '/analytics/rooms',
      icon: BuildingOffice2Icon,
      accentColor: 'emerald',
    },
    {
      title: 'Procedure Analysis',
      description: 'Time breakdowns by procedure type with facility benchmarks',
      href: '/analytics/procedures',
      icon: BeakerIcon,
      accentColor: 'violet',
    },
    {
      title: 'Turnover Analysis',
      description: 'Detailed turnover metrics and optimization opportunities',
      href: '/analytics/turnovers',
      icon: ArrowPathIcon,
      accentColor: 'amber',
    },
    {
      title: 'Delay Reports',
      description: 'Delay patterns, causes, and impact on schedule adherence',
      href: '/analytics/delays',
      icon: ExclamationTriangleIcon,
      accentColor: 'rose',
    },
    {
      title: 'Case Timeline',
      description: 'Individual case deep-dives with milestone analysis',
      href: '/analytics/timeline',
      icon: ClipboardDocumentListIcon,
      accentColor: 'cyan',
    },
  ]

  // Loading state
  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Facility Selected</h2>
            <p className="text-slate-500 mb-6">Select a facility to view analytics and performance metrics.</p>
            <Link
              href="/admin/facilities"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              View Facilities
              <ArrowRightIcon className="w-4 h-4" />
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
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
              <p className="text-slate-500 mt-1">
                Performance insights and operational metrics
              </p>
            </div>
            <DateFilterWithCustom selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Calculating metrics...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* QUICK STATS ROW */}
              <section>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <QuickStatCard
                    title="Completed Cases"
                    value={analytics.completedCases.toString()}
                    icon={CalendarDaysIcon}
                    trend={analytics.caseVolume.delta}
                    trendType={analytics.caseVolume.deltaType === 'increase' ? 'up' : analytics.caseVolume.deltaType === 'decrease' ? 'down' : undefined}
                  />
                  <QuickStatCard
                    title="FCOTS Rate"
                    value={analytics.fcots.displayValue}
                    icon={ClockIcon}
                    trend={analytics.fcots.delta}
                    trendType={analytics.fcots.deltaType === 'increase' ? 'up' : analytics.fcots.deltaType === 'decrease' ? 'down' : undefined}
                  />
                  <QuickStatCard
                    title="Avg Turnover"
                    value={analytics.turnoverTime.displayValue}
                    icon={ArrowPathIcon}
                  />
                  <QuickStatCard
                    title="OR Utilization"
                    value={analytics.orUtilization.displayValue}
                    icon={ChartBarIcon}
                  />
                  <QuickStatCard
                    title="Avg Case Time"
                    value={formatMinutes(analytics.avgTotalCaseTime)}
                    icon={ClockIcon}
                  />
                  <QuickStatCard
                    title="Cancellation Rate"
                    value={analytics.cancellationRate.displayValue}
                    icon={ExclamationTriangleIcon}
                  />
                </div>
              </section>

              {/* CHARTS ROW - Case Trends & Category Breakdown */}
              <section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Case Volume Trend */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="text-base font-semibold text-slate-900">Case Volume Trend</h3>
                      <p className="text-sm text-slate-500 mt-0.5">Completed cases over time</p>
                    </div>
                    <div className="p-6">
                      {dailyCaseTrendData.length > 0 ? (
                        <BarChart
                          className="h-64"
                          data={dailyCaseTrendData}
                          index="date"
                          categories={['Completed Cases']}
                          colors={['blue']}
                          valueFormatter={(v) => v.toString()}
                          yAxisWidth={40}
                          showAnimation={true}
                          showLegend={false}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-64 text-slate-400">
                          <div className="text-center">
                            <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <p>No data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Procedure Category Breakdown */}
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="text-base font-semibold text-slate-900">Procedure Categories</h3>
                      <p className="text-sm text-slate-500 mt-0.5">Case distribution by procedure type</p>
                    </div>
                    <div className="p-6">
                      {procedureCategoryData.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <DonutChart
                            className="h-52"
                            data={procedureCategoryData}
                            index="name"
                            category="cases"
                            colors={categoryChartColors}
                            valueFormatter={(v) => `${v} cases`}
                            showAnimation={true}
                            label={`${procedureCategoryData.reduce((sum, d) => sum + d.cases, 0)} total`}
                          />
                          <Legend
                            className="mt-4"
                            categories={procedureCategoryData.map(d => d.name)}
                            colors={categoryChartColors.slice(0, procedureCategoryData.length)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-slate-400">
                          <div className="text-center">
                            <ChartBarIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                            <p>No data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* ROBOTIC VS TRADITIONAL COMPARISON */}
              {(kneeComparisonData.length > 0 || hipComparisonData.length > 0) && (
                <section>
                  <SectionHeader
                    title="Robotic vs Traditional Surgical Time"
                    subtitle="Average surgical time comparison by technique"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Total Knee Comparison */}
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900">Total Knee Arthroplasty</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Surgical time by technique (minutes)</p>
                      </div>
                      <div className="p-6">
                        {kneeComparisonData.length > 0 ? (
                          <AreaChart
                            className="h-56"
                            data={kneeComparisonData}
                            index="date"
                            categories={['Robotic (Mako)', 'Traditional']}
                            colors={['cyan', 'slate']}
valueFormatter={(v) => v.toString()}
                            yAxisWidth={48}
                            showAnimation={true}
                            connectNulls={true}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-56 text-slate-400">
                            <div className="text-center">
                              <ChartBarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                              <p className="text-sm">No TKA data available</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total Hip Comparison */}
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900">Total Hip Arthroplasty</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Surgical time by technique (minutes)</p>
                      </div>
                      <div className="p-6">
                        {hipComparisonData.length > 0 ? (
                          <AreaChart
                            className="h-56"
                            data={hipComparisonData}
                            index="date"
                            categories={['Robotic (Mako)', 'Traditional']}
                            colors={['cyan', 'slate']}
valueFormatter={(v) => v.toString()}
                            yAxisWidth={48}
                            showAnimation={true}
                            connectNulls={true}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-56 text-slate-400">
                            <div className="text-center">
                              <ChartBarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                              <p className="text-sm">No THA data available</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* AI INSIGHT CARD */}
              {analytics.surgeonIdleTime.value > 0 && (
                <section>
                  <button
                    onClick={() => setShowFlipRoomModal(true)}
                    className="w-full text-left bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100">
                            <SparklesIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">Optimization Opportunity</h3>
                              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                                AI Insight
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              Surgeons are waiting an average of <span className="font-semibold text-blue-700">{analytics.surgeonIdleTime.displayValue}</span> between rooms.
                              {analytics.surgeonIdleTime.subtitle !== 'No optimization needed' && (
                                <span className="text-blue-700"> {analytics.surgeonIdleTime.subtitle}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <ArrowRightIcon className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </button>
                </section>
              )}

              {/* REPORTS GRID */}
              <section>
                <SectionHeader
                  title="Detailed Reports"
                  subtitle="Dive deeper into specific areas of OR performance"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportCards.map((card) => (
                    <ReportCard key={card.href} {...card} />
                  ))}
                </div>
              </section>

              {/* FLIP ROOM MODAL */}
              <FlipRoomModal
                isOpen={showFlipRoomModal}
                onClose={() => setShowFlipRoomModal(false)}
                data={analytics.flipRoomAnalysis}
              />
            </div>
          )}
        </Container>
      </div>
    </DashboardLayout>
  )
}