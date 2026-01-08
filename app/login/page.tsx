'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
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
        
        {/* Accent glow - Updated to blue */}
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-12">
            <LogoFullDark />
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-semibold text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-500">Enter your credentials to access your facility dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                placeholder="you@hospital.org"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                placeholder="••••••••••••"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100">
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
        </div>
      </div>
    </div>
  )
}
