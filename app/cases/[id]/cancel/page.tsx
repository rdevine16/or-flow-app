'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { BreadcrumbLabel } from '@/lib/BreadcrumbContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { caseAudit } from '@/lib/audit-logger'
import { extractName } from '@/lib/formatters'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { AlertCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { getLocalDateString } from '@/lib/date-utils'

// ============================================================================
// TYPES
// ============================================================================

interface CaseData {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  facility_id: string
  status_id: string
  surgeon_id: string | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
}

interface CaseMilestone {
  id: string
  recorded_at: string
  facility_milestones: { display_name: string; display_order: number }[] | { display_name: string; display_order: number } | null
}

interface CancellationReason {
  id: string
  display_name: string
  category: string
}

interface Metrics {
  monthCancellations: number
  surgeonCancelRate: number | null
  isDayOf: boolean
}

// ============================================================================
// HELPERS (same pattern as cases page)
// ============================================================================

const getSurgeon = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null): { name: string; fullName: string } => {
  if (!data) return { name: 'Unassigned', fullName: 'Unassigned' }
  const surgeon = Array.isArray(data) ? data[0] : data
  if (!surgeon) return { name: 'Unassigned', fullName: 'Unassigned' }
  return { 
    name: `Dr. ${surgeon.last_name}`,
    fullName: `${surgeon.first_name} ${surgeon.last_name}`
  }
}

