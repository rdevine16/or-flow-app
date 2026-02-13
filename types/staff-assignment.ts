// types/staff-assignment.ts
// Types for the drag-and-drop staff assignment feature

export interface StaffMember {
  id: string
  first_name: string
  last_name: string
  email: string
  profile_image_url: string | null
  role_id: string
  facility_id: string
  user_roles?: {
    name: string
  }
}

export interface CaseStaffAssignment {
  id: string
  case_id: string
  user_id: string
  role_id: string
  created_at: string
  removed_at: string | null
  removed_by: string | null
  // Joined data
  user?: {
    id: string
    first_name: string
    last_name: string
    profile_image_url: string | null
  }
  user_roles?: {
    name: string
  }
}

// For the staff panel
export type StaffRoleFilter = 'all' | 'nurse' | 'tech' | 'anesthesiologist'

// Drag-and-drop related types
export interface DragData {
  type: 'staff-avatar'
  staffId: string
  staff: StaffMember
  sourceType: 'panel' | 'case'
  sourceCaseId?: string // If dragging from an existing case assignment
}

export interface DropData {
  type: 'case-row'
  caseId: string
  caseNumber: string
}

// Helper to get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Helper to get full display name
export function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}

