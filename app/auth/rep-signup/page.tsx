// ============================================
// FILE: app/auth/rep-signup/page.tsx
// ROUTE: /auth/rep-signup?token=xxx&email=xxx
// PURPOSE: Device rep account creation form
// FLOW: Step 2 - Rep fills out name/password to create account
// ============================================

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function RepSignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const prefillEmail = searchParams.get('email')
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: prefillEmail || '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (token) {
      fetchInvite()
    } else {
      setError('Invalid signup link. Please use the link from your invitation email.')
      setLoading(false)
    }
  }, [token])

  const fetchInvite = async () => {
    const { data, error } = await supabase
      .from('device_rep_invites')
      .select(`
        id,
        email,
        facility_id,
        implant_company_id,
        expires_at,
        facilities (name),
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

    if (new Date(data.expires_at) < new Date()) {
      setError('This invite has expired. Please request a new invite.')
      setLoading(false)
      return
    }

    setInvite(data)
    setFormData(prev => ({ ...prev, email: data.email }))
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create account')

      // 2. Create user profile with device_rep access level
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          access_level: 'device_rep',
          implant_company_id: invite.implant_company_id,
          facility_id: null, // Device reps don't belong to a facility
        })

      if (profileError) throw profileError

      // 3. Grant access to the facility
      const { error: accessError } = await supabase
        .from('facility_device_reps')
        .insert({
          facility_id: invite.facility_id,
          user_id: authData.user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })

      if (accessError) throw accessError

      // 4. Mark invite as accepted
      await supabase
        .from('device_rep_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)

      // 5. Redirect to success page
      router.push('/invite/success')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to Sign Up</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Context Banner */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800">
          Creating account for <span className="font-medium">{invite?.implant_companies?.name}</span> rep 
          at <span className="font-medium">{invite?.facilities?.name}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              First Name
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Smith"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={formData.email}
            disabled
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">Email is set from your invitation</p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="••••••••"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="••••••••"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-xs text-center text-slate-500 mt-6">
        By creating an account, you agree to ORbit's Terms of Service and Privacy Policy.
      </p>
    </>
  )
}

export default function RepSignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">O</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
          <p className="text-slate-500 mt-1">Join ORbit as a Device Rep</p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <RepSignupForm />
        </Suspense>
      </div>
    </div>
  )
}
