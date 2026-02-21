// app/admin/facilities/new/FacilityStep.tsx
// Step 1: Facility details — name, type, address, timezone, subscription

'use client'

import type { FacilityStepProps, FacilityData } from './types'
import {
  FACILITY_TYPES,
  US_STATES,
  US_TIMEZONES,
  TRIAL_LENGTHS,
  formatPhone,
} from './types'

export default function FacilityStep({ data, onChange }: FacilityStepProps) {
  function update(partial: Partial<FacilityData>) {
    onChange({ ...data, ...partial })
  }

  return (
    <div className="p-6 sm:p-8" data-testid="facility-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Facility Details</h2>
      <p className="text-sm text-slate-500 mb-6">
        Basic information about the surgery center
      </p>

      <div className="space-y-5">
        {/* Facility Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Facility Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g., Pacific Surgery Center"
            autoFocus
            data-testid="facility-name-input"
          />
        </div>

        {/* Facility Type + Phone — 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Facility Type
            </label>
            <select
              value={data.facilityType}
              onChange={(e) => update({ facilityType: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              data-testid="facility-type-select"
            >
              {FACILITY_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => update({ phone: formatPhone(e.target.value) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="(555) 123-4567"
              data-testid="facility-phone-input"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Address Section */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Address</p>

          {/* Street */}
          <div className="space-y-3">
            <input
              type="text"
              value={data.streetAddress}
              onChange={(e) => update({ streetAddress: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Street address"
              data-testid="facility-street-input"
            />
            <input
              type="text"
              value={data.streetAddress2}
              onChange={(e) => update({ streetAddress2: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Suite, building, floor (optional)"
              data-testid="facility-street2-input"
            />

            {/* City, State, ZIP — 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={data.city}
                onChange={(e) => update({ city: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="City"
                data-testid="facility-city-input"
              />
              <select
                value={data.state}
                onChange={(e) => update({ state: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                data-testid="facility-state-select"
              >
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={data.zipCode}
                onChange={(e) => update({ zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="ZIP"
                inputMode="numeric"
                data-testid="facility-zip-input"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Timezone <span className="text-red-600">*</span>
          </label>
          <select
            value={data.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            data-testid="facility-timezone-select"
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subscription Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Subscription Status
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="subscriptionStatus"
                value="trial"
                checked={data.subscriptionStatus === 'trial'}
                onChange={() => update({ subscriptionStatus: 'trial' })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                data-testid="subscription-trial-radio"
              />
              <span className="text-sm text-slate-700">Trial</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="subscriptionStatus"
                value="active"
                checked={data.subscriptionStatus === 'active'}
                onChange={() => update({ subscriptionStatus: 'active' })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                data-testid="subscription-active-radio"
              />
              <span className="text-sm text-slate-700">Active</span>
            </label>
          </div>
        </div>

        {/* Trial Length — conditional */}
        {data.subscriptionStatus === 'trial' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Trial Length
            </label>
            <select
              value={data.trialDays}
              onChange={(e) => update({ trialDays: Number(e.target.value) })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              data-testid="trial-length-select"
            >
              {TRIAL_LENGTHS.map((tl) => (
                <option key={tl.value} value={tl.value}>
                  {tl.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Trial begins when the facility is created
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
