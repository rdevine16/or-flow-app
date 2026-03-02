'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import Card from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import SurgeonPool from '@/components/integrations/test-data/SurgeonPool'
import ProcedurePool from '@/components/integrations/test-data/ProcedurePool'
import RoomPool from '@/components/integrations/test-data/RoomPool'
import PatientPool from '@/components/integrations/test-data/PatientPool'
import DiagnosisPool from '@/components/integrations/test-data/DiagnosisPool'
import {
  Play,
  Eye,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  XCircle,
  FlaskConical,
  ExternalLink,
  Database,
  CalendarClock,
} from 'lucide-react'
import type { ScenarioType } from '@/lib/hl7v2/test-harness/scenario-runner'
import type { Specialty } from '@/lib/hl7v2/test-harness/surgical-data'
import { ALL_SPECIALTIES } from '@/lib/hl7v2/test-harness/surgical-data'

// -- Types --------------------------------------------------------------------

interface Facility {
  id: string
  name: string
}

interface MessagePreview {
  sequenceNumber: number
  description: string
  triggerEvent: string
  caseId: string
  procedure: string
  surgeon: string
  patient: string
  room: string
  scheduledTime: string
  rawMessage: string
}

interface PreviewResponse {
  type: string
  totalCases: number
  totalMessages: number
  dateRange: { start: string; end: string }
  messages: MessagePreview[]
}

interface SendResultItem {
  sequenceNumber: number
  messageControlId: string
  caseId: string
  triggerEvent: string
  status: 'success' | 'error'
  ackCode?: string
  errorMessage?: string
  description: string
}

interface SendResponse {
  type: string
  summary: {
    totalSent: number
    succeeded: number
    failed: number
  }
  results: SendResultItem[]
}

// -- Top-level tab types ------------------------------------------------------

type TopTab = 'scenarios' | 'entity-pools' | 'schedules'
type EntityPoolTab = 'surgeons' | 'procedures' | 'rooms' | 'patients' | 'diagnoses'

const TOP_TABS: { value: TopTab; label: string; icon: React.ReactNode }[] = [
  { value: 'scenarios', label: 'Run Scenarios', icon: <Play className="w-4 h-4" /> },
  { value: 'entity-pools', label: 'Entity Pools', icon: <Database className="w-4 h-4" /> },
  { value: 'schedules', label: 'Schedules', icon: <CalendarClock className="w-4 h-4" /> },
]

const ENTITY_POOL_TABS: { value: EntityPoolTab; label: string }[] = [
  { value: 'surgeons', label: 'Surgeons' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'patients', label: 'Patients' },
  { value: 'diagnoses', label: 'Diagnoses' },
]

// -- Scenario config ----------------------------------------------------------

const SCENARIO_OPTIONS: { value: ScenarioType; label: string; description: string }[] = [
  {
    value: 'full-day',
    label: 'Full Day',
    description: 'A complete surgical day with cases across 4 OR rooms, 7:30am-5pm',
  },
  {
    value: 'chaos',
    label: 'Chaos Day',
    description: 'Normal day + reschedules, cancellations, and add-on cases',
  },
  {
    value: 'multi-day',
    label: 'Multi-Day (Week)',
    description: 'Five business days of surgical schedules',
  },
]

const SPECIALTY_OPTIONS: { value: Specialty; label: string }[] = [
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'gi', label: 'GI' },
  { value: 'spine', label: 'Spine' },
  { value: 'general', label: 'General Surgery' },
]

// -- Main Component -----------------------------------------------------------

