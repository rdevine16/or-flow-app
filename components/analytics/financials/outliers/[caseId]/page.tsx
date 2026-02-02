// app/analytics/financials/outliers/[caseId]/page.tsx
// Full-page outlier detail view with delay analysis

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { getImpersonationState } from '@/lib/impersonation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { 
  ChartBarIcon, 
  ChevronRightIcon,
  ArrowLeftIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChatBubbleLeftIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'

// ============================================
// TYPES
// ============================================

// Raw type from Supabase (joins come back as arrays)
interface CaseDelayRaw {
  id: string
  delay_type_id: string
  duration_minutes: number | null
  notes: string | null
  created_at: string
  delay_types: { name: string }[] | { name: string } | null
}

// Normalized type for our component
interface CaseDelay {
  id: string
  delay_type_id: string
  duration_minutes: number | null
  notes: string | null
  created_at: string
  delayTypeName: string | null
}

// Helper to normalize Supabase single-row joins (they sometimes come as arrays)
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

interface OutlierDetail {
  // Case info
  caseId: string
  caseNumber: string
  date: string
  surgeonId: string
  surgeonName: string
  procedureId: string
  procedureName: string
  roomName: string | null
  
  // Actual values
  actualProfit: number
  actualDuration: number
  
  // Personal baselines (surgeon-specific)
  personalMedianProfit: number | null
  personalStddevProfit: number | null
  personalMedianDuration: number | null
  personalStddevDuration: number | null
  personalSampleSize: number
  
  // Facility baselines
  facilityMedianProfit: number | null
  facilityStddevProfit: number | null
  facilityMedianDuration: number | null
  facilityStddevDuration: number | null
  facilitySampleSize: number
  
  // Thresholds (calculated)
  personalProfitThreshold: number | null
  facilityProfitThreshold: number | null
  personalDurationThreshold: number | null
  facilityDurationThreshold: number | null
  
  // Outlier flags
  isDurationPersonalOutlier: boolean
  isDurationFacilityOutlier: boolean
  isProfitPersonalOutlier: boolean
  isProfitFacilityOutlier: boolean
  
  // Financial breakdown
  reimbursement: number
  softGoodsCost: number
  hardGoodsCost: number
  orCost: number
  orRate: number
  payerName: string | null
  
  // Delays
  delays: CaseDelay[]
  totalDelayMinutes: number
}

// Review status types
type ReviewStatus = 'needs_review' | 'reviewed' | 'excluded'

interface OutlierReview {
  id: string
  case_id: string
  facility_id: string
  status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  excluded_reason: string | null
  created_at: string
  updated_at: string
}

