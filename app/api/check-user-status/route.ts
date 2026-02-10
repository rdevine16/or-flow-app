import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, handleSupabaseError } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, access_level, blocked, facility_id, facilities(name, timezone)')
    .eq('id', user.id)
    .single()

  if (profileError) handleSupabaseError(profileError)

  return NextResponse.json({
    user: profile,
    authenticated: true,
  })
})