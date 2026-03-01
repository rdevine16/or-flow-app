// app/settings/integrations/epic/import/PageClient.tsx
// Epic Case Import — search FHIR appointments, preview, and import as ORbit cases

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Ban,
  User,
  X,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks'

// =====================================================
// TYPES
// =====================================================

interface CasePreview {
  fhirAppointmentId: string
  scheduledDate: string | null
  startTime: string | null
  patientName: string | null
  patientMrn: string | null
  patientDob: string | null
  surgeonName: string | null
  surgeonId: string | null
  roomName: string | null
  roomId: string | null
  procedureName: string | null
  procedureTypeId: string | null
  epicPractitionerId: string | null
  epicLocationId: string | null
  epicServiceType: string | null
  status: 'ready' | 'missing_mappings' | 'already_imported'
  missingMappings: string[]
}

interface ImportResult {
  fhirAppointmentId: string
  success: boolean
  caseId: string | null
  caseNumber: string | null
  error: string | null
}

interface ImportSummary {
  total: number
  success: number
  failed: number
}

interface PatientResult {
  id: string
  name: string | null
  birthDate: string | null
  gender: string | null
  mrn: string | null
}

// =====================================================
// HELPERS
// =====================================================

function getDefaultDateFrom(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function getDefaultDateTo(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

// =====================================================
// STATUS BADGE COMPONENT
// =====================================================

function StatusBadge({ status, missingMappings }: { status: CasePreview['status']; missingMappings: string[] }) {
  switch (status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Ready
        </span>
      )
    case 'missing_mappings':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
          title={`Missing: ${missingMappings.join(', ')}`}
        >
          <AlertTriangle className="w-3 h-3" />
          Missing {missingMappings.join(', ')}
        </span>
      )
    case 'already_imported':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <Ban className="w-3 h-3" />
          Already Imported
        </span>
      )
  }
}

// =====================================================
// IMPORT RESULT ROW
// =====================================================

