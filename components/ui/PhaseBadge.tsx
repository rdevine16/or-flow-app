// components/ui/PhaseBadge.tsx
// Badge showing current surgical phase (In Surgery, Closing, etc.)

'use client'

import { CasePhase } from '@/types/pace'
import { CalendarCheck, Check, ClipboardList, Heart, Play, User } from 'lucide-react'

interface PhaseBadgeProps {
  phase: CasePhase
}

const phaseConfig: Record<CasePhase, { 
  icon: React.ReactNode
  bgColor: string
  shadowColor: string
}> = {
  'Patient In': {
    icon: (
      <User className="w-3 h-3" />
    ),
    bgColor: 'bg-blue-500',
    shadowColor: 'shadow-blue-500/40'
  },
  'In Anesthesia': {
    icon: (
      <Play className="w-3 h-3" />
    ),
    bgColor: 'bg-amber-500',
    shadowColor: 'shadow-amber-500/40'
  },
  'Prepping': {
    icon: (
      <ClipboardList className="w-3 h-3" />
    ),
    bgColor: 'bg-purple-500',
    shadowColor: 'shadow-purple-500/40'
  },
  'In Surgery': {
    icon: (
      <Heart className="w-3 h-3" />
    ),
    bgColor: 'bg-emerald-500',
    shadowColor: 'shadow-emerald-500/40'
  },
  'Closing': {
    icon: (
      <CalendarCheck className="w-3 h-3" />
    ),
    bgColor: 'bg-yellow-500',
    shadowColor: 'shadow-yellow-500/40'
  },
  'Complete': {
    icon: (
      <Check className="w-3 h-3" />
    ),
    bgColor: 'bg-slate-500',
    shadowColor: 'shadow-slate-500/40'
  }
}

export default function PhaseBadge({ phase }: PhaseBadgeProps) {
  const config = phaseConfig[phase]
  
  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        ${config.bgColor}
        text-white text-[10px] font-bold uppercase tracking-wide
        rounded-md
        shadow-md ${config.shadowColor}
      `}
    >
      {config.icon}
      <span>{phase}</span>
    </div>
  )
}
