// app/admin/demo/steps/ReviewStep.tsx
// Step 5: Review all configuration before generating — compact cards, schedule grid, edit buttons

'use client'

import {
  Building2,
  Users,
  LayoutGrid,
  SlidersHorizontal,
  Pencil,
  Calendar,
  ArrowLeftRight,
  AlertTriangle,
  Zap,
  Clock,
  Timer,
  PhoneCall,
  Flame,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  DemoWizardStep,
  DemoFacility,
  DemoSurgeon,
  DemoORRoom,
  SurgeonProfile,
  DemoWizardState,
  OutlierType,
  DayOfWeek,
} from '../types'
import {
  WEEKDAY_LABELS,
  SPECIALTIES,
  SPEED_PROFILE_DEFS,
  OUTLIER_DEFS,
  estimateTotalCases,
} from '../types'
import { countHolidaysInRange } from '@/lib/us-holidays'

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

const OUTLIER_BADGE_COLORS: Record<OutlierType, string> = {
  lateStarts: 'bg-red-100 text-red-700',
  longTurnovers: 'bg-orange-100 text-orange-700',
  extendedPhases: 'bg-amber-100 text-amber-700',
  callbackDelays: 'bg-purple-100 text-purple-700',
  fastCases: 'bg-cyan-100 text-cyan-700',
}

const MAGNITUDE_LABELS: Record<number, string> = {
  1: 'low',
  2: 'med',
  3: 'high',
}

// ============================================================================
// PROPS
// ============================================================================

