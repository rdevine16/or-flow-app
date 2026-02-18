import type { DailyTrackerData } from '@/lib/analyticsV2'

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  showArea?: boolean
  strokeWidth?: number
  className?: string
}

/**
 * Extract numeric values from DailyTrackerData for sparkline rendering.
 */
export function dailyDataToSparkline(dailyData?: DailyTrackerData[]): number[] {
  if (!dailyData || dailyData.length === 0) return []
  return dailyData.map(d => d.numericValue)
}

/**
 * Pure SVG sparkline component. No external dependencies.
 * Renders a trend line with optional area fill and endpoint dot.
 */
export default function Sparkline({
  data,
  color = '#10b981',
  width = 120,
  height = 32,
  showArea = true,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="No data"
      />
    )
  }

  // Single data point: render a centered dot
  if (data.length === 1) {
    const cx = width / 2
    const cy = height / 2
    return (
      <svg
        width={width}
        height={height}
        className={className}
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Sparkline with 1 data point"
      >
        <circle
          cx={cx}
          cy={cy}
          r={2.5}
          fill="#fff"
          stroke={color}
          strokeWidth={1.5}
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }))

  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`

  const lastPt = pts[pts.length - 1]

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={`Sparkline trending from ${data[0]} to ${data[data.length - 1]}`}
    >
      {showArea && (
        <path d={area} fill={color} opacity={0.07} />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r={2.5}
        fill="#fff"
        stroke={color}
        strokeWidth={1.5}
      />
    </svg>
  )
}
