// app/admin/demo/page.tsx
// Demo Data Wizard — 6-step wizard orchestrator
// Uses sidebar layout pattern from FacilityWizard.jsx

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import DemoWizardShell from './DemoWizardShell'
import FacilityStep from './steps/FacilityStep'
import SurgeonProfilesStep from './steps/SurgeonProfilesStep'
import RoomScheduleStep from './steps/RoomScheduleStep'
import OutlierConfigStep from './steps/OutlierConfigStep'
import { Loader2 } from 'lucide-react'

import type {
  DemoWizardStep,
  DemoFacility,
  DemoSurgeon,
  DemoORRoom,
  DemoProcedureType,
  ConfigStatusKey,
  SurgeonProfile,
  DemoWizardState,
  BlockScheduleEntry,
  SurgeonDurationEntry,
} from './types'
import {
  DEFAULT_WIZARD_STATE,
  DEMO_STEP_COUNT,
  SPECIALTY_PROC_NAMES,
  isFacilityStepValid,
  isSurgeonProfilesStepValid,
  isRoomScheduleStepValid,
  estimateTotalCases,
  createDefaultOutlierProfile,
  parseBlockSchedules,
} from './types'

// ============================================================================
// API HELPER
// ============================================================================

async function apiCall(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('/api/demo-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  return res.json()
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemoDataWizardPage() {
  const router = useRouter()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // ── Wizard navigation ──
  const [currentStep, setCurrentStep] = useState<DemoWizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<DemoWizardStep>>(new Set())

  // ── Wizard state ──
  const [wizardState, setWizardState] = useState<DemoWizardState>(DEFAULT_WIZARD_STATE)

  // ── Facility data ──
  const [facilities, setFacilities] = useState<DemoFacility[]>([])
  const [surgeons, setSurgeons] = useState<DemoSurgeon[]>([])
  const [rooms, setRooms] = useState<DemoORRoom[]>([])
  const [procs, setProcs] = useState<DemoProcedureType[]>([])
  const [configStatus, setConfigStatus] = useState<Record<ConfigStatusKey, number> | null>(null)
  const [blockSchedules, setBlockSchedules] = useState<BlockScheduleEntry[]>([])
  const [surgeonDurations, setSurgeonDurations] = useState<SurgeonDurationEntry[]>([])

  // ── Step 2 UI state ──
  const [expandedSurgeonId, setExpandedSurgeonId] = useState<string | null>(null)

  // ── Loading states ──
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [loadingFacility, setLoadingFacility] = useState(false)

  // ── Auth check ──
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // ── Load facilities on mount ──
  useEffect(() => {
    if (!isGlobalAdmin) return
    ;(async () => {
      setLoadingFacilities(true)
      const data = await apiCall('list-facilities')
      if (data.facilities) setFacilities(data.facilities)
      setLoadingFacilities(false)
    })()
  }, [isGlobalAdmin])

  // ── Load facility details when selected ──
  const loadFacilityDetails = useCallback(
    async (facilityId: string) => {
      setLoadingFacility(true)
      try {
        const [sData, rData, pData, statusData, bsData, sdData] = await Promise.all([
          apiCall('list-surgeons', { facilityId }),
          apiCall('list-rooms', { facilityId }),
          apiCall('list-procedure-types', { facilityId }),
          apiCall('status-detailed', { facilityId }),
          apiCall('list-block-schedules', { facilityId }),
          apiCall('list-surgeon-durations', { facilityId }),
        ])

        const s: DemoSurgeon[] = sData.surgeons || []
        const r: DemoORRoom[] = rData.rooms || []
        const p: DemoProcedureType[] = pData.procedureTypes || []
        const bs: BlockScheduleEntry[] = bsData.blockSchedules || []
        const sd: SurgeonDurationEntry[] = sdData.surgeonDurations || []

        setSurgeons(s)
        setRooms(r)
        setProcs(p)
        setBlockSchedules(bs)
        setSurgeonDurations(sd)

        // Map status-detailed response to ConfigStatusKey counts
        setConfigStatus({
          surgeons: statusData.surgeons ?? s.length,
          rooms: statusData.rooms ?? r.length,
          procedureTypes: statusData.procedureTypes ?? p.length,
          payers: statusData.payers ?? 0,
          facilityMilestones: statusData.facilityMilestones ?? 0,
          flagRules: statusData.flagRules ?? 0,
          cancellationReasons: statusData.cancellationReasons ?? 0,
          delayTypes: statusData.delayTypes ?? 0,
          cases: statusData.cases ?? 0,
        })

        // Initialize surgeon profiles with smart defaults from block schedules
        const newProfiles: Record<string, SurgeonProfile> = {}
        s.forEach((surgeon, idx) => {
          const blockInfo = parseBlockSchedules(bs, surgeon.id)
          const defaultDays = blockInfo.days.length > 0 ? blockInfo.days : ([1, 3] as (1 | 2 | 3 | 4 | 5)[])
          const defaultRoomId = r.length > 0 ? r[idx % r.length].id : null
          const dayRoomAssignments: Record<number, string[]> = {}
          for (const day of defaultDays) {
            if (defaultRoomId) dayRoomAssignments[day] = [defaultRoomId]
          }

          newProfiles[surgeon.id] = {
            surgeonId: surgeon.id,
            speedProfile: 'average',
            specialty: 'joint',
            operatingDays: defaultDays,
            dayRoomAssignments,
            procedureTypeIds: p
              .filter((pt) => SPECIALTY_PROC_NAMES.joint.includes(pt.name))
              .map((pt) => pt.id),
            preferredVendor: 'Stryker',
            closingWorkflow: surgeon.closing_workflow,
            closingHandoffMinutes: surgeon.closing_handoff_minutes,
            outliers: createDefaultOutlierProfile(),
            badDaysPerMonth: 0,
          }
        })

        setWizardState((prev) => ({
          ...prev,
          facilityId: facilityId,
          surgeonProfiles: newProfiles,
        }))
      } catch (e) {
        showToast({
          type: 'error',
          title: 'Error Loading Facility',
          message: e instanceof Error ? e.message : 'Failed to load facility details',
        })
      }
      setLoadingFacility(false)
    },
    [showToast],
  )

  // ── Facility selection handler ──
  const handleSelectFacility = useCallback(
    (facilityId: string) => {
      setWizardState((prev) => ({ ...prev, facilityId }))
      loadFacilityDetails(facilityId)
    },
    [loadFacilityDetails],
  )

  // ── Surgeon profile handlers ──
  const handleUpdateProfile = useCallback(
    (surgeonId: string, updates: Partial<SurgeonProfile>) => {
      setWizardState((prev) => ({
        ...prev,
        surgeonProfiles: {
          ...prev.surgeonProfiles,
          [surgeonId]: { ...prev.surgeonProfiles[surgeonId], ...updates },
        },
      }))
    },
    [],
  )

  const handleToggleSurgeon = useCallback(
    (surgeonId: string, included: boolean) => {
      if (!included) {
        setWizardState((prev) => {
          const { [surgeonId]: _, ...rest } = prev.surgeonProfiles
          return { ...prev, surgeonProfiles: rest }
        })
      }
      // When including, the SurgeonProfilesStep will call onUpdateProfile to set the profile
    },
    [],
  )

  // ── Wizard navigation ──
  const canAdvanceFromStep = useCallback(
    (step: DemoWizardStep): boolean => {
      switch (step) {
        case 1:
          return isFacilityStepValid(wizardState) && !loadingFacility
        case 2:
          return isSurgeonProfilesStepValid(wizardState.surgeonProfiles).valid
        case 3:
          return isRoomScheduleStepValid(wizardState.surgeonProfiles).valid
        case 4:
          return true // Outlier config is optional — always valid
        case 5:
          return true
        case 6:
          return false
        default:
          return false
      }
    },
    [wizardState, loadingFacility],
  )

  const goNext = useCallback(() => {
    if (currentStep < DEMO_STEP_COUNT && canAdvanceFromStep(currentStep)) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      setCurrentStep((currentStep + 1) as DemoWizardStep)
    }
  }, [currentStep, canAdvanceFromStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as DemoWizardStep)
    }
  }, [currentStep])

  const goToStep = useCallback((step: DemoWizardStep) => {
    setCurrentStep(step)
  }, [])

  // ── Sidebar summary items ──
  const summaryItems = useMemo(() => {
    const items: { label: string; value: string }[] = []
    const facility = facilities.find((f) => f.id === wizardState.facilityId)
    if (facility) {
      items.push({ label: 'Facility', value: facility.name })
    }
    const surgeonCount = Object.keys(wizardState.surgeonProfiles).length
    if (surgeonCount > 0) {
      items.push({ label: 'Surgeons', value: String(surgeonCount) })
    }
    items.push({ label: 'History', value: `${wizardState.monthsOfHistory}mo` })
    if (surgeonCount > 0) {
      const est = estimateTotalCases(wizardState.surgeonProfiles, wizardState.monthsOfHistory)
      items.push({ label: 'Est. cases', value: `~${est.toLocaleString()}` })
    }
    items.push({ label: 'Purge first', value: wizardState.purgeFirst ? 'Yes' : 'No' })
    return items
  }, [facilities, wizardState])

  // ── Loading & auth guard ──
  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <DemoWizardShell
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepChange={goToStep}
        canAdvance={canAdvanceFromStep(currentStep)}
        onNext={goNext}
        onBack={goBack}
        summaryItems={summaryItems}
        hideFooter={currentStep === 6}
        showGenerate={currentStep === 5}
      >
        {/* Step 1: Facility Selection */}
        {currentStep === 1 && (
          <FacilityStep
            facilities={facilities}
            selectedFacilityId={wizardState.facilityId}
            onSelectFacility={handleSelectFacility}
            loading={loadingFacilities}
            loadingFacility={loadingFacility}
            configStatus={configStatus}
            monthsOfHistory={wizardState.monthsOfHistory}
            onMonthsChange={(months) =>
              setWizardState((prev) => ({ ...prev, monthsOfHistory: months }))
            }
            purgeFirst={wizardState.purgeFirst}
            onPurgeFirstChange={(value) =>
              setWizardState((prev) => ({ ...prev, purgeFirst: value }))
            }
          />
        )}

        {/* Step 2: Surgeon Profiles */}
        {currentStep === 2 && (
          <SurgeonProfilesStep
            surgeons={surgeons}
            profiles={wizardState.surgeonProfiles}
            onUpdateProfile={handleUpdateProfile}
            onToggleSurgeon={handleToggleSurgeon}
            blockSchedules={blockSchedules}
            surgeonDurations={surgeonDurations}
            procedureTypes={procs}
            rooms={rooms}
            expandedSurgeonId={expandedSurgeonId}
            onExpandSurgeon={setExpandedSurgeonId}
          />
        )}
        {/* Step 3: Room Schedule */}
        {currentStep === 3 && (
          <RoomScheduleStep
            surgeons={surgeons}
            rooms={rooms}
            profiles={wizardState.surgeonProfiles}
            onUpdateProfile={handleUpdateProfile}
          />
        )}

        {/* Step 4: Outlier Config */}
        {currentStep === 4 && (
          <OutlierConfigStep
            surgeons={surgeons}
            profiles={wizardState.surgeonProfiles}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
        {currentStep === 5 && (
          <PlaceholderStep
            title="Review"
            description="Review all configuration before generating. Coming in Phase 4."
          />
        )}
        {currentStep === 6 && (
          <PlaceholderStep
            title="Running"
            description="SSE-powered progress indicator. Coming in Phase 4."
          />
        )}
      </DemoWizardShell>
    </DashboardLayout>
  )
}

// ============================================================================
// PLACEHOLDER STEP (removed in later phases)
// ============================================================================

function PlaceholderStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  )
}
