'use client'

// ============================================
// Types
// ============================================

interface BarItem {
  name: string
  count: number
  pct: number
  severity?: 'info' | 'warning' | 'critical'
  color?: string
  avgDuration?: number | null
}

interface HorizontalBarListProps {
  items: BarItem[]
  /** Override the max count used for bar width calculation */
  maxCount?: number
}

// ============================================
// Severity dot color mapping
// ============================================

const SEVERITY_DOT_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: 'bg-red-500/75',
  warning: 'bg-amber-500/75',
  info: 'bg-blue-500/75',
}

// ============================================
// HorizontalBarList
// ============================================

export default function HorizontalBarList({ items, maxCount }: HorizontalBarListProps) {
  const max = maxCount ?? Math.max(...items.map((i) => i.count), 1)

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.name}>
          {/* Label row: dot + name + count + pct */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {/* Severity dot or color dot */}
              {item.severity && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT_COLORS[item.severity] ?? 'bg-blue-500'}`}
                />
              )}
              {!item.severity && item.color && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="text-xs font-medium text-slate-900 truncate">
                {item.name}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-3">
              {/* Average duration (delay types only) */}
              {item.avgDuration != null && (
                <span className="text-[11px] text-slate-400 font-mono">
                  ~{item.avgDuration}m
                </span>
              )}
              {/* Count */}
              <span className="text-[13px] font-bold text-slate-900 font-mono w-7 text-right">
                {item.count}
              </span>
              {/* Percentage */}
              <span className="text-[11px] text-slate-400 w-9 text-right">
                {item.pct.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                item.severity
                  ? SEVERITY_BAR_COLORS[item.severity] ?? 'bg-sky-500/75'
                  : 'bg-sky-500/75'
              }`}
              style={{
                width: `${(item.count / max) * 100}%`,
                ...(item.color && !item.severity
                  ? { backgroundColor: `${item.color}bf` }
                  : {}),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
