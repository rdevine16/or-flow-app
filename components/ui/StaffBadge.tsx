'use client'

interface StaffBadgeProps {
  name: string
  role: string
  onRemove?: () => void
}

export default function StaffBadge({ name, role, onRemove }: StaffBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
      <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
        {name.split(' ').map(n => n[0]).join('').toUpperCase()}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-900">{name}</div>
        <div className="text-xs text-slate-500">{role}</div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}