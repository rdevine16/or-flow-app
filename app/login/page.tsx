//app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { updateLastLogin, checkUserActive } from '@/lib/auth-helpers'
import { authAudit } from '@/lib/audit-logger'
import Image from 'next/image'

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
  const [mounted, setMounted] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // Handle mount for animations
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus email input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('email')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

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
        // Log failed login attempt
        await authAudit.login(supabase, email, false, signInError.message)
        
        // Provide friendlier error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.')
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
          // Log deactivated user login attempt
          await authAudit.login(supabase, email, false, 'Account deactivated')
          // Sign them out immediately if deactivated
          await supabase.auth.signOut()
          setError(activeError || 'Your account has been deactivated. Please contact your administrator.')
          setLoading(false)
          return
        }

        // Update last login timestamp
        await updateLastLogin(supabase, data.user.id)

        // Log successful login
        await authAudit.login(supabase, email, true)

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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {/* Subtle geometric accent */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        
        {/* Grid overlay for depth */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }}
        />
        
        {/* Content Container */}
        <div className={`relative z-10 flex flex-col items-center justify-center w-full px-16 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Logo */}
          <div className="mb-12">
            <Image 
              src="/images/logo_white.png" 
              alt="ORbit Surgical" 
              width={500} 
              height={150}
              priority
              className="h-32 w-auto mx-auto drop-shadow-2xl"
            />
          </div>
          
          {/* Tagline */}
          <div className="text-center max-w-md">
            <p className="text-xl text-slate-300 font-light leading-relaxed">
              Modern OR Analytics & Case Management
            </p>
          </div>
          
          {/* Subtle divider */}
          <div className="mt-12 flex items-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-600" />
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>HIPAA Compliant</span>
            </div>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Mobile Logo */}
        <div className="lg:hidden p-6 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-center">
            <Image 
              src="/images/logo_white.png" 
              alt="ORbit Surgical" 
              width={180} 
              height={54}
              priority
              className="h-12 w-auto"
              style={{ filter: 'invert(1) brightness(0)' }}
            />
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {showForgotPassword ? (
              /* Password Reset Flow */
              <div>
                {resetEmailSent ? (
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-3">Check your email</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                      We&apos;ve sent password reset instructions to <strong>{email}</strong>
                    </p>
                    <button
                      onClick={handleBackToLogin}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors inline-flex items-center gap-2 group"
                    >
                      <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to login
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <button
                        onClick={handleBackToLogin}
                        className="text-slate-600 hover:text-slate-900 font-medium transition-colors inline-flex items-center gap-2 group mb-6"
                      >
                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to login
                      </button>
                      <h2 className="text-3xl font-semibold text-slate-900 mb-2">Reset your password</h2>
                      <p className="text-slate-500">Enter your email address and we&apos;ll send you instructions to reset your password.</p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-5">
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
                          autoFocus
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                          placeholder="you@hospital.org"
                          aria-describedby={error ? "reset-error" : undefined}
                        />
                      </div>

                      {error && (
                        <div id="reset-error" role="alert" className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transform hover:scale-[1.02] active:scale-[0.98]"
                        aria-label={resetLoading ? "Sending reset instructions" : "Send reset instructions"}
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
                  <h2 className="text-3xl font-semibold text-slate-900 mb-3">Welcome back</h2>
                  <p className="text-slate-500 leading-relaxed">Sign in to access your facility dashboard and analytics.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        placeholder="you@hospital.org"
                        aria-describedby={error ? "login-error" : undefined}
                      />
                      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-block px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded">
                        ⌘K
                      </kbd>
                    </div>
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
                        aria-describedby={error ? "login-error" : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
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
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-colors cursor-pointer"
                        aria-label="Remember me for 30 days"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true)
                        setError(null)
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div id="login-error" role="alert" className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transform hover:scale-[1.02] active:scale-[0.98]"
                    aria-label={loading ? "Signing in" : "Sign in to your account"}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Signing in...</span>
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Need access? <a href="mailto:support@orbitsurgical.com" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Contact your facility administrator</a>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center border-t border-slate-100 bg-slate-50">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-3">
            <a href="/privacy" className="text-xs text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1">
              Privacy Policy
            </a>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <a href="/terms" className="text-xs text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1">
              Terms of Service
            </a>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <a href="mailto:support@orbitsurgical.com" className="text-xs text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded px-1">
              Support
            </a>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} ORbit Surgical. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}