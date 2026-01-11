import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check env vars first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing env vars:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!serviceRoleKey 
      })
      return NextResponse.json(
        { error: 'Server configuration error - missing environment variables' },
        { status: 500 }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { email } = await request.json()

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('Resending invite to:', email)

    // Check if user exists in auth
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      return NextResponse.json(
        { error: `Failed to check user status: ${listError.message}` },
        { status: 500 }
      )
    }

    const authUser = authUsers.users.find(u => u.email === email)

    if (!authUser) {
      return NextResponse.json(
        { error: 'User not found in authentication system' },
        { status: 404 }
      )
    }

    console.log('Found user:', { 
      id: authUser.id, 
      email: authUser.email,
      confirmed: !!authUser.email_confirmed_at 
    })

    // Check if user is already confirmed
    if (authUser.email_confirmed_at) {
      return NextResponse.json(
        { error: 'User has already set up their account' },
        { status: 400 }
      )
    }

    // Resend the invite
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=invite`
    console.log('Redirect URL:', redirectTo)

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })

    if (inviteError) {
      console.error('Error resending invite:', inviteError)
      return NextResponse.json(
        { error: `Failed to send invite: ${inviteError.message}` },
        { status: 500 }
      )
    }

    console.log('Invite sent successfully:', inviteData)

    return NextResponse.json({ 
      success: true,
      message: 'Invite resent successfully' 
    })

  } catch (error) {
    console.error('Resend invite error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
