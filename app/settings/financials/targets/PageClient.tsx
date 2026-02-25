// app/settings/financials/targets/page.tsx
// Monthly profit targets — per-month CRUD for financial_targets table

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { ChevronLeft, ChevronRight, Check, Pencil, Target, X } from 'lucide-react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface TargetRow {
  month: number
  monthName: string
  profitTarget: number | null
  id: string | null
}

export default function FinancialTargetsPage() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState(currentYear)
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline editing state
  const [editingMonth, setEditingMonth] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTargets = useCallback(async () => {
    if (!effectiveFacilityId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('financial_targets')
        .select('id, month, profit_target')
        .eq('facility_id', effectiveFacilityId)
        .eq('year', year)
        .order('month', { ascending: true })

      if (fetchError) throw fetchError

      // Build 12-row grid — one per month, merging DB results
      const dbMap = new Map<number, { id: string; profitTarget: number }>()
      for (const row of data || []) {
        dbMap.set(row.month, { id: row.id, profitTarget: row.profit_target })
      }

      const rows: TargetRow[] = MONTH_NAMES.map((name, idx) => {
        const month = idx + 1
        const dbRow = dbMap.get(month)
        return {
          month,
          monthName: name,
          profitTarget: dbRow?.profitTarget ?? null,
          id: dbRow?.id ?? null,
        }
      })

      setTargets(rows)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load targets'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [effectiveFacilityId, year, supabase])

  useEffect(() => {
    if (effectiveFacilityId) fetchTargets()
  }, [effectiveFacilityId, fetchTargets])

  const startEditing = (row: TargetRow) => {
    setEditingMonth(row.month)
    setEditValue(row.profitTarget !== null ? row.profitTarget.toString() : '')
  }

  const cancelEditing = () => {
    setEditingMonth(null)
    setEditValue('')
  }

  const saveTarget = async (row: TargetRow) => {
    if (!effectiveFacilityId) return

    const parsedValue = editValue.trim() === '' ? null : parseFloat(editValue)
    if (parsedValue !== null && isNaN(parsedValue)) {
      showToast({ type: 'error', title: 'Invalid amount', message: 'Enter a valid number' })
      return
    }

    setSaving(true)
    try {
      if (parsedValue === null && row.id) {
        // Delete existing target (clearing the value)
        const { error: delErr } = await supabase
          .from('financial_targets')
          .delete()
          .eq('id', row.id)
        if (delErr) throw delErr
      } else if (parsedValue !== null && row.id) {
        // Update existing target
        const { error: updErr } = await supabase
          .from('financial_targets')
          .update({ profit_target: parsedValue })
          .eq('id', row.id)
        if (updErr) throw updErr
      } else if (parsedValue !== null) {
        // Insert new target
        const { error: insErr } = await supabase
          .from('financial_targets')
          .insert({
            facility_id: effectiveFacilityId,
            year,
            month: row.month,
            profit_target: parsedValue,
          })
        if (insErr) throw insErr
      }

      showToast({
        type: 'success',
        title: 'Target saved',
        message: `${row.monthName} ${year} target updated`,
      })

      setEditingMonth(null)
      setEditValue('')
      fetchTargets()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Failed to save target',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, row: TargetRow) => {
    if (e.key === 'Enter') saveTarget(row)
    if (e.key === 'Escape') cancelEditing()
  }

  // Compute totals
  const totalTarget = targets.reduce((sum, t) => sum + (t.profitTarget ?? 0), 0)
  const monthsConfigured = targets.filter(t => t.profitTarget !== null).length

  if (userLoading) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Monthly Profit Targets</h1>
        <PageLoader message="Loading..." />
      </>
    )
  }

  if (!effectiveFacilityId) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Monthly Profit Targets</h1>
        <div className="text-center py-12">
          <p className="text-slate-500">No facility selected</p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Monthly Profit Targets</h1>
      <p className="text-slate-500 mb-6">
        Set monthly profit targets shown on the financial analytics overview
      </p>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <PageLoader message="Loading targets..." />
      ) : (
        <div className="space-y-6">
          {/* Year selector + summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setYear(y => y - 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Previous year"
              >
                <ChevronLeft className="w-5 h-5 text-slate-500" />
              </button>
              <span className="text-lg font-bold text-slate-900 tabular-nums w-16 text-center">
                {year}
              </span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Next year"
              >
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-slate-400">Annual Total:</span>{' '}
                <span className="font-bold text-slate-900 tabular-nums">
                  ${totalTarget.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Months set:</span>{' '}
                <span className="font-semibold text-slate-700">
                  {monthsConfigured}/12
                </span>
              </div>
            </div>
          </div>

          {/* Targets table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Profit Target
                  </th>
                  <th className="px-5 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {targets.map(row => {
                  const isEditing = editingMonth === row.month
                  const isCurrent = year === currentYear && row.month === currentMonth

                  return (
                    <tr
                      key={row.month}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/30'
                          : isEditing
                            ? 'bg-amber-50/30'
                            : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-medium text-slate-800">
                            {row.monthName}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-slate-400">$</span>
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => handleKeyDown(e, row)}
                              className="w-36 px-3 py-1.5 text-right text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums"
                              placeholder="0"
                              step="100"
                              min="0"
                              autoFocus
                              disabled={saving}
                            />
                          </div>
                        ) : (
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              row.profitTarget !== null
                                ? 'text-slate-900'
                                : 'text-slate-300'
                            }`}
                          >
                            {row.profitTarget !== null
                              ? `$${row.profitTarget.toLocaleString()}`
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveTarget(row)}
                              disabled={saving}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit target"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Help text */}
          <div className="flex items-start gap-2.5 text-xs text-slate-400">
            <Target className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Targets are displayed on the Financial Analytics overview page as a reference line
              on the profit trend chart and as a monthly progress bar. Only the current month&apos;s
              target is shown on the analytics dashboard.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