export default function HL7v2TestHarnessPage() {
  const router = useRouter()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Tab state
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('scenarios')
  const [activePoolTab, setActivePoolTab] = useState<EntityPoolTab>('surgeons')

  // Facility selector (shared across tabs)
  const [selectedFacilityId, setSelectedFacilityId] = useState('')

  // Scenario form state
  const [scenarioType, setScenarioType] = useState<ScenarioType>('full-day')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [caseCount, setCaseCount] = useState(15)
  const [startDate, setStartDate] = useState('')
  const [dayCount, setDayCount] = useState(5)
  const [selectedSpecialties, setSelectedSpecialties] = useState<Specialty[]>([...ALL_SPECIALTIES])

  // Execution state
  const [running, setRunning] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [results, setResults] = useState<SendResponse | null>(null)
  const [expandedMessage, setExpandedMessage] = useState<number | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Load facilities
  const { data: facilities, loading: facilitiesLoading, error: facilitiesError } = useSupabaseQuery<Facility[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facilities')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data || []
    },
    { enabled: isGlobalAdmin }
  )

  // Build request body
  const buildRequestBody = useCallback(
    (previewOnly: boolean) => ({
      scenario: scenarioType,
      facilityId: selectedFacilityId,
      specialties: selectedSpecialties.length < ALL_SPECIALTIES.length ? selectedSpecialties : undefined,
      caseCount: caseCount !== 15 ? caseCount : undefined,
      startDate: startDate || undefined,
      dayCount: scenarioType === 'multi-day' && dayCount !== 5 ? dayCount : undefined,
      previewOnly,
    }),
    [scenarioType, selectedFacilityId, selectedSpecialties, caseCount, startDate, dayCount]
  )

  // Preview handler
  const handlePreview = async () => {
    if (!selectedFacilityId) {
      showToast({ type: 'error', title: 'Select a facility first' })
      return
    }

    setPreviewing(true)
    setPreview(null)
    setResults(null)

    try {
      const res = await fetch('/api/integrations/test-harness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(true)),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json() as PreviewResponse
      setPreview(data)
      showToast({ type: 'success', title: `Generated ${data.totalMessages} messages for preview` })
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to generate preview' })
    } finally {
      setPreviewing(false)
    }
  }

  // Run handler
  const handleRun = async () => {
    if (!selectedFacilityId) {
      showToast({ type: 'error', title: 'Select a facility first' })
      return
    }

    setRunning(true)
    setResults(null)

    try {
      const res = await fetch('/api/integrations/test-harness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(false)),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json() as SendResponse
      setResults(data)
      setPreview(null)

      const { summary } = data
      if (summary.failed === 0) {
        showToast({ type: 'success', title: `All ${summary.succeeded} messages processed successfully` })
      } else {
        showToast({ type: 'error', title: `${summary.succeeded} succeeded, ${summary.failed} failed` })
      }
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to run scenario' })
    } finally {
      setRunning(false)
    }
  }

  // Toggle specialty selection
  const toggleSpecialty = (spec: Specialty) => {
    setSelectedSpecialties((prev) =>
      prev.includes(spec)
        ? prev.filter((s) => s !== spec)
        : [...prev, spec]
    )
  }

  if (userLoading || !isGlobalAdmin) {
    return <PageLoader message="Loading..." />
  }

  return (
    <DashboardLayout>
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-6 h-6 text-violet-600" />
                HL7v2 Test Harness
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Generate realistic SIU messages to test the HL7v2 integration pipeline
              </p>
            </div>
          </div>

          {facilitiesError && <ErrorBanner message={facilitiesError} />}

          {/* Facility Selector (shared across all tabs) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Facility
            </label>
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={facilitiesLoading}
            >
              <option value="">Select a facility...</option>
              {facilities?.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              All test data is scoped to the selected facility
            </p>
          </div>

          {/* Top-level Tabs */}
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex gap-6" aria-label="Tabs">
              {TOP_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTopTab(tab.value)}
                  className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTopTab === tab.value
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTopTab === 'scenarios' && (
            <ScenarioTab
              selectedFacilityId={selectedFacilityId}
              scenarioType={scenarioType}
              setScenarioType={setScenarioType}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              caseCount={caseCount}
              setCaseCount={setCaseCount}
              startDate={startDate}
              setStartDate={setStartDate}
              dayCount={dayCount}
              setDayCount={setDayCount}
              selectedSpecialties={selectedSpecialties}
              toggleSpecialty={toggleSpecialty}
              running={running}
              previewing={previewing}
              preview={preview}
              results={results}
              expandedMessage={expandedMessage}
              setExpandedMessage={setExpandedMessage}
              handlePreview={handlePreview}
              handleRun={handleRun}
            />
          )}

          {activeTopTab === 'entity-pools' && (
            <EntityPoolsTab
              selectedFacilityId={selectedFacilityId}
              activePoolTab={activePoolTab}
              setActivePoolTab={setActivePoolTab}
            />
          )}

          {activeTopTab === 'schedules' && (
            <SchedulesPlaceholder />
          )}
        </div>
      </Container>
    </DashboardLayout>
  )
}

