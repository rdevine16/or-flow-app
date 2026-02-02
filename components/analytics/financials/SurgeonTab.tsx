// components/analytics/financials/SurgeonTab.tsx
// UPDATED: Restored SurgeonDetail with efficiency metrics + clean visual design

'use client'

import { useState } from 'react'
import { FinancialsMetrics, SurgeonStats, SurgeonProcedureBreakdown } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'
import { 
  InformationCircleIcon, 
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  TrophyIcon,
  ClockIcon,
  BoltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface SurgeonTabProps {
  metrics: FinancialsMetrics
  selectedSurgeon: string | null
  onSurgeonSelect: (surgeonId: string | null) => void
}

export default function SurgeonTab({ 
  metrics, 
  selectedSurgeon, 
  onSurgeonSelect 
}: SurgeonTabProps) {
  const surgeonStats = metrics.surgeonStats

  // If no data
  if (surgeonStats.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-12 text-center">
        <div className="text-slate-400 text-lg mb-2">No surgeon data for selected period</div>
        <div className="text-slate-500 text-sm">Try selecting a longer date range</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Surgeon Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Surgeon:</label>
        <select
          value={selectedSurgeon || ''}
          onChange={(e) => onSurgeonSelect(e.target.value || null)}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Surgeons Overview</option>
          {surgeonStats.map(surgeon => (
            <option key={surgeon.surgeonId} value={surgeon.surgeonId}>
              {surgeon.surgeonName} ({surgeon.caseCount} cases)
            </option>
          ))}
        </select>
      </div>

      {selectedSurgeon ? (
        <SurgeonDetail 
          metrics={metrics} 
          surgeonId={selectedSurgeon}
          onBack={() => onSurgeonSelect(null)}
        />
      ) : (
        <AllSurgeonsOverview 
          metrics={metrics} 
          onSurgeonSelect={onSurgeonSelect} 
        />
      )}
    </div>
  )
}

// ============================================
// ALL SURGEONS OVERVIEW - Profit Focus
// ============================================

function AllSurgeonsOverview({ 
  metrics, 
  onSurgeonSelect 
}: { 
  metrics: FinancialsMetrics
  onSurgeonSelect: (surgeonId: string) => void 
}) {
  const [expandedSurgeon, setExpandedSurgeon] = useState<string | null>(null)
  const surgeonStats = metrics.surgeonStats

  // Calculate totals from surgeon stats
  const totalCases = surgeonStats.reduce((sum, s) => sum + s.caseCount, 0)
  const totalProfit = surgeonStats.reduce((sum, s) => sum + s.totalProfit, 0)

  return (
    <>
      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Surgeons" 
          value={surgeonStats.length}
          subtitle="Active in period"
        />
        <MetricCard 
          title="Total Cases" 
          value={totalCases.toLocaleString()}
          subtitle="Completed"
        />
        <MetricCard 
          title="Total Profit" 
          value={formatCurrency(totalProfit)}
          variant="success"
        />
        <MetricCard 
          title="Avg per Case" 
          value={totalCases > 0 ? formatCurrency(totalProfit / totalCases) : '$0'}
        />
      </div>

      {/* Profit Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-slate-900">Surgeon Profit Rankings</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Click a row to see procedure breakdown, or select from dropdown for full detail
          </p>
        </div>
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Surgeon</div>
          <div className="col-span-2 text-center">Cases</div>
          <div className="col-span-2 text-right">Total Profit</div>
          <div className="col-span-2 text-right">Avg / Case</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {surgeonStats.map((surgeon, idx) => (
            <SurgeonRow
              key={surgeon.surgeonId}
              surgeon={surgeon}
              rank={idx + 1}
              isExpanded={expandedSurgeon === surgeon.surgeonId}
              onToggle={() => setExpandedSurgeon(
                expandedSurgeon === surgeon.surgeonId ? null : surgeon.surgeonId
              )}
              onViewDetail={() => onSurgeonSelect(surgeon.surgeonId)}
            />
          ))}
        </div>
        
        {surgeonStats.some(s => s.caseCount < 10) && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            * Surgeons with fewer than 10 cases may have less reliable statistics
          </div>
        )}
      </div>
    </>
  )
}

// ============================================
// SURGEON ROW (Expandable)
// ============================================

function SurgeonRow({
  surgeon,
  rank,
  isExpanded,
  onToggle,
  onViewDetail,
}: {
  surgeon: SurgeonStats
  rank: number
  isExpanded: boolean
  onToggle: () => void
  onViewDetail: () => void
}) {
  const procedures = surgeon.procedureBreakdown || []

  return (
    <div className={`${isExpanded ? 'bg-slate-50' : ''}`}>
      {/* Main Row */}
      <div 
        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* Rank */}
        <div className="col-span-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            rank === 1 ? 'bg-amber-100 text-amber-700' : 
            rank === 2 ? 'bg-slate-200 text-slate-600' : 
            rank === 3 ? 'bg-orange-100 text-orange-700' : 
            'bg-slate-100 text-slate-500'
          }`}>
            {rank}
          </div>
        </div>

        {/* Name & Procedures */}
        <div className="col-span-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
            {surgeon.caseCount < 10 && (
              <span className="text-xs text-amber-600">*</span>
            )}
            {surgeon.consistencyRating && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                surgeon.consistencyRating === 'high' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : surgeon.consistencyRating === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {surgeon.consistencyRating === 'high' ? '⚡ Consistent' :
                 surgeon.consistencyRating === 'medium' ? '◐ Variable' : '◯ Inconsistent'}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {procedures.length} procedure type{procedures.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Cases */}
        <div className="col-span-2 text-center text-slate-600">{surgeon.caseCount}</div>

        {/* Total Profit */}
        <div className="col-span-2 text-right font-semibold text-emerald-600">
          {formatCurrency(surgeon.totalProfit)}
        </div>

        {/* Avg per Case */}
        <div className="col-span-2 text-right text-slate-600">
          {formatCurrency(surgeon.avgProfit)}
        </div>

        {/* Chevron */}
        <div className="col-span-1 flex justify-end">
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Procedure Breakdown */}
      {isExpanded && procedures.length > 0 && (
        <div className="px-6 pb-4">
          <div className="ml-10 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-600">
                Top {Math.min(5, procedures.length)} Procedures
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View Full Detail →
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Procedure</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Cases</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total Profit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Avg / Case</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procedures.slice(0, 5).map(proc => (
                  <tr key={proc.procedureId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{proc.procedureName}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{proc.caseCount}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 font-medium">
                      {formatCurrency(proc.totalProfit)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {proc.medianProfit !== null ? formatCurrency(proc.medianProfit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {procedures.length > 5 && (
              <div className="px-4 py-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                +{procedures.length - 5} more procedure{procedures.length - 5 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// SINGLE SURGEON DETAIL - RESTORED WITH EFFICIENCY METRICS
// ============================================

function SurgeonDetail({ 
  metrics, 
  surgeonId,
  onBack
}: { 
  metrics: FinancialsMetrics
  surgeonId: string
  onBack: () => void
}) {
  const surgeon = metrics.surgeonStats.find(s => s.surgeonId === surgeonId)
  if (!surgeon) return null

  const procedures = surgeon.procedureBreakdown || []
  
  // Calculate efficiency metrics
  const isFasterThanFacility = surgeon.durationVsFacilityMinutes < 0
  const timeDiffMinutes = Math.abs(Math.round(surgeon.durationVsFacilityMinutes))

  return (
    <>
      {/* Back Link */}
      <button 
        onClick={onBack}
        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to all surgeons
      </button>

      {/* Surgeon Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold">
            {surgeon.surgeonName.split(' ').slice(-1)[0]?.charAt(0) || '?'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{surgeon.surgeonName}</h2>
            <p className="text-slate-300">
              {surgeon.caseCount} cases • {procedures.length} procedure type{procedures.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* Primary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(surgeon.totalProfit)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-slate-300">Typical / Case</p>
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  Median profit per case
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold">
              {surgeon.medianProfit !== null ? formatCurrency(surgeon.medianProfit) : formatCurrency(surgeon.avgProfit)}
            </p>
            {surgeon.profitVsFacility !== 0 && (
              <p className={`text-xs mt-1 ${surgeon.profitVsFacility >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {surgeon.profitVsFacility >= 0 ? '+' : ''}{formatCurrency(surgeon.profitVsFacility)} vs facility
              </p>
            )}
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Cases</p>
            <p className="text-2xl font-bold">{surgeon.caseCount}</p>
          </div>
          {surgeon.medianDurationMinutes !== null && (
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-sm text-slate-300">Typical Duration</p>
              <p className="text-2xl font-bold">{Math.round(surgeon.medianDurationMinutes)} min</p>
            </div>
          )}
        </div>
      </div>

      {/* Efficiency Metrics Cards - RESTORED */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Time vs Facility */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-slate-400" />
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium text-slate-500">Time vs Facility</p>
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56">
                  <strong>Weighted average</strong> across all procedures this surgeon performs. 
                  Accounts for different procedure types.
                  <br /><br />
                  Negative = faster than typical
                </div>
              </div>
            </div>
          </div>
          <p className={`text-2xl font-bold ${
            isFasterThanFacility ? 'text-emerald-600' : 
            timeDiffMinutes > 10 ? 'text-red-500' : 
            'text-slate-900'
          }`}>
            {isFasterThanFacility ? '−' : '+'}{timeDiffMinutes} min
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {isFasterThanFacility ? 'Faster' : 'Slower'} than facility average
          </p>
        </div>

        {/* Profit Impact */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="w-5 h-5 text-slate-400" />
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium text-slate-500">Profit Impact</p>
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56">
                  Estimated profit impact per case based on time difference.
                  <br /><br />
                  Calculated as: time difference × OR rate / 60
                </div>
              </div>
            </div>
          </div>
          <p className={`text-2xl font-bold ${
            surgeon.profitImpact >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {surgeon.profitImpact >= 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}/case
          </p>
          <p className="text-xs text-slate-500 mt-1">
            From {isFasterThanFacility ? 'faster' : 'slower'} case times
          </p>
        </div>

        {/* Surgical Turnover */}
        {surgeon.medianSurgicalTurnover !== null && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <BoltIcon className="w-5 h-5 text-slate-400" />
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-slate-500">Surgical Turnover</p>
                <div className="group relative">
                  <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56">
                    Median time from closing of one case to incision of the next.
                    Excludes first cases of the day.
                  </div>
                </div>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {Math.round(surgeon.medianSurgicalTurnover)} min
            </p>
            <p className="text-xs text-slate-500 mt-1">Typical between-case time</p>
          </div>
        )}

        {/* Consistency Rating */}
        {surgeon.consistencyRating && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 flex items-center justify-center">
                {surgeon.consistencyRating === 'high' ? '⚡' : 
                 surgeon.consistencyRating === 'medium' ? '◐' : '◯'}
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-slate-500">Consistency</p>
                <div className="group relative">
                  <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56">
                    Based on standard deviation of case durations.
                    <br /><br />
                    <strong>High:</strong> Predictable case times<br />
                    <strong>Medium:</strong> Some variability<br />
                    <strong>Low:</strong> High variability
                  </div>
                </div>
              </div>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-lg font-medium ${
              surgeon.consistencyRating === 'high' 
                ? 'bg-emerald-100 text-emerald-700' 
                : surgeon.consistencyRating === 'medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {surgeon.consistencyRating === 'high' ? 'High' :
               surgeon.consistencyRating === 'medium' ? 'Medium' : 'Low'}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              {surgeon.consistencyRating === 'high' ? 'Predictable case times' :
               surgeon.consistencyRating === 'medium' ? 'Some case time variability' : 'Highly variable case times'}
            </p>
          </div>
        )}
      </div>

      {/* Performance by Procedure - UPDATED with Consistency */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Performance by Procedure</h3>
          <p className="text-sm text-slate-500 mt-1">
            Efficiency comparison vs facility median for each procedure type
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  <div className="flex items-center justify-end gap-1">
                    Surgeon Time
                    <span className="text-slate-400 font-normal">(median)</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  <div className="flex items-center justify-end gap-1">
                    Facility
                    <span className="text-slate-400 font-normal">(median)</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {procedures.map(proc => {
                const hasFacilityBaseline = proc.facilityMedianDuration !== null
                const isFaster = proc.durationVsFacility < 0
                const diffMinutes = Math.abs(Math.round(proc.durationVsFacility))
                
                return (
                  <tr key={proc.procedureId} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{proc.procedureName}</span>
                      {proc.caseCount < 5 && (
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          Low sample
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600">{proc.caseCount}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      {formatCurrency(proc.totalProfit)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {proc.medianDuration !== null ? `${Math.round(proc.medianDuration)} min` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {proc.facilityMedianDuration !== null ? `${Math.round(proc.facilityMedianDuration)} min` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasFacilityBaseline ? (
                        <span className={`font-medium ${
                          isFaster ? 'text-emerald-600' : 
                          diffMinutes > 10 ? 'text-red-500' : 
                          'text-slate-600'
                        }`}>
                          {isFaster ? '−' : '+'}{diffMinutes} min
                          {proc.durationVsFacilityPct !== null && (
                            <span className="text-xs text-slate-400 ml-1">
                              ({proc.durationVsFacilityPct > 0 ? '+' : ''}{Math.round(proc.durationVsFacilityPct)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {procedures.some(p => p.caseCount < 5) && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
            ⚠️ Procedures with fewer than 5 cases may have less reliable statistics
          </div>
        )}
      </div>

      {/* Explanation Card */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Why per-procedure comparison?</strong> Comparing surgeon efficiency only makes sense within 
              the same procedure type. A hip replacement naturally takes longer than a knee scope.
            </p>
            <p>
              <strong>Time vs Facility (summary):</strong> The weighted average of time differences across all 
              procedures this surgeon performs, accounting for how often they do each procedure.
            </p>
            <p>
              <strong>Profit Impact:</strong> Estimated dollar impact per case based on time difference. 
              Faster surgeons use less OR time, which costs {formatCurrency(metrics.orRate)}/hour at this facility.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}