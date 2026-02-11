// app/api/invite/accept/route.ts
//
// API route to accept an invite and create a user account
// Uses service role key to bypass email confirmation
//
// This is called from the /invite/user/[token] page when user submits password

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env, serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('api/invite-accept')

// Admin client with service role key - can bypass email confirmation
const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

interface AcceptInviteRequest {
  token: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AcceptInviteRequest = await request.json()
    const { token, password } = body

    // Validation
    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // 1. Fetch the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .select(`
        id,
        email,
        first_name,
        last_name,
        facility_id,
        access_level,
        role_id,
        expires_at,
        accepted_at
      `)
      .eq('invite_token', token)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite token' },
        { status: 400 }
      )
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { success: false, error: 'This invite has already been used' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This invite has expired' },
        { status: 400 }
      )
    }

    // 2. Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === invite.email)

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 }
      )
    }

    // 3. Create auth user with admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Mark email as confirmed immediately
      user_metadata: {
        first_name: invite.first_name,
        last_name: invite.last_name,
      },
    })

    if (authError) {
log.error('Auth error:', authError)

      return NextResponse.json(
        { success: false, error: 'Failed to create account: ' + authError.message },
        { status: 500 }
      )
    }

if (!authData.user) {
  return NextResponse.json(
    { 
      error: 'Authentication failed - no user created',
      success: false 
    },
    { status: 500 }
  )
}

    // 4. Create user profile in public.users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: invite.email,
        first_name: invite.first_name,
        last_name: invite.last_name,
        facility_id: invite.facility_id,
        role_id: invite.role_id,
        access_level: invite.access_level,
      })

    if (profileError) {
      log.error('Profile creation error:', profileError)
      // Don't fail completely - auth user exists
      // They might need admin help but can still try to sign in
    }

    // 5. Mark invite as accepted
    await supabaseAdmin
      .from('user_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: authData.user.id,
    })

  } catch (error) {
    log.error('Accept invite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to accept invite' },
      { status: 500 }
    )
  }
}