// ============================================
// components/analytics/Tracker.tsx
// ============================================
// Custom tracker component - displays daily performance as color-coded bars
// Inspired by uptime monitoring visualizations
// ============================================

'use client'

import { useState } from 'react'

export type TrackerColor = 'emerald' | 'yellow' | 'red' | 'slate' | 'blue'

export interface TrackerDataPoint {
  date: string
  color: TrackerColor
  tooltip: string
}

interface TrackerProps {
  data: TrackerDataPoint[]
  className?: string
}

const colorMap: Record<TrackerColor, string> = {
  emerald: 'bg-emerald-500 hover:bg-emerald-400',
  yellow: 'bg-yellow-400 hover:bg-yellow-300',
  red: 'bg-red-500 hover:bg-red-400',
  slate: 'bg-slate-300 hover:bg-slate-200',
  blue: 'bg-blue-500 hover:bg-blue-400',
}

export function Tracker({ data, className = '' }: TrackerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-[3px] h-10">
        {data.map((point, index) => (
          <div
            key={index}
            className="relative flex-1 group"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Bar */}
            <div
              className={`
                h-full w-full rounded-sm cursor-pointer transition-all duration-150
                ${colorMap[point.color]}
              `}
            />
            
            {/* Tooltip */}
            {hoveredIndex === index && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                  {point.tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-slate-900" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Mini Tracker - Smaller version for compact cards
// ============================================

interface MiniTrackerProps {
  data: TrackerDataPoint[]
  className?: string
}

export function MiniTracker({ data, className = '' }: MiniTrackerProps) {
  return (
    <div className={`flex gap-[2px] h-6 ${className}`}>
      {data.slice(-20).map((point, index) => (
        <div
          key={index}
          className={`flex-1 rounded-sm ${colorMap[point.color].split(' ')[0]}`}
          title={point.tooltip}
        />
      ))}
    </div>
  )
}

export default Tracker