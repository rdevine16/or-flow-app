// components/ui/PhaseBadge.tsx
// Badge showing current surgical phase (In Surgery, Closing, etc.)

'use client'

import { CasePhase } from '@/types/pace'

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
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
      </svg>
    ),
    bgColor: 'bg-blue-500',
    shadowColor: 'shadow-blue-500/40'
  },
  'In Anesthesia': {
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
    bgColor: 'bg-amber-500',
    shadowColor: 'shadow-amber-500/40'
  },
  'Prepping': {
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
    bgColor: 'bg-purple-500',
    shadowColor: 'shadow-purple-500/40'
  },
  'In Surgery': {
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
    ),
    bgColor: 'bg-emerald-500',
    shadowColor: 'shadow-emerald-500/40'
  },
  'Closing': {
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
    bgColor: 'bg-yellow-500',
    shadowColor: 'shadow-yellow-500/40'
  },
  'Complete': {
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
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
