'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'

interface ProcedureType {
  id: string
  name: string
  implant_category: string | null
  source_template_id: string | null
}

interface FacilityMilestone {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
  pair_with_id: string | null
  source_milestone_type_id: string | null
}

interface ProcedureMilestoneConfig {
  id: string
  procedure_type_id: string
  facility_milestone_id: string
}

export default function ProcedureMilestonesSettingsPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [milestones, setMilestones] = useState<FacilityMilestone[]>([])
  const [configs, setConfigs] = useState<ProcedureMilestoneConfig[]>([])
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null)

  // Fetch data once we have facility ID (from context, handles impersonation)
  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchData()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchData = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)

    const [proceduresRes, milestonesRes, configsRes] = await Promise.all([
      supabase
        .from('procedure_types')
        .select('id, name, implant_category, source_template_id')
        .eq('facility_id', effectiveFacilityId)
        .order('name'),
      supabase
        .from('facility_milestones')
        .select('id, name, display_name, display_order, pair_position, pair_with_id, source_milestone_type_id')
        .eq('facility_id', effectiveFacilityId)
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('procedure_milestone_config')
        .select('id, procedure_type_id, facility_milestone_id')
        .eq('facility_id', effectiveFacilityId)
    ])

    setProcedures(proceduresRes.data || [])
    setMilestones(milestonesRes.data || [])
    setConfigs(configsRes.data || [])
    setLoading(false)
  }

  // Check if milestone is enabled for procedure
  const isMilestoneEnabled = (procedureId: string, milestoneId: string): boolean => {
    return configs.some(
      c => c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId
    )
  }

  // Toggle a single (non-paired) milestone
  const toggleMilestone = async (procedureId: string, milestoneId: string) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    const isEnabled = isMilestoneEnabled(procedureId, milestoneId)

    if (isEnabled) {
      const { error } = await supabase
        .from('procedure_milestone_config')
        .delete()
        .eq('procedure_type_id', procedureId)
        .eq('facility_milestone_id', milestoneId)

      if (!error) {
        setConfigs(prev => prev.filter(
          c => !(c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId)
        ))
      }
    } else {
      const milestone = milestones.find(m => m.id === milestoneId)
      const { data, error } = await supabase
        .from('procedure_milestone_config')
        .upsert(
          {
            facility_id: effectiveFacilityId,
            procedure_type_id: procedureId,
            facility_milestone_id: milestoneId,
            display_order: milestone?.display_order || 0
          },
          { onConflict: 'facility_id,procedure_type_id,facility_milestone_id' }
        )
        .select()
        .single()

      if (data) {
        setConfigs(prev => {
          // Avoid duplicates in local state
          const exists = prev.some(
            c => c.procedure_type_id === procedureId && c.facility_milestone_id === milestoneId
          )
          return exists ? prev : [...prev, data]
        })
      }
    }
    setSaving(false)
  }

  // Toggle paired milestones together — handles both in a single batch
  const togglePairedMilestone = async (procedureId: string, startMilestoneId: string) => {
    if (!effectiveFacilityId) return

    const startMilestone = milestones.find(m => m.id === startMilestoneId)
    if (!startMilestone) return

    const endMilestoneId = startMilestone.pair_with_id
    const milestoneIds = endMilestoneId
      ? [startMilestoneId, endMilestoneId]
      : [startMilestoneId]

    const isEnabled = isMilestoneEnabled(procedureId, startMilestoneId)

    setSaving(true)

    if (isEnabled) {
      // Delete both in parallel
      const deletePromises = milestoneIds.map(mid =>
        supabase
          .from('procedure_milestone_config')
          .delete()
          .eq('procedure_type_id', procedureId)
          .eq('facility_milestone_id', mid)
      )

      const results = await Promise.all(deletePromises)
      const hasError = results.some(r => r.error)

      if (!hasError) {
        setConfigs(prev => prev.filter(
          c => !(c.procedure_type_id === procedureId && milestoneIds.includes(c.facility_milestone_id))
        ))
      }
    } else {
      // Upsert both in a single call — no 409 possible
      const rows = milestoneIds.map(mid => {
        const m = milestones.find(ms => ms.id === mid)
        return {
          facility_id: effectiveFacilityId,
          procedure_type_id: procedureId,
          facility_milestone_id: mid,
          display_order: m?.display_order || 0
        }
      })

      const { data, error } = await supabase
        .from('procedure_milestone_config')
        .upsert(rows, { onConflict: 'facility_id,procedure_type_id,facility_milestone_id' })
        .select()

      if (data && !error) {
        setConfigs(prev => {
          const newConfigs = [...prev]
          for (const row of data) {
            const exists = newConfigs.some(
              c => c.procedure_type_id === row.procedure_type_id
                && c.facility_milestone_id === row.facility_milestone_id
            )
            if (!exists) {
              newConfigs.push(row)
            }
          }
          return newConfigs
        })
      }
    }

    setSaving(false)
  }

  // Get milestone count for procedure
  const getMilestoneCount = (procedureId: string): number => {
    return configs.filter(c => c.procedure_type_id === procedureId).length
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
    if (!effectiveFacilityId) return
    setSaving(true)

    // Build rows for all milestones that aren't already enabled
    const rows = milestones
      .filter(m => !isMilestoneEnabled(procedureId, m.id))
      .map(m => ({
        facility_id: effectiveFacilityId,
        procedure_type_id: procedureId,
        facility_milestone_id: m.id,
        display_order: m.display_order
      }))

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('procedure_milestone_config')
        .upsert(rows, { onConflict: 'facility_id,procedure_type_id,facility_milestone_id' })
        .select()

      if (data && !error) {
        setConfigs(prev => {
          const newConfigs = [...prev]
          for (const row of data) {
            const exists = newConfigs.some(
              c => c.procedure_type_id === row.procedure_type_id
                && c.facility_milestone_id === row.facility_milestone_id
            )
            if (!exists) {
              newConfigs.push(row)
            }
          }
          return newConfigs
        })
      }
    }

    setSaving(false)
  }

  // Disable all milestones for a procedure
  const disableAllMilestones = async (procedureId: string) => {
    if (!effectiveFacilityId) return
    setSaving(true)

    const { error } = await supabase
      .from('procedure_milestone_config')
      .delete()
      .eq('facility_id', effectiveFacilityId)
      .eq('procedure_type_id', procedureId)

    if (!error) {
      setConfigs(prev => prev.filter(c => c.procedure_type_id !== procedureId))
    }

    setSaving(false)
  }

  if (userLoading || loading) {
    return (
      <DashboardLayout>
        <Container>
          <SettingsLayout title="Procedure Milestones" description="Configure which milestones are tracked for each procedure type.">
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </SettingsLayout>
        </Container>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Container>
        <SettingsLayout title="Procedure Milestones" description="Configure which milestones are tracked for each procedure type.">
          {!effectiveFacilityId ? (
            <div className="text-center py-12 text-slate-500">
              No facility found. Please contact support.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {procedures.map(procedure => {
                  const isExpanded = expandedProcedure === procedure.id
                  const milestoneCount = getMilestoneCount(procedure.id)
                  const totalMilestones = milestones.length

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
                            Select which milestones appear when tracking <span className="font-semibold">{procedure.name}</span> cases:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {milestones
                              .filter(m => m.pair_position !== 'end') // Don't show "end" milestones separately
                              .map(milestone => {
                                const isEnabled = isMilestoneEnabled(procedure.id, milestone.id)
                                // Also check if the paired end milestone is enabled
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
                                      {milestone.source_milestone_type_id && (
                                        <span className="inline-flex items-center text-[10px] text-blue-600">Global</span>
                                      )}
                                      {!milestone.source_milestone_type_id && (
                                        <span className="inline-flex items-center text-[10px] text-purple-600">Custom</span>
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
                  <div className="text-center py-12 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No procedure types configured for this facility.</p>
                    <p className="text-sm mt-1">Add procedures in the Procedure Types settings first.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}
