interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ReactNode
  color?: 'default' | 'teal' | 'amber' | 'emerald' | 'rose'
}

const colorClasses = {
  default: 'bg-white',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
  rose: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white',
}

export default function MetricCard({ title, value, subtitle, trend, icon, color = 'default' }: MetricCardProps) {
  const isColored = color !== 'default'

  return (
    <div className={`rounded-xl border ${isColored ? 'border-transparent shadow-lg' : 'border-slate-200'} p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-sm font-medium ${isColored ? 'text-white/80' : 'text-slate-500'}`}>{title}</p>
        {icon && (
          <div className={`p-2 rounded-lg ${isColored ? 'bg-white/20' : 'bg-slate-100'}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold ${isColored ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span className={`inline-flex items-center text-sm font-medium ${
              trend.isPositive 
                ? isColored ? 'text-white/90' : 'text-emerald-600'
                : isColored ? 'text-white/90' : 'text-rose-600'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && (
            <span className={`text-sm ${isColored ? 'text-white/70' : 'text-slate-400'}`}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}