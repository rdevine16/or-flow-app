// components/analytics/financials/OutliersTab.tsx
// Updated to navigate to full detail page instead of drawer

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FinancialsMetrics, OutlierCase, OutlierFilter } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'
import { InformationCircleIcon, FunnelIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

interface OutliersTabProps {
  metrics: FinancialsMetrics
}

export default function OutliersTab({ metrics }: OutliersTabProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<OutlierFilter>('all')

  // Navigate to detail page instead of opening drawer
  const handleRowClick = (outlier: OutlierCase) => {
    router.push(`/analytics/financials/outliers/${outlier.caseId}`)
  }

  // Filter outliers based on selection
  const filteredOutliers = metrics.outlierDetails.filter(outlier => {
    switch (filter) {
      case 'personal':
        return (outlier.outlierFlags.isDurationPersonalOutlier || outlier.outlierFlags.isProfitPersonalOutlier) &&
               !outlier.outlierFlags.isDurationFacilityOutlier && !outlier.outlierFlags.isProfitFacilityOutlier
      case 'facility':
        return (outlier.outlierFlags.isDurationFacilityOutlier || outlier.outlierFlags.isProfitFacilityOutlier) &&
               !outlier.outlierFlags.isDurationPersonalOutlier && !outlier.outlierFlags.isProfitPersonalOutlier
      case 'both':
        return (outlier.outlierFlags.isDurationPersonalOutlier || outlier.outlierFlags.isProfitPersonalOutlier) &&
               (outlier.outlierFlags.isDurationFacilityOutlier || outlier.outlierFlags.isProfitFacilityOutlier)
      case 'duration':
        return outlier.outlierFlags.isDurationPersonalOutlier || outlier.outlierFlags.isDurationFacilityOutlier
      case 'profit':
        return outlier.outlierFlags.isProfitPersonalOutlier || outlier.outlierFlags.isProfitFacilityOutlier
      default:
        return true
    }
  })

  // Calculate total gap for filtered outliers
  const totalGap = filteredOutliers.reduce((sum, c) => sum + c.profitGap, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard 
          title="Total Outliers" 
          value={metrics.outlierStats.total}
          variant={metrics.outlierStats.total > 0 ? 'warning' : 'success'}
        />
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <p className="text-sm font-medium text-red-600 mb-1">Critical</p>
          <p className="text-2xl font-bold text-red-700">{metrics.outlierStats.both}</p>
          <p className="text-xs text-red-500 mt-1">Below both baselines</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <p className="text-sm font-medium text-blue-600 mb-1">Personal Only</p>
          <p className="text-2xl font-bold text-blue-700">{metrics.outlierStats.personalOnly}</p>
          <p className="text-xs text-blue-500 mt-1">Below surgeon's baseline</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
          <p className="text-sm font-medium text-orange-600 mb-1">Facility Only</p>
          <p className="text-2xl font-bold text-orange-700">{metrics.outlierStats.facilityOnly}</p>
          <p className="text-xs text-orange-500 mt-1">Below facility baseline</p>
        </div>
        <MetricCard 
          title="Over Time" 
          value={metrics.outlierStats.durationOutliers}
          subtitle="Duration outliers"
        />
        <MetricCard 
          title="Low Profit" 
          value={metrics.outlierStats.profitOutliers}
          subtitle="Profit outliers"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FunnelIcon className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all' as OutlierFilter, label: 'All', count: metrics.outlierStats.total },
              { id: 'both' as OutlierFilter, label: 'Critical', count: metrics.outlierStats.both, color: 'red' },
              { id: 'personal' as OutlierFilter, label: 'Personal Only', count: metrics.outlierStats.personalOnly, color: 'blue' },
              { id: 'facility' as OutlierFilter, label: 'Facility Only', count: metrics.outlierStats.facilityOnly, color: 'orange' },
              { id: 'duration' as OutlierFilter, label: 'Over Time', count: metrics.outlierStats.durationOutliers, color: 'slate' },
              { id: 'profit' as OutlierFilter, label: 'Low Profit', count: metrics.outlierStats.profitOutliers, color: 'slate' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.id
                    ? f.color === 'red' ? 'bg-red-100 text-red-700 border border-red-200'
                    : f.color === 'blue' ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : f.color === 'orange' ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Outlier Cases Table */}
      {filteredOutliers.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {filter === 'all' ? 'All Outlier Cases' : `Filtered: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`}
              </h3>
              <p className="text-sm text-slate-500">Click a row to view full analysis with delay information</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total Gap</p>
              <p className={`text-lg font-bold ${totalGap < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(totalGap)}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actual Profit</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Expected</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Gap</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOutliers.map(outlier => {
                  // Determine outlier badge
                  const isBoth = (outlier.outlierFlags.isDurationPersonalOutlier || outlier.outlierFlags.isProfitPersonalOutlier) &&
                                 (outlier.outlierFlags.isDurationFacilityOutlier || outlier.outlierFlags.isProfitFacilityOutlier)
                  const isPersonalOnly = (outlier.outlierFlags.isDurationPersonalOutlier || outlier.outlierFlags.isProfitPersonalOutlier) &&
                                         !outlier.outlierFlags.isDurationFacilityOutlier && !outlier.outlierFlags.isProfitFacilityOutlier
                  const isFacilityOnly = (outlier.outlierFlags.isDurationFacilityOutlier || outlier.outlierFlags.isProfitFacilityOutlier) &&
                                         !outlier.outlierFlags.isDurationPersonalOutlier && !outlier.outlierFlags.isProfitPersonalOutlier

                  return (
                    <tr 
                      key={outlier.caseId} 
                      onClick={() => handleRowClick(outlier)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4 text-sm text-slate-600">{outlier.date}</td>
                      <td className="px-6 py-4">
                        <span className="text-blue-600 group-hover:underline font-medium">
                          {outlier.caseNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{outlier.surgeonName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{outlier.procedureName}</td>
                      <td className="px-6 py-4 text-center">
                        {isBoth ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Critical
                          </span>
                        ) : isPersonalOnly ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Personal
                          </span>
                        ) : isFacilityOnly ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            Facility
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                        {formatCurrency(outlier.actualProfit)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-500">
                        {outlier.expectedProfit !== null ? formatCurrency(outlier.expectedProfit) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">
                        {formatCurrency(outlier.profitGap)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors inline-block" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {filter === 'all' ? 'No Outliers Detected' : 'No Matching Outliers'}
          </h3>
          <p className="text-slate-500">
            {filter === 'all' 
              ? 'All cases are within expected ranges.'
              : 'Try a different filter to see other outlier types.'}
          </p>
        </div>
      )}

      {/* Info Card - How Outliers Are Detected */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-slate-900 mb-2">How Outliers Are Detected</h4>
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                <strong>Duration Outlier:</strong> Case duration exceeds the typical (median) + one standard deviation for that surgeon/procedure combination.
              </p>
              <p>
                <strong>Profit Outlier:</strong> Case profit falls below the typical (median) - one standard deviation for that surgeon/procedure combination.
              </p>
              <p className="mt-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 mr-2">Personal</span>
                Below the surgeon's own historical baseline
              </p>
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 mr-2">Facility</span>
                Below the facility's baseline (all surgeons)
              </p>
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 mr-2">Critical</span>
                Below both baselines - highest priority for review
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}