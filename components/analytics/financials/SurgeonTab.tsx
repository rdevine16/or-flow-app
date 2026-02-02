// components/analytics/financials/SurgeonTab.tsx
// Redesigned with profit leaderboard and procedure-aware drill-down

'use client'

import { useState } from 'react'
import { FinancialsMetrics, SurgeonStats, SurgeonProcedureBreakdown } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'
import { 
  InformationCircleIcon, 
  ChevronRightIcon,
  ChevronDownIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowLeftIcon,
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
          {metrics.surgeonStats.map(surgeon => (
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
// ALL SURGEONS OVERVIEW
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

  return (
    <>
      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Surgeons" 
          value={surgeonStats.length}
          subtitle="Active in period"
        />
        <MetricCard 
          title="Total Cases" 
          value={metrics.totalCases}
          subtitle="All surgeons"
        />
        <MetricCard 
          title="Total Profit" 
          value={formatCurrency(metrics.totalProfit)}
          variant="success"
        />
        <MetricCard 
          title="Avg per Case" 
          value={formatCurrency(metrics.avgProfit)}
        />
      </div>

      {/* Profit Leaderboard with Inline Expansion */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Surgeon Performance</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Click a row to see procedure breakdown • Efficiency is adjusted for procedure mix
          </p>
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
              costPerMinute={metrics.costPerMinute}
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
  costPerMinute,
}: {
  surgeon: SurgeonStats
  rank: number
  isExpanded: boolean
  onToggle: () => void
  onViewDetail: () => void
  costPerMinute: number
}) {
  const procedures = surgeon.procedureBreakdown || []
  const isFaster = surgeon.durationVsFacilityMinutes < 0
  const minutes = Math.abs(Math.round(surgeon.durationVsFacilityMinutes))

  return (
    <div className={`${isExpanded ? 'bg-slate-50' : ''}`}>
      {/* Main Row */}
      <div 
        className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {/* Rank */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          rank === 1 ? 'bg-amber-100 text-amber-700' : 
          rank === 2 ? 'bg-slate-200 text-slate-600' : 
          rank === 3 ? 'bg-orange-100 text-orange-700' : 
          'bg-slate-100 text-slate-500'
        }`}>
          {rank}
        </div>

        {/* Name & Procedures */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{surgeon.surgeonName}</span>
            {surgeon.caseCount < 10 && (
              <span className="text-xs text-amber-600">*</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-slate-500">{surgeon.caseCount} cases</span>
            <span className="text-slate-300">•</span>
            <span className="text-sm text-slate-500">{procedures.length} procedure{procedures.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-emerald-600">{formatCurrency(surgeon.totalProfit)}</div>
          <div className="text-xs text-slate-500">{formatCurrency(surgeon.avgProfit)}/case</div>
        </div>

        {/* Efficiency */}
        <div className="text-right w-24 flex-shrink-0">
          <div className={`font-medium ${
            isFaster ? 'text-emerald-600' : 
            minutes > 10 ? 'text-red-500' : 
            'text-slate-600'
          }`}>
            {isFaster ? '-' : '+'}{minutes} min
          </div>
          <div className="text-xs text-slate-500">vs expected</div>
        </div>

        {/* Expand Chevron */}
        <div className="flex-shrink-0">
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Profit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">vs Facility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procedures.slice(0, 5).map(proc => {
                  const procIsFaster = proc.durationVsFacility < 0
                  const procMinutes = Math.abs(Math.round(proc.durationVsFacility))
                  
                  return (
                    <tr key={proc.procedureId} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">{proc.procedureName}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{proc.caseCount}</td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {proc.medianProfit !== null ? formatCurrency(proc.medianProfit) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={`${
                          procIsFaster ? 'text-emerald-600' : 
                          procMinutes > 10 ? 'text-red-500' : 
                          'text-slate-600'
                        }`}>
                          {procIsFaster ? '-' : '+'}{procMinutes} min
                        </span>
                      </td>
                    </tr>
                  )
                })}
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
  const isFaster = surgeon.durationVsFacilityMinutes < 0

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
            <p className="text-slate-300">{surgeon.caseCount} cases • {procedures.length} procedure type{procedures.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Total Profit</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(surgeon.totalProfit)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Avg / Case</p>
            <p className="text-2xl font-bold">{formatCurrency(surgeon.avgProfit)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-1">
              <p className="text-sm text-slate-300">Efficiency</p>
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-64">
                  Procedure-adjusted: compares to facility median for each procedure, weighted by case volume
                </div>
              </div>
            </div>
            <p className={`text-2xl font-bold ${isFaster ? 'text-emerald-400' : surgeon.durationVsFacilityMinutes > 10 ? 'text-red-400' : 'text-white'}`}>
              {isFaster ? '' : '+'}{Math.round(surgeon.durationVsFacilityMinutes)} min
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-300">Time Impact</p>
            <p className={`text-2xl font-bold ${surgeon.profitImpact > 0 ? 'text-emerald-400' : surgeon.profitImpact < -100 ? 'text-red-400' : 'text-white'}`}>
              {surgeon.profitImpact > 0 ? '+' : ''}{formatCurrency(surgeon.profitImpact)}
            </p>
            <p className="text-xs text-slate-400">per case</p>
          </div>
        </div>
      </div>

      {/* Performance by Procedure */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Performance by Procedure</h3>
          <p className="text-sm text-slate-500 mt-1">
            How {surgeon.surgeonName} compares to facility median for each procedure type
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Cases</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total Profit</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Profit / Case</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">vs Facility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {procedures.map(proc => {
                const procIsFaster = proc.durationVsFacility < 0
                const procMoreProfit = proc.profitVsFacility > 0
                
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
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${
                        procIsFaster ? 'text-emerald-600' : 
                        Math.abs(proc.durationVsFacility) > 10 ? 'text-red-500' : 
                        'text-slate-600'
                      }`}>
                        {procIsFaster ? '' : '+'}{Math.round(proc.durationVsFacility)} min
                      </span>
                      {proc.durationVsFacilityPct !== null && (
                        <span className="text-xs text-slate-400 ml-1">
                          ({proc.durationVsFacilityPct > 0 ? '+' : ''}{proc.durationVsFacilityPct.toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {proc.medianProfit !== null ? formatCurrency(proc.medianProfit) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${
                        procMoreProfit ? 'text-emerald-600' : 
                        Math.abs(proc.profitVsFacility) > 500 ? 'text-red-500' : 
                        'text-slate-600'
                      }`}>
                        {procMoreProfit ? '+' : ''}{formatCurrency(proc.profitVsFacility)}
                      </span>
                      {proc.profitVsFacilityPct !== null && (
                        <span className="text-xs text-slate-400 ml-1">
                          ({proc.profitVsFacilityPct > 0 ? '+' : ''}{proc.profitVsFacilityPct.toFixed(0)}%)
                        </span>
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
              <strong>Fair Comparison:</strong> The "vs Facility" columns compare this surgeon's performance 
              to the facility median <em>for that specific procedure</em>. This accounts for differences in 
              procedure complexity.
            </p>
            <p>
              <strong>Efficiency Index:</strong> The overall efficiency (-/+ minutes) is a weighted average 
              across all procedures this surgeon performs, weighted by their case volume for each procedure.
            </p>
            <p>
              <strong>Time Impact:</strong> Estimated profit impact per case based on efficiency and 
              your OR hourly rate of {formatCurrency(metrics.orRate)}/hr.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}