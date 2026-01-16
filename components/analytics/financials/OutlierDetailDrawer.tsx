'use client'

import Link from 'next/link'
import { formatCurrency } from './utils'
import { OutlierCase, CaseIssue } from './types'

interface FinancialBreakdown {
  reimbursement: number
  softGoodsCost: number
  hardGoodsCost: number
  orCost: number
  orRate: number
  payerName: string | null
  defaultReimbursement: number | null
  payerReimbursement: number | null
}

interface OutlierDetailDrawerProps {
  outlier: OutlierCase | null
  financials: FinancialBreakdown | null
  isOpen: boolean
  onClose: () => void
}

export default function OutlierDetailDrawer({ 
  outlier, 
  financials,
  isOpen, 
  onClose 
}: OutlierDetailDrawerProps) {
  if (!outlier) return null

  return (
    <>
      {/* Backdrop - subtle, not blurred */}
      <div 
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{outlier.caseNumber}</h2>
            <p className="text-sm text-slate-500">Financial Breakdown</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Case Info */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Case Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Date</p>
                <p className="text-sm font-medium text-slate-900">{outlier.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Surgeon</p>
                <p className="text-sm font-medium text-slate-900">{outlier.surgeonName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Procedure</p>
                <p className="text-sm font-medium text-slate-900">{outlier.procedureName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Payer</p>
                <p className="text-sm font-medium text-slate-900">{financials?.payerName || 'Default Rate'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Duration</p>
                <p className="text-sm font-medium text-slate-900">{Math.round(outlier.durationMinutes)} min</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Expected Duration</p>
                <p className="text-sm font-medium text-slate-900">{Math.round(outlier.expectedDurationMinutes)} min</p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Financial Breakdown</h3>
            
            {financials ? (
              <div className="space-y-3">
                {/* Revenue */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Reimbursement</p>
                    <p className="text-xs text-slate-400">
                      {financials.payerName ? `${financials.payerName} rate` : 'Default rate'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatCurrency(financials.reimbursement)}
                  </p>
                </div>

                <div className="border-t border-dashed border-slate-200" />

                {/* Costs */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Soft Goods Cost</p>
                    <p className="text-xs text-slate-400">Disposables, consumables</p>
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    -{formatCurrency(financials.softGoodsCost)}
                  </p>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Hard Goods Cost</p>
                    <p className="text-xs text-slate-400">Implants, equipment</p>
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    -{formatCurrency(financials.hardGoodsCost)}
                  </p>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">OR Time Cost</p>
                    <p className="text-xs text-slate-400">
                      {Math.round(outlier.durationMinutes)} min × {formatCurrency(financials.orRate)}/hr
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    -{formatCurrency(financials.orCost)}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-3" />

                {/* Profit Summary */}
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-slate-900">Actual Profit</p>
                  <p className={`text-lg font-bold ${outlier.actualProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    {formatCurrency(outlier.actualProfit)}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500">Expected Profit</p>
                  <p className="text-sm font-medium text-slate-500">
                    {formatCurrency(outlier.expectedProfit)}
                  </p>
                </div>

                {/* Gap - Highlighted */}
                <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-lg px-4 py-3 -mx-2">
                  <p className="text-sm font-semibold text-red-700">Gap</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(outlier.gap)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Financial breakdown not available</p>
            )}
          </div>

          {/* Issues Detected */}
          <div className="px-6 py-5 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Issues Detected</h3>
            
            <div className="space-y-3">
              {outlier.issues.map((issue, index) => (
                <IssueCard key={index} issue={issue} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
          <Link
            href={`/cases/${outlier.caseId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            View Full Case Details
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  )
}

// Issue Card Component
function IssueCard({ issue }: { issue: CaseIssue }) {
  switch (issue.type) {
    case 'overTime':
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-amber-800">Over Time</p>
            <span className="ml-auto text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              +{Math.round(issue.percentOver || 0)}%
            </span>
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-amber-600">Expected: </span>
              <span className="font-medium text-amber-900">{Math.round(issue.expectedMinutes || 0)} min</span>
            </div>
            <div>
              <span className="text-amber-600">Actual: </span>
              <span className="font-medium text-amber-900">{Math.round(issue.actualMinutes || 0)} min</span>
            </div>
          </div>
        </div>
      )

    case 'delay':
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-semibold text-orange-800">Recorded Delays</p>
            <span className="ml-auto text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
              {issue.totalMinutes} min total
            </span>
          </div>
          {issue.delays && issue.delays.length > 0 && (
            <div className="space-y-1 text-xs">
              {issue.delays.map((delay, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-orange-700">{delay.name}</span>
                  <span className="font-medium text-orange-900">{delay.minutes} min</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )

    case 'lowPayer':
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-purple-800">Low Payer</p>
            <span className="ml-auto text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
              -{Math.round(issue.percentBelow || 0)}%
            </span>
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-purple-600">Default: </span>
              <span className="font-medium text-purple-900">{formatCurrency(issue.defaultRate || 0)}</span>
            </div>
            <div>
              <span className="text-purple-600">{issue.payerName}: </span>
              <span className="font-medium text-purple-900">{formatCurrency(issue.payerRate || 0)}</span>
            </div>
          </div>
        </div>
      )

    case 'unknown':
    default:
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Unknown Cause</p>
          </div>
          <p className="text-xs text-slate-500">
            Below expected profit, but no specific issue detected. May be a combination of small factors.
          </p>
        </div>
      )
  }
}
