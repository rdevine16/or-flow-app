// components/cases/MilestoneComparisonToggle.tsx
// Segmented control to toggle milestone comparison between surgeon and facility medians.
// Shows n-count alongside labels and greys out facility option when n < 5.

'use client'

const N_COUNT_THRESHOLD = 5

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

  const facilityBelowThreshold = facilityCaseCount < N_COUNT_THRESHOLD

  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 gap-0.5" role="radiogroup" aria-label="Comparison benchmark">
      {OPTIONS.map((opt) => {
        const isActive = comparisonSource === opt.key
        const count = counts[opt.key]
        const isDisabled = opt.key === 'facility' && facilityBelowThreshold

        return (
          <div key={opt.key} className="relative group">
            <button
              role="radio"
              aria-checked={isActive}
              disabled={isDisabled}
              onClick={() => !isDisabled && onSourceChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
              {count > 0 && (
                <span className={`ml-1 text-[10px] ${
                  isDisabled ? 'text-slate-300' : 'text-slate-400'
                }`}>
                  (n={count})
                </span>
              )}
            </button>

            {/* Tooltip for below-threshold facility option */}
            {isDisabled && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg">
                Minimum {N_COUNT_THRESHOLD} cases recommended for reliable comparison
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
