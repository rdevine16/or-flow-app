// app/settings/flags/page.tsx
// Flag Rules Settings — Phase 2 table layout rebuild
// CSS Grid table with inline editing, category filter, debounced number saves.

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { CategoryFilter } from '@/components/settings/flags/CategoryFilter'
import { FlagRuleTable } from '@/components/settings/flags/FlagRuleTable'
import { FlagRuleRow } from '@/components/settings/flags/FlagRuleRow'
import type { FlagRule, Severity, ThresholdType, Operator, ComparisonScope } from '@/types/flag-settings'

// =====================================================
// CONSTANTS
// =====================================================

const DEBOUNCE_MS = 500

/** Canonical order for category filter tabs */
const CATEGORY_ORDER = ['timing', 'efficiency', 'anesthesia', 'recovery', 'financial', 'quality']

/** Human-readable labels for rule categories */
const CATEGORY_LABELS: Record<string, string> = {
  timing: 'Timing',
  efficiency: 'Efficiency',
  anesthesia: 'Anesthesia',
  recovery: 'Recovery',
  financial: 'Financial',
  quality: 'Quality',
}

// =====================================================
// COMPONENT
// =====================================================

export default function FlagsSettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  // Category filter state
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Data: active rules (is_active = true)
  const { data: rules, loading, error, setData: setRules } = useSupabaseQuery<FlagRule[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('flag_rules')
        .select('*')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Saving state tracker per rule ID
  const [savingRules, setSavingRules] = useState<Set<string>>(new Set())

  // Debounce infrastructure
  const pendingChanges = useRef<Map<string, Record<string, unknown>>>(new Map())
  const preEditValues = useRef<Map<string, Record<string, unknown>>>(new Map())
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  // =====================================================
  // SAVE HELPERS
  // =====================================================

  const markSaving = useCallback((ruleId: string, saving: boolean) => {
    setSavingRules((prev) => {
      const next = new Set(prev)
      if (saving) next.add(ruleId)
      else next.delete(ruleId)
      return next
    })
  }, [])

  /** Save rule fields immediately. Flushes any pending debounced changes for same rule. */
  const saveImmediate = useCallback(
    async (
      ruleId: string,
      fields: Record<string, unknown>,
      rollback: () => void,
      successMsg?: string
    ) => {
      // Flush pending debounced changes
      const pending = pendingChanges.current.get(ruleId)
      const pendingRollback = preEditValues.current.get(ruleId)
      if (pending) {
        fields = { ...pending, ...fields }
        pendingChanges.current.delete(ruleId)
        preEditValues.current.delete(ruleId)
      }
      const timer = debounceTimers.current.get(ruleId)
      if (timer) {
        clearTimeout(timer)
        debounceTimers.current.delete(ruleId)
      }

      markSaving(ruleId, true)
      try {
        const { error } = await supabase.from('flag_rules').update(fields).eq('id', ruleId)
        if (error) throw error
        if (successMsg) showToast({ type: 'success', title: successMsg })
      } catch {
        rollback()
        if (pendingRollback) {
          setRules((prev) =>
            (prev || []).map((r) =>
              r.id === ruleId ? { ...r, ...(pendingRollback as Partial<FlagRule>) } : r
            )
          )
        }
        showToast({ type: 'error', title: 'Failed to save changes' })
      } finally {
        markSaving(ruleId, false)
      }
    },
    [supabase, showToast, markSaving, setRules]
  )

  /** Debounced save for number inputs. Batches multiple field changes per rule. */
  const saveDebouncedField = useCallback(
    (ruleId: string, field: string, value: unknown, originalValue: unknown) => {
      // Accumulate pending changes
      const existing = pendingChanges.current.get(ruleId) || {}
      pendingChanges.current.set(ruleId, { ...existing, [field]: value })

      // Track original (pre-edit) value only on first change
      const originals = preEditValues.current.get(ruleId) || {}
      if (!(field in originals)) {
        preEditValues.current.set(ruleId, { ...originals, [field]: originalValue })
      }

      // Reset debounce timer
      const timer = debounceTimers.current.get(ruleId)
      if (timer) clearTimeout(timer)

      debounceTimers.current.set(
        ruleId,
        setTimeout(async () => {
          const changes = pendingChanges.current.get(ruleId) || {}
          const rollbackValues = preEditValues.current.get(ruleId) || {}
          pendingChanges.current.delete(ruleId)
          preEditValues.current.delete(ruleId)
          debounceTimers.current.delete(ruleId)

          markSaving(ruleId, true)
          try {
            const { error } = await supabase
              .from('flag_rules')
              .update(changes)
              .eq('id', ruleId)
            if (error) throw error
          } catch {
            setRules((prev) =>
              (prev || []).map((r) =>
                r.id === ruleId ? { ...r, ...(rollbackValues as Partial<FlagRule>) } : r
              )
            )
            showToast({ type: 'error', title: 'Failed to save threshold' })
          } finally {
            markSaving(ruleId, false)
          }
        }, DEBOUNCE_MS)
      )
    },
    [supabase, showToast, markSaving, setRules]
  )

  // =====================================================
  // RULE CHANGE HANDLERS
  // =====================================================

  const handleToggle = useCallback(
    (rule: FlagRule) => {
      const newEnabled = !rule.is_enabled
      setRules((prev) =>
        (prev || []).map((r) => (r.id === rule.id ? { ...r, is_enabled: newEnabled } : r))
      )
      saveImmediate(
        rule.id,
        { is_enabled: newEnabled },
        () =>
          setRules((prev) =>
            (prev || []).map((r) =>
              r.id === rule.id ? { ...r, is_enabled: !newEnabled } : r
            )
          ),
        `${rule.name} ${newEnabled ? 'enabled' : 'disabled'}`
      )
    },
    [setRules, saveImmediate]
  )

  const handleSeverityChange = useCallback(
    (rule: FlagRule, severity: Severity) => {
      const prev = rule.severity
      setRules((r) =>
        (r || []).map((x) => (x.id === rule.id ? { ...x, severity } : x))
      )
      saveImmediate(
        rule.id,
        { severity },
        () =>
          setRules((r) =>
            (r || []).map((x) => (x.id === rule.id ? { ...x, severity: prev } : x))
          ),
        `Severity updated to ${severity}`
      )
    },
    [setRules, saveImmediate]
  )

  const handleScopeChange = useCallback(
    (rule: FlagRule, scope: ComparisonScope) => {
      const prev = rule.comparison_scope
      setRules((r) =>
        (r || []).map((x) => (x.id === rule.id ? { ...x, comparison_scope: scope } : x))
      )
      saveImmediate(
        rule.id,
        { comparison_scope: scope },
        () =>
          setRules((r) =>
            (r || []).map((x) =>
              x.id === rule.id ? { ...x, comparison_scope: prev } : x
            )
          )
      )
    },
    [setRules, saveImmediate]
  )

  const handleOperatorChange = useCallback(
    (rule: FlagRule, operator: Operator) => {
      const prev = rule.operator
      setRules((r) =>
        (r || []).map((x) => (x.id === rule.id ? { ...x, operator } : x))
      )
      saveImmediate(
        rule.id,
        { operator },
        () =>
          setRules((r) =>
            (r || []).map((x) => (x.id === rule.id ? { ...x, operator: prev } : x))
          )
      )
    },
    [setRules, saveImmediate]
  )

  const handleThresholdTypeChange = useCallback(
    (rule: FlagRule, type: ThresholdType, defaultValue: number) => {
      const prev = {
        threshold_type: rule.threshold_type,
        threshold_value: rule.threshold_value,
      }
      setRules((r) =>
        (r || []).map((x) =>
          x.id === rule.id
            ? { ...x, threshold_type: type, threshold_value: defaultValue }
            : x
        )
      )
      saveImmediate(
        rule.id,
        { threshold_type: type, threshold_value: defaultValue },
        () =>
          setRules((r) =>
            (r || []).map((x) => (x.id === rule.id ? { ...x, ...prev } : x))
          )
      )
    },
    [setRules, saveImmediate]
  )

  const handleValueChange = useCallback(
    (rule: FlagRule, value: number) => {
      const originalValue = rule.threshold_value
      setRules((prev) =>
        (prev || []).map((r) =>
          r.id === rule.id ? { ...r, threshold_value: value } : r
        )
      )
      saveDebouncedField(rule.id, 'threshold_value', value, originalValue)
    },
    [setRules, saveDebouncedField]
  )

  const handleValueMaxChange = useCallback(
    (rule: FlagRule, value: number | null) => {
      const originalValue = rule.threshold_value_max
      setRules((prev) =>
        (prev || []).map((r) =>
          r.id === rule.id ? { ...r, threshold_value_max: value } : r
        )
      )
      saveDebouncedField(rule.id, 'threshold_value_max', value, originalValue)
    },
    [setRules, saveDebouncedField]
  )

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const activeRules = rules || []
  const enabledCount = activeRules.filter((r) => r.is_enabled).length
  const totalCount = activeRules.length

  // Derive unique categories from rules, in canonical order
  const presentCategories = new Set(activeRules.map((r) => r.category))
  const categoryTabs = CATEGORY_ORDER.filter((c) => presentCategories.has(c)).map((c) => ({
    key: c,
    label: CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1),
  }))

  // Filter by selected category
  const filteredRules =
    filterCategory === 'all'
      ? activeRules
      : filterCategory === 'archived'
        ? []
        : activeRules.filter((r) => r.category === filterCategory)

  // Separate built-in and custom rules
  const builtInRules = filteredRules.filter((r) => r.is_built_in)
  const customRules = filteredRules.filter((r) => !r.is_built_in)

  // =====================================================
  // LOADING / EMPTY STATES
  // =====================================================

  if (userLoading || loading) {
    return (
      <>
        <ErrorBanner message={error} />
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Flag Rules</h1>
        <p className="text-slate-500 mb-6">
          Configure auto-detection rules for your facility.
        </p>
        <PageLoader message="Loading flag rules..." />
      </>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Flag Rules</h1>
        <p className="text-slate-500 mb-6">
          Configure auto-detection rules for your facility.
        </p>
        <div className="text-center py-12 text-slate-500">
          No facility found. Please contact support.
        </div>
      </>
    )
  }

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Flag Rules</h1>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            Configure which flags are automatically created when cases are completed. Built-in
            rules provide standard OR metrics. Add custom rules from any metric in your database.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-6">
          {/* Active counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="font-semibold text-slate-900">{enabledCount}</span>
            <span>/</span>
            <span>{totalCount}</span>
            <span>active</span>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-5">
        <CategoryFilter
          value={filterCategory}
          onChange={setFilterCategory}
          categories={categoryTabs}
        />
      </div>

      <div className="space-y-6">
        {/* Archived placeholder */}
        {filterCategory === 'archived' && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <p className="text-sm text-slate-500 mb-1">No archived rules</p>
            <p className="text-xs text-slate-400">
              Archived rules will appear here when you archive custom rules.
            </p>
          </div>
        )}

        {/* Built-in Rules */}
        {filterCategory !== 'archived' && builtInRules.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Built-in Rules
              </span>
              <span className="text-[11px] text-slate-400">
                {builtInRules.filter((r) => r.is_enabled).length} of {builtInRules.length} active
              </span>
            </div>
            <div className="overflow-x-auto">
              <FlagRuleTable>
                {builtInRules.map((rule) => (
                  <FlagRuleRow
                    key={rule.id}
                    rule={rule}
                    onToggle={() => handleToggle(rule)}
                    onSeverityChange={(sev) => handleSeverityChange(rule, sev)}
                    onThresholdTypeChange={(type, val) =>
                      handleThresholdTypeChange(rule, type, val)
                    }
                    onOperatorChange={(op) => handleOperatorChange(rule, op)}
                    onValueChange={(val) => handleValueChange(rule, val)}
                    onValueMaxChange={(val) => handleValueMaxChange(rule, val)}
                    onScopeChange={(scope) => handleScopeChange(rule, scope)}
                    isSaving={savingRules.has(rule.id)}
                  />
                ))}
              </FlagRuleTable>
            </div>
          </div>
        )}

        {/* Custom Rules */}
        {filterCategory !== 'archived' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Custom Rules
                </span>
                <span className="text-[11px] text-slate-400">
                  {customRules.length} rule{customRules.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {customRules.length > 0 ? (
              <div className="overflow-x-auto">
                <FlagRuleTable>
                  {customRules.map((rule) => (
                    <FlagRuleRow
                      key={rule.id}
                      rule={rule}
                      onToggle={() => handleToggle(rule)}
                      onSeverityChange={(sev) => handleSeverityChange(rule, sev)}
                      onThresholdTypeChange={(type, val) =>
                        handleThresholdTypeChange(rule, type, val)
                      }
                      onOperatorChange={(op) => handleOperatorChange(rule, op)}
                      onValueChange={(val) => handleValueChange(rule, val)}
                      onValueMaxChange={(val) => handleValueMaxChange(rule, val)}
                      onScopeChange={(scope) => handleScopeChange(rule, scope)}
                      isSaving={savingRules.has(rule.id)}
                    />
                  ))}
                </FlagRuleTable>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500 mb-1">No custom rules yet</p>
                <p className="text-xs text-slate-400">
                  Add rules from any metric in your database using the rule builder.
                </p>
              </div>
            )}
          </div>
        )}

        {/* No results for selected category */}
        {filterCategory !== 'archived' &&
          builtInRules.length === 0 &&
          customRules.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-400">
              No rules match the selected category.
            </div>
          )}
      </div>
    </>
  )
}
