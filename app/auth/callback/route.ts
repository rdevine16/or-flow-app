import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  console.log('Auth callback:', { code: !!code, type, next })

  if (code) {
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/login?error=auth_error', requestUrl.origin))
    }

    console.log('Session created for:', data.user?.email)

    // If this is an invite or recovery, redirect to set password page
    if (type === 'invite' || type === 'recovery' || type === 'signup') {
      console.log('Redirecting to set-password page')
      return NextResponse.redirect(new URL('/auth/set-password', requestUrl.origin))
    }
  }

  // Default redirect to dashboard or specified next URL
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
