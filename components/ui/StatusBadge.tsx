// components/ui/StatusBadge.tsx
// Consistent status badges throughout the app

'use client'

type StatusType = 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled' | 'active' | 'inactive' | 'pending'

interface StatusBadgeProps {
  status: StatusType | string
  size?: 'xs' | 'sm' | 'md'
  showDot?: boolean
  pulse?: boolean
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  scheduled: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Scheduled',
  },
  in_progress: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'In Progress',
  },
  completed: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Completed',
  },
  delayed: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Delayed',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
  active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Active',
  },
  inactive: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Inactive',
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
}

const sizeConfig = {
  xs: {
    padding: 'px-1.5 py-0.5',
    text: 'text-[10px]',
    dot: 'w-1.5 h-1.5',
    gap: 'gap-1',
  },
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
    gap: 'gap-1.5',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    dot: 'w-2 h-2',
    gap: 'gap-2',
  },
}

export function StatusBadge({ 
  status, 
  size = 'sm', 
  showDot = true,
  pulse = false,
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.scheduled
  const sizes = sizeConfig[size]

  return (
    <span 
      className={`inline-flex items-center ${sizes.gap} ${sizes.padding} ${config.bg} ${config.text} ${sizes.text} font-medium rounded-full`}
    >
      {showDot && (
        <span className={`${sizes.dot} ${config.dot} rounded-full ${pulse && status === 'in_progress' ? 'animate-pulse' : ''}`} />
      )}
      {config.label}
    </span>
  )
}

// Simple dot indicator (no text)
export function StatusDot({ 
  status, 
  size = 'sm',
  pulse = false,
}: { 
  status: StatusType | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pulse?: boolean
}) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.scheduled
  
  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <span 
      className={`${dotSizes[size]} ${config.dot} rounded-full inline-block ${
        pulse && (status === 'in_progress' || status === 'active') 
          ? 'animate-pulse' 
          : ''
      }`}
      title={config.label}
    />
  )
}

// Role badge
type RoleType = 'surgeon' | 'anesthesiologist' | 'nurse' | 'tech' | 'admin' | 'global_admin' | 'facility_admin' | 'user'

const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
  surgeon: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Surgeon',
  },
  anesthesiologist: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Anesthesiologist',
  },
  nurse: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    label: 'Nurse',
  },
  tech: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    label: 'Tech',
  },
  admin: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    label: 'Admin',
  },
  global_admin: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Global Admin',
  },
  facility_admin: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    label: 'Facility Admin',
  },
  user: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'Staff',
  },
}

export function RoleBadge({ role, size = 'sm' }: { role: RoleType | string; size?: 'xs' | 'sm' | 'md' }) {
  const config = roleConfig[role.toLowerCase()] || roleConfig.user
  const sizes = sizeConfig[size]

  return (
    <span 
      className={`inline-flex items-center ${sizes.padding} ${config.bg} ${config.text} ${sizes.text} font-medium rounded-full`}
    >
      {config.label}
    </span>
  )
}

// Priority badge for cases
type PriorityType = 'routine' | 'urgent' | 'emergency' | 'add_on'

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  routine: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'Routine',
  },
  urgent: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Urgent',
  },
  emergency: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Emergency',
  },
  add_on: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Add-On',
  },
}

export function PriorityBadge({ priority, size = 'sm' }: { priority: PriorityType | string; size?: 'xs' | 'sm' | 'md' }) {
  const config = priorityConfig[priority.toLowerCase()] || priorityConfig.routine
  const sizes = sizeConfig[size]

  return (
    <span 
      className={`inline-flex items-center ${sizes.padding} ${config.bg} ${config.text} ${sizes.text} font-medium rounded-full`}
    >
      {config.label}
    </span>
  )
}
