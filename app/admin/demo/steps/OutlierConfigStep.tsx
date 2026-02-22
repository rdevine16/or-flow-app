// app/admin/demo/steps/OutlierConfigStep.tsx
// Step 4: Per-surgeon outlier controls with toggle, frequency, and custom min/max ranges

'use client'

import { useCallback } from 'react'
import {
  SlidersHorizontal,
  AlertTriangle,
  Zap,
  Clock,
  Timer,
  PhoneCall,
  Flame,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  DemoSurgeon,
  SurgeonProfile,
  OutlierType,
  OutlierSetting,
  OutlierDef,
} from '../types'
import { OUTLIER_DEFS } from '../types'

// ============================================================================
// CONSTANTS
// ============================================================================

const OUTLIER_ICONS: Record<OutlierType, LucideIcon> = {
  lateStarts: Clock,
  longTurnovers: Timer,
  extendedPhases: AlertTriangle,
  callbackDelays: PhoneCall,
  fastCases: Zap,
}

const OUTLIER_COLORS: Record<OutlierType, { bg: string; border: string; text: string; badge: string }> = {
  lateStarts: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  longTurnovers: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  extendedPhases: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  callbackDelays: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  fastCases: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
}

// ============================================================================
// PROPS
// ============================================================================

export interface OutlierConfigStepProps {
  surgeons: DemoSurgeon[]
  profiles: Record<string, SurgeonProfile>
  onUpdateProfile: (surgeonId: string, updates: Partial<SurgeonProfile>) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function OutlierConfigStep({
  surgeons,
  profiles,
  onUpdateProfile,
}: OutlierConfigStepProps) {
  const includedSurgeons = surgeons.filter((s) => !!profiles[s.id])

  const handleOutlierChange = useCallback(
    (surgeonId: string, outlierType: OutlierType, updates: Partial<OutlierSetting>) => {
      const profile = profiles[surgeonId]
      if (!profile) return

      onUpdateProfile(surgeonId, {
        outliers: {
          ...profile.outliers,
          [outlierType]: {
            ...profile.outliers[outlierType],
            ...updates,
          },
        },
      })
    },
    [profiles, onUpdateProfile],
  )

  const handleBadDaysChange = useCallback(
    (surgeonId: string, badDaysPerMonth: number) => {
      onUpdateProfile(surgeonId, { badDaysPerMonth })
    },
    [onUpdateProfile],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-[17px] font-semibold text-slate-900">Outlier Configuration</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Configure per-surgeon problem patterns. Each outlier type has independent frequency (% of cases affected)
            and custom min/max range controls.
          </p>
        </div>
      </div>

      {/* Per-Surgeon Outlier Cards */}
      {includedSurgeons.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <SlidersHorizontal className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No surgeons configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Go back to Step 2 to add surgeons.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {includedSurgeons.map((surgeon) => {
            const profile = profiles[surgeon.id]
            if (!profile) return null

            return (
              <SurgeonOutlierCard
                key={surgeon.id}
                surgeon={surgeon}
                profile={profile}
                onOutlierChange={(type, updates) => handleOutlierChange(surgeon.id, type, updates)}
                onBadDaysChange={(val) => handleBadDaysChange(surgeon.id, val)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SURGEON OUTLIER CARD
// ============================================================================

interface SurgeonOutlierCardProps {
  surgeon: DemoSurgeon
  profile: SurgeonProfile
  onOutlierChange: (type: OutlierType, updates: Partial<OutlierSetting>) => void
  onBadDaysChange: (value: number) => void
}

function SurgeonOutlierCard({
  surgeon,
  profile,
  onOutlierChange,
  onBadDaysChange,
}: SurgeonOutlierCardProps) {
  const enabledCount = OUTLIER_DEFS.filter((d) => profile.outliers[d.type].enabled).length

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      data-testid={`outlier-card-${surgeon.id}`}
    >
      {/* Surgeon Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Dr. {surgeon.first_name} {surgeon.last_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {profile.speedProfile} &middot; {enabledCount} outlier types enabled
          </p>
        </div>
        {/* Summary badges */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {OUTLIER_DEFS.map((def) => {
            const setting = profile.outliers[def.type]
            if (!setting.enabled) return null
            const colors = OUTLIER_COLORS[def.type]
            const unitSuffix = def.unit === 'percent' ? '%' : 'm'
            return (
              <span
                key={def.type}
                className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${colors.badge}`}
              >
                {def.label} {setting.frequency}% · {setting.rangeMin}-{setting.rangeMax}{unitSuffix}
              </span>
            )
          })}
        </div>
      </div>

      {/* Outlier Rows */}
      <div className="divide-y divide-slate-100">
        {OUTLIER_DEFS.map((def) => {
          const setting = profile.outliers[def.type]
          const Icon = OUTLIER_ICONS[def.type]
          const colors = OUTLIER_COLORS[def.type]

          return (
            <div
              key={def.type}
              className={`px-5 py-3.5 transition-colors ${setting.enabled ? colors.bg : ''}`}
              data-testid={`outlier-row-${surgeon.id}-${def.type}`}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => onOutlierChange(def.type, { enabled: !setting.enabled })}
                    data-testid={`outlier-toggle-${surgeon.id}-${def.type}`}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      setting.enabled ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        setting.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className={`w-3.5 h-3.5 ${setting.enabled ? colors.text : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${setting.enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                      {def.label}
                    </span>
                  </div>
                  <p className={`text-[11px] ${setting.enabled ? 'text-slate-500' : 'text-slate-400'}`}>
                    {setting.enabled
                      ? `${def.description} (${setting.rangeMin}-${setting.rangeMax} ${def.unitLabel})`
                      : def.description
                    }
                  </p>

                  {/* Controls — only show when enabled */}
                  {setting.enabled && (
                    <OutlierControls
                      def={def}
                      setting={setting}
                      surgeonId={surgeon.id}
                      onOutlierChange={onOutlierChange}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Bad Day Frequency */}
        <div className="px-5 py-4 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="pt-0.5">
              <Flame className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-semibold text-slate-900">Bad Days per Month</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Days when ALL enabled outliers fire simultaneously at 100% frequency
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-700 font-mono ml-4">
                  {profile.badDaysPerMonth}
                </span>
              </div>
              <div className="mt-2">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={profile.badDaysPerMonth}
                  onChange={(e) => onBadDaysChange(Number(e.target.value))}
                  data-testid={`bad-days-slider-${surgeon.id}`}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>None</span>
                  <span>1/mo</span>
                  <span>2/mo</span>
                  <span>3/mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Summary */}
      <OutlierPreviewSummary surgeon={surgeon} profile={profile} />
    </div>
  )
}

// ============================================================================
// OUTLIER CONTROLS (frequency + range inputs)
// ============================================================================

interface OutlierControlsProps {
  def: OutlierDef
  setting: OutlierSetting
  surgeonId: string
  onOutlierChange: (type: OutlierType, updates: Partial<OutlierSetting>) => void
}

function OutlierControls({ def, setting, surgeonId, onOutlierChange }: OutlierControlsProps) {
  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Frequency Slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            Frequency
          </label>
          <span className="text-xs font-bold text-slate-700 font-mono">
            {setting.frequency}%
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={80}
          step={5}
          value={setting.frequency}
          onChange={(e) => onOutlierChange(def.type, { frequency: Number(e.target.value) })}
          data-testid={`freq-slider-${surgeonId}-${def.type}`}
          className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
          <span>5%</span>
          <span>80%</span>
        </div>
      </div>

      {/* Range Min */}
      <div>
        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
          Min ({def.unitLabel})
        </label>
        <input
          type="number"
          min={def.absMin}
          max={setting.rangeMax}
          value={setting.rangeMin}
          onChange={(e) => {
            const val = Math.max(def.absMin, Math.min(setting.rangeMax, Number(e.target.value) || def.absMin))
            onOutlierChange(def.type, { rangeMin: val })
          }}
          data-testid={`range-min-${surgeonId}-${def.type}`}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[9px] text-slate-400 mt-0.5 text-center">min {def.absMin}</p>
      </div>

      {/* Range Max */}
      <div>
        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
          Max ({def.unitLabel})
        </label>
        <input
          type="number"
          min={setting.rangeMin}
          max={def.absMax}
          value={setting.rangeMax}
          onChange={(e) => {
            const val = Math.max(setting.rangeMin, Math.min(def.absMax, Number(e.target.value) || setting.rangeMin))
            onOutlierChange(def.type, { rangeMax: val })
          }}
          data-testid={`range-max-${surgeonId}-${def.type}`}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[9px] text-slate-400 mt-0.5 text-center">max {def.absMax}</p>
      </div>
    </div>
  )
}

// ============================================================================
// OUTLIER PREVIEW SUMMARY
// ============================================================================

interface OutlierPreviewSummaryProps {
  surgeon: DemoSurgeon
  profile: SurgeonProfile
}

function OutlierPreviewSummary({ surgeon, profile }: OutlierPreviewSummaryProps) {
  const enabledOutliers = OUTLIER_DEFS.filter((d) => profile.outliers[d.type].enabled)

  if (enabledOutliers.length === 0 && profile.badDaysPerMonth === 0) return null

  return (
    <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        Preview
      </p>
      <p className="text-xs text-slate-700 leading-relaxed">
        <span className="font-semibold">Dr. {surgeon.last_name}</span>
        {enabledOutliers.length > 0 && (
          <>
            {' \u2014 '}
            {enabledOutliers.length} {enabledOutliers.length === 1 ? 'problem' : 'problems'}:{' '}
            {enabledOutliers.map((def, i) => {
              const s = profile.outliers[def.type]
              return (
                <span key={def.type}>
                  {i > 0 && ' + '}
                  {def.label} ({s.frequency}% freq, {s.rangeMin}-{s.rangeMax}{def.unit === 'percent' ? '%' : ' min'})
                </span>
              )
            })}
          </>
        )}
        {profile.badDaysPerMonth > 0 && (
          <>
            {enabledOutliers.length > 0 ? ' + ' : ' \u2014 '}
            <span className="text-red-600 font-medium">
              {profile.badDaysPerMonth} bad {profile.badDaysPerMonth === 1 ? 'day' : 'days'}/month
            </span>
          </>
        )}
      </p>
    </div>
  )
}

