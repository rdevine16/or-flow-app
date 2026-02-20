// Phase duration pill showing phase name + duration
// Color maps to phase_group from facility_milestones

import type { PhasePillColor } from '../types'

interface PhasePillProps {
  label: string
  minutes: number | null
  color: PhasePillColor
}

const colorStyles: Record<PhasePillColor, { ring: string; dot: string }> = {
  blue: { ring: 'bg-blue-50 text-blue-700 ring-blue-200/60', dot: 'bg-blue-500' },
  green: { ring: 'bg-green-50 text-green-600 ring-green-200/60', dot: 'bg-green-500' },
  amber: { ring: 'bg-amber-50 text-amber-700 ring-amber-200/60', dot: 'bg-amber-500' },
  violet: { ring: 'bg-violet-50 text-violet-700 ring-violet-200/60', dot: 'bg-violet-500' },
}

export function PhasePill({ label, minutes, color }: PhasePillProps) {
  if (minutes === null) return null

  const styles = colorStyles[color]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ring-1 ${styles.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {label} {minutes}m
    </span>
  )
}
