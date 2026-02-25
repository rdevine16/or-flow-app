// app/settings/flags/page.tsx
// Flag Rules Settings — Phase 4: Full CRUD with audit logging and archive.
// CSS Grid table with inline editing, category filter, custom rule builder,
// archive/restore for custom rules, and audit logging.

'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { CategoryFilter } from '@/components/settings/flags/CategoryFilter'
import { FlagRuleTable } from '@/components/settings/flags/FlagRuleTable'
import { FlagRuleRow } from '@/components/settings/flags/FlagRuleRow'
import { MetricSearchBuilder } from '@/components/settings/flags/MetricSearchBuilder'
import { Plus, Info } from 'lucide-react'
import { flagRuleAudit } from '@/lib/audit-logger'
import { THRESHOLD_TYPES } from '@/lib/constants/metrics-catalog'
import * as flagRulesDal from '@/lib/dal/flag-rules'
import type { FlagRule, Severity, ThresholdType, Operator, ComparisonScope, MetricCatalogEntry, CustomRuleFormState } from '@/types/flag-settings'

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

  // Builder drawer state
  const [builderOpen, setBuilderOpen] = useState(false)

  // Fetch cost categories for dynamic per-category metrics in the builder
  const { data: costCategories } = useSupabaseQuery<Array<{ id: string; name: string }>>(
    async (sb) => {
      const { data, error } = await sb
        .from('cost_categories')
        .select('id, name')
        .eq('facility_id', effectiveFacilityId!)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Generate dynamic per-cost-category metrics from facility's active cost categories
  const dynamicMetrics: MetricCatalogEntry[] = useMemo(() => {
    if (!costCategories) return []
    return costCategories.map((cat) => ({
      id: `cost_category_${cat.id}`,
      name: `${cat.name} Cost`,
      description: `Total cost for ${cat.name} category`,
      category: 'financial' as const,
      dataType: 'currency' as const,
      unit: '$',
      source: 'case_completion_stats' as const,
      startMilestone: null,
      endMilestone: null,
      supportsMedian: true,
      costCategoryId: cat.id,
    }))
  }, [costCategories])

  // Data: active rules (is_active = true)
  const { data: rules, loading, error, setData: setRules } = useSupabaseQuery<FlagRule[]>(
    async (sb) => {
      const result = await flagRulesDal.listActiveByFacility(sb, effectiveFacilityId!)
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  // Data: archived rules (is_active = false)
  const {
    data: archivedRules,
    setData: setArchivedRules,
  } = useSupabaseQuery<FlagRule[]>(
    async (sb) => {
      const result = await flagRulesDal.listArchivedByFacility(sb, effectiveFacilityId!)
      if (result.error) throw new Error(result.error.message)
      return result.data
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

  /** Save rule fields immediately via DAL. Flushes any pending debounced changes for same rule. */
  const saveImmediate = useCallback(
    async (
      rule: FlagRule,
      fields: Record<string, unknown>,
      rollback: () => void,
      successMsg?: string
    ) => {
      // Flush pending debounced changes
      const pending = pendingChanges.current.get(rule.id)
      const pendingRollback = preEditValues.current.get(rule.id)
      if (pending) {
        fields = { ...pending, ...fields }
        pendingChanges.current.delete(rule.id)
        preEditValues.current.delete(rule.id)
      }
      const timer = debounceTimers.current.get(rule.id)
      if (timer) {
        clearTimeout(timer)
        debounceTimers.current.delete(rule.id)
      }

      markSaving(rule.id, true)
      try {
        const result = await flagRulesDal.updateRule(supabase, rule.id, fields as Partial<FlagRule>)
        if (!result.success) throw new Error(result.error?.message ?? 'Update failed')

        // Audit log the update (fire-and-forget)
        const oldValues: Record<string, unknown> = {}
        for (const key of Object.keys(fields)) {
          oldValues[key] = (rule as unknown as Record<string, unknown>)[key]
        }
        flagRuleAudit.updated(
          supabase,
          rule.id,
          rule.name,
          rule.facility_id,
          oldValues,
          fields
        )

        if (successMsg) showToast({ type: 'success', title: successMsg })
      } catch {
        rollback()
        if (pendingRollback) {
          setRules((prev) =>
            (prev || []).map((r) =>
              r.id === rule.id ? { ...r, ...(pendingRollback as Partial<FlagRule>) } : r
            )
          )
        }
        showToast({ type: 'error', title: 'Failed to save changes' })
      } finally {
        markSaving(rule.id, false)
      }
    },
    [supabase, showToast, markSaving, setRules]
  )

  /** Debounced save for number inputs. Batches multiple field changes per rule. */
  const saveDebouncedField = useCallback(
    (rule: FlagRule, field: string, value: unknown, originalValue: unknown) => {
      // Accumulate pending changes
      const existing = pendingChanges.current.get(rule.id) || {}
      pendingChanges.current.set(rule.id, { ...existing, [field]: value })

      // Track original (pre-edit) value only on first change
      const originals = preEditValues.current.get(rule.id) || {}
      if (!(field in originals)) {
        preEditValues.current.set(rule.id, { ...originals, [field]: originalValue })
      }

      // Reset debounce timer
      const timer = debounceTimers.current.get(rule.id)
      if (timer) clearTimeout(timer)

      debounceTimers.current.set(
        rule.id,
        setTimeout(async () => {
          const changes = pendingChanges.current.get(rule.id) || {}
          const rollbackValues = preEditValues.current.get(rule.id) || {}
          pendingChanges.current.delete(rule.id)
          preEditValues.current.delete(rule.id)
          debounceTimers.current.delete(rule.id)

          markSaving(rule.id, true)
          try {
            const result = await flagRulesDal.updateRule(supabase, rule.id, changes as Partial<FlagRule>)
            if (!result.success) throw new Error(result.error?.message ?? 'Update failed')

            // Audit log
            flagRuleAudit.updated(
              supabase,
              rule.id,
              rule.name,
              rule.facility_id,
              rollbackValues,
              changes
            )
          } catch {
            setRules((prev) =>
              (prev || []).map((r) =>
                r.id === rule.id ? { ...r, ...(rollbackValues as Partial<FlagRule>) } : r
              )
            )
            showToast({ type: 'error', title: 'Failed to save threshold' })
          } finally {
            markSaving(rule.id, false)
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
        rule,
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
        rule,
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
        rule,
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
        rule,
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
        rule,
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
      saveDebouncedField(rule, 'threshold_value', value, originalValue)
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
      saveDebouncedField(rule, 'threshold_value_max', value, originalValue)
    },
    [setRules, saveDebouncedField]
  )

  // =====================================================
  // BUILDER SUBMIT — Create custom rule via DAL
  // =====================================================

  const handleBuilderSubmit = useCallback(
    async (form: CustomRuleFormState) => {
      if (!effectiveFacilityId) return

      const result = await flagRulesDal.createCustomRule(supabase, effectiveFacilityId, form)

      if (result.error) {
        showToast({ type: 'error', title: 'Failed to create rule' })
        return
      }

      const newRule = result.data
      // Add to local state optimistically
      setRules((prev) => [...(prev || []), newRule])

      // Audit log (fire-and-forget)
      flagRuleAudit.created(supabase, newRule.id, newRule.name, effectiveFacilityId, {
        metric: newRule.metric,
        category: newRule.category,
        threshold_type: newRule.threshold_type,
        threshold_value: newRule.threshold_value,
        operator: newRule.operator,
        severity: newRule.severity,
        comparison_scope: newRule.comparison_scope,
        cost_category_id: newRule.cost_category_id,
      })

      showToast({ type: 'success', title: `Rule "${newRule.name}" created` })
    },
    [supabase, effectiveFacilityId, showToast, setRules]
  )

  // =====================================================
  // ARCHIVE / RESTORE HANDLERS
  // =====================================================

  const handleArchive = useCallback(
    async (rule: FlagRule) => {
      if (!effectiveFacilityId) return

      // Optimistic: remove from active, add to archived
      setRules((prev) => (prev || []).filter((r) => r.id !== rule.id))
      const archivedRule = { ...rule, is_active: false }
      setArchivedRules((prev) => [archivedRule, ...(prev || [])])

      markSaving(rule.id, true)
      try {
        const result = await flagRulesDal.archiveRule(supabase, rule.id)
        if (!result.success) throw new Error(result.error?.message ?? 'Archive failed')

        flagRuleAudit.archived(supabase, rule.id, rule.name, effectiveFacilityId)
        showToast({ type: 'success', title: `"${rule.name}" archived` })
      } catch {
        // Rollback: add back to active, remove from archived
        setRules((prev) => [...(prev || []), rule])
        setArchivedRules((prev) => (prev || []).filter((r) => r.id !== rule.id))
        showToast({ type: 'error', title: 'Failed to archive rule' })
      } finally {
        markSaving(rule.id, false)
      }
    },
    [supabase, effectiveFacilityId, showToast, setRules, setArchivedRules, markSaving]
  )

  const handleRestore = useCallback(
    async (rule: FlagRule) => {
      if (!effectiveFacilityId) return

      // Optimistic: remove from archived, add to active
      setArchivedRules((prev) => (prev || []).filter((r) => r.id !== rule.id))
      const restoredRule = { ...rule, is_active: true }
      setRules((prev) => [...(prev || []), restoredRule])

      markSaving(rule.id, true)
      try {
        const result = await flagRulesDal.restoreRule(supabase, rule.id)
        if (!result.success) throw new Error(result.error?.message ?? 'Restore failed')

        flagRuleAudit.restored(supabase, rule.id, rule.name, effectiveFacilityId)
        showToast({ type: 'success', title: `"${rule.name}" restored` })
      } catch {
        // Rollback: add back to archived, remove from active
        setArchivedRules((prev) => [rule, ...(prev || [])])
        setRules((prev) => (prev || []).filter((r) => r.id !== rule.id))
        showToast({ type: 'error', title: 'Failed to restore rule' })
      } finally {
        markSaving(rule.id, false)
      }
    },
    [supabase, effectiveFacilityId, showToast, setRules, setArchivedRules, markSaving]
  )

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const activeRules = rules || []
  const enabledCount = activeRules.filter((r) => r.is_enabled).length
  const totalCount = activeRules.length
  const archivedList = archivedRules || []

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

  // Noop handlers for archived rows (editing disabled)
  const noop = () => {}
  const noopSev = () => {}
  const noopTT = () => {}
  const noopOp = () => {}
  const noopVal = () => {}
  const noopValMax = () => {}
  const noopScope = () => {}

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Flag Rules</h1>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            Configure which flags are automatically created when cases are completed. Built-in
            rules provide standard OR metrics. Add custom rules from any metric in your database.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Active counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="font-semibold text-slate-900">{enabledCount}</span>
            <span>/</span>
            <span>{totalCount}</span>
            <span>active</span>
          </div>
          {/* Add Rule button */}
          <button
            onClick={() => setBuilderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
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
        {/* Archived rules */}
        {filterCategory === 'archived' && (
          <>
            {archivedList.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Archived Rules
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {archivedList.length} rule{archivedList.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <FlagRuleTable>
                    {archivedList.map((rule) => (
                      <FlagRuleRow
                        key={rule.id}
                        rule={rule}
                        onToggle={noop}
                        onSeverityChange={noopSev}
                        onThresholdTypeChange={noopTT}
                        onOperatorChange={noopOp}
                        onValueChange={noopVal}
                        onValueMaxChange={noopValMax}
                        onScopeChange={noopScope}
                        isSaving={savingRules.has(rule.id)}
                        showRestore
                        onRestore={() => handleRestore(rule)}
                      />
                    ))}
                  </FlagRuleTable>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500 mb-1">No archived rules</p>
                <p className="text-xs text-slate-400">
                  Archived rules will appear here when you archive custom rules.
                </p>
              </div>
            )}
          </>
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
                      showArchive
                      onArchive={() => handleArchive(rule)}
                    />
                  ))}
                </FlagRuleTable>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500 mb-1">No custom rules yet</p>
                <p className="text-xs text-slate-400 mb-3">
                  Add rules from any metric in your database using the rule builder.
                </p>
                <button
                  onClick={() => setBuilderOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
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

      {/* Legend Section */}
      {filterCategory !== 'archived' && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">How Flag Rules Work</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs text-slate-500 leading-relaxed">
            <div>
              <p className="font-medium text-slate-600 mb-1.5">Threshold Types</p>
              <ul className="space-y-1">
                {THRESHOLD_TYPES.map((t) => (
                  <li key={t.id}>
                    <span className="font-medium text-slate-600">{t.label}</span>
                    {' — '}
                    {t.description}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-slate-600 mb-1.5">Severity Levels</p>
                <ul className="space-y-1">
                  <li><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />
                    <span className="font-medium text-slate-600">Critical</span> — Immediate attention required
                  </li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                    <span className="font-medium text-slate-600">Warning</span> — Notable deviation from normal
                  </li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                    <span className="font-medium text-slate-600">Info</span> — Informational, for tracking purposes
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-600 mb-1.5">Scope</p>
                <ul className="space-y-1">
                  <li><span className="font-medium text-slate-600">Facility</span> — Compares against all facility cases</li>
                  <li><span className="font-medium text-slate-600">Personal</span> — Compares against the surgeon&apos;s own history</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Rule Builder Drawer */}
      <MetricSearchBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onSubmit={handleBuilderSubmit}
        dynamicMetrics={dynamicMetrics}
      />
    </>
  )
}
