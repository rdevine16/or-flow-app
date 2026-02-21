// QualityGauge — half-circle SVG arc gauge (Phase 2)
// Placeholder: will be implemented in Phase 2

interface QualityGaugeProps {
  score: number
}

export default function QualityGauge({ score }: QualityGaugeProps) {
  return (
    <div className="flex items-center justify-center h-24">
      <span className="text-3xl font-bold text-slate-900">{score}%</span>
    </div>
  )
}
