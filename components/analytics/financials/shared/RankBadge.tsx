// Numbered rank circle badge
// Gold (#1), Silver (#2), Bronze (#3), neutral for the rest

interface RankBadgeProps {
  rank: number
}

const podiumStyles = [
  'bg-amber-400 text-white',  // 1st - gold
  'bg-slate-400 text-white',  // 2nd - silver
  'bg-amber-700 text-white',  // 3rd - bronze
]

export function RankBadge({ rank }: RankBadgeProps) {
  const style = rank >= 1 && rank <= 3
    ? podiumStyles[rank - 1]
    : 'bg-slate-100 text-slate-500'

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 ${style}`}>
      {rank}
    </span>
  )
}
