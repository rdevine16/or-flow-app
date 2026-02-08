// components/ui/CardEnhanced.tsx
// Enterprise-grade card component with headers, footers, and variants
// Replaces basic Card.tsx with full-featured version

import React, { ReactNode, forwardRef } from 'react'
import { tokens } from '@/lib/design-tokens'

/**
 * USAGE:
 * 
 * Basic card:
 *   <Card>
 *     <p>Content here</p>
 *   </Card>
 * 
 * Card with header:
 *   <Card>
 *     <Card.Header>
 *       <Card.Title>Case Details</Card.Title>
 *       <Card.Actions>
 *         <button>Edit</button>
 *       </Card.Actions>
 *     </Card.Header>
 *     <Card.Content>
 *       <p>Body content</p>
 *     </Card.Content>
 *   </Card>
 * 
 * Interactive card (clickable):
 *   <Card 
 *     variant="interactive"
 *     onClick={() => router.push('/case/123')}
 *   >
 *     <Card.Content>Click me</Card.Content>
 *   </Card>
 * 
 * Card with footer:
 *   <Card>
 *     <Card.Content>...</Card.Content>
 *     <Card.Footer>
 *       <Button>Save</Button>
 *     </Card.Footer>
 *   </Card>
 * 
 * Elevated card:
 *   <Card variant="elevated">
 *     <Card.Content>Stands out from background</Card.Content>
 *   </Card>
 * 
 * Loading state:
 *   <Card loading={true}>
 *     <Card.Content>...</Card.Content>
 *   </Card>
 */

// ============================================
// TYPES
// ============================================

export type CardVariant = 'default' | 'outlined' | 'elevated' | 'interactive'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: CardVariant
  padding?: CardPadding
  loading?: boolean
  onClick?: () => void
  'aria-label'?: string
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
}

interface CardActionsProps {
  children: ReactNode
  className?: string
}

interface CardContentProps {
  children: ReactNode
  className?: string
  padding?: CardPadding
}

interface CardFooterProps {
  children: ReactNode
  className?: string
  border?: boolean
}

// Compound component interface
interface CardComponent extends React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>> {
  Header: typeof CardHeader
  Title: typeof CardTitle
  Description: typeof CardDescription
  Actions: typeof CardActions
  Content: typeof CardContent
  Footer: typeof CardFooter
}

// ============================================
// VARIANT CONFIGS
// ============================================

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white border border-slate-200 shadow-sm',
  outlined: 'bg-white border border-slate-300',
  elevated: 'bg-white border border-slate-200 shadow-lg',
  interactive: 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 active:scale-[0.99]',
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

// ============================================
// MAIN CARD COMPONENT
// ============================================

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = '',
      variant = 'default',
      padding = 'md',
      loading = false,
      onClick,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const Component = onClick ? 'button' : 'div'

    return (
      <Component
        ref={ref as any}
        onClick={onClick}
        aria-label={ariaLabel}
        className={`
          relative rounded-xl overflow-hidden
          ${variantClasses[variant]}
          ${paddingClasses[padding]}
          ${className}
        `}
      >
        {loading && <CardLoadingOverlay />}
        {children}
      </Component>
    )
  }
)
Card.displayName = 'Card'

// ============================================
// CARD HEADER
// ============================================

function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>
      {children}
    </h3>
  )
}

function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-slate-500 mt-1 ${className}`}>
      {children}
    </p>
  )
}

function CardActions({ children, className = '' }: CardActionsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// CARD CONTENT
// ============================================

function CardContent({ children, className = '', padding = 'md' }: CardContentProps) {
  return (
    <div className={`${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// CARD FOOTER
// ============================================

function CardFooter({ children, className = '', border = true }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 ${border ? 'border-t border-slate-200' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ============================================
// LOADING OVERLAY
// ============================================

function CardLoadingOverlay() {
  return (
    <div
      className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-2">
        <svg
          className="animate-spin h-8 w-8 text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm text-slate-600 font-medium">Loading...</span>
      </div>
    </div>
  )
}

// ============================================
// ATTACH SUBCOMPONENTS
// ============================================

// Cast Card to CardComponent type and attach subcomponents
const CardWithSubcomponents = Card as unknown as CardComponent
CardWithSubcomponents.Header = CardHeader
CardWithSubcomponents.Title = CardTitle
CardWithSubcomponents.Description = CardDescription
CardWithSubcomponents.Actions = CardActions
CardWithSubcomponents.Content = CardContent
CardWithSubcomponents.Footer = CardFooter

// Local alias for use in specialized variants below
const CardComp = CardWithSubcomponents

// Export as Card
export { CardWithSubcomponents as Card }

// ============================================
// SPECIALIZED CARD VARIANTS
// ============================================

/**
 * Stats Card - for KPI displays
 */
interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: string
    trend: 'up' | 'down' | 'neutral'
  }
  icon?: ReactNode
  loading?: boolean
}

export function StatsCard({ title, value, change, icon, loading }: StatsCardProps) {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-slate-600',
  }

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  }

  return (
    <CardComp variant="default" loading={loading}>
      <CardComp.Content>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mb-2">{value}</p>
            {change && (
              <p className={`text-sm font-medium ${trendColors[change.trend]}`}>
                <span>{trendIcons[change.trend]}</span> {change.value}
              </p>
            )}
          </div>
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              {icon}
            </div>
          )}
        </div>
      </CardComp.Content>
    </CardComp>
  )
}

/**
 * List Card - for displaying lists with headers
 */
interface ListCardProps {
  title: string
  items: ReactNode[]
  emptyMessage?: string
  actions?: ReactNode
}

export function ListCard({ title, items, emptyMessage = 'No items', actions }: ListCardProps) {
  return (
    <CardComp variant="default">
      <CardComp.Header>
        <div className="flex items-center justify-between">
          <CardComp.Title>{title}</CardComp.Title>
          {actions && <CardComp.Actions>{actions}</CardComp.Actions>}
        </div>
      </CardComp.Header>
      <CardComp.Content padding="none">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <div key={index} className="px-6 py-3">
                {item}
              </div>
            ))}
          </div>
        )}
      </CardComp.Content>
    </CardComp>
  )
}

/**
 * Profile Card - for user/surgeon profiles
 */
interface ProfileCardProps {
  name: string
  role: string
  avatar?: ReactNode
  stats?: Array<{ label: string; value: string }>
  actions?: ReactNode
}

export function ProfileCard({ name, role, avatar, stats, actions }: ProfileCardProps) {
  return (
    <CardComp variant="default">
      <CardComp.Content>
        <div className="flex items-start gap-4">
          {avatar && <div className="flex-shrink-0">{avatar}</div>}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 truncate">{name}</h4>
            <p className="text-sm text-slate-500">{role}</p>
            {stats && stats.length > 0 && (
              <div className="mt-3 flex gap-4">
                {stats.map((stat, index) => (
                  <div key={index}>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardComp.Content>
      {actions && (
        <CardComp.Footer border={false}>
          {actions}
        </CardComp.Footer>
      )}
    </CardComp>
  )
}

export default CardWithSubcomponents