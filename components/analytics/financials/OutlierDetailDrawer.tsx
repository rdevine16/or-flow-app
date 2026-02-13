'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { OutlierCase, FinancialBreakdown } from './types'
import { formatCurrency } from './utils'

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
  onClose,
}: OutlierDetailDrawerProps) {
  if (!outlier) return null

  const { outlierFlags } = outlier

  // Determine outlier type
  const isBoth = (outlierFlags.isDurationPersonalOutlier || outlierFlags.isProfitPersonalOutlier) &&
                 (outlierFlags.isDurationFacilityOutlier || outlierFlags.isProfitFacilityOutlier)
  const isPersonalOnly = (outlierFlags.isDurationPersonalOutlier || outlierFlags.isProfitPersonalOutlier) &&
                         !outlierFlags.isDurationFacilityOutlier && !outlierFlags.isProfitFacilityOutlier
  const isFacilityOnly = (outlierFlags.isDurationFacilityOutlier || outlierFlags.isProfitFacilityOutlier) &&
                         !outlierFlags.isDurationPersonalOutlier && !outlierFlags.isProfitPersonalOutlier

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/25 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-slate-900">
                            Case Details
                          </Dialog.Title>
                          <p className="text-sm text-slate-500">{outlier.caseNumber}</p>
                        </div>
                        <button
                          onClick={onClose}
                          className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-6 py-4 space-y-6">
                      {/* Case Info */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-2">Case Information</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Date</span>
                            <p className="font-medium text-slate-900">{outlier.date}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Room</span>
                            <p className="font-medium text-slate-900">{outlier.roomName || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Surgeon</span>
                            <p className="font-medium text-slate-900">{outlier.surgeonName}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-500">Procedure</span>
                            <p className="font-medium text-slate-900">{outlier.procedureName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Outlier Classification */}
                      <div className={`p-4 rounded-lg border ${
                        isBoth ? 'bg-red-50 border-red-200' :
                        isPersonalOnly ? 'bg-blue-50 border-blue-200' :
                        isFacilityOnly ? 'bg-orange-50 border-orange-200' :
                        'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isBoth ? 'bg-red-100 text-red-600' :
                            isPersonalOnly ? 'bg-blue-100 text-blue-700' :
                            isFacilityOnly ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {isBoth ? 'Critical' : isPersonalOnly ? 'Personal' : isFacilityOnly ? 'Facility' : 'Unknown'}
                          </span>
                          <span className={`text-sm font-medium ${
                            isBoth ? 'text-red-600' : isPersonalOnly ? 'text-blue-700' : 'text-orange-700'
                          }`}>
                            Outlier
                          </span>
                        </div>
                        <p className={`text-sm ${
                          isBoth ? 'text-red-600' : isPersonalOnly ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {isBoth 
                            ? 'This case is below both the surgeon\'s typical and the facility\'s typical baseline.'
                            : isPersonalOnly 
                            ? 'This case is below the surgeon\'s typical baseline, but within facility norms.'
                            : 'This case is below the facility baseline, but within this surgeon\'s typical range.'}
                        </p>
                      </div>

                      {/* Threshold Details */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="text-sm font-medium text-slate-500">Threshold Details</h4>
                          <div className="group relative">
                            <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-56">
                              Outlier if duration exceeds threshold (over time) or profit falls below threshold (low profit)
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {/* Duration Thresholds */}
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-slate-500 mb-2">DURATION</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-400">Actual</span>
                                <p className={`font-medium ${
                                  outlierFlags.isDurationPersonalOutlier || outlierFlags.isDurationFacilityOutlier 
                                    ? 'text-red-600' : 'text-slate-900'
                                }`}>
                                  {Math.round(outlier.actualDuration)} min
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Typical</span>
                                <p className="font-medium text-slate-900">
                                  {outlier.expectedDuration !== null ? `${Math.round(outlier.expectedDuration)} min` : '—'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Surgeon Threshold</span>
                                <p className={`font-medium ${outlierFlags.isDurationPersonalOutlier ? 'text-blue-600' : 'text-slate-600'}`}>
                                  {outlierFlags.personalDurationThreshold !== null 
                                    ? `${Math.round(outlierFlags.personalDurationThreshold)} min`
                                    : '—'}
                                  {outlierFlags.isDurationPersonalOutlier && ' ⚠️'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Facility Threshold</span>
                                <p className={`font-medium ${outlierFlags.isDurationFacilityOutlier ? 'text-orange-600' : 'text-slate-600'}`}>
                                  {outlierFlags.facilityDurationThreshold !== null 
                                    ? `${Math.round(outlierFlags.facilityDurationThreshold)} min`
                                    : '—'}
                                  {outlierFlags.isDurationFacilityOutlier && ' ⚠️'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Profit Thresholds */}
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-slate-500 mb-2">PROFIT</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-400">Actual</span>
                                <p className={`font-medium ${
                                  outlierFlags.isProfitPersonalOutlier || outlierFlags.isProfitFacilityOutlier 
                                    ? 'text-red-600' : 'text-slate-900'
                                }`}>
                                  {formatCurrency(outlier.actualProfit)}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Typical</span>
                                <p className="font-medium text-slate-900">
                                  {outlier.expectedProfit !== null ? formatCurrency(outlier.expectedProfit) : '—'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Surgeon Threshold</span>
                                <p className={`font-medium ${outlierFlags.isProfitPersonalOutlier ? 'text-blue-600' : 'text-slate-600'}`}>
                                  {outlierFlags.personalProfitThreshold !== null 
                                    ? formatCurrency(outlierFlags.personalProfitThreshold)
                                    : '—'}
                                  {outlierFlags.isProfitPersonalOutlier && ' ⚠️'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Facility Threshold</span>
                                <p className={`font-medium ${outlierFlags.isProfitFacilityOutlier ? 'text-orange-600' : 'text-slate-600'}`}>
                                  {outlierFlags.facilityProfitThreshold !== null 
                                    ? formatCurrency(outlierFlags.facilityProfitThreshold)
                                    : '—'}
                                  {outlierFlags.isProfitFacilityOutlier && ' ⚠️'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      {financials && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-3">Financial Breakdown</h4>
                          <div className="bg-slate-50 rounded-lg divide-y divide-slate-200">
                            <div className="p-3 flex justify-between">
                              <span className="text-sm text-slate-600">Reimbursement</span>
                              <span className="text-sm font-medium text-green-600">
                                +{formatCurrency(financials.reimbursement)}
                              </span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <span className="text-sm text-slate-600">Soft Goods Cost</span>
                              <span className="text-sm font-medium text-red-600">
                                −{formatCurrency(financials.softGoodsCost)}
                              </span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <span className="text-sm text-slate-600">Hard Goods Cost</span>
                              <span className="text-sm font-medium text-red-600">
                                −{formatCurrency(financials.hardGoodsCost)}
                              </span>
                            </div>
                            <div className="p-3 flex justify-between">
                              <div>
                                <span className="text-sm text-slate-600">OR Time Cost</span>
                                <p className="text-xs text-slate-400">
                                  {Math.round(outlier.actualDuration)} min × {formatCurrency(financials.orRate)}/hr
                                </p>
                              </div>
                              <span className="text-sm font-medium text-red-600">
                                −{formatCurrency(financials.orCost)}
                              </span>
                            </div>
                            <div className="p-3 flex justify-between bg-white rounded-b-lg">
                              <span className="text-sm font-semibold text-slate-900">Net Profit</span>
                              <span className={`text-sm font-bold ${outlier.actualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(outlier.actualProfit)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Issues Detected */}
                      {outlier.issues.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 mb-3">Issues Detected</h4>
                          <div className="space-y-2">
                            {outlier.issues.map((issue, idx) => (
                              <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                {issue.type === 'overTime' && (
                                  <div>
                                    <p className="text-sm font-medium text-amber-800">Over Time</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                      {Math.round(issue.actualMinutes)} min actual vs {Math.round(issue.expectedMinutes)} min typical
                                      <br />
                                      Threshold: {Math.round(issue.thresholdMinutes)} min • {Math.round(issue.minutesOver)} min over
                                    </p>
                                  </div>
                                )}
                                {issue.type === 'lowProfit' && (
                                  <div>
                                    <p className="text-sm font-medium text-amber-800">Low Profit</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                      {formatCurrency(issue.actualProfit)} actual vs {formatCurrency(issue.expectedProfit)} typical
                                      <br />
                                      Threshold: {formatCurrency(issue.thresholdProfit)} • {formatCurrency(issue.amountBelow)} below
                                    </p>
                                  </div>
                                )}
                                {issue.type === 'delay' && (
                                  <div>
                                    <p className="text-sm font-medium text-amber-800">Recorded Delays</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                      Total: {issue.totalMinutes} min
                                      {issue.delays.map((d, i) => (
                                        <span key={i}> • {d.name}{d.minutes ? ` (${d.minutes} min)` : ''}</span>
                                      ))}
                                    </p>
                                  </div>
                                )}
                                {issue.type === 'lowPayer' && (
                                  <div>
                                    <p className="text-sm font-medium text-amber-800">Low Payer Rate</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                      {issue.payerName}: {formatCurrency(issue.payerRate)} vs {formatCurrency(issue.defaultRate)} default
                                      <br />
                                      {Math.round(issue.percentBelow)}% below standard rate
                                    </p>
                                  </div>
                                )}
                                {issue.type === 'unknown' && (
                                  <p className="text-sm text-slate-500">No specific issue identified</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}