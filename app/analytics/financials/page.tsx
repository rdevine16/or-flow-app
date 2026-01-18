'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import { getImpersonationState } from '../../../lib/impersonation'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import { AnalyticsPageHeader } from '../../../components/analytics/AnalyticsBreadcrumb'
import { CurrencyDollarIcon } from '@heroicons/react/24/outline'

// Local components
import { CaseWithFinancials, FacilitySettings, ProcedureReimbursement, SubTab } from '../../../components/analytics/financials/types'
import { useFinancialsMetrics } from '../../../components/analytics/financials/useFinancialsMetrics'
import DateRangeSelector from '../../../components/analytics/financials/DateRangeSelector'
import OverviewTab from '../../../components/analytics/financials/OverviewTab'
import ProcedureTab from '../../../components/analytics/financials/ProcedureTab'
import SurgeonTab from '../../../components/analytics/financials/SurgeonTab'
import OutliersTab from '../../../components/analytics/financials/OutliersTab'

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
  const [activeTab, setActiveTab] = useState<SubTab>('overview')
  const [dateRange, setDateRange] = useState('mtd')
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null)
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)

  // Calculate metrics using custom hook
  const metrics = useFinancialsMetrics(cases, facilitySettings, reimbursements)

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

  // Tab navigation handlers
  const handleProcedureClick = (procedureId: string) => {
    setSelectedProcedure(procedureId)
    setActiveTab('procedure')
  }

  const handleSurgeonClick = (surgeonId: string) => {
    setSelectedSurgeon(surgeonId)
    setActiveTab('surgeon')
  }

  const handleOutliersClick = () => {
    setActiveTab('outliers')
  }

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
          <AnalyticsPageHeader
            title="Financial Analytics"
            description="Profitability metrics and insights"
            icon={CurrencyDollarIcon}
          />
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
            icon={CurrencyDollarIcon}
          />
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
          icon={CurrencyDollarIcon}
          actions={
            <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
          }
        />
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
                { id: 'overview' as SubTab, label: 'Overview' },
                { id: 'procedure' as SubTab, label: 'By Procedure' },
                { id: 'surgeon' as SubTab, label: 'By Surgeon' },
                { id: 'outliers' as SubTab, label: 'Outliers' },
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
                onOutliersClick={handleOutliersClick}
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
                selectedSurgeon={selectedSurgeon}
                onSurgeonSelect={setSelectedSurgeon}
              />
            )}

            {activeTab === 'outliers' && (
              <OutliersTab metrics={metrics} />
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  )
}