function ImportResultRow({ result }: { result: ImportResult }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center gap-3">
        {result.success ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
        <div>
          <p className="text-sm font-medium text-slate-700">
            {result.caseNumber ?? result.fhirAppointmentId}
          </p>
          {result.error && (
            <p className="text-xs text-red-600">{result.error}</p>
          )}
        </div>
      </div>
      {result.success && result.caseId && (
        <a
          href={`/cases/${result.caseId}`}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View Case <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

// =====================================================
// SKELETON LOADER
// =====================================================

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="w-4 h-4 bg-slate-200 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-200 rounded w-48" />
          </div>
          <div className="h-3 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-200 rounded w-20" />
        </div>
      ))}
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EpicImportPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()

  // Patient search state
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<PatientResult[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [usePatientId, setUsePatientId] = useState(false)
  const [patientIdInput, setPatientIdInput] = useState('')
  const patientSearchRef = useRef<HTMLDivElement>(null)
  const patientDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Search state
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom)
  const [dateTo, setDateTo] = useState(getDefaultDateTo)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<CasePreview[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // =====================================================
  // PATIENT SEARCH
  // =====================================================

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePatientQueryChange = useCallback((value: string) => {
    setPatientQuery(value)
    setShowPatientDropdown(true)

    // Clear previous debounce
    if (patientDebounceRef.current) {
      clearTimeout(patientDebounceRef.current)
    }

    // If a patient was selected but user is typing again, clear selection
    if (selectedPatient) {
      setSelectedPatient(null)
    }

    // Debounce the search
    if (value.trim().length >= 2 && currentUser?.facilityId) {
      patientDebounceRef.current = setTimeout(async () => {
        setSearchingPatients(true)
        setPatientSearchError(null)
        try {
          const params = new URLSearchParams({
            facility_id: currentUser.facilityId,
            name: value.trim(),
          })
          const response = await fetch(`/api/epic/patients/search?${params}`)
          const json = await response.json()

          if (response.ok) {
            setPatientResults(json.data || [])
          } else if (response.status === 403 && json.scopeError) {
            // Epic didn't grant Patient.search scope — switch to ID mode
            setPatientResults([])
            setUsePatientId(true)
            setPatientSearchError(null)
          } else {
            setPatientResults([])
            setPatientSearchError(json.error || 'Search failed')
          }
        } catch {
          setPatientResults([])
          setPatientSearchError('Failed to connect to search')
        } finally {
          setSearchingPatients(false)
        }
      }, 400)
    } else {
      setPatientResults([])
    }
  }, [currentUser?.facilityId, selectedPatient])

  const handleSelectPatient = useCallback((patient: PatientResult) => {
    setSelectedPatient(patient)
    setPatientQuery(patient.name ?? patient.mrn ?? patient.id)
    setShowPatientDropdown(false)
    setPatientResults([])
  }, [])

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null)
    setPatientQuery('')
    setPatientIdInput('')
    setPatientResults([])
  }, [])

  const handlePatientIdLookup = useCallback(async () => {
    if (!currentUser?.facilityId || !patientIdInput.trim()) return

    setSearchingPatients(true)
    setPatientSearchError(null)
    try {
      const params = new URLSearchParams({
        facility_id: currentUser.facilityId,
        patient_id: patientIdInput.trim(),
      })
      const response = await fetch(`/api/epic/patients/search?${params}`)
      const json = await response.json()

      if (response.ok && json.data?.length > 0) {
        setSelectedPatient(json.data[0])
        setPatientQuery(json.data[0].name ?? json.data[0].id)
      } else {
        setPatientSearchError(json.error || 'Patient not found with that ID')
      }
    } catch {
      setPatientSearchError('Failed to look up patient')
    } finally {
      setSearchingPatients(false)
    }
  }, [currentUser?.facilityId, patientIdInput])

  // =====================================================
  // APPOINTMENT SEARCH
  // =====================================================

  const handleSearch = useCallback(async () => {
    if (!currentUser?.facilityId) return

    // Patient is required by Epic for appointment search
    if (!selectedPatient) {
      setSearchError('Please search for and select a patient first. Epic requires a patient to search appointments.')
      return
    }

    setSearching(true)
    setSearchError(null)
    setPreviews([])
    setSelectedIds(new Set())
    setImportResults(null)
    setImportSummary(null)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({
        facility_id: currentUser.facilityId,
        patient_id: selectedPatient.id,
      })

      // Dates are optional — omit for "all dates"
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const response = await fetch(`/api/epic/cases/search?${params}`)
      const json = await response.json()

      if (!response.ok) {
        setSearchError(json.error || 'Failed to search Epic')
        return
      }

      setPreviews(json.data || [])

      // Auto-select all "ready" cases
      const readyIds = new Set(
        (json.data as CasePreview[])
          .filter(p => p.status === 'ready')
          .map(p => p.fhirAppointmentId)
      )
      setSelectedIds(readyIds)
    } catch {
      setSearchError('Failed to connect to Epic search')
    } finally {
      setSearching(false)
    }
  }, [currentUser?.facilityId, dateFrom, dateTo, selectedPatient])

  // =====================================================
  // SELECTION
  // =====================================================

  const readyCases = previews.filter(p => p.status === 'ready')
  const selectableIds = new Set(readyCases.map(p => p.fhirAppointmentId))

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableIds.size) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableIds))
    }
  }

  // =====================================================
  // IMPORT
  // =====================================================

  const handleImport = useCallback(async () => {
    if (!currentUser?.facilityId || selectedIds.size === 0) return

    setImporting(true)
    setImportProgress(0)
    setImportResults(null)
    setImportSummary(null)

    try {
      const response = await fetch('/api/epic/cases/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: currentUser.facilityId,
          appointments: Array.from(selectedIds).map(id => ({
            fhirAppointmentId: id,
          })),
        }),
      })

      const json = await response.json()

      if (!response.ok) {
        setSearchError(json.error || 'Import failed')
        return
      }

      setImportResults(json.results || [])
      setImportSummary(json.summary || null)
      setImportProgress(100)

      // Update preview statuses for imported cases
      setPreviews(prev =>
        prev.map(p => {
          const result = (json.results as ImportResult[]).find(
            r => r.fhirAppointmentId === p.fhirAppointmentId
          )
          if (result?.success) {
            return { ...p, status: 'already_imported' as const }
          }
          return p
        })
      )
      setSelectedIds(new Set())
    } catch {
      setSearchError('Import request failed')
    } finally {
      setImporting(false)
    }
  }, [currentUser?.facilityId, selectedIds])

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/settings/integrations/epic')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Cases from Epic</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search for patient appointments in Epic and import them as ORbit cases
          </p>
        </div>
      </div>

      {/* Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        {/* Patient Search Row */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Patient <span className="text-red-400">*</span>
            </label>
            {!selectedPatient && (
              <button
                type="button"
                onClick={() => { setUsePatientId(!usePatientId); setPatientSearchError(null) }}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {usePatientId ? 'Search by name instead' : 'Use Patient FHIR ID'}
              </button>
            )}
          </div>
          <div ref={patientSearchRef} className="relative max-w-md">
            {selectedPatient ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg">
                <User className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">
                    {selectedPatient.name ?? 'Unknown'}
                  </span>
                  {selectedPatient.mrn && (
                    <span className="text-xs text-slate-500 ml-2">MRN: {selectedPatient.mrn}</span>
                  )}
                  {selectedPatient.birthDate && (
                    <span className="text-xs text-slate-500 ml-2">DOB: {formatDate(selectedPatient.birthDate)}</span>
                  )}
                </div>
                <button
                  onClick={handleClearPatient}
                  className="p-0.5 hover:bg-emerald-100 rounded transition-colors"
                  title="Clear patient"
                >
                  <X className="w-4 h-4 text-emerald-600" />
                </button>
              </div>
            ) : usePatientId ? (
              /* Patient ID input mode */
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={patientIdInput}
                    onChange={e => { setPatientIdInput(e.target.value); setPatientSearchError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handlePatientIdLookup()}
                    placeholder="Enter Patient FHIR ID (e.g., erXuFYUfucBZaryVksYEcMg3)"
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handlePatientIdLookup}
                  disabled={searchingPatients || !patientIdInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {searchingPatients ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Look Up'
                  )}
                </button>
              </div>
            ) : (
              /* Name search mode */
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={e => handlePatientQueryChange(e.target.value)}
                    onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                    placeholder="Search by patient name..."
                    className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchingPatients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                  )}
                </div>

                {/* Patient Results Dropdown */}
                {showPatientDropdown && patientQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchingPatients ? (
                      <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching Epic...
                      </div>
                    ) : patientSearchError ? (
                      <div className="px-4 py-3 text-sm text-red-600">
                        {patientSearchError}
                      </div>
                    ) : patientResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">
                        No patients found for &ldquo;{patientQuery}&rdquo;
                      </div>
                    ) : (
                      patientResults.map(patient => (
                        <button
                          key={patient.id}
                          onClick={() => handleSelectPatient(patient)}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {patient.name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {patient.mrn && `MRN: ${patient.mrn}`}
                            {patient.mrn && patient.birthDate && ' · '}
                            {patient.birthDate && `DOB: ${formatDate(patient.birthDate)}`}
                            {(patient.mrn || patient.birthDate) && patient.gender && ' · '}
                            {patient.gender && patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {patientSearchError && !showPatientDropdown && (
            <p className="text-xs text-red-500 mt-1">{patientSearchError}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {usePatientId
              ? 'Enter the patient\'s FHIR ID and click Look Up to verify.'
              : 'Epic requires a patient to search appointments. Type at least 2 characters to search.'}
          </p>
        </div>

        {/* Date Range Row (optional) */}
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              From Date <span className="text-xs text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              To Date <span className="text-xs text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                min={dateFrom}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-blue-600 hover:text-blue-700 pb-2.5"
            >
              Clear dates (all)
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={searching || !currentUser || !selectedPatient}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {searching ? 'Searching...' : 'Search Appointments'}
          </button>
        </div>
      </div>

      {/* Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Error</p>
            <p className="text-sm text-red-600">{searchError}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {searching && <TableSkeleton />}

      {/* Results Table */}
      {!searching && hasSearched && previews.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">
                {previews.length} appointments found
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-sm text-emerald-600 font-medium">
                {readyCases.length} ready
              </span>
              {previews.filter(p => p.status === 'missing_mappings').length > 0 && (
                <>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-sm text-amber-600">
                    {previews.filter(p => p.status === 'missing_mappings').length} missing mappings
                  </span>
                </>
              )}
              {previews.filter(p => p.status === 'already_imported').length > 0 && (
                <>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-sm text-slate-500">
                    {previews.filter(p => p.status === 'already_imported').length} already imported
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {importing ? 'Importing...' : `Import Selected (${selectedIds.size})`}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectableIds.size > 0 && selectedIds.size === selectableIds.size}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Surgeon
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Procedure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previews.map(p => {
                  const isSelectable = p.status === 'ready'
                  const isSelected = selectedIds.has(p.fhirAppointmentId)

                  return (
                    <tr
                      key={p.fhirAppointmentId}
                      className={`${
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      } ${!isSelectable ? 'opacity-60' : ''} transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.fhirAppointmentId)}
                          disabled={!isSelectable}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{formatDate(p.scheduledDate)}</p>
                        <p className="text-xs text-slate-500">{formatTime(p.startTime)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-900">{p.patientName ?? '—'}</p>
                        {p.patientMrn && (
                          <p className="text-xs text-slate-500">MRN: {p.patientMrn}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-900">{p.surgeonName ?? '—'}</p>
                          {p.epicPractitionerId && !p.surgeonId && (
                            <span title="Unmapped surgeon">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                          {p.surgeonId && (
                            <span title="Mapped">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-900">{p.roomName ?? '—'}</p>
                          {p.epicLocationId && !p.roomId && (
                            <span title="Unmapped room">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                          {p.roomId && (
                            <span title="Mapped">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-900">{p.procedureName ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} missingMappings={p.missingMappings} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!searching && hasSearched && previews.length === 0 && !searchError && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-1">No appointments found</h3>
          <p className="text-sm text-slate-500">
            No appointments were found in Epic for this patient in the selected date range.
            Try adjusting the dates or searching for a different patient.
          </p>
        </div>
      )}

      {/* Import Progress */}
      {importing && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">Importing cases...</p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResults && importSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Import Results</h3>

          {/* Summary */}
          <div className="flex items-center gap-6 mb-6 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-2xl font-bold text-slate-900">{importSummary.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{importSummary.success}</p>
              <p className="text-xs text-slate-500">Imported</p>
            </div>
            {importSummary.failed > 0 && (
              <div>
                <p className="text-2xl font-bold text-red-500">{importSummary.failed}</p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            )}
          </div>

          {/* Per-case results */}
          <div className="space-y-2">
            {importResults.map(result => (
              <ImportResultRow key={result.fhirAppointmentId} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
