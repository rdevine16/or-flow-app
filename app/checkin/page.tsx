// app/checkin/page.tsx
// Patient Check-In Dashboard - Track patient arrivals and pre-op status

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useFeature, FEATURES } from '@/lib/features/useFeature'
import { TrialBanner } from '@/components/FeatureGate'
import { checkinAudit } from '@/lib/audit-logger'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { formatDisplayTime, formatTimestamp } from '@/lib/formatters'

// =====================================================
// TYPES
// =====================================================

interface PatientStatus {
  id: string
  name: string
  display_name: string
  color: string
  icon: string
  display_order: number
}

interface CheckinRecord {
  id: string
  case_id: string
  patient_status_id: string
  expected_arrival_time: string | null
  actual_arrival_time: string | null
  checked_in_at: string | null
  escort_name: string | null
  escort_phone: string | null
  checklist_responses: Record<string, unknown>
  checklist_completed_at: string | null
  patient_status: PatientStatus
  case: {
    id: string
    case_number: string
    scheduled_date: string
    start_time: string | null
    or_room: { name: string } | null
    procedure_type: { name: string } | null
    surgeon: { first_name: string; last_name: string } | null
    patient: { id: string; identifier: string | null; first_name: string | null; last_name: string | null } | null
  }
}


interface ChecklistField {
  id: string
  field_key: string
  display_label: string
  field_type: string
  options: string[] | null
  is_required: boolean
  display_order: number
}

type FilterStatus = 'all' | 'expected' | 'checked_in' | 'in_pre_op' | 'ready_for_or' | 'completed'

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getStatusColor(statusName: string): string {
  const colors: Record<string, string> = {
    expected: 'bg-slate-100 text-slate-700 border-slate-200',
    checked_in: 'bg-blue-100 text-blue-700 border-blue-200',
    in_pre_op: 'bg-amber-100 text-amber-700 border-amber-200',
    ready_for_or: 'bg-green-100 text-green-600 border-green-200',
    in_surgery: 'bg-purple-100 text-purple-700 border-purple-200',
    in_recovery: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    ready_for_discharge: 'bg-green-100 text-green-700 border-green-200',
    discharged: 'bg-gray-100 text-gray-500 border-gray-200',
    no_show: 'bg-red-100 text-red-600 border-red-200',
  }
  return colors[statusName] || 'bg-slate-100 text-slate-700 border-slate-200'
}

function isLateArrival(expectedTime: string | null, actualTime: string | null): boolean {
  if (!expectedTime) return false
  const expected = new Date(expectedTime)
  const now = actualTime ? new Date(actualTime) : new Date()
  return now > expected
}

// =====================================================
// SKELETON COMPONENT
// =====================================================

function CheckInSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-6 bg-slate-200 rounded" />
              <div>
                <div className="h-5 bg-slate-200 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-32" />
              </div>
            </div>
            <div className="w-24 h-8 bg-slate-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// CHECK-IN ROW COMPONENT
// =====================================================

interface CheckInRowProps {
  checkin: CheckinRecord
  statuses: PatientStatus[]
  onStatusChange: (checkinId: string, newStatusId: string) => void
  onOpenDetail: (checkin: CheckinRecord) => void
}

