// ScanProgress — inline progress bar with gradient track and step labels
import { Check } from 'lucide-react'

const SCAN_STEPS = [
  'Expire old',
  'Load cases',
  'Impossible values',
  'Negative durations',
  'Sequences',
  'Missing milestones',
  'Finalize',
]

interface ScanProgressProps {
  step: number
  totalSteps?: number
}

export default function ScanProgress({ step, totalSteps = 7 }: ScanProgressProps) {
  const pct = (step / totalSteps) * 100

  return (
    <div
      data-testid="scan-progress"
      className="bg-white border border-slate-200 rounded-xl p-5 mb-5 animate-in slide-in-from-top-2 duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900">Running detection scan...</span>
        <span className="text-xs text-slate-500 font-mono">{step}/{totalSteps}</span>
      </div>

      {/* Gradient progress bar */}
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-400 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
          }}
        />
      </div>

      {/* Step labels */}
      <div className="flex flex-wrap gap-2 mt-3">
        {SCAN_STEPS.map((label, i) => {
          const stepNum = i + 1
          const completed = step > stepNum
          const active = step === stepNum

          return (
            <span
              key={label}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-all duration-300 ${
                completed
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : active
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-slate-50 text-slate-400 border border-slate-100'
              }`}
            >
              {completed && <Check className="w-3 h-3" />}
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
