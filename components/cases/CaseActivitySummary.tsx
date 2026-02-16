// components/cases/CaseActivitySummary.tsx
// Summary card showing milestone/implant/delay/flag counts for case sidebar

interface CaseActivitySummaryProps {
  completedMilestones: number
  totalMilestones: number
  implantsFilled: number
  implantTotal: number
  delayCount: number
  flagCount: number
}

export default function CaseActivitySummary({
  completedMilestones,
  totalMilestones,
  implantsFilled,
  implantTotal,
  delayCount,
  flagCount,
}: CaseActivitySummaryProps) {
  const rows = [
    {
      label: 'Milestones',
      value: `${completedMilestones}/${totalMilestones}`,
      colorClass: null,
    },
    {
      label: 'Implants',
      value: `${implantsFilled}/${implantTotal}`,
      colorClass: null,
    },
    {
      label: 'Delays',
      value: String(delayCount),
      colorClass: delayCount > 0 ? 'text-amber-600' : null,
    },
    {
      label: 'Flags',
      value: String(flagCount),
      colorClass: flagCount > 0 ? 'text-red-600' : null,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Case Activity</h3>
      </div>
      <div className="p-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-1">
            <span className="text-sm text-slate-500">{row.label}</span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                row.colorClass || 'text-slate-800'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
