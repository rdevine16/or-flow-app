// app/admin/demo/page.tsx
// Demo Data Management - Generate realistic demo data for sales presentations

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { useUser } from '../../../lib/UserContext'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import { generateDemoData, clearDemoData, getDemoDataStatus, GenerationProgress } from '../../../lib/demo-data-generator'
import { genericAuditLog } from '../../../lib/audit-logger'

interface Facility {
  id: string
  name: string
  is_demo: boolean
  case_number_prefix: string | null
}

interface FacilityStatus {
  caseCount: number
  oldestCase: string | null
  newestCase: string | null
  milestoneCount: number
  implantCount: number
}

export default function AdminDemoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [loading, setLoading] = useState(true)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacility, setSelectedFacility] = useState<string>('')
  const [facilityStatus, setFacilityStatus] = useState<FacilityStatus | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [lastAction, setLastAction] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch demo facilities
  useEffect(() => {
    if (!isGlobalAdmin) return

    async function fetchFacilities() {
      setLoading(true)
      const { data } = await supabase
        .from('facilities')
        .select('id, name, is_demo, case_number_prefix')
        .eq('is_demo', true)
        .order('name')

      setFacilities(data || [])
      if (data && data.length > 0) {
        setSelectedFacility(data[0].id)
      }
      setLoading(false)
    }

    fetchFacilities()
  }, [isGlobalAdmin, supabase])

  // Fetch facility status when selection changes
  useEffect(() => {
    if (!selectedFacility) {
      setFacilityStatus(null)
      return
    }

    async function fetchStatus() {
      const status = await getDemoDataStatus(supabase, selectedFacility)
      setFacilityStatus(status)
    }

    fetchStatus()
  }, [selectedFacility, supabase])

  const handleGenerate = async () => {
    if (!selectedFacility) return

    setIsGenerating(true)
    setLastAction(null)
    setProgress({ phase: 'starting', current: 0, total: 100, message: 'Starting generation...' })

    try {
      const facility = facilities.find(f => f.id === selectedFacility)
      
      // Audit log
      await genericAuditLog(supabase, 'admin.demo_data_generation_started', {
        targetType: 'facility',
        targetId: selectedFacility,
        targetLabel: facility?.name,
      })

      const result = await generateDemoData(
        supabase,
        selectedFacility,
        (p) => setProgress(p)
      )

      if (result.success) {
        setLastAction({ 
          type: 'success', 
          message: `Successfully generated ${result.casesGenerated.toLocaleString()} cases!` 
        })
        
        // Audit log success
        await genericAuditLog(supabase, 'admin.demo_data_generation_completed', {
          targetType: 'facility',
          targetId: selectedFacility,
          targetLabel: facility?.name,
          metadata: { cases_generated: result.casesGenerated },
        })

        // Refresh status
        const status = await getDemoDataStatus(supabase, selectedFacility)
        setFacilityStatus(status)
      } else {
        setLastAction({ 
          type: 'error', 
          message: result.error || 'Generation failed' 
        })
      }
    } catch (error) {
      setLastAction({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
    } finally {
      setIsGenerating(false)
      setProgress(null)
    }
  }

  const handleClear = async () => {
    if (!selectedFacility) return

    setShowConfirmClear(false)
    setIsClearing(true)
    setLastAction(null)
    setProgress({ phase: 'clearing', current: 0, total: 100, message: 'Clearing data...' })

    try {
      const facility = facilities.find(f => f.id === selectedFacility)
      
      // Audit log
      await genericAuditLog(supabase, 'admin.demo_data_cleared', {
        targetType: 'facility',
        targetId: selectedFacility,
        targetLabel: facility?.name,
        oldValues: { case_count: facilityStatus?.caseCount },
      })

      const result = await clearDemoData(
        supabase,
        selectedFacility,
        (p) => setProgress(p)
      )

      if (result.success) {
        setLastAction({ 
          type: 'success', 
          message: 'Demo data cleared successfully!' 
        })

        // Refresh status
        const status = await getDemoDataStatus(supabase, selectedFacility)
        setFacilityStatus(status)
      } else {
        setLastAction({ 
          type: 'error', 
          message: result.error || 'Clear failed' 
        })
      }
    } catch (error) {
      setLastAction({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
    } finally {
      setIsClearing(false)
      setProgress(null)
    }
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Not authorized
  if (!isGlobalAdmin) {
    return null
  }

  const selectedFacilityData = facilities.find(f => f.id === selectedFacility)

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Demo Data Generator</h1>
            <p className="text-slate-500">Generate realistic demo data for sales presentations</p>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {lastAction && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          lastAction.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {lastAction.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${
            lastAction.type === 'success' ? 'text-emerald-800' : 'text-red-800'
          }`}>
            {lastAction.message}
          </span>
          <button 
            onClick={() => setLastAction(null)}
            className="ml-auto text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {facilities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Demo Facilities</h3>
          <p className="text-slate-500 mb-6">
            Mark a facility as a demo facility to enable data generation.
          </p>
          <a 
            href="/admin/facilities"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            View Facilities
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Facility Selection & Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Facility Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Facility</h2>
              
              <div className="space-y-3">
                {facilities.map((facility) => (
                  <label
                    key={facility.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedFacility === facility.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="facility"
                      value={facility.id}
                      checked={selectedFacility === facility.id}
                      onChange={(e) => setSelectedFacility(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                      disabled={isGenerating || isClearing}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{facility.name}</p>
                      <p className="text-sm text-slate-500">
                        Prefix: {facility.case_number_prefix || 'Not set'}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                      Demo
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Current Status */}
            {facilityStatus && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Current Data Status</h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">
                      {facilityStatus.caseCount.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Total Cases</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">
                      {facilityStatus.milestoneCount.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Milestones</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">
                      {facilityStatus.implantCount.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">Implants</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm font-medium text-slate-900">
                      {facilityStatus.oldestCase || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-500">Oldest → </p>
                    <p className="text-sm font-medium text-slate-900">
                      {facilityStatus.newestCase || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress */}
            {progress && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {isGenerating ? 'Generating Data...' : 'Clearing Data...'}
                  </h2>
                  <span className="text-sm font-medium text-blue-600">{progress.current}%</span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-3 mb-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress.current}%` }}
                  />
                </div>
                
                <p className="text-sm text-slate-600">{progress.message}</p>
              </div>
            )}
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            {/* Generate Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Generate Demo Data</h3>
              <p className="text-sm text-slate-600 mb-4">
                Creates 6 months of historical cases plus 2 weeks of future scheduled cases with realistic patterns.
              </p>
              <ul className="text-sm text-slate-500 space-y-1 mb-4">
                <li>• ~1,500-2,000 cases</li>
                <li>• Full milestone timelines</li>
                <li>• Implant specifications</li>
                <li>• Staff assignments</li>
                <li>• Realistic delays (5-10%)</li>
              </ul>
              <button
                onClick={handleGenerate}
                disabled={!selectedFacility || isGenerating || isClearing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Data
                  </>
                )}
              </button>
            </div>

            {/* Clear Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Clear Demo Data</h3>
              <p className="text-sm text-slate-600 mb-4">
                Removes all cases, milestones, implants, and related data from the selected facility.
              </p>
              <button
                onClick={() => setShowConfirmClear(true)}
                disabled={!selectedFacility || isGenerating || isClearing || !facilityStatus?.caseCount}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All Data
                  </>
                )}
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">About Demo Data</h4>
                  <p className="text-sm text-blue-800">
                    Demo data is designed for sales presentations and testing. It includes realistic timing patterns, 
                    surgeon profiles (high/medium/low volume), and proper financial data for analytics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              Clear All Demo Data?
            </h3>
            <p className="text-sm text-slate-600 text-center mb-2">
              This will permanently delete:
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• <strong>{facilityStatus?.caseCount.toLocaleString()}</strong> cases</li>
                <li>• <strong>{facilityStatus?.milestoneCount.toLocaleString()}</strong> milestones</li>
                <li>• <strong>{facilityStatus?.implantCount.toLocaleString()}</strong> implant records</li>
                <li>• All related staff assignments and delays</li>
              </ul>
            </div>
            <p className="text-sm text-slate-500 text-center mb-6">
              from <strong>{selectedFacilityData?.name}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
