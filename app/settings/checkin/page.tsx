// app/settings/checkin/page.tsx
// Check-In Settings - Configure arrival times and checklist

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { useFeature, FEATURES } from '../../../lib/features/useFeature'
import { FeatureGate, TrialBanner } from '../../../components/FeatureGate'
import { checkinAudit } from '../../../lib/audit-logger'

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
  const router = useRouter()
  const supabase = createClient()
  const { userData, isAdmin, loading: userLoading } = useUser()
  const { isEnabled, isLoading: featureLoading } = useFeature(FEATURES.PATIENT_CHECKIN)

  const [facility, setFacility] = useState<Facility | null>(null)
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [defaultLeadTime, setDefaultLeadTime] = useState<number>(90)
  const [procedureOverrides, setProcedureOverrides] = useState<Record<string, number | null>>({})

  // Fetch data
  useEffect(() => {
    if (userLoading || !userData?.facilityId) return

    const fetchData = async () => {
      setLoading(true)

      // Fetch facility
      const { data: facilityData } = await supabase
        .from('facilities')
        .select('id, name, default_arrival_lead_time_minutes')
        .eq('id', userData.facilityId)
        .single()

      if (facilityData) {
        setFacility(facilityData)
        setDefaultLeadTime(facilityData.default_arrival_lead_time_minutes || 90)
      }

      // Fetch procedures with their overrides
      const { data: procedureData } = await supabase
        .from('procedure_types')
        .select('id, name, arrival_lead_time_minutes')
        .eq('facility_id', userData.facilityId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')

      if (procedureData) {
        setProcedures(procedureData)
        const overrides: Record<string, number | null> = {}
        procedureData.forEach(p => {
          if (p.arrival_lead_time_minutes !== null) {
            overrides[p.id] = p.arrival_lead_time_minutes
          }
        })
        setProcedureOverrides(overrides)
      }

      setLoading(false)
    }

    fetchData()
  }, [userData?.facilityId, userLoading, supabase])

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
      console.error('Error saving:', error)
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
      console.error('Error saving procedure override:', error)
    } else {
      setProcedureOverrides(prev => {
        if (minutes === null) {
          const { [procedureId]: _, ...rest } = prev
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
      <DashboardLayout>
        <SettingsLayout 
          title="Patient Check-In" 
          description="Configure arrival times and pre-op checklists"
        >
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
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
        </SettingsLayout>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <SettingsLayout 
        title="Patient Check-In" 
        description="Configure arrival times and pre-op checklists"
      >
        {/* Trial Banner */}
        <TrialBanner feature={FEATURES.PATIENT_CHECKIN} />

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-emerald-700">{successMessage}</span>
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

                  <button
                    onClick={handleSaveDefault}
                    disabled={saving}
                    className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-4">
                Example: If surgery is at 8:00 AM and lead time is 90 minutes, 
                the patient's expected arrival is 6:30 AM.
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
              ) : procedures.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No procedures found. Add procedures in Settings → Procedures.
                </div>
              ) : (
                procedures.map((procedure) => {
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
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove override"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
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
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">Checklist Builder</div>
                  <div className="text-sm text-slate-500">Add, edit, and reorder checklist items</div>
                </div>
                <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  )
}