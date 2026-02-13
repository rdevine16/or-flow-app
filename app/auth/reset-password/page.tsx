'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { checkPasswordStrength } from '@/lib/passwords'
import { authAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react'

// ORbit Logo - For light backgrounds
const LogoFullDark = () => (
  <svg width="140" height="42" viewBox="0 0 280 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="38" cy="38" r="14" stroke="#3b82f6" strokeWidth="4" fill="none"/>
    <ellipse cx="38" cy="38" rx="26" ry="10" stroke="#60a5fa" strokeWidth="2.5" fill="none" transform="rotate(-25 38 38)"/>
    <circle cx="58" cy="24" r="6" fill="#10b981"/>
    <text x="85" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="700" fill="#3b82f6">OR</text>
    <text x="138" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="600" fill="#64748b">bit</text>
  </svg>
)

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)
  const { showToast } = useToast()
  const router = useRouter()
  const supabase = createClient()
  
  const passwordStrength = checkPasswordStrength(password)

  // Check if we have a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setValidSession(!!session)
    }
    checkSession()

    // Listen for auth state changes (when user clicks reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
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

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      // Clear must_change_password flag if it was set
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id)
      }

      // Log password change
      await authAudit.passwordChanged(supabase)

      setSuccess(true)

      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      setError(message)
      showToast({
        type: 'error',
        title: 'Password Reset Failed',
        message
      })
    } finally {
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (validSession === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Invalid or expired link
  if (validSession === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <LogoFullDark />
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid or Expired Link</h2>
            <p className="text-slate-500 mb-6">
              This password reset link is no longer valid. Please request a new one.
            </p>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              Back to Sign In
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <LogoFullDark />
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Password Reset!</h2>
            <p className="text-slate-500">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <LogoFullDark />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Create new password</h2>
            <p className="text-slate-500">Enter a new password for your account.</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Password Strength */}
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
                              : 'bg-green-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level === 'weak' ? 'text-red-600' :
                    passwordStrength.level === 'fair' ? 'text-amber-600' :
                    passwordStrength.level === 'good' ? 'text-blue-600' :
                    'text-green-600'
                  }`}>
                    {passwordStrength.level.charAt(0).toUpperCase() + passwordStrength.level.slice(1)} password
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={`w-full px-4 py-3 rounded-xl border bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                }`}
                placeholder="••••••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirmPassword}
              className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5" />
                  Resetting password...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remember your password?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
