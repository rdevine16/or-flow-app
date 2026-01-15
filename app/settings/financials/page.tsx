'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import { getImpersonationState } from '../../../lib/impersonation'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
  Legend,
} from 'recharts'

// ============================================
// TYPES
// ============================================

interface CaseDelay {
  id: string
  delay_type_id: string
  duration_minutes: number | null
  notes: string | null
  delay_types: { name: string } | null
}

interface CaseWithFinancials {
  id: string
  case_number: string
  scheduled_date: string
  surgeon_id: string | null
  surgeon: { first_name: string; last_name: string } | null
  procedure_type_id: string | null
  procedure_types: { 
    id: string
    name: string
    soft_goods_cost: number | null
    hard_goods_cost: number | null
  } | null
  payer_id: string | null
  payers: { id: string; name: string } | null
  case_milestones: Array<{
    milestone_type_id: string
    recorded_at: string
    milestone_types: { name: string } | null
  }>
  case_delays: CaseDelay[]
}

interface FacilitySettings {
  or_hourly_rate: number | null
}

interface ProcedureReimbursement {
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
}

interface SurgeonStats {
  surgeonId: string
  surgeonName: string
  totalProfit: number
  avgProfit: number
  caseCount: number
  avgDurationMinutes: number
  durationVsAvgMinutes: number
  profitImpact: number
}

interface ProcedureStats {
  procedureId: string
  procedureName: string
  totalProfit: number
  avgProfit: number
  avgMarginPercent: number
  caseCount: number
  avgDurationMinutes: number
  surgeonBreakdown: SurgeonStats[]
}

// Issue detail types
interface OverTimeIssue {
  type: 'overTime'
  actualMinutes: number
  expectedMinutes: number
  percentOver: number
}

interface DelayIssue {
  type: 'delay'
  delays: Array<{ name: string; minutes: number | null }>
  totalMinutes: number
}

interface LowPayerIssue {
  type: 'lowPayer'
  payerName: string
  payerRate: number
  defaultRate: number
  percentBelow: number
}

interface UnknownIssue {
  type: 'unknown'
}

type CaseIssue = OverTimeIssue | DelayIssue | LowPayerIssue | UnknownIssue

interface OutlierCase {
  caseId: string
  caseNumber: string
  date: string
  surgeonName: string
  procedureName: string
  expectedProfit: number
  actualProfit: number
  gap: number
  durationMinutes: number
  expectedDurationMinutes: number
  issues: CaseIssue[]
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function getCaseDurationMinutes(milestones: CaseWithFinancials['case_milestones']): number | null {
  const patientIn = milestones.find(m => m.milestone_types?.name === 'patient_in')
  const patientOut = milestones.find(m => m.milestone_types?.name === 'patient_out')
  
  if (!patientIn || !patientOut) return null
  
  const start = new Date(patientIn.recorded_at)
  const end = new Date(patientOut.recorded_at)
  return (end.getTime() - start.getTime()) / (1000 * 60)
}

function calculateCaseProfit(
  caseData: CaseWithFinancials,
  orHourlyRate: number,
  reimbursements: ProcedureReimbursement[]
): { profit: number; reimbursement: number; orCost: number; payerReimbursement: number | null; defaultReimbursement: number | null } | null {
  const procedure = caseData.procedure_types
  if (!procedure) return null
  
  const duration = getCaseDurationMinutes(caseData.case_milestones)
  if (duration === null) return null
  
  // Get default reimbursement
  const defaultReimbursement = reimbursements.find(
    r => r.procedure_type_id === procedure.id && r.payer_id === null
  )?.reimbursement || null

  // Get payer-specific reimbursement if applicable
  let payerReimbursement: number | null = null
  if (caseData.payer_id) {
    payerReimbursement = reimbursements.find(
      r => r.procedure_type_id === procedure.id && r.payer_id === caseData.payer_id
    )?.reimbursement || null
  }
  
  // Use payer rate if available, otherwise default
  const reimbursement = payerReimbursement ?? defaultReimbursement
  if (!reimbursement) return null
  
  const softGoods = procedure.soft_goods_cost || 0
  const hardGoods = procedure.hard_goods_cost || 0
  const orCost = (duration / 60) * orHourlyRate
  
  const profit = reimbursement - softGoods - hardGoods - orCost
  
  return { profit, reimbursement, orCost, payerReimbursement, defaultReimbursement }
}

// ============================================
// ISSUES BADGE COMPONENT
// ============================================

function IssuesBadge({ issues, caseId }: { issues: CaseIssue[]; caseId: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
        Unknown
      </span>
    )
  }
  
  const issueCount = issues.length
  
