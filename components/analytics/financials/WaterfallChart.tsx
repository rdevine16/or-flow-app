// Revenue -> Costs -> Profit waterfall SVG chart
// Used in the Overview hero P&L card and procedure/surgeon detail pages

import { fmtK } from './utils'

interface WaterfallChartProps {
  revenue: number
  debits: number
  credits: number
  orCost: number
  profit: number
}

interface WaterfallBar {
  label: string
  topY: number
  bottomY: number
  color: string
  displayValue: string
  isFinal?: boolean
}

export function WaterfallChart({ revenue, debits, credits, orCost, profit }: WaterfallChartProps) {
  if (revenue <= 0) return null

  const bars: WaterfallBar[] = []
  let running = revenue

  // Revenue — full height, no value label
  bars.push({
    label: 'Revenue',
    topY: revenue,
    bottomY: 0,
    color: '#3b82f6',
    displayValue: '',
  })

  // Debits (implants/supplies) — hangs from revenue
  if (debits > 0) {
    bars.push({
      label: 'Implants',
      topY: running,
      bottomY: running - debits,
      color: '#ef4444',
      displayValue: `-${fmtK(debits)}`,
    })
    running -= debits
  }

  // Credits (rebates) — grows upward from current position
  if (credits > 0) {
    bars.push({
      label: 'Credits',
      topY: running + credits,
      bottomY: running,
      color: '#10b981',
      displayValue: `+${fmtK(credits)}`,
    })
    running += credits
  }

  // OR Cost — hangs from current position
  if (orCost > 0) {
    bars.push({
      label: 'OR Cost',
      topY: running,
      bottomY: running - orCost,
      color: '#f59e0b',
      displayValue: `-${fmtK(orCost)}`,
    })
    running -= orCost
  }

  // Profit — final bar from 0
  bars.push({
    label: 'Profit',
    topY: Math.abs(profit),
    bottomY: 0,
    color: profit >= 0 ? '#10b981' : '#ef4444',
    displayValue: fmtK(profit),
    isFinal: true,
  })

  const chartH = 120
  const barW = 48
  const gap = 20
  const padX = 20
  const totalW = bars.length * barW + (bars.length - 1) * gap + padX * 2
  const maxY = Math.max(...bars.map(b => b.topY))
  const scale = (v: number) => (maxY > 0 ? (v / maxY) * chartH : 0)

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={chartH + 40} className="mx-auto block">
        {bars.map((b, i) => {
          const x = padX + i * (barW + gap)
          const barH = Math.max(scale(b.topY - b.bottomY), 1)
          const barY = Math.max(chartH - scale(b.topY), 0)

          return (
            <g key={b.label}>
              <rect
                x={x}
                y={barY}
                width={barW}
                height={barH}
                rx={3}
                fill={b.color}
                opacity={b.isFinal ? 0.9 : 0.85}
              />
              {/* Bottom label */}
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                style={{ fontSize: b.isFinal ? 10 : 9 }}
                className={
                  b.isFinal
                    ? `${profit >= 0 ? 'fill-emerald-700' : 'fill-red-700'} font-semibold`
                    : 'fill-slate-500'
                }
              >
                {b.label}
              </text>
              {/* Top value label */}
              {b.displayValue && (
                <text
                  x={x + barW / 2}
                  y={barY - 5}
                  textAnchor="middle"
                  style={{ fontSize: b.isFinal ? 10 : 9 }}
                  className={
                    b.isFinal
                      ? `${profit >= 0 ? 'fill-emerald-700' : 'fill-red-700'} font-semibold`
                      : 'fill-slate-600 font-medium'
                  }
                >
                  {b.displayValue}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
