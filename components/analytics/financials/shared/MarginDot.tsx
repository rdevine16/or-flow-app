// Small colored dot + margin percentage
// Used inline in table cells

interface MarginDotProps {
  margin: number
}

export function MarginDot({ margin }: MarginDotProps) {
  const dotColor =
    margin >= 25 ? '#10b981' : margin >= 10 ? '#f59e0b' : '#ef4444'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      <span
        className={`text-sm font-medium tabular-nums ${
          margin < 0 ? 'text-red-600' : 'text-slate-700'
        }`}
      >
        {margin.toFixed(1)}%
      </span>
    </span>
  )
}
