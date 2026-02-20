// components/analytics/financials/PayerMixCard.tsx
// Reusable payer mix table with micro-bars and insight callout

'use client'

import { useMemo } from 'react'
import { PayerMixEntry } from './types'
import { fmt, formatPercent, PAYER_COLORS } from './utils'
import { MarginBadge } from './shared'

interface PayerMixCardProps {
  payerMix: PayerMixEntry[]
  title?: string
  subtitle?: string
}

export function PayerMixCard({
  payerMix,
  title = 'Payer Mix',
  subtitle,
}: PayerMixCardProps) {
  const maxCases = Math.max(...payerMix.map(p => p.caseCount), 1)

  // Generate insight comparing best and worst payers
  const insight = useMemo(() => {
    if (payerMix.length < 2) return null

    const sorted = [...payerMix].sort((a, b) => b.marginPercent - a.marginPercent)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]

    if (best.payerName === worst.payerName) return null

    const profitDiff = Math.abs(best.avgProfit - worst.avgProfit)
    if (profitDiff < 100) return null

    return {
      bestPayer: best.payerName,
      bestMargin: best.marginPercent,
      worstPayer: worst.payerName,
      worstMargin: worst.marginPercent,
      profitDiff,
    }
  }, [payerMix])

  if (payerMix.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
        <p className="text-sm text-slate-400 text-center py-8">No payer data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="space-y-0 divide-y divide-slate-50">
        {/* Header */}
        <div className="grid grid-cols-12 pb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">Payer</div>
          <div className="col-span-2 text-center">Cases</div>
          <div className="col-span-3 text-right">Avg Reimb.</div>
          <div className="col-span-3 text-right">Margin</div>
        </div>

        {/* Rows */}
        {payerMix.map((payer, i) => {
          const color = PAYER_COLORS[i % PAYER_COLORS.length]

          return (
            <div
              key={payer.payerId}
              className="grid grid-cols-12 items-center py-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className="col-span-4 flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium text-slate-800 truncate">
                  {payer.payerName}
                </span>
              </div>
              <div className="col-span-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-sm text-slate-600 tabular-nums">{payer.caseCount}</span>
                  <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(payer.caseCount / maxCases) * 100}%`,
                        backgroundColor: color,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-3 text-right text-sm text-slate-700 tabular-nums">
                {fmt(payer.avgReimbursement)}
              </div>
              <div className="col-span-3 text-right">
                <MarginBadge value={payer.marginPercent} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Insight callout */}
      {insight && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
            <div>
              <p className="text-xs font-semibold text-blue-800">Payer Insight</p>
              <p className="text-[11px] text-blue-600 mt-0.5">
                {insight.bestPayer} cases average {formatPercent(insight.bestMargin)} margin vs{' '}
                {formatPercent(insight.worstMargin)} for {insight.worstPayer} — a{' '}
                {fmt(insight.profitDiff)} profit difference per case driven primarily by higher
                reimbursement rates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
