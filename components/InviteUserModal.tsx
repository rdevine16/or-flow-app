'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { userAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface UserRole {
  id: string
  name: string
}

interface Facility {
  id: string
  name: string
}

interface InviteUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  facilityId: string | null  // null for global admin
  roles: UserRole[]
}

export default function InviteUserModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  facilityId,
  roles 
}: InviteUserModalProps) {
  const supabase = createClient()
  const { showToast } = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [accessLevel, setAccessLevel] = useState<'facility_admin' | 'user'>('user')
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilityId || '')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch facilities if global admin (no facilityId passed)
  useEffect(() => {
    async function fetchFacilities() {
      if (facilityId) {
        setSelectedFacilityId(facilityId)
        return
      }

      // Global admin - fetch all facilities
      const { data } = await supabase
        .from('facilities')
        .select('id, name')
        .order('name')

      if (data) {
        setFacilities(data)
        if (data.length > 0 && !selectedFacilityId) {
          setSelectedFacilityId(data[0].id)
        }
      }
    }

    if (isOpen) {
      fetchFacilities()
    }
  }, [isOpen, facilityId, supabase])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFirstName('')
      setLastName('')
      setEmail('')
      setRoleId(roles.length > 0 ? roles[0].id : '')
      setAccessLevel('user')
      setError(null)
      if (facilityId) {
        setSelectedFacilityId(facilityId)
      }
    }
  }, [isOpen, facilityId, roles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedEmail = email.trim()

    try {
      if (trimmedEmail) {
        // Has email - use existing invite flow
        const response = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: trimmedEmail,
            firstName,
            lastName,
            accessLevel,
            facilityId: selectedFacilityId,
            roleId,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          setError(data.error || 'Failed to send invitation')
          return
        }
      } else {
        // No email - create staff-only record
        const newUserId = crypto.randomUUID()
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            first_name: firstName,
            last_name: lastName,
            email: null,
            role_id: roleId,
            access_level: accessLevel,
            facility_id: selectedFacilityId,
            is_active: true,
          })

if (insertError) {
  showToast({
    type: 'error',
    title: 'Insert Failed',
    message: insertError.message || 'Failed to add staff member'
  })
  setError(insertError.message || 'Failed to add staff member')
  return
}

        // Audit log the staff creation (no email)
        await userAudit.created(
          supabase,
          `${firstName} ${lastName}`,
          '(no email)',
          newUserId
        )
      }

      // Success!
      onSuccess()
      onClose()

    } catch (err) {
      setError('Failed to add staff member. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const hasEmail = email.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Staff Member</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {hasEmail 
                ? "They'll receive an email to set their password"
                : "Add to your facility's staff directory"
              }
            </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="John"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="Smith"
                required
              />
            </div>
          </div>

          {/* Email - Now Optional */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Address
              <span className="text-slate-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder="john.smith@hospital.com"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              {hasEmail 
                ? "An invitation will be sent to this email"
                : "Leave blank to add staff without app access. You can invite them later."
              }
            </p>
          </div>

          {/* Facility (only show for global admin) */}
          {!facilityId && facilities.length > 0 && (
            <div>
              <label htmlFor="facility" className="block text-sm font-medium text-slate-700 mb-1.5">
                Facility
              </label>
              <select
                id="facility"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                required
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Staff Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1.5">
              Staff Role
            </label>
            <select
              id="role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              required
            >
              <option value="">Select a role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Access Level */}
          <div>
            <label htmlFor="accessLevel" className="block text-sm font-medium text-slate-700 mb-1.5">
              Permissions
            </label>
            <select
              id="accessLevel"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as 'facility_admin' | 'user')}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            >
              <option value="user">Staff — View cases, record milestones</option>
              <option value="facility_admin">Facility Admin — Full facility access</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              {accessLevel === 'facility_admin' 
                ? 'Can manage users, settings, cases, and view analytics'
                : 'Can view cases and record milestones only'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFacilityId || !roleId}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {hasEmail ? 'Sending...' : 'Adding...'}
                </span>
              ) : (
                hasEmail ? 'Add & Send Invite' : 'Add Staff Member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}