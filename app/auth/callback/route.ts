import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('auth/callback')

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  
  // Get parameters
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  const supabase = await createClient()

  // Handle token_hash flow (from email links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (error) {
      log.error('OTP verification failed', error, { type: type ?? undefined })
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    // Redirect to set-password for invite or recovery
    if (type === 'invite' || type === 'recovery' || type === 'magiclink') {
      return NextResponse.redirect(new URL('/auth/set-password', requestUrl.origin))
    }

    // Default: redirect to dashboard
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // Handle code flow (OAuth or PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      log.error('Code exchange failed', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    // Check if this is an invite/recovery based on type param
    if (type === 'invite' || type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/set-password', requestUrl.origin))
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // No token_hash or code - redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
