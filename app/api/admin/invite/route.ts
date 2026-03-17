import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, handleSupabaseError, AuthorizationError } from '@/lib/errorHandling'
import { validate } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase-server'
import { nowUTC } from '@/lib/dateFactory'
import { sendUserInviteEmail } from '@/lib/email'

// Validation schema
const createInviteSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  facilityId: z.string().uuid('Invalid facility ID'),
  accessLevel: z.enum(['user', 'facility_admin', 'global_admin']),
  roleId: z.string().uuid('Invalid role ID').optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthorizationError('Must be logged in')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('access_level')
    .eq('id', user.id)
    .single()

  if (!userProfile || !['facility_admin', 'global_admin'].includes(userProfile.access_level)) {
    throw new AuthorizationError('Only admins can send invitations')
  }

  // Validate input
  const body = await req.json()
  const validated = validate(createInviteSchema, body)

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', validated.email)
    .single()

  if (existingUser) {
    return NextResponse.json(
      { error: 'User with this email already exists' },
      { status: 400 }
    )
  }

  // Generate token
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Create invite
  const insertData: Record<string, unknown> = {
    email: validated.email,
    first_name: validated.firstName,
    last_name: validated.lastName,
    facility_id: validated.facilityId,
    access_level: validated.accessLevel,
    invite_token: token,
    invited_by: user.id,
    expires_at: expiresAt.toISOString(),
    created_at: nowUTC(),
  }
  if (validated.roleId) {
    insertData.role_id = validated.roleId
  }

  const { data: invite, error: inviteError } = await supabase
    .from('user_invites')
    .insert(insertData)
    .select('id, facilities(name)')
    .single()

  if (inviteError) handleSupabaseError(inviteError)

  // Send email via shared utility (uses verified noreply@orbitsurgical.com)
  const facilityName = (invite.facilities as unknown as { name: string }[] | null)?.[0]?.name || 'ORbit'

  const emailResult = await sendUserInviteEmail(
    validated.email,
    validated.firstName,
    facilityName,
    token,
    validated.accessLevel === 'global_admin' ? 'facility_admin' : validated.accessLevel,
  )

  if (!emailResult.success) {
    throw new Error(`Failed to send email: ${emailResult.error}`)
  }

  return NextResponse.json({
    success: true,
    inviteId: invite.id,
  }, { status: 201 })
})