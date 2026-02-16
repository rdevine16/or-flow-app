// components/cases/MilestoneComparisonToggle.tsx
// Segmented control to toggle milestone comparison between surgeon and facility medians.

'use client'

interface MilestoneComparisonToggleProps {
  comparisonSource: 'surgeon' | 'facility'
  onSourceChange: (source: 'surgeon' | 'facility') => void
  surgeonCaseCount: number
  facilityCaseCount: number
}

const OPTIONS: { key: 'surgeon' | 'facility'; label: string }[] = [
  { key: 'surgeon', label: 'Surgeon Median' },
  { key: 'facility', label: 'Facility Median' },
]

export default function MilestoneComparisonToggle({
  comparisonSource,
  onSourceChange,
  surgeonCaseCount,
  facilityCaseCount,
}: MilestoneComparisonToggleProps) {
  const counts: Record<string, number> = {
    surgeon: surgeonCaseCount,
    facility: facilityCaseCount,
  }

  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Comparison benchmark">
      {OPTIONS.map((opt) => {
        const isActive = comparisonSource === opt.key
        const count = counts[opt.key]

        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={isActive}
            onClick={() => onSourceChange(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
            {count > 0 && (
              <span className="ml-1 text-[10px] text-slate-400">({count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
