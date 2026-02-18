// components/ui/ScoreRing.tsx
// Extracted SVG ring gauge for displaying ORbit Scores.
// Used on orbit-score page, FacilityScoreMini dashboard card, and anywhere a score ring is needed.

import { getGrade } from '@/lib/orbitScoreEngine'

interface ScoreRingProps {
  score: number
  size?: number
  ringWidth?: number
}

export function ScoreRing({
  score,
  size = 100,
  ringWidth = 8,
}: ScoreRingProps) {
  const center = size / 2
  const radius = (size - ringWidth) / 2 - 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const grade = getGrade(score)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={grade.text} strokeOpacity={0.12}
        strokeWidth={ringWidth}
      />
      {/* Filled arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={grade.text}
        strokeWidth={ringWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference * 0.25}
        className="transition-all duration-700 ease-out"
      />
      {/* Score text */}
      <text
        x={center} y={center}
        textAnchor="middle" dominantBaseline="central"
        fill={grade.text}
        fontSize={size * 0.3}
        fontWeight="800"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {score}
      </text>
    </svg>
  )
}
