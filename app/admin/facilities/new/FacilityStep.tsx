// app/admin/facilities/new/FacilityStep.tsx
// Step 1: Facility details — SectionCard pattern with grouped form fields

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
    <div className="flex flex-col gap-5" data-testid="facility-step">
      {/* ================================================================ */}
      {/* FACILITY INFORMATION CARD                                        */}
      {/* ================================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-7 pt-6">
          <h3 className="text-base font-semibold text-slate-900">Facility Information</h3>
          <p className="text-sm text-slate-500 mt-0.5">Core identity and classification</p>
        </div>
        <div className="px-7 pt-5 pb-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Facility Name — full width */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Facility Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => update({ name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="e.g. Riverwalk Surgery Center"
                autoFocus
                data-testid="facility-name-input"
              />
            </div>

            {/* Facility Type */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Facility Type
              </label>
              <select
                value={data.facilityType}
                onChange={(e) => update({ facilityType: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238b8fa3%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                data-testid="facility-type-select"
              >
                {FACILITY_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => update({ phone: formatPhone(e.target.value) })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="(239) 555-0100"
                data-testid="facility-phone-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* LOCATION & CONTACT CARD                                          */}
      {/* ================================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-7 pt-6">
          <h3 className="text-base font-semibold text-slate-900">Location & Contact</h3>
          <p className="text-sm text-slate-500 mt-0.5">Physical address and operating details</p>
        </div>
        <div className="px-7 pt-5 pb-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Street Address — full width */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={data.streetAddress}
                onChange={(e) => update({ streetAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="123 Medical Dr, Suite 200"
                data-testid="facility-street-input"
              />
            </div>

            {/* Suite / Building */}
            <div className="sm:col-span-2">
              <input
                type="text"
                value={data.streetAddress2}
                onChange={(e) => update({ streetAddress2: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Suite, building, floor (optional)"
                data-testid="facility-street2-input"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={data.city}
                onChange={(e) => update({ city: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="City"
                data-testid="facility-city-input"
              />
            </div>

            {/* State + ZIP — nested grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  State
                </label>
                <select
                  value={data.state}
                  onChange={(e) => update({ state: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238b8fa3%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                  data-testid="facility-state-select"
                >
                  <option value="">State</option>
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  ZIP
                </label>
                <input
                  type="text"
                  value={data.zipCode}
                  onChange={(e) => update({ zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="33901"
                  inputMode="numeric"
                  data-testid="facility-zip-input"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Timezone <span className="text-red-500">*</span>
              </label>
              <select
                value={data.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238b8fa3%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
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
              <label className="block text-xs font-medium text-slate-600 mb-2">
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
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Trial Length
                </label>
                <select
                  value={data.trialDays}
                  onChange={(e) => update({ trialDays: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238b8fa3%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                  data-testid="trial-length-select"
                >
                  {TRIAL_LENGTHS.map((tl) => (
                    <option key={tl.value} value={tl.value}>
                      {tl.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Trial begins when the facility is created
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
