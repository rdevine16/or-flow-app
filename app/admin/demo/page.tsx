'use client'

import { useState, useEffect } from 'react'

interface Facility {
  id: string
  name: string
  is_demo: boolean
  case_number_prefix: string | null
}

interface GenerationResult {
  success: boolean
  casesGenerated?: number
  error?: string
  details?: {
    milestones: number
    staff: number
    implants: number
    delays: number
  }
}

interface DemoStatus {
  cases: number
  milestones: number
  staff: number
  implants: number
  delays: number
}

export default function DemoDataPage() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [clearing, setClearing] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [statuses, setStatuses] = useState<Record<string, DemoStatus>>({})

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
        // Load status for each facility
        for (const facility of data.facilities) {
          await loadStatus(facility.id)
        }
      }
    } catch (error) {
      console.error('Error loading facilities:', error)
    }
    setLoading(false)
  }

  async function loadStatus(facilityId: string) {
    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', facilityId }),
      })
      const status = await res.json()
      setStatuses(prev => ({ ...prev, [facilityId]: status }))
    } catch (error) {
      console.error('Error loading status:', error)
    }
  }

  async function handleGenerate(facilityId: string) {
    setGenerating(facilityId)
    setResult(null)

    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', facilityId }),
      })
      const result = await res.json()
      setResult(result)
      await loadStatus(facilityId)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setGenerating(null)
    }
  }

  async function handleClear(facilityId: string) {
    if (!confirm('Are you sure you want to delete all demo cases for this facility? This cannot be undone.')) {
      return
    }

    setClearing(facilityId)
    setResult(null)

    try {
      const res = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', facilityId }),
      })
      const result = await res.json()
      
      if (result.success) {
        setResult({ success: true, casesGenerated: 0, error: `Cleared ${result.casesDeleted} cases` })
      } else {
        setResult({ success: false, error: result.error })
      }
      
      await loadStatus(facilityId)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setClearing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Demo Data Generator</h1>
          <p className="text-gray-600 mt-1">
            Generate realistic surgical case data for demos and testing
          </p>
        </div>

        {/* Result Banner */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <div>
                <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success 
                    ? result.casesGenerated 
                      ? `Successfully generated ${result.casesGenerated} cases!`
                      : result.error || 'Operation completed'
                    : 'Generation failed'}
                </p>
                {result.success && result.details && (
                  <div className="flex gap-4 mt-2 text-sm text-green-700">
                    <span>📋 {result.details.milestones.toLocaleString()} milestones</span>
                    <span>👥 {result.details.staff.toLocaleString()} staff</span>
                    <span>🦴 {result.details.implants.toLocaleString()} implants</span>
                    <span>⚠️ {result.details.delays.toLocaleString()} delays</span>
                  </div>
                )}
                {result.error && !result.success && (
                  <p className="text-red-700 text-sm mt-1">{result.error}</p>
                )}
              </div>
              <button 
                onClick={() => setResult(null)}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Generating indicator */}
        {generating && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-blue-800 font-medium">Generating demo data... This may take 30-60 seconds.</span>
            </div>
          </div>
        )}

        {/* Facility Cards */}
        {facilities.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-600">No demo facilities found.</p>
            <p className="text-sm text-gray-500 mt-2">
              Run the SQL setup script to mark facilities as demo-enabled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {facilities.map(facility => {
              const status = statuses[facility.id]
              const isGenerating = generating === facility.id
              const isClearing = clearing === facility.id
              const isDisabled = generating !== null || clearing !== null

              return (
                <div key={facility.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  {/* Facility Header */}
                  <div className="px-6 py-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{facility.name}</h2>
                        <p className="text-sm text-gray-500">
                          Prefix: {facility.case_number_prefix || 'None'} • ID: {facility.id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerate(facility.id)}
                          disabled={isDisabled}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                            isDisabled
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isGenerating ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Generating...
                            </span>
                          ) : (
                            'Generate Data'
                          )}
                        </button>
                        {status && status.cases > 0 && (
                          <button
                            onClick={() => handleClear(facility.id)}
                            disabled={isDisabled}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              isDisabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                            }`}
                          >
                            {isClearing ? 'Clearing...' : 'Clear Data'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className="px-6 py-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Current Data</h3>
                    {status ? (
                      <div className="grid grid-cols-5 gap-4">
                        <StatusCard label="Cases" value={status.cases} icon="📋" />
                        <StatusCard label="Milestones" value={status.milestones} icon="⏱️" />
                        <StatusCard label="Staff" value={status.staff} icon="👥" />
                        <StatusCard label="Implants" value={status.implants} icon="🦴" />
                        <StatusCard label="Delays" value={status.delays} icon="⚠️" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading status...
                      </div>
                    )}
                  </div>

                  {/* What Gets Generated */}
                  <div className="px-6 py-4 bg-gray-50 border-t">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Generation includes:</h3>
                    <ul className="text-sm text-gray-600 grid grid-cols-2 gap-1">
                      <li>• 6 months of historical cases</li>
                      <li>• 2 weeks of future scheduled cases</li>
                      <li>• Realistic milestone timestamps</li>
                      <li>• Surgeon-specific pace profiles</li>
                      <li>• Implant sizing with templated/final</li>
                      <li>• Payer mix (Medicare, BCBS, etc.)</li>
                      <li>• Staff assignments</li>
                      <li>• Occasional delays (15%)</li>
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-3">
            <span className="text-xl">💡</span>
            <div className="text-sm text-amber-800">
              <p className="font-medium">Financial Data Generated:</p>
              <ul className="mt-1 space-y-1">
                <li>• <strong>OR Time Cost:</strong> Based on facility's or_hourly_rate × case duration</li>
                <li>• <strong>Supply Costs:</strong> soft_goods_cost + hard_goods_cost from procedure_types</li>
                <li>• <strong>Reimbursement:</strong> Pulled from procedure_reimbursements by payer</li>
                <li>• <strong>Profit:</strong> Reimbursement - OR Cost - Supply Costs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
