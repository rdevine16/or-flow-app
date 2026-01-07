'use client'

interface ViewOption {
  id: string
  label: string
  icon: React.ReactNode
}

interface ViewToggleProps {
  options: ViewOption[]
  activeView: string
  onChange: (view: string) => void
}

export default function ViewToggle({ options, activeView, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center bg-slate-100 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeView === option.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}