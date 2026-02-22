// app/admin/demo/steps/SurgeonProfilesStep.tsx
// Step 2: Surgeon profiles — speed, specialty, vendor, operating days, procedures

'use client'

import { useCallback, useMemo } from 'react'
import {
  Users,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Gauge,
  Snail,
  Hash,
} from 'lucide-react'
import type {
  DemoSurgeon,
  DemoORRoom,
  DemoProcedureType,
  SurgeonProfile,
  BlockScheduleEntry,
  SurgeonDurationEntry,
  SpeedProfile,
  Specialty,
  Vendor,
  DayOfWeek,
} from '../types'
import {
  SPEED_PROFILE_DEFS,
  SPECIALTIES,
  SPECIALTY_PROC_NAMES,
  VENDORS,
  WEEKDAY_LABELS,
  WEEKDAY_VALUES,
  parseBlockSchedules,
  buildDurationMap,
  createDefaultOutlierProfile,
  getDefaultCasesPerDay,
} from '../types'

// ============================================================================
// PROPS
// ============================================================================

export interface SurgeonProfilesStepProps {
  surgeons: DemoSurgeon[]
  profiles: Record<string, SurgeonProfile>
  onUpdateProfile: (surgeonId: string, updates: Partial<SurgeonProfile>) => void
  onToggleSurgeon: (surgeonId: string, included: boolean) => void
  blockSchedules: BlockScheduleEntry[]
  surgeonDurations: SurgeonDurationEntry[]
  procedureTypes: DemoProcedureType[]
  rooms: DemoORRoom[]
  /** Which surgeon card is expanded, null for none */
  expandedSurgeonId: string | null
  onExpandSurgeon: (surgeonId: string | null) => void
}

// ============================================================================
// SPEED PROFILE ICONS
// ============================================================================

const SPEED_ICONS: Record<SpeedProfile, typeof Zap> = {
  fast: Zap,
  average: Gauge,
  slow: Snail,
}

