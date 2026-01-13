// app/invite/[token]/page.tsx
// Accept Invitation Page - Users set their password after being invited

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase'
import { checkPasswordStrength } from '../../../lib/passwords'
import { quickAuditLog } from '../../../lib/audit'

interface InvitationData {
  id: string
  email: string
  first_name: string
  last_name: string
  facility_id: string
  facility_name: string
  invited_by_name: string
  expires_at: string
}

export default function AcceptInvitationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'invalid' | 'expired' | 'used'>('valid')

  // Password form
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Password strength
  const passwordStrength = checkPasswordStrength(password)

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      setLoading(true)

      try {
        // Find user with this invitation token
        const { data: user, error: userError } = await supabase
          .from('users')
          .select(`
            id,
            email,
            first_name,
            last_name,
            facility_id,
            invitation_token,
            invitation_expires_at,
            invited_by,
            facilities(name),
            inviter:users!users_invited_by_fkey(first_name, last_name)
          `)
          .eq('invitation_token', token)
          .single()

        if (userError || !user) {
          setTokenStatus('invalid')
          setLoading(false)
          return
        }

        // Check if token is expired
        if (user.invitation_expires_at) {
          const expiresAt = new Date(user.invitation_expires_at)
          if (expiresAt < new Date()) {
            setTokenStatus('expired')
            setLoading(false)
            return
          }
        }

        // Check if already used (no invitation token means already accepted)
        if (!user.invitation_token) {
          setTokenStatus('used')
          setLoading(false)
          return
        }

        // Extract facility and inviter names from joined data
        const facilityName = Array.isArray(user.facilities)
          ? user.facilities[0]?.name || 'Unknown Facility'
          : (user.facilities as any)?.name || 'Unknown Facility'

        const inviterFirstName = Array.isArray(user.inviter)
          ? user.inviter[0]?.first_name || ''
          : (user.inviter as any)?.first_name || ''
        const inviterLastName = Array.isArray(user.inviter)
          ? user.inviter[0]?.last_name || ''
          : (user.inviter as any)?.last_name || ''
        const invitedByName = `${inviterFirstName} ${inviterLastName}`.trim() || 'Your administrator'

        setInvitation({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          facility_id: user.facility_id,
          facility_name: facilityName,
          invited_by_name: invitedByName,
          expires_at: user.invitation_expires_at,
        })

        setTokenStatus('valid')
      } catch (err) {
        console.error('Error validating invitation:', err)
        setTokenStatus('invalid')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      validateToken()
    }
  }, [token, supabase])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!invitation) return

    // Validate passwords
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (passwordStrength.level === 'weak') {
      setError('Please choose a stronger password')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Create auth account with password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
          },
        },
      })

      if (authError) {
        // If user already exists, try to sign in instead
        if (authError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: password,
          })

          if (signInError) {
            throw new Error('Failed to sign in: ' + signInError.message)
          }
        } else {
          throw new Error('Failed to create account: ' + authError.message)
        }
      }

      // Update user record - clear invitation token and set password flag
      const { error: updateError } = await supabase
        .from('users')
        .update({
          invitation_token: null,
          invitation_expires_at: null,
          must_change_password: false,
        })
        .eq('id', invitation.id)

      if (updateError) {
        console.error('Error updating user record:', updateError)
      }

      // Log the action
      await quickAuditLog(
        supabase,
        invitation.id,
        invitation.email,
        'user.invitation_accepted',
        {
          facilityId: invitation.facility_id,
          targetType: 'user',
          targetId: invitation.id,
        }
      )

      // Sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password,
      })

      if (signInError) {
        // Still redirect to login even if auto-login fails
        router.push('/login?message=Account+created.+Please+sign+in.')
        return
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Validating invitation...</p>
        </div>
      </div>
    )
  }

  // Invalid token
  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Invitation</h1>
          <p className="text-slate-600 mb-6">
            This invitation link is invalid or has already been used.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Expired token
  if (tokenStatus === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation Expired</h1>
          <p className="text-slate-600 mb-6">
            This invitation has expired. Please contact your administrator to request a new invitation.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Already used
  if (tokenStatus === 'used') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Already Accepted</h1>
          <p className="text-slate-600 mb-6">
            This invitation has already been accepted. You can sign in with your account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Valid invitation - show form
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Welcome to ORbit</h1>
          <p className="text-slate-600 mt-1">Set up your account to get started</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Welcome Message */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>{invitation?.invited_by_name}</strong> has invited you to join{' '}
              <strong>{invitation?.facility_name}</strong> on ORbit.
            </p>
          </div>

          {/* User Info */}
          <div className="mb-6">
            <p className="text-sm text-slate-500">Your account</p>
            <p className="font-medium text-slate-900">{invitation?.first_name} {invitation?.last_name}</p>
            <p className="text-sm text-slate-600">{invitation?.email}</p>
          </div>

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Create Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${
                          passwordStrength.score >= level * 25
                            ? passwordStrength.level === 'weak'
                              ? 'bg-red-500'
                              : passwordStrength.level === 'fair'
                              ? 'bg-amber-500'
                              : passwordStrength.level === 'good'
                              ? 'bg-blue-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level === 'weak' ? 'text-red-600' :
                    passwordStrength.level === 'fair' ? 'text-amber-600' :
                    passwordStrength.level === 'good' ? 'text-blue-600' :
                    'text-emerald-600'
                  }`}>
                    {passwordStrength.level.charAt(0).toUpperCase() + passwordStrength.level.slice(1)} password
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                }`}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || password.length < 8 || password !== confirmPassword}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Setting up...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
