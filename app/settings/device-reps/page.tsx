// app/settings/device-reps/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { deviceRepAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

interface DeviceRep {
  id: string
  user_id: string
  facility_id: string
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  accepted_at: string | null
  user_first_name: string
  user_last_name: string
  user_email: string
  user_phone: string | null
  company_name: string
  type: 'rep'
}

interface PendingInvite {
  id: string
  email: string
  facility_id: string
  created_at: string
  expires_at: string
  company_name: string
  type: 'invite'
}

type TableRow = (DeviceRep & { type: 'rep' }) | (PendingInvite & { type: 'invite' })

interface ImplantCompany {
  id: string
  name: string
}

interface InviteModalState {
  isOpen: boolean
}

// Helper to extract first item from Supabase joined array
function getFirst<T>(arr: T[] | T | null | undefined): T | null {
  if (Array.isArray(arr)) return arr[0] || null
  return arr || null
}

export default function DeviceRepsPage() {
  const supabase = createClient()
  const [reps, setReps] = useState<DeviceRep[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [facilityName, setFacilityName] = useState<string>('')
  const [inviteModal, setInviteModal] = useState<InviteModalState>({ isOpen: false })
  const [inviteForm, setInviteForm] = useState({ email: '', implant_company_id: '' })
  const [sending, setSending] = useState(false)
  const [actionConfirm, setActionConfirm] = useState<{ id: string; type: 'revoke' | 'cancel' } | null>(null)
  const [inviteLinkModal, setInviteLinkModal] = useState<{ isOpen: boolean; link: string; email: string }>({ isOpen: false, link: '', email: '' })
  const { showToast } = useToast()
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (!userData) return
    setFacilityId(userData.facility_id)

    // Get facility name
    const { data: facilityData } = await supabase
      .from('facilities')
      .select('name')
      .eq('id', userData.facility_id)
      .single()

    if (facilityData) {
      setFacilityName(facilityData.name)
    }

    // Fetch device reps with access to this facility
    const { data: repsData } = await supabase
      .from('facility_device_reps')
      .select(`
        id,
        user_id,
        facility_id,
        status,
        created_at,
        accepted_at,
        users!facility_device_reps_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone,
          implant_companies!users_implant_company_id_fkey (name)
        )
      `)
      .eq('facility_id', userData.facility_id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    // Transform reps data
    const transformedReps: DeviceRep[] = (repsData || []).map((rep: any) => {
      const user = getFirst(rep.users)
      const company = user ? getFirst(user.implant_companies) : null
      return {
        id: rep.id,
        user_id: rep.user_id,
        facility_id: rep.facility_id,
        status: rep.status,
        created_at: rep.created_at,
        accepted_at: rep.accepted_at,
        user_first_name: user?.first_name || '',
        user_last_name: user?.last_name || '',
        user_email: user?.email || '',
        user_phone: user?.phone || null,
        company_name: company?.name || 'Unknown Company',
        type: 'rep' as const,
      }
    })

    setReps(transformedReps)

    // Fetch pending invites
    const { data: invitesData } = await supabase
      .from('device_rep_invites')
      .select(`
        id,
        email,
        facility_id,
        created_at,
        expires_at,
        implant_companies (name)
      `)
      .eq('facility_id', userData.facility_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    // Transform invites data
    const transformedInvites: PendingInvite[] = (invitesData || []).map((invite: any) => {
      const company = getFirst(invite.implant_companies)
      return {
        id: invite.id,
        email: invite.email,
        facility_id: invite.facility_id,
        created_at: invite.created_at,
        expires_at: invite.expires_at,
        company_name: company?.name || 'Unknown Company',
        type: 'invite' as const,
      }
    })

    setPendingInvites(transformedInvites)

    // Fetch implant companies for invite dropdown
    const { data: companiesData } = await supabase
      .from('implant_companies')
      .select('id, name')
      .or(`facility_id.is.null,facility_id.eq.${userData.facility_id}`)
      .order('name')

    setCompanies(companiesData || [])
    setLoading(false)
  }

  const openInviteModal = () => {
    setInviteForm({ email: '', implant_company_id: '' })
    setInviteModal({ isOpen: true })
  }

  const closeInviteModal = () => {
    setInviteModal({ isOpen: false })
    setInviteForm({ email: '', implant_company_id: '' })
  }

  const handleSendInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.implant_company_id || !facilityId) return
    
    setSending(true)

    const inviteToken = crypto.randomUUID()
    const companyName = companies.find(c => c.id === inviteForm.implant_company_id)?.name || 'Unknown'

    const { data, error } = await supabase
      .from('device_rep_invites')
      .insert({
        facility_id: facilityId,
        email: inviteForm.email.trim().toLowerCase(),
        implant_company_id: inviteForm.implant_company_id,
        invite_token: inviteToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(`
        id,
        email,
        facility_id,
        created_at,
        expires_at,
        implant_companies (name)
      `)
      .single()

    if (!error && data) {
      const company = getFirst((data as any).implant_companies)
      const newInvite: PendingInvite = {
        id: data.id,
        email: data.email,
        facility_id: data.facility_id,
        created_at: data.created_at,
        expires_at: data.expires_at,
        company_name: company?.name || 'Unknown Company',
        type: 'invite',
      }
      setPendingInvites([newInvite, ...pendingInvites])
      closeInviteModal()

      try {
        const emailResponse = await fetch('/api/send-rep-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteForm.email.trim().toLowerCase(),
            facilityName,
            companyName,
            inviteToken,
          }),
        })

        if (!emailResponse.ok) {
          showToast({
            type: 'error',
            title: 'Failed to send invite email',
            message: 'There was an error sending the invite email.'
          })
        }
      } catch (emailError) {
        showToast({
          type: 'error',
          title: 'Error sending invite email',
          message: emailError instanceof Error ? emailError.message : 'Error sending invite email'
        })
      }

      await deviceRepAudit.invited(
        supabase,
        inviteForm.email,
        companyName,
        facilityId,
        facilityName
      )

      setInviteLinkModal({
        isOpen: true,
        link: `${window.location.origin}/invite/accept/${inviteToken}`,
        email: inviteForm.email.trim().toLowerCase()
      })
    }

    setSending(false)
  }

  const handleRevokeAccess = async (rep: DeviceRep) => {
    if (!facilityId) return

    const { error } = await supabase
      .from('facility_device_reps')
      .update({ status: 'revoked' })
      .eq('id', rep.id)

    if (!error) {
      setReps(reps.filter(r => r.id !== rep.id))
      setActionConfirm(null)

      await deviceRepAudit.accessRevoked(
        supabase,
        rep.user_id,
        rep.user_email,
        `${rep.user_first_name} ${rep.user_last_name}`,
        rep.company_name,
        facilityId
      )
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('device_rep_invites')
      .delete()
      .eq('id', inviteId)

    if (!error) {
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId))
      setActionConfirm(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Combine and sort: active reps first, then pending invites
  const activeReps = reps.filter(r => r.status === 'accepted')
  const allRows: TableRow[] = [
    ...activeReps.map(r => ({ ...r, type: 'rep' as const })),
    ...pendingInvites.map(i => ({ ...i, type: 'invite' as const })),
  ]

  const activeCount = activeReps.length
  const pendingCount = pendingInvites.length

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <SettingsLayout
          title="Device Rep Access"
          description="Manage implant company representative access to your cases."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">Device Representatives</h3>
                    <p className="text-sm text-slate-500">
                      {activeCount} active{pendingCount > 0 && <span className="text-amber-600"> · {pendingCount} pending</span>}
                    </p>
                  </div>
                  <button
                    onClick={openInviteModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Invite Rep
                  </button>
                </div>

                {/* Table */}
                {allRows.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-500">No device reps with access yet.</p>
                    <button
                      onClick={openInviteModal}
                      className="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      Invite your first device rep
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-4">Name / Email</div>
                      <div className="col-span-3">Company</div>
                      <div className="col-span-3">Status</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {allRows.map((row) => {
                        const isRep = row.type === 'rep'
                        const rep = isRep ? row as DeviceRep : null
                        const invite = !isRep ? row as PendingInvite : null

                        return (
                          <div 
                            key={row.id} 
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                          >
                            {/* Name / Email */}
                            <div className="col-span-4">
                              <div className="flex items-center gap-3">
                                {isRep && rep ? (
                                  <>
                                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 flex-shrink-0">
                                      {rep.user_first_name?.charAt(0)}{rep.user_last_name?.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">
                                        {rep.user_first_name} {rep.user_last_name}
                                      </p>
                                      <p className="text-sm text-slate-500 truncate">{rep.user_email}</p>
                                    </div>
                                  </>
                                ) : invite ? (
                                  <>
                                    <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-sm font-semibold text-amber-600 flex-shrink-0">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">{invite.email}</p>
                                      <p className="text-sm text-slate-400 truncate">Invite pending</p>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {/* Company */}
                            <div className="col-span-3">
                              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                                {isRep ? rep?.company_name : invite?.company_name}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="col-span-3">
                              {isRep ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Active
                                </span>
                              ) : invite ? (
                                <div className="text-xs">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                    Pending
                                  </span>
                                  <p className="text-slate-400 mt-1">Expires {formatDate(invite.expires_at)}</p>
                                </div>
                              ) : null}
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {actionConfirm?.id === row.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      if (isRep && rep) {
                                        handleRevokeAccess(rep)
                                      } else if (invite) {
                                        handleCancelInvite(invite.id)
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setActionConfirm(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActionConfirm({ 
                                    id: row.id, 
                                    type: isRep ? 'revoke' : 'cancel' 
                                  })}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title={isRep ? 'Revoke access' : 'Cancel invite'}
                                >
                                  {isRep ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <h4 className="font-medium text-slate-900 mb-2">How Device Rep Access Works</h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    Invited reps receive an email with a link to accept access
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    Reps can only view cases where their company's implants are assigned
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    Reps see limited info: case number, date, surgeon, procedure, and room
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    Reps receive push notifications for case changes
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {inviteModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">Invite Device Rep</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    They'll receive an email to create their account
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="rep@stryker.com"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Implant Company *
                    </label>
                    <select
                      value={inviteForm.implant_company_id}
                      onChange={(e) => setInviteForm({ ...inviteForm, implant_company_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select company...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-slate-500">
                      The rep will only see cases assigned to this company
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closeInviteModal}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={sending || !inviteForm.email.trim() || !inviteForm.implant_company_id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal */}
          {inviteLinkModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm text-center">
                <div className="p-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Invite Sent!</h3>
                  <p className="text-slate-600">
                    An invitation email has been sent to<br />
                    <span className="font-medium text-slate-900">{inviteLinkModal.email}</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-3">
                    The invite expires in 7 days.
                  </p>
                </div>
                <div className="px-6 py-4 border-t border-slate-200">
                  <button
                    onClick={() => setInviteLinkModal({ isOpen: false, link: '', email: '' })}
                    className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Done
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