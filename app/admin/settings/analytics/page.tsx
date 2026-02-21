// app/admin/settings/analytics/page.tsx
// Admin Analytics Settings Template — manages global default analytics KPI
// targets that get seeded to newly created facilities via
// copy_analytics_settings_to_facility().

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { Info } from 'lucide-react'

// =====================================================
// TYPES & DEFAULTS
// =====================================================

interface AnalyticsSettingsTemplate {
  id: string
  // FCOTS
  fcots_milestone: 'patient_in' | 'incision'
  fcots_grace_minutes: number
  fcots_target_percent: number
  // Surgical Turnovers
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
  // OR Utilization
  utilization_target_percent: number
  // Cancellations
  cancellation_target_percent: number
  // ORbit Score v2
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
}

/** Seed values from the migration — used for "Reset to Defaults" */
const SEED_DEFAULTS: Omit<AnalyticsSettingsTemplate, 'id'> = {
  fcots_milestone: 'patient_in',
  fcots_grace_minutes: 2,
  fcots_target_percent: 85,
  turnover_target_same_surgeon: 30,
  turnover_target_flip_room: 45,
  utilization_target_percent: 80,
  cancellation_target_percent: 5,
  start_time_milestone: 'patient_in',
  start_time_grace_minutes: 3,
  start_time_floor_minutes: 20,
  waiting_on_surgeon_minutes: 3,
  waiting_on_surgeon_floor_minutes: 10,
  min_procedure_cases: 3,
}

// =====================================================
// HELPERS
// =====================================================

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

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  )
}

// =====================================================
// COMPONENT
// =====================================================

