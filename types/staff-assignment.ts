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

// Role colors for avatars
export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  surgeon: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300'
  },
  anesthesiologist: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300'
  },
  nurse: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-300'
  },
  tech: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300'
  },
  admin: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300'
  }
}

// Helper to get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Helper to get full display name
export function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}

// Helper to get role color config
export function getRoleColor(roleName: string | undefined): { bg: string; text: string; border: string } {
  if (!roleName) {
    return ROLE_COLORS.admin
  }
  return ROLE_COLORS[roleName.toLowerCase()] || ROLE_COLORS.admin
}