// -- Scenario Tab (extracted from original) -----------------------------------

interface ScenarioTabProps {
  selectedFacilityId: string
  scenarioType: ScenarioType
  setScenarioType: (t: ScenarioType) => void
  showAdvanced: boolean
  setShowAdvanced: (v: boolean) => void
  caseCount: number
  setCaseCount: (n: number) => void
  startDate: string
  setStartDate: (s: string) => void
  dayCount: number
  setDayCount: (n: number) => void
  selectedSpecialties: Specialty[]
  toggleSpecialty: (spec: Specialty) => void
  running: boolean
  previewing: boolean
  preview: PreviewResponse | null
  results: SendResponse | null
  expandedMessage: number | null
  setExpandedMessage: (n: number | null) => void
  handlePreview: () => void
  handleRun: () => void
}

function ScenarioTab({
  selectedFacilityId,
  scenarioType,
  setScenarioType,
  showAdvanced,
  setShowAdvanced,
  caseCount,
  setCaseCount,
  startDate,
  setStartDate,
  dayCount,
  setDayCount,
  selectedSpecialties,
  toggleSpecialty,
  running,
  previewing,
  preview,
  results,
  expandedMessage,
  setExpandedMessage,
  handlePreview,
  handleRun,
}: ScenarioTabProps) {
  return (
    <>
      {/* Control Panel */}
      <Card>
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Scenario Configuration</h2>

          {/* Scenario Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Scenario
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SCENARIO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScenarioType(opt.value)}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${
                    scenarioType === opt.value
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm text-slate-900">{opt.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Options (Collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 pl-5 border-l-2 border-slate-200">
                {/* Case Count */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Number of Cases
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={caseCount}
                    onChange={(e) => setCaseCount(parseInt(e.target.value, 10) || 15)}
                    className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Defaults to next business day if not set
                  </p>
                </div>

                {/* Day Count (multi-day only) */}
                {scenarioType === 'multi-day' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Number of Days
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={14}
                      value={dayCount}
                      onChange={(e) => setDayCount(parseInt(e.target.value, 10) || 5)}
                      className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Specialties */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Specialties
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTY_OPTIONS.map((spec) => (
                      <button
                        key={spec.value}
                        type="button"
                        onClick={() => toggleSpecialty(spec.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedSpecialties.includes(spec.value)
                            ? 'bg-violet-100 text-violet-700 border border-violet-300'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {spec.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Button
              onClick={handlePreview}
              variant="secondary"
              loading={previewing}
              disabled={running || !selectedFacilityId}
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Preview Messages
            </Button>
            <Button
              onClick={handleRun}
              loading={running}
              disabled={previewing || !selectedFacilityId}
            >
              <Play className="w-4 h-4 mr-1.5" />
              Run Scenario
            </Button>

            {selectedFacilityId && (
              <a
                href="/settings/integrations/epic"
                className="ml-auto text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Integration Logs
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Progress / Running State */}
      {running && (
        <Card>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-violet-600 animate-pulse" />
            <div>
              <div className="text-sm font-medium text-slate-900">
                Sending messages...
              </div>
              <div className="text-xs text-slate-500">
                Messages are being sent to the HL7v2 listener endpoint
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Results */}
      {preview && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Message Preview
              </h2>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>{preview.totalMessages} messages</span>
                <span>{preview.totalCases} cases</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {preview.messages.map((msg) => (
                <div key={msg.sequenceNumber} className="py-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedMessage(
                        expandedMessage === msg.sequenceNumber ? null : msg.sequenceNumber
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-6">
                        #{msg.sequenceNumber}
                      </span>
                      <Badge variant={getTriggerBadgeVariant(msg.triggerEvent)} size="sm">
                        {msg.triggerEvent}
                      </Badge>
                      <span className="text-sm text-slate-900">{msg.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{msg.room}</span>
                      <span>{new Date(msg.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      {expandedMessage === msg.sequenceNumber
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {expandedMessage === msg.sequenceNumber && (
                    <div className="mt-3 ml-9">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-slate-500">Case ID:</span>{' '}
                          <span className="font-mono text-slate-700">{msg.caseId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Procedure:</span>{' '}
                          <span className="text-slate-700">{msg.procedure}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Surgeon:</span>{' '}
                          <span className="text-slate-700">{msg.surgeon}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Patient:</span>{' '}
                          <span className="text-slate-700">{msg.patient}</span>
                        </div>
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                          Raw HL7v2 Message
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-50 rounded-lg overflow-x-auto font-mono text-slate-700 whitespace-pre-wrap">
                          {msg.rawMessage.replace(/\r/g, '\n')}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Send Results */}
      {results && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Results</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">
                  {results.summary.totalSent}
                </div>
                <div className="text-xs text-slate-500 mt-1">Total Sent</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {results.summary.succeeded}
                </div>
                <div className="text-xs text-green-600 mt-1">Succeeded</div>
              </div>
              <div className={`rounded-lg p-4 text-center ${results.summary.failed > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className={`text-2xl font-bold ${results.summary.failed > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                  {results.summary.failed}
                </div>
                <div className={`text-xs mt-1 ${results.summary.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  Failed
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {results.results.map((r) => (
                <div key={r.sequenceNumber} className="py-2.5 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-6">
                    #{r.sequenceNumber}
                  </span>
                  {r.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <Badge variant={getTriggerBadgeVariant(r.triggerEvent)} size="sm">
                    {r.triggerEvent}
                  </Badge>
                  <span className="text-sm text-slate-700 flex-1 truncate">
                    {r.description}
                  </span>
                  {r.ackCode && (
                    <Badge
                      variant={r.ackCode === 'AA' ? 'success' : 'error'}
                      size="sm"
                    >
                      {r.ackCode}
                    </Badge>
                  )}
                  {r.errorMessage && (
                    <span className="text-xs text-red-600 truncate max-w-[200px]" title={r.errorMessage}>
                      {r.errorMessage}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-4 text-sm">
              <a
                href="/settings/integrations/epic"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Integration Logs
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

// -- Entity Pools Tab ---------------------------------------------------------

interface EntityPoolsTabProps {
  selectedFacilityId: string
  activePoolTab: EntityPoolTab
  setActivePoolTab: (tab: EntityPoolTab) => void
}

function EntityPoolsTab({ selectedFacilityId, activePoolTab, setActivePoolTab }: EntityPoolsTabProps) {
  if (!selectedFacilityId) {
    return (
      <Card>
        <div className="py-12 text-center text-slate-500">
          <Database className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">Select a facility above</p>
          <p className="text-xs text-slate-400 mt-1">Entity pool data is scoped per facility</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {ENTITY_POOL_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActivePoolTab(tab.value)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activePoolTab === tab.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pool content */}
      {activePoolTab === 'surgeons' && <SurgeonPool facilityId={selectedFacilityId} />}
      {activePoolTab === 'procedures' && <ProcedurePool facilityId={selectedFacilityId} />}
      {activePoolTab === 'rooms' && <RoomPool facilityId={selectedFacilityId} />}
      {activePoolTab === 'patients' && <PatientPool facilityId={selectedFacilityId} />}
      {activePoolTab === 'diagnoses' && <DiagnosisPool facilityId={selectedFacilityId} />}
    </div>
  )
}

// -- Schedules Placeholder (Phase 10) ----------------------------------------

function SchedulesPlaceholder() {
  return (
    <Card>
      <div className="py-12 text-center text-slate-500">
        <CalendarClock className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium">Schedule Entries</p>
        <p className="text-xs text-slate-400 mt-1">Coming in Phase 10 — build test case sequences with trigger events</p>
      </div>
    </Card>
  )
}

// -- Helpers ------------------------------------------------------------------

function getTriggerBadgeVariant(triggerEvent: string): 'info' | 'success' | 'warning' | 'error' | 'default' {
  switch (triggerEvent) {
    case 'S12': return 'success'
    case 'S13': return 'warning'
    case 'S14': return 'info'
    case 'S15': return 'error'
    case 'S16': return 'error'
    default: return 'default'
  }
}
