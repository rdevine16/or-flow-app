// app/settings/flags/page.tsx
// app/settings/flags/page.tsx
// ORbit Flag System Settings — Phase 2
// Threshold Flag Rules — auto-detection rules with adjustable thresholds
// Delay types are managed on the dedicated delay types settings page.

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { ChevronDown } from 'lucide-react'
import { severityColors, categoryColors } from '@/lib/design-tokens'

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

type Severity = 'info' | 'warning' | 'critical'
type ThresholdType = 'median_plus_sd' | 'absolute'

// =====================================================
// CONSTANTS
// =====================================================

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; ring: string }> = severityColors

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  timing: { label: 'Timing', color: categoryColors.timing.text },
  efficiency: { label: 'Efficiency', color: categoryColors.efficiency.text },
  anesthesia: { label: 'Anesthesia', color: categoryColors.anesthesia.text },
  recovery: { label: 'Recovery', color: categoryColors.recovery.text },
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
  const { showToast } = useToast()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  // State
  const { data: rules, loading, error, setData: setRules } = useSupabaseQuery<FlagRule[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('flag_rules')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order', { ascending: true })
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState<string | null>(null) // rule ID being saved
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  // =====================================================
  // FLAG RULE HANDLERS
  // =====================================================

  const toggleRuleEnabled = async (rule: FlagRule) => {
    const newEnabled = !rule.is_enabled
    setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, is_enabled: newEnabled } : r))
    setSaving(rule.id)

    try {
      const { error } = await supabase
        .from('flag_rules')
        .update({ is_enabled: newEnabled })
        .eq('id', rule.id)

      if (error) throw error
      showToast({ type: 'success', title: `${rule.name} ${newEnabled ? 'enabled' : 'disabled'}` })
    } catch (err) {
      setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, is_enabled: !newEnabled } : r))
      showToast({ type: 'error', title: 'Failed to update rule' })
    } finally {
      setSaving(null)
    }
  }

  const updateRuleSeverity = async (rule: FlagRule, severity: Severity) => {
    setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, severity } : r))
    setSaving(rule.id)

    try {
      const { error } = await supabase
        .from('flag_rules')
        .update({ severity })
        .eq('id', rule.id)

      if (error) throw error
      showToast({ type: 'success', title: `Severity updated to ${severity}` })
    } catch (err) {
      setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, severity: rule.severity } : r))
      showToast({ type: 'error', title: 'Failed to update severity' })
    } finally {
      setSaving(null)
    }
  }

  const updateRuleThreshold = async (rule: FlagRule, thresholdType: ThresholdType, thresholdValue: number) => {
    setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, threshold_type: thresholdType, threshold_value: thresholdValue } : r))
    setSaving(rule.id)

    try {
      const { error } = await supabase
        .from('flag_rules')
        .update({ threshold_type: thresholdType, threshold_value: thresholdValue })
        .eq('id', rule.id)

      if (error) throw error
      showToast({ type: 'success', title: 'Threshold updated' })
    } catch (err) {
      setRules(prev => (prev || []).map(r => r.id === rule.id ? { ...r, threshold_type: rule.threshold_type, threshold_value: rule.threshold_value } : r))
      showToast({ type: 'error', title: 'Failed to update threshold' })
    } finally {
      setSaving(null)
    }
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
          <ErrorBanner message={error} />
          <SettingsLayout title="Case Flags" description="Configure auto-detection threshold rules for your facility.">
            <PageLoader message="Loading flag rules..." />
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Case Flags" description="Configure auto-detection threshold rules for your facility.">
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
        <SettingsLayout title="Case Flags" description="Configure auto-detection threshold rules for your facility.">
          <div className="space-y-8">

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
                {(rules || []).length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-slate-400">
                    No flag rules found. Rules are seeded when your facility is created.
                  </div>
                ) : (
                  (rules || []).map((rule) => {
                    const isExpanded = expandedRule === rule.id
                    const isSaving = saving === rule.id

                    return (
                      <div key={rule.id} className={`transition-colors ${!rule.is_enabled ? 'bg-slate-50/60' : ''}`}>
                        {/* Collapsed Row */}
                        <div className="flex items-center gap-4 px-4 py-3.5">
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
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>

                        {/* Expanded Editor */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
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

          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}