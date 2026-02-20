// Sortable table header cell
// Shows active sort direction with chevron icon

import type { SortDir } from '../types'

interface SortTHProps {
  label: string
  sortKey: string
  current: string
  dir: SortDir
  onClick: (key: string) => void
  align?: 'left' | 'center' | 'right'
}

export function SortTH({ label, sortKey, current, dir, onClick, align = 'right' }: SortTHProps) {
  const active = current === sortKey
  const alignClass =
    align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right'

  return (
    <th
      className={`px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors ${alignClass} ${
        active ? 'text-slate-700' : 'text-slate-400'
      }`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && (
          dir === 'desc' ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          )
        )}
      </span>
    </th>
  )
}
