// app/admin/demo-data/page.tsx
// ORbit Demo Data Wizard — Interactive multi-step demo data management
// Reads existing surgeons from facility, allows speed profile assignment,
// purges old data and regenerates fresh demo data anchored to today

'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Facility {
  id: string
  name: string
  is_demo: boolean
  case_number_prefix: string | null
  timezone: string
}

interface Surgeon {
  id: string
  first_name: string
  last_name: string
  specialty: string | null
  closing_workflow: string | null
  closing_handoff_minutes: number | null
}

interface SurgeonProfile {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  usesFlipRooms: boolean
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[]
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
}

interface DemoStatus {
  cases: number
  surgeons: number
  milestones: number
  staff: number
  implants: number
  rooms: number
  procedureTypes: number
  payers: number
  delayTypes: number
  costCategories: number
  facilityMilestones: number
  cancellationReasons: number
  preopChecklistFields: number
  complexities: number
  facilityAnalyticsSettings: boolean
  procedureReimbursements: number
  procedureMilestoneConfig: number
  blockSchedules: number
}

interface GenerationProgress {
  phase: string
  current: number
  total: number
  message: string
}

interface GenerationResult {
  success: boolean
  casesGenerated?: number
  error?: string
  details?: {
    milestones: number
    staff: number
    implants: number
  }
}

type WizardStep = 'facility' | 'surgeons' | 'configure' | 'review' | 'running'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5]

const VENDORS = [
  { value: 'Stryker', label: 'Stryker' },
  { value: 'Zimmer Biomet', label: 'Zimmer Biomet' },
  { value: 'DePuy Synthes', label: 'DePuy Synthes' },
]

const SPEED_PROFILES = [
  {
    value: 'fast' as const,
    label: 'Fast',
    description: '6–8 cases/day, flip rooms, ~30 min surgical time',
    color: 'emerald',
  },
  {
    value: 'average' as const,
    label: 'Average',
    description: '4–6 cases/day, ~50 min surgical time',
    color: 'blue',
  },
  {
    value: 'slow' as const,
    label: 'Slow',
    description: '3–4 cases/day, ~75 min surgical time',
    color: 'amber',
  },
]

