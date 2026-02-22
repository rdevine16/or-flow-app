// app/admin/facilities/new/AdminStep.tsx
// Step 2: Administrator — SectionCard pattern with improved welcome email toggle

'use client'

import { Mail } from 'lucide-react'
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
    <div className="flex flex-col gap-5" data-testid="admin-step">
      {/* ================================================================ */}
      {/* ADMINISTRATOR DETAILS CARD                                       */}
      {/* ================================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-7 pt-6">
          <h3 className="text-base font-semibold text-slate-900">Initial Administrator</h3>
          <p className="text-sm text-slate-500 mt-0.5">This user will have full facility admin access</p>
        </div>
        <div className="px-7 pt-5 pb-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.firstName}
                onChange={(e) => update({ firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Jane"
                autoFocus
                data-testid="admin-first-name-input"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.lastName}
                onChange={(e) => update({ lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Smith"
                data-testid="admin-last-name-input"
              />
            </div>

            {/* Email — full width */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => update({ email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="jane.smith@facility.com"
                data-testid="admin-email-input"
              />
            </div>

            {/* Role — full width */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={data.roleId}
                onChange={(e) => update({ roleId: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238b8fa3%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
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
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* WELCOME EMAIL CARD                                               */}
      {/* ================================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-7 py-5">
          <div className="flex items-center justify-between" data-testid="admin-info-banner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Mail className="w-[18px] h-[18px]" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Send Welcome Email</p>
                <p className="text-xs text-slate-500">Invite the admin to set up their account immediately</p>
              </div>
            </div>
            <label
              className="relative inline-flex items-center cursor-pointer"
              data-testid="send-welcome-email-toggle"
            >
              <input
                type="checkbox"
                checked={sendWelcomeEmail}
                onChange={(e) => onSendWelcomeEmailChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-[22px] bg-slate-300 peer-checked:bg-blue-600 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:w-[18px] after:h-[18px] after:shadow-sm after:transition-transform peer-checked:after:translate-x-[18px]" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
