// components/cases/TeamMember.tsx
// Compact team member row with role badge and optional remove

'use client'

const roleColorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  purple: 'bg-purple-100 text-purple-700',
}

interface TeamMemberProps {
  name: string
  role: string
  color: 'blue' | 'amber' | 'emerald' | 'purple'
  onRemove?: () => void
}

export default function TeamMember({ name, role, color, onRemove }: TeamMemberProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleColorClasses[color] || roleColorClasses.purple}`}>
          {role}
        </span>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}