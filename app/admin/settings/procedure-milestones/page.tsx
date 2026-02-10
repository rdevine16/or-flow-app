// app/admin/settings/procedure-milestones/page.tsx
// Admin page for configuring which milestones are assigned to each default procedure type
// These configurations are copied to new facilities when they are created

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

// Types
interface DefaultProcedureType {
  id: string
  name: string
  body_region_id: string | null
  implant_category: string | null
  is_active: boolean
  display_order: number | null
  body_region?: { name: string } | null
}

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
  pair_with_id: string | null
  is_active: boolean
}

interface DefaultProcedureMilestone {
  id: string
  procedure_type_template_id: string
  milestone_type_id: string
  display_order: number
}

export default function AdminProcedureMilestonesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [procedures, setProcedures] = useState<DefaultProcedureType[]>([])
  const [milestones, setMilestones] = useState<MilestoneType[]>([])
  const [configs, setConfigs] = useState<DefaultProcedureMilestone[]>([])
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null)

  // Redirect non-global-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch data on mount
  useEffect(() => {
    if (!userLoading && isGlobalAdmin) {
      fetchData()
    }
  }, [userLoading, isGlobalAdmin])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [proceduresRes, milestonesRes, configsRes] = await Promise.all([
        supabase
          .from('procedure_type_templates')
          .select('id, name, body_region_id, implant_category, is_active, display_order, body_regions(name)')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('milestone_types')
          .select('id, name, display_name, display_order, pair_position, pair_with_id, is_active')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('procedure_milestone_templates')
          .select('id, procedure_type_template_id, milestone_type_id, display_order')
      ])

      if (proceduresRes.error) throw proceduresRes.error
      if (milestonesRes.error) throw milestonesRes.error
      if (configsRes.error) throw configsRes.error

      const processedProcedures = (proceduresRes.data || []).map(p => ({
        ...p,
        body_region: Array.isArray(p.body_regions) ? p.body_regions[0] : p.body_regions
      }))

      setProcedures(processedProcedures)
      setMilestones(milestonesRes.data || [])
      setConfigs(configsRes.data || [])
    } catch (err) {
      setError('Failed to load procedure milestones. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Check if milestone is enabled for procedure
  const isMilestoneEnabled = (procedureId: string, milestoneId: string): boolean => {
    return configs.some(
      c => c.procedure_type_template_id === procedureId && c.milestone_type_id === milestoneId
    )
  }

  // Toggle milestone for procedure
  const toggleMilestone = async (procedureId: string, milestoneId: string) => {
    setSaving(true)
    
    const isEnabled = isMilestoneEnabled(procedureId, milestoneId)

    try {
      if (isEnabled) {
        const { error } = await supabase
          .from('procedure_milestone_templates')
          .delete()
          .eq('procedure_type_template_id', procedureId)
          .eq('milestone_type_id', milestoneId)

        if (error) throw error

        setConfigs(configs.filter(
          c => !(c.procedure_type_template_id === procedureId && c.milestone_type_id === milestoneId)
        ))
      } else {
        const milestone = milestones.find(m => m.id === milestoneId)
        const { data, error } = await supabase
          .from('procedure_milestone_templates')
          .insert({
            procedure_type_template_id: procedureId,
            milestone_type_id: milestoneId,
            display_order: milestone?.display_order || 0
          })
          .select()
          .single()

        if (error) throw error
        if (data) setConfigs([...configs, data])
      }
    } catch (err) {
      // Silent fail for individual toggles — state stays in sync
    } finally {
      setSaving(false)
    }
  }

  // Toggle paired milestones together (e.g., Anesthesia Start + Anesthesia End)
  const togglePairedMilestone = async (procedureId: string, startMilestoneId: string) => {
    const startMilestone = milestones.find(m => m.id === startMilestoneId)
    if (!startMilestone) return

    // Toggle the start milestone
    await toggleMilestone(procedureId, startMilestoneId)

    // Also toggle the paired "end" milestone if it exists
    if (startMilestone.pair_with_id) {
      await toggleMilestone(procedureId, startMilestone.pair_with_id)
    }
  }

  // Get milestone count for a procedure
  const getMilestoneCount = (procedureId: string): number => {
    return configs.filter(c => c.procedure_type_template_id === procedureId).length
  }

  // Get implant category label
  const getCategoryLabel = (category: string | null): string => {
    const labels: Record<string, string> = {
      'total_hip': 'Total Hip',
      'total_knee': 'Total Knee',
      'partial_knee': 'Partial Knee',
      'shoulder': 'Shoulder',
      'spine': 'Spine',
      'other': 'Other'
    }
    return category ? labels[category] || category : ''
  }

  // Enable all milestones for a procedure
  const enableAllMilestones = async (procedureId: string) => {
    setSaving(true)

    try {
      for (const m of milestones) {
        if (!isMilestoneEnabled(procedureId, m.id)) {
          const { data, error } = await supabase
            .from('procedure_milestone_templates')
            .insert({
              procedure_type_template_id: procedureId,
              milestone_type_id: m.id,
              display_order: m.display_order
            })
            .select()
            .single()

          if (error) throw error
          if (data) setConfigs(prev => [...prev, data])
        }
      }
    } catch (err) {
      // Partial failure — refresh to get accurate state
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  // Disable all milestones for a procedure
  const disableAllMilestones = async (procedureId: string) => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('procedure_milestone_templates')
        .delete()
        .eq('procedure_type_template_id', procedureId)

      if (error) throw error

      setConfigs(configs.filter(c => c.procedure_type_template_id !== procedureId))
    } catch (err) {
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  // Apply same milestones to all procedures
  const applyToAllProcedures = async (sourceProcedureId: string) => {
    setSaving(true)

    try {
      const sourceMilestoneIds = configs
        .filter(c => c.procedure_type_template_id === sourceProcedureId)
        .map(c => c.milestone_type_id)

      for (const procedure of procedures) {
        if (procedure.id === sourceProcedureId) continue

        const { error: delErr } = await supabase
          .from('procedure_milestone_templates')
          .delete()
          .eq('procedure_type_template_id', procedure.id)
        if (delErr) throw delErr

        if (sourceMilestoneIds.length > 0) {
          const newConfigs = sourceMilestoneIds.map(milestoneId => {
            const milestone = milestones.find(m => m.id === milestoneId)
            return {
              procedure_type_template_id: procedure.id,
              milestone_type_id: milestoneId,
              display_order: milestone?.display_order || 0
            }
          })

          const { error: insErr } = await supabase
            .from('procedure_milestone_templates')
            .insert(newConfigs)
          if (insErr) throw insErr
        }
      }

      await fetchData()
    } catch (err) {
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  // Loading state
  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <PageLoader message="Loading procedure milestones..." />
        </Container>
      </DashboardLayout>
    )
  }

  const totalMilestones = milestones.length

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <button
                onClick={() => router.push('/admin/settings')}
                className="hover:text-slate-700 transition-colors"
              >
                Admin Settings
              </button>
              <span>/</span>
              <span className="text-slate-900">Procedure Milestones</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Default Procedure Milestones</h1>
            <p className="text-slate-500 mt-1">
              Configure which milestones are assigned to each procedure type by default. 
              These settings are copied when creating new facilities.
            </p>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">How this works:</p>
                <p className="mt-1">
                  When you create a new facility with "Create default procedures" enabled, 
                  these milestone configurations will be automatically applied. Facility admins 
                  can customize their own procedure milestones after creation.
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Procedures</p>
              <p className="text-2xl font-bold text-slate-900">{procedures.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Milestones Available</p>
              <p className="text-2xl font-bold text-slate-900">{totalMilestones}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500">Total Configurations</p>
              <p className="text-2xl font-bold text-slate-900">{configs.length}</p>
            </div>
          </div>

          {/* Procedure List */}
          <div className="space-y-3">
            {procedures.map(procedure => {
              const isExpanded = expandedProcedure === procedure.id
              const milestoneCount = getMilestoneCount(procedure.id)

              return (
                <div
                  key={procedure.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  {/* Procedure Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedProcedure(isExpanded ? null : procedure.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        procedure.implant_category 
                          ? 'bg-purple-100 text-purple-600' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{procedure.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {procedure.implant_category && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {getCategoryLabel(procedure.implant_category)}
                            </span>
                          )}
                          {procedure.body_region?.name && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {procedure.body_region.name}
                            </span>
                          )}
                          <span className={`text-xs ${
                            milestoneCount === 0 
                              ? 'text-amber-600 font-medium' 
                              : 'text-slate-500'
                          }`}>
                            {milestoneCount === 0 
                              ? 'No milestones configured' 
                              : `${milestoneCount} of ${totalMilestones} milestones`
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Progress indicator */}
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${totalMilestones > 0 ? (milestoneCount / totalMilestones) * 100 : 0}%` }}
                        />
                      </div>
                      <svg 
                        className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Milestone Checkboxes */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50">
                      <p className="text-sm font-medium text-slate-700 mb-3">
                        Select which milestones will be enabled by default for <span className="font-semibold">{procedure.name}</span> cases:
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {milestones
                          .filter(m => m.pair_position !== 'end') // Don't show "end" milestones separately
                          .map(milestone => {
                            const isEnabled = isMilestoneEnabled(procedure.id, milestone.id)
                            const isPaired = milestone.pair_position === 'start' && milestone.pair_with_id

                            return (
                              <label
                                key={milestone.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isEnabled
                                    ? 'bg-white border-blue-200 shadow-sm'
                                    : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => {
                                    if (isPaired) {
                                      togglePairedMilestone(procedure.id, milestone.id)
                                    } else {
                                      toggleMilestone(procedure.id, milestone.id)
                                    }
                                  }}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {milestone.display_name}
                                  </p>
                                  {isPaired && (
                                    <p className="text-xs text-slate-400">Start/End pair</p>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                        <button
                          onClick={() => enableAllMilestones(procedure.id)}
                          disabled={saving}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => disableAllMilestones(procedure.id)}
                          disabled={saving}
                          className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                        >
                          Clear All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => {
                            if (confirm(`Apply these milestone settings to ALL ${procedures.length} procedures?`)) {
                              applyToAllProcedures(procedure.id)
                            }
                          }}
                          disabled={saving}
                          className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
                        >
                          Apply to All Procedures
                        </button>
                        {saving && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Saving...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {procedures.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white border border-slate-200 rounded-xl">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No default procedure types configured.</p>
                <button
                  onClick={() => router.push('/admin/settings/procedure-types')}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  Add procedure types first
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </DashboardLayout>
  )
}