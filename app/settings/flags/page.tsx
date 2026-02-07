// app/settings/flags/page.tsx
// ORbit Flag System Settings — Phase 2
// Two sections:
//   1. Threshold Flag Rules — auto-detection rules with adjustable thresholds
//   2. Delay Types — user-reported delay categories (add, rename, reorder, deactivate)

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'

// =====================================================
// TYPES
// =====================================================

interface FlagRule {
  id: string
  facility_id: string
  name: string
  description: string | null
  category: string
  metric: string
  start_milestone: string | null
  end_milestone: string | null
  operator: string
  threshold_type: string
  threshold_value: number
  comparison_scope: string
  severity: string
  display_order: number
  is_built_in: boolean
  is_enabled: boolean
  source_rule_id: string | null
  created_at: string
  updated_at: string
}

interface DelayType {
  id: string
  name: string
  display_name: string | null
  description: string | null
  display_order: number
  is_active: boolean
  facility_id: string | null
}

type Severity = 'info' | 'warning' | 'critical'
type ThresholdType = 'median_plus_sd' | 'absolute'

interface Toast {
  message: string
  type: 'success' | 'error'
}

// =====================================================
// CONSTANTS
// =====================================================

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; ring: string }> = {
  info: { label: 'Info', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  warning: { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' },
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  timing: { label: 'Timing', color: 'text-blue-600' },
  efficiency: { label: 'Efficiency', color: 'text-emerald-600' },
  anesthesia: { label: 'Anesthesia', color: 'text-violet-600' },
  recovery: { label: 'Recovery', color: 'text-orange-600' },
}

const SCOPE_LABELS: Record<string, string> = {
  personal: 'Surgeon\'s own history',
  facility: 'Facility-wide',
}

const THRESHOLD_TYPE_LABELS: Record<string, string> = {
  median_plus_sd: 'Median + Standard Deviations',
  absolute: 'Absolute Value (minutes)',
}

// =====================================================
// COMPONENT
// =====================================================

export default function FlagsSettingsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  // State
  const [rules, setRules] = useState<FlagRule[]>([])
  const [delayTypes, setDelayTypes] = useState<DelayType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // rule/delay ID being saved
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // New delay type form
  const [showNewDelay, setShowNewDelay] = useState(false)
  const [newDelayName, setNewDelayName] = useState('')

  // Editing delay type
  const [editingDelay, setEditingDelay] = useState<string | null>(null)
  const [editDelayName, setEditDelayName] = useState('')

  // =====================================================
  // DATA FETCHING
  // =====================================================

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    const [rulesRes, delaysRes] = await Promise.all([
      supabase
        .from('flag_rules')
        .select('*')
        .eq('facility_id', effectiveFacilityId)
        .order('display_order', { ascending: true }),
      supabase
        .from('delay_types')
        .select('*')
        .or(`facility_id.eq.${effectiveFacilityId},facility_id.is.null`)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
    ])

    if (rulesRes.data) setRules(rulesRes.data)
    if (delaysRes.data) setDelayTypes(delaysRes.data)

    setLoading(false)
  }

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  // =====================================================
  // FLAG RULE HANDLERS
  // =====================================================

  const toggleRuleEnabled = async (rule: FlagRule) => {
    const newEnabled = !rule.is_enabled
    // Optimistic update
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: newEnabled } : r))
    setSaving(rule.id)

    const { error } = await supabase
      .from('flag_rules')
      .update({ is_enabled: newEnabled })
      .eq('id', rule.id)

    if (error) {
      // Revert
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: !newEnabled } : r))
      setToast({ message: 'Failed to update rule', type: 'error' })
    } else {
      setToast({ message: `${rule.name} ${newEnabled ? 'enabled' : 'disabled'}`, type: 'success' })
    }
    setSaving(null)
  }

  const updateRuleSeverity = async (rule: FlagRule, severity: Severity) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, severity } : r))
    setSaving(rule.id)

    const { error } = await supabase
      .from('flag_rules')
      .update({ severity })
      .eq('id', rule.id)

    if (error) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, severity: rule.severity } : r))
      setToast({ message: 'Failed to update severity', type: 'error' })
    } else {
      setToast({ message: `Severity updated to ${severity}`, type: 'success' })
    }
    setSaving(null)
  }

  const updateRuleThreshold = async (rule: FlagRule, thresholdType: ThresholdType, thresholdValue: number) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, threshold_type: thresholdType, threshold_value: thresholdValue } : r))
    setSaving(rule.id)

    const { error } = await supabase
      .from('flag_rules')
      .update({ threshold_type: thresholdType, threshold_value: thresholdValue })
      .eq('id', rule.id)

    if (error) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, threshold_type: rule.threshold_type, threshold_value: rule.threshold_value } : r))
      setToast({ message: 'Failed to update threshold', type: 'error' })
    } else {
      setToast({ message: 'Threshold updated', type: 'success' })
    }
    setSaving(null)
  }

  // =====================================================
  // DELAY TYPE HANDLERS
  // =====================================================

  const addDelayType = async () => {
    if (!newDelayName.trim() || !effectiveFacilityId) return
    setSaving('new-delay')

    const maxOrder = delayTypes.reduce((max, d) => Math.max(max, d.display_order), 0)

    const { data, error } = await supabase
      .from('delay_types')
      .insert({
        name: newDelayName.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: newDelayName.trim(),
        facility_id: effectiveFacilityId,
        display_order: maxOrder + 1,
        is_active: true,
      })
      .select()
      .single()

    if (data && !error) {
      setDelayTypes(prev => [...prev, data])
      setNewDelayName('')
      setShowNewDelay(false)
      setToast({ message: `"${data.display_name}" added`, type: 'success' })
    } else {
      setToast({ message: 'Failed to add delay type', type: 'error' })
    }
    setSaving(null)
  }

  const renameDelayType = async (delay: DelayType) => {
    if (!editDelayName.trim()) return
    setSaving(delay.id)

    const { error } = await supabase
      .from('delay_types')
      .update({ display_name: editDelayName.trim() })
      .eq('id', delay.id)

    if (!error) {
      setDelayTypes(prev => prev.map(d => d.id === delay.id ? { ...d, display_name: editDelayName.trim() } : d))
      setEditingDelay(null)
      setEditDelayName('')
      setToast({ message: 'Delay type renamed', type: 'success' })
    } else {
      setToast({ message: 'Failed to rename', type: 'error' })
    }
    setSaving(null)
  }

  const deactivateDelayType = async (delay: DelayType) => {
    setSaving(delay.id)

    const { error } = await supabase
      .from('delay_types')
      .update({ is_active: false })
      .eq('id', delay.id)

    if (!error) {
      setDelayTypes(prev => prev.filter(d => d.id !== delay.id))
      setToast({ message: `"${delay.display_name || delay.name}" deactivated`, type: 'success' })
    } else {
      setToast({ message: 'Failed to deactivate', type: 'error' })
    }
    setSaving(null)
  }

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const renderSeverityBadge = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as Severity] || SEVERITY_CONFIG.info
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${config.bg} ${config.color} ring-1 ${config.ring}`}>
        {config.label}
      </span>
    )
  }

  const renderCategoryBadge = (category: string) => {
    const config = CATEGORY_CONFIG[category] || { label: category, color: 'text-slate-600' }
    return (
      <span className={`text-[11px] font-medium ${config.color} uppercase tracking-wide`}>
        {config.label}
      </span>
    )
  }

  const renderThresholdDescription = (rule: FlagRule) => {
    if (rule.threshold_type === 'absolute') {
      return `> ${rule.threshold_value} min`
    }
    return `> median + ${rule.threshold_value} SD`
  }

  // =====================================================
  // LOADING / EMPTY STATES
  // =====================================================

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Case Flags" description="Configure auto-detection rules and delay categories for your facility.">
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          <SettingsLayout title="Case Flags" description="Configure auto-detection rules and delay categories for your facility.">
            <div className="text-center py-12 text-slate-500">
              No facility found. Please contact support.
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Case Flags" description="Configure auto-detection rules and delay categories for your facility.">
          <div className="space-y-10">

            {/* ============================================= */}
            {/* SECTION 1: THRESHOLD FLAG RULES                */}
            {/* ============================================= */}
            <section>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-900">Auto-Detection Rules</h2>
                <p className="text-sm text-slate-500 mt-1">
                  When a completed case exceeds these thresholds, a flag is automatically created. 
                  Adjust thresholds, severity, or disable rules that aren&apos;t relevant to your facility.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {rules.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">
                    No flag rules found. Rules are seeded when your facility is created.
                  </div>
                ) : (
                  rules.map((rule) => {
                    const isExpanded = expandedRule === rule.id
                    const isSaving = saving === rule.id

                    return (
                      <div key={rule.id} className={`transition-colors ${!rule.is_enabled ? 'bg-slate-50/60' : ''}`}>
                        {/* Collapsed Row */}
                        <div className="flex items-center gap-4 px-5 py-3.5">
                          {/* Enable Toggle */}
                          <button
                            onClick={() => toggleRuleEnabled(rule)}
                            disabled={isSaving}
                            className="flex-shrink-0"
                            title={rule.is_enabled ? 'Disable rule' : 'Enable rule'}
                          >
                            <div className={`relative w-9 h-5 rounded-full transition-colors ${
                              rule.is_enabled ? 'bg-blue-600' : 'bg-slate-300'
                            }`}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                rule.is_enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                              }`} />
                            </div>
                          </button>

                          {/* Name + Description */}
                          <button
                            onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`text-sm font-medium ${rule.is_enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                                {rule.name}
                              </span>
                              {renderCategoryBadge(rule.category)}
                            </div>
                            {rule.description && (
                              <p className={`text-xs mt-0.5 ${rule.is_enabled ? 'text-slate-500' : 'text-slate-400'}`}>
                                {rule.description}
                              </p>
                            )}
                          </button>

                          {/* Threshold Summary */}
                          <div className="flex-shrink-0 text-right">
                            <span className={`text-xs font-mono ${rule.is_enabled ? 'text-slate-600' : 'text-slate-400'}`}>
                              {renderThresholdDescription(rule)}
                            </span>
                          </div>

                          {/* Severity Badge */}
                          <div className="flex-shrink-0">
                            {renderSeverityBadge(rule.severity)}
                          </div>

                          {/* Scope */}
                          <div className="flex-shrink-0 w-20">
                            <span className={`text-[11px] ${rule.is_enabled ? 'text-slate-500' : 'text-slate-400'}`}>
                              {rule.comparison_scope === 'personal' ? 'Personal' : 'Facility'}
                            </span>
                          </div>

                          {/* Expand Chevron */}
                          <button
                            onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Expanded Editor */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50">
                            <div className="grid grid-cols-3 gap-6 mt-3">

                              {/* Threshold Type + Value */}
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                  Threshold
                                </label>
                                <select
                                  value={rule.threshold_type}
                                  onChange={(e) => {
                                    const newType = e.target.value as ThresholdType
                                    const newValue = newType === 'absolute' ? 90 : 1.0
                                    updateRuleThreshold(rule, newType, newValue)
                                  }}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="median_plus_sd">Median + Std Deviations</option>
                                  <option value="absolute">Absolute (minutes)</option>
                                </select>
                                <div className="mt-2.5 flex items-center gap-2">
                                  {rule.threshold_type === 'median_plus_sd' ? (
                                    <>
                                      <span className="text-xs text-slate-500 whitespace-nowrap">Median +</span>
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        max="5"
                                        value={rule.threshold_value}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value)
                                          if (!isNaN(val) && val >= 0.5 && val <= 5) {
                                            updateRuleThreshold(rule, 'median_plus_sd', val)
                                          }
                                        }}
                                        className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-slate-500">SD</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-500">{'>'}</span>
                                      <input
                                        type="number"
                                        step="5"
                                        min="1"
                                        max="600"
                                        value={rule.threshold_value}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value)
                                          if (!isNaN(val) && val >= 1) {
                                            updateRuleThreshold(rule, 'absolute', val)
                                          }
                                        }}
                                        className="w-24 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-slate-500">minutes</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Severity */}
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                  Severity
                                </label>
                                <div className="flex gap-2">
                                  {(Object.keys(SEVERITY_CONFIG) as Severity[]).map((sev) => {
                                    const config = SEVERITY_CONFIG[sev]
                                    const isSelected = rule.severity === sev
                                    return (
                                      <button
                                        key={sev}
                                        onClick={() => updateRuleSeverity(rule, sev)}
                                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                                          isSelected
                                            ? `${config.bg} ${config.color} border-current`
                                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                      >
                                        {config.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Scope (read-only for built-in) */}
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-2">
                                  Comparison Scope
                                </label>
                                <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg">
                                  <span className="text-sm text-slate-700">
                                    {SCOPE_LABELS[rule.comparison_scope] || rule.comparison_scope}
                                  </span>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {rule.comparison_scope === 'personal'
                                      ? 'Compares each surgeon against their own historical averages'
                                      : 'Compares against all cases at this facility'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Metric Details (informational) */}
                            <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-400">
                              <span>Metric: <span className="font-mono text-slate-500">{rule.metric}</span></span>
                              {rule.start_milestone && rule.end_milestone && (
                                <span>
                                  Milestones: <span className="font-mono text-slate-500">{rule.start_milestone}</span>
                                  {' → '}
                                  <span className="font-mono text-slate-500">{rule.end_milestone}</span>
                                </span>
                              )}
                              {rule.is_built_in && (
                                <span className="text-slate-400">Built-in rule · cannot be deleted</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>


            {/* ============================================= */}
            {/* SECTION 2: DELAY TYPES                         */}
            {/* ============================================= */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Delay Types</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Categories available when staff report delays on a case. 
                    These appear in the delay picker on the case detail page.
                  </p>
                </div>
                <button
                  onClick={() => { setShowNewDelay(true); setNewDelayName('') }}
                  className="px-3.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  + Add Type
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="w-8">#</div>
                  <div className="flex-1">Name</div>
                  <div className="w-24 text-center">Scope</div>
                  <div className="w-20 text-right">Actions</div>
                </div>

                {/* Add New Row */}
                {showNewDelay && (
                  <div className="flex items-center gap-4 px-5 py-3 bg-blue-50/50 border-b border-blue-100">
                    <div className="w-8 text-xs text-slate-400">—</div>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={newDelayName}
                        onChange={(e) => setNewDelayName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDelayType()}
                        placeholder="Delay type name..."
                        autoFocus
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-24" />
                    <div className="w-20 flex items-center justify-end gap-1">
                      <button
                        onClick={addDelayType}
                        disabled={!newDelayName.trim() || saving === 'new-delay'}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Save"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowNewDelay(false)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Delay Type Rows */}
                {delayTypes.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">
                    No delay types configured.
                  </div>
                ) : (
                  delayTypes.map((delay, index) => {
                    const isEditing = editingDelay === delay.id
                    const isSaving = saving === delay.id
                    const isGlobal = delay.facility_id === null

                    return (
                      <div key={delay.id} className="flex items-center gap-4 px-5 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                        {/* Order */}
                        <div className="w-8 text-xs text-slate-400 font-mono">
                          {index + 1}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editDelayName}
                                onChange={(e) => setEditDelayName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') renameDelayType(delay)
                                  if (e.key === 'Escape') { setEditingDelay(null); setEditDelayName('') }
                                }}
                                autoFocus
                                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => renameDelayType(delay)}
                                disabled={!editDelayName.trim() || isSaving}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { setEditingDelay(null); setEditDelayName('') }}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-900">
                              {delay.display_name || delay.name}
                            </span>
                          )}
                        </div>

                        {/* Scope Badge */}
                        <div className="w-24 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            isGlobal
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            {isGlobal ? 'Global' : 'Custom'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="w-20 flex items-center justify-end gap-1">
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingDelay(delay.id)
                                  setEditDelayName(delay.display_name || delay.name)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Rename"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deactivateDelayType(delay)}
                                disabled={isSaving}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Deactivate"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

          </div>

          {/* Toast */}
          {toast && (
            <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {toast.message}
            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}