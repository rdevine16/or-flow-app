// app/api/create-device-rep/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ValidationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validationSchemas'
import { nowUTC } from '@/lib/dateFactory'

// Validation schema
const createDeviceRepSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  phone: z.string().optional(),
  inviteId: z.string().uuid('Invalid invite ID'),
  facilityId: z.string().uuid('Invalid facility ID'),
  implantCompanyId: z.string().uuid('Invalid company ID'),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Validate input
  const body = await request.json()
  const validated = validate(createDeviceRepSchema, body)

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

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: validated.email,
    password: validated.password,
    email_confirm: true,
    user_metadata: {
      first_name: validated.firstName,
      last_name: validated.lastName,
    },
  })

  if (authError) {
    throw new ValidationError(`Failed to create user: ${authError.message}`)
  }

  if (!authData.user) {
    throw new Error('User creation failed')
  }

  // 2. Create user profile
  const { error: profileError } = await supabaseAdmin.rpc('create_device_rep_profile', {
    user_id: authData.user.id,
    user_email: validated.email,
    first_name: validated.firstName,
    last_name: validated.lastName,
    phone_number: validated.phone || null,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  // 3. Grant facility access
  const { error: accessError } = await supabaseAdmin
    .from('facility_device_reps')
    .insert({
      facility_id: validated.facilityId,
      user_id: authData.user.id,
      implant_company_id: validated.implantCompanyId,
      status: 'active',
      accepted_at: nowUTC(), // ✅ Timezone-safe!
    })

  if (accessError) {
    throw new Error(`Failed to grant access: ${accessError.message}`)
  }

  // 4. Mark invite as accepted
  await supabaseAdmin
    .from('device_rep_invites')
    .update({ accepted_at: nowUTC() }) // ✅ Timezone-safe!
    .eq('id', validated.inviteId)

  return NextResponse.json({
    success: true,
    userId: authData.user.id,
  }, { status: 201 })
})