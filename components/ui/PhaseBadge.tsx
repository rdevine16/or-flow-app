// components/ui/PhaseBadge.tsx
// Badge showing current surgical phase (In Surgery, Closing, etc.)

'use client'

import { CasePhase } from '@/types/pace'
import { CalendarCheck, Check, ClipboardList, Heart, Play, User } from 'lucide-react'
import { phaseColors } from '@/lib/design-tokens'

interface PhaseBadgeProps {
  phase: CasePhase
}

const phaseIcons: Record<CasePhase, React.ReactNode> = {
  'Patient In': <User className="w-3 h-3" />,
  'In Anesthesia': <Play className="w-3 h-3" />,
  'Prepping': <ClipboardList className="w-3 h-3" />,
  'In Surgery': <Heart className="w-3 h-3" />,
  'Closing': <CalendarCheck className="w-3 h-3" />,
  'Complete': <Check className="w-3 h-3" />,
}

export default function PhaseBadge({ phase }: PhaseBadgeProps) {
  const colors = phaseColors[phase]

  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        ${colors.bg}
        text-white text-xs font-semibold uppercase tracking-wide
        rounded-md
        shadow-md ${colors.shadow}
      `}
    >
      {phaseIcons[phase]}
      <span>{phase}</span>
    </div>
  )
}
