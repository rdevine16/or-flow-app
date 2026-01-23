// components/dashboard/PaceProgressBar.tsx
// Progress bar showing case progress with pace indicator
// UPDATED: Now uses median-based values and shows typical range

'use client'

import { useMemo } from 'react'
import { CasePaceData } from '../../types/pace'
import { useCurrentTime } from '../../hooks/useElapsedTime'
import {
  calculateProgress,
  calculatePaceMinutes,
  getPaceStatus,
  hasEnoughData,
  formatDuration,
  formatDurationRange,
  getPaceStatusColors
} from '../../lib/pace-utils'

interface PaceProgressBarProps {
  paceData: CasePaceData | null
}

export default function PaceProgressBar({ paceData }: PaceProgressBarProps) {
  const currentTime = useCurrentTime()
  
  const progressData = useMemo(() => {
    if (!paceData || !hasEnoughData(paceData)) {
      return null
    }
    
    const progress = calculateProgress(paceData)
    const paceMinutes = calculatePaceMinutes(paceData, currentTime)
    const status = getPaceStatus(paceData, currentTime)
    const colors = getPaceStatusColors(status)
    
    return {
      progress: Math.min(progress, 1), // Cap at 100%
      progressPercent: Math.round(progress * 100),
      paceMinutes,
      status,
      colors,
      expectedDuration: formatDuration(paceData.expectedTotalMinutes),
      durationRange: formatDurationRange(paceData.totalRangeLow, paceData.totalRangeHigh, true)
    }
  }, [paceData, currentTime])
  
  // Don't render if no data or not enough samples
  if (!progressData) {
    return null
  }
  
  const { progress, progressPercent, paceMinutes, status, colors, expectedDuration, durationRange } = progressData
  const absMinutes = Math.abs(Math.round(paceMinutes))
  
  // Determine pace text
  let paceText: string
  let PaceIcon: React.ReactNode
  
  switch (status) {
    case 'ahead':
      paceText = `${absMinutes}m ahead`
      PaceIcon = (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )
      break
    case 'onPace':
      paceText = 'On pace'
      PaceIcon = (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      )
      break
    case 'slightlyBehind':
    case 'behind':
      paceText = `${absMinutes}m behind`
      PaceIcon = (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
      break
  }
  
  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`
            absolute inset-y-0 left-0
            bg-gradient-to-r ${colors.gradient}
            rounded-full
            transition-all duration-500 ease-out
          `}
          style={{ width: `${Math.max(progress * 100, 2)}%` }}
        />
      </div>
      
      {/* Labels row */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400 font-medium">
          Expected {expectedDuration}
          {durationRange && (
            <span className="text-slate-300 ml-1">{durationRange}</span>
          )}
        </span>
        
        <div className={`flex items-center gap-1 ${colors.text} font-semibold`}>
          {PaceIcon}
          <span>{paceText}</span>
        </div>
      </div>
    </div>
  )
}