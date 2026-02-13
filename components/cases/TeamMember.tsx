// components/cases/TeamMember.tsx
// Compact team member row with role badge and optional remove

'use client'

import { getRoleColors } from '@/lib/design-tokens'

interface TeamMemberProps {
  name: string
  role: string
  roleName?: string
  onRemove?: () => void
}

export default function TeamMember({ name, role, roleName, onRemove }: TeamMemberProps) {
  const colors = getRoleColors(roleName || role)
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {role}
        </span>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}