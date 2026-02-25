// app/analytics/financials/procedures/[id]/page.tsx
// URL-routed procedure detail page
// Fetches data independently, computes metrics, renders ProcedureDetail

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { AnalyticsPageHeader } from '@/components/analytics/AnalyticsBreadcrumb'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageLoader } from '@/components/ui/Loading'
import AccessDenied from '@/components/ui/AccessDenied'
import DateRangeSelector from '@/components/ui/DateRangeSelector'
import { getLocalDateString } from '@/lib/date-utils'
import {
  CaseCompletionStats,
  SurgeonProcedureStats,
  FacilityProcedureStats,
  FacilitySettings,
} from '@/components/analytics/financials/types'
import { useFinancialsMetrics } from '@/components/analytics/financials/useFinancialsMetrics'
import ProcedureDetail from '@/components/analytics/financials/ProcedureDetail'

export default function ProcedureDetailPage() {
  const params = useParams()
  const router = useRouter()
  const procedureId = params.id as string
  const supabase = createClient()
  const { loading: userLoading, effectiveFacilityId, can } = useUser()
  const { showToast } = useToast()

  // Data state
  const [caseStats, setCaseStats] = useState<CaseCompletionStats[]>([])
  const [surgeonProcedureStats, setSurgeonProcedureStats] = useState<SurgeonProcedureStats[]>([])
  const [facilityProcedureStats, setFacilityProcedureStats] = useState<FacilityProcedureStats[]>([])
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null)
  const [procedureName, setProcedureName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [dateRange, setDateRange] = useState('mtd')

  // Compute metrics
  const metrics = useFinancialsMetrics(
    caseStats,
    surgeonProcedureStats,
    facilityProcedureStats,
    facilitySettings
  )

  // Fetch data
  const fetchData = useCallback(
    async (startDate?: string, endDate?: string) => {
      if (!effectiveFacilityId) return

      setLoading(true)
      setError(null)

      const today = new Date()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const start = startDate || getLocalDateString(monthStart)
      const end = endDate || getLocalDateString(today)

      try {
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
          supabase
            .from('case_completion_stats')
            .select('*')
            .eq('facility_id', effectiveFacilityId)
            .gte('case_date', start)
            .lte('case_date', end)
            .order('case_date', { ascending: false }),
          supabase
            .from('surgeon_procedure_stats')
            .select('*')
            .eq('facility_id', effectiveFacilityId),
          supabase
            .from('facility_procedure_stats')
            .select('*')
            .eq('facility_id', effectiveFacilityId),
          supabase
            .from('facilities')
            .select('or_hourly_rate')
            .eq('id', effectiveFacilityId)
            .single(),
          supabase
            .from('procedure_types')
            .select('id, name')
            .eq('facility_id', effectiveFacilityId),
          supabase
            .from('payers')
            .select('id, name')
            .eq('facility_id', effectiveFacilityId),
          supabase
            .from('or_rooms')
            .select('id, name')
            .eq('facility_id', effectiveFacilityId),
          supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('facility_id', effectiveFacilityId),
        ])

        if (caseStatsRes.error) {
          showToast({ type: 'error', title: 'Error fetching case stats', message: caseStatsRes.error.message })
        }

        // Build lookup maps
        const procedureMap = new Map<string, { id: string; name: string }>()
        for (const p of procedureTypesRes.data || []) {
          procedureMap.set(p.id, { id: p.id, name: p.name })
        }

        // Set procedure name from lookup
        const procLookup = procedureMap.get(procedureId)
        setProcedureName(procLookup?.name ?? 'Unknown Procedure')

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

        // Enrich case stats with lookup data
        const enrichedCaseStats = (caseStatsRes.data || []).map((row: CaseCompletionStats) => ({
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
          message: err instanceof Error ? err.message : 'Please try again',
        })
      }

      setLoading(false)
    },
    [effectiveFacilityId, supabase, showToast, procedureId]
  )

  useEffect(() => {
    if (effectiveFacilityId) {
      fetchData()
    }
    // fetchData is stable (useCallback) and only changes when its dependencies change,
    // which are already in the effect dependencies via effectiveFacilityId.
    // Including it here would be redundant and trigger the react-hooks/set-state-in-effect warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFacilityId])

  const handleDateRangeChange = (range: string, startDate: string, endDate: string) => {
    setDateRange(range)
    fetchData(startDate, endDate)
  }

  // Find the specific procedure from computed metrics
  const procedure = metrics.procedureStats.find(p => p.procedureId === procedureId)

  // Filter raw cases to this procedure
  const procedureCases = caseStats.filter(c => c.procedure_type_id === procedureId)

  // Permission guard
  if (!userLoading && !can('financials.view')) {
    return (
      <DashboardLayout>
        <AccessDenied />
      </DashboardLayout>
    )
  }

  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading procedure detail..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <AnalyticsPageHeader
        title="Financial Analytics"
        description={
          procedure
            ? `${procedureName} · ${procedure.caseCount} cases`
            : `${procedureName}`
        }
        actions={<DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />}
      />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <PageLoader message="Loading procedure data..." />
      ) : !procedure ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Data Found</h3>
          <p className="text-slate-500 mb-4">
            No cases found for this procedure in the selected date range.
          </p>
          <button
            onClick={() => router.push('/analytics/financials')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Financial Analytics
          </button>
        </div>
      ) : (
        <ProcedureDetail
          procedure={procedure}
          cases={procedureCases}
          onBack={() => router.push('/analytics/financials')}
        />
      )}
    </DashboardLayout>
  )
}
