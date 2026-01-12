// components/ui/StatusIndicator.tsx
// Room status indicator pill with glowing dot

'use client'

type Status = 'active' | 'upcoming' | 'empty'

interface StatusIndicatorProps {
  status: Status
}

const statusConfig: Record<Status, {
  label: string
  dotColor: string
  textColor: string
  bgColor: string
  glowColor: string
}> = {
  active: {
    label: 'ACTIVE',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    glowColor: 'shadow-emerald-500/50'
  },
  upcoming: {
    label: 'NEXT UP',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    glowColor: 'shadow-blue-500/50'
  },
  empty: {
    label: 'EMPTY',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-500',
    bgColor: 'bg-slate-100',
    glowColor: 'shadow-slate-400/50'
  }
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = statusConfig[status]
  
  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1.5
        ${config.bgColor}
        rounded-full
      `}
    >
      <span
        className={`
          w-2 h-2
          rounded-full
          ${config.dotColor}
          shadow-sm ${config.glowColor}
        `}
      />
      <span
        className={`
          text-[11px] font-bold tracking-wider
          ${config.textColor}
        `}
      >
        {config.label}
      </span>
    </div>
  )
}
