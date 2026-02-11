'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import Card from '@/components/ui/Card'
import SearchableDropdown from '@/components/ui/SearchableDropdown'
import ImplantCompanySelect from '@/components/cases/ImplantCompanySelect'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { PageLoader } from '@/components/ui/Loading'
import { LeaveConfirm } from '@/components/ui/ConfirmDialog'
import { bulkCaseRowSchema } from '@/lib/validation/schemas'
import { caseAudit } from '@/lib/audit-logger'
import { useProcedureTypes, useRooms, useSurgeons } from '@/hooks'
import { ChevronLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import type { ProcedureType } from '@/hooks'

// ============================================
// CONSTANTS
// ============================================

const MAX_ROWS = 20

const OPERATIVE_SIDE_OPTIONS = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'bilateral', label: 'Bilateral' },
  { id: 'n/a', label: 'N/A' },
]

// ============================================
// TYPES
// ============================================

interface BulkCaseRow {
  id: string // client-side key for React
  case_number: string
  start_time: string
  procedure_type_id: string
  or_room_id: string
  operative_side: string
  implant_company_ids: string[]
  rep_required_override: boolean | null
}

interface RowErrors {
  [field: string]: string
}

// ============================================
// HELPERS
// ============================================

function createEmptyRow(): BulkCaseRow {
  return {
    id: crypto.randomUUID(),
    case_number: '',
    start_time: '',
    procedure_type_id: '',
    or_room_id: '',
    operative_side: '',
    implant_company_ids: [],
    rep_required_override: null,
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

function BulkCreateContent() {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()
  const { userData, canCreateCases, loading: userLoading, effectiveFacilityId } = useUser()

  // Header fields (shared across all rows)
  const [scheduledDate, setScheduledDate] = useState('')
  const [surgeonId, setSurgeonId] = useState('')
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({})

  // Per-row state
  const [rows, setRows] = useState<BulkCaseRow[]>([createEmptyRow(), createEmptyRow()])
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({})

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Lookup data
  const { data: surgeons } = useSurgeons(effectiveFacilityId)
  const { data: procedureTypes } = useProcedureTypes(effectiveFacilityId)
  const { data: rooms } = useRooms(effectiveFacilityId)

  // Status ID for 'scheduled' — needed for the RPC
  const [scheduledStatusId, setScheduledStatusId] = useState<string | null>(null)

  useEffect(() => {
    if (!effectiveFacilityId) return
    const fetchStatusId = async () => {
      const { data } = await supabase
        .from('case_statuses')
        .select('id')
        .eq('name', 'scheduled')
        .single()
      if (data) setScheduledStatusId(data.id)
    }
    fetchStatusId()
  }, [effectiveFacilityId, supabase])

  // Redirect unauthorized users
  useEffect(() => {
    if (!userLoading && !canCreateCases) {
      router.replace('/cases')
    }
  }, [userLoading, canCreateCases, router])

  // Track dirty state
  useEffect(() => {
    const hasContent = scheduledDate || surgeonId || rows.some(r =>
      r.case_number || r.start_time || r.procedure_type_id || r.or_room_id
    )
    setIsDirty(!!hasContent)
  }, [scheduledDate, surgeonId, rows])

  // ============================================
  // PROCEDURE HELPERS
  // ============================================

  const getProcedure = useCallback((procedureId: string): ProcedureType | undefined => {
    return procedureTypes.find(p => p.id === procedureId)
  }, [procedureTypes])

  const procedureRequiresOperativeSide = useCallback((procedureId: string): boolean => {
    const proc = getProcedure(procedureId)
    return proc?.requires_operative_side ?? false
  }, [getProcedure])

  const procedureRequiresRep = useCallback((procedureId: string): boolean => {
    const proc = getProcedure(procedureId)
    return proc?.requires_rep ?? false
  }, [getProcedure])

  // ============================================
  // ROW MANAGEMENT
  // ============================================

  const addRow = useCallback(() => {
    if (rows.length >= MAX_ROWS) {
      showToast({
        type: 'error',
        title: 'Maximum rows reached',
        message: `You can create up to ${MAX_ROWS} cases at once`,
      })
      return
    }
    setRows(prev => [...prev, createEmptyRow()])
  }, [rows.length, showToast])

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId))
    setRowErrors(prev => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }, [])

  const updateRow = useCallback((rowId: string, field: keyof BulkCaseRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r
      const updated = { ...r, [field]: value }
      // When procedure changes, clear operative_side if new procedure doesn't require it
      if (field === 'procedure_type_id') {
        const proc = procedureTypes.find(p => p.id === value)
        if (!proc?.requires_operative_side) {
          updated.operative_side = ''
        }
        // Reset rep override when procedure changes
        updated.rep_required_override = null
      }
      return updated
    }))
    // Clear error for the field being edited
    setRowErrors(prev => {
      const existing = prev[rowId]
      if (!existing) return prev
      const next = { ...existing }
      delete next[field]
      return { ...prev, [rowId]: next }
    })
  }, [procedureTypes])

  // ============================================
  // VALIDATION
  // ============================================

  const validateAllRows = useCallback((): boolean => {
    let valid = true
    const newHeaderErrors: Record<string, string> = {}
    const newRowErrors: Record<string, RowErrors> = {}

    // Validate header fields
    if (!scheduledDate) {
      newHeaderErrors.scheduled_date = 'Scheduled date is required'
      valid = false
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      newHeaderErrors.scheduled_date = 'Date must be YYYY-MM-DD format'
      valid = false
    }

    if (!surgeonId) {
      newHeaderErrors.surgeon_id = 'Surgeon is required'
      valid = false
    }

    // Validate each row
    for (const row of rows) {
      const rowData = {
        case_number: row.case_number,
        start_time: row.start_time,
        procedure_type_id: row.procedure_type_id,
        or_room_id: row.or_room_id,
        operative_side: row.operative_side,
        implant_company_ids: row.implant_company_ids,
        rep_required_override: row.rep_required_override,
      }

      const result = bulkCaseRowSchema.safeParse(rowData)
      if (!result.success) {
        valid = false
        const errors: RowErrors = {}
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0] as string
          if (!errors[fieldName]) {
            errors[fieldName] = issue.message
          }
        }
        newRowErrors[row.id] = errors
      }
    }

    // Check for duplicate case numbers across rows
    const caseNumbers = rows.map(r => r.case_number).filter(Boolean)
    const seen = new Set<string>()
    for (const row of rows) {
      if (row.case_number && seen.has(row.case_number)) {
        valid = false
        if (!newRowErrors[row.id]) newRowErrors[row.id] = {}
        newRowErrors[row.id].case_number = 'Duplicate case number in this batch'
      }
      if (row.case_number) seen.add(row.case_number)
    }

    setHeaderErrors(newHeaderErrors)
    setRowErrors(newRowErrors)
    return valid
  }, [scheduledDate, surgeonId, rows])

  // ============================================
  // SUBMISSION
  // ============================================

  const handleSubmit = useCallback(async () => {
    if (!validateAllRows()) {
      showToast({
        type: 'error',
        title: 'Validation errors',
        message: 'Please fix the highlighted errors before submitting',
      })
      return
    }

    if (!effectiveFacilityId || !scheduledStatusId) {
      showToast({
        type: 'error',
        title: 'Missing facility context',
        message: 'Please select a facility before creating cases',
      })
      return
    }

    setSubmitting(true)
    let createdCount = 0

    try {
      for (const row of rows) {
        // Determine effective rep required
        const procRequiresRep = procedureRequiresRep(row.procedure_type_id)
        const effectiveRepRequired = row.rep_required_override ?? procRequiresRep

        // Create the case via the existing RPC
        const { data: caseId, error: rpcError } = await supabase.rpc('create_case_with_milestones', {
          p_case_number: row.case_number,
          p_scheduled_date: scheduledDate,
          p_start_time: row.start_time,
          p_or_room_id: row.or_room_id,
          p_procedure_type_id: row.procedure_type_id,
          p_status_id: scheduledStatusId,
          p_surgeon_id: surgeonId,
          p_facility_id: effectiveFacilityId,
          p_created_by: userData.userId,
          p_operative_side: row.operative_side || null,
          p_rep_required_override: row.rep_required_override,
          p_is_draft: false,
          p_staff_assignments: null,
        })

        if (rpcError) {
          throw new Error(`Failed to create case ${row.case_number}: ${rpcError.message}`)
        }

        const savedCaseId = caseId as string
        const procedure = getProcedure(row.procedure_type_id)

        // Audit log
        await caseAudit.created(supabase, {
          id: savedCaseId,
          case_number: row.case_number,
          procedure_name: procedure?.name,
        })

        // Save implant companies (same pattern as CaseForm)
        if (row.implant_company_ids.length > 0) {
          await supabase.from('case_implant_companies').insert(
            row.implant_company_ids.map(companyId => ({
              case_id: savedCaseId,
              implant_company_id: companyId,
            }))
          )

          // If rep is required, create device tracking entries
          if (effectiveRepRequired) {
            await supabase.from('case_device_companies').insert(
              row.implant_company_ids.map(companyId => ({
                case_id: savedCaseId,
                implant_company_id: companyId,
                tray_status: 'pending',
              }))
            )
          }
        }

        createdCount++
      }

      showToast({
        type: 'success',
        title: `${createdCount} case${createdCount === 1 ? '' : 's'} created`,
        message: `Successfully created ${createdCount} case${createdCount === 1 ? '' : 's'} for ${scheduledDate}`,
      })

      setIsDirty(false)
      router.push(`/cases?dateRange=all`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      showToast({
        type: 'error',
        title: 'Bulk creation failed',
        message: createdCount > 0
          ? `${createdCount} case(s) created before error: ${message}`
          : message,
      })
    } finally {
      setSubmitting(false)
    }
  }, [
    validateAllRows, effectiveFacilityId, scheduledStatusId, rows,
    scheduledDate, surgeonId, supabase, userData.userId, showToast,
    router, getProcedure, procedureRequiresRep,
  ])

  // ============================================
  // RENDER GUARDS
  // ============================================

  if (userLoading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    )
  }

  if (!canCreateCases) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Unsaved changes warning */}
        <LeaveConfirm
          open={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          onConfirm={() => router.push('/cases')}
        />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              if (isDirty) {
                setShowLeaveConfirm(true)
              } else {
                router.push('/cases')
              }
            }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Bulk Create Cases</h1>
            <p className="text-slate-500">Create multiple cases for the same surgeon and date.</p>
          </div>
        </div>

        {/* Shared Header Fields */}
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              Shared Fields
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <label htmlFor="bulk-scheduled-date" className="block text-sm font-medium text-slate-700 mb-2">
                  Scheduled Date *
                </label>
                <input
                  id="bulk-scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value)
                    setHeaderErrors(prev => ({ ...prev, scheduled_date: '' }))
                  }}
                  className={`w-full px-4 py-3 rounded-xl border transition-all bg-white ${
                    headerErrors.scheduled_date
                      ? 'border-red-400 ring-2 ring-red-500/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  } focus:outline-none`}
                />
                {headerErrors.scheduled_date && (
                  <p className="text-red-600 text-xs mt-1">{headerErrors.scheduled_date}</p>
                )}
              </div>

              {/* Surgeon */}
              <SearchableDropdown
                label="Surgeon *"
                placeholder="Select Surgeon"
                value={surgeonId}
                onChange={(id) => {
                  setSurgeonId(id)
                  setHeaderErrors(prev => ({ ...prev, surgeon_id: '' }))
                }}
                options={surgeons.map(s => ({
                  id: s.id,
                  label: `${s.last_name}, ${s.first_name}`,
                }))}
                error={headerErrors.surgeon_id}
              />
            </div>
          </div>
        </Card>

        {/* Case Rows */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Cases ({rows.length})
              </h2>
              <span className="text-xs text-slate-400">
                {rows.length}/{MAX_ROWS} max
              </span>
            </div>

            <div className="space-y-4">
              {rows.map((row, index) => {
                const errors = rowErrors[row.id] || {}
                const showOperativeSide = procedureRequiresOperativeSide(row.procedure_type_id)
                const procRequiresRep = procedureRequiresRep(row.procedure_type_id)
                const effectiveRepRequired = row.rep_required_override ?? procRequiresRep

                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-4 transition-all ${
                      Object.keys(errors).length > 0
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Row Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-500">
                        Case {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        className={`p-1.5 rounded-lg transition-all ${
                          rows.length <= 1
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={rows.length <= 1 ? 'Cannot remove the last row' : 'Remove row'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Row Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Case Number */}
                      <div>
                        <label htmlFor={`case-number-${row.id}`} className="block text-xs font-medium text-slate-600 mb-1">
                          Case Number *
                        </label>
                        <input
                          id={`case-number-${row.id}`}
                          type="text"
                          value={row.case_number}
                          onChange={(e) => updateRow(row.id, 'case_number', e.target.value)}
                          placeholder="C-2026-001"
                          className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all ${
                            errors.case_number
                              ? 'border-red-400 ring-2 ring-red-500/20'
                              : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                          } focus:outline-none`}
                        />
                        {errors.case_number && (
                          <p className="text-red-600 text-xs mt-1">{errors.case_number}</p>
                        )}
                      </div>

                      {/* Start Time */}
                      <div>
                        <label htmlFor={`start-time-${row.id}`} className="block text-xs font-medium text-slate-600 mb-1">
                          Start Time *
                        </label>
                        <input
                          id={`start-time-${row.id}`}
                          type="time"
                          value={row.start_time}
                          onChange={(e) => updateRow(row.id, 'start_time', e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all ${
                            errors.start_time
                              ? 'border-red-400 ring-2 ring-red-500/20'
                              : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                          } focus:outline-none`}
                        />
                        {errors.start_time && (
                          <p className="text-red-600 text-xs mt-1">{errors.start_time}</p>
                        )}
                      </div>

                      {/* Procedure */}
                      <div>
                        <SearchableDropdown
                          label="Procedure *"
                          placeholder="Select Procedure"
                          value={row.procedure_type_id}
                          onChange={(id) => updateRow(row.id, 'procedure_type_id', id)}
                          options={procedureTypes.map(p => ({ id: p.id, label: p.name }))}
                          error={errors.procedure_type_id}
                        />
                      </div>

                      {/* Room */}
                      <div>
                        <SearchableDropdown
                          label="OR Room *"
                          placeholder="Select Room"
                          value={row.or_room_id}
                          onChange={(id) => updateRow(row.id, 'or_room_id', id)}
                          options={rooms.map(r => ({ id: r.id, label: r.name }))}
                          error={errors.or_room_id}
                        />
                      </div>
                    </div>

                    {/* Second row of fields (conditional) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      {/* Operative Side — only shown if procedure requires it */}
                      {showOperativeSide && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Operative Side
                          </label>
                          <select
                            value={row.operative_side}
                            onChange={(e) => updateRow(row.id, 'operative_side', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                          >
                            <option value="">Select Side</option>
                            {OPERATIVE_SIDE_OPTIONS.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Implant Company (popover-based multi-select) */}
                      {effectiveFacilityId && (
                        <div className={showOperativeSide ? '' : 'lg:col-start-1'}>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Implant Company
                            {row.implant_company_ids.length > 0 && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">
                                {row.implant_company_ids.length}
                              </span>
                            )}
                          </label>
                          <ImplantCompanySelect
                            facilityId={effectiveFacilityId}
                            selectedIds={row.implant_company_ids}
                            onChange={(ids) => updateRow(row.id, 'implant_company_ids', ids)}
                          />
                        </div>
                      )}

                      {/* Rep Required Override */}
                      {row.procedure_type_id && (
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={effectiveRepRequired}
                              onChange={(e) => updateRow(row.id, 'rep_required_override', e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                            />
                            Rep Required
                            {row.rep_required_override !== null && row.rep_required_override !== procRequiresRep && (
                              <span className="text-[10px] text-amber-600 font-medium">(overridden)</span>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add Row Button */}
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= MAX_ROWS}
              className={`mt-4 w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
                rows.length >= MAX_ROWS
                  ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50'
              }`}
            >
              <Plus className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              Add Case Row
            </button>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                setShowLeaveConfirm(true)
              } else {
                router.push('/cases')
              }
            }}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {rows.length} case{rows.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create {rows.length} Case{rows.length === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        </div>
      </Container>
    </DashboardLayout>
  )
}

// ============================================
// EXPORT WITH SUSPENSE BOUNDARY
// ============================================

export default function BulkCreatePage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    }>
      <BulkCreateContent />
    </Suspense>
  )
}
