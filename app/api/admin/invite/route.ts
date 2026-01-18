// app/api/admin/invite/route.ts
// 
// REPLACEMENT: Uses custom tokens + Resend emails via lib/email.ts
// NO MORE Supabase inviteUserByEmail() - that sends generic emails
//
// This creates an invite record in user_invites table and sends
// a professional email via Resend with a link to /invite/user/[token]
//
// UPDATED: Now handles inviting existing staff members who have email
// but no auth account yet (staff-only records that got email added)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendUserInviteEmail } from '@/lib/email'
import crypto from 'crypto'

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

interface InviteRequest {
  email: string
  firstName: string
  lastName: string
  accessLevel: 'facility_admin' | 'user'
  facilityId: string
  roleId: string  // The user_roles id (surgeon, nurse, etc.)
  existingUserId?: string  // If inviting an existing staff member
}

export async function POST(request: NextRequest) {
  try {
    const body: InviteRequest = await request.json()
    const { email, firstName, lastName, accessLevel, facilityId, roleId, existingUserId } = body

    // Validation
    if (!email || !firstName || !lastName || !accessLevel || !facilityId || !roleId) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if user already exists in public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    // If user exists and we're NOT explicitly inviting them (existingUserId), that's an error
    // If user exists and we ARE explicitly inviting them, that's fine (they're a staff-only record getting upgraded)
    if (existingUser && !existingUserId) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // If existingUserId provided, verify it matches the found user
    if (existingUserId && existingUser && existingUser.id !== existingUserId) {
      return NextResponse.json(
        { success: false, error: 'Email is already associated with a different user' },
        { status: 400 }
      )
    }

    // Check if this email already has an auth account
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingAuthUser = authData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail)
    
    if (existingAuthUser) {
      return NextResponse.json(
        { success: false, error: 'This email already has an account. They can log in directly.' },
        { status: 400 }
      )
    }

    // Check if there's already a pending invite for this email at this facility
    const { data: existingInvite } = await supabaseAdmin
      .from('user_invites')
      .select('id, expires_at')
      .eq('email', normalizedEmail)
      .eq('facility_id', facilityId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'An invite is already pending for this email' },
        { status: 400 }
      )
    }

    // Get facility name for the email
    const { data: facility } = await supabaseAdmin
      .from('facilities')
      .select('name')
      .eq('id', facilityId)
      .single()

    const facilityName = facility?.name || 'your facility'

    // Get the inviting user's name (from auth header)
    let invitedByName = 'Your administrator'
    let invitedById: string | null = null
    
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        invitedById = user.id
        const { data: inviter } = await supabaseAdmin
          .from('users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()
        if (inviter) {
          invitedByName = `${inviter.first_name} ${inviter.last_name}`
        }
      }
    }

    // Generate invite token (like device rep flow)
    const inviteToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

    // Create invite record in user_invites table
    // Include existing_user_id if this is an upgrade for an existing staff member
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .insert({
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        facility_id: facilityId,
        role_id: roleId,
        access_level: accessLevel,
        invite_token: inviteToken,
        expires_at: expiresAt,
        invited_by: invitedById,
        existing_user_id: existingUserId || null,  // Track if upgrading existing staff
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Failed to create invite:', inviteError)
      return NextResponse.json(
        { success: false, error: 'Failed to create invite record' },
        { status: 500 }
      )
    }

    // Send invite email via Resend (using lib/email.ts)
    const emailResult = await sendUserInviteEmail(
      normalizedEmail,
      firstName.trim(),
      facilityName,
      invitedByName,
      inviteToken,
      accessLevel
    )

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error)
      // Don't fail the whole request - invite is created, they can resend
      // But do let the caller know
      return NextResponse.json({
        success: true,
        message: `Invite created but email failed to send. You can resend the invite.`,
        inviteId: invite.id,
        emailError: emailResult.error,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      inviteId: invite.id,
    })

  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send invite' },
      { status: 500 }
    )
  }
}