const SPEED_COLORS: Record<SpeedProfile, { active: string; inactive: string }> = {
  fast: {
    active: 'bg-green-100 border-green-300 text-green-700',
    inactive: 'bg-white border-slate-200 text-slate-500 hover:border-green-200 hover:text-green-600',
  },
  average: {
    active: 'bg-blue-100 border-blue-300 text-blue-700',
    inactive: 'bg-white border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600',
  },
  slow: {
    active: 'bg-amber-100 border-amber-300 text-amber-700',
    inactive: 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600',
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SurgeonProfilesStep({
  surgeons,
  profiles,
  onUpdateProfile,
  onToggleSurgeon,
  blockSchedules,
  surgeonDurations,
  procedureTypes,
  rooms: _rooms,
  expandedSurgeonId,
  onExpandSurgeon,
}: SurgeonProfilesStepProps) {
  const durationMap = useMemo(() => buildDurationMap(surgeonDurations), [surgeonDurations])

  const includedCount = Object.keys(profiles).length

  // ── Specialty change handler: auto-select matching procedure types ──
  const handleSpecialtyChange = useCallback(
    (surgeonId: string, specialty: Specialty) => {
      const matchingProcNames = SPECIALTY_PROC_NAMES[specialty]
      const matchingIds = procedureTypes
        .filter((pt) => matchingProcNames.includes(pt.name))
        .map((pt) => pt.id)
      const currentSpeed = profiles[surgeonId]?.speedProfile || 'average'
      const newCpd = getDefaultCasesPerDay(currentSpeed, specialty)
      onUpdateProfile(surgeonId, { specialty, procedureTypeIds: matchingIds, casesPerDay: newCpd })
    },
    [procedureTypes, onUpdateProfile, profiles],
  )

  // ── Toggle operating day ──
  const handleDayToggle = useCallback(
    (surgeonId: string, day: DayOfWeek, currentDays: DayOfWeek[]) => {
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort()
      onUpdateProfile(surgeonId, { operatingDays: newDays })
    },
    [onUpdateProfile],
  )

  // ── Toggle procedure type ──
  const handleProcToggle = useCallback(
    (surgeonId: string, procId: string, currentIds: string[]) => {
      const newIds = currentIds.includes(procId)
        ? currentIds.filter((id) => id !== procId)
        : [...currentIds, procId]
      onUpdateProfile(surgeonId, { procedureTypeIds: newIds })
    },
    [onUpdateProfile],
  )

  // ── Toggle surgeon inclusion ──
  const handleSurgeonToggle = useCallback(
    (surgeon: DemoSurgeon, isCurrentlyIncluded: boolean) => {
      if (isCurrentlyIncluded) {
        onToggleSurgeon(surgeon.id, false)
        if (expandedSurgeonId === surgeon.id) onExpandSurgeon(null)
      } else {
        // Include with smart defaults
        const blockInfo = parseBlockSchedules(blockSchedules, surgeon.id)
        const defaultDays = blockInfo.days.length > 0 ? blockInfo.days : [1, 3] as DayOfWeek[]
        const matchingProcIds = procedureTypes
          .filter((pt) => SPECIALTY_PROC_NAMES.joint.includes(pt.name))
          .map((pt) => pt.id)

        const defaultSpeed = SPEED_PROFILE_DEFS.find((s) => s.value === 'average')!
        const newProfile: SurgeonProfile = {
          surgeonId: surgeon.id,
          speedProfile: 'average',
          speedMultiplierRange: { ...defaultSpeed.defaultRange },
          specialty: 'joint',
          operatingDays: defaultDays,
          dayRoomAssignments: {},
          procedureTypeIds: matchingProcIds,
          preferredVendor: 'Stryker',
          closingWorkflow: surgeon.closing_workflow,
          closingHandoffMinutes: surgeon.closing_handoff_minutes,
          outliers: createDefaultOutlierProfile(),
          badDaysPerMonth: 0,
          casesPerDay: getDefaultCasesPerDay('average', 'joint'),
        }
        onToggleSurgeon(surgeon.id, true)
        onUpdateProfile(surgeon.id, newProfile)
        onExpandSurgeon(surgeon.id)
      }
    },
    [blockSchedules, procedureTypes, onToggleSurgeon, onUpdateProfile, expandedSurgeonId, onExpandSurgeon],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-[17px] font-semibold text-slate-900">Surgeon Profiles</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Configure speed, specialty, and procedures for each surgeon.
            Operating days are auto-populated from block schedules.
          </p>
        </div>
        <div className="px-6 py-3 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>
              {includedCount} of {surgeons.length} surgeons included
            </span>
          </div>
          {surgeons.length > 0 && includedCount < surgeons.length && (
            <button
              type="button"
              onClick={() => {
                for (const s of surgeons) {
                  if (!profiles[s.id]) handleSurgeonToggle(s, false)
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Include all
            </button>
          )}
        </div>
      </div>

      {/* Surgeon Cards */}
      {surgeons.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No surgeons found</p>
          <p className="text-xs text-slate-400 mt-1">
            Add surgeons to the facility first.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surgeons.map((surgeon) => {
            const profile = profiles[surgeon.id]
            const isIncluded = !!profile
            const isExpanded = expandedSurgeonId === surgeon.id && isIncluded
            const blockInfo = parseBlockSchedules(blockSchedules, surgeon.id)

            return (
              <SurgeonCard
                key={surgeon.id}
                surgeon={surgeon}
                profile={profile}
                isIncluded={isIncluded}
                isExpanded={isExpanded}
                blockScheduleLabel={blockInfo.scheduleLabel}
                blockDays={blockInfo.days}
                durationMap={durationMap}
                procedureTypes={procedureTypes}
                onToggle={() => handleSurgeonToggle(surgeon, isIncluded)}
                onExpand={() => onExpandSurgeon(isExpanded ? null : surgeon.id)}
                onSpeedChange={(speed) => {
                  const newCpd = getDefaultCasesPerDay(speed, profile?.specialty || 'joint')
                  const speedDef = SPEED_PROFILE_DEFS.find((s) => s.value === speed)!
                  onUpdateProfile(surgeon.id, {
                    speedProfile: speed,
                    casesPerDay: newCpd,
                    speedMultiplierRange: { ...speedDef.defaultRange },
                  })
                }}
                onSpecialtyChange={(spec) => handleSpecialtyChange(surgeon.id, spec)}
                onVendorChange={(vendor) => onUpdateProfile(surgeon.id, { preferredVendor: vendor })}
                onDayToggle={(day) => handleDayToggle(surgeon.id, day, profile?.operatingDays || [])}
                onProcToggle={(procId) => handleProcToggle(surgeon.id, procId, profile?.procedureTypeIds || [])}
                onCasesPerDayChange={(cpd) => onUpdateProfile(surgeon.id, { casesPerDay: cpd })}
                onSpeedRangeChange={(range) => onUpdateProfile(surgeon.id, { speedMultiplierRange: range })}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SURGEON CARD
// ============================================================================

interface SurgeonCardProps {
  surgeon: DemoSurgeon
  profile: SurgeonProfile | undefined
  isIncluded: boolean
  isExpanded: boolean
  blockScheduleLabel: string
  blockDays: DayOfWeek[]
  durationMap: Map<string, number>
  procedureTypes: DemoProcedureType[]
  onToggle: () => void
  onExpand: () => void
  onSpeedChange: (speed: SpeedProfile) => void
  onSpecialtyChange: (specialty: Specialty) => void
  onVendorChange: (vendor: Vendor) => void
  onDayToggle: (day: DayOfWeek) => void
  onProcToggle: (procId: string) => void
  onCasesPerDayChange: (cpd: { min: number; max: number }) => void
  onSpeedRangeChange: (range: { min: number; max: number }) => void
}

function SurgeonCard({
  surgeon,
  profile,
  isIncluded,
  isExpanded,
  blockScheduleLabel,
  blockDays,
  durationMap,
  procedureTypes,
  onToggle,
  onExpand,
  onSpeedChange,
  onSpecialtyChange,
  onVendorChange,
  onDayToggle,
  onProcToggle,
  onCasesPerDayChange,
  onSpeedRangeChange,
}: SurgeonCardProps) {
  return (
    <div
      data-testid={`surgeon-card-${surgeon.id}`}
      className={`bg-white rounded-xl border overflow-hidden transition-all ${
        isIncluded ? 'border-blue-200 shadow-sm' : 'border-slate-200'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Include checkbox */}
        <input
          type="checkbox"
          checked={isIncluded}
          onChange={onToggle}
          data-testid={`surgeon-toggle-${surgeon.id}`}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
        />

        {/* Surgeon info */}
        <button
          type="button"
          onClick={isIncluded ? onExpand : onToggle}
          className="flex-1 text-left flex items-center justify-between min-w-0"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Dr. {surgeon.first_name} {surgeon.last_name}
            </h3>
            {isIncluded && profile && (
              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                <span className="capitalize">{profile.speedProfile} ({profile.speedMultiplierRange?.min ?? 100}-{profile.speedMultiplierRange?.max ?? 100}%)</span>
                <span>&middot;</span>
                <span>{SPECIALTIES.find((s) => s.value === profile.specialty)?.label}</span>
                <span>&middot;</span>
                <span>{profile.operatingDays.length} days/wk</span>
                <span>&middot;</span>
                <span>{profile.casesPerDay.min}-{profile.casesPerDay.max} cases/day</span>
                <span>&middot;</span>
                <span>{profile.procedureTypeIds.length} procedures</span>
              </div>
            )}
            {!isIncluded && blockScheduleLabel && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {blockScheduleLabel}
              </p>
            )}
          </div>
          {isIncluded && (
            <div className="shrink-0 ml-2">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" data-testid="chevron-up" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" data-testid="chevron-down" />
              )}
            </div>
          )}
        </button>
      </div>

      {/* Expanded Configuration */}
      {isExpanded && profile && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 flex flex-col gap-5">
          {/* Block schedule info */}
          {blockScheduleLabel && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Block schedule: {blockScheduleLabel}</span>
            </div>
          )}

          {/* Speed Profile */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Speed Profile
            </label>
            <div className="flex gap-2">
              {SPEED_PROFILE_DEFS.map((sp) => {
                const isActive = profile.speedProfile === sp.value
                const Icon = SPEED_ICONS[sp.value]
                const colors = SPEED_COLORS[sp.value]
                return (
                  <button
                    key={sp.value}
                    type="button"
                    onClick={() => onSpeedChange(sp.value)}
                    data-testid={`speed-${sp.value}-${surgeon.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive ? colors.active : colors.inactive
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {sp.label}
                  </button>
                )
              })}
            </div>
            {/* Speed multiplier range */}
            {(() => {
              const speedDef = SPEED_PROFILE_DEFS.find((s) => s.value === profile.speedProfile)!
              const range = profile.speedMultiplierRange ?? speedDef.defaultRange
              return (
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Duration range</span>
                  <input
                    type="number"
                    min={30}
                    max={range.max}
                    value={range.min}
                    onChange={(e) => {
                      const val = Math.max(30, Math.min(range.max, Number(e.target.value) || 30))
                      onSpeedRangeChange({ min: val, max: range.max })
                    }}
                    data-testid={`speed-range-min-${surgeon.id}`}
                    className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    min={range.min}
                    max={200}
                    value={range.max}
                    onChange={(e) => {
                      const val = Math.max(range.min, Math.min(200, Number(e.target.value) || range.min))
                      onSpeedRangeChange({ min: range.min, max: val })
                    }}
                    data-testid={`speed-range-max-${surgeon.id}`}
                    className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400">% of template duration</span>
                </div>
              )
            })()}
          </div>

          {/* Cases Per Day */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Cases Per Day
              <span className="font-normal text-slate-400 ml-1">(target range)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={profile.casesPerDay.min}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                    onCasesPerDayChange({
                      min: val,
                      max: Math.max(val, profile.casesPerDay.max),
                    })
                  }}
                  data-testid={`cpd-min-${surgeon.id}`}
                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs text-slate-400">to</span>
              <input
                type="number"
                min={1}
                max={20}
                value={profile.casesPerDay.max}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  onCasesPerDayChange({
                    min: Math.min(profile.casesPerDay.min, val),
                    max: val,
                  })
                }}
                data-testid={`cpd-max-${surgeon.id}`}
                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">cases/day</span>
            </div>
          </div>

          {/* Specialty + Vendor row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Specialty */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Specialty
              </label>
              <div className="flex gap-2">
                {SPECIALTIES.map((spec) => (
                  <button
                    key={spec.value}
                    type="button"
                    onClick={() => onSpecialtyChange(spec.value)}
                    data-testid={`specialty-${spec.value}-${surgeon.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      profile.specialty === spec.value
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{spec.icon}</span>
                    {spec.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">
                Preferred Vendor
              </label>
              <select
                value={profile.preferredVendor || ''}
                onChange={(e) => onVendorChange(e.target.value as Vendor)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {VENDORS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Operating Days */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Operating Days
              {blockDays.length > 0 && (
                <span className="text-blue-500 font-normal ml-1">(from block schedule)</span>
              )}
            </label>
            <div className="flex gap-2">
              {WEEKDAY_VALUES.map((day) => {
                const isActive = profile.operatingDays.includes(day)
                const isFromBlock = blockDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onDayToggle(day)}
                    data-testid={`day-${day}-${surgeon.id}`}
                    className={`w-12 h-9 rounded-lg border text-xs font-medium transition-all relative ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                    }`}
                  >
                    {WEEKDAY_LABELS[day - 1]}
                    {isFromBlock && isActive && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-300 rounded-full border border-white" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Procedure Types */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Procedure Types
              <span className="font-normal text-slate-400 ml-1">
                ({profile.procedureTypeIds.length} selected)
              </span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {procedureTypes.map((pt) => {
                const isSelected = profile.procedureTypeIds.includes(pt.id)
                const surgeonDuration = durationMap.get(`${surgeon.id}::${pt.id}`)
                const baseDuration = pt.expected_duration_minutes

                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => onProcToggle(pt.id)}
                    data-testid={`proc-${pt.id}-${surgeon.id}`}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 text-slate-800'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-medium">{pt.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {surgeonDuration ? (
                        <span className="flex items-center gap-0.5 text-green-600" title="Surgeon-specific duration">
                          <Clock className="w-3 h-3" />
                          {surgeonDuration}m
                        </span>
                      ) : baseDuration ? (
                        <span className="flex items-center gap-0.5 text-slate-400" title="Default procedure duration">
                          <Clock className="w-3 h-3" />
                          {baseDuration}m
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
