// app/invite/user/[token]/page.tsx
// 
// Accept invitation page for facility admins and staff
// Calls API route to create user (bypasses Supabase email confirmation)
//
// Flow:
// 1. User clicks link in email → lands here
// 2. Page validates token and shows invite details
// 3. User creates password
// 4. API creates account (with service role key)
// 5. Redirect to login page

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Building2, Check, Circle, Eye, EyeOff, X } from 'lucide-react'

interface InviteData {
  id: string
  email: string
  firstName: string
  lastName: string
  facilityId: string
  facilityName: string
  facilityAddress: string | null
  accessLevel: string
  roleId: string
  roleName: string
  expiresAt: string
}

function AcceptInviteContent() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()
  const { showToast } = useToast()
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Password form
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (token) {
      fetchInvite()
    }
  }, [token])

  const fetchInvite = async () => {
    // Fetch invite details from user_invites table
    const { data, error } = await supabase
      .from('user_invites')
      .select(`
        id,
        email,
        first_name,
        last_name,
        facility_id,
        access_level,
        role_id,
        expires_at,
        facilities (name, address),
        user_roles (name)
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
      setError('This invite has expired. Please contact your administrator for a new invite.')
      setLoading(false)
      return
    }

    // Transform data - Supabase returns joined tables as arrays sometimes
    const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities
    const role = Array.isArray(data.user_roles) ? data.user_roles[0] : data.user_roles

    setInvite({
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      facilityId: data.facility_id,
      facilityName: facility?.name || 'Unknown Facility',
      facilityAddress: facility?.address || null,
      accessLevel: data.access_level,
      roleId: data.role_id,
      roleName: role?.name || 'Staff',
      expiresAt: data.expires_at,
    })

    setLoading(false)
  }

  // Password validation
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }
  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!invite) return

    if (!isPasswordValid) {
      setError('Please meet all password requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    setError(null)

try {
  // Call API to create user
  const response = await fetch('/api/invite/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      password: password,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create account')
  }

  // ✅ Success toast
  showToast({
    type: 'success',
    title: 'Account Created',
    message: 'Redirecting to login...'
  })

  // Success! Redirect to login page with success message
  router.push('/login?registered=true')

} catch (error) {  
  const message = error instanceof Error ? error.message : 'Failed to create account. Please try again.'
  setError(message)
  
  // ✅ ADD: Toast for immediate feedback
  showToast({
    type: 'error',
    title: 'Account Creation Failed',
    message
  })
} finally {
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
          <X className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Invite Error</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  const isAdmin = invite?.accessLevel === 'facility_admin'

  return (
    <>
      {/* Invite Details Card */}
      <div className="bg-slate-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-slate-600 mb-3">You've been invited to join:</p>
        
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{invite?.facilityName}</p>
            {invite?.facilityAddress && (
              <p className="text-sm text-slate-500">{invite.facilityAddress}</p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Your Role</p>
              <p className="font-medium text-slate-900">
                {isAdmin ? 'Facility Administrator' : 'Staff Member'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Position</p>
              <p className="font-medium text-slate-900 capitalize">{invite?.roleName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={invite?.email || ''}
            disabled
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              First Name
            </label>
            <input
              type="text"
              value={invite?.firstName || ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              value={invite?.lastName || ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Create Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-12"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Password Requirements */}
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">Password must have:</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              { met: passwordRequirements.minLength, text: '8+ characters' },
              { met: passwordRequirements.hasUppercase, text: 'Uppercase letter' },
              { met: passwordRequirements.hasLowercase, text: 'Lowercase letter' },
              { met: passwordRequirements.hasNumber, text: 'Number' },
            ].map((req, i) => (
              <div key={i} className={`flex items-center gap-1 text-xs ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                {req.met ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                {req.text}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
              confirmPassword.length > 0
                ? passwordsMatch
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-red-300 bg-red-50/50'
                : 'border-slate-200'
            }`}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
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
          disabled={submitting || !isPasswordValid || !passwordsMatch}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

export default function AcceptUserInvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">O</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to ORbit</h1>
          <p className="text-slate-500 mt-1">Create your account to get started</p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  )
}