export interface ReviewStepProps {
  wizardState: DemoWizardState
  facilities: DemoFacility[]
  surgeons: DemoSurgeon[]
  rooms: DemoORRoom[]
  onEditStep: (step: DemoWizardStep) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ReviewStep({
  wizardState,
  facilities,
  surgeons,
  rooms,
  onEditStep,
}: ReviewStepProps) {
  const facility = facilities.find((f) => f.id === wizardState.facilityId)
  const includedSurgeons = surgeons.filter((s) => !!wizardState.surgeonProfiles[s.id])
  const totalEstimate = estimateTotalCases(wizardState.surgeonProfiles, wizardState.monthsOfHistory)

  const holidayCount = (() => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - wizardState.monthsOfHistory)
    return countHolidaysInRange(start, end)
  })()

  return (
    <div className="flex flex-col gap-5">
      {/* ── Section: Facility Details ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <SectionHeader
          title="Facility"
          icon={Building2}
          onEdit={() => onEditStep(1)}
        />
        <div className="p-5">
          {facility ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{facility.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {facility.timezone}
                  {facility.case_number_prefix && ` \u00B7 ${facility.case_number_prefix}`}
                </p>
              </div>
              <div className="flex gap-6 text-center shrink-0">
                <div>
                  <p className="text-lg font-bold text-slate-900">{wizardState.monthsOfHistory}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Months</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{holidayCount}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Holidays</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{wizardState.purgeFirst ? 'Yes' : 'No'}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Purge</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No facility selected</p>
          )}
        </div>
      </div>

      {/* ── Section: Surgeon Summaries ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <SectionHeader
          title={`Surgeons (${includedSurgeons.length})`}
          icon={Users}
          onEdit={() => onEditStep(2)}
        />
        <div className="divide-y divide-slate-100">
          {includedSurgeons.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No surgeons configured
            </div>
          ) : (
            includedSurgeons.map((surgeon) => {
              const profile = wizardState.surgeonProfiles[surgeon.id]
              if (!profile) return null
              return (
                <SurgeonSummaryCard
                  key={surgeon.id}
                  surgeon={surgeon}
                  profile={profile}
                />
              )
            })
          )}
        </div>
      </div>

      {/* ── Section: Room Schedule (read-only) ── */}
      {includedSurgeons.length > 0 && rooms.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SectionHeader
            title="Weekly OR Schedule"
            icon={LayoutGrid}
            onEdit={() => onEditStep(3)}
          />
          <div className="p-5 overflow-x-auto">
            <ReadOnlyScheduleGrid
              surgeons={includedSurgeons}
              profiles={wizardState.surgeonProfiles}
              rooms={rooms}
            />
          </div>
        </div>
      )}

      {/* ── Section: Outlier Summary ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <SectionHeader
          title="Outlier Configuration"
          icon={SlidersHorizontal}
          onEdit={() => onEditStep(4)}
        />
        <div className="p-5">
          <OutlierSummaryTable
            surgeons={includedSurgeons}
            profiles={wizardState.surgeonProfiles}
          />
        </div>
      </div>

      {/* ── Estimated Total ── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          Estimated Total Cases
        </p>
        <p className="text-3xl font-bold text-white">
          ~{totalEstimate.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {includedSurgeons.length} surgeons &middot; {wizardState.monthsOfHistory} months &middot; {holidayCount} holidays skipped
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({
  title,
  icon: Icon,
  onEdit,
}: {
  title: string
  icon: LucideIcon
  onEdit: () => void
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
      >
        <Pencil className="w-3 h-3" />
        Edit
      </button>
    </div>
  )
}

// ============================================================================
// SURGEON SUMMARY CARD
// ============================================================================

function SurgeonSummaryCard({
  surgeon,
  profile,
}: {
  surgeon: DemoSurgeon
  profile: SurgeonProfile
}) {
  const speedDef = SPEED_PROFILE_DEFS.find((s) => s.value === profile.speedProfile)
  const specDef = SPECIALTIES.find((s) => s.value === profile.specialty)
  const enabledOutliers = OUTLIER_DEFS.filter((d) => profile.outliers[d.type].enabled)

  // Build per-day room summary
  const dayRoomSummary = profile.operatingDays
    .map((day) => {
      const roomCount = profile.dayRoomAssignments[day]?.length || 0
      return `${WEEKDAY_LABELS[day - 1]}:${roomCount}R`
    })
    .join(', ')

  return (
    <div className="px-5 py-3.5 flex items-start gap-4" data-testid={`review-surgeon-${surgeon.id}`}>
      {/* Name + Specialty */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Dr. {surgeon.first_name} {surgeon.last_name}
          </h3>
          {specDef && (
            <span className="text-xs text-slate-500">
              {specDef.icon} {specDef.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span className="capitalize font-medium">{speedDef?.label || profile.speedProfile}</span>
          <span>&middot;</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dayRoomSummary}
          </span>
          <span>&middot;</span>
          <span>{profile.procedureTypeIds.length} procedures</span>
          {profile.preferredVendor && (
            <>
              <span>&middot;</span>
              <span>{profile.preferredVendor}</span>
            </>
          )}
        </div>

        {/* Outlier badges */}
        {(enabledOutliers.length > 0 || profile.badDaysPerMonth > 0) && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {enabledOutliers.map((def) => {
              const setting = profile.outliers[def.type]
              const Icon = OUTLIER_ICONS[def.type]
              return (
                <span
                  key={def.type}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${OUTLIER_BADGE_COLORS[def.type]}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {def.label} {setting.frequency}% {MAGNITUDE_LABELS[setting.magnitude]}
                </span>
              )
            })}
            {profile.badDaysPerMonth > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                <Flame className="w-2.5 h-2.5" />
                {profile.badDaysPerMonth} bad {profile.badDaysPerMonth === 1 ? 'day' : 'days'}/mo
              </span>
            )}
          </div>
        )}
      </div>

      {/* Flip room indicator */}
      {profile.operatingDays.some((d) => (profile.dayRoomAssignments[d]?.length || 0) >= 2) && (
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 rounded-lg px-2 py-1">
          <ArrowLeftRight className="w-3 h-3" />
          Flip
        </div>
      )}
    </div>
  )
}

