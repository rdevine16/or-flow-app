'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useUser } from '@/lib/UserContext'

interface AnalyticsSettings {
  id: string
  facility_id: string
  fcots_milestone: 'patient_in' | 'incision'
  fcots_grace_minutes: number
  fcots_target_percent: number
  turnover_target_same_surgeon: number
  turnover_target_flip_room: number
  utilization_target_percent: number
  cancellation_target_percent: number
  // ORbit Score v2
  start_time_milestone: 'patient_in' | 'incision'
  start_time_grace_minutes: number
  start_time_floor_minutes: number
  waiting_on_surgeon_minutes: number
  waiting_on_surgeon_floor_minutes: number
  min_procedure_cases: number
}

const DEFAULT_SETTINGS: Omit<AnalyticsSettings, 'id' | 'facility_id'> = {
  fcots_milestone: 'patient_in',
  fcots_grace_minutes: 2,
  fcots_target_percent: 85,
  turnover_target_same_surgeon: 30,
  turnover_target_flip_room: 45,
  utilization_target_percent: 80,
  cancellation_target_percent: 5,
  // ORbit Score v2
  start_time_milestone: 'patient_in',
  start_time_grace_minutes: 3,
  start_time_floor_minutes: 20,
  waiting_on_surgeon_minutes: 3,
  waiting_on_surgeon_floor_minutes: 10,
  min_procedure_cases: 3,
}

