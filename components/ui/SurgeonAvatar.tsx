// components/ui/SurgeonAvatar.tsx
// Surgeon avatar with gradient background and initials

'use client'

interface SurgeonAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

function getInitials(name: string): string {
  // Remove "Dr. " prefix if present
  const cleanName = name.replace(/^Dr\.\s*/i, '')
  const parts = cleanName.split(' ').filter(Boolean)
  
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return '?'
}

const sizeClasses = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base'
}

export default function SurgeonAvatar({ name, size = 'md' }: SurgeonAvatarProps) {
  const initials = getInitials(name)
  
  return (
    <div
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded-full
        bg-gradient-to-br from-blue-500 to-blue-700
        text-white font-bold
        shadow-md shadow-blue-500/30
        flex-shrink-0
      `}
    >
      {initials}
    </div>
  )
}
