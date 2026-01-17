// components/CallNextPatientModal.tsx
// Modal for sending "Call Next Patient" notifications
// Mirrors iOS CallNextPatientView functionality

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../lib/supabase'

interface Room {
  id: string
  name: string
}

interface NextCase {
  id: string
  case_number: string
  procedure_name: string
  surgeon_name: string
  start_time: string | null
}

interface CurrentCase {
  id: string
  case_number: string
}

interface RecentCall {
  id: string
  room_id: string
  room_name: string
  case_id: string
  case_number: string
  procedure_name: string
  created_at: string
  sent_by_name: string
  call_count: number
}

interface CallNextPatientModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  userId: string
  userEmail: string
}

export default function CallNextPatientModal({
  isOpen,
  onClose,
  facilityId,
  userId,
  userEmail
}: CallNextPatientModalProps) {
  const supabase = createClient()

  // State
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [nextCase, setNextCase] = useState<NextCase | null>(null)
  const [currentCase, setCurrentCase] = useState<CurrentCase | null>(null)
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateMinutesAgo, setDuplicateMinutesAgo] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  // Load rooms and recent calls on mount
  const loadInitialData = useCallback(async () => {
    if (!facilityId) return

    setIsLoading(true)
    try {
      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('or_rooms')
        .select('id, name')
        .eq('facility_id', facilityId)
        .order('name')

      if (roomsData) {
        setRooms(roomsData)
      }

      // Fetch recent calls (last 30 minutes)
      await loadRecentCalls()
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [facilityId, supabase])

  // Load recent calls (grouped by case)
  const loadRecentCalls = async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: calls } = await supabase
      .from('notifications')
      .select(`
        id,
        room_id,
        case_id,
        created_at,
        or_rooms (name),
        cases (case_number, procedure_types (name)),
        sender:users!notifications_sent_by_fkey (first_name, last_name)
      `)
      .eq('facility_id', facilityId)
      .eq('type', 'patient_call')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })

    if (calls) {
      // Group by case_id and count
      const grouped: Record<string, RecentCall> = {}
      
      for (const call of calls as any[]) {
        const caseId = call.case_id
        if (!caseId) continue

        const roomName = call.or_rooms?.name || 'Unknown Room'
        const caseNumber = call.cases?.case_number || 'Unknown'
        const procedureName = call.cases?.procedure_types?.name || 'Unknown Procedure'
        const senderFirst = call.sender?.first_name || ''
        const senderLast = call.sender?.last_name || ''
        const sentByName = `${senderFirst} ${senderLast}`.trim() || 'Unknown'

        if (!grouped[caseId]) {
          grouped[caseId] = {
            id: call.id,
            room_id: call.room_id,
            room_name: roomName,
            case_id: caseId,
            case_number: caseNumber,
            procedure_name: procedureName,
            created_at: call.created_at,
            sent_by_name: sentByName,
            call_count: 1
          }
        } else {
          grouped[caseId].call_count++
          // Keep the most recent
          if (call.created_at > grouped[caseId].created_at) {
            grouped[caseId].created_at = call.created_at
            grouped[caseId].sent_by_name = sentByName
            grouped[caseId].id = call.id
          }
        }
      }

      setRecentCalls(Object.values(grouped))
    }
  }

  // Fetch next case for selected room
  const fetchCasesForRoom = async (room: Room) => {
    const today = getTodayDate()

    // Fetch in_progress case (current)
    const { data: currentCaseData } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        case_statuses!inner (name)
      `)
      .eq('facility_id', facilityId)
      .eq('or_room_id', room.id)
      .eq('scheduled_date', today)
      .eq('case_statuses.name', 'in_progress')
      .limit(1)
      .single()

    if (currentCaseData) {
      setCurrentCase({
        id: currentCaseData.id,
        case_number: currentCaseData.case_number
      })
    } else {
      setCurrentCase(null)
    }

    // Fetch next scheduled case
    const { data: nextCaseData } = await supabase
      .from('cases')
      .select(`
        id,
        case_number,
        start_time,
        procedure_types (name),
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name),
        case_statuses!inner (name)
      `)
      .eq('facility_id', facilityId)
      .eq('or_room_id', room.id)
      .eq('scheduled_date', today)
      .eq('case_statuses.name', 'scheduled')
      .order('start_time', { ascending: true })
      .limit(1)
      .single()

    if (nextCaseData) {
      const surgeon = nextCaseData.surgeon as any
      const surgeonName = surgeon 
        ? `Dr. ${surgeon.last_name}` 
        : 'Unassigned'
      const procedureName = (nextCaseData.procedure_types as any)?.name || 'Unknown'

      setNextCase({
        id: nextCaseData.id,
        case_number: nextCaseData.case_number,
        procedure_name: procedureName,
        surgeon_name: surgeonName,
        start_time: nextCaseData.start_time
      })
    } else {
      setNextCase(null)
    }
  }

  // Check for duplicate call
  const checkDuplicateCall = (): number | null => {
    if (!selectedRoom) return null

    const recentForRoom = recentCalls.find(c => c.room_id === selectedRoom.id)
    if (recentForRoom) {
      const minutesAgo = Math.floor(
        (Date.now() - new Date(recentForRoom.created_at).getTime()) / 60000
      )
      return minutesAgo
    }
    return null
  }

  // Send patient call
  const sendCall = async (bypassDuplicateCheck = false) => {
    if (!selectedRoom || !nextCase) return

    // Check for duplicate
    if (!bypassDuplicateCheck) {
      const duplicate = checkDuplicateCall()
      if (duplicate !== null) {
        setDuplicateMinutesAgo(duplicate)
        setShowDuplicateWarning(true)
        return
      }
    }

    setIsSending(true)
    setShowDuplicateWarning(false)

    try {
      const title = `${selectedRoom.name} Can Go Back`
      const message = `${nextCase.case_number}: ${nextCase.surgeon_name} - ${nextCase.procedure_name}`

      // 1. Create notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          facility_id: facilityId,
          type: 'patient_call',
          title: title,
          message: message,
          room_id: selectedRoom.id,
          case_id: nextCase.id,
          sent_by: userId
        })

      if (notifError) throw notifError

      // 2. Record call_time on current case (if exists)
const now = new Date().toISOString()
await supabase
  .from('cases')
  .update({
    called_back_at: now,
    called_back_by: userId
  })
  .eq('id', call.case_id)


      // 3. Trigger push notifications via edge function
      try {
        console.log('Triggering push notification:', { facilityId, title, message, excludeUserId: userId })
        await supabase.functions.invoke('send-push-notification', {
          body: {
            facility_id: facilityId,  // snake_case to match edge function
            title: title,
            body: message,
            exclude_user_id: userId   // snake_case to match edge function
          }
        })
      } catch (pushError) {
        console.error('Push notification failed (non-critical):', pushError)
      }

      // 4. HIPAA Audit Log - matches iOS format
      await supabase.from('audit_log').insert({
        user_id: userId,
        user_email: userEmail,
        action: 'patient_call.created',
        facility_id: facilityId,
        target_type: 'case',
        target_id: nextCase.id,
        target_label: `Case #${nextCase.case_number}`,
        new_values: {
          room_id: selectedRoom.id,
          room_name: selectedRoom.name,
          surgeon: nextCase.surgeon_name,
          procedure: nextCase.procedure_name,
          current_case_id: currentCase?.id || null,
          next_case_id: nextCase.id
        },
        metadata: {
          platform: 'web'
        },
        success: true
      })

      setToast({ message: 'Patient call sent!', type: 'success' })
      
      // Refresh recent calls
      await loadRecentCalls()

      // Reset selection
      setSelectedRoom(null)
      setNextCase(null)
      setCurrentCase(null)

      // Close modal after short delay
      setTimeout(() => {
        onClose()
      }, 1000)

    } catch (error) {
      console.error('Error sending call:', error)
      setToast({ message: 'Failed to send call', type: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  // Resend a recent call
  const resendCall = async (call: RecentCall) => {
    setIsSending(true)
    try {
      // Fetch fresh case data
      const { data: caseData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          procedure_types (name),
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
        `)
        .eq('id', call.case_id)
        .single()

      if (!caseData) {
        setToast({ message: 'Case no longer exists', type: 'error' })
        return
      }

      const surgeon = caseData.surgeon as any
      const surgeonName = surgeon ? `Dr. ${surgeon.last_name}` : 'Unassigned'
      const procedureName = (caseData.procedure_types as any)?.name || 'Unknown'

      const title = `${call.room_name} Can Go Back`
      const message = `${caseData.case_number}: ${surgeonName} - ${procedureName}`

      // Create new notification
      await supabase
        .from('notifications')
        .insert({
          facility_id: facilityId,
          type: 'patient_call',
          title: title,
          message: message,
          room_id: call.room_id,
          case_id: call.case_id,
          sent_by: userId
        })

      // Trigger push
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            facility_id: facilityId,
            title: title,
            body: message,
            exclude_user_id: userId
          }
        })
      } catch (pushError) {
        console.error('Push notification failed:', pushError)
      }

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: userId,
        user_email: userEmail,
        action: 'patient_call.resent',
        facility_id: facilityId,
        target_type: 'case',
        target_id: call.case_id,
        target_label: `Case #${caseData.case_number}`,
        new_values: {
          room_id: call.room_id,
          room_name: call.room_name,
          surgeon: surgeonName,
          procedure: procedureName
        },
        metadata: {
          platform: 'web'
        },
        success: true
      })

      setToast({ message: 'Call resent!', type: 'success' })
      await loadRecentCalls()

    } catch (error) {
      console.error('Error resending call:', error)
      setToast({ message: 'Failed to resend', type: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  // Undo a call
  const undoCall = async (call: RecentCall) => {
    setIsSending(true)
    try {
      // First, fetch the case data to get surgeon/procedure info for audit
      const { data: caseData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          procedure_types (name),
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
        `)
        .eq('id', call.case_id)
        .single()

      const surgeon = caseData?.surgeon as any
      const surgeonName = surgeon ? `Dr. ${surgeon.last_name}` : 'Unassigned'
      const procedureName = (caseData?.procedure_types as any)?.name || call.procedure_name

      // Delete ALL recent notifications for this case (not just one)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('case_id', call.case_id)
        .eq('type', 'patient_call')
        .gte('created_at', thirtyMinutesAgo)

      if (deleteError) {
        console.error('Error deleting notifications:', deleteError)
      }

      // Clear call_time from the case that has called_next_case_id pointing to this case
await supabase
  .from('cases')
  .update({
    called_back_at: null,
    called_back_by: null
  })
  .eq('id', call.case_id)

      // Send cancellation push notification
      const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          facility_id: facilityId,
          title: `${call.room_name} Call Cancelled`,
          body: `Patient call for ${call.case_number} has been cancelled`,
          exclude_user_id: userId
        }
      })
      
      if (pushError) {
        console.error('Push notification error:', pushError)
      }

      // Audit log - matches iOS format with old_values for cancelled actions
      await supabase.from('audit_log').insert({
        user_id: userId,
        user_email: userEmail,
        action: 'patient_call.cancelled',
        facility_id: facilityId,
        target_type: 'case',
        target_id: call.case_id,
        target_label: `Case #${call.case_number}`,
        old_values: {
          room_id: call.room_id,
          surgeon: surgeonName,
          procedure: procedureName,
          room_name: call.room_name,
          next_case_id: call.case_id
        },
        metadata: {
          platform: 'web'
        },
        success: true
      })

      setToast({ message: 'Call cancelled', type: 'success' })
      
      // Refresh the recent calls list
      await loadRecentCalls()

    } catch (error) {
      console.error('Error undoing call:', error)
      setToast({ message: 'Failed to cancel', type: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    } else {
      // Reset state when closed
      setSelectedRoom(null)
      setNextCase(null)
      setCurrentCase(null)
      setToast(null)
    }
  }, [isOpen, loadInitialData])

  // Fetch cases when room is selected
  useEffect(() => {
    if (selectedRoom) {
      fetchCasesForRoom(selectedRoom)
    }
  }, [selectedRoom])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1m ago'
    return `${minutes}m ago`
  }

  // Format start time
  const formatTime = (timeString: string | null) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Call Next Patient</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Recent Calls Section */}
                {recentCalls.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Recent Calls (Last 30 min)
                    </h3>
                    <div className="space-y-3">
                      {recentCalls.map((call) => (
                        <div
                          key={call.id}
                          className="bg-slate-50 rounded-xl p-4 border border-slate-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                <span className="font-medium text-slate-900">{call.room_name}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-sm text-slate-500">{formatTimeAgo(call.created_at)}</span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">
                                {call.case_number} • {call.procedure_name}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {call.call_count > 1 ? (
                                  <span>Called {call.call_count}x • Last by {call.sent_by_name}</span>
                                ) : (
                                  <span>By {call.sent_by_name}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-3">
                              <button
                                onClick={() => undoCall(call)}
                                disabled={isSending}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 
                                         bg-white hover:bg-slate-100 border border-slate-200 rounded-lg 
                                         transition-colors disabled:opacity-50"
                              >
                                Undo
                              </button>
                              <button
                                onClick={() => resendCall(call)}
                                disabled={isSending}
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 
                                         bg-blue-50 hover:bg-blue-100 rounded-lg 
                                         transition-colors disabled:opacity-50"
                              >
                                Resend
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Call Section */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    New Call
                  </h3>

                  {/* Room Selection */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Select Room</p>
                    <div className="flex flex-wrap gap-2">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${selectedRoom?.id === room.id
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                          {room.name}
                        </button>
                      ))}
                    </div>
                    {rooms.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No rooms found for this facility</p>
                    )}
                  </div>

                  {/* Next Case Preview */}
                  {selectedRoom && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Next Case</p>
                      {nextCase ? (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{nextCase.case_number}</p>
                              <p className="text-sm text-slate-600 mt-0.5">{nextCase.procedure_name}</p>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {nextCase.surgeon_name}
                                {nextCase.start_time && (
                                  <span> • {formatTime(nextCase.start_time)}</span>
                                )}
                              </p>
                            </div>
                            <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              {selectedRoom.name}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                          <p className="text-sm text-slate-500">No scheduled cases for {selectedRoom.name}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => sendCall()}
              disabled={!selectedRoom || !nextCase || isSending}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all
                flex items-center justify-center gap-2
                ${selectedRoom && nextCase && !isSending
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Send Call
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Dialog */}
      {showDuplicateWarning && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowDuplicateWarning(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Recent Call</h3>
              </div>
              <p className="text-slate-600 mb-6">
                This room was called {duplicateMinutesAgo} minute{duplicateMinutesAgo !== 1 ? 's' : ''} ago. Send another call?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDuplicateWarning(false)}
                  className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 
                           hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendCall(true)}
                  className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-amber-600 
                           hover:bg-amber-700 rounded-lg transition-colors"
                >
                  Send Anyway
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70]">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in
            ${toast.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </>
  )
}
