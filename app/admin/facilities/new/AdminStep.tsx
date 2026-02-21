// app/admin/facilities/new/AdminStep.tsx
// Step 2: Administrator — name, email, role, welcome email toggle

'use client'

import { Info } from 'lucide-react'
import { useUserRoles } from '@/hooks/useLookups'
import type { AdminStepProps, AdminData } from './types'

export default function AdminStep({
  data,
  onChange,
  sendWelcomeEmail,
  onSendWelcomeEmailChange,
}: AdminStepProps) {
  const { data: roles, loading: rolesLoading } = useUserRoles()

  function update(partial: Partial<AdminData>) {
    onChange({ ...data, ...partial })
  }

  return (
    <div className="p-6 sm:p-8" data-testid="admin-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">First Administrator</h2>
      <p className="text-sm text-slate-500 mb-6">
        This person will manage the facility and can invite other staff
      </p>

      <div className="space-y-5">
        {/* First Name + Last Name — 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={data.firstName}
              onChange={(e) => update({ firstName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Jane"
              autoFocus
              data-testid="admin-first-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Last Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={data.lastName}
              onChange={(e) => update({ lastName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Smith"
              data-testid="admin-last-name-input"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email Address <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="jane.smith@hospital.com"
            data-testid="admin-email-input"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Role <span className="text-red-600">*</span>
          </label>
          <select
            value={data.roleId}
            onChange={(e) => update({ roleId: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            disabled={rolesLoading}
            data-testid="admin-role-select"
          >
            <option value="">
              {rolesLoading ? 'Loading roles...' : 'Select a role'}
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Info Banner */}
        <div className="flex gap-3 p-4 bg-blue-50 rounded-lg" data-testid="admin-info-banner">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-medium">Invitation Email</p>
            <p className="text-sm text-blue-700 mt-0.5">
              An invitation email will be sent to this administrator with instructions
              to set up their account and access the facility dashboard.
            </p>
          </div>
        </div>

        {/* Send Welcome Email Toggle */}
        <label className="flex items-center gap-3 cursor-pointer" data-testid="send-welcome-email-toggle">
          <input
            type="checkbox"
            checked={sendWelcomeEmail}
            onChange={(e) => onSendWelcomeEmailChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Send welcome email</span>
            <p className="text-xs text-slate-500">
              Sends an account setup invitation immediately after facility creation
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}
