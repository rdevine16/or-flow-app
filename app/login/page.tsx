'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { updateLastLogin, checkUserActive } from '@/lib/auth-helpers'
import { authAudit } from '@/lib/audit-logger'
import Image from 'next/image'
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/rate-limiter'
import { signInWithSession } from '@/lib/session-manager'
import { errorLogger, ErrorCategory } from '@/lib/error-logger'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react'

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
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitUntil, setRateLimitUntil] = useState<Date | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Handle mount for animations
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('email')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Check rate limit countdown
  useEffect(() => {
    if (!rateLimitUntil) return

    const interval = setInterval(() => {
      if (new Date() > rateLimitUntil) {
        setIsRateLimited(false)
        setRateLimitUntil(null)
        setError(null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [rateLimitUntil])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get client IP for rate limiting
      const clientIP = 'web-client' // This would be set by middleware in production
      
      // Check rate limit BEFORE attempting login
      const rateCheck = checkRateLimit(email, clientIP)
      
      if (!rateCheck.allowed) {
        setIsRateLimited(true)
        setRateLimitUntil(rateCheck.blockedUntil || null)
        
        const minutesLeft = rateCheck.blockedUntil 
          ? Math.ceil((rateCheck.blockedUntil.getTime() - Date.now()) / 60000)
          : 15
        
        setError(`Too many failed attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`)
        
        errorLogger.authError('Rate limit triggered', email)
        setLoading(false)
        return
      }

      // Attempt sign in with enhanced session management
      const { data, error: signInError } = await signInWithSession(
        email,
        password,
        rememberMe
      )

      if (signInError) {
        // Record failed attempt for rate limiting
        recordFailedAttempt(email, clientIP)
        
        // Log failed login attempt
        await authAudit.login(supabase, email, false, signInError.message)
        
        // Log error
        errorLogger.authError('Login failed', email, signInError)
        
        // Provide friendlier error messages
        if (signInError.message.includes('Invalid login credentials')) {
          const remaining = rateCheck.remainingAttempts || 0
          if (remaining <= 2 && remaining > 0) {
            setError(`Invalid email or password. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`)
          } else {
            setError('Invalid email or password. Please try again.')
          }
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      if (data?.session?.user) {
        const userId = data.session.user.id
        
        // Check if user is active (not deactivated)
        const { isActive, error: activeError } = await checkUserActive(supabase, userId)
        
        if (!isActive) {
          // Log deactivated user login attempt
          await authAudit.login(supabase, email, false, 'Account deactivated')
          errorLogger.authError('Deactivated account login attempt', email)
          
          // Sign them out immediately if deactivated
          await supabase.auth.signOut()
          setError(activeError || 'Your account has been deactivated. Please contact your administrator.')
          setLoading(false)
          return
        }

        // Clear rate limit on successful login
        clearRateLimit(email)

        // Update last login timestamp
        await updateLastLogin(supabase, userId)

        // Log successful login
        await authAudit.login(supabase, email, true)
        errorLogger.info('User logged in successfully', { userId, email })

        // Check access level to determine redirect
        const { data: userRecord } = await supabase
          .from('users')
          .select('access_level')
          .eq('id', userId)
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
      errorLogger.critical('Unexpected login error', err as Error, { email })
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
        errorLogger.authError('Password reset failed', email, resetError)
        setError(resetError.message)
      } else {
        errorLogger.info('Password reset email sent', { email })
        setResetEmailSent(true)
      }
    } catch (err) {
      errorLogger.error('Password reset error', err as Error, { email })
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

  // Format rate limit countdown
  const getRateLimitMessage = () => {
    if (!rateLimitUntil) return ''
    
    const now = new Date()
    const diff = rateLimitUntil.getTime() - now.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    return `Please wait ${minutes}m ${seconds}s before trying again.`
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="flex w-full lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
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
          <div className="mb-8">
            <Image 
              src="/images/logo_white.png" 
              alt="ORbit Surgical" 
              width={500} 
              height={150}
              priority
              className="h-32 w-auto mx-auto drop-shadow-2xl"
            />
          </div>
          
          {/* Slogan */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-light text-white tracking-wide">
              Your OR. In perfect orbit.
            </h1>
          </div>
          
          {/* Tagline */}
          <div className="text-center max-w-md">
            <p className="text-base text-slate-400 font-light leading-relaxed">
              Modern OR Analytics & Case Management
            </p>
          </div>
          
          {/* Subtle divider */}
          <div className="mt-12 flex items-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-600" />
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Mobile Logo - Hidden now that we show full branding panel */}
        <div className="hidden">
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
                      <Mail className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-3">Check your email</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                      We&apos;ve sent password reset instructions to <strong>{email}</strong>
                    </p>
                    <button
                      onClick={handleBackToLogin}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors inline-flex items-center gap-2 group"
                    >
                      <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
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
                        <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                        Back to login
                      </button>
                      <h2 className="text-3xl font-semibold text-slate-900 mb-2">Reset your password</h2>
                      <p className="text-slate-500">Enter your email address and we&apos;ll send you instructions to reset your password.</p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-4">
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
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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
                            <Loader2 className="animate-spin h-5 w-5" />
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
                <div className="mb-8">
                  <h2 className="text-3xl font-semibold text-slate-900 mb-3">Welcome back</h2>
                  <p className="text-slate-500 leading-relaxed">Sign in to access your facility dashboard and analytics.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4" noValidate>
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
                        disabled={isRateLimited}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={isRateLimited}
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
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
                        disabled={isRateLimited}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-600">{error}</p>
                        {isRateLimited && rateLimitUntil && (
                          <p className="text-xs text-red-600 mt-1">{getRateLimitMessage()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || isRateLimited}
                    className="w-full py-3.5 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transform hover:scale-[1.02] active:scale-[0.98]"
                    aria-label={loading ? "Signing in" : "Sign in to your account"}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin h-5 w-5" />
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