// ============================================================================
// READ-ONLY SCHEDULE GRID (combined view from all surgeons)
// ============================================================================

function ReadOnlyScheduleGrid({
  surgeons,
  profiles,
  rooms,
}: {
  surgeons: DemoSurgeon[]
  profiles: Record<string, SurgeonProfile>
  rooms: DemoORRoom[]
}) {
  const allDays: DayOfWeek[] = [1, 2, 3, 4, 5]

  // Build schedule: for each day x room, list surgeon last names
  const schedule: Record<string, string[]> = {}
  for (const surgeon of surgeons) {
    const profile = profiles[surgeon.id]
    if (!profile) continue
    for (const day of profile.operatingDays) {
      const dayRooms = profile.dayRoomAssignments[day] || []
      for (const roomId of dayRooms) {
        const key = `${day}-${roomId}`
        if (!schedule[key]) schedule[key] = []
        schedule[key].push(surgeon.last_name)
      }
    }
  }

  const hasConflicts = Object.values(schedule).some((names) => names.length > 1)

  return (
    <>
      {hasConflicts && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          Room conflicts detected — multiple surgeons in same room
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 pr-3 w-24">
              Room
            </th>
            {allDays.map((day) => (
              <th
                key={day}
                className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 px-1 min-w-[100px]"
              >
                {WEEKDAY_LABELS[day - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td className="py-1.5 pr-3 text-xs font-semibold text-slate-700">
                {room.name}
              </td>
              {allDays.map((day) => {
                const key = `${day}-${room.id}`
                const names = schedule[key] || []
                const isConflict = names.length > 1

                return (
                  <td key={day} className="py-1.5 px-1 text-center">
                    <div
                      className={`rounded-lg border px-2 py-1.5 min-h-[32px] text-[11px] ${
                        isConflict
                          ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold'
                          : names.length > 0
                          ? 'bg-slate-50 border-slate-200 text-slate-600'
                          : 'border-transparent text-slate-300'
                      }`}
                    >
                      {names.length > 0 ? names.join(', ') : '\u2014'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ============================================================================
// OUTLIER SUMMARY TABLE
// ============================================================================

function OutlierSummaryTable({
  surgeons,
  profiles,
}: {
  surgeons: DemoSurgeon[]
  profiles: Record<string, SurgeonProfile>
}) {
  const hasAnyOutliers = surgeons.some((s) => {
    const p = profiles[s.id]
    if (!p) return false
    return OUTLIER_DEFS.some((d) => p.outliers[d.type].enabled) || p.badDaysPerMonth > 0
  })

  if (!hasAnyOutliers) {
    return (
      <p className="text-sm text-slate-500 text-center py-4">
        No outlier patterns configured. Generated data will have normal distributions.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 pr-3">
              Surgeon
            </th>
            {OUTLIER_DEFS.map((def) => (
              <th key={def.type} className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 px-1">
                {def.label.split(' ').map((w) => w[0]).join('')}
              </th>
            ))}
            <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider pb-2 px-1">
              Bad
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {surgeons.map((surgeon) => {
            const profile = profiles[surgeon.id]
            if (!profile) return null

            return (
              <tr key={surgeon.id}>
                <td className="py-2 pr-3 text-xs font-medium text-slate-700">
                  Dr. {surgeon.last_name}
                </td>
                {OUTLIER_DEFS.map((def) => {
                  const setting = profile.outliers[def.type]
                  return (
                    <td key={def.type} className="py-2 px-1 text-center">
                      {setting.enabled ? (
                        <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${OUTLIER_BADGE_COLORS[def.type]}`}>
                          {setting.frequency}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">&mdash;</span>
                      )}
                    </td>
                  )
                })}
                <td className="py-2 px-1 text-center">
                  {profile.badDaysPerMonth > 0 ? (
                    <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-red-100 text-red-700">
                      {profile.badDaysPerMonth}/mo
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">&mdash;</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
