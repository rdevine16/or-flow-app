'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

interface AnalyticsSettings {
  id: string
  facility_id: string
  // FCOTS
  fcots_milestone: 'patient_in' | 'incision'
  fcots_grace_minutes: number
  fcots_target_percent: number
  // Surgical Turnovers
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
  turnover_threshold_minutes: number
  turnover_compliance_target_percent: number
  // OR Utilization
  utilization_target_percent: number
  // Cancellations
  cancellation_target_percent: number
  // Surgeon Idle Time
  idle_combined_target_minutes: number
  idle_flip_target_minutes: number
  idle_same_room_target_minutes: number
  // Tardiness & Non-Operative Time
  tardiness_target_minutes: number
  non_op_warn_minutes: number
  non_op_bad_minutes: number
  // Dashboard Alerts
  behind_schedule_grace_minutes: number
  // Operational
  operating_days_per_year: number
  // Case Financials
  financial_benchmark_case_count: number
  // ORbit Score v2
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
}

const DEFAULT_SETTINGS: Omit<AnalyticsSettings, 'id' | 'facility_id'> = {
  // FCOTS
  fcots_milestone: 'patient_in',
  fcots_grace_minutes: 2,
  fcots_target_percent: 85,
  // Surgical Turnovers (corrected defaults)
  turnover_target_same_surgeon: 45,
  turnover_target_flip_room: 15,
  turnover_threshold_minutes: 30,
  turnover_compliance_target_percent: 80,
  // OR Utilization (corrected default)
  utilization_target_percent: 75,
  // Cancellations
  cancellation_target_percent: 5,
  // Surgeon Idle Time
  idle_combined_target_minutes: 10,
  idle_flip_target_minutes: 5,
  idle_same_room_target_minutes: 10,
  // Tardiness & Non-Operative Time
  tardiness_target_minutes: 45,
  non_op_warn_minutes: 20,
  non_op_bad_minutes: 30,
  // Dashboard Alerts
  behind_schedule_grace_minutes: 15,
  // Operational
  operating_days_per_year: 250,
  // Case Financials
  financial_benchmark_case_count: 10,
  // ORbit Score v2
  start_time_milestone: 'patient_in',
  start_time_grace_minutes: 3,
  start_time_floor_minutes: 20,
  waiting_on_surgeon_minutes: 3,
  waiting_on_surgeon_floor_minutes: 10,
  min_procedure_cases: 3,
}

// Helper component for number input fields
function SettingsNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = '1',
  helpText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min: string
  max: string
  step?: string
  helpText: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
      <p className="mt-1 text-xs text-slate-500">{helpText}</p>
    </div>
  )
}

// Helper component for section headers
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  )
}

