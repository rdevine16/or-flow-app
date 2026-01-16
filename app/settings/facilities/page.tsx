'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { facilityAudit, procedureAudit, genericAuditLog } from '../../../lib/audit-logger'

// =====================================================
// TYPES
// =====================================================

interface ProcedureType {
  id: string
  name: string
  soft_goods_cost: number | null
  hard_goods_cost: number | null
}

interface ProcedureReimbursement {
  id: string
  procedure_type_id: string
  payer_id: string | null
  reimbursement: number
  effective_date: string
}

interface Payer {
  id: string
  name: string
  facility_id: string
  deleted_at: string | null
}

interface Facility {
  id: string
  name: string
  or_hourly_rate: number | null
}

type SubTab = 'pricing' | 'payers'

// =====================================================
// COMPONENT
// =====================================================

export default function FinancialsSettingsPage() {
  const supabase = createClient()
  
  // Core state
  const [activeTab, setActiveTab] = useState<SubTab>('pricing')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // User/Facility state
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [currentFacility, setCurrentFacility] = useState<Facility | null>(null)
  
  // OR Rate state
  const [orHourlyRate, setOrHourlyRate] = useState<string>('')
  const [editingOrRate, setEditingOrRate] = useState(false)
  
  // Procedures state
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [reimbursements, setReimbursements] = useState<ProcedureReimbursement[]>([])
  
  // Payers state
  const [payers, setPayers] = useState<Payer[]>([])
  const [showInactivePayers, setShowInactivePayers] = useState(false)
  
  // Slide-out panel state
  const [slideOutOpen, setSlideOutOpen] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureType | null>(null)
  const [procedureForm, setProcedureForm] = useState({
    soft_goods_cost: '',
    hard_goods_cost: '',
    default_reimbursement: '',
  })
  const [payerReimbursements, setPayerReimbursements] = useState<{ payer_id: string; reimbursement: string }[]>([])
  
  // Payer modal state
  const [payerModalOpen, setPayerModalOpen] = useState(false)
  const [payerModalMode, setPayerModalMode] = useState<'add' | 'edit'>('add')
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
  const [payerName, setPayerName] = useState('')
  const [deletePayerConfirm, setDeletePayerConfirm] = useState<string | null>(null)

  // =====================================================
  // DATA FETCHING
  // =====================================================

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      if (userData) {
        const isGlobal = userData.access_level === 'global_admin'
        setIsGlobalAdmin(isGlobal)

        if (isGlobal) {
          const { data: facilitiesData } = await supabase
            .from('facilities')
            .select('id, name, or_hourly_rate')
            .order('name')

          if (facilitiesData && facilitiesData.length > 0) {
            setFacilities(facilitiesData)
            setSelectedFacilityId(facilitiesData[0].id)
            setCurrentFacility(facilitiesData[0])
            setOrHourlyRate(facilitiesData[0].or_hourly_rate?.toString() || '')
            fetchData(facilitiesData[0].id)
          } else {
            setLoading(false)
          }
        } else {
          const { data: facilityData } = await supabase
            .from('facilities')
            .select('id, name, or_hourly_rate')
            .eq('id', userData.facility_id)
            .single()

          if (facilityData) {
            setSelectedFacilityId(facilityData.id)
            setCurrentFacility(facilityData)
            setOrHourlyRate(facilityData.or_hourly_rate?.toString() || '')
            fetchData(facilityData.id)
          } else {
            setLoading(false)
          }
        }
      }
    }
  }

  const fetchData = async (facilityId: string) => {
    setLoading(true)

    const [proceduresResult, reimbursementsResult, payersResult] = await Promise.all([
      supabase
        .from('procedure_types')
        .select('id, name, soft_goods_cost, hard_goods_cost')
        .eq('facility_id', facilityId)
        .order('name'),
      supabase
        .from('procedure_reimbursements')
        .select('id, procedure_type_id, payer_id, reimbursement, effective_date')
        .in('procedure_type_id', 
          (await supabase.from('procedure_types').select('id').eq('facility_id', facilityId)).data?.map(p => p.id) || []
        ),
      supabase
        .from('payers')
        .select('id, name, facility_id, deleted_at')
        .eq('facility_id', facilityId)
        .order('name'),
    ])

    setProcedures(proceduresResult.data || [])
    setReimbursements(reimbursementsResult.data || [])
    setPayers(payersResult.data || [])
    setLoading(false)
  }

  const handleFacilityChange = (facilityId: string) => {
    const facility = facilities.find(f => f.id === facilityId)
    setSelectedFacilityId(facilityId)
    setCurrentFacility(facility || null)
    setOrHourlyRate(facility?.or_hourly_rate?.toString() || '')
    fetchData(facilityId)
  }

  // =====================================================
  // OR HOURLY RATE
  // =====================================================

  const handleSaveOrRate = async () => {
    if (!selectedFacilityId) return
    setSaving(true)

    const oldRate = currentFacility?.or_hourly_rate
    const newRate = orHourlyRate ? parseFloat(orHourlyRate) : null

    // Use .select() to verify the update actually happened
    const { data, error } = await supabase
      .from('facilities')
      .update({ or_hourly_rate: newRate })
      .eq('id', selectedFacilityId)
      .select('id, name, or_hourly_rate')
      .single()

    if (error) {
      console.error('Error updating OR rate:', error)
      setSaving(false)
      return
    }

    if (!data) {
      console.error('Update returned no data - RLS may be blocking')
      setSaving(false)
      return
    }

    // Update local state with the actual returned value
    setCurrentFacility(prev => prev ? { ...prev, or_hourly_rate: data.or_hourly_rate } : null)
    
    // Also update the facilities array (for global admins)
    if (isGlobalAdmin) {
      setFacilities(prev => prev.map(f => 
        f.id === selectedFacilityId 
          ? { ...f, or_hourly_rate: data.or_hourly_rate }
          : f
      ))
    }
    
    setEditingOrRate(false)

    // Audit log
    await genericAuditLog(supabase, 'facility.or_rate_updated', {
      targetType: 'facility',
      targetId: selectedFacilityId,
      targetLabel: currentFacility?.name || '',
      oldValues: { or_hourly_rate: oldRate },
      newValues: { or_hourly_rate: data.or_hourly_rate },
      facilityId: selectedFacilityId,
    })

    setSaving(false)
  }

  // =====================================================
  // PROCEDURE FINANCIALS
  // =====================================================

  const getDefaultReimbursement = (procedureId: string): number | null => {
    const defaultRate = reimbursements.find(
      r => r.procedure_type_id === procedureId && r.payer_id === null
    )
    return defaultRate?.reimbursement || null
  }

  const getPayerReimbursements = (procedureId: string): ProcedureReimbursement[] => {
    return reimbursements.filter(
      r => r.procedure_type_id === procedureId && r.payer_id !== null
    )
  }

  const calculateBaseMargin = (procedure: ProcedureType): number | null => {
    const reimbursement = getDefaultReimbursement(procedure.id)
    if (reimbursement === null) return null
    
    const softGoods = procedure.soft_goods_cost || 0
    const hardGoods = procedure.hard_goods_cost || 0
    
    return reimbursement - softGoods - hardGoods
  }

  const isConfigured = (procedure: ProcedureType): boolean => {
    const hasReimbursement = getDefaultReimbursement(procedure.id) !== null
    const hasCosts = procedure.soft_goods_cost !== null || procedure.hard_goods_cost !== null
    return hasReimbursement || hasCosts
  }

  const openProcedureSlideOut = (procedure: ProcedureType) => {
    setSelectedProcedure(procedure)
    setProcedureForm({
      soft_goods_cost: procedure.soft_goods_cost?.toString() || '',
      hard_goods_cost: procedure.hard_goods_cost?.toString() || '',
      default_reimbursement: getDefaultReimbursement(procedure.id)?.toString() || '',
    })
    
    // Load payer-specific reimbursements
    const payerRates = getPayerReimbursements(procedure.id)
    setPayerReimbursements(
      payerRates.map(r => ({
        payer_id: r.payer_id!,
        reimbursement: r.reimbursement.toString(),
      }))
    )
    
    setSlideOutOpen(true)
  }

  const closeProcedureSlideOut = () => {
    setSlideOutOpen(false)
    setSelectedProcedure(null)
    setProcedureForm({ soft_goods_cost: '', hard_goods_cost: '', default_reimbursement: '' })
    setPayerReimbursements([])
  }

  const handleSaveProcedureFinancials = async () => {
    if (!selectedProcedure || !selectedFacilityId) return
    setSaving(true)

    const softGoodsCost = procedureForm.soft_goods_cost ? parseFloat(procedureForm.soft_goods_cost) : null
    const hardGoodsCost = procedureForm.hard_goods_cost ? parseFloat(procedureForm.hard_goods_cost) : null
    const defaultReimbursement = procedureForm.default_reimbursement ? parseFloat(procedureForm.default_reimbursement) : null

    // Update procedure costs
    const { error: procedureError } = await supabase
      .from('procedure_types')
      .update({
        soft_goods_cost: softGoodsCost,
        hard_goods_cost: hardGoodsCost,
      })
      .eq('id', selectedProcedure.id)

    if (procedureError) {
      console.error('Error updating procedure costs:', procedureError)
      setSaving(false)
      return
    }

    // Audit log for costs
    await genericAuditLog(supabase, 'procedure_type.costs_updated', {
      targetType: 'procedure_type',
      targetId: selectedProcedure.id,
      targetLabel: selectedProcedure.name,
      oldValues: {
        soft_goods_cost: selectedProcedure.soft_goods_cost,
        hard_goods_cost: selectedProcedure.hard_goods_cost,
      },
      newValues: {
        soft_goods_cost: softGoodsCost,
        hard_goods_cost: hardGoodsCost,
      },
      facilityId: selectedFacilityId,
    })

    // Handle default reimbursement
    const existingDefault = reimbursements.find(
      r => r.procedure_type_id === selectedProcedure.id && r.payer_id === null
    )

    if (defaultReimbursement !== null) {
      if (existingDefault) {
        // Update existing
        await supabase
          .from('procedure_reimbursements')
          .update({ reimbursement: defaultReimbursement, effective_date: new Date().toISOString().split('T')[0] })
          .eq('id', existingDefault.id)
      } else {
        // Insert new
        await supabase
          .from('procedure_reimbursements')
          .insert({
            procedure_type_id: selectedProcedure.id,
            payer_id: null,
            reimbursement: defaultReimbursement,
            effective_date: new Date().toISOString().split('T')[0],
          })
      }
    } else if (existingDefault) {
      // Remove if cleared
      await supabase
        .from('procedure_reimbursements')
        .delete()
        .eq('id', existingDefault.id)
    }

    // Handle payer-specific reimbursements
    for (const payerRate of payerReimbursements) {
      const existingPayerRate = reimbursements.find(
        r => r.procedure_type_id === selectedProcedure.id && r.payer_id === payerRate.payer_id
      )
      const reimbursementValue = payerRate.reimbursement ? parseFloat(payerRate.reimbursement) : null

      if (reimbursementValue !== null) {
        if (existingPayerRate) {
          await supabase
            .from('procedure_reimbursements')
            .update({ reimbursement: reimbursementValue, effective_date: new Date().toISOString().split('T')[0] })
            .eq('id', existingPayerRate.id)
        } else {
          await supabase
            .from('procedure_reimbursements')
            .insert({
              procedure_type_id: selectedProcedure.id,
              payer_id: payerRate.payer_id,
              reimbursement: reimbursementValue,
              effective_date: new Date().toISOString().split('T')[0],
            })
        }
      } else if (existingPayerRate) {
        await supabase
          .from('procedure_reimbursements')
          .delete()
          .eq('id', existingPayerRate.id)
      }
    }

    // Refresh data
    await fetchData(selectedFacilityId)
    closeProcedureSlideOut()
    setSaving(false)
  }

  const addPayerReimbursement = () => {
    const activePayers = payers.filter(p => !p.deleted_at)
    const usedPayerIds = payerReimbursements.map(pr => pr.payer_id)
    const availablePayers = activePayers.filter(p => !usedPayerIds.includes(p.id))
    
    if (availablePayers.length > 0) {
      setPayerReimbursements([
        ...payerReimbursements,
        { payer_id: availablePayers[0].id, reimbursement: '' }
      ])
    }
  }

  const removePayerReimbursement = (index: number) => {
    setPayerReimbursements(payerReimbursements.filter((_, i) => i !== index))
  }

  // =====================================================
  // PAYER MANAGEMENT
  // =====================================================

  const openAddPayerModal = () => {
    setPayerModalMode('add')
    setPayerName('')
    setSelectedPayer(null)
    setPayerModalOpen(true)
  }

  const openEditPayerModal = (payer: Payer) => {
    setPayerModalMode('edit')
    setPayerName(payer.name)
    setSelectedPayer(payer)
    setPayerModalOpen(true)
  }

  const closePayerModal = () => {
    setPayerModalOpen(false)
    setPayerName('')
    setSelectedPayer(null)
  }

  const handleSavePayer = async () => {
    if (!payerName.trim() || !selectedFacilityId) return
    setSaving(true)

    if (payerModalMode === 'add') {
      const { data, error } = await supabase
        .from('payers')
        .insert({
          name: payerName.trim(),
          facility_id: selectedFacilityId,
        })
        .select()
        .single()

      if (!error && data) {
        setPayers([...payers, data].sort((a, b) => a.name.localeCompare(b.name)))
        
        await genericAuditLog(supabase, 'payer.created', {
          targetType: 'payer',
          targetId: data.id,
          targetLabel: payerName.trim(),
          newValues: { name: payerName.trim() },
          facilityId: selectedFacilityId,
        })
      }
    } else if (selectedPayer) {
      const { error } = await supabase
        .from('payers')
        .update({ name: payerName.trim() })
        .eq('id', selectedPayer.id)

      if (!error) {
        setPayers(payers.map(p => 
          p.id === selectedPayer.id ? { ...p, name: payerName.trim() } : p
        ).sort((a, b) => a.name.localeCompare(b.name)))

        await genericAuditLog(supabase, 'payer.updated', {
          targetType: 'payer',
          targetId: selectedPayer.id,
          targetLabel: payerName.trim(),
          oldValues: { name: selectedPayer.name },
          newValues: { name: payerName.trim() },
          facilityId: selectedFacilityId,
        })
      }
    }

    closePayerModal()
    setSaving(false)
  }

  const handleDeletePayer = async (payerId: string) => {
    const payer = payers.find(p => p.id === payerId)
    if (!payer || !selectedFacilityId) return

    // Soft delete
    const { error } = await supabase
      .from('payers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', payerId)

    if (!error) {
      setPayers(payers.map(p => 
        p.id === payerId ? { ...p, deleted_at: new Date().toISOString() } : p
      ))

      await genericAuditLog(supabase, 'payer.deleted', {
        targetType: 'payer',
        targetId: payerId,
        targetLabel: payer.name,
        facilityId: selectedFacilityId,
      })
    }

    setDeletePayerConfirm(null)
  }

  const handleRestorePayer = async (payerId: string) => {
    const payer = payers.find(p => p.id === payerId)
    if (!payer || !selectedFacilityId) return

    const { error } = await supabase
      .from('payers')
      .update({ deleted_at: null })
      .eq('id', payerId)

    if (!error) {
      setPayers(payers.map(p => 
        p.id === payerId ? { ...p, deleted_at: null } : p
      ))

      await genericAuditLog(supabase, 'payer.restored', {
        targetType: 'payer',
        targetId: payerId,
        targetLabel: payer.name,
        facilityId: selectedFacilityId,
      })
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const formatCurrency = (value: number | null): string => {
    if (value === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const activePayers = payers.filter(p => !p.deleted_at)
  const inactivePayers = payers.filter(p => p.deleted_at)
  const selectedFacility = facilities.find(f => f.id === selectedFacilityId)

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Financials"
          description="Manage procedure costs, reimbursement rates, and payers."
        >
          {/* Facility Selector (Global Admin Only) */}
          {isGlobalAdmin && facilities.length > 0 && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Facility
              </label>
              <select
                value={selectedFacilityId || ''}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className="w-full md:w-80 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Managing financials for: <span className="font-medium text-slate-700">{selectedFacility?.name}</span>
              </p>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="mb-6 border-b border-slate-200">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('pricing')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pricing'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Procedure Pricing
              </button>
              <button
                onClick={() => setActiveTab('payers')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'payers'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Payers
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : !selectedFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : activeTab === 'pricing' ? (
            <>
              {/* OR Hourly Rate Section */}
              <div className="mb-6 p-5 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">OR Hourly Rate</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Cost per hour to operate the OR</p>
                  </div>
                  {editingOrRate ? (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="number"
                          value={orHourlyRate}
                          onChange={(e) => setOrHourlyRate(e.target.value)}
                          className="w-32 pl-7 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-sm text-slate-500">/hr</span>
                      <button
                        onClick={handleSaveOrRate}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setOrHourlyRate(currentFacility?.or_hourly_rate?.toString() || '')
                          setEditingOrRate(false)
                        }}
                        className="px-3 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-slate-900">
                        {currentFacility?.or_hourly_rate 
                          ? `${formatCurrency(currentFacility.or_hourly_rate)}/hr`
                          : <span className="text-slate-400">Not set</span>
                        }
                      </span>
                      <button
                        onClick={() => setEditingOrRate(true)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Procedures Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-medium text-slate-900">Procedure Pricing</h3>
                  <p className="text-sm text-slate-500">{procedures.length} procedures</p>
                </div>

                {procedures.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-slate-500">No procedures defined yet.</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Add procedures in Settings → Procedure Types first.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-3">Procedure</div>
                      <div className="col-span-2 text-right">Reimbursement</div>
                      <div className="col-span-2 text-right">Hard Goods</div>
                      <div className="col-span-2 text-right">Soft Goods</div>
                      <div className="col-span-2 text-right">Base Margin</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {procedures.map((procedure) => {
                        const configured = isConfigured(procedure)
                        const baseMargin = calculateBaseMargin(procedure)
                        
                        return (
                          <div
                            key={procedure.id}
                            onClick={() => openProcedureSlideOut(procedure)}
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors cursor-pointer ${
                              !configured ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {/* Procedure Name */}
                            <div className="col-span-3 flex items-center gap-2">
                              <p className="font-medium text-slate-900">{procedure.name}</p>
                              {!configured && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                                  Not configured
                                </span>
                              )}
                            </div>

                            {/* Reimbursement */}
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${getDefaultReimbursement(procedure.id) ? 'text-slate-900' : 'text-slate-400'}`}>
                                {formatCurrency(getDefaultReimbursement(procedure.id))}
                              </span>
                            </div>

                            {/* Hard Goods */}
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${procedure.hard_goods_cost ? 'text-slate-900' : 'text-slate-400'}`}>
                                {formatCurrency(procedure.hard_goods_cost)}
                              </span>
                            </div>

                            {/* Soft Goods */}
                            <div className="col-span-2 text-right">
                              <span className={`text-sm ${procedure.soft_goods_cost ? 'text-slate-900' : 'text-slate-400'}`}>
                                {formatCurrency(procedure.soft_goods_cost)}
                              </span>
                            </div>

                            {/* Base Margin */}
                            <div className="col-span-2 text-right">
                              <span className={`text-sm font-medium ${
                                baseMargin !== null
                                  ? baseMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                                  : 'text-slate-400'
                              }`}>
                                {formatCurrency(baseMargin)}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openProcedureSlideOut(procedure)
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Payers Tab */
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Payers</h3>
                  <p className="text-sm text-slate-500">{activePayers.length} active payers</p>
                </div>
                <button
                  onClick={openAddPayerModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Payer
                </button>
              </div>

              {activePayers.length === 0 && inactivePayers.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-500">No payers defined yet.</p>
                  <button
                    onClick={openAddPayerModal}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Add your first payer
                  </button>
                </div>
              ) : (
                <>
                  {/* Active Payers */}
                  <div className="divide-y divide-slate-100">
                    {activePayers.map((payer) => (
                      <div
                        key={payer.id}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {payer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-900">{payer.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditPayerModal(payer)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deletePayerConfirm === payer.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeletePayer(payer.id)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletePayerConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletePayerConfirm(payer.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inactive Payers */}
                  {inactivePayers.length > 0 && (
                    <div className="border-t border-slate-200">
                      <button
                        onClick={() => setShowInactivePayers(!showInactivePayers)}
                        className="w-full px-6 py-3 flex items-center justify-between text-sm text-slate-500 hover:bg-slate-50"
                      >
                        <span>{inactivePayers.length} inactive payer{inactivePayers.length > 1 ? 's' : ''}</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${showInactivePayers ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showInactivePayers && (
                        <div className="divide-y divide-slate-100 bg-slate-50/50">
                          {inactivePayers.map((payer) => (
                            <div
                              key={payer.id}
                              className="px-6 py-4 flex items-center justify-between opacity-60"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                  <span className="text-sm font-medium text-slate-500">
                                    {payer.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-slate-600">{payer.name}</span>
                                <span className="text-xs text-slate-400">Inactive</span>
                              </div>
                              <button
                                onClick={() => handleRestorePayer(payer.id)}
                                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Procedure Slide-out Panel */}
          {slideOutOpen && selectedProcedure && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-40"
                onClick={closeProcedureSlideOut}
              />
              
              {/* Panel */}
              <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{selectedProcedure.name}</h3>
                    <p className="text-sm text-slate-500">Edit pricing details</p>
                  </div>
                  <button
                    onClick={closeProcedureSlideOut}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Costs Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Costs</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Hard Goods Cost
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                          <input
                            type="number"
                            value={procedureForm.hard_goods_cost}
                            onChange={(e) => setProcedureForm({ ...procedureForm, hard_goods_cost: e.target.value })}
                            className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Implants, devices, hardware</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Soft Goods Cost
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                          <input
                            type="number"
                            value={procedureForm.soft_goods_cost}
                            onChange={(e) => setProcedureForm({ ...procedureForm, soft_goods_cost: e.target.value })}
                            className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Consumables, sutures, drapes</p>
                      </div>
                    </div>
                  </div>

                  {/* Reimbursement Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Reimbursement</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Default Reimbursement
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                          <input
                            type="number"
                            value={procedureForm.default_reimbursement}
                            onChange={(e) => setProcedureForm({ ...procedureForm, default_reimbursement: e.target.value })}
                            className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Used when no payer is specified</p>
                      </div>

                      {/* Payer-specific rates */}
                      {activePayers.length > 0 && (
                        <div className="pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-slate-700">
                              Payer-Specific Rates
                            </label>
                            <button
                              onClick={addPayerReimbursement}
                              disabled={payerReimbursements.length >= activePayers.length}
                              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                              + Add payer rate
                            </button>
                          </div>
                          
                          {payerReimbursements.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No payer-specific rates configured</p>
                          ) : (
                            <div className="space-y-3">
                              {payerReimbursements.map((pr, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <select
                                    value={pr.payer_id}
                                    onChange={(e) => {
                                      const updated = [...payerReimbursements]
                                      updated[index].payer_id = e.target.value
                                      setPayerReimbursements(updated)
                                    }}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  >
                                    {activePayers.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                  <div className="relative w-28">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                    <input
                                      type="number"
                                      value={pr.reimbursement}
                                      onChange={(e) => {
                                        const updated = [...payerReimbursements]
                                        updated[index].reimbursement = e.target.value
                                        setPayerReimbursements(updated)
                                      }}
                                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      placeholder="0"
                                    />
                                  </div>
                                  <button
                                    onClick={() => removePayerReimbursement(index)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculated Margin */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-1">Base Margin (before OR time)</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {(() => {
                          const reimbursement = procedureForm.default_reimbursement ? parseFloat(procedureForm.default_reimbursement) : null
                          const hardGoods = procedureForm.hard_goods_cost ? parseFloat(procedureForm.hard_goods_cost) : 0
                          const softGoods = procedureForm.soft_goods_cost ? parseFloat(procedureForm.soft_goods_cost) : 0
                          if (reimbursement === null) return '—'
                          return formatCurrency(reimbursement - hardGoods - softGoods)
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closeProcedureSlideOut}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProcedureFinancials}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Payer Modal */}
          {payerModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {payerModalMode === 'add' ? 'Add Payer' : 'Edit Payer'}
                  </h3>
                </div>
                <div className="p-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Payer Name *
                    </label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g., Medicare, BCBS, Aetna"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closePayerModal}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePayer}
                    disabled={saving || !payerName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : payerModalMode === 'add' ? 'Add Payer' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}
