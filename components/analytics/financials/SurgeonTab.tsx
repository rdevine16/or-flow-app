// components/analytics/financials/SurgeonTab.tsx
// REDESIGNED: Focus on profit (fair comparison), drill-down for procedure details

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

  // Calculate totals from surgeon stats (should match metrics.totalProfit)
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
            Click a row to see procedure breakdown
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
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            {procedures.length} procedure{procedures.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Cases */}
        <div className="col-span-2 text-center text-slate-600">
          {surgeon.caseCount}
        </div>

        {/* Total Profit */}
        <div className="col-span-2 text-right">
          <span className="font-semibold text-emerald-600">{formatCurrency(surgeon.totalProfit)}</span>
        </div>

        {/* Avg per Case */}
        <div className="col-span-2 text-right text-slate-600">
          {formatCurrency(surgeon.avgProfit)}
        </div>

        {/* Expand Chevron */}
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
          <div className="ml-12 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase">Procedure Breakdown</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewDetail()
                }}
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
// SINGLE SURGEON DETAIL
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
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(surgeon.totalProfit)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Avg / Case</p>
            <p className="text-2xl font-bold">{formatCurrency(surgeon.avgProfit)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Median / Case</p>
            <p className="text-2xl font-bold">
              {surgeon.medianProfit !== null ? formatCurrency(surgeon.medianProfit) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Performance by Procedure */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Performance by Procedure</h3>
          <p className="text-sm text-slate-500 mt-1">
            Efficiency comparison vs facility average for each procedure type
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
                    Facility Avg
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
      </div>

      {/* Explanation Card */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Why per-procedure?</strong> Comparing surgeon efficiency only makes sense within 
              the same procedure type. A hip replacement naturally takes longer than a knee scope.
            </p>
            <p>
              <strong>Difference column:</strong> Shows how this surgeon's median time compares to 
              the facility median for that specific procedure. Negative (green) = faster than average.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}