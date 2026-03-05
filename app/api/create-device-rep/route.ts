// ============================================
// FILE: app/api/create-device-rep/route.ts
// PURPOSE: Create device rep account with auto-confirmed email
// ============================================

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ValidationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { nowUTC } from '@/lib/dateFactory'
import { env, serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('api/create-device-rep')

// Lenient UUID pattern — checks format without enforcing RFC 4122 variant/version bits
// (needed because some facility IDs like a1111111-... don't have standard variant bits)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const createDeviceRepSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  phone: z.string().optional(),
  inviteId: z.string().regex(uuidPattern, 'Invalid invite ID'),
  facilityId: z.string().regex(uuidPattern, 'Invalid facility ID'),
  implantCompanyId: z.string().regex(uuidPattern, 'Invalid company ID'),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Validate input
  const body = await request.json()
  const validated = validate(createDeviceRepSchema, body)

  // Create admin client
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

  // 1. Create auth user with email auto-confirmed
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
    throw new Error('User creation failed - no user returned')
  }

  // 2. Create user profile using the database function
  const { error: profileError } = await supabaseAdmin.rpc('create_device_rep_profile', {
    user_id: authData.user.id,
    user_email: validated.email,
    first_name: validated.firstName,
    last_name: validated.lastName,
    phone_number: validated.phone || null,
  })

  if (profileError) {
    // Try to clean up auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw new Error(`Failed to create user profile: ${profileError.message}`)
  }

  // 3. Set the implant_company_id on the user profile
  const { error: companyError } = await supabaseAdmin
    .from('users')
    .update({ implant_company_id: validated.implantCompanyId })
    .eq('id', authData.user.id)

  if (companyError) {
    log.error('Failed to set implant company:', companyError)
  }

  // 4. Grant access to the facility
  const { error: accessError } = await supabaseAdmin
    .from('facility_device_reps')
    .insert({
      facility_id: validated.facilityId,
      user_id: authData.user.id,
      status: 'accepted',
      accepted_at: nowUTC(),
    })

  if (accessError) {
    throw new Error(`Failed to grant facility access: ${accessError.message}`)
  }

  // 5. Mark invite as accepted
  const { error: inviteError } = await supabaseAdmin
    .from('device_rep_invites')
    .update({ accepted_at: nowUTC() }) // ✅ Timezone-safe timestamp
    .eq('id', validated.inviteId)

  if (inviteError) {
    // Log but don't fail - user is already created
    log.error('Failed to update invite status:', inviteError)
  }

  return NextResponse.json({
    success: true,
    userId: authData.user.id,
  }, { status: 201 })
})