function CheckInRow({ checkin, statuses, onStatusChange, onOpenDetail }: CheckInRowProps) {
  const isLate = isLateArrival(checkin.expected_arrival_time, checkin.actual_arrival_time)
  const statusColor = getStatusColor(checkin.patient_status.name)

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onOpenDetail(checkin)}
    >
      <div className="flex items-center justify-between">
        {/* Left: Time and Case Info */}
        <div className="flex items-center gap-4">
          {/* Time Column */}
          <div className="w-20 text-center">
            <div className="text-lg font-semibold text-slate-900">
              {formatDisplayTime(checkin.case.start_time, { fallback: '--:--' })}
            </div>
            <div className={`text-xs ${isLate && checkin.patient_status.name === 'expected' ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
              {checkin.case.or_room?.name || 'No Room'}
            </div>
          </div>

          {/* Case Info */}
          <div className="border-l border-slate-200 pl-4">
            {/* Add patient identifier */}
            {checkin.case.patient?.identifier && (
              <div className="text-sm font-medium text-blue-600 mb-0.5">
                {checkin.case.patient.first_name && checkin.case.patient.last_name
                  ? `${checkin.case.patient.first_name} ${checkin.case.patient.last_name}`
                  : checkin.case.patient.identifier
                }
              </div>
            )}
            <div className="font-medium text-slate-900">
              {checkin.case.procedure_type?.name || 'Unknown Procedure'}
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <span>
                {checkin.case.surgeon
                  ? `Dr. ${checkin.case.surgeon.last_name}`
                  : 'No Surgeon'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-xs">{checkin.case.case_number}</span>
            </div>
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex items-center gap-3">
          {/* Expected/Actual Arrival */}
          {checkin.patient_status.name === 'expected' && checkin.expected_arrival_time && (
            <div className={`text-xs px-2 py-1 rounded ${isLate ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
              {isLate ? 'Late' : 'Expected'}: {formatTimestamp(checkin.expected_arrival_time)}
            </div>
          )}

          {checkin.actual_arrival_time && (
            <div className="text-xs px-2 py-1 rounded bg-green-50 text-green-600">
              Arrived: {formatTimestamp(checkin.actual_arrival_time)}
            </div>
          )}

          {/* Escort Indicator */}
          {checkin.escort_name && (
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center" title={`Escort: ${checkin.escort_name}`}>
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          )}

          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full border text-sm font-medium ${statusColor}`}>
            {checkin.patient_status.display_name}
          </div>

          {/* Quick Status Dropdown */}
          <select
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={checkin.patient_status_id}
            onChange={(e) => {
              e.stopPropagation()
              onStatusChange(checkin.id, e.target.value)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {statuses.filter(s => s.name !== 'no_show').map((status) => (
              <option key={status.id} value={status.id}>
                {status.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// CHECK-IN DETAIL MODAL
// =====================================================

interface CheckInDetailModalProps {
  checkin: CheckinRecord | null
  checklistFields: ChecklistField[]
  statuses: PatientStatus[]
  onClose: () => void
  onStatusChange: (checkinId: string, newStatusId: string) => void
  onChecklistUpdate: (checkinId: string, responses: Record<string, unknown>) => void
  onGenerateEscortLink: (checkinId: string) => Promise<string | null>
  onEscortInfoUpdate: (checkinId: string, name: string, phone: string, relationship: string) => void
}

function CheckInDetailModal({
  checkin,
  checklistFields,
  statuses,
  onClose,
  onStatusChange,
  onChecklistUpdate,
  onGenerateEscortLink,
  onEscortInfoUpdate,
}: CheckInDetailModalProps) {
  const [localResponses, setLocalResponses] = useState<Record<string, unknown>>(checkin?.checklist_responses || {})
  const [escortLink, setEscortLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [escortName, setEscortName] = useState(checkin?.escort_name || '')
  const [escortPhone, setEscortPhone] = useState(checkin?.escort_phone || '')
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [currentCheckinId, setCurrentCheckinId] = useState<string | null>(null)

  // Reset local state when checkin changes (e.g., different patient selected)
  if (checkin && checkin.id !== currentCheckinId) {
    setCurrentCheckinId(checkin.id)
    setLocalResponses(checkin.checklist_responses || {})
    setEscortName(checkin.escort_name || '')
    setEscortPhone(checkin.escort_phone || '')
  }

  if (!checkin) return null

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    const newResponses = { ...localResponses, [fieldKey]: value }
    setLocalResponses(newResponses)
    onChecklistUpdate(checkin.id, newResponses)
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    const link = await onGenerateEscortLink(checkin.id)
    if (link) {
      setEscortLink(link)
    }
    setGeneratingLink(false)
  }

  const handleCopyLink = async () => {
    if (escortLink) {
      await navigator.clipboard.writeText(escortLink)
      setShowCopySuccess(true)
      setTimeout(() => setShowCopySuccess(false), 2000)
    }
  }

  const handleEscortSave = () => {
    onEscortInfoUpdate(checkin.id, escortName, escortPhone, escortRelationship)
  }

  const statusColor = getStatusColor(checkin.patient_status.name)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {checkin.case.procedure_type?.name || 'Unknown Procedure'}
              </h2>
              <p className="text-sm text-slate-500">
                {checkin.case.surgeon ? `Dr. ${checkin.case.surgeon.last_name}` : 'No Surgeon'}
                {' • '}
                <span className="font-mono">{checkin.case.case_number}</span>
                {' • '}
                {checkin.case.or_room?.name || 'No Room'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <div className="text-sm text-slate-500 mb-1">Current Status</div>
              <div className={`inline-flex px-3 py-1.5 rounded-full border text-sm font-medium ${statusColor}`}>
                {checkin.patient_status.display_name}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Change Status</div>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                value={checkin.patient_status_id}
                onChange={(e) => onStatusChange(checkin.id, e.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timing Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Surgery Time</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatDisplayTime(checkin.case.start_time, { fallback: '--:--' })}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-500 mb-1">Expected Arrival</div>
              <div className="text-lg font-semibold text-slate-900">
                {checkin.expected_arrival_time
                  ? formatTimestamp(checkin.expected_arrival_time)
                  : '--:--'}
              </div>
            </div>
          </div>

          {/* Pre-Op Checklist */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Pre-Op Checklist</h3>
            <div className="space-y-3">
              {checklistFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {field.field_type === 'toggle' && (
                      <button
                        onClick={() => handleFieldChange(field.field_key, !localResponses[field.field_key])}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${Boolean(localResponses[field.field_key])
                            ? 'bg-green-500 text-white'
                            : 'bg-white border-2 border-slate-300'
                          }`}
                      >
                        {Boolean(localResponses[field.field_key]) ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </button>
                    )}
                    <span className={`text-sm ${Boolean(localResponses[field.field_key]) ? 'text-slate-900' : 'text-slate-600'}`}>
                      {field.display_label}
                      {field.is_required && <span className="text-red-600 ml-1">*</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Escort Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Escort Information</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Name</label>
                  <input
                    type="text"
                    value={escortName}
                    onChange={(e) => setEscortName(e.target.value)}
                    onBlur={handleEscortSave}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Escort name"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Phone</label>
                  <input
                    type="tel"
                    value={escortPhone}
                    onChange={(e) => setEscortPhone(e.target.value)}
                    onBlur={handleEscortSave}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>

              {/* Generate Status Link */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-900">Escort Status Link</div>
                    <div className="text-xs text-blue-600">Share a link so the escort can track patient status</div>
                  </div>
                  {escortLink ? (
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showCopySuccess ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateLink}
                      disabled={generatingLink}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {generatingLink ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Generate Link
                        </>
                      )}
                    </button>
                  )}
                </div>
                {escortLink && (
                  <div className="mt-3 p-2 bg-white rounded-lg">
                    <code className="text-xs text-slate-600 break-all">{escortLink}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================

export default function CheckInPage() {
  const router = useRouter()
  const supabase = createClient()
  const { loading: userLoading, effectiveFacilityId } = useUser()
  const { isEnabled, isLoading: featureLoading } = useFeature(FEATURES.PATIENT_CHECKIN)
  const { showToast } = useToast()
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [statuses, setStatuses] = useState<PatientStatus[]>([])
  const [checklistFields, setChecklistFields] = useState<ChecklistField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedCheckin, setSelectedCheckin] = useState<CheckinRecord | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    setError(null)
    try {
      // Fetch patient statuses
      const { data: statusData } = await supabase
        .from('patient_statuses')
        .select('*')
        .eq('is_active', true)
        .order('display_order')

      setStatuses(statusData || [])

      // Fetch checklist fields
      const { data: fieldData } = await supabase
        .from('preop_checklist_fields')
        .select('*')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order')

      setChecklistFields(fieldData || [])

      // IMPORTANT: Ensure checkin records exist for today's cases
      // This creates records for any cases that don't have one yet
      await supabase.rpc('ensure_checkin_records', {
        p_facility_id: effectiveFacilityId,
        p_date: selectedDate
      })

      // Fetch checkins for the selected date
      const { data: checkinData, error: fetchError } = await supabase
        .from('patient_checkins')
        .select(`
          *,
          patient_status:patient_statuses(*),
          case:cases(
            id,
            case_number,
            scheduled_date,
            start_time,
            or_room:or_rooms(name),
            procedure_type:procedure_types(name),
            surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
            patient:patients(id, identifier, first_name, last_name)
          )
        `)
        .eq('facility_id', effectiveFacilityId)
        .eq('case.scheduled_date', selectedDate)
        .not('case', 'is', null)
        .order('case(start_time)', { ascending: true })

      if (fetchError) throw fetchError

      // Filter out any null cases (shouldn't happen but safety)
      const validCheckins = (checkinData || []).filter(c => c.case !== null)
      setCheckins(validCheckins as CheckinRecord[])
    } catch (err) {
      setError('Failed to load check-in data. Please try again.')
      showToast({
        type: 'error',
        title: 'Failed to load check-ins',
        message: err instanceof Error ? err.message : 'Please try again'
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, selectedDate, supabase, showToast])

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    }
  }, [userLoading, effectiveFacilityId, fetchData])

  // Handle status change
  const handleStatusChange = async (checkinId: string, newStatusId: string) => {
    const checkin = checkins.find(c => c.id === checkinId)
    if (!checkin) return

    const oldStatus = checkin.patient_status
    const newStatus = statuses.find(s => s.id === newStatusId)
    if (!newStatus) return

    // Optimistic update
    setCheckins(prev => prev.map(c =>
      c.id === checkinId
        ? { ...c, patient_status_id: newStatusId, patient_status: newStatus }
        : c
    ))

    // Also update selected checkin if open
    if (selectedCheckin?.id === checkinId) {
      setSelectedCheckin(prev => prev ? { ...prev, patient_status_id: newStatusId, patient_status: newStatus } : null)
    }

    // Save to database
    const { error } = await supabase
      .from('patient_checkins')
      .update({
        patient_status_id: newStatusId,
        status_updated_at: new Date().toISOString(),
        ...(newStatus.name === 'checked_in' && !checkin.actual_arrival_time
          ? { actual_arrival_time: new Date().toISOString(), checked_in_at: new Date().toISOString() }
          : {}
        ),
      })
      .eq('id', checkinId)

    if (error) {
      showToast({
        type: 'error',
        title: 'Failed to update status',
        message: error instanceof Error ? error.message : 'Please try again'
      })
      // Revert on error
      setCheckins(prev => prev.map(c =>
        c.id === checkinId ? checkin : c
      ))
    } else {
      // Log audit
      await checkinAudit.statusUpdated(
        supabase,
        checkin.case.case_number,
        checkinId,
        oldStatus.display_name,
        newStatus.display_name,
        effectiveFacilityId || ''
      )
    }
  }

  // Handle checklist update
  const handleChecklistUpdate = async (checkinId: string, responses: Record<string, unknown>) => {
    const { error } = await supabase
      .from('patient_checkins')
      .update({
        checklist_responses: responses,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkinId)

    if (error) {
      showToast({
        type: 'error',
        title: 'Failed to update checklist',
        message: error instanceof Error ? error.message : 'Please try again'
      })
    }
  }

  // Handle generate escort link
  const handleGenerateEscortLink = async (checkinId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc('generate_escort_link', {
        p_checkin_id: checkinId,
        p_expires_hours: 24,
      })

      if (error) {
        showToast({
          type: 'error',
          title: 'Failed to generate escort link',
          message: error instanceof Error ? error.message : 'Please try again'
        })
        return null
      }

      const token = data as string
      const fullUrl = `${window.location.origin}/status/${token}`

      // Log audit
      const checkin = checkins.find(c => c.id === checkinId)
      if (checkin) {
        await checkinAudit.escortLinkGenerated(
          supabase,
          checkin.case.case_number,
          checkinId,
          token,
          effectiveFacilityId || '',
          24
        )
      }

      return fullUrl
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to generate escort link',
        message: err instanceof Error ? err.message : 'Please try again'
      })
      return null
    }
  }

  // Handle escort info update
  const handleEscortInfoUpdate = async (checkinId: string, name: string, phone: string, relationship: string) => {
    const { error } = await supabase
      .from('patient_checkins')
      .update({
        escort_name: name || null,
        escort_phone: phone || null,
        escort_relationship: relationship || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkinId)

    if (error) {
      showToast({
        type: 'error',
        title: 'Failed to update escort info',
        message: error instanceof Error ? error.message : 'Please try again'
      })
    }
  }

  // Filter checkins
  const filteredCheckins = checkins.filter(checkin => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'completed') {
      return ['in_recovery', 'ready_for_discharge', 'discharged'].includes(checkin.patient_status.name)
    }
    return checkin.patient_status.name === filterStatus
  })

  // Feature not enabled - show upgrade prompt
  if (!featureLoading && !isEnabled) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Patient Check-In</h2>
            <p className="text-slate-500 mb-6">
              Track patient arrivals, manage pre-op readiness, and share real-time status updates with escorts.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-medium text-slate-900 mb-2">Features include:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Real-time patient status tracking
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Customizable pre-op checklists
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Shareable escort status links
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Arrival time management
                </li>
              </ul>
            </div>
            <button
              onClick={() => router.push('/settings/subscription')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Enable This Feature
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Error Banner */}
        <ErrorBanner
          message={error}
          onRetry={fetchData}
          onDismiss={() => setError(null)}
        />

        {/* Trial Banner */}
        <TrialBanner feature={FEATURES.PATIENT_CHECKIN} />

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Patient Check-In</h1>
            <p className="text-slate-500 mt-1">Track arrivals and pre-op readiness</p>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const date = new Date(selectedDate)
                date.setDate(date.getDate() - 1)
                setSelectedDate(date.toISOString().split('T')[0])
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                const date = new Date(selectedDate)
                date.setDate(date.getDate() + 1)
                setSelectedDate(date.toISOString().split('T')[0])
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'expected', label: 'Expected' },
            { key: 'checked_in', label: 'Checked In' },
            { key: 'in_pre_op', label: 'In Pre-Op' },
            { key: 'ready_for_or', label: 'Ready' },
            { key: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as FilterStatus)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tab.label}
              {tab.key === 'all' && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                  {checkins.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Check-In List */}
        {loading || featureLoading ? (
          <CheckInSkeleton />
        ) : filteredCheckins.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No patients found</h3>
            <p className="text-slate-500">
              {filterStatus === 'all'
                ? 'No cases scheduled for this date'
                : `No patients with "${filterStatus.replace('_', ' ')}" status`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCheckins.map((checkin) => (
              <CheckInRow
                key={checkin.id}
                checkin={checkin}
                statuses={statuses}
                onStatusChange={handleStatusChange}
                onOpenDetail={setSelectedCheckin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <CheckInDetailModal
        checkin={selectedCheckin}
        checklistFields={checklistFields}
        statuses={statuses}
        onClose={() => setSelectedCheckin(null)}
        onStatusChange={handleStatusChange}
        onChecklistUpdate={handleChecklistUpdate}
        onGenerateEscortLink={handleGenerateEscortLink}
        onEscortInfoUpdate={handleEscortInfoUpdate}
      />
    </DashboardLayout>
  )
}