export default function AnalyticsSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const { data: settings, loading, refetch: refetchSettings } = useSupabaseQuery<AnalyticsSettings | null>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_analytics_settings')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .single()
      if (error?.code === 'PGRST116') return null // No settings row yet
      if (error) throw error
      return data as AnalyticsSettings
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)

  // Form state (strings for controlled inputs)
  const [form, setForm] = useState({
    // FCOTS
    fcots_milestone: 'patient_in' as 'patient_in' | 'incision',
    fcots_grace_minutes: '2',
    fcots_target_percent: '85',
    // Surgical Turnovers
    turnover_target_same_surgeon: '45',
    turnover_target_flip_room: '15',
    turnover_threshold_minutes: '30',
    turnover_compliance_target_percent: '80',
    // OR Utilization
    utilization_target_percent: '75',
    // Cancellations
    cancellation_target_percent: '5',
    // Surgeon Idle Time
    idle_combined_target_minutes: '10',
    idle_flip_target_minutes: '5',
    idle_same_room_target_minutes: '10',
    // Tardiness & Non-Operative Time
    tardiness_target_minutes: '45',
    non_op_warn_minutes: '20',
    non_op_bad_minutes: '30',
    // Dashboard Alerts
    behind_schedule_grace_minutes: '15',
    // Operational
    operating_days_per_year: '250',
    // Case Financials
    financial_benchmark_case_count: '10',
    // ORbit Score v2
    start_time_milestone: 'patient_in' as 'patient_in' | 'incision',
    start_time_grace_minutes: '3',
    start_time_floor_minutes: '20',
    waiting_on_surgeon_minutes: '3',
    waiting_on_surgeon_floor_minutes: '10',
    min_procedure_cases: '3',
  })

  // Sync fetched settings to form state
  const syncFormFromSettings = useCallback(() => {
    if (!settings) return

    setForm({
      // FCOTS
      fcots_milestone: settings.fcots_milestone || 'patient_in',
      fcots_grace_minutes: String(settings.fcots_grace_minutes ?? 2),
      fcots_target_percent: String(settings.fcots_target_percent ?? 85),
      // Surgical Turnovers
      turnover_target_same_surgeon: String(settings.turnover_target_same_surgeon ?? 45),
      turnover_target_flip_room: String(settings.turnover_target_flip_room ?? 15),
      turnover_threshold_minutes: String(settings.turnover_threshold_minutes ?? 30),
      turnover_compliance_target_percent: String(settings.turnover_compliance_target_percent ?? 80),
      // OR Utilization
      utilization_target_percent: String(settings.utilization_target_percent ?? 75),
      // Cancellations
      cancellation_target_percent: String(settings.cancellation_target_percent ?? 5),
      // Surgeon Idle Time
      idle_combined_target_minutes: String(settings.idle_combined_target_minutes ?? 10),
      idle_flip_target_minutes: String(settings.idle_flip_target_minutes ?? 5),
      idle_same_room_target_minutes: String(settings.idle_same_room_target_minutes ?? 10),
      // Tardiness & Non-Operative Time
      tardiness_target_minutes: String(settings.tardiness_target_minutes ?? 45),
      non_op_warn_minutes: String(settings.non_op_warn_minutes ?? 20),
      non_op_bad_minutes: String(settings.non_op_bad_minutes ?? 30),
      // Dashboard Alerts
      behind_schedule_grace_minutes: String(settings.behind_schedule_grace_minutes ?? 15),
      // Operational
      operating_days_per_year: String(settings.operating_days_per_year ?? 250),
      // Case Financials
      financial_benchmark_case_count: String(settings.financial_benchmark_case_count ?? 10),
      // ORbit Score v2
      start_time_milestone: settings.start_time_milestone || settings.fcots_milestone || 'patient_in',
      start_time_grace_minutes: String(settings.start_time_grace_minutes ?? settings.fcots_grace_minutes ?? 3),
      start_time_floor_minutes: String(settings.start_time_floor_minutes ?? 20),
      waiting_on_surgeon_minutes: String(settings.waiting_on_surgeon_minutes ?? 3),
      waiting_on_surgeon_floor_minutes: String(settings.waiting_on_surgeon_floor_minutes ?? 10),
      min_procedure_cases: String(settings.min_procedure_cases ?? 3),
    })
  }, [settings])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncFormFromSettings()
  }, [syncFormFromSettings])

  const handleSave = async () => {
    if (!effectiveFacilityId) return
    setSaving(true)

    const payload = {
      facility_id: effectiveFacilityId,
      // FCOTS
      fcots_milestone: form.fcots_milestone,
      fcots_grace_minutes: parseFloat(form.fcots_grace_minutes) || 2,
      fcots_target_percent: parseFloat(form.fcots_target_percent) || 85,
      // Surgical Turnovers
      turnover_target_same_surgeon: parseFloat(form.turnover_target_same_surgeon) || 45,
      turnover_target_flip_room: parseFloat(form.turnover_target_flip_room) || 15,
      turnover_threshold_minutes: parseFloat(form.turnover_threshold_minutes) || 30,
      turnover_compliance_target_percent: parseFloat(form.turnover_compliance_target_percent) || 80,
      // OR Utilization
      utilization_target_percent: parseFloat(form.utilization_target_percent) || 75,
      // Cancellations
      cancellation_target_percent: parseFloat(form.cancellation_target_percent) || 5,
      // Surgeon Idle Time
      idle_combined_target_minutes: parseFloat(form.idle_combined_target_minutes) || 10,
      idle_flip_target_minutes: parseFloat(form.idle_flip_target_minutes) || 5,
      idle_same_room_target_minutes: parseFloat(form.idle_same_room_target_minutes) || 10,
      // Tardiness & Non-Operative Time
      tardiness_target_minutes: parseFloat(form.tardiness_target_minutes) || 45,
      non_op_warn_minutes: parseFloat(form.non_op_warn_minutes) || 20,
      non_op_bad_minutes: parseFloat(form.non_op_bad_minutes) || 30,
      // Dashboard Alerts
      behind_schedule_grace_minutes: parseInt(form.behind_schedule_grace_minutes) || 15,
      // Operational
      operating_days_per_year: parseInt(form.operating_days_per_year) || 250,
      // Case Financials
      financial_benchmark_case_count: parseInt(form.financial_benchmark_case_count) || 10,
      // ORbit Score v2
      start_time_milestone: form.start_time_milestone,
      start_time_grace_minutes: parseInt(form.start_time_grace_minutes) || 3,
      start_time_floor_minutes: parseInt(form.start_time_floor_minutes) || 20,
      waiting_on_surgeon_minutes: parseInt(form.waiting_on_surgeon_minutes) || 3,
      waiting_on_surgeon_floor_minutes: parseInt(form.waiting_on_surgeon_floor_minutes) || 10,
      min_procedure_cases: parseInt(form.min_procedure_cases) || 3,
    }

    let error
    if (settings?.id) {
      // Update existing
      ;({ error } = await supabase
        .from('facility_analytics_settings')
        .update(payload)
        .eq('id', settings.id))
    } else {
      // Insert new
      ;({ error } = await supabase
        .from('facility_analytics_settings')
        .insert(payload))
    }

    if (error) {
      showToast({ type: 'error', title: 'Failed to save settings' })
    } else {
      showToast({ type: 'success', title: 'Analytics settings saved' })
      refetchSettings()
    }

    setSaving(false)
  }

  const handleReset = () => {
    setForm({
      // FCOTS
      fcots_milestone: DEFAULT_SETTINGS.fcots_milestone,
      fcots_grace_minutes: String(DEFAULT_SETTINGS.fcots_grace_minutes),
      fcots_target_percent: String(DEFAULT_SETTINGS.fcots_target_percent),
      // Surgical Turnovers
      turnover_target_same_surgeon: String(DEFAULT_SETTINGS.turnover_target_same_surgeon),
      turnover_target_flip_room: String(DEFAULT_SETTINGS.turnover_target_flip_room),
      turnover_threshold_minutes: String(DEFAULT_SETTINGS.turnover_threshold_minutes),
      turnover_compliance_target_percent: String(DEFAULT_SETTINGS.turnover_compliance_target_percent),
      // OR Utilization
      utilization_target_percent: String(DEFAULT_SETTINGS.utilization_target_percent),
      // Cancellations
      cancellation_target_percent: String(DEFAULT_SETTINGS.cancellation_target_percent),
      // Surgeon Idle Time
      idle_combined_target_minutes: String(DEFAULT_SETTINGS.idle_combined_target_minutes),
      idle_flip_target_minutes: String(DEFAULT_SETTINGS.idle_flip_target_minutes),
      idle_same_room_target_minutes: String(DEFAULT_SETTINGS.idle_same_room_target_minutes),
      // Tardiness & Non-Operative Time
      tardiness_target_minutes: String(DEFAULT_SETTINGS.tardiness_target_minutes),
      non_op_warn_minutes: String(DEFAULT_SETTINGS.non_op_warn_minutes),
      non_op_bad_minutes: String(DEFAULT_SETTINGS.non_op_bad_minutes),
      // Dashboard Alerts
      behind_schedule_grace_minutes: String(DEFAULT_SETTINGS.behind_schedule_grace_minutes),
      // Operational
      operating_days_per_year: String(DEFAULT_SETTINGS.operating_days_per_year),
      // Case Financials
      financial_benchmark_case_count: String(DEFAULT_SETTINGS.financial_benchmark_case_count),
      // ORbit Score v2
      start_time_milestone: DEFAULT_SETTINGS.start_time_milestone,
      start_time_grace_minutes: String(DEFAULT_SETTINGS.start_time_grace_minutes),
      start_time_floor_minutes: String(DEFAULT_SETTINGS.start_time_floor_minutes),
      waiting_on_surgeon_minutes: String(DEFAULT_SETTINGS.waiting_on_surgeon_minutes),
      waiting_on_surgeon_floor_minutes: String(DEFAULT_SETTINGS.waiting_on_surgeon_floor_minutes),
      min_procedure_cases: String(DEFAULT_SETTINGS.min_procedure_cases),
    })
  }

  if (userLoading || loading) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analytics Settings</h1>
        <p className="text-slate-500 mb-6">Configure how your facility&apos;s OR metrics are calculated and what targets to measure against.</p>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analytics Settings</h1>
        <p className="text-slate-500 mb-6">Configure how your facility&apos;s OR metrics are calculated and what targets to measure against.</p>
        <div className="text-center py-16 text-slate-500">
          <p>No facility selected. Please select a facility to configure analytics settings.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analytics Settings</h1>
      <p className="text-slate-500 mb-6">Configure how your facility&apos;s OR metrics are calculated and what targets to measure against.</p>

      <div className="space-y-8">

            {/* Section 1: FCOTS Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="First Case On-Time Start (FCOTS)"
                description="Define what &quot;on-time&quot; means for your facility"
              />
              <div className="p-6 space-y-4">
                {/* Milestone Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start Milestone
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Which event defines when the first case has &quot;started&quot;?
                  </p>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      form.fcots_milestone === 'patient_in'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="fcots_milestone"
                        value="patient_in"
                        checked={form.fcots_milestone === 'patient_in'}
                        onChange={(e) => setForm({ ...form, fcots_milestone: e.target.value as 'patient_in' | 'incision' })}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-900">Wheels In</div>
                        <div className="text-xs text-slate-500">Patient enters the OR</div>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      form.fcots_milestone === 'incision'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="fcots_milestone"
                        value="incision"
                        checked={form.fcots_milestone === 'incision'}
                        onChange={(e) => setForm({ ...form, fcots_milestone: e.target.value as 'patient_in' | 'incision' })}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-900">Incision</div>
                        <div className="text-xs text-slate-500">Cut time / procedure start</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Grace Period + Target */}
                <div className="grid grid-cols-2 gap-4">
                  <SettingsNumberField
                    label="Grace Period (minutes)"
                    value={form.fcots_grace_minutes}
                    onChange={(v) => setForm({ ...form, fcots_grace_minutes: v })}
                    min="0"
                    max="30"
                    helpText="Minutes after scheduled time still considered &quot;on-time&quot;"
                  />
                  <SettingsNumberField
                    label="Target (%)"
                    value={form.fcots_target_percent}
                    onChange={(v) => setForm({ ...form, fcots_target_percent: v })}
                    min="0"
                    max="100"
                    helpText="Industry benchmark: 85%"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Surgical Turnovers */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Surgical Turnovers"
                description="Target times and compliance thresholds for room turnovers"
              />
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <SettingsNumberField
                    label="Same-Room Target (min)"
                    value={form.turnover_target_same_surgeon}
                    onChange={(v) => setForm({ ...form, turnover_target_same_surgeon: v })}
                    min="5"
                    max="120"
                    step="5"
                    helpText="Same surgeon, same OR. Benchmark: 45 min"
                  />
                  <SettingsNumberField
                    label="Flip-Room Target (min)"
                    value={form.turnover_target_flip_room}
                    onChange={(v) => setForm({ ...form, turnover_target_flip_room: v })}
                    min="5"
                    max="120"
                    step="5"
                    helpText="Surgeon moves to different OR. Benchmark: 15 min"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <SettingsNumberField
                    label="Room Turnover Threshold (min)"
                    value={form.turnover_threshold_minutes}
                    onChange={(v) => setForm({ ...form, turnover_threshold_minutes: v })}
                    min="5"
                    max="120"
                    step="5"
                    helpText='A turnover is "compliant" if under this'
                  />
                  <SettingsNumberField
                    label="Compliance Target (%)"
                    value={form.turnover_compliance_target_percent}
                    onChange={(v) => setForm({ ...form, turnover_compliance_target_percent: v })}
                    min="0"
                    max="100"
                    helpText="Target % of turnovers under threshold"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: OR Utilization */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="OR Utilization"
                description="Operating room utilization targets"
              />
              <div className="p-6">
                <div className="max-w-xs">
                  <SettingsNumberField
                    label="Utilization Target (%)"
                    value={form.utilization_target_percent}
                    onChange={(v) => setForm({ ...form, utilization_target_percent: v })}
                    min="0"
                    max="100"
                    step="5"
                    helpText="Patient-in-room time as % of available hours. Benchmark: 75%"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Cancellations */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Cancellations"
                description="Same-day cancellation rate targets"
              />
              <div className="p-6">
                <div className="max-w-xs">
                  <SettingsNumberField
                    label="Same-Day Cancellation Target (%)"
                    value={form.cancellation_target_percent}
                    onChange={(v) => setForm({ ...form, cancellation_target_percent: v })}
                    min="0"
                    max="100"
                    helpText="Max acceptable same-day cancellation rate. Benchmark: <5%"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Surgeon Idle Time */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Surgeon Idle Time"
                description="Acceptable idle time between cases for surgeons"
              />
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <SettingsNumberField
                    label="Combined Idle Target (min)"
                    value={form.idle_combined_target_minutes}
                    onChange={(v) => setForm({ ...form, idle_combined_target_minutes: v })}
                    min="1"
                    max="60"
                    helpText="Total acceptable idle time between cases"
                  />
                  <SettingsNumberField
                    label="Flip-Room Idle Target (min)"
                    value={form.idle_flip_target_minutes}
                    onChange={(v) => setForm({ ...form, idle_flip_target_minutes: v })}
                    min="1"
                    max="60"
                    helpText="Idle time when surgeon moves to another OR"
                  />
                  <SettingsNumberField
                    label="Same-Room Idle Target (min)"
                    value={form.idle_same_room_target_minutes}
                    onChange={(v) => setForm({ ...form, idle_same_room_target_minutes: v })}
                    min="1"
                    max="60"
                    helpText="Idle time when surgeon stays in same OR"
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Tardiness & Non-Operative Time */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Tardiness & Non-Operative Time"
                description="Thresholds for cumulative tardiness and non-operative time warnings"
              />
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <SettingsNumberField
                    label="Cumulative Tardiness Target (min)"
                    value={form.tardiness_target_minutes}
                    onChange={(v) => setForm({ ...form, tardiness_target_minutes: v })}
                    min="5"
                    max="120"
                    helpText="Max cumulative tardiness per day"
                  />
                  <SettingsNumberField
                    label="Non-Op Time Warning (min)"
                    value={form.non_op_warn_minutes}
                    onChange={(v) => setForm({ ...form, non_op_warn_minutes: v })}
                    min="5"
                    max="120"
                    helpText="Avg non-operative time that triggers warning"
                  />
                  <SettingsNumberField
                    label="Non-Op Time Alert (min)"
                    value={form.non_op_bad_minutes}
                    onChange={(v) => setForm({ ...form, non_op_bad_minutes: v })}
                    min="5"
                    max="120"
                    helpText="Avg non-operative time that triggers alert"
                  />
                </div>
              </div>
            </div>

            {/* Section 7: Dashboard Alerts */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Dashboard Alerts"
                description="Configure thresholds for the Needs Attention alerts on the dashboard"
              />
              <div className="p-6">
                <div className="max-w-xs">
                  <SettingsNumberField
                    label="Behind Schedule Grace (minutes)"
                    value={form.behind_schedule_grace_minutes}
                    onChange={(v) => setForm({ ...form, behind_schedule_grace_minutes: v })}
                    min="0"
                    max="60"
                    helpText="Extra minutes after estimated duration before a room is flagged as behind schedule"
                  />
                </div>
              </div>
            </div>

            {/* Section 8: Operational */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Operational"
                description="General operational parameters for projections and reporting"
              />
              <div className="p-6">
                <div className="max-w-xs">
                  <SettingsNumberField
                    label="Operating Days per Year"
                    value={form.operating_days_per_year}
                    onChange={(v) => setForm({ ...form, operating_days_per_year: v })}
                    min="1"
                    max="365"
                    helpText="Used for annualized projections in AI Insights"
                  />
                </div>
              </div>
            </div>

            {/* Section 8: Case Financials */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="Case Financials"
                description="Configure how profit margins and benchmarks are calculated in the case drawer"
              />
              <div className="p-6">
                <div className="max-w-xs">
                  <SettingsNumberField
                    label="Benchmark Case Count"
                    value={form.financial_benchmark_case_count}
                    onChange={(v) => setForm({ ...form, financial_benchmark_case_count: v })}
                    min="5"
                    max="100"
                    helpText="Number of recent validated cases used to calculate surgeon and facility median margins"
                  />
                </div>
              </div>
            </div>

            {/* Section 9: ORbit Score Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">ORbit Score</h3>
                  <span className="text-xs font-bold tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                    v2
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Surgeon scorecard thresholds — graduated scoring with linear decay</p>
              </div>
              <div className="p-6 space-y-6">

                {/* Schedule Adherence */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-pink-500" />
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Schedule Adherence</h4>
                    <span className="text-xs text-slate-400 font-mono">25% weight</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Measures whether cases start at or before their scheduled time. All cases (first and subsequent) are scored identically using graduated decay.
                  </p>

                  {/* Milestone Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Start Milestone
                    </label>
                    <div className="flex gap-3">
                      <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.start_time_milestone === 'patient_in'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="start_time_milestone"
                          value="patient_in"
                          checked={form.start_time_milestone === 'patient_in'}
                          onChange={(e) => setForm({ ...form, start_time_milestone: e.target.value as 'patient_in' | 'incision' })}
                          className="text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">Patient In</div>
                          <div className="text-xs text-slate-500">When patient enters OR</div>
                        </div>
                      </label>
                      <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.start_time_milestone === 'incision'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="start_time_milestone"
                          value="incision"
                          checked={form.start_time_milestone === 'incision'}
                          onChange={(e) => setForm({ ...form, start_time_milestone: e.target.value as 'patient_in' | 'incision' })}
                          className="text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">Incision</div>
                          <div className="text-xs text-slate-500">Cut time / procedure start</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <SettingsNumberField
                      label="Grace Period (minutes)"
                      value={form.start_time_grace_minutes}
                      onChange={(v) => setForm({ ...form, start_time_grace_minutes: v })}
                      min="0"
                      max="15"
                      helpText="Minutes after scheduled start before score begins to decay"
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Decay Floor (minutes)
                      </label>
                      <input
                        type="number"
                        value={form.start_time_floor_minutes}
                        onChange={(e) => setForm({ ...form, start_time_floor_minutes: e.target.value })}
                        min="5"
                        max="60"
                        step="1"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Minutes over grace until case score reaches 0.
                        {' '}Cost: <span className="font-mono font-semibold text-slate-600">
                          {(1 / (parseInt(form.start_time_floor_minutes) || 20)).toFixed(2)}
                        </span>/min
                      </p>
                    </div>
                  </div>

                  {/* Visual preview */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <span className="font-semibold text-slate-600">Example:</span>{' '}
                      Case scheduled 7:00 AM → within {form.start_time_grace_minutes} min grace = score 1.0.{' '}
                      At {parseInt(form.start_time_grace_minutes || '3') + Math.round((parseInt(form.start_time_floor_minutes || '20')) / 2)} min late = score 0.50.{' '}
                      At {parseInt(form.start_time_grace_minutes || '3') + parseInt(form.start_time_floor_minutes || '20')} min late = score 0.0.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Availability */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Surgeon Availability</h4>
                    <span className="text-xs text-slate-400 font-mono">20% weight</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Measures time between prep/drape complete and incision. Steeper decay because a full surgical team is standing idle.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <SettingsNumberField
                      label="Expected Gap (minutes)"
                      value={form.waiting_on_surgeon_minutes}
                      onChange={(v) => setForm({ ...form, waiting_on_surgeon_minutes: v })}
                      min="0"
                      max="15"
                      helpText="Normal prep-to-incision gap (scrub + site marking)"
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Decay Floor (minutes)
                      </label>
                      <input
                        type="number"
                        value={form.waiting_on_surgeon_floor_minutes}
                        onChange={(e) => setForm({ ...form, waiting_on_surgeon_floor_minutes: e.target.value })}
                        min="3"
                        max="30"
                        step="1"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Minutes over threshold until case score reaches 0.
                        {' '}Cost: <span className="font-mono font-semibold text-slate-600">
                          {(1 / (parseInt(form.waiting_on_surgeon_floor_minutes) || 10)).toFixed(2)}
                        </span>/min
                      </p>
                    </div>
                  </div>

                  {/* Visual preview */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <span className="font-semibold text-slate-600">Example:</span>{' '}
                      Prep/drape done → within {form.waiting_on_surgeon_minutes} min = score 1.0.{' '}
                      At {parseInt(form.waiting_on_surgeon_minutes || '3') + Math.round((parseInt(form.waiting_on_surgeon_floor_minutes || '10')) / 2)} min gap = score 0.50.{' '}
                      At {parseInt(form.waiting_on_surgeon_minutes || '3') + parseInt(form.waiting_on_surgeon_floor_minutes || '10')} min gap = score 0.0.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Cohort Threshold */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Scoring Thresholds</h4>
                  </div>
                  <div className="max-w-xs">
                    <SettingsNumberField
                      label="Min Cases per Procedure Type"
                      value={form.min_procedure_cases}
                      onChange={(v) => setForm({ ...form, min_procedure_cases: v })}
                      min="1"
                      max="10"
                      helpText="Minimum cases of a procedure type to include in peer comparison cohort"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

          </div>
    </>
  )
}
