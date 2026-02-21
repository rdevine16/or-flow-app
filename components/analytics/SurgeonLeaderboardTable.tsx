'use client'

import Link from 'next/link'
import type { SurgeonLeaderboardEntry } from '@/lib/analyticsV2'

interface SurgeonLeaderboardTableProps {
  data: SurgeonLeaderboardEntry[]
}

function ScoreBadge({ value }: { value: number }) {
  const classes = value >= 85
    ? 'text-green-600 bg-green-50'
    : value >= 70
      ? 'text-blue-600 bg-blue-50'
      : value >= 55
        ? 'text-amber-700 bg-amber-50'
        : 'text-red-600 bg-red-50'

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono ${classes}`}>
      {value}
    </span>
  )
}

export default function SurgeonLeaderboardTable({ data }: SurgeonLeaderboardTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p className="text-sm">No surgeon data available</p>
      </div>
    )
  }

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-5 py-2 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Surgeon</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cases</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Time</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">FCOTS</th>
            <th className="px-5 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => (
            <tr
              key={s.surgeonId}
              className={`hover:bg-slate-50 transition-colors cursor-pointer ${i < data.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                    {s.surgeonName.replace('Dr. ', '').charAt(0)}
                  </div>
                  <span className="font-medium text-slate-900">{s.surgeonName}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-slate-900 font-mono">{s.caseCount}</td>
              <td className="px-3 py-2.5 text-right text-slate-500">{s.avgSurgicalTimeDisplay}</td>
              <td className="px-3 py-2.5 text-right text-slate-500">{s.fcotsRate}%</td>
              <td className="px-5 py-2.5 text-right">
                <ScoreBadge value={s.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-2 border-t border-slate-100">
        <Link
          href="/analytics/surgeons"
          className="text-xs font-medium text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
        >
          All surgeons &rarr;
        </Link>
      </div>
    </div>
  )
}
