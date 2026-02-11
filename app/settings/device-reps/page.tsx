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
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Ban, Check, CheckCircle2, Mail, Plus, Users, X } from 'lucide-react'

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
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userErr) throw userErr
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
      const { data: repsData, error: repsErr } = await supabase
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

      if (repsErr) throw repsErr

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
    } catch (err) {
      setError('Failed to load device reps. Please try again.')
    } finally {
      setLoading(false)
    }
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

    try {
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

      if (error) throw error

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
          showToast({ type: 'error', title: 'Failed to send invite email', message: 'The invite was created but the email could not be sent' })
        }
      } catch (emailError) {
        showToast({ type: 'error', title: 'Failed to send invite email', message: emailError instanceof Error ? emailError.message : 'The invite was created but the email could not be sent' })
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
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to create invite', message: err instanceof Error ? err.message : 'Please try again' })
    } finally {
      setSending(false)
    }
  }

  const handleRevokeAccess = async (rep: DeviceRep) => {
    if (!facilityId) return

    try {
      const { error } = await supabase
        .from('facility_device_reps')
        .update({ status: 'revoked' })
        .eq('id', rep.id)

      if (error) throw error

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
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to revoke access', message: err instanceof Error ? err.message : 'Please try again' })
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('device_rep_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId))
      setActionConfirm(null)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to cancel invite', message: err instanceof Error ? err.message : 'Please try again' })
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
            <PageLoader message="Loading device reps..." />
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
                  <Button onClick={openInviteModal}>
                    <Plus className="w-4 h-4" />
                    Invite Rep
                  </Button>
                </div>

                {/* Table */}
                {allRows.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-slate-400" />
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
                                      <Mail className="w-4 h-4" />
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
                                  <CheckCircle2 className="w-3 h-3" />
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
                                    <Ban className="w-4 h-4" />
                                  ) : (
                                    <X className="w-4 h-4" />
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
          <Modal open={inviteModal.isOpen} onClose={closeInviteModal} title="Invite Device Rep" subtitle="They'll receive an email to create their account">
            <div className="space-y-4">
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
            <Modal.Footer>
              <Modal.Cancel onClick={closeInviteModal} />
              <Modal.Action onClick={handleSendInvite} loading={sending} disabled={!inviteForm.email.trim() || !inviteForm.implant_company_id}>
                Send Invite
              </Modal.Action>
            </Modal.Footer>
          </Modal>

          {/* Success Modal */}
<Modal open={inviteLinkModal.isOpen} onClose={() => setInviteLinkModal({ isOpen: false, link: '', email: '' })} title="Invite Sent!" size="sm">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
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
            <Modal.Footer>
              <Modal.Action onClick={() => setInviteLinkModal({ isOpen: false, link: '', email: '' })}>
                Done
              </Modal.Action>
            </Modal.Footer>
          </Modal>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}