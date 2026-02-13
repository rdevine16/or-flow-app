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
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { X } from 'lucide-react'

function RepSignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const prefillEmail = searchParams.get('email')
  const supabase = createClient()
  const { showToast } = useToast()
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
      const message = 'Invalid signup link. Please use the link from your invitation email.'
      setError(message)
      setLoading(false)
      showToast({
        type: 'error',
        title: 'Invalid Link',
        message
      })
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
      const message = 'This invite link is invalid or has already been used.'
      setError(message)
      setLoading(false)
      showToast({
        type: 'error',
        title: 'Invalid Invite',
        message
      })
      return
    }

    if (new Date(data.expires_at) < new Date()) {
      const message = 'This invite has expired. Please request a new invite.'
      setError(message)
      setLoading(false)
      showToast({
        type: 'error',
        title: 'Invite Expired',
        message
      })
      return
    }

    // Extract names from joined data (Supabase can return as array or object)
    const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities
    const company = Array.isArray(data.implant_companies) ? data.implant_companies[0] : data.implant_companies

    setInvite({
      ...data,
      facility_name: facility?.name || 'Unknown Facility',
      company_name: company?.name || 'Unknown Company',
    })
    setFormData(prev => ({ ...prev, email: data.email }))
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      const message = 'Passwords do not match'
      setError(message)
      showToast({
        type: 'error',
        title: 'Validation Error',
        message
      })
      return
    }

    if (formData.password.length < 8) {
      const message = 'Password must be at least 8 characters'
      setError(message)
      showToast({
        type: 'error',
        title: 'Validation Error',
        message
      })
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Call API to create device rep with auto-confirmed email
      const response = await fetch('/api/create-device-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          inviteId: invite.id,
          facilityId: invite.facility_id,
          implantCompanyId: invite.implant_company_id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account')
      }

      // Success toast
      showToast({
        type: 'success',
        title: 'Account Created',
        message: 'Redirecting...'
      })

      // Redirect to success page
      router.push('/invite/success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account'
      setError(message)
      setSubmitting(false)
      showToast({
        type: 'error',
        title: 'Account Creation Failed',
        message
      })
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
          <X className="w-8 h-8 text-red-600" />
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
          Creating account for <span className="font-medium">{invite?.company_name}</span> rep 
          at <span className="font-medium">{invite?.facility_name}</span>
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
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <span className="text-2xl font-bold text-white">O</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Create Your Account</h1>
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