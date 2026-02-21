// QualityGauge — half-circle SVG arc gauge with animated progress
// Color-coded: green >= 90, amber >= 70, red < 70

interface QualityGaugeProps {
  score: number
  size?: number
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#059669' // green-600
  if (score >= 70) return '#D97706' // amber-600
  return '#DC2626' // red-600
}

export default function QualityGauge({ score, size = 130 }: QualityGaugeProps) {
  const radius = (size - 12) / 2
  const circumference = Math.PI * radius // half circle
  const progress = (score / 100) * circumference
  const color = getScoreColor(score)

  return (
    <div
      className="relative"
      style={{ width: size, height: size / 2 + 20 }}
      data-testid="quality-gauge"
    >
      <svg
        width={size}
        height={size / 2 + 6}
        viewBox={`0 0 ${size} ${size / 2 + 6}`}
        aria-label={`Quality score: ${score}%`}
        role="img"
      >
        {/* Track (background arc) */}
        <path
          d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke="#F0EEEC"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 6 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - progress}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      {/* Score label */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span
          className="font-mono font-bold leading-none"
          style={{ fontSize: size * 0.3, color }}
        >
          {score}
        </span>
        <span
          className="font-mono font-medium text-stone-500"
          style={{ fontSize: size * 0.14 }}
        >
          %
        </span>
      </div>
    </div>
  )
}
