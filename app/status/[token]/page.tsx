// app/status/[token]/page.tsx
// Public escort status page - No authentication required
// Shows real-time patient status to family/escorts

'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Activity, AlertTriangle, BadgeCheck, Building2, Check, CheckCircle2, ClipboardList, Clock, Heart, Home, LogOut, XCircle } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface StatusData {
  facility_name: string
  facility_logo: string | null
  case_number: string
  procedure_name: string
  surgeon_name: string
  scheduled_date: string
  scheduled_time: string
  patient_status: {
    name: string
    display_name: string
    description: string
    color: string
    icon: string
  }
  status_updated_at: string
  expected_arrival_time: string | null
  actual_arrival_time: string | null
  escort_fields: Array<{
    field_key: string
    display_label: string
    value: unknown
  }> | null
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatTime(timeString: string | null): string {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  })
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

function getStatusColor(color: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  }
  return colors[color] || colors.slate
}

function getStatusIcon(iconName: string): React.ReactElement {
  const icons: Record<string, React.ReactElement> = {
    clock: (
      <Clock className="w-8 h-8" />
    ),
    'check-circle': (
      <CheckCircle2 className="w-8 h-8" />
    ),
    'clipboard-list': (
      <ClipboardList className="w-8 h-8" />
    ),
    'check-badge': (
      <BadgeCheck className="w-8 h-8" />
    ),
    activity: (
      <Activity className="w-8 h-8" />
    ),
    'heart-pulse': (
      <Heart className="w-8 h-8" />
    ),
    home: (
      <Home className="w-8 h-8" />
    ),
    'log-out': (
      <LogOut className="w-8 h-8" />
    ),
    'x-circle': (
      <XCircle className="w-8 h-8" />
    ),
  }
  return icons[iconName] || icons.clock
}

// =====================================================
// STATUS TIMELINE
// =====================================================

const STATUS_ORDER = [
  'expected',
  'checked_in',
  'in_pre_op',
  'ready_for_or',
  'in_surgery',
  'in_recovery',
  'ready_for_discharge',
  'discharged',
]

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus)

  const timelineSteps = [
    { key: 'checked_in', label: 'Arrived' },
    { key: 'in_pre_op', label: 'Pre-Op' },
    { key: 'in_surgery', label: 'Surgery' },
    { key: 'in_recovery', label: 'Recovery' },
    { key: 'ready_for_discharge', label: 'Ready' },
  ]

  return (
    <div className="flex items-center justify-between w-full px-4">
      {timelineSteps.map((step, index) => {
        const stepIndex = STATUS_ORDER.indexOf(step.key)
        const isCompleted = currentIndex >= stepIndex
        const isCurrent = currentStatus === step.key

        return (
          <div key={step.key} className="flex flex-col items-center">
            {/* Connector line */}
            {index > 0 && (
              <div 
                className={`absolute h-1 -ml-[calc(50%-16px)] w-[calc(100%-32px)] -translate-y-3 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
                style={{ left: '50%', transform: 'translateX(-100%)' }}
              />
            )}

            {/* Circle */}
            <div 
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                isCurrent 
                  ? 'bg-emerald-500 ring-4 ring-emerald-100'
                  : isCompleted 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-200'
              }`}
            >
              {isCompleted && (
                <Check className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Label */}
            <span className={`mt-2 text-xs font-medium ${
              isCurrent ? 'text-emerald-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'
            }`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// =====================================================
// LOADING SKELETON
// =====================================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-pulse">
          <div className="w-16 h-16 bg-slate-200 rounded-xl mx-auto mb-4" />
          <div className="h-6 bg-slate-200 rounded w-48 mx-auto mb-2" />
          <div className="h-4 bg-slate-100 rounded w-32 mx-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-slate-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-6 bg-slate-200 rounded w-32 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-48" />
            </div>
          </div>
          <div className="h-12 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ERROR STATE
// =====================================================

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Link Unavailable</h2>
        <p className="text-slate-500">{message}</p>
        <p className="text-sm text-slate-400 mt-4">
          If you believe this is an error, please contact the surgery center directly.
        </p>
      </div>
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EscortStatusPage() {
  const params = useParams()
  const token = params.token as string
  const { showToast } = useToast()
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Fetch status data
  const fetchStatus = async () => {
    const supabase = createClient()

    const { data: result, error: fetchError } = await supabase.rpc('get_escort_status', {
      p_token: token,
    })

    if (fetchError) {
      showToast({
        type: 'error',
        title: 'Error fetching status',
        message: fetchError.message || 'Failed to fetch status information'
      })
      setLoading(false)
      return
    }

    if (result?.error) {
      setError(result.error === 'Link not found or expired' 
        ? 'This status link has expired or is no longer available.'
        : result.error
      )
      setLoading(false)
      return
    }

    setData(result as StatusData)
    setLastRefresh(new Date())
    setLoading(false)
  }

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchStatus()

    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [token])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error || !data) {
    return <ErrorState message={error || 'Unable to load status information.'} />
  }

  const statusColors = getStatusColor(data.patient_status.color)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          {data.facility_logo ? (
            <Image 
              src={data.facility_logo} 
              alt={data.facility_name}
              width={64}
              height={64}
              className="w-16 h-16 object-contain mx-auto mb-4"
            />
          ) : (
            <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-slate-900">{data.facility_name}</h1>
          <p className="text-sm text-slate-500">Patient Status Update</p>
        </div>

        {/* Main Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6">
          {/* Status Header */}
          <div className={`p-6 ${statusColors.bg}`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl ${statusColors.text} bg-white/50 flex items-center justify-center`}>
                {getStatusIcon(data.patient_status.icon)}
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${statusColors.text}`}>
                  {data.patient_status.display_name}
                </h2>
                <p className={`text-sm ${statusColors.text} opacity-80`}>
                  {data.patient_status.description}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {!['expected', 'no_show', 'discharged'].includes(data.patient_status.name) && (
            <div className="px-6 py-4 border-b border-slate-100 relative">
              <StatusTimeline currentStatus={data.patient_status.name} />
            </div>
          )}

          {/* Case Details */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Procedure</span>
              <span className="text-sm font-medium text-slate-900">{data.procedure_name}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Surgeon</span>
              <span className="text-sm font-medium text-slate-900">{data.surgeon_name}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Scheduled Date</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(data.scheduled_date)}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Surgery Time</span>
              <span className="text-sm font-medium text-slate-900">
                {formatTime(data.scheduled_time)}
              </span>
            </div>

            {/* Escort-visible checklist fields */}
            {data.escort_fields && data.escort_fields.length > 0 && (
              <>
                {data.escort_fields.map((field) => (
                  <div key={field.field_key} className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-sm text-slate-500">{field.display_label}</span>
                    <span className="text-sm font-medium text-slate-900">
                      {typeof field.value === 'boolean' 
                        ? (field.value ? 'Yes' : 'No')
                        : (field.value as string) || '—'
                      }
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-center">
          <p className="text-xs text-slate-400">
            Last updated: {lastRefresh.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            This page updates automatically every 30 seconds
          </p>
          <button
            onClick={fetchStatus}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh Now
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-medium">ORbit</span>
          </p>
        </div>
      </div>
    </div>
  )
}