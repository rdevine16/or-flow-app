'use client'

import { Fragment } from 'react'
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
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{outlier.caseNumber}</h2>
            <p className="text-sm text-slate-500">Financial Breakdown</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-73px)]">
          {/* Case Info */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Case Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="text-sm font-medium text-slate-900">{outlier.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Surgeon</p>
                <p className="text-sm font-medium text-slate-900">{outlier.surgeonName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Procedure</p>
                <p className="text-sm font-medium text-slate-900">{outlier.procedureName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Payer</p>
                <p className="text-sm font-medium text-slate-900">{financials?.payerName || 'Default Rate'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-sm font-medium text-slate-900">{Math.round(outlier.durationMinutes)} min</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected Duration</p>
                <p className="text-sm font-medium text-slate-900">{Math.round(outlier.expectedDurationMinutes)} min</p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Financial Breakdown</h3>
            
            {financials ? (
              <div className="space-y-3">
                {/* Revenue */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">Reimbursement</p>
                    <p className="text-xs text-slate-400">
                      {financials.payerName ? `${financials.payerName} rate` : 'Default rate'}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatCurrency(financials.reimbursement)}
                  </p>
                </div>

                <div className="border-t border-dashed border-slate-200 my-2" />

                {/* Costs */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">Soft Goods Cost</p>
                    <p className="text-xs text-slate-400">Disposables, consumables</p>
                  </div>
                  <p className="text-sm font-medium text-red-500">
                    -{formatCurrency(financials.softGoodsCost)}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">Hard Goods Cost</p>
                    <p className="text-xs text-slate-400">Implants, equipment</p>
                  </div>
                  <p className="text-sm font-medium text-red-500">
                    -{formatCurrency(financials.hardGoodsCost)}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-700">OR Time Cost</p>
                    <p className="text-xs text-slate-400">
                      {Math.round(outlier.durationMinutes)} min × {formatCurrency(financials.orRate)}/hr
                    </p>
                  </div>
                  <p className="text-sm font-medium text-red-500">
                    -{formatCurrency(financials.orCost)}
                  </p>
                </div>

                <div className="border-t border-slate-200 my-2 pt-2" />

                {/* Profit */}
                <div className="flex justify-between items-center bg-slate-50 -mx-6 px-6 py-3">
                  <p className="text-sm font-semibold text-slate-900">Actual Profit</p>
                  <p className={`text-base font-bold ${outlier.actualProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    {formatCurrency(outlier.actualProfit)}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-600">Expected Profit</p>
                  <p className="text-sm font-medium text-slate-600">
                    {formatCurrency(outlier.expectedProfit)}
                  </p>
                </div>

                <div className="flex justify-between items-center bg-red-50 -mx-6 px-6 py-3 rounded-lg mx-0">
                  <p className="text-sm font-semibold text-red-700">Gap</p>
                  <p className="text-base font-bold text-red-600">
                    {formatCurrency(outlier.gap)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Financial breakdown not available</p>
            )}
          </div>

          {/* Issues Detected */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Issues Detected</h3>
            
            <div className="space-y-3">
              {outlier.issues.map((issue, index) => (
                <IssueCard key={index} issue={issue} financials={financials} outlier={outlier} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-5">
            <Link
              href={`/cases/${outlier.caseId}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View Full Case Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

// Issue Card Component
function IssueCard({ 
  issue, 
  financials,
  outlier 
}: { 
  issue: CaseIssue
  financials: FinancialBreakdown | null
  outlier: OutlierCase
}) {
  switch (issue.type) {
    case 'overTime':
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-amber-800">Over Time</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-amber-600">Expected</p>
              <p className="font-medium text-amber-900">{Math.round(issue.expectedMinutes || 0)} min</p>
            </div>
            <div>
              <p className="text-amber-600">Actual</p>
              <p className="font-medium text-amber-900">{Math.round(issue.actualMinutes || 0)} min</p>
            </div>
          </div>
          <p className="text-sm text-amber-700 mt-2">
            <span className="font-semibold">+{Math.round(issue.percentOver || 0)}%</span> over expected duration
          </p>
        </div>
      )

    case 'delay':
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-semibold text-orange-800">Recorded Delays</p>
          </div>
          {issue.delays && issue.delays.length > 0 ? (
            <div className="space-y-1">
              {issue.delays.map((delay, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-orange-700">{delay.name}</span>
                  <span className="font-medium text-orange-900">{delay.minutes} min</span>
                </div>
              ))}
              <div className="border-t border-orange-200 mt-2 pt-2 flex justify-between text-sm">
                <span className="font-medium text-orange-800">Total Delay</span>
                <span className="font-bold text-orange-900">{issue.totalMinutes} min</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-orange-700">Delays recorded but details not available</p>
          )}
        </div>
      )

    case 'lowPayer':
      return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-purple-800">Low Payer</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-purple-600">Default Rate</p>
              <p className="font-medium text-purple-900">{formatCurrency(issue.defaultRate || 0)}</p>
            </div>
            <div>
              <p className="text-purple-600">{issue.payerName} Rate</p>
              <p className="font-medium text-purple-900">{formatCurrency(issue.payerRate || 0)}</p>
            </div>
          </div>
          <p className="text-sm text-purple-700 mt-2">
            <span className="font-semibold">-{Math.round(issue.percentBelow || 0)}%</span> below default reimbursement
          </p>
        </div>
      )

    case 'unknown':
    default:
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-700">Unknown</p>
          </div>
          <p className="text-sm text-slate-600">
            This case is below expected profit, but no specific issue was detected. 
            Possible causes include:
          </p>
          <ul className="text-sm text-slate-500 mt-2 space-y-1 list-disc list-inside">
            <li>Duration slightly elevated (but not 30%+ over)</li>
            <li>Delays occurred but weren't recorded</li>
            <li>Combination of small factors</li>
          </ul>
        </div>
      )
  }
}
