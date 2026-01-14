// =====================================================
// DEVICE REPS & IMPLANT COMPANIES - TYPES
// =====================================================

// Implant Companies
export interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null // NULL = global
  created_by: string | null
  created_at: string
  updated_at: string
}

// Case Implant Companies (junction)
export interface CaseImplantCompany {
  id: string
  case_id: string
  implant_company_id: string
  created_at: string
  implant_companies?: ImplantCompany
}

// Device Rep Access
export interface FacilityDeviceRep {
  id: string
  facility_id: string
  user_id: string
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
}

// Device Rep Invite
export interface DeviceRepInvite {
  id: string
  facility_id: string
  email: string
  implant_company_id: string
  invited_by: string | null
  invite_token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// Surgeon Preference
export interface SurgeonPreference {
  id: string
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Surgeon Preference Company (junction)
export interface SurgeonPreferenceCompany {
  id: string
  surgeon_preference_id: string
  implant_company_id: string
  created_at: string
}

// Delay Type (with global support)
export interface DelayType {
  id: string
  name: string
  display_name: string
  facility_id: string | null // NULL = global
  display_order: number
  created_at: string
}

// =====================================================
// JOINED/EXPANDED TYPES
// =====================================================

// Implant Company with badge info
export interface ImplantCompanyWithScope extends ImplantCompany {
  isGlobal: boolean
}

// Device Rep with user and company info
export interface DeviceRepWithDetails extends FacilityDeviceRep {
  users: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    implant_companies: { name: string } | null
  }
}

// Surgeon Preference with procedure and companies
export interface SurgeonPreferenceWithDetails extends SurgeonPreference {
  procedure_types: { 
    id: string
    name: string 
  } | null
  surgeon_preference_companies: {
    implant_company_id: string
    implant_companies: { 
      id: string
      name: string 
    } | null
  }[]
}

// Pending Invite with facility and company info
export interface DeviceRepInviteWithDetails extends DeviceRepInvite {
  facilities: { 
    name: string
    address: string | null 
  } | null
  implant_companies: { name: string } | null
}

// =====================================================
// FORM / INPUT TYPES
// =====================================================

export interface CreateImplantCompanyInput {
  name: string
  facility_id?: string | null
}

export interface CreateSurgeonPreferenceInput {
  facility_id: string
  surgeon_id: string
  procedure_type_id: string
  name?: string
  implant_company_ids: string[]
}

export interface InviteDeviceRepInput {
  facility_id: string
  email: string
  implant_company_id: string
}

export interface DeviceRepSignupInput {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  implant_company_id: string
  invite_token: string
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface SurgeonPreferenceSelection {
  procedureTypeId: string
  implantCompanyIds: string[]
}

// =====================================================
// ACCESS LEVEL TYPE (extended)
// =====================================================

export type AccessLevel = 'global_admin' | 'facility_admin' | 'user' | 'device_rep'

// =====================================================
// NOTIFICATION TYPES FOR REPS
// =====================================================

export type RepNotificationType = 
  | 'case_created'     // New case with rep's company
  | 'case_time_changed' // Case time updated
  | 'case_cancelled'   // Case cancelled
  | 'company_removed'  // Rep's company removed from case

export interface RepNotification {
  id: string
  type: RepNotificationType
  facility_id: string
  facility_name: string
  case_id: string
  case_number: string
  procedure_name: string
  surgeon_name: string
  scheduled_date: string
  scheduled_time: string
  message: string
  created_at: string
  read: boolean
}
