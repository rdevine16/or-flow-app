'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { updateLastLogin, checkUserActive } from '../../lib/auth-helpers'

// ORbit Logo - Full with text
const LogoFull = () => (
  <svg width="160" height="48" viewBox="0 0 280 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Icon part */}
    <circle cx="38" cy="38" r="14" stroke="#3b82f6" strokeWidth="4" fill="none"/>
    <ellipse cx="38" cy="38" rx="26" ry="10" stroke="#60a5fa" strokeWidth="2.5" fill="none" transform="rotate(-25 38 38)"/>
    <circle cx="58" cy="24" r="6" fill="#10b981"/>
    {/* Text: "OR" in blue */}
    <text x="85" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="700" fill="#3b82f6">OR</text>
    {/* Text: "bit" in white */}
    <text x="138" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="600" fill="#ffffff">bit</text>
  </svg>
)

// ORbit Logo - For light backgrounds (mobile)
const LogoFullDark = () => (
  <svg width="140" height="42" viewBox="0 0 280 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Icon part */}
    <circle cx="38" cy="38" r="14" stroke="#3b82f6" strokeWidth="4" fill="none"/>
    <ellipse cx="38" cy="38" rx="26" ry="10" stroke="#60a5fa" strokeWidth="2.5" fill="none" transform="rotate(-25 38 38)"/>
    <circle cx="58" cy="24" r="6" fill="#10b981"/>
    {/* Text: "OR" in blue */}
    <text x="85" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="700" fill="#3b82f6">OR</text>
    {/* Text: "bit" in slate */}
    <text x="138" y="50" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="600" fill="#64748b">bit</text>
  </svg>
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Provide friendlier error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        // Check if user is active (not deactivated)
        const { isActive, error: activeError } = await checkUserActive(supabase, data.user.id)
        
        if (!isActive) {
          // Sign them out immediately if deactivated
          await supabase.auth.signOut()
          setError(activeError || 'Your account has been deactivated. Please contact your administrator.')
          setLoading(false)
          return
        }

        // Update last login timestamp
        await updateLastLogin(supabase, data.user.id)

        // Check access level to determine redirect
        const { data: userRecord } = await supabase
          .from('users')
          .select('access_level')
          .eq('id', data.user.id)
          .single()

        // Redirect based on role
        if (userRecord?.access_level === 'global_admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address.')
      return
    }

    setResetLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setResetEmailSent(true)
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setShowForgotPassword(false)
    setResetEmailSent(false)
    setError(null)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        
        {/* Accent glow */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <LogoFull />
          </div>
          
          <div className="space-y-6">
            <h1 className="text-4xl font-light text-white leading-tight">
              Surgical efficiency,<br />
              <span className="text-blue-400 font-medium">measured and improved.</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md leading-relaxed">
              Track every milestone. Identify bottlenecks. Optimize your operating room workflow with precision timing.
            </p>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Efficiency analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span>HIPAA compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-slate-50">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center mb-12">
              <LogoFullDark />
            </div>

            {/* Forgot Password Flow */}
            {showForgotPassword ? (
              <div>
                <button
                  onClick={handleBackToLogin}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to sign in
                </button>

                {resetEmailSent ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-2">Check your email</h2>
                    <p className="text-slate-500 mb-6">
                      We've sent password reset instructions to<br />
                      <span className="font-medium text-slate-700">{email}</span>
                    </p>
                    <p className="text-sm text-slate-400">
                      Didn't receive it? Check your spam folder or{' '}
                      <button 
                        onClick={() => setResetEmailSent(false)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        try again
                      </button>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h2 className="text-2xl font-semibold text-slate-900 mb-2">Reset your password</h2>
                      <p className="text-slate-500">Enter your email and we'll send you instructions to reset your password.</p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-6">
                      <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-2">
                          Email address
                        </label>
                        <input
                          id="reset-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                          placeholder="you@hospital.org"
                        />
                      </div>

                      {error && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                      >
                        {resetLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Sending...
                          </span>
                        ) : (
                          'Send reset instructions'
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            ) : (
              /* Login Form */
              <>
                <div className="mb-10">
                  <h2 className="text-3xl font-semibold text-slate-900 mb-2">Welcome back</h2>
                  <p className="text-slate-500">Enter your credentials to access your facility dashboard.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                      placeholder="you@hospital.org"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
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
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                      />
                      <span className="text-sm text-slate-600">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true)
                        setError(null)
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Need access? Contact your facility administrator.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center text-xs text-slate-400 border-t border-slate-200">
          <div className="flex items-center justify-center gap-4">
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</a>
            <span>·</span>
            <a href="mailto:support@orbitsurgical.com" className="hover:text-slate-600 transition-colors">Support</a>
          </div>
          <p className="mt-2">© {new Date().getFullYear()} ORbit Surgical. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
