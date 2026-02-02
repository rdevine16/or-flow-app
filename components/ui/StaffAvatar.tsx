// components/ui/StaffAvatar.tsx
// Reusable avatar component that shows profile image or initials
// Used in both the staff panel and on case assignments

'use client'

import { useState } from 'react'
import { getInitials, getRoleColor, getFullName } from '@/types/staff-assignment'

interface StaffAvatarProps {
  firstName: string
  lastName: string
  profileImageUrl?: string | null
  roleName?: string
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  isFaded?: boolean // For staff removed after case started
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
}

export default function StaffAvatar({
  firstName,
  lastName,
  profileImageUrl,
  roleName,
  size = 'md',
  showTooltip = true,
  isFaded = false,
  className = ''
}: StaffAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const initials = getInitials(firstName, lastName)
  const fullName = getFullName(firstName, lastName)
  const colors = getRoleColor(roleName)
  
  const showImage = profileImageUrl && !imageError
  
  return (
    <div className="relative group">
      <div
        className={`
          ${SIZE_CLASSES[size]}
          rounded-full
          flex items-center justify-center
          font-semibold
          border-2
          transition-all duration-200
          ${showImage ? 'border-white' : `${colors.bg} ${colors.text} ${colors.border}`}
          ${isFaded ? 'opacity-40' : 'opacity-100'}
          ${className}
        `}
        title={showTooltip ? `${fullName}${roleName ? ` (${roleName})` : ''}` : undefined}
      >
        {showImage ? (
          <img
            src={profileImageUrl}
            alt={fullName}
            className="w-full h-full rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          initials
        )}
      </div>
      
      {/* Tooltip on hover - positioned to the left to avoid overflow clipping */}
      {showTooltip && (
        <div className="
          absolute right-full top-1/2 -translate-y-1/2 mr-2
          px-2 py-1
          bg-slate-900 text-white text-xs font-medium
          rounded-md
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          pointer-events-none
          whitespace-nowrap
          z-[100]
        ">
          {fullName}
          {roleName && (
            <span className="text-slate-400 ml-1">· {roleName}</span>
          )}
          {isFaded && (
            <span className="text-amber-400 ml-1">· Removed</span>
          )}
          {/* Tooltip arrow */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900" />
        </div>
      )}
    </div>
  )
}

// Variant for draggable avatars in the staff panel
export function DraggableStaffAvatarDisplay({
  firstName,
  lastName,
  profileImageUrl,
  roleName,
  isDragging = false
}: StaffAvatarProps & { isDragging?: boolean }) {
  const [imageError, setImageError] = useState(false)
  const initials = getInitials(firstName, lastName)
  const colors = getRoleColor(roleName)
  
  const showImage = profileImageUrl && !imageError
  
  return (
    <div
      className={`
        w-11 h-11
        rounded-full
        flex items-center justify-center
        font-semibold text-sm
        border-2
        cursor-grab active:cursor-grabbing
        transition-all duration-200
        ${showImage ? 'border-white shadow-md' : `${colors.bg} ${colors.text} ${colors.border}`}
        ${isDragging 
          ? 'scale-110 shadow-lg ring-2 ring-blue-500 ring-offset-2' 
          : 'hover:scale-105 hover:shadow-md'
        }
      `}
    >
      {showImage ? (
        <img
          src={profileImageUrl}
          alt={`${firstName} ${lastName}`}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}

// Small avatar for case rows with remove button on hover
// NOTE: This version does NOT show individual tooltip - use with GroupedStaffTooltip wrapper
export function AssignedStaffAvatar({
  firstName,
  lastName,
  profileImageUrl,
  roleName,
  isFaded = false,
  onRemove,
  canRemove = true,
  showTooltip = true // Can be disabled when using grouped tooltip
}: StaffAvatarProps & { 
  onRemove?: () => void
  canRemove?: boolean 
}) {
  const [imageError, setImageError] = useState(false)
  const initials = getInitials(firstName, lastName)
  const fullName = getFullName(firstName, lastName)
  const colors = getRoleColor(roleName)
  
  const showImage = profileImageUrl && !imageError
  
  return (
    <div className="relative group/avatar">
      <div
        className={`
          w-9 h-9
          rounded-full
          flex items-center justify-center
          font-semibold text-xs
          border-2
          transition-all duration-200
          ${showImage ? 'border-white shadow-sm' : `${colors.bg} ${colors.text} ${colors.border}`}
          ${isFaded ? 'opacity-40' : 'opacity-100'}
        `}
      >
        {showImage ? (
          <img
            src={profileImageUrl}
            alt={fullName}
            className="w-full h-full rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          initials
        )}
      </div>
      
      {/* Remove button on hover */}
      {canRemove && onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="
            absolute -top-1 -right-1
            w-5 h-5
            bg-red-500 hover:bg-red-600
            text-white
            rounded-full
            flex items-center justify-center
            opacity-0 group-hover/avatar:opacity-100
            transition-opacity duration-150
            shadow-sm
            z-10
          "
          title={isFaded ? 'Remove permanently' : 'Remove from case'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Individual Tooltip - only shown when showTooltip is true (for "Up Next" case) */}
      {showTooltip && (
        <div className="
          absolute right-full top-1/2 -translate-y-1/2 mr-2
          px-2 py-1
          bg-slate-900 text-white text-xs font-medium
          rounded-md
          opacity-0 group-hover/avatar:opacity-100
          transition-opacity duration-150
          pointer-events-none
          whitespace-nowrap
          z-[100]
        ">
          {fullName}
          {roleName && <span className="text-slate-400 ml-1">· {roleName}</span>}
          {isFaded && <span className="text-amber-400 ml-1">· Was assigned</span>}
          <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900" />
        </div>
      )}
    </div>
  )
}

// Staff info type for grouped tooltip
interface StaffInfo {
  firstName: string
  lastName: string
  roleName?: string
  isFaded?: boolean
}

// Grouped tooltip that shows all staff names at once
// Use this wrapper around avatar groups for scheduled cases
export function GroupedStaffTooltip({ 
  staffList,
  children 
}: { 
  staffList: StaffInfo[]
  children: React.ReactNode 
}) {
  if (staffList.length === 0) return <>{children}</>
  
  return (
    <div className="relative group/grouped">
      {children}
      
      {/* Grouped tooltip showing all names */}
      <div className="
        absolute right-full top-1/2 -translate-y-1/2 mr-2
        px-3 py-2
        bg-slate-900 text-white text-xs font-medium
        rounded-lg
        opacity-0 group-hover/grouped:opacity-100
        transition-opacity duration-150
        pointer-events-none
        whitespace-nowrap
        z-[100]
        shadow-lg
      ">
        <div className="space-y-1">
          {staffList.map((staff, index) => {
            const fullName = getFullName(staff.firstName, staff.lastName)
            return (
              <div key={index} className="flex items-center gap-2">
                <span className={staff.isFaded ? 'text-slate-400 line-through' : ''}>
                  {fullName}
                </span>
                {staff.roleName && (
                  <span className="text-slate-400 text-[10px]">
                    {staff.roleName}
                  </span>
                )}
                {staff.isFaded && (
                  <span className="text-amber-400 text-[10px]">removed</span>
                )}
              </div>
            )
          })}
        </div>
        {/* Tooltip arrow */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900" />
      </div>
    </div>
  )
}