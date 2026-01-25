// app/admin/facilities/new/page.tsx
// Create Facility Wizard - Multi-step form for onboarding new facilities

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { useUser } from '../../../../lib/UserContext'
import DashboardLayout from '../../../../components/layouts/DashboardLayout'
import { facilityAudit } from '../../../../lib/audit-logger'


interface FacilityData {
  name: string
  address: string
  subscriptionStatus: 'trial' | 'active'
  trialDays: number
}

interface AdminData {
  firstName: string
  lastName: string
  email: string
  roleId: string
}

interface SetupOptions {
  createDefaultRooms: boolean
  createDefaultProcedures: boolean
  sendWelcomeEmail: boolean
}

interface UserRole {
  id: string
  name: string
}

export default function CreateFacilityPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userData, isGlobalAdmin, loading: userLoading } = useUser()

  // Form state
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Facility details
  const [facilityData, setFacilityData] = useState<FacilityData>({
    name: '',
    address: '',
    subscriptionStatus: 'trial',
    trialDays: 30,
  })

  // Step 2: Admin user
  const [adminData, setAdminData] = useState<AdminData>({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
  })

  // Step 3: Setup options
  const [setupOptions, setSetupOptions] = useState<SetupOptions>({
    createDefaultRooms: true,
    createDefaultProcedures: true,
    sendWelcomeEmail: true,
  })

  // Available roles
  const [roles, setRoles] = useState<UserRole[]>([])

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch roles
  useEffect(() => {
    async function fetchRoles() {
      const { data } = await supabase
        .from('user_roles')
        .select('id, name')
        .order('name')

      if (data) {
        setRoles(data)
        // Default to 'admin' role if available
        const adminRole = data.find(r => r.name === 'admin')
        if (adminRole) {
          setAdminData(prev => ({ ...prev, roleId: adminRole.id }))
        }
      }
    }

    fetchRoles()
  }, [supabase])

  // Validation
  const isStep1Valid = facilityData.name.trim().length > 0
  const isStep2Valid = 
    adminData.firstName.trim().length > 0 &&
    adminData.lastName.trim().length > 0 &&
    adminData.email.trim().length > 0 &&
    adminData.email.includes('@') &&
    adminData.roleId.length > 0

  // Handle form submission
 const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid) return

    setSubmitting(true)
    setError(null)

    try {
      // Calculate trial end date
      const trialEndsAt = facilityData.subscriptionStatus === 'trial'
        ? new Date(Date.now() + facilityData.trialDays * 86400000).toISOString()
        : null

      // 1. Create facility
      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .insert({
          name: facilityData.name.trim(),
          address: facilityData.address.trim() || null,
          subscription_status: facilityData.subscriptionStatus,
          trial_ends_at: trialEndsAt,
          subscription_started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (facilityError) throw new Error('Failed to create facility: ' + facilityError.message)

      // 2. Create default OR rooms if selected
      if (setupOptions.createDefaultRooms) {
        const defaultRooms = ['OR 1', 'OR 2', 'OR 3']
        await supabase
          .from('or_rooms')
          .insert(defaultRooms.map(name => ({
            facility_id: facility.id,
            name,
          })))
      }

      // 3. Copy default procedure types if selected
      if (setupOptions.createDefaultProcedures) {
        const { data: defaultProcs } = await supabase
          .from('dprocedure_type_templates')
          .select('id, name, body_region_id, implant_category')
          .eq('is_active', true)

        if (defaultProcs && defaultProcs.length > 0) {
          await supabase
            .from('procedure_types')
            .upsert(defaultProcs.map(p => ({
              facility_id: facility.id,
              name: p.name,
              body_region_id: p.body_region_id,
              implant_category: p.implant_category,
              source_template_id: p.id,  // IMPORTANT: Track the source for milestone mapping
            })), { onConflict: 'facility_id,name', ignoreDuplicates: true })
        }

        // 4. Copy milestone types to facility_milestones
        const { data: milestoneTypes } = await supabase
          .from('milestone_types')
          .select('*')
          .eq('is_active', true)
          .order('display_order')

        if (milestoneTypes && milestoneTypes.length > 0) {
          const milestoneIdMap: Record<string, string> = {}

          // Insert facility milestones
          for (const mt of milestoneTypes) {
            const { data: newMilestone } = await supabase
              .from('facility_milestones')
              .insert({
                facility_id: facility.id,
                name: mt.name,
                display_name: mt.display_name,
                display_order: mt.display_order,
                pair_position: mt.pair_position,
                source_milestone_type_id: mt.id,
                is_active: true
              })
              .select()
              .single()

            if (newMilestone) {
              milestoneIdMap[mt.id] = newMilestone.id
            }
          }

          // Update pair_with_id references
          for (const mt of milestoneTypes) {
            if (mt.pair_with_id && milestoneIdMap[mt.id] && milestoneIdMap[mt.pair_with_id]) {
              await supabase
                .from('facility_milestones')
                .update({ pair_with_id: milestoneIdMap[mt.pair_with_id] })
                .eq('id', milestoneIdMap[mt.id])
            }
          }

          // 5. Copy procedure-milestone configs
          const { data: facilityProcedures } = await supabase
            .from('procedure_types')
            .select('id, source_template_id')
            .eq('facility_id', facility.id)

          if (facilityProcedures) {
            const procedureIdMap: Record<string, string> = {}
            for (const fp of facilityProcedures) {
              if (fp.source_template_id) {
                procedureIdMap[fp.source_template_id] = fp.id
              }
            }

            const { data: defaultConfigs } = await supabase
              .from('procedure_milestone_templates')
              .select('*')

            if (defaultConfigs && defaultConfigs.length > 0) {
              const facilityConfigs = defaultConfigs
                .filter(dc => 
                  procedureIdMap[dc.procedure_type_template_id] && 
                  milestoneIdMap[dc.milestone_type_id]
                )
                .map(dc => ({
                  facility_id: facility.id,
                  procedure_type_id: procedureIdMap[dc.procedure_type_template_id],
                  facility_milestone_id: milestoneIdMap[dc.milestone_type_id],
                  display_order: dc.display_order
                }))

              if (facilityConfigs.length > 0) {
                await supabase
                  .from('procedure_milestone_config')
                  .insert(facilityConfigs)
              }
            }
           // 6. Copy default complexities to facility
const { data: defaultComplexities } = await supabase
  .from('default_complexities')
  .select('*')
  .eq('is_active', true)
  .order('display_order')

if (defaultComplexities && defaultComplexities.length > 0) {
  await supabase
    .from('complexities')
    .insert(defaultComplexities.map(dc => ({
      facility_id: facility.id,
      name: dc.name,
      display_name: dc.display_name,
      description: dc.description,
      procedure_category_ids: dc.procedure_category_ids,
      is_active: true,
      display_order: dc.display_order,
      source_template_id: dc.id  // Track the source
    })))
} 
          }
        }
      }

      // 6. Send invite email if selected
      if (setupOptions.sendWelcomeEmail) {
        const { data: session } = await supabase.auth.getSession()
        
        const inviteResponse = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            email: adminData.email.trim(),
            firstName: adminData.firstName.trim(),
            lastName: adminData.lastName.trim(),
            accessLevel: 'facility_admin',
            facilityId: facility.id,
            roleId: adminData.roleId,
          }),
        })

        const inviteResult = await inviteResponse.json()

        if (!inviteResponse.ok) {
          console.error('Invite failed:', inviteResult.error)
        }
      }

      // 7. Log audit events
      await facilityAudit.created(supabase, facilityData.name.trim(), facility.id)

      // Success! Redirect to facility detail page
      router.push(`/admin/facilities/${facility.id}`)
    } catch (err) {
      console.error('Error creating facility:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create New Facility</h1>
          <p className="text-slate-500 mt-1">Set up a new customer in ORbit</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s < step ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 4 && (
                <div className={`w-12 h-1 ml-2 rounded ${s < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Step 1: Facility Details */}
          {step === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Facility Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Facility Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={facilityData.name}
                    onChange={(e) => setFacilityData({ ...facilityData, name: e.target.value })}
                    placeholder="e.g., Memorial General Hospital"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={facilityData.address}
                    onChange={(e) => setFacilityData({ ...facilityData, address: e.target.value })}
                    placeholder="e.g., 123 Medical Center Drive, Chicago, IL"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subscription Status
                  </label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={facilityData.subscriptionStatus === 'trial'}
                        onChange={() => setFacilityData({ ...facilityData, subscriptionStatus: 'trial' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">Trial</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={facilityData.subscriptionStatus === 'active'}
                        onChange={() => setFacilityData({ ...facilityData, subscriptionStatus: 'active' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">Active (Paid)</span>
                    </label>
                  </div>
                </div>

                {facilityData.subscriptionStatus === 'trial' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Trial Length
                    </label>
                    <select
                      value={facilityData.trialDays}
                      onChange={(e) => setFacilityData({ ...facilityData, trialDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Admin User */}
          {step === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">First Administrator</h2>
              <p className="text-sm text-slate-500 mb-4">
                This person will be the facility admin and can invite other staff.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adminData.firstName}
                      onChange={(e) => setAdminData({ ...adminData, firstName: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adminData.lastName}
                      onChange={(e) => setAdminData({ ...adminData, lastName: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={adminData.email}
                    onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                    placeholder="admin@hospital.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={adminData.roleId}
                    onChange={(e) => setAdminData({ ...adminData, roleId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select role...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
<p>They'll receive an email with a link to create their password.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Setup Options */}
          {step === 3 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Default Setup</h2>
              <p className="text-sm text-slate-500 mb-4">
                Choose what to set up automatically for this facility.
              </p>
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={setupOptions.createDefaultRooms}
                    onChange={(e) => setSetupOptions({ ...setupOptions, createDefaultRooms: e.target.checked })}
                    className="w-5 h-5 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-slate-900">Create default OR rooms</p>
                    <p className="text-sm text-slate-500 mt-0.5">Adds OR 1, OR 2, and OR 3</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={setupOptions.createDefaultProcedures}
                    onChange={(e) => setSetupOptions({ ...setupOptions, createDefaultProcedures: e.target.checked })}
                    className="w-5 h-5 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-slate-900">Create default procedure types</p>
                    <p className="text-sm text-slate-500 mt-0.5">Copies standard procedures from template</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={setupOptions.sendWelcomeEmail}
                    onChange={(e) => setSetupOptions({ ...setupOptions, sendWelcomeEmail: e.target.checked })}
                    className="w-5 h-5 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <p className="font-medium text-slate-900">Send welcome email</p>
                    <p className="text-sm text-slate-500 mt-0.5">Emails login credentials to the administrator</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Review & Create</h2>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Facility</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="font-semibold text-slate-900">{facilityData.name}</p>
                    {facilityData.address && (
                      <p className="text-sm text-slate-600 mt-1">{facilityData.address}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        facilityData.subscriptionStatus === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {facilityData.subscriptionStatus === 'active' ? 'Active' : `${facilityData.trialDays}-day Trial`}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Administrator</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="font-semibold text-slate-900">{adminData.firstName} {adminData.lastName}</p>
                    <p className="text-sm text-slate-600 mt-1">{adminData.email}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Role: {roles.find(r => r.id === adminData.roleId)?.name || 'Unknown'}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Setup</h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                    <p className="text-sm text-slate-700 flex items-center gap-2">
                      {setupOptions.createDefaultRooms ? '✓' : '✗'} Default OR rooms
                    </p>
                    <p className="text-sm text-slate-700 flex items-center gap-2">
                      {setupOptions.createDefaultProcedures ? '✓' : '✗'} Default procedures
                    </p>
                    <p className="text-sm text-slate-700 flex items-center gap-2">
                      {setupOptions.sendWelcomeEmail ? '✓' : '✗'} Welcome email
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                disabled={submitting}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <button
                onClick={() => router.push('/admin/facilities')}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Facility
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
