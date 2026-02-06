// app/admin/demo-data/page.tsx
// ORbit Demo Data Wizard v2 — Interactive multi-step demo data management
// - Reads existing surgeons, staff, rooms, procedure types from facility
// - Surgeon config: speed profile, specialty, room assignment (flip or single), procedure types, operating days, vendor
// - Staff assignment: room-level (1 nurse, 2 techs, 1 anesthesiologist per room per day — no double-booking)
// - Never deletes users — only purges case-level data

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Facility { id: string; name: string; is_demo: boolean; case_number_prefix: string | null; timezone: string }
interface Surgeon { id: string; first_name: string; last_name: string; closing_workflow: string | null; closing_handoff_minutes: number | null }
interface ORRoom { id: string; name: string }
interface ProcedureType { id: string; name: string }

interface SurgeonProfile {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  usesFlipRooms: boolean
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[]
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
  primaryRoomId: string | null
  flipRoomId: string | null
  procedureTypeIds: string[]
}

interface DemoStatus {
  cases: number; surgeons: number; milestones: number; staff: number; implants: number
  rooms: number; procedureTypes: number; payers: number; delayTypes: number; costCategories: number
  facilityMilestones: number; cancellationReasons: number; preopChecklistFields: number
  complexities: number; facilityAnalyticsSettings: boolean
  procedureReimbursements: number; procedureMilestoneConfig: number; blockSchedules: number
}

interface GenerationProgress { phase: string; current: number; total: number; message: string }
interface GenerationResult { success: boolean; casesGenerated?: number; error?: string; details?: { milestones: number; staff: number; implants: number } }
type WizardStep = 'facility' | 'surgeons' | 'configure' | 'review' | 'running'

// ============================================================================
// CONSTANTS
// ============================================================================

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const WEEKDAY_VALUES = [1, 2, 3, 4, 5]

const VENDORS = [
  { value: 'Stryker', label: 'Stryker' },
  { value: 'Zimmer Biomet', label: 'Zimmer Biomet' },
  { value: 'DePuy Synthes', label: 'DePuy Synthes' },
]

const SPEED_PROFILES = [
  { value: 'fast' as const, label: 'Fast', desc: '6–8 cases/day · ~30 min surgical' },
  { value: 'average' as const, label: 'Average', desc: '4–6 cases/day · ~50 min surgical' },
  { value: 'slow' as const, label: 'Slow', desc: '3–4 cases/day · ~75 min surgical' },
]

const SPECIALTIES = [
  { value: 'joint' as const, label: 'Joint Replacement', icon: '🦴' },
  { value: 'hand_wrist' as const, label: 'Hand & Wrist', icon: '✋' },
  { value: 'spine' as const, label: 'Spine', icon: '🦷' },
]

const SPECIALTY_PROCS: Record<string, string[]> = {
  joint: ['THA', 'TKA', 'Mako THA', 'Mako TKA'],
  hand_wrist: ['Distal Radius ORIF', 'Carpal Tunnel Release', 'Trigger Finger Release', 'Wrist Arthroscopy', 'TFCC Repair'],
  spine: ['Lumbar Microdiscectomy', 'ACDF', 'Lumbar Laminectomy', 'Posterior Cervical Foraminotomy', 'Kyphoplasty'],
}

// ============================================================================
// API HELPER
// ============================================================================

