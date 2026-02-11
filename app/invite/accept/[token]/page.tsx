// Route: /invite/accept/[token]
// Example: /invite/accept/abc123-def456-...
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Building2, Check, X } from 'lucide-react'

// Transformed invite data for display
interface InviteData {
  id: string
  email: string
  facility_id: string
  implant_company_id: string
  expires_at: string
  facility_name: string
  facility_address: string | null
  company_name: string
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [existingUser, setExistingUser] = useState(false)

  useEffect(() => {
    fetchInvite()
  }, [token])

  const fetchInvite = async () => {
    // Fetch invite details
    const { data, error } = await supabase
      .from('device_rep_invites')
      .select(`
        id,
        email,
        facility_id,
        implant_company_id,
        expires_at,
        facilities (name, address),
        implant_companies (name)
      `)
      .eq('invite_token', token)
      .is('accepted_at', null)
      .single()

    if (error || !data) {
      setError('This invite link is invalid or has already been used.')
      setLoading(false)
      return
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      setError('This invite has expired. Please request a new invite from the facility.')
      setLoading(false)
      return
    }

    // Transform data - Supabase returns joined tables as arrays
    const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities
    const company = Array.isArray(data.implant_companies) ? data.implant_companies[0] : data.implant_companies

    setInvite({
      id: data.id,
      email: data.email,
      facility_id: data.facility_id,
      implant_company_id: data.implant_company_id,
      expires_at: data.expires_at,
      facility_name: facility?.name || 'Unknown Facility',
      facility_address: facility?.address || null,
      company_name: company?.name || 'Unknown Company',
    })

    // Check if user already exists
    const { data: existingUserData } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single()

    setExistingUser(!!existingUserData)
    setLoading(false)
  }

  const handleAccept = async () => {
    if (!invite) return

    setAccepting(true)

    // Check if logged in
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Redirect to signup with invite context
      router.push(`/auth/rep-signup?token=${token}&email=${encodeURIComponent(invite.email)}`)
      return
    }

    // User is logged in - verify email matches
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      setError(`You're signed in as ${user.email}, but this invite is for ${invite.email}. Please sign out and try again.`)
      setAccepting(false)
      return
    }

    // Accept the invite - add to facility_device_reps
    const { error: repError } = await supabase
      .from('facility_device_reps')
      .insert({
        facility_id: invite.facility_id,
        user_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })

    if (repError) {
      setError('Failed to accept invite. You may already have access to this facility.')
      setAccepting(false)
      return
    }

    // Mark invite as accepted
    await supabase
      .from('device_rep_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Redirect to download page
    router.push('/invite/success')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Invite Error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">O</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ORbit</h1>
          <p className="text-slate-500 mt-1">Surgical Case Management</p>
        </div>

        {/* Invite Details */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-slate-600 mb-3">You've been invited to access:</p>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{invite?.facility_name}</p>
              {invite?.facility_address && (
                <p className="text-sm text-slate-500">{invite.facility_address}</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {invite?.company_name}
              </span>
              <span className="text-xs text-slate-500">Device Rep</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="text-sm text-slate-600 mb-6">
          <p className="mb-2">As a device rep, you'll be able to:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              View cases using {invite?.company_name} implants
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              See case schedule, surgeon, and OR room
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              Receive notifications for case updates
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {accepting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : existingUser ? (
            'Accept Access'
          ) : (
            'Continue to Sign Up'
          )}
        </button>

        <p className="text-xs text-center text-slate-400 mt-4">
          Invite for {invite?.email}
        </p>
      </div>
    </div>
  )
}
