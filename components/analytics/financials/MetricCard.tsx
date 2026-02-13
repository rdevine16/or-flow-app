'use client'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { value: number; positive: boolean }
  variant?: 'default' | 'success' | 'warning' | 'danger'
  onClick?: () => void
}

const variants = {
  default: 'bg-white border-slate-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
  danger: 'bg-red-50 border-red-200',
}

const textVariants = {
  default: 'text-slate-900',
  success: 'text-green-600',
  warning: 'text-amber-700',
  danger: 'text-red-600',
}

export default function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend,
  variant = 'default',
  onClick 
}: MetricCardProps) {
  return (
    <div 
      className={`rounded-xl border p-4 transition-all ${variants[variant]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-bold ${textVariants[variant]}`}>{value}</p>
        {trend && (
          <span className={`text-sm font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}
