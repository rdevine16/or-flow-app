// Sparkline variant for dark backgrounds (e.g., surgeon hero)
// White stroke with reduced opacity

interface SparklineLightProps {
  data: number[]
  width?: number
  height?: number
}

export function SparklineLight({ data, width = 44, height = 16 }: SparklineLightProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ')

  const lastY = height - ((data[data.length - 1] - min) / range) * height

  return (
    <svg width={width} height={height} className="shrink-0 opacity-40">
      <polyline
        points={points}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r="2" fill="white" />
    </svg>
  )
}
