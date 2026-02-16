// components/settings/milestones/PairIndicator.tsx
'use client'

interface PairIndicatorProps {
  pairPosition: 'start' | 'end' | null
  pairedName: string | null
  pairedId: string | null
  onScrollToPair?: (id: string) => void
}

export function PairIndicator({ pairPosition, pairedName, pairedId, onScrollToPair }: PairIndicatorProps) {
  if (!pairPosition || !pairedName || !pairedId) {
    return <span className="text-slate-300">&mdash;</span>
  }

  const arrow = pairPosition === 'start' ? '\u2192' : '\u2190'

  return (
    <button
      onClick={() => onScrollToPair?.(pairedId)}
      className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
      title={`Scroll to ${pairedName}`}
    >
      <span className="font-mono text-xs text-slate-400">{arrow}</span>
      <span className="truncate max-w-[140px]">{pairedName}</span>
    </button>
  )
}
