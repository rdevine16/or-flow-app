// components/dashboard/StaffDragOverlay.tsx
// Ghost avatar that follows the cursor during drag operations

'use client'

import { DragOverlay } from '@dnd-kit/core'
import { DragData } from '@/types/staff-assignment'
import { DraggableStaffAvatarDisplay } from '../ui/StaffAvatar'

interface StaffDragOverlayProps {
  activeData: DragData | null
}

export default function StaffDragOverlay({ activeData }: StaffDragOverlayProps) {
  if (!activeData || activeData.type !== 'staff-avatar') {
    return null
  }
  
  const staff = activeData.staff
  
  return (
    <DragOverlay dropAnimation={{
      duration: 200,
      easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)'
    }}>
      <div className="cursor-grabbing">
        <DraggableStaffAvatarDisplay
          firstName={staff.first_name}
          lastName={staff.last_name}
          profileImageUrl={staff.profile_image_url}
          roleName={staff.user_roles?.name}
          isDragging={true}
        />
      </div>
    </DragOverlay>
  )
}