export default function AnalyticsSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [settings, setSettings] = useState<AnalyticsSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Form state (strings for controlled inputs)
  const [form, setForm] = useState({
    fcots_milestone: 'patient_in' as 'patient_in' | 'incision',
    fcots_grace_minutes: '2',
    fcots_target_percent: '85',
    turnover_target_same_surgeon: '30',
    turnover_target_flip_room: '45',
    utilization_target_percent: '80',
    cancellation_target_percent: '5',
    // ORbit Score v2
    start_time_milestone: 'patient_in' as 'patient_in' | 'incision',
    start_time_grace_minutes: '3',
    start_time_floor_minutes: '20',
    waiting_on_surgeon_minutes: '3',
    waiting_on_surgeon_floor_minutes: '10',
    min_procedure_cases: '3',
  })

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchSettings()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchSettings = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('facility_analytics_settings')
      .select('*')
      .eq('facility_id', effectiveFacilityId)
      .single()

    if (data) {
      setSettings(data as AnalyticsSettings)
      setForm({
        fcots_milestone: data.fcots_milestone || 'patient_in',
        fcots_grace_minutes: String(data.fcots_grace_minutes ?? 2),
        fcots_target_percent: String(data.fcots_target_percent ?? 85),
        turnover_target_same_surgeon: String(data.turnover_target_same_surgeon ?? 30),
        turnover_target_flip_room: String(data.turnover_target_flip_room ?? 45),
        utilization_target_percent: String(data.utilization_target_percent ?? 80),
        cancellation_target_percent: String(data.cancellation_target_percent ?? 5),
        // ORbit Score v2
        start_time_milestone: data.start_time_milestone || data.fcots_milestone || 'patient_in',
        start_time_grace_minutes: String(data.start_time_grace_minutes ?? data.fcots_grace_minutes ?? 3),
        start_time_floor_minutes: String(data.start_time_floor_minutes ?? 20),
        waiting_on_surgeon_minutes: String(data.waiting_on_surgeon_minutes ?? 3),
        waiting_on_surgeon_floor_minutes: String(data.waiting_on_surgeon_floor_minutes ?? 10),
        min_procedure_cases: String(data.min_procedure_cases ?? 3),
      })
    } else if (error?.code === 'PGRST116') {
      // No settings row yet — will insert on save
      setSettings(null)
    }

    setLoading(false)
  }

  const handleSave = async () => {
    if (!effectiveFacilityId) return
    setSaving(true)

    const payload = {
      facility_id: effectiveFacilityId,
      fcots_milestone: form.fcots_milestone,
      fcots_grace_minutes: parseFloat(form.fcots_grace_minutes) || 2,
      fcots_target_percent: parseFloat(form.fcots_target_percent) || 85,
      turnover_target_same_surgeon: parseFloat(form.turnover_target_same_surgeon) || 30,
      turnover_target_flip_room: parseFloat(form.turnover_target_flip_room) || 45,
      utilization_target_percent: parseFloat(form.utilization_target_percent) || 80,
      cancellation_target_percent: parseFloat(form.cancellation_target_percent) || 5,
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
      setToast({ message: 'Failed to save settings', type: 'error' })
    } else {
      setToast({ message: 'Analytics settings saved', type: 'success' })
      fetchSettings()
    }

    setSaving(false)
    setTimeout(() => setToast(null), 3000)
  }

  const handleReset = () => {
    setForm({
      fcots_milestone: DEFAULT_SETTINGS.fcots_milestone,
      fcots_grace_minutes: String(DEFAULT_SETTINGS.fcots_grace_minutes),
      fcots_target_percent: String(DEFAULT_SETTINGS.fcots_target_percent),
      turnover_target_same_surgeon: String(DEFAULT_SETTINGS.turnover_target_same_surgeon),
      turnover_target_flip_room: String(DEFAULT_SETTINGS.turnover_target_flip_room),
      utilization_target_percent: String(DEFAULT_SETTINGS.utilization_target_percent),
      cancellation_target_percent: String(DEFAULT_SETTINGS.cancellation_target_percent),
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
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Analytics Settings" description="Configure how your facility's OR metrics are calculated and what targets to measure against.">
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Analytics Settings" description="Configure how your facility's OR metrics are calculated and what targets to measure against.">
            <div className="text-center py-20 text-slate-500">
              <p>No facility selected. Please select a facility to configure analytics settings.</p>
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Analytics Settings" description="Configure how your facility's OR metrics are calculated and what targets to measure against.">
          <div className="space-y-8">
            {/* FCOTS Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">First Case On-Time Start (FCOTS)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define what &quot;on-time&quot; means for your facility</p>
              </div>
              <div className="p-6 space-y-5">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      value={form.fcots_grace_minutes}
                      onChange={(e) => setForm({ ...form, fcots_grace_minutes: e.target.value })}
                      min="0"
                      max="30"
                      step="1"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Minutes after scheduled time still considered &quot;on-time&quot;
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Target (%)
                    </label>
                    <input
                      type="number"
                      value={form.fcots_target_percent}
                      onChange={(e) => setForm({ ...form, fcots_target_percent: e.target.value })}
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Industry benchmark: 85%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Turnover Targets */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">Turnover Targets</h3>
                <p className="text-xs text-slate-500 mt-0.5">Target times for room turnovers (minutes)</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Same Surgeon (minutes)
                    </label>
                    <input
                      type="number"
                      value={form.turnover_target_same_surgeon}
                      onChange={(e) => setForm({ ...form, turnover_target_same_surgeon: e.target.value })}
                      min="5"
                      max="120"
                      step="5"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Same surgeon, same room. Benchmark: 25–30 min
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Flip Room (minutes)
                    </label>
                    <input
                      type="number"
                      value={form.turnover_target_flip_room}
                      onChange={(e) => setForm({ ...form, turnover_target_flip_room: e.target.value })}
                      min="5"
                      max="120"
                      step="5"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Surgeon switches rooms. Benchmark: 40–45 min
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Targets */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">Other Targets</h3>
                <p className="text-xs text-slate-500 mt-0.5">Performance thresholds for dashboard KPIs</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      OR Utilization Target (%)
                    </label>
                    <input
                      type="number"
                      value={form.utilization_target_percent}
                      onChange={(e) => setForm({ ...form, utilization_target_percent: e.target.value })}
                      min="0"
                      max="100"
                      step="5"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Patient-in-room time as % of available hours. Benchmark: 75–85%
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Same-Day Cancellation Target (%)
                    </label>
                    <input
                      type="number"
                      value={form.cancellation_target_percent}
                      onChange={(e) => setForm({ ...form, cancellation_target_percent: e.target.value })}
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Maximum acceptable same-day cancellation rate. Benchmark: &lt;5%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ORbit Score Configuration */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">ORbit Score</h3>
                  <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
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
                    <span className="text-[10px] text-slate-400 font-mono">25% weight</span>
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
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Grace Period (minutes)
                      </label>
                      <input
                        type="number"
                        value={form.start_time_grace_minutes}
                        onChange={(e) => setForm({ ...form, start_time_grace_minutes: e.target.value })}
                        min="0"
                        max="15"
                        step="1"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Minutes after scheduled start before score begins to decay
                      </p>
                    </div>
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
                    <p className="text-[11px] text-slate-500 leading-relaxed">
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
                    <span className="text-[10px] text-slate-400 font-mono">20% weight</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Measures time between prep/drape complete and incision. Steeper decay because a full surgical team is standing idle.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Expected Gap (minutes)
                      </label>
                      <input
                        type="number"
                        value={form.waiting_on_surgeon_minutes}
                        onChange={(e) => setForm({ ...form, waiting_on_surgeon_minutes: e.target.value })}
                        min="0"
                        max="15"
                        step="1"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Normal prep-to-incision gap (scrub + site marking)
                      </p>
                    </div>
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
                    <p className="text-[11px] text-slate-500 leading-relaxed">
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
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Min Cases per Procedure Type
                    </label>
                    <input
                      type="number"
                      value={form.min_procedure_cases}
                      onChange={(e) => setForm({ ...form, min_procedure_cases: e.target.value })}
                      min="1"
                      max="10"
                      step="1"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Minimum cases of a procedure type to include in peer comparison cohort
                    </p>
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

            {/* Toast */}
            {toast && (
              <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 ${
                toast.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {toast.message}
              </div>
            )}
          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}