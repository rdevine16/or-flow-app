import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client inline to avoid import issues
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
}

export async function POST(request: NextRequest) {
  try {
    const body: InviteRequest = await request.json()
    const { email, firstName, lastName, accessLevel, facilityId, roleId } = body

    // Validation
    if (!email || !firstName || !lastName || !accessLevel || !facilityId || !roleId) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Create auth user and send invite email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      }
    )

    if (authError || !authData.user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { success: false, error: authError?.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    // Create public.users record
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        access_level: accessLevel,
        facility_id: facilityId,
        role_id: roleId,
      })

    if (dbError) {
      // Rollback: delete auth user if db insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.error('Database error:', dbError)
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      userId: authData.user.id,
    })

  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send invite' },
      { status: 500 }
    )
  }
}