  // Single issue - show the tag directly
  if (issueCount === 1) {
    const issue = issues[0]
    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Link href={`/cases/${caseId}`}>
            {issue.type === 'overTime' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full cursor-pointer hover:bg-amber-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Over Time
              </span>
            )}
            {issue.type === 'delay' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full cursor-pointer hover:bg-purple-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Delay
              </span>
            )}
            {issue.type === 'lowPayer' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full cursor-pointer hover:bg-blue-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Low Payer
              </span>
            )}
            {issue.type === 'unknown' && (
              <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
                Unknown
              </span>
            )}
          </Link>
        </div>
        
        {/* Single issue tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
            <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
              {issue.type === 'overTime' && (
                <div>
                  <p className="font-medium mb-1">Over Time</p>
                  <p>{formatDuration(issue.actualMinutes)} vs {formatDuration(issue.expectedMinutes)} expected</p>
                  <p className="text-amber-300">+{issue.percentOver.toFixed(0)}% over average</p>
                </div>
              )}
              {issue.type === 'delay' && (
                <div>
                  <p className="font-medium mb-1">Recorded Delays</p>
                  {issue.delays.map((d, i) => (
                    <p key={i}>• {d.name}{d.minutes ? ` (${d.minutes} min)` : ''}</p>
                  ))}
                  {issue.totalMinutes > 0 && (
                    <p className="text-purple-300 mt-1">Total: {issue.totalMinutes} min</p>
                  )}
                </div>
              )}
              {issue.type === 'lowPayer' && (
                <div>
                  <p className="font-medium mb-1">Low Payer Rate</p>
                  <p>{issue.payerName}: {formatCurrency(issue.payerRate)}</p>
                  <p>vs Default: {formatCurrency(issue.defaultRate)}</p>
                  <p className="text-blue-300">-{issue.percentBelow.toFixed(0)}% below</p>
                </div>
              )}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    )
  }
  
  // Multiple issues - show count badge
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Link href={`/cases/${caseId}`}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full cursor-pointer hover:bg-red-200 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {issueCount} Issues
          </span>
        </Link>
      </div>
      
      {/* Multi-issue tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-slate-900 text-white text-xs rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
            <div className="space-y-3">
              {issues.map((issue, i) => (
                <div key={i} className={i > 0 ? 'pt-2 border-t border-slate-700' : ''}>
                  {issue.type === 'overTime' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-amber-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Over Time
                      </div>
                      <p className="text-slate-300">{formatDuration(issue.actualMinutes)} vs {formatDuration(issue.expectedMinutes)}</p>
                      <p className="text-slate-400">+{issue.percentOver.toFixed(0)}% over average</p>
                    </div>
                  )}
                  {issue.type === 'delay' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-purple-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Delays
                      </div>
                      {issue.delays.slice(0, 3).map((d, j) => (
                        <p key={j} className="text-slate-300">• {d.name}{d.minutes ? ` (${d.minutes}m)` : ''}</p>
                      ))}
                      {issue.delays.length > 3 && (
                        <p className="text-slate-400">+{issue.delays.length - 3} more</p>
                      )}
                    </div>
                  )}
                  {issue.type === 'lowPayer' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-blue-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Low Payer
                      </div>
                      <p className="text-slate-300">{issue.payerName}</p>
                      <p className="text-slate-400">{formatCurrency(issue.payerRate)} vs {formatCurrency(issue.defaultRate)}</p>
                    </div>
                  )}
                  {issue.type === 'unknown' && (
                    <div>
                      <p className="text-slate-400">Unknown cause</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  )
}

// ============================================
// SUB-TAB COMPONENTS
// ============================================

// Date Range Selector
function DateRangeSelector({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (value: string, startDate: string, endDate: string) => void 
}) {
  const today = new Date()
  
  const ranges = [
    { 
      id: 'mtd', 
      label: 'MTD',
      getRange: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start, end: today }
      }
    },
    { 
      id: 'qtd', 
      label: 'QTD',
      getRange: () => {
        const quarter = Math.floor(today.getMonth() / 3)
        const start = new Date(today.getFullYear(), quarter * 3, 1)
        return { start, end: today }
      }
    },
    { 
      id: 'ytd', 
      label: 'YTD',
      getRange: () => {
        const start = new Date(today.getFullYear(), 0, 1)
        return { start, end: today }
      }
    },
    { 
      id: 'last30', 
      label: 'Last 30 Days',
      getRange: () => {
        const start = new Date(today)
        start.setDate(start.getDate() - 30)
        return { start, end: today }
      }
    },
  ]

  const handleChange = (rangeId: string) => {
    const range = ranges.find(r => r.id === rangeId)
    if (range) {
      const { start, end } = range.getRange()
      onChange(
        rangeId, 
        start.toISOString().split('T')[0], 
        end.toISOString().split('T')[0]
      )
    }
  }

  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
      {ranges.map(range => (
        <button
          key={range.id}
          onClick={() => handleChange(range.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === range.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}

// Metric Card
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  variant = 'default',
  onClick 
}: { 
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; positive: boolean }
  variant?: 'default' | 'success' | 'warning' | 'danger'
  onClick?: () => void
}) {
  const variants = {
    default: 'bg-white border-slate-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  }
  
  const textVariants = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  }

  return (
    <div 
      className={`rounded-xl border p-5 transition-all ${variants[variant]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-bold ${textVariants[variant]}`}>{value}</p>
        {trend && (
          <span className={`text-sm font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// Slide-out Panel
function SlideOutPanel({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function FinancialsAnalyticsPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin } = useUser()
  
  // Facility handling
  const [effectiveFacilityId, setEffectiveFacilityId] = useState<string | null>(null)
  const [noFacilitySelected, setNoFacilitySelected] = useState(false)
  const [facilityCheckComplete, setFacilityCheckComplete] = useState(false)
  
  // Data state
  const [cases, setCases] = useState<CaseWithFinancials[]>([])
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null)
  const [reimbursements, setReimbursements] = useState<ProcedureReimbursement[]>([])
  const [loading, setLoading] = useState(true)
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'procedure' | 'surgeon' | 'outliers'>('overview')
  const [dateRange, setDateRange] = useState('mtd')
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [slideOutData, setSlideOutData] = useState<{ type: 'surgeon' | 'procedure' | 'case'; data: unknown } | null>(null)

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

  // Fetch data
  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)

    // Get date range
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const start = startDate || monthStart.toISOString().split('T')[0]
    const end = endDate || today.toISOString().split('T')[0]

    const [casesRes, facilityRes, reimbursementsRes] = await Promise.all([
      supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          surgeon_id,
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
          procedure_type_id,
          procedure_types (id, name, soft_goods_cost, hard_goods_cost),
          payer_id,
          payers (id, name),
          case_milestones (
            milestone_type_id,
            recorded_at,
            milestone_types (name)
          ),
          case_delays (
            id,
            delay_type_id,
            duration_minutes,
            notes,
            delay_types (name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date', { ascending: false }),
      
      supabase
        .from('facilities')
        .select('or_hourly_rate')
        .eq('id', effectiveFacilityId)
        .single(),
      
      supabase
        .from('procedure_reimbursements')
        .select('procedure_type_id, payer_id, reimbursement')
        .order('effective_date', { ascending: false }),
    ])

    setCases((casesRes.data as unknown as CaseWithFinancials[]) || [])
    setFacilitySettings(facilityRes.data as FacilitySettings)
    setReimbursements((reimbursementsRes.data as ProcedureReimbursement[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (effectiveFacilityId) {
      fetchData()
    }
  }, [effectiveFacilityId])

  const handleDateRangeChange = (range: string, startDate: string, endDate: string) => {
    setDateRange(range)
    fetchData(startDate, endDate)
  }

  // ============================================
  // CALCULATE METRICS
  // ============================================
  
  const metrics = useMemo(() => {
    const orRate = facilitySettings?.or_hourly_rate || 0
    
    // Calculate profit for each case
    const casesWithProfit = cases
      .map(c => {
        const result = calculateCaseProfit(c, orRate, reimbursements)
        return result ? { ...c, ...result, duration: getCaseDurationMinutes(c.case_milestones) } : null
      })
      .filter((c): c is CaseWithFinancials & { profit: number; reimbursement: number; orCost: number; payerReimbursement: number | null; defaultReimbursement: number | null; duration: number } => c !== null)

    // Summary metrics
    const totalProfit = casesWithProfit.reduce((sum, c) => sum + c.profit, 0)
    const totalReimbursement = casesWithProfit.reduce((sum, c) => sum + c.reimbursement, 0)
    const avgProfit = casesWithProfit.length > 0 ? totalProfit / casesWithProfit.length : 0
    const avgMargin = totalReimbursement > 0 ? (totalProfit / totalReimbursement) * 100 : 0

    // Calculate standard deviation for outlier detection
    const profitValues = casesWithProfit.map(c => c.profit)
    const profitMean = avgProfit
    const profitStdDev = profitValues.length > 1 
      ? Math.sqrt(profitValues.reduce((sum, p) => sum + Math.pow(p - profitMean, 2), 0) / profitValues.length)
      : 0

    // Outliers (cases below 1 std dev)
    const outlierThreshold = profitMean - profitStdDev
    const outlierCases = casesWithProfit.filter(c => c.profit < outlierThreshold)

    // Procedure breakdown
    const procedureMap = new Map<string, typeof casesWithProfit>()
    casesWithProfit.forEach(c => {
      if (c.procedure_types) {
        const key = c.procedure_types.id
        if (!procedureMap.has(key)) procedureMap.set(key, [])
        procedureMap.get(key)!.push(c)
      }
    })

    const procedureStats: ProcedureStats[] = Array.from(procedureMap.entries())
      .map(([procId, procCases]) => {
        const procTotal = procCases.reduce((sum, c) => sum + c.profit, 0)
        const procReimbursement = procCases.reduce((sum, c) => sum + c.reimbursement, 0)
        const procAvgDuration = procCases.reduce((sum, c) => sum + (c.duration || 0), 0) / procCases.length
        
        // Surgeon breakdown for this procedure
        const surgeonMap = new Map<string, typeof procCases>()
        procCases.forEach(c => {
          if (c.surgeon_id && c.surgeon) {
            if (!surgeonMap.has(c.surgeon_id)) surgeonMap.set(c.surgeon_id, [])
            surgeonMap.get(c.surgeon_id)!.push(c)
          }
        })

        const surgeonBreakdown: SurgeonStats[] = Array.from(surgeonMap.entries())
          .map(([surgeonId, surgeonCases]) => {
            const surgeonName = surgeonCases[0].surgeon 
              ? `Dr. ${surgeonCases[0].surgeon.first_name} ${surgeonCases[0].surgeon.last_name}`
              : 'Unknown'
            const surgeonTotal = surgeonCases.reduce((sum, c) => sum + c.profit, 0)
            const surgeonAvgDuration = surgeonCases.reduce((sum, c) => sum + (c.duration || 0), 0) / surgeonCases.length
            const durationDiff = surgeonAvgDuration - procAvgDuration
            const profitImpact = -durationDiff * (orRate / 60) // Negative duration diff = positive profit impact

            return {
              surgeonId,
              surgeonName,
              totalProfit: surgeonTotal,
              avgProfit: surgeonTotal / surgeonCases.length,
              caseCount: surgeonCases.length,
              avgDurationMinutes: surgeonAvgDuration,
              durationVsAvgMinutes: durationDiff,
              profitImpact,
            }
          })
          .filter(s => s.caseCount >= 1) // Show all, but flag those below threshold
          .sort((a, b) => b.avgProfit - a.avgProfit)

        return {
          procedureId: procId,
          procedureName: procCases[0].procedure_types?.name || 'Unknown',
          totalProfit: procTotal,
          avgProfit: procTotal / procCases.length,
          avgMarginPercent: procReimbursement > 0 ? (procTotal / procReimbursement) * 100 : 0,
          caseCount: procCases.length,
          avgDurationMinutes: procAvgDuration,
          surgeonBreakdown,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // Overall surgeon stats
    const surgeonMap = new Map<string, typeof casesWithProfit>()
    casesWithProfit.forEach(c => {
      if (c.surgeon_id && c.surgeon) {
        if (!surgeonMap.has(c.surgeon_id)) surgeonMap.set(c.surgeon_id, [])
        surgeonMap.get(c.surgeon_id)!.push(c)
      }
    })

    const overallAvgDuration = casesWithProfit.length > 0
      ? casesWithProfit.reduce((sum, c) => sum + (c.duration || 0), 0) / casesWithProfit.length
      : 0

    const surgeonStats: SurgeonStats[] = Array.from(surgeonMap.entries())
      .map(([surgeonId, surgeonCases]) => {
        const surgeonName = surgeonCases[0].surgeon 
          ? `Dr. ${surgeonCases[0].surgeon.first_name} ${surgeonCases[0].surgeon.last_name}`
          : 'Unknown'
        const surgeonTotal = surgeonCases.reduce((sum, c) => sum + c.profit, 0)
        const surgeonAvgDuration = surgeonCases.reduce((sum, c) => sum + (c.duration || 0), 0) / surgeonCases.length
        const durationDiff = surgeonAvgDuration - overallAvgDuration
        const profitImpact = -durationDiff * (orRate / 60)

        return {
          surgeonId,
          surgeonName,
          totalProfit: surgeonTotal,
          avgProfit: surgeonTotal / surgeonCases.length,
          caseCount: surgeonCases.length,
          avgDurationMinutes: surgeonAvgDuration,
          durationVsAvgMinutes: durationDiff,
          profitImpact,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    // Outlier case details with multi-issue detection
    const outlierDetails: OutlierCase[] = outlierCases.map(c => {
      const procedureCases = procedureMap.get(c.procedure_type_id || '')
      const expectedDuration = procedureCases 
        ? procedureCases.reduce((sum, pc) => sum + (pc.duration || 0), 0) / procedureCases.length
        : c.duration || 0
      const expectedProfit = avgProfit

      // Detect all applicable issues
      const issues: CaseIssue[] = []

      // 1. Over Time check (30% over expected)
      const actualDuration = c.duration || 0
      if (actualDuration > expectedDuration * 1.3) {
        const percentOver = ((actualDuration - expectedDuration) / expectedDuration) * 100
        issues.push({
          type: 'overTime',
          actualMinutes: actualDuration,
          expectedMinutes: expectedDuration,
          percentOver,
        })
      }

      // 2. Delay check (has recorded delays)
      if (c.case_delays && c.case_delays.length > 0) {
        const delays = c.case_delays.map(d => ({
          name: d.delay_types?.name || 'Unknown Delay',
          minutes: d.duration_minutes,
        }))
        const totalMinutes = c.case_delays.reduce((sum, d) => sum + (d.duration_minutes || 0), 0)
        issues.push({
          type: 'delay',
          delays,
          totalMinutes,
        })
      }

      // 3. Low Payer check (payer rate < 80% of default)
      if (c.payer_id && c.payerReimbursement && c.defaultReimbursement) {
        const percentBelow = ((c.defaultReimbursement - c.payerReimbursement) / c.defaultReimbursement) * 100
        if (percentBelow >= 20) {
          issues.push({
            type: 'lowPayer',
            payerName: c.payers?.name || 'Unknown Payer',
            payerRate: c.payerReimbursement,
            defaultRate: c.defaultReimbursement,
            percentBelow,
          })
        }
      }

      // If no issues detected, add unknown
      if (issues.length === 0) {
        issues.push({ type: 'unknown' })
      }

      return {
        caseId: c.id,
        caseNumber: c.case_number,
        date: c.scheduled_date,
        surgeonName: c.surgeon ? `Dr. ${c.surgeon.first_name} ${c.surgeon.last_name}` : 'Unknown',
        procedureName: c.procedure_types?.name || 'Unknown',
        expectedProfit,
        actualProfit: c.profit,
        gap: c.profit - expectedProfit,
        durationMinutes: actualDuration,
        expectedDurationMinutes: expectedDuration,
        issues,
      }
    }).sort((a, b) => a.gap - b.gap)

    // Count issues by type
    const issueStats = {
      overTime: outlierDetails.filter(o => o.issues.some(i => i.type === 'overTime')).length,
      delay: outlierDetails.filter(o => o.issues.some(i => i.type === 'delay')).length,
      lowPayer: outlierDetails.filter(o => o.issues.some(i => i.type === 'lowPayer')).length,
      unknown: outlierDetails.filter(o => o.issues.some(i => i.type === 'unknown')).length,
    }

    // Time = Money calculations
    const costPerMinute = orRate / 60
    const excessTimeMinutes = casesWithProfit.reduce((sum, c) => {
      const procedureCases = procedureMap.get(c.procedure_type_id || '')
      if (!procedureCases) return sum
      const avgDuration = procedureCases.reduce((s, pc) => s + (pc.duration || 0), 0) / procedureCases.length
      const excess = Math.max(0, (c.duration || 0) - avgDuration)
      return sum + excess
    }, 0)
    const excessTimeCost = excessTimeMinutes * costPerMinute

    // Profit trend by date
    const profitByDate = new Map<string, number>()
    casesWithProfit.forEach(c => {
      const date = c.scheduled_date
      profitByDate.set(date, (profitByDate.get(date) || 0) + c.profit)
    })
    const profitTrend = Array.from(profitByDate.entries())
      .map(([date, profit]) => ({ date, profit }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalCases: casesWithProfit.length,
      totalProfit,
      avgProfit,
      avgMargin,
      outlierCount: outlierCases.length,
      outlierThreshold,
      costPerMinute,
      excessTimeCost,
      procedureStats,
      surgeonStats,
      outlierDetails,
      issueStats,
      profitTrend,
      orRate,
    }
  }, [cases, facilitySettings, reimbursements])

  // ============================================
  // RENDER
  // ============================================

  // Loading state
  if (userLoading || !facilityCheckComplete) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (noFacilitySelected) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <AnalyticsLayout
            title="Financial Analytics"
            description="Profitability metrics and insights"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Facility Selected</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                  Select a facility to view financial analytics.
                </p>
                <Link
                  href="/admin/facilities"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Facilities
                </Link>
              </div>
            </div>
          </AnalyticsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  // Not configured state
  if (!facilitySettings?.or_hourly_rate) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <AnalyticsLayout
            title="Financial Analytics"
            description="Profitability metrics and insights"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Financials Not Configured</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                  Set up your OR hourly rate and procedure costs to enable financial analytics.
                </p>
                <Link
                  href="/settings/financials"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Configure Financials
                </Link>
              </div>
            </div>
          </AnalyticsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Financial Analytics"
          description={`${metrics.totalCases} cases analyzed`}
          actions={
            <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
          }
        >
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {/* Sub-tabs */}
              <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'procedure', label: 'By Procedure' },
                  { id: 'surgeon', label: 'By Surgeon' },
                  { id: 'outliers', label: 'Outliers' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      title="Total Profit"
                      value={formatCurrency(metrics.totalProfit)}
                      subtitle={`${metrics.totalCases} cases`}
                      variant="success"
                    />
                    <MetricCard
                      title="Avg Profit / Case"
                      value={formatCurrency(metrics.avgProfit)}
                    />
                    <MetricCard
                      title="Avg Margin"
                      value={formatPercent(metrics.avgMargin)}
                    />
                    <MetricCard
                      title="Outlier Cases"
                      value={metrics.outlierCount}
                      subtitle="Below expected"
                      variant={metrics.outlierCount > 0 ? 'warning' : 'default'}
                      onClick={() => setActiveTab('outliers')}
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Procedures */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Procedures by Profit</h3>
                      <div className="space-y-3">
                        {metrics.procedureStats.slice(0, 5).map(proc => (
                          <div 
                            key={proc.procedureId}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              setSelectedProcedure(proc.procedureId)
                              setActiveTab('procedure')
                            }}
                          >
                            <div>
                              <p className="font-medium text-slate-900">{proc.procedureName}</p>
                              <p className="text-sm text-slate-500">{proc.caseCount} cases</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">{formatCurrency(proc.totalProfit)}</p>
                              <p className="text-sm text-slate-500">{formatCurrency(proc.avgProfit)} avg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Surgeons */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Surgeons by Profit</h3>
                      <div className="space-y-3">
                        {metrics.surgeonStats.slice(0, 5).map(surgeon => (
                          <div 
                            key={surgeon.surgeonId}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              setSelectedSurgeon(surgeon.surgeonId)
                              setActiveTab('surgeon')
                            }}
                          >
                            <div>
                              <p className="font-medium text-slate-900">{surgeon.surgeonName}</p>
                              <p className="text-sm text-slate-500">{surgeon.caseCount} cases</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">{formatCurrency(surgeon.totalProfit)}</p>
                              <p className="text-sm text-slate-500">{formatCurrency(surgeon.avgProfit)} avg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Time = Money Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6">
                      <p className="text-sm font-medium text-blue-600 mb-1">OR Cost per Minute</p>
                      <p className="text-3xl font-bold text-blue-900">{formatCurrency(metrics.costPerMinute)}</p>
                      <p className="text-sm text-blue-600 mt-2">Based on {formatCurrency(metrics.orRate)}/hr</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6">
                      <p className="text-sm font-medium text-amber-600 mb-1">Excess Time Cost</p>
                      <p className="text-3xl font-bold text-amber-900">{formatCurrency(metrics.excessTimeCost)}</p>
                      <p className="text-sm text-amber-600 mt-2">Time above procedure averages</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-6">
                      <p className="text-sm font-medium text-emerald-600 mb-1">10-Min Savings Value</p>
                      <p className="text-3xl font-bold text-emerald-900">{formatCurrency(metrics.costPerMinute * 10)}</p>
                      <p className="text-sm text-emerald-600 mt-2">Potential savings per case</p>
                    </div>
                  </div>

                  {/* Profit Trend Chart */}
                  {metrics.profitTrend.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Profit Trend</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={metrics.profitTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#334155" 
                            fontSize={12}
                            tickFormatter={(date) => {
                              const [y, m, d] = date.split('-').map(Number)
                              return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            }}
                          />
                          <YAxis 
                            stroke="#334155" 
                            fontSize={12}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            formatter={(value) => [formatCurrency(value as number), 'Daily Profit']}
                            labelFormatter={(date) => {
                              const [y, m, d] = (date as string).split('-').map(Number)
                              return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: '#10b981', r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* BY PROCEDURE TAB */}
              {activeTab === 'procedure' && (
                <div className="space-y-6">
                  {/* Procedure Filter */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Procedure:</label>
                    <select
                      value={selectedProcedure || ''}
                      onChange={(e) => setSelectedProcedure(e.target.value || null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      <option value="">All Procedures</option>
                      {metrics.procedureStats.map(proc => (
                        <option key={proc.procedureId} value={proc.procedureId}>
                          {proc.procedureName} ({proc.caseCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProcedure ? (
                    // Single procedure detail
                    (() => {
                      const proc = metrics.procedureStats.find(p => p.procedureId === selectedProcedure)
                      if (!proc) return null
                      
                      return (
                        <>
                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard title="Avg Profit" value={formatCurrency(proc.avgProfit)} />
                            <MetricCard title="Avg Duration" value={`${Math.round(proc.avgDurationMinutes)} min`} />
                            <MetricCard title="Margin" value={formatPercent(proc.avgMarginPercent)} />
                            <MetricCard title="Cases" value={proc.caseCount} />
                          </div>

                          {/* Surgeon Breakdown */}
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200">
                              <h3 className="text-lg font-semibold text-slate-900">Surgeon Breakdown</h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Avg</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {proc.surgeonBreakdown.map(surgeon => (
                                    <tr key={surgeon.surgeonId} className="hover:bg-slate-50">
                                      <td className="px-6 py-4">
                                        <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                                        {surgeon.caseCount < 10 && (
                                          <span className="ml-2 text-xs text-amber-600">*</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                                      <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                        {formatCurrency(surgeon.avgProfit)}
                                      </td>
                                      <td className="px-6 py-4 text-right text-slate-600">
                                        {Math.round(surgeon.avgDurationMinutes)} min
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className={surgeon.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                                          {surgeon.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsAvgMinutes)} min
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                          {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {proc.surgeonBreakdown.some(s => s.caseCount < 10) && (
                              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                                <p className="text-xs text-slate-500">* Below minimum threshold (10 cases) for statistical reliability</p>
                              </div>
                            )}
                          </div>
                        </>
                      )
                    })()
                  ) : (
                    // All procedures table
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Margin</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics.procedureStats.map(proc => (
                              <tr 
                                key={proc.procedureId} 
                                className="hover:bg-slate-50 cursor-pointer"
                                onClick={() => setSelectedProcedure(proc.procedureId)}
                              >
                                <td className="px-6 py-4 font-medium text-slate-900">{proc.procedureName}</td>
                                <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                                <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                                  {formatCurrency(proc.totalProfit)}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(proc.avgProfit)}</td>
                                <td className="px-6 py-4 text-right text-slate-600">{formatPercent(proc.avgMarginPercent)}</td>
                                <td className="px-6 py-4 text-right text-slate-600">{Math.round(proc.avgDurationMinutes)} min</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BY SURGEON TAB */}
              {activeTab === 'surgeon' && (
                <div className="space-y-6">
                  {/* Surgeon Filter */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Surgeon:</label>
                    <select
                      value={selectedSurgeon || ''}
                      onChange={(e) => setSelectedSurgeon(e.target.value || null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      <option value="">All Surgeons</option>
                      {metrics.surgeonStats.map(surgeon => (
                        <option key={surgeon.surgeonId} value={surgeon.surgeonId}>
                          {surgeon.surgeonName} ({surgeon.caseCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSurgeon ? (
                    // Single surgeon detail
                    (() => {
                      const surgeon = metrics.surgeonStats.find(s => s.surgeonId === selectedSurgeon)
                      if (!surgeon) return null

                      // Get procedure breakdown for this surgeon
                      const surgeonProcedures = metrics.procedureStats
                        .map(proc => {
                          const surgeonData = proc.surgeonBreakdown.find(s => s.surgeonId === selectedSurgeon)
                          if (!surgeonData) return null
                          return {
                            procedureName: proc.procedureName,
                            ...surgeonData,
                            facilityAvgDuration: proc.avgDurationMinutes,
                          }
                        })
                        .filter(Boolean)
                      
                      return (
                        <>
                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard 
                              title="Total Profit" 
                              value={formatCurrency(surgeon.totalProfit)}
                              variant="success"
                            />
                            <MetricCard title="Avg Profit / Case" value={formatCurrency(surgeon.avgProfit)} />
                            <MetricCard 
                              title="Time vs Avg" 
                              value={`${surgeon.durationVsAvgMinutes > 0 ? '+' : ''}${Math.round(surgeon.durationVsAvgMinutes)} min`}
                              variant={surgeon.durationVsAvgMinutes < 0 ? 'success' : surgeon.durationVsAvgMinutes > 10 ? 'warning' : 'default'}
                            />
                            <MetricCard title="Cases" value={surgeon.caseCount} />
                          </div>

                          {/* Procedure Breakdown */}
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200">
                              <h3 className="text-lg font-semibold text-slate-900">By Procedure</h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Profit</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Time</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {surgeonProcedures.map((proc: any) => (
                                    <tr key={proc.procedureName} className="hover:bg-slate-50">
                                      <td className="px-6 py-4 font-medium text-slate-900">{proc.procedureName}</td>
                                      <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                                      <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                        {formatCurrency(proc.avgProfit)}
                                      </td>
                                      <td className="px-6 py-4 text-right text-slate-600">
                                        {Math.round(proc.avgDurationMinutes)} min
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <span className={proc.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                                          {proc.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(proc.durationVsAvgMinutes)} min
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )
                    })()
                  ) : (
                    // All surgeons comparison
                    <>
                      {/* Comparison Table */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Per Case</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Time vs Avg</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Impact</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {metrics.surgeonStats.map((surgeon, idx) => (
                                <tr 
                                  key={surgeon.surgeonId} 
                                  className="hover:bg-slate-50 cursor-pointer"
                                  onClick={() => setSelectedSurgeon(surgeon.surgeonId)}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                                      }`}>
                                        {idx + 1}
                                      </div>
                                      <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
                                      {surgeon.caseCount < 10 && (
                                        <span className="text-xs text-amber-600">*</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center text-slate-600">{surgeon.caseCount}</td>
                                  <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                                    {formatCurrency(surgeon.totalProfit)}
                                  </td>
                                  <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(surgeon.avgProfit)}</td>
                                  <td className="px-6 py-4 text-right">
                                    <span className={surgeon.durationVsAvgMinutes < 0 ? 'text-emerald-600' : 'text-red-500'}>
                                      {surgeon.durationVsAvgMinutes > 0 ? '+' : ''}{Math.round(surgeon.durationVsAvgMinutes)} min
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <span className={surgeon.profitImpact > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                      {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}/case
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {metrics.surgeonStats.some(s => s.caseCount < 10) && (
                          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                            <p className="text-xs text-slate-500">* Below minimum threshold (10 cases) for statistical reliability</p>
                          </div>
                        )}
                      </div>

                      {/* Scatter Plot */}
                      {metrics.surgeonStats.length > 1 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                          <h3 className="text-lg font-semibold text-slate-900 mb-4">Time vs Profit Analysis</h3>
                          <p className="text-sm text-slate-500 mb-4">Top-left quadrant = fast and profitable</p>
                          <ResponsiveContainer width="100%" height={300}>
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                type="number" 
                                dataKey="avgDurationMinutes" 
                                name="Avg Duration" 
                                unit=" min"
                                label={{ value: 'Avg Duration (min)', position: 'bottom' }}
                              />
                              <YAxis 
                                type="number" 
                                dataKey="avgProfit" 
                                name="Avg Profit"
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                label={{ value: 'Avg Profit', angle: -90, position: 'left' }}
                              />
                              <Tooltip 
                                formatter={(value: any, name: any) => {
                                  if (value === undefined) return '-'
                                  if (name === 'Avg Profit') return formatCurrency(value)
                                  return `${Math.round(value)} min`
                                }}
                                labelFormatter={(_, payload: any) => payload?.[0]?.payload?.surgeonName || ''}
                              />
                              <Scatter 
                                data={metrics.surgeonStats.filter(s => s.caseCount >= 5)} 
                                fill="#2563eb"
                              >
                                {metrics.surgeonStats.filter(s => s.caseCount >= 5).map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.profitImpact > 0 ? '#10b981' : '#ef4444'} 
                                  />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* OUTLIERS TAB */}
              {activeTab === 'outliers' && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <MetricCard 
                      title="Outlier Cases" 
                      value={metrics.outlierCount}
                      subtitle="Below 1 std dev"
                      variant={metrics.outlierCount > 0 ? 'warning' : 'success'}
                    />
                    <MetricCard 
                      title="Total Gap" 
                      value={formatCurrency(metrics.outlierDetails.reduce((sum, c) => sum + c.gap, 0))}
                      subtitle="vs expected profit"
                      variant="danger"
                    />
                    <MetricCard 
                      title="Over Time" 
                      value={metrics.issueStats.overTime}
                      subtitle="Cases with excess time"
                    />
                    <MetricCard 
                      title="With Delays" 
                      value={metrics.issueStats.delay}
                      subtitle="Cases with delays"
                    />
                    <MetricCard 
                      title="Low Payer" 
                      value={metrics.issueStats.lowPayer}
                      subtitle="Below-average payer"
                    />
                  </div>

                  {/* Outlier Cases Table */}
                  {metrics.outlierDetails.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900">Cases Below Expected Profit</h3>
                        <p className="text-sm text-slate-500">Sorted by largest gap from expected • Hover issues for details</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actual</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Gap</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Issues</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {metrics.outlierDetails.map(outlier => (
                              <tr key={outlier.caseId} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-sm text-slate-600">{outlier.date}</td>
                                <td className="px-6 py-4">
                                  <Link href={`/cases/${outlier.caseId}`} className="text-blue-600 hover:underline font-medium">
                                    {outlier.caseNumber}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-900">{outlier.surgeonName}</td>
                                <td className="px-6 py-4 text-sm text-slate-600">{outlier.procedureName}</td>
                                <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                                  {formatCurrency(outlier.actualProfit)}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">
                                  {formatCurrency(outlier.gap)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <IssuesBadge issues={outlier.issues} caseId={outlier.caseId} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No Outliers Detected</h3>
                      <p className="text-slate-500">All cases are within expected profit ranges.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}
