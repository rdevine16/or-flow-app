// app/admin/demo/steps/FacilityStep.tsx
// Step 1: Facility selection + config status panel

'use client'

import {
  Building2,
  ChevronRight,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { DemoFacility, ConfigStatusKey } from '../types'
import { CONFIG_STATUS_KEYS, CONFIG_STATUS_LABELS } from '../types'
import { countHolidaysInRange } from '@/lib/us-holidays'

// ============================================================================
// PROPS
// ============================================================================

export interface FacilityStepProps {
  facilities: DemoFacility[]
  selectedFacilityId: string | null
  onSelectFacility: (facilityId: string) => void
  loading: boolean
  loadingFacility: boolean
  /** Counts keyed by ConfigStatusKey */
  configStatus: Record<ConfigStatusKey, number> | null
  monthsOfHistory: number
  onMonthsChange: (months: number) => void
  purgeFirst: boolean
  onPurgeFirstChange: (value: boolean) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FacilityStep({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  loading,
  loadingFacility,
  configStatus,
  monthsOfHistory,
  onMonthsChange,
  purgeFirst,
  onPurgeFirstChange,
}: FacilityStepProps) {
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)

  // Compute holiday count for the data range
  const holidayCount = (() => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - monthsOfHistory)
    return countHolidaysInRange(start, end)
  })()

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading demo facilities...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Section: Select Facility ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-[17px] font-semibold text-slate-900">Select Demo Facility</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Choose which facility to generate demo data for
          </p>
        </div>
        <div className="p-4">
          {facilities.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No demo facilities found</p>
              <p className="text-xs text-slate-400 mt-1">
                Set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">is_demo = true</code>{' '}
                on facilities to enable them here.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {facilities.map((f) => {
                const isSelected = f.id === selectedFacilityId
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectFacility(f.id)}
                    data-testid={`facility-option-${f.id}`}
                    className={`w-full p-4 rounded-lg border text-left transition-all group ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-100 border border-blue-200'
                              : 'bg-slate-50 border border-slate-200 group-hover:bg-blue-50 group-hover:border-blue-200'
                          }`}
                        >
                          <Building2
                            className={`w-5 h-5 transition-colors ${
                              isSelected
                                ? 'text-blue-600'
                                : 'text-slate-400 group-hover:text-blue-600'
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{f.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {f.timezone} {f.case_number_prefix ? `\u00B7 ${f.case_number_prefix}` : ''}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Section: Generation Scope ── */}
      {selectedFacility && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-[17px] font-semibold text-slate-900">Generation Scope</h2>
            <p className="text-[13px] text-slate-500 mt-1">Configure data range and options</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Historical Data
                </label>
                <select
                  value={monthsOfHistory}
                  onChange={(e) => onMonthsChange(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 months</option>
                  <option value={6}>6 months (recommended)</option>
                  <option value={9}>9 months</option>
                  <option value={12}>12 months</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Plus 1 month of future scheduled cases \u00B7 {holidayCount} holidays skipped
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Pre-Generation
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={purgeFirst}
                    onChange={(e) => onPurgeFirstChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-slate-700 font-medium">
                      Purge existing case data first
                    </span>
                    <p className="text-xs text-slate-400">
                      Deletes cases, milestones, staff, implants. Never deletes users or config.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section: Config Status Panel ── */}
      {selectedFacility && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-[17px] font-semibold text-slate-900">Configuration Status</h2>
            <p className="text-[13px] text-slate-500 mt-1">
              {selectedFacility.name} — required items must be set up before generation
            </p>
          </div>
          <div className="p-6">
            {loadingFacility ? (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <p className="text-sm text-slate-500">Loading facility configuration...</p>
              </div>
            ) : configStatus ? (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3" data-testid="config-status-grid">
                {CONFIG_STATUS_KEYS.map((key) => {
                  const meta = CONFIG_STATUS_LABELS[key]
                  const count = configStatus[key] ?? 0
                  const isZero = count === 0
                  const isWarning = isZero && meta.required
                  const isAmber = isZero && !meta.required

                  return (
                    <div
                      key={key}
                      data-testid={`config-status-${key}`}
                      className={`p-3 rounded-lg border ${
                        isWarning
                          ? 'bg-red-50 border-red-200'
                          : isAmber
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {isWarning ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        ) : isAmber ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        )}
                        <span className="text-xs font-medium text-slate-600">{meta.label}</span>
                      </div>
                      <p
                        className={`text-lg font-bold ml-5 ${
                          isWarning
                            ? 'text-red-700'
                            : isAmber
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {key === 'cases' && count > 0 ? count.toLocaleString() : count}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
