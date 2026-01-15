'use client'

import Link from 'next/link'
import { FinancialsMetrics } from './types'
import { formatCurrency } from './utils'
import MetricCard from './MetricCard'
import IssuesBadge from './IssuesBadge'

interface OutliersTabProps {
  metrics: FinancialsMetrics
}

export default function OutliersTab({ metrics }: OutliersTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard 
          title="Outlier Cases" 
          value={metrics.outlierCount}
          subtitle="Below 1 std dev"
          variant={metrics.outlierCount > 0 ? 'warning' : 'success'}
        />
        <MetricCard 
          title="Total Gap" 
          value={formatCurrency(metrics.outlierDetails.reduce((sum, c) => sum + c.gap, 0))}
          subtitle="vs expected profit"
          variant="danger"
        />
        <MetricCard 
          title="Over Time" 
          value={metrics.issueStats.overTime}
          subtitle="Cases with excess time"
        />
        <MetricCard 
          title="With Delays" 
          value={metrics.issueStats.delay}
          subtitle="Cases with delays"
        />
        <MetricCard 
          title="Low Payer" 
          value={metrics.issueStats.lowPayer}
          subtitle="Below-average payer"
        />
      </div>

      {/* Outlier Cases Table */}
      {metrics.outlierDetails.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Cases Below Expected Profit</h3>
            <p className="text-sm text-slate-500">Sorted by largest gap from expected • Hover issues for details</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Case #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Surgeon</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Procedure</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actual</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Gap</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.outlierDetails.map(outlier => (
                  <tr key={outlier.caseId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600">{outlier.date}</td>
                    <td className="px-6 py-4">
                      <Link href={`/cases/${outlier.caseId}`} className="text-blue-600 hover:underline font-medium">
                        {outlier.caseNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{outlier.surgeonName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{outlier.procedureName}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                      {formatCurrency(outlier.actualProfit)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">
                      {formatCurrency(outlier.gap)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <IssuesBadge issues={outlier.issues} caseId={outlier.caseId} />
                    </td>
                  </tr>
                ))}
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
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Outliers Detected</h3>
          <p className="text-slate-500">All cases are within expected profit ranges.</p>
        </div>
      )}
    </div>
  )
}