const SPECIALTIES = [
  { value: 'joint' as const, label: 'Joint Replacement', icon: '🦴' },
  { value: 'hand_wrist' as const, label: 'Hand & Wrist', icon: '✋' },
  { value: 'spine' as const, label: 'Spine', icon: '🦷' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemoDataWizard() {
  // Core state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [surgeonProfiles, setSurgeonProfiles] = useState<Record<string, SurgeonProfile>>({})
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [step, setStep] = useState<WizardStep>('facility')

  // Loading/progress state
  const [loading, setLoading] = useState(true)
  const [loadingSurgeons, setLoadingSurgeons] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  // Config options
  const [monthsOfHistory, setMonthsOfHistory] = useState(6)
  const [purgeBeforeGenerate, setPurgeBeforeGenerate] = useState(true)

  // Derived
  const selectedFacility = facilities.find(f => f.id === selectedFacilityId) || null

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadFacilities()
  }, [])

  async function loadFacilities() {
    setLoading(true)
    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-facilities' }),
      })
      const data = await res.json()
      if (data.facilities) {
        setFacilities(data.facilities)
      }
    } catch (error) {
      console.error('Error loading facilities:', error)
    }
    setLoading(false)
  }

  async function loadFacilityData(facilityId: string) {
    setLoadingSurgeons(true)
    try {
      // Load surgeons
      const surgeonRes = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-surgeons', facilityId }),
      })
      const surgeonData = await surgeonRes.json()
      if (surgeonData.surgeons) {
        setSurgeons(surgeonData.surgeons)
        // Initialize profiles for each surgeon
        const profiles: Record<string, SurgeonProfile> = {}
        surgeonData.surgeons.forEach((s: Surgeon) => {
          profiles[s.id] = {
            surgeonId: s.id,
            speedProfile: 'average',
            usesFlipRooms: false,
            specialty: 'joint',
            operatingDays: [1, 3], // Default Mon/Wed
            preferredVendor: 'Stryker',
          }
        })
        setSurgeonProfiles(profiles)
      }

      // Load status
      const statusRes = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status-detailed', facilityId }),
      })
      const statusData = await statusRes.json()
      setStatus(statusData)
    } catch (error) {
      console.error('Error loading facility data:', error)
    }
    setLoadingSurgeons(false)
  }

  // ============================================================================
  // PROFILE MANAGEMENT
  // ============================================================================

  const updateProfile = useCallback(
    (surgeonId: string, updates: Partial<SurgeonProfile>) => {
      setSurgeonProfiles(prev => ({
        ...prev,
        [surgeonId]: { ...prev[surgeonId], ...updates },
      }))
    },
    []
  )

  const toggleOperatingDay = useCallback(
    (surgeonId: string, day: number) => {
      setSurgeonProfiles(prev => {
        const current = prev[surgeonId].operatingDays
        const updated = current.includes(day)
          ? current.filter(d => d !== day)
          : [...current, day].sort()
        return {
          ...prev,
          [surgeonId]: { ...prev[surgeonId], operatingDays: updated },
        }
      })
    },
    []
  )

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function handleSelectFacility(facilityId: string) {
    setSelectedFacilityId(facilityId)
    setResult(null)
    await loadFacilityData(facilityId)
    setStep('surgeons')
  }

  async function handleGenerate() {
    if (!selectedFacilityId) return
    setStep('running')
    setResult(null)
    setProgress({ phase: 'starting', current: 0, total: 100, message: 'Initializing...' })

    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-wizard',
          facilityId: selectedFacilityId,
          surgeonProfiles: Object.values(surgeonProfiles),
          monthsOfHistory,
          purgeFirst: purgeBeforeGenerate,
        }),
      })

      // Handle streaming progress if using SSE, otherwise simple response
      const data = await res.json()
      setResult(data)

      if (data.success) {
        setProgress({ phase: 'complete', current: 100, total: 100, message: 'Demo data generated!' })
        // Reload status
        await loadFacilityData(selectedFacilityId)
      } else {
        setProgress(null)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
      setProgress(null)
    }
  }

  async function handlePurgeOnly() {
    if (!selectedFacilityId) return
    if (!confirm('This will permanently delete ALL case data for this demo facility. Continue?')) return

    setProgress({ phase: 'clearing', current: 0, total: 100, message: 'Purging demo data...' })
    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', facilityId: selectedFacilityId }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, casesGenerated: 0, error: `Purged all case data` })
        await loadFacilityData(selectedFacilityId)
      } else {
        setResult({ success: false, error: data.error })
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    }
    setProgress(null)
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const hasSurgeons = surgeons.length > 0
  const allProfilesConfigured = Object.values(surgeonProfiles).every(
    p => p.operatingDays.length >= 1
  )
  const profileSummary = Object.values(surgeonProfiles).reduce(
    (acc, p) => {
      acc[p.speedProfile] = (acc[p.speedProfile] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading demo facilities...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Demo Data Wizard</h1>
                <p className="text-xs text-slate-500">Generate realistic surgical data for demo facilities</p>
              </div>
            </div>
            {selectedFacility && step !== 'facility' && (
              <button
                onClick={() => { setStep('facility'); setSelectedFacilityId(null); setResult(null) }}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Change facility
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      {step !== 'facility' && step !== 'running' && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center gap-2">
              {(['surgeons', 'configure', 'review'] as WizardStep[]).map((s, i) => {
                const stepNames: Record<string, string> = { surgeons: 'Surgeon Profiles', configure: 'Configuration', review: 'Review & Generate' }
                const stepIndex = ['surgeons', 'configure', 'review'].indexOf(step)
                const isActive = s === step
                const isCompleted = i < stepIndex
                return (
                  <div key={s} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-8 h-px ${isCompleted || isActive ? 'bg-blue-400' : 'bg-slate-200'}`} />}
                    <button
                      onClick={() => isCompleted && setStep(s)}
                      disabled={!isCompleted}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                          : isCompleted
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-current opacity-20 flex items-center justify-center text-[10px]">
                          {i + 1}
                        </span>
                      )}
                      {stepNames[s]}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Result banner */}
        {result && step !== 'running' && (
          <div className={`mb-6 rounded-xl border p-4 flex items-start gap-3 ${
            result.success
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              result.success ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              {result.success ? (
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.success
                  ? result.casesGenerated
                    ? `Generated ${result.casesGenerated.toLocaleString()} cases successfully`
                    : result.error || 'Operation completed'
                  : 'Generation failed'}
              </p>
              {result.success && result.details && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-emerald-700">
                  <span>{result.details.milestones.toLocaleString()} milestones</span>
                  <span>{result.details.staff.toLocaleString()} staff assignments</span>
                  <span>{result.details.implants.toLocaleString()} implants</span>
                </div>
              )}
              {!result.success && result.error && (
                <p className="text-sm text-red-700 mt-1">{result.error}</p>
              )}
            </div>
            <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 1: SELECT FACILITY */}
        {/* ================================================================ */}
        {step === 'facility' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Select Demo Facility</h2>
              <p className="text-sm text-slate-500 mt-1">Choose which facility to generate demo data for</p>
            </div>

            {facilities.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">No demo facilities found</p>
                <p className="text-sm text-slate-400 mt-1">
                  Mark facilities as demo-enabled by setting <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">is_demo = true</code> in the facilities table.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {facilities.map(facility => (
                  <button
                    key={facility.id}
                    onClick={() => handleSelectFacility(facility.id)}
                    className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center border border-slate-200 group-hover:from-blue-50 group-hover:to-blue-100 group-hover:border-blue-200 transition-colors">
                          <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{facility.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {facility.timezone} · Prefix: {facility.case_number_prefix || 'None'} · {facility.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: SURGEON PROFILES */}
        {/* ================================================================ */}
        {step === 'surgeons' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Surgeon Profiles</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedFacility?.name} — Configure each surgeon's speed, specialty, and schedule
                </p>
              </div>
              {status && status.cases > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-700">
                    {status.cases.toLocaleString()} existing cases
                  </span>
                </div>
              )}
            </div>

            {loadingSurgeons ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading surgeons...</p>
              </div>
            ) : !hasSurgeons ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-slate-700 font-medium">No surgeons found in this facility</p>
                <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  Add surgeons to the facility first through the Staff Management page, then return here to assign speed profiles and generate demo data.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {surgeons.map(surgeon => {
                  const profile = surgeonProfiles[surgeon.id]
                  if (!profile) return null

                  return (
                    <div key={surgeon.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Surgeon header */}
                      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                            {surgeon.first_name[0]}{surgeon.last_name[0]}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              Dr. {surgeon.first_name} {surgeon.last_name}
                            </h3>
                            <p className="text-xs text-slate-400">
                              {surgeon.closing_workflow === 'pa_closes' ? 'PA Closes' : 'Surgeon Closes'}
                              {surgeon.closing_handoff_minutes ? ` · ${surgeon.closing_handoff_minutes}min handoff` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400 hidden sm:block">
                            {SPECIALTIES.find(s => s.value === profile.specialty)?.icon}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            profile.speedProfile === 'fast' ? 'bg-emerald-50 text-emerald-700' :
                            profile.speedProfile === 'slow' ? 'bg-amber-50 text-amber-700' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {profile.speedProfile}
                          </span>
                        </div>
                      </div>

                      {/* Configuration grid */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Speed Profile */}
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                            Speed Profile
                          </label>
                          <div className="space-y-1.5">
                            {SPEED_PROFILES.map(sp => (
                              <button
                                key={sp.value}
                                onClick={() => updateProfile(surgeon.id, {
                                  speedProfile: sp.value,
                                  usesFlipRooms: sp.value === 'fast',
                                })}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                                  profile.speedProfile === sp.value
                                    ? sp.value === 'fast' ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                    : sp.value === 'slow' ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-blue-300 bg-blue-50 text-blue-800'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <span className="font-medium">{sp.label}</span>
                                <span className="block text-[11px] opacity-70 mt-0.5">{sp.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Specialty */}
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                            Specialty
                          </label>
                          <div className="space-y-1.5">
                            {SPECIALTIES.map(spec => (
                              <button
                                key={spec.value}
                                onClick={() => updateProfile(surgeon.id, { specialty: spec.value })}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                                  profile.specialty === spec.value
                                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <span>{spec.icon}</span>
                                <span className="font-medium">{spec.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Operating Days */}
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                            Operating Days
                          </label>
                          <div className="flex gap-1.5">
                            {WEEKDAYS.map((day, i) => (
                              <button
                                key={day}
                                onClick={() => toggleOperatingDay(surgeon.id, WEEKDAY_VALUES[i])}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                                  profile.operatingDays.includes(WEEKDAY_VALUES[i])
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>

                          {/* Flip rooms toggle */}
                          <div className="mt-4">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <button
                                onClick={() => updateProfile(surgeon.id, { usesFlipRooms: !profile.usesFlipRooms })}
                                className={`w-9 h-5 rounded-full transition-colors relative ${
                                  profile.usesFlipRooms ? 'bg-blue-600' : 'bg-slate-200'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                                  profile.usesFlipRooms ? 'translate-x-4' : 'translate-x-0.5'
                                }`} />
                              </button>
                              <span className="text-xs text-slate-600 font-medium">Flip rooms</span>
                            </label>
                          </div>
                        </div>

                        {/* Vendor (for joint only) */}
                        <div>
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">
                            Preferred Vendor
                          </label>
                          {profile.specialty === 'joint' ? (
                            <div className="space-y-1.5">
                              {VENDORS.map(vendor => (
                                <button
                                  key={vendor.value}
                                  onClick={() => updateProfile(surgeon.id, { preferredVendor: vendor.value as any })}
                                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                                    profile.preferredVendor === vendor.value
                                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="font-medium">{vendor.label}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-400">
                              Vendor selection applies to joint replacement surgeons only
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Step navigation */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => { setStep('facility'); setSelectedFacilityId(null) }}
                    className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('configure')}
                    disabled={!allProfilesConfigured}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: CONFIGURATION */}
        {/* ================================================================ */}
        {step === 'configure' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Generation Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Configure the scope and behavior of demo data generation</p>
            </div>

            <div className="space-y-4">
              {/* Data scope */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Data Scope</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Historical Data</label>
                    <select
                      value={monthsOfHistory}
                      onChange={e => setMonthsOfHistory(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={3}>3 months</option>
                      <option value={6}>6 months (recommended)</option>
                      <option value={9}>9 months</option>
                      <option value={12}>12 months</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Plus 1 month of future scheduled cases</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Pre-Generation</label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={purgeBeforeGenerate}
                        onChange={e => setPurgeBeforeGenerate(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm text-slate-700 font-medium">Purge existing data first</span>
                        <p className="text-xs text-slate-400">Remove all cases, milestones, and staff assignments before generating</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Facility configuration status */}
              {status && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Facility Configuration Status</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    These items should already be configured in the facility. The generator uses them as-is.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'OR Rooms', value: status.rooms, required: true },
                      { label: 'Procedure Types', value: status.procedureTypes, required: true },
                      { label: 'Facility Milestones', value: status.facilityMilestones, required: true },
                      { label: 'Payers', value: status.payers, required: true },
                      { label: 'Delay Types', value: status.delayTypes, required: false },
                      { label: 'Cost Categories', value: status.costCategories, required: false },
                      { label: 'Cancellation Reasons', value: status.cancellationReasons, required: false },
                      { label: 'Analytics Settings', value: status.facilityAnalyticsSettings ? 1 : 0, required: false },
                      { label: 'Reimbursement Rates', value: status.procedureReimbursements, required: false },
                      { label: 'Milestone Config', value: status.procedureMilestoneConfig, required: false },
                      { label: 'Checklist Fields', value: status.preopChecklistFields, required: false },
                      { label: 'Block Schedules', value: status.blockSchedules, required: false },
                    ].map(item => (
                      <div
                        key={item.label}
                        className={`p-3 rounded-lg border ${
                          item.value > 0
                            ? 'bg-emerald-50 border-emerald-200'
                            : item.required
                            ? 'bg-red-50 border-red-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.value > 0 ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : item.required ? (
                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                            </svg>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
                          )}
                          <span className="text-xs font-medium text-slate-600">{item.label}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 ml-5">
                          {item.label === 'Analytics Settings' ? (item.value ? 'Yes' : 'No') : item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('surgeons')}
                  className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 4: REVIEW & GENERATE */}
        {/* ================================================================ */}
        {step === 'review' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Review & Generate</h2>
              <p className="text-sm text-slate-500 mt-1">Confirm your configuration before generating demo data</p>
            </div>

            <div className="space-y-4">
              {/* Facility summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Facility</h3>
                <p className="text-lg font-semibold text-slate-900">{selectedFacility?.name}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {monthsOfHistory} months historical + 1 month future · {purgeBeforeGenerate ? 'Will purge first' : 'Append to existing'}
                </p>
              </div>

              {/* Surgeon summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Surgeon Profiles ({surgeons.length})
                </h3>
                <div className="space-y-2">
                  {surgeons.map(surgeon => {
                    const profile = surgeonProfiles[surgeon.id]
                    if (!profile) return null
                    return (
                      <div key={surgeon.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm">
                            {SPECIALTIES.find(s => s.value === profile.specialty)?.icon}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            Dr. {surgeon.first_name} {surgeon.last_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            profile.speedProfile === 'fast' ? 'bg-emerald-50 text-emerald-700' :
                            profile.speedProfile === 'slow' ? 'bg-amber-50 text-amber-700' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {profile.speedProfile}
                          </span>
                          <span>{profile.operatingDays.length} days/week</span>
                          {profile.usesFlipRooms && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">flip</span>
                          )}
                          {profile.specialty === 'joint' && profile.preferredVendor && (
                            <span className="text-slate-400">{profile.preferredVendor}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  {profileSummary.fast && <span>{profileSummary.fast} fast</span>}
                  {profileSummary.average && <span>{profileSummary.average} average</span>}
                  {profileSummary.slow && <span>{profileSummary.slow} slow</span>}
                </div>
              </div>

              {/* Estimated output */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Estimated Output</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      ~{estimateCases(surgeonProfiles, monthsOfHistory).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">total cases</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      ~{(estimateCases(surgeonProfiles, monthsOfHistory) * 9).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">milestones</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{monthsOfHistory + 1}</p>
                    <p className="text-xs text-slate-500">months span</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('configure')}
                    className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    ← Back
                  </button>
                  {status && status.cases > 0 && (
                    <button
                      onClick={handlePurgeOnly}
                      className="px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors"
                    >
                      Purge Only
                    </button>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Demo Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* RUNNING STATE */}
        {/* ================================================================ */}
        {step === 'running' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              {progress && progress.phase !== 'complete' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
                    <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Generating Demo Data</h3>
                  <p className="text-sm text-slate-500 mb-6">{progress.message}</p>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${progress.current}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{progress.current}% complete</p>
                </>
              ) : result ? (
                <>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
                    result.success ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    {result.success ? (
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${result.success ? 'text-slate-900' : 'text-red-800'}`}>
                    {result.success ? 'Generation Complete!' : 'Generation Failed'}
                  </h3>
                  {result.success && result.casesGenerated ? (
                    <p className="text-sm text-slate-500 mb-2">
                      Created {result.casesGenerated.toLocaleString()} cases with{' '}
                      {result.details?.milestones.toLocaleString()} milestones
                    </p>
                  ) : result.error ? (
                    <p className="text-sm text-red-600 mb-2">{result.error}</p>
                  ) : null}
                  <button
                    onClick={() => { setStep('review'); setResult(null) }}
                    className="mt-4 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    Back to Review
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function estimateCases(
  profiles: Record<string, SurgeonProfile>,
  months: number
): number {
  const workingDaysPerMonth = 22 // approximate
  let total = 0
  for (const profile of Object.values(profiles)) {
    const daysPerWeek = profile.operatingDays.length
    const daysPerMonth = (daysPerWeek / 5) * workingDaysPerMonth
    const casesPerDay =
      profile.speedProfile === 'fast' ? 7 :
      profile.speedProfile === 'slow' ? 3.5 : 5
    total += Math.round(daysPerMonth * casesPerDay * (months + 1))
  }
  return total
}
