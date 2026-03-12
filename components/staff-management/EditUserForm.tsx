// components/staff-management/EditUserForm.tsx
// Inline edit form for the drawer Actions tab — update name, email, role, access level.
'use client'

import { useState, useEffect } from 'react'
import { useUserRoles } from '@/hooks/useLookups'
import { Loader2 } from 'lucide-react'

// ============================================
// Types
// ============================================

interface UserEditFields {
  first_name: string
  last_name: string
  email: string
  role_id: string
  access_level: string
}

interface EditUserFormProps {
  userId: string
  initialValues: UserEditFields
  isSelf: boolean
  loading: boolean
  onSave: (updates: Partial<UserEditFields>) => Promise<void>
  onCancel: () => void
}

// ============================================
// Constants
// ============================================

const ACCESS_LEVELS = [
  { value: 'user', label: 'Staff — View cases, record milestones' },
  { value: 'facility_admin', label: 'Facility Admin — Full facility access' },
] as const

// ============================================
// Component
// ============================================

export function EditUserForm({
  initialValues,
  isSelf,
  loading,
  onSave,
  onCancel,
}: EditUserFormProps) {
  const { data: roles } = useUserRoles()

  const [firstName, setFirstName] = useState(initialValues.first_name)
  const [lastName, setLastName] = useState(initialValues.last_name)
  const [email, setEmail] = useState(initialValues.email ?? '')
  const [roleId, setRoleId] = useState(initialValues.role_id ?? '')
  const [accessLevel, setAccessLevel] = useState(initialValues.access_level)

  // Reset form when user changes
  useEffect(() => {
    setFirstName(initialValues.first_name)
    setLastName(initialValues.last_name)
    setEmail(initialValues.email ?? '')
    setRoleId(initialValues.role_id ?? '')
    setAccessLevel(initialValues.access_level)
  }, [initialValues])

  const hasChanges =
    firstName !== initialValues.first_name ||
    lastName !== initialValues.last_name ||
    email !== (initialValues.email ?? '') ||
    roleId !== (initialValues.role_id ?? '') ||
    accessLevel !== initialValues.access_level

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges || !isValid) return

    const updates: Partial<UserEditFields> = {}
    if (firstName !== initialValues.first_name) updates.first_name = firstName.trim()
    if (lastName !== initialValues.last_name) updates.last_name = lastName.trim()
    if (email !== (initialValues.email ?? '')) updates.email = email.trim() || undefined
    if (roleId !== (initialValues.role_id ?? '')) updates.role_id = roleId
    if (accessLevel !== initialValues.access_level) updates.access_level = accessLevel

    await onSave(updates)
  }

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-firstName" className="block text-xs font-medium text-slate-500 mb-1">
            First Name
          </label>
          <input
            id="edit-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="edit-lastName" className="block text-xs font-medium text-slate-500 mb-1">
            Last Name
          </label>
          <input
            id="edit-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="edit-email" className="block text-xs font-medium text-slate-500 mb-1">
          Email <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="edit-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="user@hospital.com"
        />
      </div>

      {/* Role */}
      <div>
        <label htmlFor="edit-role" className="block text-xs font-medium text-slate-500 mb-1">
          Role
        </label>
        <select
          id="edit-role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className={inputClass}
        >
          <option value="">Select a role...</option>
          {(roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Access Level */}
      <div>
        <label htmlFor="edit-access" className="block text-xs font-medium text-slate-500 mb-1">
          Permissions
          {isSelf && (
            <span className="text-amber-600 font-normal ml-1">(cannot change your own)</span>
          )}
        </label>
        <select
          id="edit-access"
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value)}
          className={inputClass}
          disabled={isSelf}
        >
          {ACCESS_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !hasChanges || !isValid}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  )
}