async function apiCall(action: string, extra: Record<string, any> = {}) {
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

export default function DemoDataWizard() {
  // State
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [rooms, setRooms] = useState<ORRoom[]>([])
  const [procs, setProcs] = useState<ProcedureType[]>([])
  const [profiles, setProfiles] = useState<Record<string, SurgeonProfile>>({})
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [step, setStep] = useState<WizardStep>('facility')

  const [loading, setLoading] = useState(true)
  const [loadingFacility, setLoadingFacility] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)

  const [months, setMonths] = useState(6)
  const [purgeFirst, setPurgeFirst] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const facility = facilities.find(f => f.id === selectedFacilityId) || null

  // ── Load facilities on mount ──
  useEffect(() => {
    (async () => {
      setLoading(true)
      const d = await apiCall('list-facilities')
      if (d.facilities) setFacilities(d.facilities)
      setLoading(false)
    })()
  }, [])

  // ── Load facility details (surgeons, rooms, procs, status) ──
  async function loadFacility(fid: string) {
    setLoadingFacility(true)
    try {
      const [sD, rD, pD, stD] = await Promise.all([
        apiCall('list-surgeons', { facilityId: fid }),
        apiCall('list-rooms', { facilityId: fid }),
        apiCall('list-procedure-types', { facilityId: fid }),
        apiCall('status-detailed', { facilityId: fid }),
      ])
      const s: Surgeon[] = sD.surgeons || []
      const r: ORRoom[] = rD.rooms || []
      const p: ProcedureType[] = pD.procedureTypes || []

      setSurgeons(s)
      setRooms(r)
      setProcs(p)
      setStatus(stD)

      // Initialize profiles with smart defaults
      const newProfiles: Record<string, SurgeonProfile> = {}
      s.forEach((surgeon, idx) => {
        newProfiles[surgeon.id] = {
          surgeonId: surgeon.id,
          speedProfile: 'average',
          usesFlipRooms: false,
          specialty: 'joint',
          operatingDays: [1, 3],
          preferredVendor: 'Stryker',
          primaryRoomId: r.length > 0 ? r[idx % r.length].id : null,
          flipRoomId: null,
          procedureTypeIds: p.filter(pt => SPECIALTY_PROCS.joint?.includes(pt.name)).map(pt => pt.id),
        }
      })
      setProfiles(newProfiles)
      if (s.length > 0) setExpanded(s[0].id)
    } catch (e) {
      console.error('Error loading facility:', e)
    }
    setLoadingFacility(false)
  }

  // ── Profile management ──
  const updateProfile = useCallback((surgeonId: string, updates: Partial<SurgeonProfile>) => {
    setProfiles(prev => {
      const cur = prev[surgeonId]
      const next = { ...cur, ...updates }

      // Auto-select matching procedures when specialty changes
      if (updates.specialty && updates.specialty !== cur.specialty) {
        next.procedureTypeIds = procs
          .filter(p => SPECIALTY_PROCS[updates.specialty!]?.includes(p.name))
          .map(p => p.id)
        if (updates.specialty !== 'joint') next.preferredVendor = null
        else if (!next.preferredVendor) next.preferredVendor = 'Stryker'
      }

      // Auto-pick flip room
      if (updates.usesFlipRooms === true && !next.flipRoomId) {
        const other = rooms.filter(r => r.id !== next.primaryRoomId)
        next.flipRoomId = other[0]?.id || null
      }
      if (updates.usesFlipRooms === false) next.flipRoomId = null

      return { ...prev, [surgeonId]: next }
    })
  }, [procs, rooms])

  const toggleDay = useCallback((sid: string, day: number) => {
    setProfiles(prev => {
      const days = prev[sid].operatingDays
      return { ...prev, [sid]: { ...prev[sid], operatingDays: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort() } }
    })
  }, [])

  const toggleProc = useCallback((sid: string, pid: string) => {
    setProfiles(prev => {
      const ids = prev[sid].procedureTypeIds
      return { ...prev, [sid]: { ...prev[sid], procedureTypeIds: ids.includes(pid) ? ids.filter(i => i !== pid) : [...ids, pid] } }
    })
  }, [])

  // ── Actions ──
  async function selectFacility(fid: string) {
    setSelectedFacilityId(fid)
    setResult(null)
    await loadFacility(fid)
    setStep('surgeons')
  }

  async function generate() {
    if (!selectedFacilityId) return
    setStep('running')
    setResult(null)
    setProgress({ phase: 'starting', current: 0, total: 100, message: 'Initializing...' })
    try {
      const data = await apiCall('generate-wizard', {
        facilityId: selectedFacilityId,
        surgeonProfiles: Object.values(profiles),
        monthsOfHistory: months,
        purgeFirst,
      })
      setResult(data)
      if (data.success) {
        setProgress({ phase: 'complete', current: 100, total: 100, message: 'Done!' })
        await loadFacility(selectedFacilityId)
      } else {
        setProgress(null)
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message })
      setProgress(null)
    }
  }

  async function purgeOnly() {
    if (!selectedFacilityId || !confirm('Delete ALL case data (not users/config) for this facility?')) return
    setProgress({ phase: 'clearing', current: 0, total: 100, message: 'Purging...' })
    try {
      const d = await apiCall('clear', { facilityId: selectedFacilityId })
      setResult(d.success ? { success: true, casesGenerated: 0, error: `Purged ${d.casesDeleted || 'all'} cases` } : { success: false, error: d.error })
      await loadFacility(selectedFacilityId)
    } catch (e: any) {
      setResult({ success: false, error: e.message })
    }
    setProgress(null)
  }

  // ── Validation ──
  const errors = useMemo(() => {
    const errs: string[] = []
    for (const s of surgeons) {
      const p = profiles[s.id]
      if (!p) continue
      const n = `Dr. ${s.last_name}`
      if (!p.operatingDays.length) errs.push(`${n}: No operating days`)
      if (!p.primaryRoomId) errs.push(`${n}: No room assigned`)
      if (p.usesFlipRooms && !p.flipRoomId) errs.push(`${n}: No flip room selected`)
      if (p.usesFlipRooms && p.primaryRoomId === p.flipRoomId) errs.push(`${n}: Same room for both`)
      if (!p.procedureTypeIds.length) errs.push(`${n}: No procedures selected`)
    }
    return errs
  }, [surgeons, profiles])

  const isValid = errors.length === 0 && surgeons.length > 0

  const summary = useMemo(() => {
    const c: Record<string, number> = {}
    Object.values(profiles).forEach(p => { c[p.speedProfile] = (c[p.speedProfile] || 0) + 1 })
    return c
  }, [profiles])

  const estCases = useMemo(() => estimateCases(profiles, months), [profiles, months])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Demo Data Wizard</h1>
              <p className="text-xs text-slate-500">Generate realistic surgical data for demos</p>
            </div>
          </div>
          {facility && step !== 'facility' && (
            <button onClick={() => { setStep('facility'); setSelectedFacilityId(null); setResult(null) }}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Change facility
            </button>
          )}
        </div>
      </div>

      {/* ── Step indicator ── */}
      {step !== 'facility' && step !== 'running' && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-2">
            {(['surgeons', 'configure', 'review'] as const).map((s, i) => {
              const labels: Record<string, string> = { surgeons: 'Surgeon Profiles', configure: 'Settings', review: 'Review & Generate' }
              const allSteps = ['surgeons', 'configure', 'review'] as const
              const curIdx = allSteps.indexOf(step as typeof allSteps[number])
              const active = s === step
              const done = i < curIdx
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${done || active ? 'bg-blue-400' : 'bg-slate-200'}`} />}
                  <button onClick={() => done && setStep(s)} disabled={!done}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : done ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                      : 'bg-slate-100 text-slate-400'
                    }`}>
                    {done && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    {labels[s]}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Result banner */}
        {result && step !== 'running' && <ResultBanner result={result} onDismiss={() => setResult(null)} />}

        {/* ================================================================ */}
        {/* STEP 1: SELECT FACILITY                                         */}
        {/* ================================================================ */}
        {step === 'facility' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Select Demo Facility</h2>
              <p className="text-sm text-slate-500 mt-1">Choose which facility to generate demo data for</p>
            </div>
            {facilities.length === 0 ? (
              <EmptyState icon="building" title="No demo facilities found" description="Set is_demo = true on facilities to enable them here." />
            ) : (
              <div className="grid gap-4">
                {facilities.map(f => (
                  <button key={f.id} onClick={() => selectFacility(f.id)}
                    className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                          <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{f.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{f.timezone} · {f.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: SURGEON PROFILES                                        */}
        {/* ================================================================ */}
        {step === 'surgeons' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Surgeon Profiles</h2>
                <p className="text-sm text-slate-500 mt-1">{facility?.name} — Configure pace, rooms, and procedures</p>
              </div>
              {status && status.cases > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-amber-700">{status.cases.toLocaleString()} existing cases</span>
                </div>
              )}
            </div>

            {loadingFacility ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading facility data...</p>
              </div>
            ) : surgeons.length === 0 ? (
              <EmptyState icon="warning" title="No surgeons found" description="Add surgeons via Staff Management first." />
            ) : (
              <div className="space-y-3">
                {/* ── Weekly Schedule Grid ── */}
                <ScheduleGrid
                  rooms={rooms}
                  surgeons={surgeons}
                  profiles={profiles}
                />
                {surgeons.map(surgeon => {
                  const p = profiles[surgeon.id]
                  if (!p) return null
                  const isOpen = expanded === surgeon.id

                  return (
                    <div key={surgeon.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* ── Surgeon header ── */}
                      <button onClick={() => setExpanded(isOpen ? null : surgeon.id)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                            {surgeon.first_name[0]}{surgeon.last_name[0]}
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Dr. {surgeon.first_name} {surgeon.last_name}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {SPECIALTIES.find(s => s.value === p.specialty)?.icon}{' '}
                              {SPECIALTIES.find(s => s.value === p.specialty)?.label}
                              {' · '}{p.usesFlipRooms
                                ? `${rooms.find(r => r.id === p.primaryRoomId)?.name || '?'} ↔ ${rooms.find(r => r.id === p.flipRoomId)?.name || '?'}`
                                : rooms.find(r => r.id === p.primaryRoomId)?.name || 'No room'}
                              {' · '}{p.procedureTypeIds.length} procedures
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            p.speedProfile === 'fast' ? 'bg-emerald-50 text-emerald-700'
                            : p.speedProfile === 'slow' ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                          }`}>{p.speedProfile}</span>
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* ── Expanded config ── */}
                      {isOpen && (
                        <div className="px-5 pb-5 border-t border-slate-100 pt-5">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left column */}
                            <div className="space-y-5">
                              <FieldGroup label="Speed Profile">
                                <div className="flex gap-2">
                                  {SPEED_PROFILES.map(sp => (
                                    <button key={sp.value} onClick={() => updateProfile(surgeon.id, { speedProfile: sp.value })}
                                      className={`flex-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                                        p.speedProfile === sp.value
                                          ? sp.value === 'fast' ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                          : sp.value === 'slow' ? 'border-amber-300 bg-amber-50 text-amber-800'
                                          : 'border-blue-300 bg-blue-50 text-blue-800'
                                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                      }`}>
                                      <span className="font-medium block">{sp.label}</span>
                                      <span className="text-[10px] opacity-70 block mt-0.5">{sp.desc}</span>
                                    </button>
                                  ))}
                                </div>
                              </FieldGroup>

                              <FieldGroup label="Specialty">
                                <div className="flex gap-2">
                                  {SPECIALTIES.map(spec => (
                                    <button key={spec.value} onClick={() => updateProfile(surgeon.id, { specialty: spec.value })}
                                      className={`flex-1 px-3 py-2.5 rounded-lg border text-sm flex items-center justify-center gap-2 transition-all ${
                                        p.specialty === spec.value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                      }`}>
                                      <span>{spec.icon}</span><span className="font-medium">{spec.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </FieldGroup>

                              <FieldGroup label="Operating Days">
                                <div className="flex gap-1.5">
                                  {WEEKDAYS.map((day, i) => (
                                    <button key={day} onClick={() => toggleDay(surgeon.id, WEEKDAY_VALUES[i])}
                                      className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                        p.operatingDays.includes(WEEKDAY_VALUES[i])
                                          ? 'bg-blue-600 text-white shadow-sm'
                                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                      }`}>
                                      {day}
                                    </button>
                                  ))}
                                </div>
                              </FieldGroup>

                              {p.specialty === 'joint' && (
                                <FieldGroup label="Preferred Vendor">
                                  <div className="flex gap-2">
                                    {VENDORS.map(v => (
                                      <button key={v.value} onClick={() => updateProfile(surgeon.id, { preferredVendor: v.value as any })}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                          p.preferredVendor === v.value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}>
                                        {v.label}
                                      </button>
                                    ))}
                                  </div>
                                </FieldGroup>
                              )}
                            </div>

                            {/* Right column */}
                            <div className="space-y-5">
                              <FieldGroup label="Room Assignment">
                                <div className="flex items-center gap-3 mb-3">
                                  <button onClick={() => updateProfile(surgeon.id, { usesFlipRooms: !p.usesFlipRooms })}
                                    className={`relative flex-shrink-0 rounded-full transition-colors ${p.usesFlipRooms ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    style={{ width: 40, height: 22 }}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-[3px] transition-transform ${
                                      p.usesFlipRooms ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
                                  </button>
                                  <span className="text-sm text-slate-600 font-medium">
                                    {p.usesFlipRooms ? 'Flip rooms (2 rooms)' : 'Single room'}
                                  </span>
                                </div>
                                {p.usesFlipRooms ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[11px] text-slate-400 font-medium mb-1 block">Room A</label>
                                      <select value={p.primaryRoomId || ''} onChange={e => updateProfile(surgeon.id, { primaryRoomId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Select…</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[11px] text-slate-400 font-medium mb-1 block">Room B</label>
                                      <select value={p.flipRoomId || ''} onChange={e => updateProfile(surgeon.id, { flipRoomId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Select…</option>
                                        {rooms.filter(r => r.id !== p.primaryRoomId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  <select value={p.primaryRoomId || ''} onChange={e => updateProfile(surgeon.id, { primaryRoomId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select room…</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                  </select>
                                )}
                              </FieldGroup>

                              <FieldGroup label={`Procedures (${p.procedureTypeIds.length} selected)`}>
                                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                  {procs.map(proc => {
                                    const sel = p.procedureTypeIds.includes(proc.id)
                                    const rec = SPECIALTY_PROCS[p.specialty]?.includes(proc.name)
                                    return (
                                      <label key={proc.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                        <input type="checkbox" checked={sel} onChange={() => toggleProc(surgeon.id, proc.id)}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className={`text-sm ${sel ? 'text-blue-800 font-medium' : 'text-slate-600'}`}>{proc.name}</span>
                                        {rec && !sel && <span className="text-[10px] text-slate-400 ml-auto">recommended</span>}
                                      </label>
                                    )
                                  })}
                                </div>
                              </FieldGroup>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Validation errors */}
                {errors.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-xs font-semibold text-red-700 mb-2">Fix before continuing:</p>
                    {errors.map((e, i) => <p key={i} className="text-xs text-red-600 ml-2">• {e}</p>)}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <button onClick={() => { setStep('facility'); setSelectedFacilityId(null) }}
                    className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">← Back</button>
                  <button onClick={() => setStep('configure')} disabled={!isValid}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors">
                    Continue →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: CONFIGURATION                                           */}
        {/* ================================================================ */}
        {step === 'configure' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Generation Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Configure scope of demo data generation</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Data Scope</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Historical Data</label>
                    <select value={months} onChange={e => setMonths(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                      <input type="checkbox" checked={purgeFirst} onChange={e => setPurgeFirst(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <div>
                        <span className="text-sm text-slate-700 font-medium">Purge existing case data first</span>
                        <p className="text-xs text-slate-400">Deletes cases, milestones, staff assignments, implants. Never deletes users or config.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Facility config status */}
              {status && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Facility Configuration Status</h3>
                  <p className="text-xs text-slate-500 mb-3">Must be set up before generation. The script uses these as-is.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                      { l: 'OR Rooms', v: status.rooms, r: true },
                      { l: 'Procedures', v: status.procedureTypes, r: true },
                      { l: 'Milestones', v: status.facilityMilestones, r: true },
                      { l: 'Payers', v: status.payers, r: true },
                      { l: 'Delay Types', v: status.delayTypes, r: false },
                      { l: 'Cost Categories', v: status.costCategories, r: false },
                      { l: 'Reimbursements', v: status.procedureReimbursements, r: false },
                      { l: 'Analytics Config', v: status.facilityAnalyticsSettings ? 1 : 0, r: false },
                    ] as const).map(item => (
                      <div key={item.l} className={`p-3 rounded-lg border ${
                        item.v > 0 ? 'bg-emerald-50 border-emerald-200'
                        : item.r ? 'bg-red-50 border-red-200'
                        : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.v > 0 ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          ) : item.r ? (
                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
                          )}
                          <span className="text-xs font-medium text-slate-600">{item.l}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 ml-5">{item.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep('surgeons')} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium">← Back</button>
                <button onClick={() => setStep('review')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">Continue →</button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 4: REVIEW & GENERATE                                       */}
        {/* ================================================================ */}
        {step === 'review' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Review & Generate</h2>
              <p className="text-sm text-slate-500 mt-1">Confirm configuration before generating</p>
            </div>

            <div className="space-y-4">
              {/* Facility */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Facility</h3>
                <p className="text-lg font-semibold text-slate-900">{facility?.name}</p>
                <p className="text-sm text-slate-500 mt-1">{months} months historical + 1 month future · {purgeFirst ? 'Purge first' : 'Append'}</p>
              </div>

              {/* Surgeons */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Surgeons ({surgeons.length})</h3>
                <div className="space-y-2">
                  {surgeons.map(s => {
                    const pr = profiles[s.id]
                    if (!pr) return null
                    const rm = pr.usesFlipRooms
                      ? `${rooms.find(r => r.id === pr.primaryRoomId)?.name || '?'} ↔ ${rooms.find(r => r.id === pr.flipRoomId)?.name || '?'}`
                      : rooms.find(r => r.id === pr.primaryRoomId)?.name || '—'
                    return (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span>{SPECIALTIES.find(x => x.value === pr.specialty)?.icon}</span>
                          <span className="text-sm font-medium text-slate-700">Dr. {s.first_name} {s.last_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            pr.speedProfile === 'fast' ? 'bg-emerald-50 text-emerald-700'
                            : pr.speedProfile === 'slow' ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                          }`}>{pr.speedProfile}</span>
                          <span>{rm}</span>
                          <span>{pr.operatingDays.length}d/wk</span>
                          <span>{pr.procedureTypeIds.length} procs</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  {summary.fast && <span>{summary.fast} fast</span>}
                  {summary.average && <span>{summary.average} average</span>}
                  {summary.slow && <span>{summary.slow} slow</span>}
                </div>
              </div>

              {/* Estimated output */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Estimated Output</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div><p className="text-2xl font-bold text-slate-900">~{estCases.toLocaleString()}</p><p className="text-xs text-slate-500">cases</p></div>
                  <div><p className="text-2xl font-bold text-slate-900">~{(estCases * 9).toLocaleString()}</p><p className="text-xs text-slate-500">milestones</p></div>
                  <div><p className="text-2xl font-bold text-slate-900">{months + 1}</p><p className="text-xs text-slate-500">months</p></div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <div className="flex gap-2">
                  <button onClick={() => setStep('configure')} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium">← Back</button>
                  {status && status.cases > 0 && (
                    <button onClick={purgeOnly} className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">Purge Only</button>
                  )}
                </div>
                <button onClick={generate}
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Generate Demo Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* RUNNING STATE                                                   */}
        {/* ================================================================ */}
        {step === 'running' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              {progress && progress.phase !== 'complete' && !result ? (
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
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress.current}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{progress.current}%</p>
                </>
              ) : result ? (
                <>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${result.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {result.success
                      ? <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    }
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${result.success ? 'text-slate-900' : 'text-red-800'}`}>
                    {result.success ? 'Generation Complete!' : 'Generation Failed'}
                  </h3>
                  {result.success && result.casesGenerated ? (
                    <p className="text-sm text-slate-500 mb-2">
                      {result.casesGenerated.toLocaleString()} cases · {result.details?.milestones.toLocaleString()} milestones · {result.details?.staff.toLocaleString()} staff · {result.details?.implants.toLocaleString()} implants
                    </p>
                  ) : result.error ? (
                    <p className="text-sm text-red-600 mb-2">{result.error}</p>
                  ) : null}
                  <button onClick={() => { setStep('review'); setResult(null) }}
                    className="mt-4 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
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
// SUB-COMPONENTS
// ============================================================================

const SURGEON_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
]

function ScheduleGrid({ rooms, surgeons, profiles }: {
  rooms: ORRoom[]
  surgeons: Surgeon[]
  profiles: Record<string, SurgeonProfile>
}) {
  // Build color map: surgeonId → color index
  const colorMap = useMemo(() => {
    const map: Record<string, number> = {}
    surgeons.forEach((s, i) => { map[s.id] = i % SURGEON_COLORS.length })
    return map
  }, [surgeons])

  // Build schedule: for each room + day, which surgeons are there?
  const schedule = useMemo(() => {
    // Map: roomId → dayNumber → surgeonIds[]
    const grid: Record<string, Record<number, string[]>> = {}
    for (const room of rooms) {
      grid[room.id] = { 1: [], 2: [], 3: [], 4: [], 5: [] }
    }

    for (const surgeon of surgeons) {
      const p = profiles[surgeon.id]
      if (!p) continue

      for (const day of p.operatingDays) {
        if (p.primaryRoomId && grid[p.primaryRoomId]) {
          grid[p.primaryRoomId][day].push(surgeon.id)
        }
        if (p.usesFlipRooms && p.flipRoomId && grid[p.flipRoomId]) {
          grid[p.flipRoomId][day].push(surgeon.id)
        }
      }
    }
    return grid
  }, [rooms, surgeons, profiles])

  // Find rooms that have at least one surgeon assigned
  const activeRooms = useMemo(() => {
    return rooms.filter(room => {
      const days = schedule[room.id]
      if (!days) return false
      return Object.values(days).some(sIds => sIds.length > 0)
    })
  }, [rooms, schedule])

  // Also show unassigned rooms (but de-emphasize)
  const unassignedRooms = rooms.filter(r => !activeRooms.find(ar => ar.id === r.id))

  if (rooms.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700">Weekly OR Schedule</h3>
        </div>
        <p className="text-[11px] text-slate-400">Updates live as you configure surgeons below</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left font-semibold text-slate-500 w-28 border-r border-slate-100">Room</th>
              {WEEKDAYS.map(day => (
                <th key={day} className="px-2 py-2 text-center font-semibold text-slate-500 border-r border-slate-100 last:border-r-0">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRooms.map(room => (
              <tr key={room.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2.5 font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">
                  {room.name}
                </td>
                {WEEKDAY_VALUES.map(day => {
                  const surgeonIds = schedule[room.id]?.[day] || []
                  return (
                    <td key={day} className="px-1.5 py-1.5 border-r border-slate-100 last:border-r-0 align-top">
                      <div className="flex flex-col gap-1 min-h-[28px]">
                        {surgeonIds.map(sId => {
                          const surgeon = surgeons.find(s => s.id === sId)
                          if (!surgeon) return null
                          const p = profiles[sId]
                          const color = SURGEON_COLORS[colorMap[sId]]
                          const isFlip = p?.usesFlipRooms && p.flipRoomId === room.id
                          return (
                            <div key={sId} className={`px-2 py-1 rounded-md border text-[11px] font-medium leading-tight ${color.bg} ${color.text} ${color.border}`}>
                              <span>{surgeon.last_name}</span>
                              {isFlip && <span className="opacity-60 ml-1">↔</span>}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            {unassignedRooms.length > 0 && activeRooms.length > 0 && (
              <tr className="border-t border-slate-100">
                <td colSpan={6} className="px-3 py-2 text-[11px] text-slate-400 italic">
                  {unassignedRooms.length} room{unassignedRooms.length > 1 ? 's' : ''} unassigned: {unassignedRooms.map(r => r.name).join(', ')}
                </td>
              </tr>
            )}
            {activeRooms.length === 0 && (
              <tr className="border-t border-slate-100">
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400 text-xs">
                  No rooms assigned yet — configure surgeons below to populate the schedule
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {surgeons.length > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-x-4 gap-y-1">
          {surgeons.map(s => {
            const color = SURGEON_COLORS[colorMap[s.id]]
            const p = profiles[s.id]
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${color.bg} ${color.border} border`} />
                <span className="text-[11px] text-slate-500">
                  {s.last_name}
                  {p?.usesFlipRooms && <span className="text-slate-400"> (flip)</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">{label}</label>
      {children}
    </div>
  )
}

function ResultBanner({ result, onDismiss }: { result: GenerationResult; onDismiss: () => void }) {
  return (
    <div className={`mb-6 rounded-xl border p-4 flex items-start gap-3 ${
      result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        result.success ? 'bg-emerald-100' : 'bg-red-100'
      }`}>
        {result.success
          ? <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          : <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
          {result.success
            ? result.casesGenerated ? `Generated ${result.casesGenerated.toLocaleString()} cases` : (result.error || 'Done')
            : 'Operation failed'
          }
        </p>
        {!result.success && result.error && <p className="text-sm text-red-700 mt-1">{result.error}</p>}
      </div>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 p-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

function EmptyState({ icon, title, description }: { icon: 'building' | 'warning'; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
        icon === 'warning' ? 'bg-amber-50' : 'bg-slate-100'
      }`}>
        {icon === 'warning' ? (
          <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )}
      </div>
      <p className="text-slate-700 font-medium">{title}</p>
      <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">{description}</p>
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function estimateCases(profiles: Record<string, SurgeonProfile>, months: number): number {
  const workingDaysPerMonth = 22
  let total = 0
  for (const p of Object.values(profiles)) {
    const daysPerMonth = (p.operatingDays.length / 5) * workingDaysPerMonth
    const casesPerDay = p.speedProfile === 'fast' ? 7 : p.speedProfile === 'slow' ? 3.5 : 5
    total += Math.round(daysPerMonth * casesPerDay * (months + 1))
  }
  return total
}
