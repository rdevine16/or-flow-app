// components/dashboard/StaffAssignmentPanel.tsx
// Panel for staff assignment feature
// Shows search, role filters, and draggable staff avatars

'use client'

import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { StaffMember, StaffRoleFilter, DragData } from '@/types/staff-assignment'
import { DraggableStaffAvatarDisplay } from '../ui/StaffAvatar'

interface StaffAssignmentPanelProps {
  staff: StaffMember[]
  isVisible: boolean
  onToggle: () => void
  loading?: boolean
}

// Role filter options
const ROLE_FILTERS: { value: StaffRoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nurse', label: 'Nurses' },
  { value: 'tech', label: 'Techs' },
  { value: 'anesthesiologist', label: 'Anesthesia' }
]

export default function StaffAssignmentPanel({
  staff,
  isVisible,
  loading = false
}: StaffAssignmentPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>('all')
  
  // Filter staff based on search and role
  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      // Role filter - exclude surgeons (they're assigned at case creation)
      const roleName = member.user_roles?.name?.toLowerCase() || ''
      if (roleName === 'surgeon') return false
      
      if (roleFilter !== 'all' && roleName !== roleFilter) {
        return false
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
        return fullName.includes(query)
      }
      
      return true
    })
  }, [staff, searchQuery, roleFilter])
  
  if (!isVisible) return null
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
      {/* Header with search */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-900">Available Staff</span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
            {filteredStaff.length}
          </span>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-48 pl-9 pr-3 py-1.5
              text-sm
              border border-slate-200 rounded-lg
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
              transition-all duration-200
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-3">
        {/* Role Filter Chips */}
        <div className="flex items-center gap-2 mb-3">
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setRoleFilter(filter.value)}
              className={`
                px-3 py-1 text-xs font-medium rounded-full
                transition-all duration-200
                ${roleFilter === filter.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        {/* Staff Avatars Grid */}
        {loading ? (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-11 h-11 rounded-full bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            {searchQuery ? 'No staff match your search' : 'No staff available'}
          </p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {filteredStaff.map((member) => (
              <DraggableStaffAvatar key={member.id} staff={member} />
            ))}
          </div>
        )}
        
        {/* Help text */}
        <p className="text-xs text-slate-400 mt-3">
          Drag staff to a case to assign them. Drag between cases to reassign.
        </p>
      </div>
    </div>
  )
}

// Individual draggable staff avatar
function DraggableStaffAvatar({ staff }: { staff: StaffMember }) {
  const dragData: DragData = {
    type: 'staff-avatar',
    staffId: staff.id,
    staff: staff,
    sourceType: 'panel'
  }
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `panel-staff-${staff.id}`,
    data: dragData
  })
  
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : undefined
  } : undefined
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-50' : ''}
    >
      <DraggableStaffAvatarDisplay
        firstName={staff.first_name}
        lastName={staff.last_name}
        profileImageUrl={staff.profile_image_url}
        roleName={staff.user_roles?.name}
        isDragging={isDragging}
      />
    </div>
  )
}