export default function AdminAnalyticsSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch single-row template
  const { data: template, loading, refetch } = useSupabaseQuery<AnalyticsSettingsTemplate | null>(
    async (sb) => {
      const { data, error } = await sb
        .from('analytics_settings_template')
        .select('*')
        .limit(1)
        .single()
      if (error?.code === 'PGRST116') return null
      if (error) throw error
      return data as AnalyticsSettingsTemplate
    },
    { enabled: isGlobalAdmin }
  )

  const [saving, setSaving] = useState(false)

  // Form state (strings for controlled inputs)
  const [form, setForm] = useState({
    fcots_milestone: 'patient_in' as 'patient_in' | 'incision',
    fcots_grace_minutes: '2',
    fcots_target_percent: '85',
    turnover_target_same_surgeon: '30',
    turnover_target_flip_room: '45',
    utilization_target_percent: '80',
    cancellation_target_percent: '5',
    start_time_milestone: 'patient_in' as 'patient_in' | 'incision',
    start_time_grace_minutes: '3',
    start_time_floor_minutes: '20',
    waiting_on_surgeon_minutes: '3',
    waiting_on_surgeon_floor_minutes: '10',
    min_procedure_cases: '3',
  })

  // Sync fetched template to form state
  const syncFormFromTemplate = useCallback(() => {
    if (!template) return
    setForm({
      fcots_milestone: template.fcots_milestone || 'patient_in',
      fcots_grace_minutes: String(template.fcots_grace_minutes ?? 2),
      fcots_target_percent: String(template.fcots_target_percent ?? 85),
      turnover_target_same_surgeon: String(template.turnover_target_same_surgeon ?? 30),
      turnover_target_flip_room: String(template.turnover_target_flip_room ?? 45),
      utilization_target_percent: String(template.utilization_target_percent ?? 80),
      cancellation_target_percent: String(template.cancellation_target_percent ?? 5),
      start_time_milestone: template.start_time_milestone || 'patient_in',
      start_time_grace_minutes: String(template.start_time_grace_minutes ?? 3),
      start_time_floor_minutes: String(template.start_time_floor_minutes ?? 20),
      waiting_on_surgeon_minutes: String(template.waiting_on_surgeon_minutes ?? 3),
      waiting_on_surgeon_floor_minutes: String(template.waiting_on_surgeon_floor_minutes ?? 10),
      min_procedure_cases: String(template.min_procedure_cases ?? 3),
    })
  }, [template])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncFormFromTemplate()
  }, [syncFormFromTemplate])

  // Client-side validation matching DB CHECK constraints
  const validate = (): string | null => {
    const grace = parseFloat(form.fcots_grace_minutes)
    if (grace < 0 || grace > 30) return 'FCOTS Grace Period must be 0–30 minutes'

    const target = parseFloat(form.fcots_target_percent)
    if (target < 0 || target > 100) return 'FCOTS Target must be 0–100%'

    const stGrace = parseInt(form.start_time_grace_minutes)
    if (stGrace < 0 || stGrace > 15) return 'Schedule Adherence Grace Period must be 0–15 minutes'

    const stFloor = parseInt(form.start_time_floor_minutes)
    if (stFloor < 5 || stFloor > 60) return 'Schedule Adherence Decay Floor must be 5–60 minutes'

    const wos = parseInt(form.waiting_on_surgeon_minutes)
    if (wos < 0 || wos > 15) return 'Surgeon Expected Gap must be 0–15 minutes'

    const wosFloor = parseInt(form.waiting_on_surgeon_floor_minutes)
    if (wosFloor < 3 || wosFloor > 30) return 'Surgeon Decay Floor must be 3–30 minutes'

    const minCases = parseInt(form.min_procedure_cases)
    if (minCases < 1 || minCases > 10) return 'Min Cases per Procedure must be 1–10'

    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      showToast({ type: 'error', title: validationError })
      return
    }

    setSaving(true)

    const payload = {
      fcots_milestone: form.fcots_milestone,
      fcots_grace_minutes: parseFloat(form.fcots_grace_minutes) || 2,
      fcots_target_percent: parseFloat(form.fcots_target_percent) || 85,
      turnover_target_same_surgeon: parseFloat(form.turnover_target_same_surgeon) || 30,
      turnover_target_flip_room: parseFloat(form.turnover_target_flip_room) || 45,
      utilization_target_percent: parseFloat(form.utilization_target_percent) || 80,
      cancellation_target_percent: parseFloat(form.cancellation_target_percent) || 5,
      start_time_milestone: form.start_time_milestone,
      start_time_grace_minutes: parseInt(form.start_time_grace_minutes) || 3,
      start_time_floor_minutes: parseInt(form.start_time_floor_minutes) || 20,
      waiting_on_surgeon_minutes: parseInt(form.waiting_on_surgeon_minutes) || 3,
      waiting_on_surgeon_floor_minutes: parseInt(form.waiting_on_surgeon_floor_minutes) || 10,
      min_procedure_cases: parseInt(form.min_procedure_cases) || 3,
      updated_at: new Date().toISOString(),
    }

    let error
    if (template?.id) {
      ;({ error } = await supabase
        .from('analytics_settings_template')
        .update(payload)
        .eq('id', template.id))
    } else {
      ;({ error } = await supabase
        .from('analytics_settings_template')
        .insert(payload))
    }

    if (error) {
      showToast({ type: 'error', title: 'Failed to save template settings' })
    } else {
      showToast({ type: 'success', title: 'Analytics template defaults saved' })
      refetch()
    }

    setSaving(false)
  }

  const handleReset = () => {
    setForm({
      fcots_milestone: SEED_DEFAULTS.fcots_milestone,
      fcots_grace_minutes: String(SEED_DEFAULTS.fcots_grace_minutes),
      fcots_target_percent: String(SEED_DEFAULTS.fcots_target_percent),
      turnover_target_same_surgeon: String(SEED_DEFAULTS.turnover_target_same_surgeon),
      turnover_target_flip_room: String(SEED_DEFAULTS.turnover_target_flip_room),
      utilization_target_percent: String(SEED_DEFAULTS.utilization_target_percent),
      cancellation_target_percent: String(SEED_DEFAULTS.cancellation_target_percent),
      start_time_milestone: SEED_DEFAULTS.start_time_milestone,
      start_time_grace_minutes: String(SEED_DEFAULTS.start_time_grace_minutes),
      start_time_floor_minutes: String(SEED_DEFAULTS.start_time_floor_minutes),
      waiting_on_surgeon_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_minutes),
      waiting_on_surgeon_floor_minutes: String(SEED_DEFAULTS.waiting_on_surgeon_floor_minutes),
      min_procedure_cases: String(SEED_DEFAULTS.min_procedure_cases),
    })
  }

  // ── Loading state ──
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analytics Settings Template</h1>
          <p className="text-slate-500 mb-6">
            Configure default analytics KPI targets for new facilities.
          </p>
          <PageLoader message="Loading template settings..." />
        </Container>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) return null

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Analytics Settings Template</h1>
          <p className="text-slate-500 mb-6">
            Configure default analytics KPI targets for new facilities.
          </p>

          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 mb-8 bg-blue-50 border border-blue-200 rounded-xl">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              These defaults are applied to newly created facilities. Changes here do not
              affect existing facilities — each facility manages its own analytics settings independently.
            </p>
          </div>

          <div className="space-y-8">

            {/* Section 1: FCOTS Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <SectionHeader
                title="First Case On-Time Start (FCOTS)"
                description="Define what &quot;on-time&quot; means for new facilities"
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
                description="Target times for room turnovers"
              />
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <SettingsNumberField
                    label="Same-Room Target (min)"
                    value={form.turnover_target_same_surgeon}
                    onChange={(v) => setForm({ ...form, turnover_target_same_surgeon: v })}
                    min="5"
                    max="120"
                    step="5"
                    helpText="Same surgeon, same OR. Benchmark: 30 min"
                  />
                  <SettingsNumberField
                    label="Flip-Room Target (min)"
                    value={form.turnover_target_flip_room}
                    onChange={(v) => setForm({ ...form, turnover_target_flip_room: v })}
                    min="5"
                    max="120"
                    step="5"
                    helpText="Surgeon moves to different OR. Benchmark: 45 min"
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
                    helpText="Patient-in-room time as % of available hours. Benchmark: 80%"
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

            {/* Section 5: ORbit Score Configuration */}
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
                      Case scheduled 7:00 AM — within {form.start_time_grace_minutes} min grace = score 1.0.{' '}
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
                      Prep/drape done — within {form.waiting_on_surgeon_minutes} min = score 1.0.{' '}
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
                {saving ? 'Saving...' : 'Save Template Defaults'}
              </button>
            </div>

          </div>
        </div>
      </Container>
    </DashboardLayout>
  )
}
