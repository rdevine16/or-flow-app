import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  
  // Get parameters
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  console.log('Auth callback:', { 
    hasTokenHash: !!token_hash, 
    hasCode: !!code, 
    type, 
    next 
  })

  const supabase = await createClient()

  // Handle token_hash flow (from email links)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (error) {
      console.error('Error verifying OTP:', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    console.log('OTP verified for:', data.user?.email)

    // Redirect to set-password for invite or recovery
    if (type === 'invite' || type === 'recovery' || type === 'magiclink') {
      return NextResponse.redirect(new URL('/auth/set-password', requestUrl.origin))
    }

    // Default: redirect to dashboard
    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // Handle code flow (OAuth or PKCE)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    console.log('Session created for:', data.user?.email)

    // Check if this is an invite/recovery based on type param
    if (type === 'invite' || type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/set-password', requestUrl.origin))
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  // No token_hash or code - redirect to login
  console.log('No token_hash or code provided')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
