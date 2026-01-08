interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ReactNode
  color?: 'default' | 'blue' | 'amber' | 'emerald' | 'rose'
}

const colorClasses = {
  default: 'bg-white border-slate-200',
  blue: 'bg-blue-600 border-blue-600 text-white',
  amber: 'bg-amber-500 border-amber-500 text-white',
  emerald: 'bg-emerald-600 border-emerald-600 text-white',
  rose: 'bg-rose-600 border-rose-600 text-white',
}

export default function MetricCard({ title, value, subtitle, trend, icon, color = 'default' }: MetricCardProps) {
  const isColored = color !== 'default'

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-medium uppercase tracking-wider ${isColored ? 'text-white/70' : 'text-slate-500'}`}>
          {title}
        </p>
        {icon && (
          <div className={`p-1.5 rounded ${isColored ? 'bg-white/20' : 'bg-slate-100'}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-2xl font-semibold ${isColored ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={`text-xs font-medium ${
              trend.isPositive 
                ? isColored ? 'text-white/80' : 'text-emerald-600'
                : isColored ? 'text-white/80' : 'text-rose-600'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && (
            <span className={`text-xs ${isColored ? 'text-white/60' : 'text-slate-400'}`}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}