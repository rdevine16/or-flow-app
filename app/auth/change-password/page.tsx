// app/auth/change-password/page.tsx
// Forced password change page for new users

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { checkPasswordStrength } from '../../../lib/passwords'
import { authAudit } from '../../../lib/audit-logger'

export default function ChangePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [mustChange, setMustChange] = useState(false)

  const passwordStrength = checkPasswordStrength(newPassword)

  // Check if user needs to change password
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUserEmail(user.email || null)

      // Get user record to check must_change_password
      const { data: userData } = await supabase
        .from('users')
        .select('first_name, last_name, must_change_password')
        .eq('id', user.id)
        .single()

      if (userData) {
        setUserName(`${userData.first_name} ${userData.last_name}`.trim())
        setMustChange(userData.must_change_password || false)
      }

      setLoading(false)
    }

    checkUser()
  }, [supabase, router])

  // Handle password change
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (passwordStrength.level === 'weak') {
      setError('Please choose a stronger password')
      return
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password')
      return
    }

    setSubmitting(true)

    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail || '',
        password: currentPassword,
      })

      if (signInError) {
        setError('Current password is incorrect')
        setSubmitting(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Clear must_change_password flag
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id)

        // Log the action
        await authAudit.passwordChanged(supabase)
      }

      setSuccess(true)

      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      console.error('Error changing password:', err)
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle skip (only if not forced)
  const handleSkip = () => {
    if (!mustChange) {
      router.push('/dashboard')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Password Changed!</h1>
          <p className="text-slate-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold text-slate-900 mt-4">
            {mustChange ? 'Change Your Password' : 'Update Password'}
          </h1>
          <p className="text-slate-600 mt-1">
            {mustChange 
              ? 'Please set a new password to continue'
              : 'Enter your current password and choose a new one'
            }
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* User Info */}
          {userName && (
            <div className="mb-6 pb-6 border-b border-slate-100">
              <p className="text-sm text-slate-500">Signed in as</p>
              <p className="font-medium text-slate-900">{userName}</p>
              <p className="text-sm text-slate-600">{userEmail}</p>
            </div>
          )}

          {/* Required Notice */}
          {mustChange && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-800">
                  You must change your password before continuing. This is required for security.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
                minLength={8}
              />

              {/* Password Strength */}
              {newPassword && (
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                  confirmPassword && newPassword !== confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                }`}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Show Passwords Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <span className="text-sm text-slate-600">Show passwords</span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>

            {/* Skip Button (only if not required) */}
            {!mustChange && (
              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-2.5 text-slate-600 hover:text-slate-800 font-medium"
              >
                Skip for now
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
