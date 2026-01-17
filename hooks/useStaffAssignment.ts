// hooks/useStaffAssignment.ts
// Custom hook for managing staff assignments via drag-and-drop

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'
import { StaffMember, CaseStaffAssignment } from '../types/staff-assignment'

interface UseStaffAssignmentProps {
  facilityId: string | null
  caseIds: string[]  // All case IDs on the current view
}

interface UseStaffAssignmentReturn {
  // Staff data
  facilityStaff: StaffMember[]
  staffLoading: boolean
  
  // Assignments by case
  assignmentsByCaseId: Record<string, CaseStaffAssignment[]>
  assignmentsLoading: boolean
  
  // Actions
  assignStaffToCase: (staffId: string, caseId: string, roleId: string) => Promise<boolean>
  removeStaffFromCase: (assignmentId: string, caseId: string, isInProgress: boolean) => Promise<boolean>
  permanentlyRemoveStaff: (assignmentId: string, caseId: string) => Promise<boolean>
  moveStaffBetweenCases: (staffId: string, fromCaseId: string, toCaseId: string, roleId: string) => Promise<boolean>
  
  // Refresh
  refreshAssignments: () => Promise<void>
}

export function useStaffAssignment({ 
  facilityId, 
  caseIds 
}: UseStaffAssignmentProps): UseStaffAssignmentReturn {
  const supabase = createClient()
  
  // State
  const [facilityStaff, setFacilityStaff] = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [assignmentsByCaseId, setAssignmentsByCaseId] = useState<Record<string, CaseStaffAssignment[]>>({})
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  
  // Fetch all staff for the facility
  const fetchStaff = useCallback(async () => {
    if (!facilityId) return
    
    setStaffLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          profile_image_url,
          role_id,
          facility_id,
          user_roles (name)
        `)
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('last_name')
      
      if (error) throw error
      setFacilityStaff((data as unknown as StaffMember[]) || [])
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setStaffLoading(false)
    }
  }, [facilityId, supabase])
  
  // Fetch assignments for all visible cases
  const fetchAssignments = useCallback(async () => {
    if (caseIds.length === 0) {
      setAssignmentsByCaseId({})
      setAssignmentsLoading(false)
      return
    }
    
    setAssignmentsLoading(true)
    try {
      const { data, error } = await supabase
        .from('case_staff')
        .select(`
          id,
          case_id,
          user_id,
          role_id,
          created_at,
          removed_at,
          removed_by,
          user:users!case_staff_user_id_fkey (
            id,
            first_name,
            last_name,
            profile_image_url
          ),
          user_roles (name)
        `)
        .in('case_id', caseIds)
        .order('created_at')
      
      if (error) throw error
      
      // Group assignments by case_id
      const grouped: Record<string, CaseStaffAssignment[]> = {}
      for (const assignment of (data || [])) {
        const caseId = assignment.case_id
        if (!grouped[caseId]) {
          grouped[caseId] = []
        }
        grouped[caseId].push(assignment as unknown as CaseStaffAssignment)
      }
      
      setAssignmentsByCaseId(grouped)
    } catch (error) {
      console.error('Error fetching assignments:', error)
    } finally {
      setAssignmentsLoading(false)
    }
  }, [caseIds, supabase])
  
  // Initial fetch
  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])
  
  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])
  
  // Assign staff to a case
  const assignStaffToCase = useCallback(async (
    staffId: string,
    caseId: string,
    roleId: string
  ): Promise<boolean> => {
    try {
      // Check if already assigned (including soft-deleted)
      const existing = assignmentsByCaseId[caseId]?.find(
        a => a.user_id === staffId && a.removed_at === null
      )
      
      if (existing) {
        console.log('Staff already assigned to this case')
        return false
      }
      
      // Check if there's a soft-deleted assignment we should restore
      const softDeleted = assignmentsByCaseId[caseId]?.find(
        a => a.user_id === staffId && a.removed_at !== null
      )
      
      if (softDeleted) {
        // Restore the soft-deleted assignment
        const { error } = await supabase
          .from('case_staff')
          .update({ removed_at: null, removed_by: null })
          .eq('id', softDeleted.id)
        
        if (error) throw error
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('case_staff')
          .insert({
            case_id: caseId,
            user_id: staffId,
            role_id: roleId
          })
        
        if (error) throw error
      }
      
      // Optimistic update
      const staff = facilityStaff.find(s => s.id === staffId)
      if (staff) {
        const newAssignment: CaseStaffAssignment = {
          id: crypto.randomUUID(), // Temporary ID until refresh
          case_id: caseId,
          user_id: staffId,
          role_id: roleId,
          created_at: new Date().toISOString(),
          removed_at: null,
          removed_by: null,
          user: {
            id: staff.id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            profile_image_url: staff.profile_image_url
          },
          user_roles: staff.user_roles
        }
        
        setAssignmentsByCaseId(prev => ({
          ...prev,
          [caseId]: [...(prev[caseId] || []).filter(a => a.user_id !== staffId), newAssignment]
        }))
      }
      
      return true
    } catch (error) {
      console.error('Error assigning staff:', error)
      return false
    }
  }, [assignmentsByCaseId, facilityStaff, supabase])
  
  // Remove staff from case (soft delete if case in progress)
  const removeStaffFromCase = useCallback(async (
    assignmentId: string,
    caseId: string,
    isInProgress: boolean
  ): Promise<boolean> => {
    try {
      if (isInProgress) {
        // Soft delete - set removed_at
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await supabase
          .from('case_staff')
          .update({ 
            removed_at: new Date().toISOString(),
            removed_by: user?.id 
          })
          .eq('id', assignmentId)
        
        if (error) throw error
        
        // Optimistic update
        setAssignmentsByCaseId(prev => ({
          ...prev,
          [caseId]: prev[caseId]?.map(a => 
            a.id === assignmentId 
              ? { ...a, removed_at: new Date().toISOString(), removed_by: user?.id || null }
              : a
          ) || []
        }))
      } else {
        // Hard delete - remove row entirely
        const { error } = await supabase
          .from('case_staff')
          .delete()
          .eq('id', assignmentId)
        
        if (error) throw error
        
        // Optimistic update
        setAssignmentsByCaseId(prev => ({
          ...prev,
          [caseId]: prev[caseId]?.filter(a => a.id !== assignmentId) || []
        }))
      }
      
      return true
    } catch (error) {
      console.error('Error removing staff:', error)
      return false
    }
  }, [supabase])
  
  // Permanently remove staff (for faded avatars)
  const permanentlyRemoveStaff = useCallback(async (
    assignmentId: string,
    caseId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('case_staff')
        .delete()
        .eq('id', assignmentId)
      
      if (error) throw error
      
      // Optimistic update
      setAssignmentsByCaseId(prev => ({
        ...prev,
        [caseId]: prev[caseId]?.filter(a => a.id !== assignmentId) || []
      }))
      
      return true
    } catch (error) {
      console.error('Error permanently removing staff:', error)
      return false
    }
  }, [supabase])
  
  // Move staff between cases
  const moveStaffBetweenCases = useCallback(async (
    staffId: string,
    fromCaseId: string,
    toCaseId: string,
    roleId: string
  ): Promise<boolean> => {
    try {
      // Find the existing assignment
      const existingAssignment = assignmentsByCaseId[fromCaseId]?.find(
        a => a.user_id === staffId && a.removed_at === null
      )
      
      if (!existingAssignment) {
        console.log('No active assignment found to move')
        return false
      }
      
      // Delete from source case
      const { error: deleteError } = await supabase
        .from('case_staff')
        .delete()
        .eq('id', existingAssignment.id)
      
      if (deleteError) throw deleteError
      
      // Add to destination case
      const { error: insertError } = await supabase
        .from('case_staff')
        .insert({
          case_id: toCaseId,
          user_id: staffId,
          role_id: roleId
        })
      
      if (insertError) throw insertError
      
      // Optimistic update
      const staff = facilityStaff.find(s => s.id === staffId)
      if (staff) {
        const newAssignment: CaseStaffAssignment = {
          id: crypto.randomUUID(),
          case_id: toCaseId,
          user_id: staffId,
          role_id: roleId,
          created_at: new Date().toISOString(),
          removed_at: null,
          removed_by: null,
          user: {
            id: staff.id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            profile_image_url: staff.profile_image_url
          },
          user_roles: staff.user_roles
        }
        
        setAssignmentsByCaseId(prev => ({
          ...prev,
          [fromCaseId]: prev[fromCaseId]?.filter(a => a.id !== existingAssignment.id) || [],
          [toCaseId]: [...(prev[toCaseId] || []), newAssignment]
        }))
      }
      
      return true
    } catch (error) {
      console.error('Error moving staff:', error)
      return false
    }
  }, [assignmentsByCaseId, facilityStaff, supabase])
  
  // Refresh assignments
  const refreshAssignments = useCallback(async () => {
    await fetchAssignments()
  }, [fetchAssignments])
  
  return {
    facilityStaff,
    staffLoading,
    assignmentsByCaseId,
    assignmentsLoading,
    assignStaffToCase,
    removeStaffFromCase,
    permanentlyRemoveStaff,
    moveStaffBetweenCases,
    refreshAssignments
  }
}