const getMilestoneInfo = (data: { display_name: string; display_order: number }[] | { display_name: string; display_order: number } | null): { display_name: string; display_order: number } | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  return data
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { value: 'patient', label: 'Patient', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'scheduling', label: 'Scheduling', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'clinical', label: 'Clinical', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'external', label: 'External', color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function CancelCasePage() {
  const router = useRouter()
  const params = useParams()
  const caseId = params.id as string
  const supabase = createClient()
  const { loading: userLoading } = useUser()
  const { showToast } = useToast()
  // Data state
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [milestones, setMilestones] = useState<CaseMilestone[]>([])
  const [reasons, setReasons] = useState<CancellationReason[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  
  // Form state
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const calculateMetrics = useCallback(async (caseResult: CaseData) => {
    const today = getLocalDateString()
    const monthStart = new Date()
    monthStart.setDate(1)

    // Month cancellations
    const { count: monthCount } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', caseResult.facility_id)
      .not('cancelled_at', 'is', null)
      .gte('cancelled_at', getLocalDateString(monthStart))

    // Surgeon rate (90 days)
    let surgeonRate: number | null = null
    if (caseResult.surgeon_id) {
      const ninetyDaysAgo = getLocalDateString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))

      const { count: total } = await supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('surgeon_id', caseResult.surgeon_id)
        .gte('scheduled_date', ninetyDaysAgo)

      const { count: cancelled } = await supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('surgeon_id', caseResult.surgeon_id)
        .not('cancelled_at', 'is', null)
        .gte('scheduled_date', ninetyDaysAgo)

      if (total && total > 0) {
        surgeonRate = ((cancelled || 0) / total) * 100
      }
    }

    setMetrics({
      monthCancellations: monthCount || 0,
      surgeonCancelRate: surgeonRate,
      isDayOf: caseResult.scheduled_date === today,
    })
  }, [supabase])

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      // Fetch case
      const { data: caseResult, error: caseError } = await supabase
        .from('cases')
        .select(`
          id, case_number, scheduled_date, start_time, facility_id, status_id, surgeon_id,
          case_statuses(name),
          surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
          or_rooms(name),
          procedure_types(name)
        `)
        .eq('id', caseId)
        .single()

      if (caseError) throw caseError
      if (!caseResult) { setError('Case not found'); setLoading(false); return }

      setCaseData(caseResult as CaseData)

      // Check if cancellable
      const statusName = extractName(caseResult.case_statuses as CaseData['case_statuses'])
      if (statusName === 'completed' || statusName === 'cancelled') {
        setError(`This case is already ${statusName}.`)
        setLoading(false)
        return
      }

      // Fetch milestones
      const { data: milestonesResult } = await supabase
        .from('case_milestones')
        .select('id, recorded_at, facility_milestones(display_name, display_order)')
        .eq('case_id', caseId)
        .order('recorded_at')

      setMilestones((milestonesResult as CaseMilestone[]) || [])

      // Fetch reasons
      const { data: reasonsResult } = await supabase
        .from('cancellation_reasons')
        .select('id, display_name, category')
        .eq('facility_id', caseResult.facility_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('category')
        .order('display_order')

      setReasons(reasonsResult || [])

      // Calculate metrics
      await calculateMetrics(caseResult as CaseData)

    } catch {
      setError('Failed to load case data')
      showToast({
        type: 'error',
        title: 'Failed to Load Case',
        message: 'An error occurred while loading case data.'
      })
    }

    setLoading(false)
  }, [caseId, supabase, showToast, calculateMetrics])

  useEffect(() => {
    if (!userLoading && caseId) fetchData()
  }, [userLoading, caseId, fetchData])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCancel = async () => {
    if (!selectedReasonId || !caseData) return
    setSubmitting(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Get cancelled status
      const { data: cancelledStatus } = await supabase
        .from('case_statuses')
        .select('id')
        .eq('name', 'cancelled')
        .single()
      
      if (!cancelledStatus) throw new Error('Status not found')
      
      const selectedReason = reasons.find(r => r.id === selectedReasonId)
      
      // Update case - NOTE: milestones are NOT deleted
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          status_id: cancelledStatus.id,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason_id: selectedReasonId,
          cancellation_notes: notes.trim() || null,
        })
        .eq('id', caseId)
      
      if (updateError) throw updateError
      
      // Audit log
      await caseAudit.cancelled(
        supabase,
        { id: caseId, case_number: caseData.case_number },
        selectedReason?.display_name || 'Unknown',
        selectedReason?.category || 'unknown',
        milestones.length > 0,
        milestones.length,
        caseData.facility_id,
        notes.trim() || undefined
      )
      
      router.push('/cases?cancelled=true')
      
    } catch (err) {
      showToast({
  type: 'error',
  title: 'Error:',
  message: err instanceof Error ? err.message : 'Error:'
})
      setError('Failed to cancel case')
      setSubmitting(false)
    }
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return 'Not scheduled'
    const [h, m] = time.split(':').map(Number)
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  const groupedReasons = reasons.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<string, CancellationReason[]>)

  // Computed from caseData
  const statusName = caseData ? extractName(caseData.case_statuses) : null
  const isInProgress = statusName === 'in_progress'
  const hasMilestones = milestones.length > 0
  const procedureName = caseData ? extractName(caseData.procedure_types) : null
  const roomName = caseData ? extractName(caseData.or_rooms) : null
  const surgeon = caseData ? getSurgeon(caseData.surgeon) : { name: 'Unassigned', fullName: 'Unassigned' }

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================

  if (loading || userLoading) {
    return (
      <DashboardLayout>
        <BreadcrumbLabel routeKey="/cases/[id]" label={undefined} />
        <Container className="py-8">
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // RENDER - ERROR (no case)
  // ============================================================================

  if (error && !caseData) {
    return (
      <DashboardLayout>
        <BreadcrumbLabel routeKey="/cases/[id]" label={undefined} />
        <Container className="py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{error}</h2>
            <Link href="/cases" className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="w-4 h-4" />
              Back to Cases
            </Link>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================

  return (
    <DashboardLayout>
      <BreadcrumbLabel routeKey="/cases/[id]" label={caseData?.case_number ? `Case #${caseData.case_number}` : undefined} />
      <Container className="py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href={`/cases/${caseId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Case
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900">Cancel Case</h1>
            <p className="text-slate-500 mt-1">Review the case and select a cancellation reason.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {/* Case Summary */}
          {caseData && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Case #{caseData.case_number}</p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-1">
                    {procedureName || 'No procedure specified'}
                  </h2>
                  <p className="text-slate-600 mt-1">{surgeon.name}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isInProgress ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-700'
                }`}>
                  {isInProgress ? 'In Progress' : 'Scheduled'}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Date</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{formatDate(caseData.scheduled_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Time</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{formatTime(caseData.start_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Room</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{roomName || 'Not assigned'}</p>
                </div>
              </div>
            </div>
          )}

          {/* In Progress Warning */}
          {isInProgress && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-900">Case In Progress</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This case has {milestones.length} milestone{milestones.length !== 1 ? 's' : ''} recorded. 
                    All milestone data will be preserved for analytics.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Milestone Progress */}
          {hasMilestones && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h3 className="font-medium text-slate-900 mb-4">Progress at Cancellation</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {milestones
                  .map(m => ({ ...m, info: getMilestoneInfo(m.facility_milestones) }))
                  .sort((a, b) => (a.info?.display_order || 0) - (b.info?.display_order || 0))
                  .map((m, idx) => (
                    <div key={m.id} className="flex items-center gap-2">
                      {idx > 0 && <div className="w-6 h-0.5 bg-green-300" />}
                      <div className="px-3 py-1.5 bg-green-100 text-green-600 rounded-lg text-sm font-medium">
                        {m.info?.display_name || 'Unknown'}
                      </div>
                    </div>
                  ))}
              </div>
              <p className="text-sm text-slate-500 mt-3">
                ✓ Milestones preserved for efficiency tracking
              </p>
            </div>
          )}

          {/* Metrics */}
          {metrics && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h3 className="font-medium text-slate-900 mb-4">Cancellation Context</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className={`text-2xl font-bold ${metrics.isDayOf ? 'text-red-600' : 'text-slate-900'}`}>
                    {metrics.isDayOf ? 'Yes' : 'No'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Day-of Cancel</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{metrics.monthCancellations}</div>
                  <p className="text-xs text-slate-500 mt-1">This Month</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">
                    {metrics.surgeonCancelRate !== null ? `${metrics.surgeonCancelRate.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Surgeon Rate (90d)</p>
                </div>
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="font-medium text-slate-900 mb-4">
              Cancellation Reason <span className="text-red-600">*</span>
            </h3>
            
            {reasons.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p>No cancellation reasons configured.</p>
                <Link href="/settings/cancellation-reasons" className="text-blue-600 hover:underline text-sm mt-1 inline-block">
                  Configure in Settings
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {CATEGORIES.map(cat => {
                  const catReasons = groupedReasons[cat.value] || []
                  if (catReasons.length === 0) return null
                  
                  return (
                    <div key={cat.value}>
                      <p className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border mb-2 ${cat.color}`}>
                        {cat.label}
                      </p>
                      <div className="space-y-2">
                        {catReasons.map(reason => (
                          <label
                            key={reason.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedReasonId === reason.id
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="reason"
                              value={reason.id}
                              checked={selectedReasonId === reason.id}
                              onChange={(e) => setSelectedReasonId(e.target.value)}
                              className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-900">{reason.display_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="font-medium text-slate-900 mb-4">
              Additional Notes <span className="text-slate-400 font-normal">(optional)</span>
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context about this cancellation..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Link
              href={`/cases/${caseId}`}
              className="px-6 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg font-medium"
            >
              Keep Case
            </Link>
            
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={!selectedReasonId || reasons.length === 0}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel Case
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => setConfirming(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  Go Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            ⚠️ This marks the case as cancelled. All milestone data is preserved.
          </p>
        </div>
      </Container>
    </DashboardLayout>
  )
}