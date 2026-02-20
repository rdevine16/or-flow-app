// components/analytics/financials/CaseEconomicsCard.tsx
// Reusable average case economics waterfall card
// Shows reimbursement → debit/cost breakdown → net profit with proportional bars

'use client'

import { fmt } from './utils'

interface CaseEconomicsCardProps {
  avgReimbursement: number
  avgDebits: number
  avgCredits: number
  avgORCost: number
  avgProfit: number
}

const rows = [
  { key: 'reimbursement', label: 'Reimbursement', color: '#3b82f6', indent: false },
  { key: 'debits', label: 'Implants & Supplies', color: '#ef4444', indent: true },
  { key: 'orCost', label: 'OR Time Cost', color: '#f59e0b', indent: true },
] as const

export function CaseEconomicsCard({
  avgReimbursement,
  avgDebits,
  avgCredits,
  avgORCost,
  avgProfit,
}: CaseEconomicsCardProps) {
  const maxVal = avgReimbursement || 1

  const getRowValue = (key: string): number => {
    switch (key) {
      case 'reimbursement': return avgReimbursement
      case 'debits': return -avgDebits
      case 'orCost': return -avgORCost
      default: return 0
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Average Case Economics</h3>

      <div className="space-y-0">
        {rows.map(row => {
          const value = getRowValue(row.key)
          const barWidth = (Math.abs(value) / maxVal) * 100

          return (
            <div
              key={row.key}
              className={`flex items-center justify-between py-2.5 ${row.indent ? 'pl-4' : ''}`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-sm text-slate-600">{row.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: row.color,
                      opacity: 0.6,
                    }}
                  />
                </div>
                <span
                  className={`text-sm font-medium tabular-nums w-20 text-right ${
                    value < 0 ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
                </span>
              </div>
            </div>
          )
        })}

        {/* Credits row (only if present) */}
        {avgCredits > 0 && (
          <div className="flex items-center justify-between py-2.5 pl-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
              <span className="text-sm text-slate-600">Credits (rebates, fees)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{
                    width: `${(avgCredits / maxVal) * 100}%`,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums w-20 text-right text-green-600">
                +{fmt(avgCredits)}
              </span>
            </div>
          </div>
        )}

        {/* Net Profit / Case */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-900">Net Profit / Case</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.max((Math.abs(avgProfit) / maxVal) * 100, 0)}%`,
                  opacity: 0.7,
                }}
              />
            </div>
            <span
              className={`text-sm font-bold tabular-nums w-20 text-right ${
                avgProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {fmt(avgProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Stacked cost percentage bar */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-l-full"
            style={{ width: `${maxVal > 0 ? (avgDebits / maxVal) * 100 : 0}%` }}
            title="Implants"
          />
          <div
            className="h-full bg-amber-400"
            style={{ width: `${maxVal > 0 ? (avgORCost / maxVal) * 100 : 0}%` }}
            title="OR Cost"
          />
          <div
            className="h-full bg-emerald-400 rounded-r-full"
            style={{ width: `${maxVal > 0 ? (Math.max(avgProfit, 0) / maxVal) * 100 : 0}%` }}
            title="Profit"
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Implants {maxVal > 0 ? ((avgDebits / maxVal) * 100).toFixed(0) : 0}%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            OR Cost {maxVal > 0 ? ((avgORCost / maxVal) * 100).toFixed(0) : 0}%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Profit {maxVal > 0 ? ((Math.max(avgProfit, 0) / maxVal) * 100).toFixed(0) : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}
