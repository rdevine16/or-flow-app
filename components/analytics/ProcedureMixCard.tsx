'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ProcedureMixCardProps {
  data: Array<{ name: string; cases: number }>
  colors: string[]
}

interface TooltipPayload {
  name: string
  value: number
  fill?: string
}

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-lg">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
        <span className="text-xs text-slate-700">
          {item.name}: <span className="font-semibold">{item.value} cases</span>
        </span>
      </div>
    </div>
  )
}

export default function ProcedureMixCard({ data, colors }: ProcedureMixCardProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <p className="text-sm">No data available</p>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.cases, 0)

  return (
    <div className="flex flex-col items-center">
      {/* Donut chart */}
      <div className="relative w-[140px] h-[140px] shrink-0 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={64}
              dataKey="cases"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CategoryTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 font-mono">{total}</p>
            <p className="text-[10px] text-slate-400">total</p>
          </div>
        </div>
      </div>

      {/* Category breakdown with progress bars */}
      <div className="w-full space-y-2">
        {data.map((d, i) => {
          const pct = Math.round((d.cases / total) * 100)
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  <span className="text-xs text-slate-600 font-medium truncate">{d.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900 shrink-0 ml-2">
                  {d.cases}{' '}
                  <span className="font-normal text-slate-400 text-[10px]">({pct}%)</span>
                </span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden ml-[15px]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colors[i % colors.length],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
