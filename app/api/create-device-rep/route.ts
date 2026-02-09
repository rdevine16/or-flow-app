// ============================================
// FILE: app/api/create-device-rep/route.ts
// PURPOSE: Create device rep account with auto-confirmed email
// ============================================

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { error } from 'console'
const { showToast } = useToast()
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName, phone, inviteId, facilityId, implantCompanyId } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !inviteId || !facilityId || !implantCompanyId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create admin client with service role (can bypass email confirmation)
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

    // 1. Create auth user with email auto-confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (authError) {
      showToast({
  type: 'error',
  title: 'Auth error:',
  message: authError instanceof Error ? authError.message : 'Auth error:'
})
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // 2. Create user profile using the database function
    const { error: profileError } = await supabaseAdmin.rpc('create_device_rep_profile', {
      user_id: authData.user.id,
      user_email: email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phone || null,
    })

    if (profileError) {
      showToast({
  type: 'error',
  title: 'Profile error:',
  message: error instanceof Error ? error.message : 'Profile error:'
})
      // Try to clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 500 }
      )
    }

    // 3. Grant access to the facility
    const { error: accessError } = await supabaseAdmin
      .from('facility_device_reps')
      .insert({
        facility_id: facilityId,
        user_id: authData.user.id,
        implant_company_id: implantCompanyId,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })

    if (accessError) {
      showToast({
  type: 'error',
  title: 'Access error:',
  message: error instanceof Error ? error.message : 'Access error:'
})
      // Continue anyway - user can still log in
    }

    // 4. Mark invite as accepted
    await supabaseAdmin
      .from('device_rep_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inviteId)

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
    })

  } catch (error: any) {
    showToast({
  type: 'error',
  title: 'Unexpected error:',
  message: error instanceof Error ? error.message : 'Unexpected error:'
})
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
