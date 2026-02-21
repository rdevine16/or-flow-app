'use client'

import Link from 'next/link'

export interface RecentCaseRow {
  id: string
  caseNumber: string
  surgeonName: string
  procedureName: string
  roomName: string
  time: string
  status: string
  flagCount: number
}

interface RecentCasesTableProps {
  cases: RecentCaseRow[]
  onCaseClick?: (caseId: string) => void
}

export default function RecentCasesTable({ cases, onCaseClick }: RecentCasesTableProps) {
  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <p className="text-sm">No recent cases</p>
      </div>
    )
  }

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Case</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Surgeon</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Procedure</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Room</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Time</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Flags</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => (
            <tr
              key={c.id}
              onClick={() => onCaseClick?.(c.id)}
              className={`hover:bg-slate-50 transition-colors cursor-pointer ${i < cases.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              <td className="px-5 py-2.5 font-semibold text-blue-500 font-mono text-xs">{c.caseNumber}</td>
              <td className="px-3 py-2.5 text-slate-700 font-medium">{c.surgeonName}</td>
              <td className="px-3 py-2.5 text-slate-500">{c.procedureName}</td>
              <td className="px-3 py-2.5 text-slate-500">{c.roomName}</td>
              <td className="px-3 py-2.5 text-right text-slate-700 font-mono text-xs">{c.time}</td>
              <td className="px-3 py-2.5 text-center">
                <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full capitalize">
                  {c.status}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right">
                {c.flagCount > 0 && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    c.flagCount >= 5
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-slate-500 bg-slate-100'
                  }`}>
                    {c.flagCount} flags
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-2 border-t border-slate-100">
        <Link
          href="/cases"
          className="text-xs font-medium text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
        >
          All cases &rarr;
        </Link>
      </div>
    </div>
  )
}
