// app/settings/checkin/page.tsx
// Check-In Settings - Configure arrival times and checklist

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useFeature, FEATURES } from '@/lib/features/useFeature'
import { TrialBanner } from '@/components/FeatureGate'
import { checkinAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { Button } from '@/components/ui/Button'
import { Check, ChevronRight, ClipboardCheck, Lock, X } from 'lucide-react'

// =====================================================
// TYPES
// =====================================================

interface Facility {
  id: string
  name: string
  default_arrival_lead_time_minutes: number | null
}

interface ProcedureType {
  id: string
  name: string
  arrival_lead_time_minutes: number | null
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function CheckInSettingsPage() {
  const supabase = createClient()
  const { userData, loading: userLoading } = useUser()
  const { isEnabled, isLoading: featureLoading } = useFeature(FEATURES.PATIENT_CHECKIN)
  const { showToast } = useToast()

  // Data fetching
  const { data: facility, loading: facilityLoading, setData: setFacility } = useSupabaseQuery<Facility | null>(
    async (sb) => {
      const { data, error } = await sb
        .from('facilities')
        .select('id, name, default_arrival_lead_time_minutes')
        .eq('id', userData!.facilityId)
        .single()
      if (error) throw error
      return data
    },
    { deps: [userData?.facilityId], enabled: !userLoading && !!userData?.facilityId }
  )

  const { data: procedures, loading: proceduresLoading } = useSupabaseQuery<ProcedureType[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('procedure_types')
        .select('id, name, arrival_lead_time_minutes')
        .eq('facility_id', userData!.facilityId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [userData?.facilityId], enabled: !userLoading && !!userData?.facilityId }
  )

  const loading = facilityLoading || proceduresLoading
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [defaultLeadTime, setDefaultLeadTime] = useState<number>(90)
  const [procedureOverrides, setProcedureOverrides] = useState<Record<string, number | null>>({})

  // Sync form state when data loads
  useEffect(() => {
    if (facility) {
      setDefaultLeadTime(facility.default_arrival_lead_time_minutes || 90)
    }
  }, [facility])

  useEffect(() => {
    if (procedures) {
      const overrides: Record<string, number | null> = {}
      procedures.forEach(p => {
        if (p.arrival_lead_time_minutes !== null) {
          overrides[p.id] = p.arrival_lead_time_minutes
        }
      })
      setProcedureOverrides(overrides)
    }
  }, [procedures])

  // Save default lead time
  const handleSaveDefault = async () => {
    if (!facility) return

    setSaving(true)
    const oldValue = facility.default_arrival_lead_time_minutes

    const { error } = await supabase
      .from('facilities')
      .update({ default_arrival_lead_time_minutes: defaultLeadTime })
      .eq('id', facility.id)

    if (error) {
      showToast({
        type: 'error',
        title: 'Error saving default arrival time',
        message: error.message
      })
    } else {
      setFacility({ ...facility, default_arrival_lead_time_minutes: defaultLeadTime })
      setSuccessMessage('Default arrival time saved')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Audit log
      await checkinAudit.arrivalSettingsUpdated(
        supabase,
        facility.id,
        oldValue,
        defaultLeadTime
      )
    }

    setSaving(false)
  }

  // Save procedure override
  const handleSaveProcedureOverride = async (procedureId: string, minutes: number | null) => {
    setSaving(true)

    const { error } = await supabase
      .from('procedure_types')
      .update({ arrival_lead_time_minutes: minutes })
      .eq('id', procedureId)

    if (error) {
      showToast({
        type: 'error',
        title: 'Error saving procedure override',
        message: error.message
      })
    } else {
      setProcedureOverrides(prev => {
        if (minutes === null) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [procedureId]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [procedureId]: minutes }
      })
      setSuccessMessage('Procedure arrival time saved')
      setTimeout(() => setSuccessMessage(null), 3000)
    }

    setSaving(false)
  }

  // Clear procedure override
  const handleClearOverride = async (procedureId: string) => {
    await handleSaveProcedureOverride(procedureId, null)
  }

  // Feature not enabled
  if (!featureLoading && !isEnabled) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Patient Check-In</h1>
        <p className="text-slate-500 mb-6">Configure arrival times and pre-op checklists</p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Feature Not Enabled</h3>
          <p className="text-slate-500 text-sm mb-4">
            Patient Check-In is not enabled for your facility.
          </p>
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            View Available Add-Ons
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Patient Check-In</h1>
      <p className="text-slate-500 mb-6">Configure arrival times and pre-op checklists</p>

      {/* Trial Banner */}
      <TrialBanner feature={FEATURES.PATIENT_CHECKIN} />

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-green-600">{successMessage}</span>
          </div>
        )}

        <div className="space-y-8">
          {/* Default Arrival Time */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Default Arrival Time</h2>
              <p className="text-sm text-slate-500 mt-1">
                How early patients should arrive before their scheduled surgery time
              </p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Minutes before surgery
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="15"
                        max="240"
                        step="15"
                        value={defaultLeadTime}
                        onChange={(e) => setDefaultLeadTime(parseInt(e.target.value) || 90)}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-center font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-slate-500">minutes</span>
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div className="flex items-center gap-2">
                    {[60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setDefaultLeadTime(mins)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          defaultLeadTime === mins
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>

                  <Button onClick={handleSaveDefault} loading={saving} className="ml-auto">
                    Save
                  </Button>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-4">
                Example: If surgery is at 8:00 AM and lead time is 90 minutes,
                the patient&apos;s expected arrival is 6:30 AM.
              </p>
            </div>
          </div>

          {/* Procedure-Specific Overrides */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Procedure Overrides</h2>
              <p className="text-sm text-slate-500 mt-1">
                Set different arrival times for specific procedures
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (procedures || []).length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No procedures found. Add procedures in Settings → Procedures.
                </div>
              ) : (
                (procedures || []).map((procedure) => {
                  const hasOverride = procedureOverrides[procedure.id] !== undefined
                  const overrideValue = procedureOverrides[procedure.id] ?? defaultLeadTime

                  return (
                    <div key={procedure.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{procedure.name}</div>
                        <div className="text-sm text-slate-500">
                          {hasOverride ? (
                            <span className="text-blue-600">
                              Override: {overrideValue} minutes
                            </span>
                          ) : (
                            <span>Using default ({defaultLeadTime} minutes)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {hasOverride ? (
                          <>
                            <input
                              type="number"
                              min="15"
                              max="240"
                              step="15"
                              value={overrideValue}
                              onChange={(e) => {
                                const newValue = parseInt(e.target.value)
                                if (newValue) {
                                  setProcedureOverrides(prev => ({
                                    ...prev,
                                    [procedure.id]: newValue
                                  }))
                                }
                              }}
                              onBlur={(e) => {
                                const newValue = parseInt(e.target.value)
                                if (newValue) {
                                  handleSaveProcedureOverride(procedure.id, newValue)
                                }
                              }}
                              className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleClearOverride(procedure.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove override"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSaveProcedureOverride(procedure.id, defaultLeadTime)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            + Set Override
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Checklist Builder Link */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Pre-Op Checklist</h2>
              <p className="text-sm text-slate-500 mt-1">
                Customize the checklist items staff complete during patient check-in
              </p>
            </div>

            <div className="p-6">
              <Link
                href="/settings/checklist-builder"
                className="inline-flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group"
              >
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200 group-hover:border-slate-300">
                  <ClipboardCheck className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">Checklist Builder</div>
                  <div className="text-sm text-slate-500">Add, edit, and reorder checklist items</div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
              </Link>
          </div>
        </div>
      </div>
    </>
  )
}