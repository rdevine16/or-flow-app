'use client'

interface DateRangeSelectorProps {
  value: string
  onChange: (value: string, startDate: string, endDate: string) => void
}

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const today = new Date()
  
  const ranges = [
    { 
      id: 'mtd', 
      label: 'MTD',
      getRange: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start, end: today }
      }
    },
    { 
      id: 'qtd', 
      label: 'QTD',
      getRange: () => {
        const quarter = Math.floor(today.getMonth() / 3)
        const start = new Date(today.getFullYear(), quarter * 3, 1)
        return { start, end: today }
      }
    },
    { 
      id: 'ytd', 
      label: 'YTD',
      getRange: () => {
        const start = new Date(today.getFullYear(), 0, 1)
        return { start, end: today }
      }
    },
    { 
      id: 'last30', 
      label: 'Last 30 Days',
      getRange: () => {
        const start = new Date(today)
        start.setDate(start.getDate() - 30)
        return { start, end: today }
      }
    },
  ]

  const handleChange = (rangeId: string) => {
    const range = ranges.find(r => r.id === rangeId)
    if (range) {
      const { start, end } = range.getRange()
      onChange(
        rangeId, 
        start.toISOString().split('T')[0], 
        end.toISOString().split('T')[0]
      )
    }
  }

  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
      {ranges.map(range => (
        <button
          key={range.id}
          onClick={() => handleChange(range.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === range.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
