import { badgeVariants } from '@/lib/design-tokens'

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof badgeVariants
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded ${badgeVariants[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  )
}