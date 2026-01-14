'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { deviceRepAudit } from '@/lib/audit-logger'

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
}

interface PendingInvite {
  id: string
  email: string
  facility_id: string
  created_at: string
  expires_at: string
  company_name: string
}

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
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [facilityName, setFacilityName] = useState<string>('')
  const [inviteModal, setInviteModal] = useState<InviteModalState>({ isOpen: false })
  const [inviteForm, setInviteForm] = useState({ email: '', implant_company_id: '' })
  const [sending, setSending] = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)
  const [inviteLinkModal, setInviteLinkModal] = useState<{ isOpen: boolean; link: string; email: string }>({ isOpen: false, link: '', email: '' })

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
        users (
          id,
          first_name,
          last_name,
          email,
          phone,
          implant_companies (name)
        )
      `)
      .eq('facility_id', userData.facility_id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    // Transform reps data - Supabase returns joined tables as arrays
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

    // Generate invite token
    const inviteToken = crypto.randomUUID()

    // Create invite record
    const { data, error } = await supabase
      .from('device_rep_invites')
      .insert({
        facility_id: facilityId,
        email: inviteForm.email.trim().toLowerCase(),
        implant_company_id: inviteForm.implant_company_id,
        invite_token: inviteToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
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
      // Transform the new invite
      const company = getFirst((data as any).implant_companies)
      const newInvite: PendingInvite = {
        id: data.id,
        email: data.email,
        facility_id: data.facility_id,
        created_at: data.created_at,
        expires_at: data.expires_at,
        company_name: company?.name || 'Unknown Company',
      }
      setPendingInvites([newInvite, ...pendingInvites])
      closeInviteModal()

      // Audit log
      const companyName = companies.find(c => c.id === inviteForm.implant_company_id)?.name || 'Unknown'
      await deviceRepAudit.invited(
        supabase,
        inviteForm.email,
        companyName,
        facilityId,
        facilityName
      )

      // Show invite link modal
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
      setRevokeConfirm(null)

      // Audit log
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
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const activeReps = reps.filter(r => r.status === 'accepted')
  const pendingReps = reps.filter(r => r.status === 'pending')

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Device Rep Access"
          description="Manage implant company representative access to your cases"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Reps */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">Active Device Reps</h3>
                    <p className="text-sm text-slate-500">
                      {activeReps.length} rep{activeReps.length !== 1 ? 's' : ''} with access
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

                {activeReps.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-slate-500 mb-2">No device reps with access</p>
                    <p className="text-sm text-slate-400">
                      Invite reps to let them view cases using their company's implants
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activeReps.map((rep) => (
                      <div key={rep.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600">
                              {rep.user_first_name?.charAt(0)}{rep.user_last_name?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {rep.user_first_name} {rep.user_last_name}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-sm text-slate-500">{rep.user_email}</span>
                              {rep.user_phone && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-sm text-slate-500">{rep.user_phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                            {rep.company_name}
                          </span>
                          {revokeConfirm === rep.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRevokeAccess(rep)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setRevokeConfirm(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRevokeConfirm(rep.id)}
                              className="text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invites */}
              {(pendingInvites.length > 0 || pendingReps.length > 0) && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-amber-50">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="font-medium text-amber-900">Pending Invites</h3>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{invite.email}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-sm text-slate-500">
                              {invite.company_name}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-400">
                              Invited {formatDate(invite.created_at)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-amber-600">
                              Expires {formatDate(invite.expires_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="text-sm text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      Email Address
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
                      Implant Company
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

          {/* Invite Link Modal */}
          {inviteLinkModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Invite Created!</h3>
                      <p className="text-sm text-slate-500">Send this link to the device rep</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-3">
                    Share this link with <span className="font-medium">{inviteLinkModal.email}</span>:
                  </p>
                  <div className="bg-slate-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-slate-700 break-all font-mono">{inviteLinkModal.link}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLinkModal.link)
                      // Brief feedback
                      const btn = document.getElementById('copy-link-btn')
                      if (btn) {
                        btn.textContent = 'Copied!'
                        setTimeout(() => { btn.textContent = 'Copy Link' }, 2000)
                      }
                    }}
                    id="copy-link-btn"
                    className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Link expires in 7 days
                  </p>
                </div>
                <div className="px-6 py-4 border-t border-slate-200">
                  <button
                    onClick={() => setInviteLinkModal({ isOpen: false, link: '', email: '' })}
                    className="w-full py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
