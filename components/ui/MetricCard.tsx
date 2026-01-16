// components/ui/MetricCard.tsx
// Beautiful animated stat cards with count-up effect

'use client'

import { useEffect, useState, useRef } from 'react'

interface MetricCardProps {
  title: string
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  trend?: number
  trendLabel?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function MetricCard({ 
  title, 
  value, 
  suffix = '', 
  prefix = '',
  decimals = 0,
  trend,
  trendLabel = 'vs last month',
  color = 'blue',
  size = 'md',
  loading = false,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Animated count-up effect with intersection observer
  useEffect(() => {
    if (loading || hasAnimated) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true)
            animateValue()
          }
        })
      },
      { threshold: 0.1 }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [loading, hasAnimated, value])

  const animateValue = () => {
    const duration = 1200
    const steps = 60
    const increment = value / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      // Ease out cubic
      const progress = 1 - Math.pow(1 - step / steps, 3)
      current = value * progress
      
      if (step >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      } else {
        setDisplayValue(current)
      }
    }, duration / steps)
  }

  const colorClasses = {
    blue: {
      gradient: 'from-blue-500 to-blue-600',
      light: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    green: {
      gradient: 'from-emerald-500 to-emerald-600',
      light: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    amber: {
      gradient: 'from-amber-500 to-amber-600',
      light: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    red: {
      gradient: 'from-red-500 to-red-600',
      light: 'text-red-600',
      bg: 'bg-red-50',
    },
    slate: {
      gradient: 'from-slate-600 to-slate-700',
      light: 'text-slate-600',
      bg: 'bg-slate-50',
    },
  }

  const sizeClasses = {
    sm: {
      padding: 'p-4',
      title: 'text-xs',
      value: 'text-2xl',
      trend: 'text-xs',
    },
    md: {
      padding: 'p-6',
      title: 'text-sm',
      value: 'text-3xl',
      trend: 'text-sm',
    },
    lg: {
      padding: 'p-8',
      title: 'text-base',
      value: 'text-4xl',
      trend: 'text-sm',
    },
  }

  const formatValue = (val: number) => {
    if (decimals > 0) {
      return val.toFixed(decimals)
    }
    return Math.round(val).toLocaleString()
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${sizeClasses[size].padding}`}>
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
          <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={cardRef}
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${sizeClasses[size].padding} hover:shadow-md hover:border-slate-200 transition-all duration-300 group`}
    >
      <p className={`${sizeClasses[size].title} font-medium text-slate-500 mb-1`}>{title}</p>
      <div className="flex items-baseline gap-1">
        <span className={`${sizeClasses[size].value} font-bold bg-gradient-to-r ${colorClasses[color].gradient} bg-clip-text text-transparent`}>
          {prefix}{formatValue(displayValue)}{suffix}
        </span>
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${sizeClasses[size].trend} font-medium ${
            trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {trend >= 0 ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(trend)}%
          </span>
          <span className="text-xs text-slate-400">{trendLabel}</span>
        </div>
      )}
    </div>
  )
}

// Compact version for dense layouts
export function MetricCardCompact({ 
  title, 
  value, 
  suffix = '',
  prefix = '',
  color = 'blue',
}: Omit<MetricCardProps, 'trend' | 'trendLabel' | 'size'>) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-slate-600',
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{title}</span>
      <span className={`text-lg font-bold ${colorClasses[color]}`}>
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </span>
    </div>
  )
}

// Grid wrapper for metric cards
export function MetricCardGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: 2 | 3 | 4 }) {
  const colClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${colClasses[columns]} gap-4`}>
      {children}
    </div>
  )
}
