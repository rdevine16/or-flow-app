// components/cases/TeamMember.tsx
// Compact team member row with colored avatar, name, and role badge

'use client'

import { getRoleColors } from '@/lib/design-tokens'

interface TeamMemberProps {
  name: string
  role: string
  roleName?: string
  onRemove?: () => void
}

function getInitials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TeamMember({ name, role, roleName, onRemove }: TeamMemberProps) {
  const colors = getRoleColors(roleName || role)
  const initials = getInitials(name)

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${colors.bg} ${colors.text}`}
        >
          {initials}
        </div>
        <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${colors.text}`}>
          {role}
        </span>
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
    </div>
  )
}