interface OutlierReviewNote {
  id: string
  outlier_review_id: string
  note: string
  created_by: string | null
  created_at: string
  is_system_note: boolean
  // Joined data
  user?: {
    first_name: string
    last_name: string
  } | null
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMinutes(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value)} min`
}

function getOutlierSeverity(detail: OutlierDetail): 'critical' | 'personal' | 'facility' {
  const isPersonal = detail.isDurationPersonalOutlier || detail.isProfitPersonalOutlier
  const isFacility = detail.isDurationFacilityOutlier || detail.isProfitFacilityOutlier
  
  if (isPersonal && isFacility) return 'critical'
  if (isPersonal) return 'personal'
  return 'facility'
}

function getSeverityStyles(severity: 'critical' | 'personal' | 'facility') {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Critical' }
    case 'personal':
      return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Personal Outlier' }
    case 'facility':
      return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Facility Outlier' }
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function OutlierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.caseId as string
  
  const supabase = createClient()
  const { userData, loading: userLoading } = useUser()
  
  const [detail, setDetail] = useState<OutlierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Review state
  const [review, setReview] = useState<OutlierReview | null>(null)
  const [notes, setNotes] = useState<OutlierReviewNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [excludeReason, setExcludeReason] = useState('')
  const [showExcludeModal, setShowExcludeModal] = useState(false)

  // Fetch case data with delays
  useEffect(() => {
    if (!caseId || userLoading) return
    
    async function fetchOutlierDetail() {
      setLoading(true)
      setError(null)
      
      try {
        // Get effective facility ID
        let facilityId = userData.facilityId
        if (userData.accessLevel === 'global_admin') {
          const impersonation = getImpersonationState()
          facilityId = impersonation?.facilityId || null
        }
        
        if (!facilityId) {
          setError('No facility selected')
          setLoading(false)
          return
        }

        // Fetch case completion stats
        const { data: caseData, error: caseError } = await supabase
          .from('case_completion_stats')
          .select(`
            *,
            surgeon:users!case_completion_stats_surgeon_id_fkey (first_name, last_name),
            procedure_types (id, name),
            payers (id, name),
            or_rooms (name)
          `)
          .eq('case_id', caseId)
          .single()

        if (caseError) throw caseError
        if (!caseData) throw new Error('Case not found')

        // Fetch delays for this case
        const { data: delaysData, error: delaysError } = await supabase
          .from('case_delays')
          .select(`
            id,
            delay_type_id,
            duration_minutes,
            notes,
            created_at,
            delay_types (name)
          `)
          .eq('case_id', caseId)
          .order('created_at', { ascending: true })

        if (delaysError) console.error('Error fetching delays:', delaysError)

        // Fetch surgeon's baseline for this procedure
        const { data: surgeonStats } = await supabase
          .from('surgeon_procedure_stats')
          .select('*')
          .eq('surgeon_id', caseData.surgeon_id)
          .eq('procedure_type_id', caseData.procedure_type_id)
          .single()

        // Fetch facility baseline for this procedure
        const { data: facilityStats } = await supabase
          .from('facility_procedure_stats')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('procedure_type_id', caseData.procedure_type_id)
          .single()

        // Calculate thresholds
        const personalDurationThreshold = surgeonStats?.median_duration != null && surgeonStats?.stddev_duration != null
          ? surgeonStats.median_duration + surgeonStats.stddev_duration
          : null

        const facilityDurationThreshold = facilityStats?.median_duration != null && facilityStats?.stddev_duration != null
          ? facilityStats.median_duration + facilityStats.stddev_duration
          : null

        const personalProfitThreshold = surgeonStats?.median_profit != null && surgeonStats?.stddev_profit != null
          ? surgeonStats.median_profit - surgeonStats.stddev_profit
          : null

        const facilityProfitThreshold = facilityStats?.median_profit != null && facilityStats?.stddev_profit != null
          ? facilityStats.median_profit - facilityStats.stddev_profit
          : null

        // Normalize delays data (Supabase joins can return arrays for single relations)
        const delays: CaseDelay[] = (delaysData || []).map((d: CaseDelayRaw) => ({
          id: d.id,
          delay_type_id: d.delay_type_id,
          duration_minutes: d.duration_minutes,
          notes: d.notes,
          created_at: d.created_at,
          delayTypeName: normalizeJoin(d.delay_types)?.name || null,
        }))
        const totalDelayMinutes = delays.reduce((sum, d) => sum + (d.duration_minutes || 0), 0)

        // Build detail object
        const outlierDetail: OutlierDetail = {
          caseId: caseData.case_id,
          caseNumber: caseData.case_number,
          date: caseData.case_date,
          surgeonId: caseData.surgeon_id,
          surgeonName: caseData.surgeon 
            ? `Dr. ${caseData.surgeon.first_name} ${caseData.surgeon.last_name}`
            : 'Unknown',
          procedureId: caseData.procedure_type_id,
          procedureName: caseData.procedure_types?.name || 'Unknown',
          roomName: caseData.or_rooms?.name || null,
          
          actualProfit: caseData.profit || 0,
          actualDuration: caseData.total_duration_minutes || 0,
          
          personalMedianProfit: surgeonStats?.median_profit || null,
          personalStddevProfit: surgeonStats?.stddev_profit || null,
          personalMedianDuration: surgeonStats?.median_duration || null,
          personalStddevDuration: surgeonStats?.stddev_duration || null,
          personalSampleSize: surgeonStats?.sample_size || 0,
          
          facilityMedianProfit: facilityStats?.median_profit || null,
          facilityStddevProfit: facilityStats?.stddev_profit || null,
          facilityMedianDuration: facilityStats?.median_duration || null,
          facilityStddevDuration: facilityStats?.stddev_duration || null,
          facilitySampleSize: facilityStats?.sample_size || 0,
          
          personalProfitThreshold,
          facilityProfitThreshold,
          personalDurationThreshold,
          facilityDurationThreshold,
          
          isDurationPersonalOutlier: personalDurationThreshold !== null && (caseData.total_duration_minutes || 0) > personalDurationThreshold,
          isDurationFacilityOutlier: facilityDurationThreshold !== null && (caseData.total_duration_minutes || 0) > facilityDurationThreshold,
          isProfitPersonalOutlier: personalProfitThreshold !== null && (caseData.profit || 0) < personalProfitThreshold,
          isProfitFacilityOutlier: facilityProfitThreshold !== null && (caseData.profit || 0) < facilityProfitThreshold,
          
          reimbursement: caseData.reimbursement || 0,
          softGoodsCost: caseData.soft_goods_cost || 0,
          hardGoodsCost: caseData.hard_goods_cost || 0,
          orCost: caseData.or_cost || 0,
          orRate: caseData.or_hourly_rate || 0,
          payerName: caseData.payers?.name || null,
          
          delays,
          totalDelayMinutes,
        }

        setDetail(outlierDetail)
      } catch (err) {
        console.error('Error fetching outlier detail:', err)
        setError(err instanceof Error ? err.message : 'Failed to load case details')
      }
      
      setLoading(false)
    }

    fetchOutlierDetail()
  }, [caseId, userLoading, userData.facilityId, userData.accessLevel, supabase])

  // Fetch review data
  useEffect(() => {
    if (!caseId || !detail) return
    
    // Capture detail in local const for TypeScript narrowing
    const currentDetail = detail
    
    async function fetchReviewData() {
      // Get effective facility ID
      let facilityId = userData.facilityId
      if (userData.accessLevel === 'global_admin') {
        const impersonation = getImpersonationState()
        facilityId = impersonation?.facilityId || null
      }
      
      if (!facilityId) return

      // Fetch or create review record
      let { data: reviewData, error: reviewError } = await supabase
        .from('outlier_reviews')
        .select('*')
        .eq('case_id', caseId)
        .single()

      // If no review exists, create one
      if (reviewError?.code === 'PGRST116') { // Not found
        const { data: newReview, error: createError } = await supabase
          .from('outlier_reviews')
          .insert({
            case_id: caseId,
            facility_id: facilityId,
            status: 'needs_review'
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating review:', createError)
          return
        }
        reviewData = newReview

        // Add system note for initial flagging
        const issues: string[] = []
        if (currentDetail.isDurationPersonalOutlier) issues.push(`Duration +${Math.round(currentDetail.actualDuration - (currentDetail.personalDurationThreshold || 0))} min over personal threshold`)
        if (currentDetail.isDurationFacilityOutlier) issues.push(`Duration +${Math.round(currentDetail.actualDuration - (currentDetail.facilityDurationThreshold || 0))} min over facility threshold`)
        if (currentDetail.isProfitPersonalOutlier) issues.push(`Profit ${formatCurrency(currentDetail.actualProfit - (currentDetail.personalProfitThreshold || 0))} below personal threshold`)
        if (currentDetail.isProfitFacilityOutlier) issues.push(`Profit ${formatCurrency(currentDetail.actualProfit - (currentDetail.facilityProfitThreshold || 0))} below facility threshold`)

        await supabase
          .from('outlier_review_notes')
          .insert({
            outlier_review_id: newReview.id,
            note: `Case flagged as outlier: ${issues.join(', ')}`,
            is_system_note: true,
            created_by: null
          })
      } else if (reviewError) {
        console.error('Error fetching review:', reviewError)
        return
      }

      setReview(reviewData)

      // Fetch notes with user info
      if (reviewData) {
        const { data: notesData, error: notesError } = await supabase
          .from('outlier_review_notes')
          .select(`
            *,
            user:users!outlier_review_notes_created_by_fkey(first_name, last_name)
          `)
          .eq('outlier_review_id', reviewData.id)
          .order('created_at', { ascending: false })

        if (notesError) {
          console.error('Error fetching notes:', notesError)
        } else {
          // Normalize joined user data
          const normalizedNotes = (notesData || []).map(note => ({
            ...note,
            user: normalizeJoin(note.user)
          }))
          setNotes(normalizedNotes)
        }
      }
    }

    fetchReviewData()
  }, [caseId, detail, userData.facilityId, userData.accessLevel, supabase])

  // Handle status change
  async function handleStatusChange(newStatus: ReviewStatus) {
    if (!review || savingStatus) return
    
    // If changing to excluded, show modal for reason
    if (newStatus === 'excluded') {
      setShowExcludeModal(true)
      return
    }

    setSavingStatus(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const updates: Partial<OutlierReview> = {
      status: newStatus,
      reviewed_by: newStatus === 'reviewed' ? user?.id : null,
      reviewed_at: newStatus === 'reviewed' ? new Date().toISOString() : null,
      excluded_reason: null
    }

    const { error } = await supabase
      .from('outlier_reviews')
      .update(updates)
      .eq('id', review.id)

    if (error) {
      console.error('Error updating status:', error)
    } else {
      setReview({ ...review, ...updates } as OutlierReview)
      
      // Add system note
      await addSystemNote(`Status changed to "${newStatus === 'needs_review' ? 'Needs Review' : 'Reviewed'}"`)
    }
    
    setSavingStatus(false)
  }

  // Handle exclude with reason
  async function handleExclude() {
    if (!review || !excludeReason.trim()) return
    
    setSavingStatus(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const updates: Partial<OutlierReview> = {
      status: 'excluded',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      excluded_reason: excludeReason.trim()
    }

    const { error } = await supabase
      .from('outlier_reviews')
      .update(updates)
      .eq('id', review.id)

    if (error) {
      console.error('Error excluding:', error)
    } else {
      setReview({ ...review, ...updates } as OutlierReview)
      await addSystemNote(`Excluded from analytics: "${excludeReason.trim()}"`)
      setShowExcludeModal(false)
      setExcludeReason('')
    }
    
    setSavingStatus(false)
  }

  // Add system note helper
  async function addSystemNote(message: string) {
    if (!review) return
    
    const { data: noteData, error } = await supabase
      .from('outlier_review_notes')
      .insert({
        outlier_review_id: review.id,
        note: message,
        is_system_note: true,
        created_by: null
      })
      .select('*')
      .single()

    if (!error && noteData) {
      setNotes([{ ...noteData, user: null }, ...notes])
    }
  }

  // Add user note
  async function handleAddNote() {
    if (!review || !newNote.trim() || savingNote) return
    
    setSavingNote(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: noteData, error } = await supabase
      .from('outlier_review_notes')
      .insert({
        outlier_review_id: review.id,
        note: newNote.trim(),
        is_system_note: false,
        created_by: user?.id
      })
      .select(`
        *,
        user:users!outlier_review_notes_created_by_fkey(first_name, last_name)
      `)
      .single()

    if (error) {
      console.error('Error adding note:', error)
    } else if (noteData) {
      setNotes([{ ...noteData, user: normalizeJoin(noteData.user) }, ...notes])
      setNewNote('')
    }
    
    setSavingNote(false)
  }

  // Format timestamp for notes
  function formatNoteTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Loading state
  if (loading || userLoading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  // Error state
  if (error || !detail) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {error || 'Case Not Found'}
            </h3>
            <p className="text-slate-500 mb-6">
              Unable to load outlier details for this case.
            </p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </Container>
      </DashboardLayout>
    )
  }

  const severity = getOutlierSeverity(detail)
  const severityStyles = getSeverityStyles(severity)
  
  // Calculate delay impact
  const durationOverThreshold = detail.personalDurationThreshold 
    ? detail.actualDuration - detail.personalDurationThreshold
    : detail.facilityDurationThreshold
    ? detail.actualDuration - detail.facilityDurationThreshold
    : 0
  const unexplainedOverage = Math.max(0, durationOverThreshold - detail.totalDelayMinutes)
  const delaysExplainOverage = detail.totalDelayMinutes >= durationOverThreshold

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1 text-sm mb-6">
          <Link 
            href="/analytics" 
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChartBarIcon className="w-4 h-4" />
            <span>Analytics</span>
          </Link>
          <ChevronRightIcon className="w-4 h-4 text-slate-300" />
          <Link 
            href="/analytics/financials" 
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            Financial Analytics
          </Link>
          <ChevronRightIcon className="w-4 h-4 text-slate-300" />
          <Link 
            href="/analytics/financials?tab=outliers" 
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            Outliers
          </Link>
          <ChevronRightIcon className="w-4 h-4 text-slate-300" />
          <span className="text-slate-900 font-medium">{detail.caseNumber}</span>
        </nav>

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Outliers
        </button>

        {/* Page Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">{detail.caseNumber}</h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${severityStyles.bg} ${severityStyles.text}`}>
                  {severityStyles.label}
                </span>
              </div>
              <p className="text-slate-600">
                {detail.procedureName} • {detail.surgeonName} • {detail.roomName || 'No Room'} • {new Date(detail.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* What Went Wrong */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">What Went Wrong</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Duration Issue */}
            {(detail.isDurationPersonalOutlier || detail.isDurationFacilityOutlier) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ClockIcon className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-900">Over Time</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-amber-700">Actual Duration</span>
                    <span className="font-bold text-amber-900">{formatMinutes(detail.actualDuration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">Expected (Median)</span>
                    <span className="text-amber-800">{formatMinutes(detail.personalMedianDuration || detail.facilityMedianDuration)}</span>
                  </div>
                  <div className="border-t border-amber-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-amber-700 font-medium">Over Threshold</span>
                      <span className="font-bold text-amber-900">+{Math.round(durationOverThreshold)} min</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {detail.isDurationPersonalOutlier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      Personal
                    </span>
                  )}
                  {detail.isDurationFacilityOutlier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                      Facility
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Profit Issue */}
            {(detail.isProfitPersonalOutlier || detail.isProfitFacilityOutlier) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CurrencyDollarIcon className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-900">Low Profit</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-red-700">Actual Profit</span>
                    <span className="font-bold text-red-900">{formatCurrency(detail.actualProfit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700">Expected (Median)</span>
                    <span className="text-red-800">{formatCurrency(detail.personalMedianProfit || detail.facilityMedianProfit)}</span>
                  </div>
                  <div className="border-t border-red-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-red-700 font-medium">Below Threshold</span>
                      <span className="font-bold text-red-900">
                        {formatCurrency((detail.personalProfitThreshold || detail.facilityProfitThreshold || 0) - detail.actualProfit)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {detail.isProfitPersonalOutlier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      Personal
                    </span>
                  )}
                  {detail.isProfitFacilityOutlier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                      Facility
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recorded Delays Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recorded Delays</h2>
            {detail.delays.length > 0 && (
              <span className="text-sm text-slate-500">
                {detail.delays.length} delay{detail.delays.length !== 1 ? 's' : ''} • {detail.totalDelayMinutes} min total
              </span>
            )}
          </div>

          {detail.delays.length > 0 ? (
            <>
              {/* Delay List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 mb-4">
                {detail.delays.map((delay) => (
                  <div key={delay.id} className="p-4 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {delay.delayTypeName || 'Unknown Delay'}
                      </p>
                      {delay.notes && (
                        <p className="text-sm text-slate-500 mt-1">{delay.notes}</p>
                      )}
                    </div>
                    <span className="font-semibold text-slate-700">
                      {delay.duration_minutes ? `${delay.duration_minutes} min` : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Delay Impact Analysis */}
              {(detail.isDurationPersonalOutlier || detail.isDurationFacilityOutlier) && (
                <div className={`rounded-lg p-4 ${delaysExplainOverage ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-start gap-3">
                    {delaysExplainOverage ? (
                      <CheckCircleIcon className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-medium ${delaysExplainOverage ? 'text-emerald-900' : 'text-amber-900'}`}>
                        Delay Impact Analysis
                      </h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className={delaysExplainOverage ? 'text-emerald-700' : 'text-amber-700'}>
                            Duration over threshold:
                          </span>
                          <span className={`font-medium ${delaysExplainOverage ? 'text-emerald-800' : 'text-amber-800'}`}>
                            +{Math.round(durationOverThreshold)} min
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={delaysExplainOverage ? 'text-emerald-700' : 'text-amber-700'}>
                            Total recorded delays:
                          </span>
                          <span className={`font-medium ${delaysExplainOverage ? 'text-emerald-800' : 'text-amber-800'}`}>
                            -{detail.totalDelayMinutes} min
                          </span>
                        </div>
                        <div className={`border-t pt-1 mt-1 flex justify-between ${delaysExplainOverage ? 'border-emerald-200' : 'border-amber-200'}`}>
                          <span className={`font-medium ${delaysExplainOverage ? 'text-emerald-700' : 'text-amber-700'}`}>
                            Unexplained overage:
                          </span>
                          <span className={`font-bold ${delaysExplainOverage ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {unexplainedOverage > 0 ? `+${Math.round(unexplainedOverage)} min` : `${Math.round(durationOverThreshold - detail.totalDelayMinutes)} min`}
                          </span>
                        </div>
                      </div>
                      <p className={`mt-3 text-sm ${delaysExplainOverage ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {delaysExplainOverage 
                          ? '✓ Recorded delays fully explain the duration overage.'
                          : `⚠ ${Math.round(unexplainedOverage)} minutes remain unexplained after accounting for delays.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-lg">
              <ClockIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-600">No delays recorded for this case</p>
              {(detail.isDurationPersonalOutlier || detail.isDurationFacilityOutlier) && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠ Duration outlier with no recorded delays — consider investigating
                </p>
              )}
            </div>
          )}
        </div>

        {/* Two Column Layout: Baseline Comparison + Financial Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Baseline Comparison Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Baseline Comparison</h2>
              <div className="group relative">
                <InformationCircleIcon className="w-5 h-5 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64">
                  <strong>Thresholds:</strong><br />
                  Duration = median + 1σ (above is bad)<br />
                  Profit = median - 1σ (below is bad)
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-medium text-slate-500"></th>
                    <th className="text-right py-2 font-medium text-slate-500">This Case</th>
                    <th className="text-right py-2 font-medium text-slate-500">
                      <div>Personal</div>
                      <div className="font-normal text-xs">({detail.personalSampleSize} cases)</div>
                    </th>
                    <th className="text-right py-2 font-medium text-slate-500">
                      <div>Facility</div>
                      <div className="font-normal text-xs">({detail.facilitySampleSize} cases)</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 text-slate-600">Duration</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{formatMinutes(detail.actualDuration)}</td>
                    <td className="py-3 text-right text-slate-600">{formatMinutes(detail.personalMedianDuration)}</td>
                    <td className="py-3 text-right text-slate-600">{formatMinutes(detail.facilityMedianDuration)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-3 text-slate-500 text-xs">Threshold</td>
                    <td className="py-3 text-right text-slate-400">—</td>
                    <td className="py-3 text-right text-slate-500 text-xs">{formatMinutes(detail.personalDurationThreshold)}</td>
                    <td className="py-3 text-right text-slate-500 text-xs">{formatMinutes(detail.facilityDurationThreshold)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-3 text-slate-500 text-xs">Status</td>
                    <td className="py-3 text-right">—</td>
                    <td className="py-3 text-right">
                      {detail.isDurationPersonalOutlier ? (
                        <span className="text-red-600 text-xs font-medium">⚠ OVER</span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">✓ OK</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {detail.isDurationFacilityOutlier ? (
                        <span className="text-red-600 text-xs font-medium">⚠ OVER</span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">✓ OK</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 text-slate-600">Profit</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{formatCurrency(detail.actualProfit)}</td>
                    <td className="py-3 text-right text-slate-600">{formatCurrency(detail.personalMedianProfit)}</td>
                    <td className="py-3 text-right text-slate-600">{formatCurrency(detail.facilityMedianProfit)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-3 text-slate-500 text-xs">Threshold</td>
                    <td className="py-3 text-right text-slate-400">—</td>
                    <td className="py-3 text-right text-slate-500 text-xs">{formatCurrency(detail.personalProfitThreshold)}</td>
                    <td className="py-3 text-right text-slate-500 text-xs">{formatCurrency(detail.facilityProfitThreshold)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-3 text-slate-500 text-xs">Status</td>
                    <td className="py-3 text-right">—</td>
                    <td className="py-3 text-right">
                      {detail.isProfitPersonalOutlier ? (
                        <span className="text-red-600 text-xs font-medium">⚠ BELOW</span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">✓ OK</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {detail.isProfitFacilityOutlier ? (
                        <span className="text-red-600 text-xs font-medium">⚠ BELOW</span>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">✓ OK</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Breakdown</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">Reimbursement</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(detail.reimbursement)}</span>
              </div>
              
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Soft Goods</span>
                  <span className="text-red-500">-{formatCurrency(detail.softGoodsCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hard Goods</span>
                  <span className="text-red-500">-{formatCurrency(detail.hardGoodsCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">OR Time Cost</span>
                  <span className="text-red-500">-{formatCurrency(detail.orCost)}</span>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Net Profit</span>
                  <span className={`text-xl font-bold ${detail.actualProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(detail.actualProfit)}
                  </span>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3 mt-4">
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Payer:</span>
                    <span className="font-medium text-slate-900">{detail.payerName || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OR Rate:</span>
                    <span className="font-medium text-slate-900">{formatCurrency(detail.orRate)}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OR Time Cost:</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(detail.orRate)} × {(detail.actualDuration / 60).toFixed(1)}hr = {formatCurrency(detail.orCost)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes & Actions</h2>
          
          {/* Review Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">Review Status</label>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleStatusChange('needs_review')}
                disabled={savingStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  review?.status === 'needs_review'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <ExclamationTriangleIcon className="w-5 h-5" />
                Needs Review
              </button>
              
              <button
                onClick={() => handleStatusChange('reviewed')}
                disabled={savingStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  review?.status === 'reviewed'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <CheckCircleIcon className="w-5 h-5" />
                Reviewed
              </button>
              
              <button
                onClick={() => handleStatusChange('excluded')}
                disabled={savingStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  review?.status === 'excluded'
                    ? 'border-slate-500 bg-slate-100 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <EyeSlashIcon className="w-5 h-5" />
                Excluded
              </button>
            </div>
            
            {/* Show excluded reason if applicable */}
            {review?.status === 'excluded' && review.excluded_reason && (
              <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm">
                <span className="font-medium text-slate-700">Exclusion reason:</span>{' '}
                <span className="text-slate-600">{review.excluded_reason}</span>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Review Notes</label>
            
            {/* Add Note Input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Add a note..."
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                Add Note
              </button>
            </div>
            
            {/* Notes List */}
            {notes.length > 0 ? (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-80 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className={`p-4 ${note.is_system_note ? 'bg-slate-50' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {note.is_system_note ? (
                            <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded">System</span>
                          ) : (
                            <span className="text-sm font-medium text-slate-900">
                              {note.user ? `${note.user.first_name} ${note.user.last_name}` : 'Unknown User'}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{formatNoteTime(note.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{note.note}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
                <ChatBubbleLeftIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notes yet. Add a note to document your review.</p>
              </div>
            )}
          </div>
        </div>

        {/* Exclude Modal */}
        {showExcludeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Exclude from Analytics</h3>
                <button
                  onClick={() => {
                    setShowExcludeModal(false)
                    setExcludeReason('')
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                Excluding this case will remove it from financial analytics calculations. Please provide a reason for exclusion.
              </p>
              
              <textarea
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                placeholder="e.g., Training case, data entry error, unusual circumstances..."
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                rows={3}
              />
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowExcludeModal(false)
                    setExcludeReason('')
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExclude}
                  disabled={!excludeReason.trim() || savingStatus}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Exclude Case
                </button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </DashboardLayout>
  )
}