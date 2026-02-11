//app/analytics/financials/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'

import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { AlertTriangle, DollarSign, DollarSignIcon } from 'lucide-react'
import { PageLoader } from '@/components/ui/Loading'

// Local components
import { 
  CaseCompletionStats, 
  SurgeonProcedureStats, 
  FacilityProcedureStats,
  FacilitySettings, 
  SubTab 
} from '@/components/analytics/financials/types'
import { useFinancialsMetrics } from '@/components/analytics/financials/useFinancialsMetrics'
import DateRangeSelector from '@/components/ui/DateRangeSelector'
import OverviewTab from '@/components/analytics/financials/OverviewTab'
import ProcedureTab from '@/components/analytics/financials/ProcedureTab'
import SurgeonTab from '@/components/analytics/financials/SurgeonTab'
import { Sign } from 'crypto'

export default function FinancialsAnalyticsPage() {
  const supabase = createClient()
  const { userData, loading: userLoading, isGlobalAdmin, effectiveFacilityId } = useUser()
  
  // Data state - Using view data
  const [caseStats, setCaseStats] = useState<CaseCompletionStats[]>([])
  const [surgeonProcedureStats, setSurgeonProcedureStats] = useState<SurgeonProcedureStats[]>([])
  const [facilityProcedureStats, setFacilityProcedureStats] = useState<FacilityProcedureStats[]>([])
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [activeTab, setActiveTab] = useState<SubTab>('overview')
  const [dateRange, setDateRange] = useState('mtd')
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const { showToast } = useToast()
  // Calculate metrics using custom hook
  const metrics = useFinancialsMetrics(
    caseStats, 
    surgeonProcedureStats, 
    facilityProcedureStats, 
    facilitySettings
  )

  // Fetch data from views
  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!effectiveFacilityId) return
    
    setLoading(true)
    setError(null)
    // Get date range
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const start = startDate || monthStart.toISOString().split('T')[0]
    const end = endDate || today.toISOString().split('T')[0]

    try {
      // -------------------------------------------------------
      // FIX: Don't use PostgREST joins on materialized views.
      // case_completion_stats is a materialized view — PostgREST 
      // can't auto-detect foreign keys on views, causing 400 errors.
      // Instead, fetch lookup tables separately and merge client-side.
      // -------------------------------------------------------
      const [
        caseStatsRes, 
        surgeonStatsRes, 
        facilityStatsRes, 
        facilityRes,
        procedureTypesRes,
        payersRes,
        orRoomsRes,
        surgeonsRes,
      ] = await Promise.all([
        // 1. Fetch case-level stats (NO joins — just the flat view data)
        supabase
          .from('case_completion_stats')
          .select('*')
          .eq('facility_id', effectiveFacilityId)
          .gte('case_date', start)
          .lte('case_date', end)
          .order('case_date', { ascending: false }),
        
        // 2. Fetch surgeon+procedure stats (pre-computed)
        supabase
          .from('surgeon_procedure_stats')
          .select('*')
          .eq('facility_id', effectiveFacilityId),
        
        // 3. Fetch facility+procedure stats (pre-computed)
        supabase
          .from('facility_procedure_stats')
          .select('*')
          .eq('facility_id', effectiveFacilityId),
        
        // 4. Fetch facility settings
        supabase
          .from('facilities')
          .select('or_hourly_rate')
          .eq('id', effectiveFacilityId)
          .single(),

        // 5. Lookup: procedure types for this facility
        supabase
          .from('procedure_types')
          .select('id, name')
          .eq('facility_id', effectiveFacilityId),

        // 6. Lookup: payers for this facility
        supabase
          .from('payers')
          .select('id, name')
          .eq('facility_id', effectiveFacilityId),

        // 7. Lookup: OR rooms for this facility
        supabase
          .from('or_rooms')
          .select('id, name')
          .eq('facility_id', effectiveFacilityId),

        // 8. Lookup: surgeons (users) for this facility
        supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('facility_id', effectiveFacilityId),
      ])

// Handle errors
if (caseStatsRes.error) {
  showToast({
    type: 'error',
    title: 'Error fetching case stats',
    message: caseStatsRes.error.message  // ← Just .message, no instanceof!
  })
}
if (surgeonStatsRes.error) {
  showToast({
    type: 'error',
    title: 'Error fetching surgeon stats',
    message: surgeonStatsRes.error.message
  })
}
if (facilityStatsRes.error) {
  showToast({
    type: 'error',
    title: 'Error fetching facility stats',
    message: facilityStatsRes.error.message
  })
}

      // Build lookup maps from separately-fetched reference tables
      const procedureMap = new Map<string, { id: string; name: string }>()
      for (const p of procedureTypesRes.data || []) {
        procedureMap.set(p.id, { id: p.id, name: p.name })
      }

      const payerMap = new Map<string, { id: string; name: string }>()
      for (const p of payersRes.data || []) {
        payerMap.set(p.id, { id: p.id, name: p.name })
      }

      const roomMap = new Map<string, { name: string }>()
      for (const r of orRoomsRes.data || []) {
        roomMap.set(r.id, { name: r.name })
      }

      const surgeonMap = new Map<string, { first_name: string; last_name: string }>()
      for (const u of surgeonsRes.data || []) {
        surgeonMap.set(u.id, { first_name: u.first_name, last_name: u.last_name })
      }

      // Merge lookup data onto each case stat row
      // This replicates the nested objects that PostgREST joins would have produced
      const enrichedCaseStats = (caseStatsRes.data || []).map((row: any) => ({
        ...row,
        procedure_types: row.procedure_type_id ? procedureMap.get(row.procedure_type_id) || null : null,
        payers: row.payer_id ? payerMap.get(row.payer_id) || null : null,
        or_rooms: row.or_room_id ? roomMap.get(row.or_room_id) || null : null,
        surgeon: row.surgeon_id ? surgeonMap.get(row.surgeon_id) || null : null,
      }))

      setCaseStats(enrichedCaseStats as CaseCompletionStats[])
      setSurgeonProcedureStats((surgeonStatsRes.data as SurgeonProcedureStats[]) || [])
      setFacilityProcedureStats((facilityStatsRes.data as FacilityProcedureStats[]) || [])
      setFacilitySettings(facilityRes.data as FacilitySettings)
    } catch (err) {
      setError('Failed to load financial data. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load financial data',
        message: err instanceof Error ? err.message : 'Please try again'
      })
    }
    
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

  // Tab navigation handlers
  const handleProcedureClick = (procedureId: string) => {
    setSelectedProcedure(procedureId)
    setActiveTab('procedure')
  }

  const handleSurgeonClick = (surgeonId: string) => {
    setSelectedSurgeon(surgeonId)
    setActiveTab('surgeon')
  }

  // Loading state
  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading financial analytics..." />
      </DashboardLayout>
    )
  }

  // No facility selected (global admin)
  if (!effectiveFacilityId && isGlobalAdmin) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <AnalyticsPageHeader
            title="Financial Analytics"
            description="Profitability metrics and insights"
            icon={DollarSign}
          />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-blue-500" />
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
        </Container>
      </DashboardLayout>
    )
  }

  // Not configured state
  if (!facilitySettings?.or_hourly_rate) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <AnalyticsPageHeader
            title="Financial Analytics"
            description="Profitability metrics and insights"
            icon={DollarSignIcon}
          />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
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
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsPageHeader
          title="Financial Analytics"
          description={`${metrics.totalCases} cases analyzed`}
          icon={DollarSign}
          actions={
            <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
          }
        />
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {loading ? (
          <PageLoader message="Loading financial data..." />
        ) : (
          <>
            {/* Sub-tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
              {[
                { id: 'overview' as SubTab, label: 'Overview' },
                { id: 'procedure' as SubTab, label: 'By Procedure' },
                { id: 'surgeon' as SubTab, label: 'By Surgeon' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab 
                metrics={metrics}
                onProcedureClick={handleProcedureClick}
                onSurgeonClick={handleSurgeonClick}
              />
            )}

            {activeTab === 'procedure' && (
              <ProcedureTab 
                metrics={metrics}
                selectedProcedure={selectedProcedure}
                onProcedureSelect={setSelectedProcedure}
              />
            )}

            {activeTab === 'surgeon' && (
              <SurgeonTab 
                metrics={metrics}
                caseStats={caseStats}
                selectedSurgeon={selectedSurgeon}
                onSurgeonSelect={setSelectedSurgeon}
              />
            )}

          </>
        )}
      </Container>
    </DashboardLayout>
  )
}